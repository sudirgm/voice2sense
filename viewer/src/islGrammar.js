// ============================================================
// Indian Sign Language (ISL) Grammar & Sentence Transformer
// Voice 2 Sense | SignBridge 3D
// Deterministic / Rule-based only — NO AI, NO LLM, NO backend
// ============================================================

/**
 * ISL Linguistic Principles implemented:
 * 1. Word Order: Topic-Comment / Subject-Object-Verb (SOV) rather than English SVO.
 * 2. Question Formation: WH-question words (WHAT, WHERE, WHO, WHEN, WHY, HOW) move to sentence END.
 * 3. Negation: Negation particles (NOT, NO, CANNOT, NEVER) move to sentence/verb END.
 * 4. Omission: Articles (a, an, the) and copula/auxiliary verbs (is, am, are, was, were) are omitted.
 * 5. Numbers & Quantifiers: Quantified nouns bind with numbers (e.g., "two books" -> "BOOK TWO").
 * 6. Proper Nouns & OOV: Names and unmapped lexical items are marked for deterministic fingerspelling.
 */

// Contraction expansion map
const CONTRACTIONS = {
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "can't": "cannot",
  "cannot": "cannot",
  "won't": "will not",
  "i'm": "i am",
  "you're": "you are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "we're": "we are",
  "they're": "they are",
  "what's": "what is",
  "where's": "where is",
  "who's": "who is",
  "that's": "that is",
  "there's": "there is",
  "let's": "let us",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "i will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "we'll": "we will",
  "they'll": "they will"
};

// Words to omit in ISL (syntactic glue / copula / articles / modals)
const OMIT_WORDS = new Set([
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'a', 'an', 'the',
  'to', 'of', 'for', 'at', 'by',
  'do', 'does', 'did',
  'would', 'should', 'could', 'shall', 'can', 'will', 'may', 'might', 'must',
  'just', 'very', 'that', 'this'
]);

// Number words to digits
const NUMBER_WORDS = {
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
};

// WH-question words
const WH_WORDS = new Set(['what', 'where', 'who', 'when', 'why', 'how', 'which']);

// Negation words
const NEGATION_WORDS = new Set(['not', 'no', 'never', 'cannot', 'none', 'neither']);

// Common pronoun normalizations
const PRONOUN_MAP = {
  'i': 'ME',
  'me': 'ME',
  'my': 'MY',
  'mine': 'MY',
  'myself': 'ME',
  'you': 'YOU',
  'your': 'YOUR',
  'yours': 'YOUR',
  'yourself': 'YOU',
  'he': 'HE',
  'him': 'HE',
  'his': 'HIS',
  'she': 'SHE',
  'her': 'SHE',
  'hers': 'HER',
  'it': 'IT',
  'its': 'IT',
  'we': 'WE',
  'us': 'WE',
  'our': 'OUR',
  'ours': 'OUR',
  'they': 'THEY',
  'them': 'THEY',
  'their': 'THEIR'
};

// Plural noun mapping to singular base form
const PLURAL_MAP = {
  'books': 'book',
  'pens': 'pen',
  'pencils': 'pencil',
  'apples': 'apple',
  'friends': 'friend',
  'days': 'day',
  'hours': 'hour',
  'months': 'month',
  'years': 'year',
  'students': 'student',
  'teachers': 'teacher',
  'cars': 'car',
  'bikes': 'bike',
  'bicycles': 'bicycle',
  'words': 'word',
  'signs': 'sign',
  'languages': 'language',
  'questions': 'question'
};

