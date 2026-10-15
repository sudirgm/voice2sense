// ============================================================
// Offline Multilingual Translation Client Service
// Voice 2 Sense | SignBridge 3D
// Pipeline: Mic/Speech -> Local Whisper ASR -> Language Detection -> Indic NLP -> IndicTrans2 -> English -> ISL
// ============================================================

export class OfflineTranslationService {
  constructor() {
    this.currentAbortController = null;
  }

  /**
   * Deterministic client-side script & language detection via Unicode blocks
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en';
    const clean = text.trim();

    const counts = {
      ta: 0,
      te: 0,
      kn: 0,
      ml: 0,
      hi: 0,
      bn: 0,
      gu: 0,
      pa: 0,
      or: 0,
      ur: 0,
      en: 0
    };

    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      if (code >= 0x0B80 && code <= 0x0BFF) counts.ta++;
      else if (code >= 0x0C00 && code <= 0x0C7F) counts.te++;
      else if (code >= 0x0C80 && code <= 0x0CFF) counts.kn++;
      else if (code >= 0x0D00 && code <= 0x0D7F) counts.ml++;
      else if (code >= 0x0900 && code <= 0x097F) counts.hi++;
      else if (code >= 0x0980 && code <= 0x09FF) counts.bn++;
      else if (code >= 0x0A80 && code <= 0x0AFF) counts.gu++;
      else if (code >= 0x0A00 && code <= 0x0A7F) counts.pa++;
      else if (code >= 0x0B00 && code <= 0x0B7F) counts.or++;
      else if (code >= 0x0600 && code <= 0x06FF) counts.ur++;
      else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) counts.en++;
    }

    if (counts.hi > 0) {
      if (/(?:आहे|नाही|नाव|शिकायची|माझ्याकडे|कसे|तुम्ही|करा|पुस्तक|पुस्तके|माझे|तुमचे|तुझे|मला)/i.test(clean)) {
        return 'mr';
      }
      return 'hi';
    }

    let topLang = 'en';
    let maxCount = 0;
    for (const [lang, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        topLang = lang;
      }
    }

    return topLang;
  }

  /**
   * Abort any ongoing translation or speech processing request immediately
   */
  cancel() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  /**
   * Process incoming multi-lingual voice audio or text input through offline neural pipeline.
   * Emits exact development logs as required:
   *   [ASR] detected language:
   *   [ASR] transcription:
   *   [TRANSLATION] source:
   *   [TRANSLATION] English:
   */
  async processMultilingualInput({ text, audioBlob = null, requestId = 0 }) {
    // 1. Immediate cancellation of any pending in-flight request
    this.cancel();
    this.currentAbortController = new AbortController();
    const { signal } = this.currentAbortController;

    const raw = (text || '').trim();
    let audioBase64 = null;

    if (audioBlob) {
      audioBase64 = await this._blobToBase64(audioBlob);
    }

    // Fast-path: pure ASCII English with no audio blob
    if (!audioBlob && raw && this.detectLanguage(raw) === 'en' && /^[\x00-\x7F]+$/.test(raw)) {
      console.log('[ASR] detected language: en');
      console.log('[ASR] transcription:', raw);
      console.log('[TRANSLATION] source:', raw);
      console.log('[TRANSLATION] English:', raw);

      return {
        success: true,
        englishText: raw,
        transcription: raw,
        detectedLanguage: 'en',
        sourceLanguage: 'en',
        originalText: raw,
        requestId
      };
    }

    try {
      const payload = {
        text: raw || null,
        audio_base64: audioBase64,
        src_lang: 'auto'
      };

      const res = await fetch('/api/process_speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
      });

      if (!res.ok) {
        throw new Error(`Offline speech/translation service returned status ${res.status}`);
      }

      const data = await res.json();
      const detectedLang = data.detected_language || 'en';
      const transcription = data.transcription || raw;
      const englishText = data.english_text || transcription;

      // Required development logging
      console.log('[ASR] detected language:', detectedLang);
      console.log('[ASR] transcription:', transcription);
      console.log('[TRANSLATION] source:', transcription);
      console.log('[TRANSLATION] English:', englishText);

      return {
        success: true,
        englishText,
        transcription,
        detectedLanguage: detectedLang,
        sourceLanguage: detectedLang,
        originalText: transcription,
        requestId
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { aborted: true, requestId };
      }
      console.warn('[OfflineTranslationService] Pipeline warning:', err.message);

      return {
        success: false,
        error: err.message,
        englishText: raw,
        transcription: raw,
        detectedLanguage: this.detectLanguage(raw),
        originalText: raw,
        requestId
      };
    }
  }

  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result || '').split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
