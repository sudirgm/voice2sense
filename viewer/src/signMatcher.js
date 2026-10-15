// Sign Language NLP & Motion Matcher for SIH Accessibility Project

export class SignMatcher {
  constructor() {
    this.sentences = [];
    this.wordIndex = {};
    this.exactSentenceMap = new Map();
    this.exactGlossMap = new Map();
    this.isLoaded = false;
  }

  async init() {
    try {
      let res;
      try {
        res = await fetch('/dictionary.json');
        if (!res.ok) throw new Error(`Status ${res.status}`);
      } catch {
        res = await fetch('/archive-data/viewer/dictionary.json');
      }
      const data = await res.json();
      this.sentences = data.sentences || [];
      this.wordIndex = data.wordIndex || {};

      // Precompute normalized representations for O(1) exact sentence, gloss & ID matching
      this.exactSentenceMap = new Map();
      this.exactGlossMap = new Map();
      this.exactIdMap = new Map();

      for (let i = 0; i < this.sentences.length; i++) {
        const s = this.sentences[i];
        if (!s.bvh) {
          s.bvh = `Train/${s.id}/${s.id}.bvh`;
        }
        const strId = String(s.id).trim();
        this.exactIdMap.set(strId, s);

        const normSent = this.normalizeText(s.sentence);
        const normGloss = this.normalizeText(s.gloss);
        const normNoApos = s.sentence.toLowerCase().replace(/['’]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

        if (normSent && !this.exactSentenceMap.has(normSent)) {
          this.exactSentenceMap.set(normSent, s);
        }
        if (normNoApos && !this.exactSentenceMap.has(normNoApos)) {
          this.exactSentenceMap.set(normNoApos, s);
        }
        if (normGloss && !this.exactGlossMap.has(normGloss)) {
          this.exactGlossMap.set(normGloss, s);
        }
      }

      this.isLoaded = true;
      console.log(`[SignMatcher] Loaded ${this.sentences.length} signs with ${Object.keys(this.wordIndex).length} keywords.`);
      return true;
    } catch (err) {
      console.error('[SignMatcher] Failed to load dictionary:', err);
      return false;
    }
  }

  // Authoritative text normalization: lowercase, trim, smart quotes, punctuation stripping
  normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/[\u2018\u2019]/g, "'") // Standardize curly single quotes
      .replace(/[\u201C\u201D]/g, '"') // Standardize curly double quotes
      .replace(/[^\w\s]/g, ' ')        // Strip punctuation & special characters
      .replace(/\s+/g, ' ')            // Collapse multiple spaces into one
      .trim();
  }

  // Tokenize normalized text into clean non-empty words
  tokenize(text) {
    const norm = this.normalizeText(text);
    if (!norm) return [];
    return norm.split(' ').filter((w) => w.length > 0);
  }

