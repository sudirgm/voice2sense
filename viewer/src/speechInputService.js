/**
 * ============================================================================
 * Voice 2 Sense — Speech Input Service
 * 
 * Regional Indian Speech Recognition & Internal Translation:
 * - Supports major regional Indian languages (Tamil, Hindi, Telugu, Kannada,
 *   Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, Urdu, English)
 * - Uses Web Speech API with language tags + local offline Whisper ASR fallback
 * - Translates regional speech internally to English for syllabus search
 * - Audio level (VU) monitoring & recording state management
 * - Handles mic permissions, no-speech timeouts, cancellation & stop controls
 * ============================================================================
 */

import { OfflineTranslationService } from './offlineTranslationService.js';
import { meaningNormalizer, LANGUAGE_BY_CODE, SUPPORTED_INDIAN_LANGUAGES } from './meaningNormalizer.js';

export const INDIAN_LANGUAGES = [
  { code: 'auto', langKey: 'auto', name: 'Auto Detect (Indian Languages)', flag: '✨' },
  { code: 'ta-IN', langKey: 'ta', name: 'Tamil (தமிழ்)', flag: '🇮🇳' },
  { code: 'hi-IN', langKey: 'hi', name: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'te-IN', langKey: 'te', name: 'Telugu (తెలుగు)', flag: '🇮🇳' },
  { code: 'kn-IN', langKey: 'kn', name: 'Kannada (ಕನ್ನಡ)', flag: '🇮🇳' },
  { code: 'ml-IN', langKey: 'ml', name: 'Malayalam (മലയാളം)', flag: '🇮🇳' },
  { code: 'mr-IN', langKey: 'mr', name: 'Marathi (मराठी)', flag: '🇮🇳' },
  { code: 'bn-IN', langKey: 'bn', name: 'Bengali (বাংলা)', flag: '🇮🇳' },
  { code: 'gu-IN', langKey: 'gu', name: 'Gujarati (ગુજરાતી)', flag: '🇮🇳' },
  { code: 'pa-IN', langKey: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)', flag: '🇮🇳' },
  { code: 'or-IN', langKey: 'or', name: 'Odia (ଓଡ଼ିଆ)', flag: '🇮🇳' },
  { code: 'ur-IN', langKey: 'ur', name: 'Urdu (اردو)', flag: '🇮🇳' },
  { code: 'en-IN', langKey: 'en', name: 'English (India)', flag: '🇮🇳' },
  { code: 'en-US', langKey: 'en', name: 'English (US)', flag: '🌐' }
];

export const INDIAN_LANGUAGES_MAP = Object.fromEntries(INDIAN_LANGUAGES.map(l => [l.code, l]));

export const SPEECH_STATES = {
  IDLE: 'IDLE',
  REQUESTING_PERMISSION: 'REQUESTING_PERMISSION',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  ERROR: 'ERROR'
};

export class SpeechInputService {
  constructor() {
    this.selectedLanguage = 'auto'; // Default: Auto-detect spoken Indian language without manual selection
    this.state = SPEECH_STATES.IDLE;
    this.recognition = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.animFrameId = null;
    this.translationService = new OfflineTranslationService();

    // Callbacks
    this.onStateChange = null;
    this.onAudioLevel = null;
    this.onInterimTranscript = null;
    this.onFinalResult = null;
    this.onError = null;

    this.currentTranscript = '';
    this.stabilizeTimer = null;
    this.silenceHangoverMs = 1100; // Distinguish temporary pause vs actual completion
  }

  setLanguage(langCode) {
    this.selectedLanguage = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
  }

  getLanguage() {
    return this.selectedLanguage;
  }

  getLanguageName() {
    const item = INDIAN_LANGUAGES_MAP[this.selectedLanguage];
    return item ? item.name : this.selectedLanguage;
  }

  async translateRegionalSpeech(spokenText) {
    if (!spokenText) return '';
    try {
      const transResult = await this.translationService.processMultilingualInput({
        text: spokenText,
        audioBlob: null
      });
      return transResult.englishText || spokenText;
    } catch {
      return spokenText;
    }
  }

  /**
   * Starts listening through microphone
   */
  async startListening() {
    if (this.state === SPEECH_STATES.LISTENING || this.state === SPEECH_STATES.REQUESTING_PERMISSION) {
      return;
    }

    this._setState(SPEECH_STATES.REQUESTING_PERMISSION);
    this.currentTranscript = '';
    this.audioChunks = [];

    // 1. Request microphone permission and get stream for VU meter and fallback audio recording
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this._initAudioAnalyser(this.mediaStream);
    } catch (err) {
      console.warn('[SpeechInputService] Mic permission denied or unavailable:', err);
      this._setState(SPEECH_STATES.ERROR);
      if (this.onError) {
        this.onError({
          code: 'permission-denied',
          message: 'Microphone access was denied. Please allow microphone permissions in your browser settings.'
        });
      }
      return;
    }

    // 2. Initialize and start Web Speech API in the target regional language
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    let webSpeechStarted = false;

