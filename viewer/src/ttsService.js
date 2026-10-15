/**
 * ============================================================================
 * Voice 2 Sense — Text-to-Speech (TTS) Service
 * 
 * Multi-modal Academic Audio Engine:
 * - Converts academic AI answers into spoken audio via browser SpeechSynthesis
 * - Prefers Indian English / regional voices when available
 * - Provides play, pause, resume, stop, and replay controls
 * - Syncs audio state with active conversation message bubbles
 * ============================================================================
 */

export const TTS_STATES = {
  STOPPED: 'STOPPED',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED'
};

export class TTSService {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.currentUtterance = null;
    this.currentMessageId = null;
    this.state = TTS_STATES.STOPPED;
    this.availableVoices = [];
    this.selectedVoice = null;
    this.rate = 1.0;
    this.pitch = 1.0;

    // Callbacks
    this.onStateChange = null; // ({ state, messageId })
    this.onEnd = null;

    this._initVoices();
  }

  _initVoices() {
    if (!this.synth) return;

    const populate = () => {
      this.availableVoices = this.synth.getVoices() || [];
      // Pick natural Indian English voice if available, else first English voice
      const indianVoice = this.availableVoices.find(v => v.lang === 'en-IN' || v.name.includes('India'));
      const engVoice = this.availableVoices.find(v => v.lang.startsWith('en'));
      this.selectedVoice = indianVoice || engVoice || this.availableVoices[0] || null;
    };

    populate();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = populate;
    }
  }

  /**
   * Speaks the provided academic answer text.
   * Cleans markdown syntax before speaking for natural audio delivery.
   * 
   * @param {string} text - The answer text
   * @param {string} messageId - Unique message ID for UI tracking
   */
  speak(text, messageId = null) {
    if (!this.synth) {
      console.warn('[TTSService] SpeechSynthesis not supported in this browser.');
      return;
    }

    this.stop();

    if (!text || !text.trim()) return;

    // Clean markdown formatting for clean audio pronunciation
    const cleanText = text
      .replace(/[*#_`~>]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/•\s*/g, ' ')
      .replace(/—/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();

    this.currentMessageId = messageId;
    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);

    if (this.selectedVoice) {
      this.currentUtterance.voice = this.selectedVoice;
    }
    this.currentUtterance.rate = this.rate;
    this.currentUtterance.pitch = this.pitch;

    this.currentUtterance.onstart = () => {
      this.state = TTS_STATES.PLAYING;
      this._emitStateChange();
    };

    this.currentUtterance.onpause = () => {
      this.state = TTS_STATES.PAUSED;
      this._emitStateChange();
    };

    this.currentUtterance.onresume = () => {
      this.state = TTS_STATES.PLAYING;
      this._emitStateChange();
    };

    this.currentUtterance.onend = () => {
      this.state = TTS_STATES.STOPPED;
      this._emitStateChange();
      if (this.onEnd) this.onEnd(this.currentMessageId);
      this.currentMessageId = null;
      this.currentUtterance = null;
    };

    this.currentUtterance.onerror = (e) => {
      console.warn('[TTSService] SpeechSynthesis utterance error:', e);
      this.state = TTS_STATES.STOPPED;
      this._emitStateChange();
      this.currentMessageId = null;
      this.currentUtterance = null;
    };

    this.synth.speak(this.currentUtterance);
  }

  pause() {
    if (this.synth && this.state === TTS_STATES.PLAYING) {
      this.synth.pause();
      this.state = TTS_STATES.PAUSED;
      this._emitStateChange();
    }
  }

  resume() {
    if (this.synth && this.state === TTS_STATES.PAUSED) {
      this.synth.resume();
      this.state = TTS_STATES.PLAYING;
      this._emitStateChange();
    }
  }

  stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
    }
    this.state = TTS_STATES.STOPPED;
    this._emitStateChange();
    this.currentMessageId = null;
    this.currentUtterance = null;
  }

  replay(text, messageId) {
    this.stop();
    this.speak(text, messageId);
  }

  getState() {
    return {
      state: this.state,
      currentMessageId: this.currentMessageId
    };
  }

  _emitStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        state: this.state,
        messageId: this.currentMessageId
      });
    }
  }
}

export const ttsService = new TTSService();
