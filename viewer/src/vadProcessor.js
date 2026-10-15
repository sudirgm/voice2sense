// ============================================================
// Voice Activity Detection (VAD) & Real-Time Audio Processor
// Voice 2 Sense | Tab 1: Real-Time Communication
// ============================================================

export class VADProcessor {
  constructor(options = {}) {
    this.options = Object.assign({
      onSpeechStart: null,
      onSpeechEnd: null,     // Callback receives { audioBlob, durationSec }
      onAudioLevel: null,    // Callback receives normalized 0.0 - 1.0 level
      energyThreshold: 0.02, // Adaptive baseline RMS threshold
      silenceHangoverMs: 650,// Silence duration before closing a speech segment
      preSpeechBufferMs: 200,// Audio kept prior to speech start to preserve initial consonants
      maxChunkDurationMs: 3800,// Max segment length before emitting to keep latency low
      minSpeechDurationMs: 250 // Ignore transient clicks < 250ms
    }, options);

    this.audioContext = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.processorNode = null;

    this.isActive = false;
    this.isSpeaking = false;
    this.speechStartTime = 0;
    this.lastSpeechTime = 0;

    // Buffers for 16kHz mono PCM
    this.sampleRate = 16000;
    this.preSpeechQueue = [];
    this.speechSamples = [];

    this._animFrameId = null;
    this._silenceCheckTimer = null;
  }

  /**
   * Start VAD processing on an audio MediaStream.
   * @param {MediaStream} audioStream
   */
  start(audioStream) {
    if (!audioStream || audioStream.getAudioTracks().length === 0) {
      console.warn('[VADProcessor] No active audio tracks found in stream.');
      return false;
    }

    this.stop();

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();

      this.sourceNode = this.audioContext.createMediaStreamSource(audioStream);

      // Analyser node for visual VU levels
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.3;

      // ScriptProcessorNode for sample-level analysis (downsampling to 16kHz)
      // Buffer size: 2048 samples (~46ms at 44.1/48kHz)
      this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);

      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.processorNode);
      // Connect to destination via silent gain to keep audio pipeline pumping in Chromium
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0.0;
      this.processorNode.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      const inputSampleRate = this.audioContext.sampleRate;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isActive) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // Downsample input chunk to 16kHz mono
        const downsampled = this._downsampleTo16k(inputData, inputSampleRate, this.sampleRate);
        this._processSamples(downsampled);
      };

      this.isActive = true;
      this._monitorAudioLevel();
      return true;
    } catch (err) {
      console.error('[VADProcessor] Failed to start audio processing:', err);
      this.stop();
      return false;
    }
  }

  /**
   * Stop VAD processing and release Web Audio resources.
   */
  stop() {
    this.isActive = false;

    // If speech was active, emit pending segment if long enough
    if (this.isSpeaking && this.speechSamples.length > 0) {
      this._closeSpeechSegment(true);
    }

    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }

    if (this._silenceCheckTimer) {
      clearTimeout(this._silenceCheckTimer);
      this._silenceCheckTimer = null;
    }

    if (this.processorNode) {
      try { this.processorNode.disconnect(); } catch {}
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.analyserNode) {
      try { this.analyserNode.disconnect(); } catch {}
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }

    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }

    this.preSpeechQueue = [];
    this.speechSamples = [];
    this.isSpeaking = false;
  }

  /**
   * Process 16kHz mono samples and determine speech vs silence.
   */
  _processSamples(samples) {
    if (!samples || samples.length === 0) return;

    // Calculate Root-Mean-Square (RMS) energy
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / samples.length);
    const now = performance.now();

    const isSpeechFrame = rms > this.options.energyThreshold;

    if (isSpeechFrame) {
      this.lastSpeechTime = now;

      if (!this.isSpeaking) {
        // Speech start detected!
        this.isSpeaking = true;
        this.speechStartTime = now;
        this.speechSamples = [];

        // Prepend pre-speech buffer to catch leading consonants
        for (let i = 0; i < this.preSpeechQueue.length; i++) {
          for (let j = 0; j < this.preSpeechQueue[i].length; j++) {
            this.speechSamples.push(this.preSpeechQueue[i][j]);
          }
        }
        this.preSpeechQueue = [];

        if (this.options.onSpeechStart) {
          this.options.onSpeechStart();
        }
      }

      // Accumulate samples into active speech chunk
      for (let i = 0; i < samples.length; i++) {
        this.speechSamples.push(samples[i]);
      }

      // Safety check: if chunk exceeds maxChunkDurationMs, close and start fresh segment to preserve low latency
      const currentDurationMs = now - this.speechStartTime;
      if (currentDurationMs >= this.options.maxChunkDurationMs) {
        this._closeSpeechSegment(false);
      }

    } else {
      // Silence frame
      if (this.isSpeaking) {
        // Continue accumulating silence during hangover period
        for (let i = 0; i < samples.length; i++) {
          this.speechSamples.push(samples[i]);
        }

        const silenceDuration = now - this.lastSpeechTime;
        if (silenceDuration >= this.options.silenceHangoverMs) {
          this._closeSpeechSegment(true);
        }
      } else {
        // Maintain sliding pre-speech queue (~200ms)
        const maxPreFrames = Math.ceil(this.options.preSpeechBufferMs / (samples.length / (this.sampleRate / 1000)));
        this.preSpeechQueue.push(samples);
        while (this.preSpeechQueue.length > maxPreFrames) {
          this.preSpeechQueue.shift();
        }
      }
    }
  }

  /**
   * Finalize speech segment and convert to 16kHz WAV Blob.
   */
  _closeSpeechSegment(resetSpeakingState = true) {
    if (this.speechSamples.length === 0) return;

    const totalSamples = this.speechSamples.length;
    const durationSec = totalSamples / this.sampleRate;

    // Filter out micro-clicks / transients below minimum speech threshold
    if (durationSec * 1000 >= this.options.minSpeechDurationMs) {
      const float32Array = new Float32Array(this.speechSamples);
      const wavBlob = this._encodeWav(float32Array, this.sampleRate);

      if (this.options.onSpeechEnd) {
        this.options.onSpeechEnd({
          audioBlob: wavBlob,
          durationSec: durationSec
        });
      }
    }

    this.speechSamples = [];
    if (resetSpeakingState) {
      this.isSpeaking = false;
    } else {
      this.speechStartTime = performance.now();
    }
  }

  /**
   * Downsamples arbitrary audio sample rate to 16,000 Hz.
   */
  _downsampleTo16k(buffer, fromRate, toRate = 16000) {
    if (fromRate === toRate) {
      return buffer;
    }
    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  /**
   * Encodes float32 PCM array into a standard 16kHz 16-bit mono WAV Blob.
   */
  _encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this._writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true);  // NumChannels (1 = mono)
    view.setUint32(24, sampleRate, true); // SampleRate (16000)
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true);  // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)

    // data sub-chunk
    this._writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write 16-bit PCM samples with clipping
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Continuous visual level monitoring for VU meter.
   */
  _monitorAudioLevel() {
    if (!this.analyserNode) return;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const check = () => {
      if (!this.isActive || !this.analyserNode) return;
      this.analyserNode.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalized = Math.min(1.0, avg / 128);

      if (this.options.onAudioLevel) {
        this.options.onAudioLevel(normalized);
      }

      this._animFrameId = requestAnimationFrame(check);
    };

    this._animFrameId = requestAnimationFrame(check);
  }
}
