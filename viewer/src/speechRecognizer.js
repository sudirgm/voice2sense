// Real-time Multilingual Speech-to-Text & Audio Stream Processor for Voice 2 Sense
import { meaningNormalizer, LANGUAGE_BY_CODE } from './meaningNormalizer.js';

export class SpeechRecognizer {
  constructor(onTranscript, onAudioLevel, onError = null) {
    this.onTranscript = onTranscript;
    this.onAudioLevel = onAudioLevel;
    this.onError = onError;
    this.recognition = null;
    this.isListening = false;
    this.audioContext = null;
    this.analyser = null;
    this.animFrameId = null;

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.silenceTimer = null;
    this.lastAudioLevel = 0;

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[SpeechRecognizer] Web Speech API not supported in this browser. Audio recording will be used.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeText = (finalTranscript || interimTranscript).trim();
      const detectedLang = meaningNormalizer.detectLanguage(activeText);
      const langMeta = LANGUAGE_BY_CODE[detectedLang] || {
        code: detectedLang,
        name: detectedLang === 'en' ? 'English' : 'Indian Language',
        flag: detectedLang === 'en' ? '🌐' : '🇮🇳'
      };

      if (this.onTranscript) {
        this.onTranscript({
          interim: interimTranscript.trim(),
          final: finalTranscript.trim(),
          detectedLanguage: detectedLang,
          languageName: langMeta.name,
          languageFlag: langMeta.flag,
          audioBlob: null
        });
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('[SpeechRecognizer] Recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.isListening = false;
        if (this.onError) {
          this.onError({
            code: 'permission-denied',
            message: 'Microphone permission denied. Voice recognition requires microphone access.'
          });
        }
      } else if (event.error === 'no-speech') {
        if (this.onError) {
          this.onError({
            code: 'unclear-speech',
            message: '⚠️ I couldn\'t clearly understand that. Please repeat.'
          });
        }
      } else if (this.onError) {
        this.onError({
          code: event.error,
          message: `Recognition error: ${event.error}`
        });
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {}
      }
    };
  }

  start(audioStream = null) {
    if (this.recognition && !this.isListening) {
      this.isListening = true;
      try {
        this.recognition.start();
      } catch (err) {
        console.warn('Recognition start warning:', err);
      }
    }

    this.isListening = true;

    // Start MediaRecorder if MediaStream is provided
    if (audioStream && window.MediaRecorder) {
      try {
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(audioStream);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.audioChunks.push(e.data);
          }
        };
        this.mediaRecorder.onstop = () => {
          if (this.audioChunks.length > 0) {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            this.audioChunks = [];
            if (this.onTranscript) {
              this.onTranscript({
                interim: '',
                final: '',
                audioBlob
              });
            }
          }
        };
        this.mediaRecorder.start(250);
      } catch (e) {
        console.warn('MediaRecorder start notice:', e);
      }
    }

    // Connect AudioContext analyser if a MediaStream is provided
    if (audioStream && audioStream.getAudioTracks().length > 0) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(audioStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);
        this.monitorAudioLevel();
      } catch (e) {
        console.warn('AudioContext monitor warning:', e);
      }
    }
  }

  stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  monitorAudioLevel() {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const check = () => {
      if (!this.isListening) return;
      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalized = Math.min(1.0, avg / 128);
      this.lastAudioLevel = normalized;

      if (this.onAudioLevel) {
        this.onAudioLevel(normalized);
      }

      this.animFrameId = requestAnimationFrame(check);
    };
    this.animFrameId = requestAnimationFrame(check);
  }
}
