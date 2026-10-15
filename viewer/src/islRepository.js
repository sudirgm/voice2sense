// ============================================================
// ISL Knowledge Repository
// Voice 2 Sense | SignBridge 3D
// Foundation for 2,501 Predefined ISL Signs & Sentences
// Deterministic / Rule-based — Preserves authentic dataset completely
// ============================================================

import { SIGN_LIBRARY } from './learningEngine.js';
import { recommendationEngine, RECOMMENDATION_STATES } from './recommendationEngine.js';

/**
 * Categorizes a sentence deterministically based on vocabulary and syntax.
 * @param {string} sentence 
 * @param {string} gloss 
 * @returns {string} Category key
 */
function classifySentenceCategory(sentence, gloss) {
  const text = (sentence + ' ' + gloss).toLowerCase();

  if (text.includes('?') || /\b(who|what|where|when|why|how|which)\b/.test(text)) {
    return 'questions';
  }
  if (/\b(hello|hi|welcome|please|thank|thanks|sorry|apologize|excuse|pardon|bye|good morning|congratulations)\b/.test(text)) {
    return 'greetings_social';
  }
  if (/\b(father|mother|son|daughter|child|children|parents|brother|sister|wife|husband|friend|friends|family|baby|kid)\b/.test(text)) {
    return 'family_people';
  }
  if (/\b(work|job|boss|company|office|school|university|teacher|student|study|exam|lesson|book|read|library|salary|math|science|class)\b/.test(text)) {
    return 'education_work';
  }
  if (/\b(go|walk|travel|trip|car|bus|train|station|airport|flight|city|town|paris|america|poland|russia|tokyo|hotel|road|street|place)\b/.test(text)) {
    return 'travel_places';
  }
  if (/\b(happy|sad|sadness|cry|smile|pain|hurt|sick|doctor|hospital|medicine|fever|cold|headache|toothache|tired|love|angry|fear|scary|afraid|healthy)\b/.test(text)) {
    return 'feelings_health';
  }
  if (/\b(home|house|room|door|bed|eat|eating|ate|food|breakfast|lunch|dinner|drink|coffee|tea|water|cook|kitchen|sleep|wake|morning|night|clock|time)\b/.test(text)) {
    return 'daily_life';
  }

  return 'general_expression';
}

/**
 * Assigns proficiency level deterministically from sentence token complexity.
 * - <= 4 words: 'beginner' (foundational sign sequences)
 * - 5 to 8 words: 'intermediate' (everyday communicative sentences)
 * - > 8 words: 'advanced' (complex discourse & compound expressions)
 * @param {string} sentence 
 * @returns {'beginner' | 'intermediate' | 'advanced'}
 */
function classifyProficiencyLevel(sentence) {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 4) return 'beginner';
  if (words.length <= 8) return 'intermediate';
  return 'advanced';
}

export const REPOSITORY_CATEGORIES = {
  greetings_social: { id: 'greetings_social', label: 'Greetings & Social', icon: '👋', description: 'Polite greetings, apologies, and social etiquette' },
  daily_life: { id: 'daily_life', label: 'Daily Life & Home', icon: '🏠', description: 'Home routine, food, beverages, and daily activities' },
  questions: { id: 'questions', label: 'Questions & Inquiries', icon: '❓', description: 'Direct question forms and conversational inquiries' },
  family_people: { id: 'family_people', label: 'Family & People', icon: '👨‍👩‍👧', description: 'Kinship terms, friends, and interpersonal relationships' },
  education_work: { id: 'education_work', label: 'Work & Education', icon: '💼', description: 'Academic topics, professional communication, and careers' },
  travel_places: { id: 'travel_places', label: 'Travel & Locations', icon: '✈️', description: 'Directions, transport, cities, and landmarks' },
  feelings_health: { id: 'feelings_health', label: 'Emotions & Health', icon: '🩺', description: 'Feelings, physical sensations, wellness, and medical care' },
  general_expression: { id: 'general_expression', label: 'Everyday Expressions', icon: '💬', description: 'Contextual statements and conversational dialogue' }
};

export class ISLKnowledgeRepository {
  constructor() {
    this.rawSentences = [];
    this.items = [];
    this.itemsById = new Map();
    this.isLoaded = false;
    this.loadPromise = null;
  }

