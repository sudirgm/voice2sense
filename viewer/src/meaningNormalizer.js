// ============================================================
// Meaning & Semantic Normalization Layer for Voice 2 Sense
// Core Product Rules:
// - Rule 1: Unified multilingual pipeline (Tamil, Hindi, Telugu, Kannada, Malayalam, etc.)
// - Rule 3: Hidden intermediate English representation
// - Rule 4: Common meaning over literal translation
// - Rule 5 & 17: Strict non-fabrication of unverified ISL signs
// - Rule 9: Distinct handling of language vs. sign coverage limitations
// ============================================================

import { SIGN_LIBRARY } from './learningEngine.js';

export const SUPPORTED_INDIAN_LANGUAGES = [
  { code: 'ta', name: 'Tamil', script: 'தமிழ்', flag: '🇮🇳' },
  { code: 'hi', name: 'Hindi', script: 'हिन्दी', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', script: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', script: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', script: 'മലയാളം', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', script: 'मराठी', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', script: 'বাংলা', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', script: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', script: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'or', name: 'Odia', script: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', script: 'اردو', flag: '🇮🇳' },
  { code: 'en', name: 'English', script: 'English', flag: '🌐' }
];

export const LANGUAGE_BY_CODE = Object.fromEntries(
  SUPPORTED_INDIAN_LANGUAGES.map(l => [l.code, l])
);

/**
 * Universal canonical meanings for frequent communicative intentions.
 * Maps diverse linguistic expressions into verified ISL concepts.
 */