  // Find best matching sign animation from speech text with diagnostic logging
  match(text) {
    if (!this.isLoaded || !text || text.trim() === '') return null;

    const raw = text.trim();
    console.log('🔍 SEARCHING FOR SIGN:', raw);
    const cleanNorm = this.normalizeText(raw);
    const cleanNoApos = raw.toLowerCase().replace(/['’]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryTokens = this.tokenize(raw);
    if (queryTokens.length === 0) return null;

    // 1. Direct exact sentence or gloss match (via precomputed normalized map)
    let exactMatch = this.exactSentenceMap.get(cleanNorm) ||
                     this.exactSentenceMap.get(cleanNoApos) ||
                     this.exactGlossMap.get(cleanNorm) ||
                     this.exactGlossMap.get(cleanNoApos);

    // Fallback scan for direct case-insensitive exact string match
    if (!exactMatch) {
      const rawLower = raw.toLowerCase();
      for (let i = 0; i < this.sentences.length; i++) {
        const s = this.sentences[i];
        if (s.sentence.toLowerCase() === rawLower || s.gloss.toLowerCase() === rawLower) {
          exactMatch = s;
          break;
        }
      }
    }

    if (exactMatch) {
      const resolvedBvhPath = exactMatch.bvh || `Train/${exactMatch.id}/${exactMatch.id}.bvh`;
      console.log(`[SignMatcher] Exact sentence match: "${raw}" -> ID: ${exactMatch.id}, BVH: "${resolvedBvhPath}"`);
      const matchedEntry = {
        matchType: 'exact_sentence',
        score: 1.0,
        sample: exactMatch,
        resolvedBvhPath
      };
      console.log('✅ MATCHED ENTRY:', matchedEntry);
      console.log('🎬 BVH PATH:', matchedEntry.resolvedBvhPath);
      return matchedEntry;
    }

    // Exact match failed: execute diagnostic check on query words against dictionary.json
    this._logExactMatchFailure(raw, cleanNorm, queryTokens);

    // 3. If it's a single word and no exact match exists, FORCE FINGERSPELLING
    // This prevents the app from playing a random sentence that just happens to contain the word.
    if (queryTokens.length === 1) {
      console.log(`[SignMatcher] ⚠️ No exact match for single word "${cleanNorm}". Falling back to fingerspelling.`);
      return {
        matchType: 'fingerspell',
        score: 0.8,
        textToSpell: cleanNorm,
        resolvedBvhPath: null // The fingerspell.js engine will handle this
      };
    }

    // 4. Multi-word fallback: Only use wordIndex "contains" match for phrases
    if (this.wordIndex[cleanNorm] && this.wordIndex[cleanNorm].length > 0) {
      const bestMatch = this.sentences[this.wordIndex[cleanNorm][0]];
      const resolvedBvhPath = bestMatch.bvh || `Train/${bestMatch.id}/${bestMatch.id}.bvh`;
      console.log(`[SignMatcher] 🔍 Partial phrase match (fallback): "${cleanNorm}" -> ID: ${bestMatch.id}, BVH: "${resolvedBvhPath}"`);
      const matchedEntry = {
        matchType: 'partial_phrase',
        score: 0.5,
        sample: bestMatch,
        resolvedBvhPath
      };
      console.log('✅ MATCHED ENTRY:', matchedEntry);
      console.log('🎬 BVH PATH:', matchedEntry.resolvedBvhPath);
      return matchedEntry;
    }

    // 3. Keyword frequency scoring
    const candidateScores = new Map();

    for (const token of queryTokens) {
      const matches = this.wordIndex[token];
      if (matches) {
        for (const idx of matches) {
          const currentScore = candidateScores.get(idx) || 0;
          candidateScores.set(idx, currentScore + 1);
        }
      }
    }

    if (candidateScores.size === 0) {
      // === DEBUG: Check what we're searching for ===
      console.log('=== SIGN MATCHER DEBUG ===');
      console.log('Input text:', text);
      console.log('Normalized:', cleanNorm);
      console.log('Query tokens:', queryTokens);
      console.log('Token count:', queryTokens.length);

      // Check if "you" exists in dictionary
      const youCheck = this.wordIndex['you'];
      console.log('wordIndex has "you":', !!youCheck);
      if (youCheck) {
        console.log('First "you" entry ID:', this.sentences[youCheck[0]].id);
        console.log('First "you" sentence:', this.sentences[youCheck[0]].sentence);
      }

      // Check for exact match
      const exactMatch = this.sentences.find(s => 
        this.normalizeText(s.sentence) === cleanNorm || 
        this.normalizeText(s.gloss) === cleanNorm
      );
      console.log('Exact match exists:', !!exactMatch);
      if (exactMatch) {
        console.log('Exact match ID:', exactMatch.id);
        console.log('Exact match gloss:', exactMatch.gloss);
      }

      // === FALLBACK: Force fingerspelling for single short words ===
      if (queryTokens.length === 1 && cleanNorm.length <= 10 && cleanNorm.length >= 1) {
        console.log('⚠️ TRIGGERING FINGERSPELLING FALLBACK for:', cleanNorm);
        return {
          matchType: 'fingerspell',
          score: 0.8,
          textToSpell: cleanNorm,
          resolvedBvhPath: null
        };
      }

      console.log('❌ Returning null - no match found');
      return null;
    }

    // Find highest score candidate
    let bestIdx = -1;
    let maxScore = -1;
    for (const [idx, score] of candidateScores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        bestIdx = idx;
      }
    }

    const matchedSample = this.sentences[bestIdx];
    const resolvedBvhPath = matchedSample.bvh || `Train/${matchedSample.id}/${matchedSample.id}.bvh`;
    const finalScore = maxScore / queryTokens.length;

    // Prevent low-confidence matches from returning completely wrong sentences
    if (finalScore < 0.5) {
      console.warn(`[SignMatcher] Keyword match score too low (${finalScore.toFixed(2)}). Fallback disabled to prevent inaccurate signs.`);
      
      // === DEBUG: Check what we're searching for ===
      console.log('=== SIGN MATCHER DEBUG ===');
      console.log('Input text:', text);
      console.log('Normalized:', cleanNorm);
      console.log('Query tokens:', queryTokens);
      console.log('Token count:', queryTokens.length);

      // Check if "you" exists in dictionary
      const youCheck = this.wordIndex['you'];
      console.log('wordIndex has "you":', !!youCheck);
      if (youCheck) {
        console.log('First "you" entry ID:', this.sentences[youCheck[0]].id);
        console.log('First "you" sentence:', this.sentences[youCheck[0]].sentence);
      }

      // Check for exact match
      const exactMatch = this.sentences.find(s => 
        this.normalizeText(s.sentence) === cleanNorm || 
        this.normalizeText(s.gloss) === cleanNorm
      );
      console.log('Exact match exists:', !!exactMatch);
      if (exactMatch) {
        console.log('Exact match ID:', exactMatch.id);
        console.log('Exact match gloss:', exactMatch.gloss);
      }

      // === FALLBACK: Force fingerspelling for single short words ===
      if (queryTokens.length === 1 && cleanNorm.length <= 10 && cleanNorm.length >= 1) {
        console.log('⚠️ TRIGGERING FINGERSPELLING FALLBACK for:', cleanNorm);
        return {
          matchType: 'fingerspell',
          score: 0.8,
          textToSpell: cleanNorm,
          resolvedBvhPath: null
        };
      }

      console.log('❌ Returning null - no match found');
      return null;
    }

    console.log(`[SignMatcher] Keyword fallback matched: "${raw}" -> ID: ${matchedSample.id} ("${matchedSample.sentence}"), score: ${finalScore.toFixed(2)}, BVH: "${resolvedBvhPath}"`);

    const matchedEntry = {
      matchType: 'keyword',
      score: finalScore,
      sample: matchedSample,
      resolvedBvhPath
    };
    console.log('✅ MATCHED ENTRY:', matchedEntry);
    console.log('🎬 BVH PATH:', matchedEntry.resolvedBvhPath);
    return matchedEntry;
  }

  // Diagnostic logger for troubleshooting query misses
  _logExactMatchFailure(raw, cleanNorm, queryTokens) {
    console.groupCollapsed(`[SignMatcher Diagnostic] Exact Match Miss for: "${raw}"`);
    console.log(`Normalized Query : "${cleanNorm}"`);
    console.log(`Tokens Analyzed  : [${queryTokens.join(', ')}]`);
    console.log(`Word Presence in dictionary.json:`);
    queryTokens.forEach(token => {
      const inIndex = Boolean(this.wordIndex[token] && this.wordIndex[token].length > 0);
      const count = inIndex ? this.wordIndex[token].length : 0;
      console.log(`  - "${token}": ${inIndex ? `FOUND (${count} occurrences in dictionary)` : 'NOT in dictionary.json'}`);
    });
    console.log(`Dictionary Status: ${this.sentences.length} sentences indexed.`);
    console.groupEnd();
  }

  // Diagnostic tool to inspect query matches and asset resolution
  diagnoseMatch(text) {
    if (!text) return { error: 'Empty text query' };
    const raw = text.trim();
    const normalized = this.normalizeText(raw);
    const tokens = this.tokenize(raw);

    const tokenDiagnostics = tokens.map(token => ({
      token,
      inDictionary: Boolean(this.wordIndex[token] && this.wordIndex[token].length > 0),
      sentenceCount: this.wordIndex[token] ? this.wordIndex[token].length : 0
    }));

    const result = this.match(text);

    return {
      rawInput: raw,
      normalizedInput: normalized,
      tokens,
      tokenDiagnostics,
      matched: Boolean(result),
      matchType: result?.matchType || 'none',
      score: result?.score || 0,
      matchedSentence: result?.sample?.sentence || null,
      matchedGloss: result?.sample?.gloss || null,
      sampleId: result?.sample?.id || null,
      resolvedBvhPath: result?.resolvedBvhPath || null
    };
  }

  // Match educational concepts to existing ISL sign assets
  matchConceptToSign(term, contextKeywords = []) {
    if (!this.isLoaded || !this.sentences || this.sentences.length === 0) return null;
    if (!term || term.trim() === '') return null;

    const clean = term.trim();
    const cleanNorm = this.normalizeText(clean);
    const queryTokens = this.tokenize(clean);

    // 1. Direct exact sentence or gloss match
    const exactMatch = this.exactSentenceMap.get(cleanNorm) || this.exactGlossMap.get(cleanNorm);
    if (exactMatch) {
      return {
        type: 'phrase',
        label: term,
        gloss: exactMatch.gloss,
        sample: exactMatch
      };
    }

    // 2. Direct exact word match via wordIndex
    if (this.wordIndex[clean] && this.wordIndex[clean].length > 0) {
      const s = this.sentences[this.wordIndex[clean][0]];
      return {
        type: 'word',
        label: term,
        gloss: s.gloss,
        sample: s
      };
    }

    // 3. Technical educational mapping table for curriculum concepts
    const CONCEPT_SYNONYMS = {
      'array': ['order', 'number', 'line', 'table', 'first'],
      'arrays': ['order', 'number', 'line', 'table', 'first'],
      'static array': ['order', 'table', 'number'],
      'dynamic array': ['order', 'table', 'number'],
      'index': ['point', 'number', 'first', 'order'],
      'indexing': ['point', 'number', 'first', 'order'],
      'traversal': ['walk', 'step', 'read', 'start', 'order'],
      'operation': ['work', 'system', 'order', 'part'],
      'operations': ['work', 'system', 'order', 'part'],
      'data structure': ['system', 'program', 'teach', 'lesson'],
      'data structures': ['system', 'program', 'teach', 'lesson'],
      'dsa': ['program', 'system', 'lesson'],
      'linked list': ['line', 'point', 'order'],
      'singly linked': ['line', 'point', 'order'],
      'doubly linked': ['line', 'point', 'order'],
      'pointer': ['point', 'number'],
      'pointers': ['point', 'number'],
      'node': ['point', 'number'],
      'tree': ['tree', 'trees', 'point'],
      'trees': ['trees', 'tree', 'point'],
      'binary tree': ['tree', 'trees', 'point'],
      'bst': ['tree', 'trees', 'point'],
      'graph': ['point', 'system', 'line'],
      'graphs': ['point', 'system', 'line'],
      'sorting': ['order', 'number', 'fastest'],
      'sort': ['order', 'number', 'fastest'],
      'database': ['table', 'system', 'write'],
      'dbms': ['table', 'system', 'write'],
      'rdbms': ['table', 'system', 'write'],
      'sql': ['table', 'write', 'system'],
      'er model': ['table', 'system', 'point'],
      'normalization': ['order', 'system', 'clean'],
      'transaction': ['system', 'order', 'problem'],
      'acid': ['system', 'problem'],
      'operating system': ['system', 'computer', 'work'],
      'operating systems': ['system', 'computer', 'work'],
      'os': ['system', 'computer', 'work'],
      'process': ['work', 'system', 'program'],
      'processes': ['work', 'system', 'program'],
      'thread': ['work', 'system', 'line'],
      'threads': ['work', 'system', 'line'],
      'cpu': ['computer', 'fastest', 'system'],
      'scheduling': ['order', 'appointment', 'time'],
      'memory': ['remember', 'system', 'mind'],
      'paging': ['book', 'read', 'number'],
      'deadlock': ['problem', 'lock', 'stop'],
      'network': ['computer', 'system', 'line'],
      'networks': ['computer', 'system', 'line'],
      'computer network': ['computer', 'system', 'line'],
      'computer networks': ['computer', 'system', 'line'],
      'osi': ['system', 'order', 'line'],
      'tcp/ip': ['system', 'computer', 'line'],
      'ip': ['number', 'computer', 'line'],
      'subnetting': ['number', 'order', 'part'],
      'routing': ['line', 'walk', 'travel'],
      'protocol': ['rule', 'order', 'system'],
      'introduction': ['lesson', 'teach', 'first', 'start'],
      'intro': ['lesson', 'teach', 'first', 'start'],
      'basics': ['first', 'start', 'know'],
      'overview': ['look', 'show', 'all']
    };

    const syns = CONCEPT_SYNONYMS[clean] || [];
    for (const syn of syns) {
      const matchIndices = this.wordIndex[syn];
      if (matchIndices && matchIndices.length > 0) {
        const s = this.sentences[matchIndices[0]];
        return {
          type: 'word',
          label: term,
          gloss: s.gloss,
          sample: s
        };
      }
    }

    // 4. Token scoring using wordIndex
    const candidateScores = new Map();
    for (const token of queryTokens) {
      const matches = this.wordIndex[token];
      if (matches) {
        for (const idx of matches) candidateScores.set(idx, (candidateScores.get(idx) || 0) + 2);
      }
      const tokenSyns = CONCEPT_SYNONYMS[token] || [];
      for (const syn of tokenSyns) {
        const synMatches = this.wordIndex[syn];
        if (synMatches) {
          for (const idx of synMatches) candidateScores.set(idx, (candidateScores.get(idx) || 0) + 1.5);
        }
      }
    }

    // 5. Context keywords fallback
    if (Array.isArray(contextKeywords)) {
      for (const kw of contextKeywords) {
        const kwTokens = this.tokenize(kw);
        for (const kt of kwTokens) {
          const km = this.wordIndex[kt];
          if (km) {
            for (const idx of km) candidateScores.set(idx, (candidateScores.get(idx) || 0) + 1);
          }
          const ktSyns = CONCEPT_SYNONYMS[kt] || [];
          for (const syn of ktSyns) {
            const synMatches = this.wordIndex[syn];
            if (synMatches) {
              for (const idx of synMatches) candidateScores.set(idx, (candidateScores.get(idx) || 0) + 0.8);
            }
          }
        }
      }
    }

    if (candidateScores.size > 0) {
      let bestIdx = -1;
      let maxScore = -1;
      for (const [idx, score] of candidateScores.entries()) {
        if (score > maxScore) {
          maxScore = score;
          bestIdx = idx;
        }
      }
      if (bestIdx !== -1) {
        const s = this.sentences[bestIdx];
        return {
          type: 'word',
          label: term,
          gloss: s.gloss,
          sample: s
        };
      }
    }

    // 6. Whole-word check in sentences
    for (const token of queryTokens) {
      if (token.length >= 3) {
        const wordRegex = new RegExp(`\\b${token}\\b`, 'i');
        for (let i = 0; i < this.sentences.length; i++) {
          const s = this.sentences[i];
          if (wordRegex.test(s.sentence) || wordRegex.test(s.gloss)) {
            return {
              type: 'word',
              label: term,
              gloss: s.gloss,
              sample: s
            };
          }
        }
      }
    }

    return null;
  }

  // Continuous Word-by-Word & Fingerspelling Sequence Translator
  translateSequence(text) {
    if (!this.isLoaded || !text || text.trim() === '') return [];
    return this.parseAndMatchSequence(text);
  }

  /**
   * Feature 6: ISL Gloss Parser & Dictionary Matcher with Procedural Fingerspelling Fallback
   * 1. Normalize string: lowercase, remove punctuation (.,?!).
   * 2. Remove non-semantic English filler tokens (is, am, are, the, a, an).
   * 3. Reorder syntax if interrogative is present (e.g., "what is your name" -> ["your", "name", "what"]).
   * 4. Match tokens against viewer/dictionary.json:
   *    - If token matches a dictionary phrase/word: Return { type: 'BVH', id: matchedId, path: 'Train/' + matchedId + '/' + matchedId + '.bvh' }
   *    - If token is NOT in dictionary (e.g., "Rahul"): Split into characters and return { type: 'FINGERSPELL', word: 'RAHUL', chars: ['R', 'A', 'H', 'U', 'L'] }
   * @param {string} rawText
   * @returns {Array<Object>}
   */
  parseAndMatchSequence(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return [];
    }

    const raw = rawText.trim();
    const cleanNorm = this.normalizeText(raw);
    const cleanNoApos = raw.toLowerCase().replace(/['’]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanId = raw.replace(/^#/, '').trim();

    // 1. DIRECT EXACT SENTENCE, GLOSS, OR ID MATCH (HIGHEST PRIORITY)
    const exactMatch = this.exactSentenceMap.get(cleanNorm) ||
                       this.exactSentenceMap.get(cleanNoApos) ||
                       this.exactGlossMap.get(cleanNorm) ||
                       this.exactGlossMap.get(cleanNoApos) ||
                       (this.exactIdMap && this.exactIdMap.get(cleanId));

    if (exactMatch) {
      const matchedId = String(exactMatch.id);
      const bvhPath = exactMatch.bvh || `Train/${matchedId}/${matchedId}.bvh`;
      return [{
        type: 'BVH',
        id: matchedId,
        path: bvhPath,
        word: exactMatch.sentence,
        phrase: exactMatch.sentence,
        gloss: exactMatch.gloss,
        sample: exactMatch
      }];
    }

    // 2. CHECK IF INPUT CONTAINS OR OVERLAPS A KNOWN DICTIONARY SENTENCE
    for (let i = 0; i < this.sentences.length; i++) {
      const s = this.sentences[i];
      const sNorm = this.normalizeText(s.sentence);
      if (sNorm && sNorm.length >= 6) {
        if (cleanNorm === sNorm || cleanNorm.startsWith(sNorm) || sNorm.startsWith(cleanNorm)) {
          const overlap = Math.min(sNorm.length, cleanNorm.length) / Math.max(sNorm.length, cleanNorm.length);
          if (overlap >= 0.75) {
            const matchedId = String(s.id);
            const bvhPath = s.bvh || `Train/${matchedId}/${matchedId}.bvh`;
            return [{
              type: 'BVH',
              id: matchedId,
              path: bvhPath,
              word: s.sentence,
              phrase: s.sentence,
              gloss: s.gloss,
              sample: s
            }];
          }
        }
      }
    }

    // 3. FALLBACK FOR UNKNOWN / INDIVIDUAL WORDS & FINGERSPELLING
    const FILLER_TOKENS = new Set(['is', 'am', 'are', 'the', 'a', 'an']);
    let tokens = cleanNorm
      .split(' ')
      .map(t => t.trim())
      .filter(t => t.length > 0 && !FILLER_TOKENS.has(t));

    if (tokens.length === 0) return [];

    // Reorder syntax if interrogative is present (e.g., "what is your name" -> ["your", "name", "what"])
    const INTERROGATIVES = new Set(['what', 'where', 'when', 'why', 'who', 'which', 'how']);
    const hasInterrogative = tokens.some(t => INTERROGATIVES.has(t));
    if (hasInterrogative && tokens.length > 1) {
      const nonInterrogatives = tokens.filter(t => !INTERROGATIVES.has(t));
      const interrogatives = tokens.filter(t => INTERROGATIVES.has(t));
      if (nonInterrogatives.length > 0) {
        tokens = [...nonInterrogatives, ...interrogatives];
      }
    }

    const parsedSequence = [];
    for (const token of tokens) {
      const exactSample = this._lookupExactWordToken(token);

      if (exactSample) {
        const matchedId = String(exactSample.id);
        const path = exactSample.bvh || `Train/${matchedId}/${matchedId}.bvh`;
        parsedSequence.push({
          type: 'BVH',
          id: matchedId,
          path: path,
          word: token,
          phrase: exactSample.sentence,
          gloss: exactSample.gloss,
          sample: exactSample
        });
      } else {
        // Out of vocabulary word -> Fingerspelling fallback
        const wordUpper = token.toUpperCase();
        const chars = wordUpper.split('').filter(c => /[A-Z0-9]/.test(c));
        parsedSequence.push({
          type: 'FINGERSPELL',
          word: wordUpper,
          chars: chars.length > 0 ? chars : wordUpper.split('')
        });
      }
    }

    return parsedSequence;
  }

  _lookupExactWordToken(token) {
    if (!token) return null;
    const clean = token.toLowerCase().trim();

    // Check if token matches an exact isolated single-word or short entry in dictionary
    if (this.exactSentenceMap && this.exactSentenceMap.has(clean)) {
      const s = this.exactSentenceMap.get(clean);
      const sWords = s.sentence.trim().split(/\s+/);
      if (sWords.length <= 2) return s;
    }
    if (this.exactGlossMap && this.exactGlossMap.has(clean)) {
      const s = this.exactGlossMap.get(clean);
      const gWords = s.gloss.replace(/\/\//g, '').trim().split(/\s+/);
      if (gWords.length <= 2) return s;
    }

    return null;
  }

  processInputToISL(rawText) {
    return this.parseAndMatchSequence(rawText);
  }
}

export const signMatcher = new SignMatcher();

if (typeof window !== 'undefined') {
  window.signMatcher = signMatcher;
}

export default signMatcher;