  /**
   * Initializes and indexes the authentic 2,501 predefined ISL signs/sentences.
   * Single source of truth.
   */
  async init() {
    if (this.isLoaded) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        let res;
        try {
          res = await fetch('/dictionary.json');
          if (!res.ok) throw new Error(`Status ${res.status}`);
        } catch {
          res = await fetch('/archive-data/viewer/dictionary.json');
        }
        const data = await res.json();
        this.rawSentences = Array.isArray(data.sentences) ? data.sentences : [];

        this.buildRepositoryIndex();
        this.isLoaded = true;
        console.log(`[ISLKnowledgeRepository] Initialized repository with ${this.items.length} authentic ISL dataset sentences.`);
        return true;
      } catch (err) {
        console.error('[ISLKnowledgeRepository] Failed to load dataset dictionary:', err);
        this.buildFallbackIndex();
        this.isLoaded = true;
        return false;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Builds the indexed learning repository:
   * Exactly 2,501 Predefined ISL Sentences (Beginner: 592, Intermediate: 1,366, Advanced: 543)
   * Single Source of Truth — 100% authentic dataset without artificial duplicates.
   */
  buildRepositoryIndex() {
    this.items = [];
    this.itemsById.clear();

    for (const raw of this.rawSentences) {
      const category = classifySentenceCategory(raw.sentence, raw.gloss);
      const proficiencyLevel = classifyProficiencyLevel(raw.sentence);

      const item = {
        id: String(raw.id),
        word: raw.sentence,
        sentence: raw.sentence,
        gloss: raw.gloss,
        bvh: raw.bvh,
        animationType: 'bvh',
        signRef: raw.bvh,
        imageRef: null,
        instruction: `Demonstrates authentic Indian Sign Language for: "${raw.sentence}"`,
        hint: `ISL Gloss sequence: ${raw.gloss}`,
        category: category,
        proficiencyLevel: proficiencyLevel,
        isPredefinedDataset: true,
        source: 'predefined_2501'
      };

      this.items.push(item);
      this.itemsById.set(item.id, item);
    }
  }

  buildFallbackIndex() {
    this.items = [];
    this.itemsById.clear();
    for (const sign of SIGN_LIBRARY) {
      const item = {
        id: sign.id,
        word: sign.word,
        sentence: sign.word,
        gloss: sign.gloss,
        bvh: sign.bvh || null,
        animationType: sign.animationType || 'letter',
        signRef: sign.signRef || sign.word,
        imageRef: sign.imageRef || null,
        instruction: sign.instruction || '',
        hint: sign.hint || '',
        category: sign.category || 'general_expression',
        proficiencyLevel: sign.difficulty === 1 ? 'beginner' : sign.difficulty === 2 ? 'intermediate' : 'advanced',
        isPredefinedDataset: false,
        source: 'fallback_library'
      };
      this.items.push(item);
      this.itemsById.set(item.id, item);
    }
  }

  /**
   * Enriches an item with dynamic state from LearnerProfile.
   * Connects repository status to persistent learner analytics:
   * - Learned
   * - In Progress
   * - Not Started
   * - Needs Review
   * - Mastered
   *
   * Transparently attributes recommendations across 4 distinct pedagogical rationales:
   * - Weak Performance
   * - Revision
   * - New Learning
   * - Next-Level Preparation
   *
   * @param {Object} item 
   * @param {Object} profileData 
   */
  enrichItemWithState(item, profileData) {
    const stat = (profileData && profileData.itemMastery && profileData.itemMastery[item.id]) || {
      status: 'new',
      attempts: 0,
      correct: 0,
      accuracy: 0,
      consecutiveCorrect: 0,
      consecutiveFailures: 0,
      lastPracticed: null
    };

    const isMastered = stat.status === 'mastered';
    const isNeedsReview = stat.status === 'needs_review' || (stat.attempts >= 1 && stat.accuracy < 60) || (stat.consecutiveFailures || 0) >= 1;
    const isReviewQueue = !!(profileData && Array.isArray(profileData.reviewQueue) && profileData.reviewQueue.includes(item.id));
    const isGap = isNeedsReview || isReviewQueue;

    // Status mapping:
    // 'mastered' -> 'learned' / 'mastered'
    // 'needs_review' / gap -> 'needs_review'
    // 'learning' / 'practicing' / attempts > 0 -> 'in_progress'
    // 'new' / attempts === 0 -> 'not_started'
    let state = 'not_started';
    if (isMastered) {
      state = 'learned';
    } else if (stat.attempts > 0 || stat.status === 'learning' || stat.status === 'practicing' || isGap) {
      state = 'in_progress';
    }

    const currentLevel = (profileData && profileData.currentLevel) || 'beginner';
    const totalAttempts = (profileData && profileData.totalAttempts) || 0;
    const overallAcc = (profileData && profileData.accuracyRate) || 0;

    // 4 Distinct Recommendation Rationales:
    // 1. Weak performance (top priority: score 100-150)
    // 2. Revision (practicing or mastered: score 75-85)
    // 3. New learning (unstarted at current level: score 70)
    // 4. Next-level preparation (higher tier when current level is solid: score 65)

    let recommendationEligibility = false;
    let recommendationReasonType = null; // 'weak_performance' | 'revision' | 'new_learning' | 'next_level'
    let recommendationBadge = null;
    let recommendationExplanation = null;
    let eligibilityScore = 0;

    if (isGap) {
      // 1. WEAK PERFORMANCE
      recommendationEligibility = true;
      recommendationReasonType = 'weak_performance';
      recommendationBadge = '⚠️ Weak Performance';
      const missCount = stat.consecutiveFailures || Math.max(1, stat.attempts - stat.correct);
      if (stat.attempts > 0) {
        recommendationExplanation = `Accuracy is ${stat.accuracy}% (${missCount} miss${missCount > 1 ? 'es' : ''}). Urgent reinforcement needed.`;
      } else {
        recommendationExplanation = `Flagged in review queue for reinforcement.`;
      }
      eligibilityScore = 100 + (stat.consecutiveFailures || 0) * 15;
    } else if (isMastered) {
      // 2. REVISION (Mastered sign ready for retention review)
      recommendationEligibility = true;
      recommendationReasonType = 'revision';
      recommendationBadge = '🔄 Revision';
      recommendationExplanation = `Mastered sign ready for spaced retention practice.`;
      eligibilityScore = 40; // available for revision, but lower priority than new/weak
    } else if (stat.attempts >= 1) {
      // 2. REVISION / PRACTICE AGAIN (In-progress sign being consolidated)
      recommendationEligibility = true;
      recommendationReasonType = 'revision';
      recommendationBadge = '🔄 Revision';
      recommendationExplanation = `Practiced ${stat.attempts} time${stat.attempts > 1 ? 's' : ''} (${stat.accuracy}% accuracy). Revise to reach full mastery.`;
      eligibilityScore = 80;
    } else if (item.proficiencyLevel === currentLevel) {
      // 3. NEW LEARNING (Unstarted sign matching current learner proficiency tier)
      recommendationEligibility = true;
      recommendationReasonType = 'new_learning';
      recommendationBadge = '✨ New Learning';
      recommendationExplanation = `Unstarted authentic ISL sign curated for your ${currentLevel} proficiency.`;
      eligibilityScore = 70;
    } else if (
      (currentLevel === 'beginner' && item.proficiencyLevel === 'intermediate' && overallAcc >= 70 && totalAttempts >= 6) ||
      (currentLevel === 'intermediate' && item.proficiencyLevel === 'advanced' && overallAcc >= 75 && totalAttempts >= 18)
    ) {
      // 4. NEXT-LEVEL PREPARATION (Higher tier challenge preview when current level is solid)
      recommendationEligibility = true;
      recommendationReasonType = 'next_level';
      recommendationBadge = '🚀 Next-Level Prep';
      recommendationExplanation = `Strong progress on ${currentLevel}! Preview this ${item.proficiencyLevel} sign to prepare for advancement.`;
      eligibilityScore = 65;
    }

    const levelCapitalized = (item.proficiencyLevel || 'beginner').charAt(0).toUpperCase() + (item.proficiencyLevel || 'beginner').slice(1);
    const phraseText = item.sentence || item.word || '';

    let statusKey = 'not_started';
    let statusLabel = 'Not Started';
    if (isMastered) {
      statusKey = 'mastered';
      statusLabel = 'Mastered';
    } else if (state === 'learned') {
      statusKey = 'learned';
      statusLabel = 'Learned';
    } else if (isGap || stat.status === 'needs_review') {
      statusKey = 'needs_review';
      statusLabel = 'Needs Review';
    } else if (stat.attempts > 0 || state === 'in_progress') {
      statusKey = 'in_progress';
      statusLabel = 'In Progress';
    } else if (recommendationEligibility) {
      statusKey = 'recommended';
      statusLabel = 'Recommended';
    }

    let recRationale = null;
    if (recommendationEligibility && recommendationReasonType) {
      recRationale = {
        class: `rec-chip-${recommendationReasonType}`,
        label: recommendationBadge || '✨ Recommended'
      };
    }

    return {
      ...item,
      level: levelCapitalized,
      phrase: phraseText,
      text: phraseText,
      status: statusKey,
      statusLabel: statusLabel,
      recommendationRationale: recRationale,
      masteryStatus: isMastered ? 'mastered' : isGap ? 'needs_review' : stat.status,
      isGap,
      performance: {
        attempts: stat.attempts,
        correct: stat.correct,
        incorrect: Math.max(0, stat.attempts - stat.correct),
        accuracy: stat.accuracy,
        consecutiveCorrect: stat.consecutiveCorrect || 0,
        consecutiveFailures: stat.consecutiveFailures || 0,
        reviewPriority: stat.reviewPriority || 0,
        lastPracticed: stat.lastPracticed
      },
      recommendationEligibility,
      recommendationReasonType,
      recommendationBadge,
      recommendationExplanation,
      eligibilityScore,
      isReviewQueueItem: isReviewQueue,
      stateBadge: recommendationBadge,
      stateChipClass: recommendationReasonType ? `rec-chip-${recommendationReasonType}` : null
    };
  }

  /**
   * Retrieves an item by ID with current learner state attached.
   */
  getItemById(id, profileData = null) {
    const raw = this.itemsById.get(String(id));
    if (!raw) return null;
    return this.enrichItemWithState(raw, profileData);
  }

  /**
   * Retrieves top recommended items based on current learner profile, level, and identified gaps.
   * @param {Object} profileData
   * @param {number} limit
   * @returns {Array<Object>}
   */
  getRecommendedItems(profileData = null, limit = 12) {
    const enriched = this.items.map(item => this.enrichItemWithState(item, profileData));
    const eligible = enriched.filter(item => item.recommendationEligibility && item.masteryStatus !== 'mastered');

    eligible.sort((a, b) => {
      // 1. Gaps first (score 100+)
      if (b.eligibilityScore !== a.eligibilityScore) {
        return b.eligibilityScore - a.eligibilityScore;
      }
      return a.sentence.localeCompare(b.sentence, undefined, { numeric: true });
    });

    return eligible.slice(0, limit);
  }

  /**
   * Hook for Pedagogical Learning Loop:
   * Retrieves recommended signs for the learner based on level and gaps.
   * @param {Object} profileData
   * @param {number} limit
   * @returns {Array<Object>}
   */
  getRecommendations(profileData = null, limit = 12) {
    return this.getRecommendedItems(profileData, limit);
  }

  /**
   * Queries items based on multi-facet filter criteria.
   * @param {Object} filters
   * @param {string} [filters.level] - 'beginner' | 'intermediate' | 'advanced' | 'all'
   * @param {string} [filters.category] - category id or 'all'
   * @param {string} [filters.status] - 'all' | 'not_started' | 'in_progress' | 'learned' | 'mastered' | 'recommended' | 'needs_review'
   * @param {string} [filters.query] - text search string
   * @param {Object} [profileData]
   */
  getItems(filters = {}, profileData = null) {
    let result = this.items;

    if (filters.level && filters.level !== 'all') {
      const l = filters.level.toLowerCase();
      result = result.filter(item => (item.proficiencyLevel || '').toLowerCase() === l);
    }

    if (filters.category && filters.category !== 'all') {
      result = result.filter(item => item.category === filters.category);
    }

    if (filters.query && filters.query.trim()) {
      const q = filters.query.toLowerCase().trim();
      const terms = q.split(/\s+/).filter(Boolean);
      result = result.filter(item => {
        const text = `${item.sentence} ${item.gloss} ${item.id}`.toLowerCase();
        return terms.every(term => text.includes(term));
      });
    }

    // Enrich with learner state
    let enriched = result.map(item => this.enrichItemWithState(item, profileData));

    if (filters.status && filters.status !== 'all') {
      const s = filters.status.toLowerCase().replace(/[\s-]/g, '_');
      if (s === 'recommended') {
        enriched = enriched.filter(item => item.recommendationEligibility || item.status === 'recommended');
      } else if (s === 'needs_review') {
        enriched = enriched.filter(item => item.status === 'needs_review' || item.isGap);
      } else if (s === 'mastered') {
        enriched = enriched.filter(item => item.status === 'mastered');
      } else if (s === 'learned') {
        enriched = enriched.filter(item => item.status === 'learned' || item.status === 'mastered');
      } else if (s === 'in_progress') {
        enriched = enriched.filter(item => item.status === 'in_progress');
      } else if (s === 'not_started') {
        enriched = enriched.filter(item => item.status === 'not_started');
      }
    }

    // Level-adapted prioritization:
    // 1. Weak performance / gaps first
    // 2. Prioritize items matching the learner's current level
    const learnerLevel = (profileData && profileData.currentLevel) || 'beginner';
    enriched.sort((a, b) => {
      // 1. Active gaps first
      if (a.isGap && !b.isGap) return -1;
      if (!a.isGap && b.isGap) return 1;

      // 2. High recommendation eligibility score
      if (a.recommendationEligibility && b.recommendationEligibility) {
        if (b.eligibilityScore !== a.eligibilityScore) {
          return b.eligibilityScore - a.eligibilityScore;
        }
      }

      // 3. Learner's current level priority when all levels shown
      if (!filters.level || filters.level === 'all') {
        const aMatches = a.proficiencyLevel === learnerLevel;
        const bMatches = b.proficiencyLevel === learnerLevel;
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
      }

      return 0;
    });

    return enriched;
  }

  /**
   * Search authentic repository items by freeform text query across sentence, gloss, and ID.
   * @param {string} query
   * @param {Object|null} profileData
   * @returns {Array<Object>}
   */
  search(query, profileData = null) {
    return this.getItems({ query }, profileData);
  }

  /**
   * Returns high-level repository statistics partitioned by level and learning state.
   */
  getStats(profileData = null) {
    const total = this.items.length;

    let beginner = 0;
    let intermediate = 0;
    let advanced = 0;
    let learned = 0;
    let mastered = 0;
    let inProgress = 0;
    let notStarted = 0;
    let needsReview = 0;
    let recommended = 0;

    for (const raw of this.items) {
      const item = this.enrichItemWithState(raw, profileData);
      if (item.proficiencyLevel === 'beginner') beginner++;
      else if (item.proficiencyLevel === 'intermediate') intermediate++;
      else if (item.proficiencyLevel === 'advanced') advanced++;

      if (item.masteryStatus === 'mastered') {
        mastered++;
        learned++;
      } else if (item.status === 'learned') {
        learned++;
      } else if (item.status === 'in_progress') {
        inProgress++;
      } else {
        notStarted++;
      }

      if (item.isGap) needsReview++;
      if (item.recommendationEligibility) recommended++;
    }

    return {
      total,
      predefinedCount: total,
      levels: { beginner, intermediate, advanced },
      states: { learned, mastered, inProgress, notStarted, needsReview, recommended }
    };
  }

  /**
   * Identifies all active learning gaps (items in reviewQueue or with recent mistakes).
   */
  getLearningGaps(profileData) {
    if (!profileData) return [];
    const reviewIds = new Set(profileData.reviewQueue || []);

    const gaps = [];
    for (const item of this.items) {
      const stat = profileData.itemMastery?.[item.id];
      const isInReview = reviewIds.has(item.id);
      const hasLowAcc = stat && stat.attempts >= 1 && stat.accuracy < 60;
      const hasMisses = stat && (stat.consecutiveFailures || 0) >= 1;
      const isNeedsRev = stat && stat.status === 'needs_review';

      if (isInReview || hasLowAcc || hasMisses || isNeedsRev) {
        gaps.push(this.enrichItemWithState(item, profileData));
      }
    }

    // Sort by lowest accuracy first
    gaps.sort((a, b) => (a.performance.accuracy - b.performance.accuracy));
    return gaps;
  }
}

// Global singleton instance
export const islKnowledgeRepository = new ISLKnowledgeRepository();