// Idioms and fixed multi-word sentence patterns (Authoritative ISL Mappings)
const IDIOMATIC_PATTERNS = [
  // Greetings & Courtesies
  {
    pattern: /^(?:hello|hi|hey)[,\s]+how\s+are\s+you[\s\?]*$/i,
    glosses: [
      { gloss: 'HELLO', label: 'Hello', type: 'gesture', signRef: 'HELLO' },
      { gloss: 'YOU', label: 'You', type: 'gesture', signRef: 'YOU' },
      { gloss: 'HOW?', label: 'How?', type: 'gesture', signRef: 'HOW' }
    ]
  },
  {
    pattern: /^(?:hello|hi|hey)[\s\!]*$/i,
    glosses: [
      { gloss: 'HELLO', label: 'Hello', type: 'gesture', signRef: 'HELLO' }
    ]
  },
  {
    pattern: /^how\s+are\s+you[\s\?]*$/i,
    glosses: [
      { gloss: 'YOU', label: 'You', type: 'gesture', signRef: 'YOU' },
      { gloss: 'HOW?', label: 'How?', type: 'gesture', signRef: 'HOW' }
    ]
  },
  {
    pattern: /^(?:what\s+is|what's)\s+your\s+name[\s\?]*$/i,
    glosses: [
      { gloss: 'YOUR', label: 'Your', type: 'gesture', signRef: 'YOUR' },
      { gloss: 'NAME', label: 'Name', type: 'gesture', signRef: 'NAME' },
      { gloss: 'WHAT?', label: 'What?', type: 'gesture', signRef: 'WHAT' }
    ]
  },
  {
    pattern: /^(?:my\s+name\s+is|i\s+am)\s+([a-zA-Z]+)[\s\.]*$/i,
    resolver: (match) => {
      const name = match[1].toUpperCase();
      const letters = name.split('');
      return [
        { gloss: 'MY', label: 'My', type: 'gesture', signRef: 'MY' },
        { gloss: 'NAME', label: 'Name', type: 'gesture', signRef: 'NAME' },
        {
          gloss: `FS-${name}`,
          label: match[1],
          type: 'fingerspell',
          letters: letters,
          isFingerspelled: true,
          hint: `Fingerspelling proper name: ${match[1]}`
        }
      ];
    }
  },
  {
    pattern: /^(?:his|her)\s+name\s+is\s+([a-zA-Z]+)[\s\.]*$/i,
    resolver: (match) => {
      const name = match[1].toUpperCase();
      const letters = name.split('');
      return [
        { gloss: 'NAME', label: 'Name', type: 'gesture', signRef: 'NAME' },
        {
          gloss: `FS-${name}`,
          label: match[1],
          type: 'fingerspell',
          letters: letters,
          isFingerspelled: true,
          hint: `Fingerspelling proper name: ${match[1]}`
        }
      ];
    }
  },
  {
    pattern: /^i\s+want\s+to\s+learn\s+sign\s+language[\s\.]*$/i,
    glosses: [
      { gloss: 'SIGN-LANGUAGE', label: 'Sign Language', type: 'gesture', signRef: 'SIGN' },
      { gloss: 'LEARN', label: 'Learn', type: 'gesture', signRef: 'LEARN' },
      { gloss: 'WANT', label: 'Want', type: 'gesture', signRef: 'WANT' },
      { gloss: 'ME', label: 'Me', type: 'gesture', signRef: 'ME' }
    ]
  },
  {
    pattern: /^learn\s+sign\s+language[\s\.]*$/i,
    glosses: [
      { gloss: 'SIGN-LANGUAGE', label: 'Sign Language', type: 'gesture', signRef: 'SIGN' },
      { gloss: 'LEARN', label: 'Learn', type: 'gesture', signRef: 'LEARN' }
    ]
  },
  {
    pattern: /^i\s+have\s+(zero|one|two|three|four|five|six|seven|eight|nine|\d)\s+([a-zA-Z]+)[\s\.]*$/i,
    resolver: (match) => {
      const numRaw = match[1].toLowerCase();
      const numDigit = NUMBER_WORDS[numRaw] || '2';
      const nounRaw = match[2].toLowerCase();
      const nounBase = PLURAL_MAP[nounRaw] || nounRaw;
      return [
        { gloss: nounBase.toUpperCase(), label: nounBase.toUpperCase(), type: 'gesture', signRef: nounBase.toUpperCase() },
        { gloss: `NUM-${numDigit}`, label: `Number ${numDigit}`, type: 'number', signRef: numDigit },
        { gloss: 'HAVE', label: 'Have', type: 'gesture', signRef: 'HAVE' },
        { gloss: 'ME', label: 'Me', type: 'gesture', signRef: 'ME' }
      ];
    }
  },
  {
    pattern: /^(?:can\s+i\s+stay\s+here\s+tonight)[\s\?]*$/i,
    glosses: [
      { gloss: 'STAY', label: 'Stay', type: 'gesture', signRef: 'STAY' },
      { gloss: 'HERE', label: 'Here', type: 'gesture', signRef: 'HERE' },
      { gloss: 'TONIGHT', label: 'Tonight', type: 'gesture', signRef: 'TONIGHT' },
      { gloss: 'ME?', label: 'Me?', type: 'gesture', signRef: 'ME' }
    ]
  },
  {
    pattern: /^(?:please\s+lock\s+the\s+safe)[\s\.]*$/i,
    glosses: [
      { gloss: 'SAFE', label: 'Safe', type: 'gesture', signRef: 'SAFE' },
      { gloss: 'LOCK', label: 'Lock', type: 'gesture', signRef: 'LOCK' },
      { gloss: 'PLEASE', label: 'Please', type: 'gesture', signRef: 'PLEASE' }
    ]
  },
  {
    pattern: /^(?:please\s+help\s+me|help\s+me\s+please)[\s\.]*$/i,
    glosses: [
      { gloss: 'ME', label: 'Me', type: 'gesture', signRef: 'ME' },
      { gloss: 'HELP', label: 'Help', type: 'gesture', signRef: 'HELP' },
      { gloss: 'PLEASE', label: 'Please', type: 'gesture', signRef: 'PLEASE' }
    ]
  },
  {
    pattern: /^i\s+do\s+not\s+understand[\s\.]*$/i,
    glosses: [
      { gloss: 'ME', label: 'Me', type: 'gesture', signRef: 'ME' },
      { gloss: 'UNDERSTAND', label: 'Understand', type: 'gesture', signRef: 'UNDERSTAND' },
      { gloss: 'NOT', label: 'Not', type: 'gesture', signRef: 'NOT' }
    ]
  },
  {
    pattern: /^(?:i\s+do\s+not\s+know|i\s+don't\s+know)[\s\.]*$/i,
    glosses: [
      { gloss: 'ME', label: 'Me', type: 'gesture', signRef: 'ME' },
      { gloss: 'KNOW', label: 'Know', type: 'gesture', signRef: 'KNOW' },
      { gloss: 'NOT', label: 'Not', type: 'gesture', signRef: 'NOT' }
    ]
  },
  {
    pattern: /^(?:thank\s+you|thanks)[\s\!]*$/i,
    glosses: [
      { gloss: 'THANK-YOU', label: 'Thank You', type: 'gesture', signRef: 'THANK_YOU' }
    ]
  },
  {
    pattern: /^good\s+morning[\s\!]*$/i,
    glosses: [
      { gloss: 'GOOD', label: 'Good', type: 'gesture', signRef: 'GOOD' },
      { gloss: 'MORNING', label: 'Morning', type: 'gesture', signRef: 'MORNING' }
    ]
  },
  {
    pattern: /^good\s+night[\s\!]*$/i,
    glosses: [
      { gloss: 'GOOD', label: 'Good', type: 'gesture', signRef: 'GOOD' },
      { gloss: 'NIGHT', label: 'Night', type: 'gesture', signRef: 'NIGHT' }
    ]
  },
  {
    pattern: /^nice\s+to\s+meet\s+you[\s\!]*$/i,
    glosses: [
      { gloss: 'MEET', label: 'Meet', type: 'gesture', signRef: 'MEET' },
      { gloss: 'YOU', label: 'You', type: 'gesture', signRef: 'YOU' },
      { gloss: 'NICE', label: 'Nice', type: 'gesture', signRef: 'NICE' }
    ]
  }
];

export class IslGrammar {
  /**
   * Normalize an input sentence string
   */
  static normalize(text) {
    if (!text || typeof text !== 'string') return '';
    let clean = text.trim();

    // Expand contractions
    const words = clean.split(/\s+/);
    const expanded = words.map(w => {
      const stripped = w.toLowerCase().replace(/[^\w']/g, '');
      return CONTRACTIONS[stripped] || w;
    }).join(' ');

    return expanded.replace(/\s+/g, ' ').trim();
  }

  /**
   * Determine sentence mood / type
   */
  static identifySentenceType(text) {
    const raw = (text || '').trim();
    if (raw.endsWith('?')) return 'QUESTION';

    const clean = this.normalize(raw).toLowerCase();
    const tokens = clean.split(/\s+/);

    if (tokens.some(t => WH_WORDS.has(t)) || /^(can|do|does|did|is|are|will|may)\b/.test(clean)) {
      return 'QUESTION';
    }
    if (tokens.some(t => NEGATION_WORDS.has(t))) {
      return 'NEGATION';
    }
    if (/^(please|kindly)\b/.test(clean)) {
      return 'REQUEST';
    }
    if (/^(hello|hi|hey|good\s+(morning|afternoon|night|evening))\b/.test(clean)) {
      return 'GREETING';
    }
    return 'STATEMENT';
  }

  /**
   * Main Translation Function: Converts English Sentence -> ISL Gloss Sequence
   * @param {string} inputSentence 
   * @returns {{ sentence: string, sentenceType: string, glossSequence: Array<Object> }}
   */
  static translate(inputSentence) {
    const original = (inputSentence || '').trim();
    if (!original) {
      return { sentence: '', sentenceType: 'STATEMENT', glossSequence: [] };
    }

    const normalized = this.normalize(original);
    const sentenceType = this.identifySentenceType(original);

    // 1. Check Idiomatic and Fixed Sentence Patterns first
    for (const item of IDIOMATIC_PATTERNS) {
      const match = normalized.match(item.pattern);
      if (match) {
        const glosses = item.resolver ? item.resolver(match) : item.glosses;
        return {
          sentence: original,
          sentenceType,
          glossSequence: glosses
        };
      }
    }

    // 2. Multi-word substitution: replace known compound phrases
    let processed = normalized;
    processed = processed.replace(/\bsign\s+language\b/gi, 'SIGN-LANGUAGE');
    processed = processed.replace(/\bthank\s+you\b/gi, 'THANK-YOU');
    processed = processed.replace(/\bhow\s+are\s+you\b/gi, 'HOW-ARE-YOU');

    // 3. Tokenize and extract lexical roles
    const rawTokens = processed.split(/\s+/);
    const subjects = [];
    const objects = [];
    const verbs = [];
    const whQuestions = [];
    const negations = [];
    const timeMarkers = [];
    const others = [];

    // Core verb dictionary for SOV sorting
    const KNOWN_VERBS = new Set([
      'want', 'learn', 'like', 'love', 'need', 'see', 'look', 'watch',
      'hear', 'listen', 'speak', 'talk', 'eat', 'drink', 'go', 'come',
      'stay', 'read', 'write', 'help', 'know', 'understand', 'think',
      'have', 'give', 'take', 'make', 'work', 'play', 'stop', 'wait',
      'meet', 'lock', 'open', 'close', 'call', 'buy', 'sell'
    ]);

    const TIME_WORDS = new Set([
      'yesterday', 'today', 'tomorrow', 'now', 'soon', 'later', 'always', 'morning', 'night'
    ]);

    for (let i = 0; i < rawTokens.length; i++) {
      const raw = rawTokens[i];
      const clean = raw.toLowerCase().replace(/[^\w\-]/g, '');
      if (!clean) continue;

      // Check number words or digits
      if (NUMBER_WORDS[clean]) {
        const digit = NUMBER_WORDS[clean];
        others.push({
          gloss: `NUM-${digit}`,
          label: `Number ${digit}`,
          type: 'number',
          signRef: digit
        });
        continue;
      }

      // Check WH question words
      if (WH_WORDS.has(clean)) {
        whQuestions.push({
          gloss: clean.toUpperCase() + '?',
          label: clean.toUpperCase() + '?',
          type: 'gesture',
          signRef: clean.toUpperCase()
        });
        continue;
      }

      // Check negation words
      if (NEGATION_WORDS.has(clean)) {
        negations.push({
          gloss: 'NOT',
          label: 'Not',
          type: 'gesture',
          signRef: 'NOT'
        });
        continue;
      }

      // Check time markers
      if (TIME_WORDS.has(clean)) {
        timeMarkers.push({
          gloss: clean.toUpperCase(),
          label: clean.toUpperCase(),
          type: 'gesture',
          signRef: clean.toUpperCase()
        });
        continue;
      }

      // Check omitted words
      if (OMIT_WORDS.has(clean)) {
        continue;
      }

      // Check pronouns
      if (PRONOUN_MAP[clean]) {
        const pGloss = PRONOUN_MAP[clean];
        subjects.push({
          gloss: pGloss,
          label: pGloss,
          type: 'gesture',
          signRef: pGloss
        });
        continue;
      }

      // Check known verbs
      if (KNOWN_VERBS.has(clean)) {
        verbs.push({
          gloss: clean.toUpperCase(),
          label: clean.toUpperCase(),
          type: 'gesture',
          signRef: clean.toUpperCase()
        });
        continue;
      }

      // Check nouns / objects (handle plurals)
      const baseNoun = PLURAL_MAP[clean] || clean;
      
      // Determine if proper noun / name (starts with capital in original or OOV)
      const isCapitalized = /^[A-Z][a-z]+$/.test(raw);
      if (isCapitalized && !KNOWN_VERBS.has(clean) && !OMIT_WORDS.has(clean)) {
        // Proper noun / name -> fingerspell
        const upper = clean.toUpperCase();
        objects.push({
          gloss: `FS-${upper}`,
          label: raw,
          type: 'fingerspell',
          letters: upper.split(''),
          isFingerspelled: true,
          hint: `Fingerspelling: ${raw}`
        });
      } else {
        objects.push({
          gloss: baseNoun.toUpperCase(),
          label: baseNoun.toUpperCase(),
          type: 'gesture',
          signRef: baseNoun.toUpperCase()
        });
      }
    }

    // 4. Assemble ISL Grammar Sequence:
    // [TIME MARKER] -> [SUBJECT] -> [OBJECT] -> [VERB] -> [NEGATION] -> [WH-QUESTION]
    const sequence = [
      ...timeMarkers,
      ...subjects,
      ...objects,
      ...verbs,
      ...negations,
      ...others,
      ...whQuestions
    ];

    // Fallback: If empty, preserve normalized words or fingerspell
    if (sequence.length === 0) {
      const fallbackWords = normalized.split(/\s+/).filter(Boolean);
      fallbackWords.forEach(w => {
        const upper = w.toUpperCase().replace(/[^\w]/g, '');
        if (upper) {
          sequence.push({
            gloss: upper,
            label: upper,
            type: 'gesture',
            signRef: upper
          });
        }
      });
    }

    return {
      sentence: original,
      sentenceType,
      glossSequence: sequence
    };
  }
}