    if (SpeechRec) {
      try {
        this.recognition = new SpeechRec();
        this.recognition.lang = this.selectedLanguage;
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
          this._setState(SPEECH_STATES.LISTENING);
        };

        this.recognition.onresult = (event) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript;
            } else {
              interim += transcript;
            }
          }

          const currentWords = (final || interim).trim();
          if (currentWords) {
            this.currentTranscript = currentWords;
            // Immediate language detection preview if native script detected
            const autoDetectedLang = meaningNormalizer.detectLanguage(currentWords);
            const langMeta = LANGUAGE_BY_CODE[autoDetectedLang];

            if (this.onInterimTranscript) {
              this.onInterimTranscript({
                interim: interim || final,
                detectedLanguage: autoDetectedLang,
                languageName: langMeta ? langMeta.name : 'Indian Language',
                flag: langMeta ? langMeta.flag : '🇮🇳'
              });
            }

            // Speech stabilization: wait for user to finish thought before triggering animation
            if (this.stabilizeTimer) {
              clearTimeout(this.stabilizeTimer);
            }
            this.stabilizeTimer = setTimeout(() => {
              this.stabilizeTimer = null;
              if (this.state === SPEECH_STATES.LISTENING) {
                this.stopListening();
              }
            }, this.silenceHangoverMs);
          }
        };

        this.recognition.onerror = (event) => {
          console.warn('[SpeechInputService] Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            this._setState(SPEECH_STATES.ERROR);
            if (this.onError) {
              this.onError({ code: 'unclear-speech', message: '⚠️ I couldn\'t clearly understand that. Please repeat.' });
            }
          } else if (event.error === 'not-allowed') {
            this._setState(SPEECH_STATES.ERROR);
            if (this.onError) {
              this.onError({ code: 'not-allowed', message: 'Microphone permission blocked.' });
            }
          }
        };

        this.recognition.onend = async () => {
          if (this.state === SPEECH_STATES.LISTENING && !this.stabilizeTimer) {
            await this._handleSpeechEnd();
          }
        };

        this.recognition.start();
        webSpeechStarted = true;
      } catch (err) {
        console.warn('[SpeechInputService] Failed to start Web Speech Recognition:', err);
      }
    }

    // 3. Start MediaRecorder as fallback or companion
    if (window.MediaRecorder && this.mediaStream) {
      try {
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
        };
        this.mediaRecorder.start(250);
      } catch (err) {
        console.warn('[SpeechInputService] MediaRecorder start warning:', err);
      }
    }

    if (!webSpeechStarted) {
      // Fallback to pure audio recording and VAD if Web Speech API is absent
      this._setState(SPEECH_STATES.LISTENING);
    }
  }

  /**
   * Stops recording and initiates speech transcription, meaning normalization & ISL matching
   */
  async stopListening() {
    if (this.state !== SPEECH_STATES.LISTENING) {
      return;
    }

    if (this.stabilizeTimer) {
      clearTimeout(this.stabilizeTimer);
      this.stabilizeTimer = null;
    }

    this._setState(SPEECH_STATES.PROCESSING);

    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }

    await this._handleSpeechEnd();
  }

  /**
   * Cancels recording without processing
   */
  cancel() {
    if (this.stabilizeTimer) {
      clearTimeout(this.stabilizeTimer);
      this.stabilizeTimer = null;
    }
    this._cleanupAudio();
    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
      this.recognition = null;
    }
    this.currentTranscript = '';
    this.audioChunks = [];
    this._setState(SPEECH_STATES.IDLE);
  }

  async _handleSpeechEnd() {
    if (this.stabilizeTimer) {
      clearTimeout(this.stabilizeTimer);
      this.stabilizeTimer = null;
    }

    this._cleanupAudio();
    this._setState(SPEECH_STATES.PROCESSING);

    let spokenText = this.currentTranscript.trim();
    let audioBlob = null;

    if (this.audioChunks.length > 0) {
      audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    }

    // Process speech via local offline ASR / translation service
    try {
      const transResult = await this.translationService.processMultilingualInput({
        text: spokenText || null,
        audioBlob: audioBlob
      });

      const effectiveSpoken = (transResult.transcription || spokenText || '').trim();
      const internalEnglish = (transResult.englishText || effectiveSpoken).trim();
      const detectedLang = transResult.detectedLanguage || meaningNormalizer.detectLanguage(effectiveSpoken);

      if (!effectiveSpoken && !internalEnglish) {
        this._setState(SPEECH_STATES.ERROR);
        if (this.onError) {
          this.onError({
            code: 'unclear-speech',
            message: '⚠️ I couldn\'t clearly understand that. Please repeat.'
          });
        }
        return;
      }

      // Pass through Semantic Meaning Normalizer (Rules 3, 4, 5, 8, 9, 17)
      const normResult = meaningNormalizer.normalizeMeaning({
        spokenText: effectiveSpoken,
        internalEnglish: internalEnglish,
        detectedLang: detectedLang
      });

      this._setState(SPEECH_STATES.IDLE);

      if (this.onFinalResult) {
        this.onFinalResult({
          spokenText: normResult.nativeText || effectiveSpoken,
          detectedLanguage: normResult.detectedLanguage || detectedLang,
          detectedLanguageName: normResult.languageName,
          languageFlag: normResult.languageFlag,
          canonicalMeaning: normResult.canonicalMeaning,
          primaryGloss: normResult.primaryGloss,
          isFullyAvailable: normResult.isFullyAvailable,
          limitationMessage: normResult.limitationMessage,
          sequence: normResult.sequence,
          // Internal debugging only (Rule 3)
          englishText: normResult._internalEnglish || internalEnglish
        });
      }
      return;
    } catch (err) {
      console.warn('[SpeechInputService] ASR / Translation error:', err);
      this._setState(SPEECH_STATES.ERROR);
      if (this.onError) {
        this.onError({
          code: 'unclear-speech',
          message: '⚠️ I couldn\'t clearly understand that. Please repeat.'
        });
      }
    }
  }

  _initAudioAnalyser(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!this.analyser || this.state !== SPEECH_STATES.LISTENING) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));

        if (this.onAudioLevel) {
          this.onAudioLevel(normalized);
        }

        this.animFrameId = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn('[SpeechInputService] AudioContext analyser init warning:', err);
    }
  }

  _cleanupAudio() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.onAudioLevel) {
      this.onAudioLevel(0);
    }
  }

  _setState(newState) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }
}

export const speechInputService = new SpeechInputService();