const CANONICAL_INTENTS = [
  {
    intentId: 'INTENT_WATER',
    canonicalMeaning: 'Request for Water',
    primaryGloss: 'WATER',
    signWord: 'Water',
    englishPatterns: [
      /\b(water|thirsty|drink water|want water|need water|glass of water)\b/i
    ],
    nativePatterns: [
      /தண்ணீர்|தண்ணி|குடிநீர்/i,         // Tamil
      /पानी|जल/i,                          // Hindi / Marathi
      /నీళ్లు|నీరు|మంచినీళ్లు/i,          // Telugu
      /ನೀರು|ಕುಡಿಯುವ ನೀರು/i,               // Kannada
      /വെള്ളം|കുടിവെള്ളം/i,                // Malayalam
      /জল|পানি/i                           // Bengali
    ],
    verifiedSignLookup: { type: 'word', word: 'Water', gloss: 'WATER' }
  },
  {
    intentId: 'INTENT_HELP',
    canonicalMeaning: 'Request for Assistance / Help',
    primaryGloss: 'HELP',
    signWord: 'Help',
    englishPatterns: [
      /\b(help|need help|want help|help me|assist|assistance|emergency)\b/i
    ],
    nativePatterns: [
      /உதவி|உதவுங்கள்|காப்பாத்துங்கள்/i,  // Tamil
      /मदद|सहायता|मदद चाहिए/i,            // Hindi / Marathi
      /సహాయం|సహాయం కావాలి/i,              // Telugu
      /ಸಹಾಯ|ಸಹಾಯ ಬೇಕು/i,                  // Kannada
      /സഹായം|സഹായിക്കൂ/i,                 // Malayalam
      /সাহায্য|সাহায্য চাই/i              // Bengali
    ],
    verifiedSignLookup: { type: 'word', word: 'Help', gloss: 'HELP' }
  },
  {
    intentId: 'INTENT_FOOD',
    canonicalMeaning: 'Request for Food / Meal',
    primaryGloss: 'FOOD',
    signWord: 'Food',
    englishPatterns: [
      /\b(food|eat|hungry|meal|lunch|dinner|breakfast|snack)\b/i
    ],
    nativePatterns: [
      /சாப்பாடு|உணவு|பசி/i,               // Tamil
      /खाना|भोजन|भूख/i,                   // Hindi / Marathi
      /ఆహారం|భోజనం|తిండి|ఆకలి/i,          // Telugu
      /ಊಟ|ಆಹಾರ|ತಿಂಡಿ|ಹಸಿವು/i,             // Kannada
      /ഭക്ഷണം|ഊണ്|വിശപ്പ്/i,              // Malayalam
      /খাবার|ভাত|ক্ষুধা/i                 // Bengali
    ],
    verifiedSignLookup: { type: 'word', word: 'Food', gloss: 'FOOD' }
  },
  {
    intentId: 'INTENT_HOME',
    canonicalMeaning: 'Go Home / Residence',
    primaryGloss: 'HOME',
    signWord: 'Home',
    englishPatterns: [
      /\b(home|go home|house|stay home|reach home)\b/i
    ],
    nativePatterns: [
      /வீடு|வீட்டுக்கு|வீட்டுக்கு போ/i,    // Tamil
      /घर|घर जाना|घर चलो/i,               // Hindi / Marathi
      /ఇల్లు|ఇంటికి|ఇంటికి వెళ్లాలి/i,     // Telugu
      /ಮನೆ|ಮನೆಗೆ ಹೋಗು/i,                  // Kannada
      /വീട്|വീട്ടിലേക്ക്/i,                 // Malayalam
      /বাড়ি|ঘর|বাড়ি যাব/i                 // Bengali
    ],
    verifiedSignLookup: { type: 'word', word: 'Home', gloss: 'HOME' }
  },
  {
    intentId: 'INTENT_GREETING',
    canonicalMeaning: 'Social Greeting',
    primaryGloss: 'HELLO',
    signWord: 'Hello',
    englishPatterns: [
      /\b(hello|hi|welcome|good morning|good afternoon|good evening|greetings)\b/i
    ],
    nativePatterns: [
      /வணக்கம்|நல்வரவு|காலை வணக்கம்/i,      // Tamil
      /नमस्ते|नमस्कार|सुप्रभात/i,           // Hindi / Marathi
      /నమస్కారం|శుభోదయం/i,                // Telugu
      /ನಮಸ್ಕಾರ|ಶುಭೋದಯ/i,                  // Kannada
      /നമസ്കാരം|സുപ്രഭാതം/i,              // Malayalam
      /নমস্কার|স্বাগতম/i                  // Bengali
    ],
    verifiedSignLookup: { type: 'word', word: 'Hello', gloss: 'HELLO' }
  },
  {
    intentId: 'INTENT_THANKS',
    canonicalMeaning: 'Gratitude / Thank You',
    primaryGloss: 'THANK YOU',
    signWord: 'Thank You',
    englishPatterns: [
      /\b(thank you|thanks|grateful|gratitude)\b/i
    ],
    nativePatterns: [
      /நன்றி|மிக்க நன்றி/i,                // Tamil
      /धन्यवाद|शुक्रिया/i,                 // Hindi / Marathi
      /ధన్యవాదాలు|కృతజ్ఞతలు/i,            // Telugu
      /ಧನ್ಯವಾದ|ಧನ್ಯವಾದಗಳು/i,              // Kannada
      /നന്ദി/i,                           // Malayalam
      /ধন্যবাদ/i                          // Bengali
    ],
    verifiedSignLookup: { type: 'word', word: 'Thank You', gloss: 'THANK YOU' }
  },
  {
    intentId: 'INTENT_YES',
    canonicalMeaning: 'Affirmation / Yes',
    primaryGloss: 'YES',
    signWord: 'Yes',
    englishPatterns: [
      /\b(yes|yeah|sure|correct|agree|agreed|okay|fine)\b/i
    ],
    nativePatterns: [
      /ஆம்|சரி|ஆமாம்/i,                   // Tamil
      /हाँ|हां|सही|ठीक है/i,              // Hindi / Marathi
      /అవును|సరే/i,                       // Telugu
      /ಹೌದು|ಸರಿ/i,                        // Kannada
      /അതെ|ശരി/i,                         // Malayalam
      /হ্যাঁ|ঠিক আছে/i                    // Bengali
    ],
    verifiedSignLookup: { type: 'word', word: 'Yes', gloss: 'YES' }
  },
  {
    intentId: 'INTENT_NO',
    canonicalMeaning: 'Negation / No',
    primaryGloss: 'NO',
    signWord: 'No',
    englishPatterns: [
      /\b(no|nope|not|never|disagree|don't want|refuse)\b/i
    ],
    nativePatterns: [
      /இல்லை|வேண்டாம்/i,                  // Tamil
      /नहीं|मत|ना/i,                       // Hindi / Marathi
      /కాదు|వద్దు|లేదు/i,                  // Telugu
      /ಇಲ್ಲ|ಬೇಡ/i,                        // Kannada
      /അല്ല|വേണ്ട/i,                       // Malayalam
      /না|নয়/i                           // Bengali
    ],
    verifiedSignLookup: { type: 'word', word: 'No', gloss: 'NO' }
  }
];

export class MeaningNormalizer {
  constructor(signMatcherInstance = null) {
    this.signMatcher = signMatcherInstance;
    this._wordLookupCache = new Map();
    this._initWordLookup();
  }

  setSignMatcher(matcher) {
    this.signMatcher = matcher;
  }

  _initWordLookup() {
    // Populate word lookup from SIGN_LIBRARY in learningEngine.js
    if (Array.isArray(SIGN_LIBRARY)) {
      for (const item of SIGN_LIBRARY) {
        if (item.word) {
          const key = item.word.toLowerCase().trim();
          this._wordLookupCache.set(key, item);
        }
      }
    }
  }

  /**
   * Identifies if a script belongs to one of the supported Indian languages.
   * @param {string} text
   * @returns {string} language code or 'en'
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en';
    const clean = text.trim();

    const counts = {
      ta: 0, te: 0, kn: 0, ml: 0, hi: 0,
      bn: 0, gu: 0, pa: 0, or: 0, ur: 0, en: 0
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
      if (/(?:आहे|नाही|नाव|शिकायची|माझ्याकडे|कసే|तुम्ही|करा|पुस्तक|पुस्तके|माझे|तुमचे|तुझे|मला)/i.test(clean)) {
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
   * Normalizes multilingual speech into common meaning and verified ISL representation.
   *
   * @param {Object} params
   * @param {string} params.spokenText - User's original spoken words in native script
   * @param {string} [params.internalEnglish] - Internal English from translation service (quarantined)
   * @param {string} [params.detectedLang] - Language code ('ta', 'hi', 'te', etc.)
   * @returns {Object} Normalized meaning and animation payload
   */
  normalizeMeaning({ spokenText, internalEnglish = '', detectedLang = null }) {
    const rawNative = (spokenText || '').trim();
    const rawEnglish = (internalEnglish || '').trim();

    // Rule 8: Section 15 — If audio is unclear or inaudible, do not guess. Return honest retry prompt.
    const isExplicitlyUnclear = /\[(unclear|inaudible|unknown|\?)\]|\.\.\.\s*\[|\b(unclear|inaudible)\b/i.test(rawNative) ||
                                /\[(unclear|inaudible|unknown|\?)\]|\.\.\.\s*\[|\b(unclear|inaudible)\b/i.test(rawEnglish);

    if (isExplicitlyUnclear || (!rawNative && !rawEnglish)) {
      return {
        success: false,
        errorType: 'UNCLEAR_AUDIO',
        userMessage: "⚠️ I couldn't clearly understand that. Please repeat.",
        nativeText: rawNative,
        language: null
      };
    }

    const langCode = detectedLang || this.detectLanguage(rawNative);
    const langMeta = LANGUAGE_BY_CODE[langCode] || {
      code: langCode,
      name: langCode.toUpperCase(),
      flag: '🇮🇳',
      script: 'Regional'
    };

    // 1. Check Canonical Intent Normalization (Rule 4: Common meaning across languages)
    for (const intent of CANONICAL_INTENTS) {
      const matchNative = intent.nativePatterns.some(p => p.test(rawNative));
      const matchEnglish = intent.englishPatterns.some(p => p.test(rawEnglish));

      if (matchNative || matchEnglish) {
        const signItem = this._findVerifiedWord(intent.signWord);
        const sequence = signItem ? [signItem] : [];

        return {
          success: true,
          nativeText: rawNative || rawEnglish,
          detectedLanguage: langCode,
          languageName: langMeta.name,
          languageFlag: langMeta.flag,
          canonicalMeaning: intent.canonicalMeaning,
          primaryGloss: intent.primaryGloss,
          isFullyAvailable: sequence.length > 0,
          limitationMessage: sequence.length > 0 ? null : 'We understood your request, but an ISL representation is currently unavailable.',
          sequence: sequence,
          // Internal debugging only (Rule 3)
          _internalEnglish: rawEnglish
        };
      }
    }

    // 2. Direct Match via Authentic ISL Dictionary (2,501 authentic dataset sentences)
    if (this.signMatcher && this.signMatcher.isLoaded) {
      const textToMatch = rawEnglish || rawNative;
      const matched = this.signMatcher.match(textToMatch);

      if (matched && matched.sample) {
        const s = matched.sample;
        const bvhPath = s.bvh || `Train/${s.id}/${s.id}.bvh`;

        return {
          success: true,
          nativeText: rawNative || rawEnglish,
          detectedLanguage: langCode,
          languageName: langMeta.name,
          languageFlag: langMeta.flag,
          canonicalMeaning: s.sentence,
          primaryGloss: s.gloss || `SIGN #${s.id}`,
          isFullyAvailable: true,
          limitationMessage: null,
          sequence: [{
            type: 'BVH',
            id: String(s.id),
            path: bvhPath,
            word: s.sentence,
            phrase: s.sentence,
            gloss: s.gloss,
            sample: s
          }],
          _internalEnglish: rawEnglish
        };
      }
    }

    // 3. Fallback Concept Check (Rule 5 & Rule 17: NEVER fabricate unsupported ISL)
    // Check if parts of the phrase match known keywords in the authentic dictionary or SIGN_LIBRARY
    const queryTokens = (rawEnglish || rawNative)
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 1);

    const verifiedSequence = [];
    const missingTokens = [];

    for (const token of queryTokens) {
      // Skip non-semantic English fillers
      if (['the', 'a', 'an', 'is', 'are', 'am', 'to', 'for', 'of', 'and'].includes(token)) {
        continue;
      }

      const verified = this._findVerifiedWord(token);
      if (verified) {
        verifiedSequence.push(verified);
      } else {
        missingTokens.push(token);
      }
    }

    // If completely unsupported or missing concepts (Rule 5 & Rule 17)
    if (missingTokens.length > 0 && verifiedSequence.length === 0) {
      return {
        success: true,
        nativeText: rawNative || rawEnglish,
        detectedLanguage: langCode,
        languageName: langMeta.name,
        languageFlag: langMeta.flag,
        canonicalMeaning: 'Meaning understood, sign unavailable',
        primaryGloss: 'UNAVAILABLE',
        isFullyAvailable: false,
        limitationMessage: 'We understood your request, but an ISL representation for part of this phrase is currently unavailable.',
        sequence: [],
        missingTokens: missingTokens,
        _internalEnglish: rawEnglish
      };
    }

    // Partial coverage: return only verified portions with honest notification
    if (verifiedSequence.length > 0) {
      const hasMissing = missingTokens.length > 0;
      const firstSign = verifiedSequence[0];

      return {
        success: true,
        nativeText: rawNative || rawEnglish,
        detectedLanguage: langCode,
        languageName: langMeta.name,
        languageFlag: langMeta.flag,
        canonicalMeaning: rawNative || rawEnglish,
        primaryGloss: firstSign.gloss || 'ISL SIGN',
        isFullyAvailable: !hasMissing,
        limitationMessage: hasMissing 
          ? 'Some parts of this phrase are not currently available. Showing verified ISL signs.'
          : null,
        sequence: verifiedSequence,
        missingTokens: missingTokens,
        _internalEnglish: rawEnglish
      };
    }

    // Unrecognized intent
    return {
      success: false,
      errorType: 'UNSUPPORTED_OR_MISSING',
      userMessage: 'We understood your request, but an ISL representation for part of this phrase is currently unavailable.',
      nativeText: rawNative,
      language: langMeta
    };
  }

  _findVerifiedWord(word) {
    if (!word) return null;
    const clean = word.toLowerCase().trim();

    // Check SIGN_LIBRARY cache
    if (this._wordLookupCache.has(clean)) {
      const item = this._wordLookupCache.get(clean);
      return {
        type: item.animationType || 'word',
        id: item.id,
        word: item.word,
        label: item.word,
        gloss: item.gloss || item.word.toUpperCase(),
        sample: item
      };
    }

    // Check signMatcher wordIndex if loaded
    if (this.signMatcher && this.signMatcher.isLoaded && this.signMatcher.wordIndex[clean]) {
      const idxList = this.signMatcher.wordIndex[clean];
      if (idxList && idxList.length > 0) {
        // Find a sentence that is EXACTLY this word, don't return a multi-word sentence for a single word!
        const exactWordSign = idxList.map(idx => this.signMatcher.sentences[idx])
                                     .find(s => s.sentence.trim().toLowerCase() === clean);
        
        if (exactWordSign) {
          return {
            type: 'BVH',
            id: String(exactWordSign.id),
            path: exactWordSign.bvh || `Train/${exactWordSign.id}/${exactWordSign.id}.bvh`,
            word: exactWordSign.sentence,
            phrase: exactWordSign.sentence,
            gloss: exactWordSign.gloss,
            sample: exactWordSign
          };
        }
      }
    }

    return null;
  }
}

export const meaningNormalizer = new MeaningNormalizer();

if (typeof window !== 'undefined') {
  window.meaningNormalizer = meaningNormalizer;
}

export default meaningNormalizer;
