// ============================================================
// Screen & System Audio Capture Service
// Voice 2 Sense | Tab 1: Real-Time Communication
// ============================================================

export class ScreenCaptureService {
  constructor(options = {}) {
    this.options = Object.assign({
      onTrackEnded: null,
      onAudioStatusChange: null,
      onError: null
    }, options);

    this.mediaStream = null;
    this.videoTrack = null;
    this.audioTrack = null;
    this.isCapturing = false;
    this.hasSystemAudio = false;
    this.sourceLabel = 'Display / Application Window';

    this._boundOnVideoEnded = this._onVideoEnded.bind(this);
    this._boundOnAudioEnded = this._onAudioEnded.bind(this);
  }

  /**
   * Request and start screen/display capture with system audio.
   * Prevents duplicate sessions and releases any existing stream before re-acquiring.
   * @returns {Promise<{ stream: MediaStream, hasAudio: boolean, sourceLabel: string }>}
   */
  async startCapture() {
    if (this.isCapturing) {
      console.warn('[ScreenCaptureService] Capture session is already active. Stop first.');
      return {
        stream: this.mediaStream,
        hasAudio: this.hasSystemAudio,
        sourceLabel: this.sourceLabel
      };
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      const err = new Error('Screen capture API (getDisplayMedia) is not supported in this browser.');
      err.name = 'NotSupportedError';
      if (this.options.onError) this.options.onError(err);
      throw err;
    }

    // Explicit capture constraints requesting both video and system audio
    const displayMediaOptions = {
      video: {
        displaySurface: 'monitor',
        cursor: 'always'
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: false
      },
      systemAudio: 'include',
      surfaceSwitching: 'include',
      selfBrowserSurface: 'exclude'
    };

    try {
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch (err) {
      // Handle user cancellation / permission denial gracefully
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        const cancelErr = new Error('Screen capture was cancelled or permission was denied.');
        cancelErr.name = 'NotAllowedError';
        if (this.options.onError) this.options.onError(cancelErr);
        throw cancelErr;
      }
      if (this.options.onError) this.options.onError(err);
      throw err;
    }

    this.isCapturing = true;

    // Inspect video track
    const videoTracks = this.mediaStream.getVideoTracks();
    if (videoTracks.length > 0) {
      this.videoTrack = videoTracks[0];
      this.sourceLabel = this.videoTrack.label || 'Display / Application Window';
      this.videoTrack.addEventListener('ended', this._boundOnVideoEnded);
    }

    // Inspect system audio track
    const audioTracks = this.mediaStream.getAudioTracks();
    if (audioTracks.length > 0) {
      this.audioTrack = audioTracks[0];
      this.hasSystemAudio = true;
      this.audioTrack.addEventListener('ended', this._boundOnAudioEnded);
      if (this.options.onAudioStatusChange) {
        this.options.onAudioStatusChange({
          hasAudio: true,
          label: this.audioTrack.label || 'System Audio'
        });
      }
    } else {
      this.audioTrack = null;
      this.hasSystemAudio = false;
      if (this.options.onAudioStatusChange) {
        this.options.onAudioStatusChange({
          hasAudio: false,
          label: 'System audio unavailable'
        });
      }
    }

    return {
      stream: this.mediaStream,
      hasAudio: this.hasSystemAudio,
      sourceLabel: this.sourceLabel
    };
  }

  /**
   * Stop active capture session cleanly and release all hardware tracks.
   */
  stopCapture() {
    if (!this.isCapturing && !this.mediaStream) {
      return;
    }

    this.isCapturing = false;

    if (this.videoTrack) {
      this.videoTrack.removeEventListener('ended', this._boundOnVideoEnded);
      try { this.videoTrack.stop(); } catch {}
      this.videoTrack = null;
    }

    if (this.audioTrack) {
      this.audioTrack.removeEventListener('ended', this._boundOnAudioEnded);
      try { this.audioTrack.stop(); } catch {}
      this.audioTrack = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(t => {
          try { t.stop(); } catch {}
        });
      } catch {}
      this.mediaStream = null;
    }

    this.hasSystemAudio = false;
    this.sourceLabel = 'Display / Application Window';

    if (this.options.onAudioStatusChange) {
      this.options.onAudioStatusChange({
        hasAudio: false,
        label: 'Capture stopped'
      });
    }
  }

  _onVideoEnded() {
    console.log('[ScreenCaptureService] Video track ended by user or OS.');
    this.stopCapture();
    if (this.options.onTrackEnded) {
      this.options.onTrackEnded('video');
    }
  }

  _onAudioEnded() {
    console.log('[ScreenCaptureService] Audio track ended.');
    this.hasSystemAudio = false;
    if (this.options.onAudioStatusChange) {
      this.options.onAudioStatusChange({
        hasAudio: false,
        label: 'System audio track disconnected'
      });
    }
  }

  getAudioStream() {
    if (!this.mediaStream || !this.hasSystemAudio || !this.audioTrack) {
      return null;
    }
    return new MediaStream([this.audioTrack]);
  }
}
