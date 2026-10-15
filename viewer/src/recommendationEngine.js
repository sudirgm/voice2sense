// ============================================================
// Personalized Learning Recommendation Engine
// Voice 2 Sense | SignBridge 3D
// Deterministic / Rule-based — Multi-factor Adaptive Engine
// ============================================================

import { SIGN_LIBRARY } from './learningEngine.js';

export const RECOMMENDATION_STATES = {
  REVIEW_WEAK_SIGNS: {
    id: 'review_weak_signs',
    title: 'Review Weak Sign',
    badge: '⚠️ Review Weak Sign',
    chipClass: 'rec-chip-weak',
    actionText: 'Review Sign',
    priority: 1,
    description: 'Targeted reinforcement for signs with previous mistakes or low accuracy.'
  },
  PRACTICE_AGAIN: {
    id: 'practice_again',
    title: 'Practice Again',
    badge: '🔄 Practice Again',
    chipClass: 'rec-chip-practice',
    actionText: 'Practice Again',
    priority: 2,
    description: 'Consolidate recently practiced signs towards full mastery.'
  },
  CONTINUE_LEARNING: {
    id: 'continue_learning',
    title: 'Continue Learning',
    badge: '📖 Continue Learning',
    chipClass: 'rec-chip-continue',
    actionText: 'Continue Learning',
    priority: 3,
    description: 'Pick up where you left off in your current category sequence.'
  },
  RECOMMENDED_FOR_YOU: {
    id: 'recommended_for_you',
    title: 'New Recommended Sign',
    badge: '✨ New Recommended Sign',
    chipClass: 'rec-chip-recommended',
    actionText: 'Start Learning',
    priority: 4,
    description: 'Fresh curriculum content curated for your current proficiency level.'
  },
  NEXT_LEVEL_PREPARATION: {
    id: 'next_level_preparation',
    title: 'Next Level Preparation',
    badge: '🚀 Next Level Preparation',
    chipClass: 'rec-chip-nextlevel',
    actionText: 'Prepare Next Level',
    priority: 5,
    description: 'Foundational bridging content preparing you for the next proficiency tier.'
  }
};

/**
 * Robust item resolver across dataset items, foundational signs, and character/word variations
 */
function resolveItem(id, repository = null, profileData = null) {
  if (!id) return null;
  const sId = String(id);
  let item = repository ? (
    repository.getItemById(sId, profileData) ||
    repository.getItemById(`alpha-${sId.toLowerCase()}`, profileData) ||
    repository.getItemById(`num-${sId.toLowerCase()}`, profileData)
  ) : null;
  if (!item) {
    const fallback = SIGN_LIBRARY.find(s => s.id === sId || s.word.toLowerCase() === sId.toLowerCase());
    if (fallback) item = { ...fallback, sentence: fallback.word, source: 'sign_library' };
  }
  return item;
}

export class RecommendationEngine {
  constructor() {
    this.states = RECOMMENDATION_STATES;
  }

  /**
   * Evaluates learner profile and repository items to determine:
   * 1. Primary recommendation state
   * 2. Top recommended item
   * 3. Pedagogical rationale based on actual metrics
   *
   * @param {Object} profileData - LearnerProfile data object
   * @param {Object|null} repository - ISLKnowledgeRepository instance
   * @returns {Object} Enriched primary recommendation object
   */
  getPrimaryRecommendation(profileData, repository = null) {
    if (!profileData) {
      return this._getDefaultRecommendation(repository);
    }

    const currentLevel = (profileData.currentLevel || 'beginner').toLowerCase();
    const itemMastery = profileData.itemMastery || {};
    const reviewQueue = Array.isArray(profileData.reviewQueue) ? profileData.reviewQueue : [];
    const overallAcc = profileData.accuracyRate || 0;
    const totalAttempts = profileData.totalAttempts || 0;
    const levelProgress = profileData.levelProgress || 0;

    const recentWindow = Array.isArray(profileData.recentResults) ? profileData.recentResults.slice(-10) : [];
    const recentAcc = recentWindow.length > 0
      ? Math.round((recentWindow.filter(Boolean).length / recentWindow.length) * 100)
      : overallAcc;

    // --- FACTOR 1: REVIEW WEAK SIGNS & REPEATED MISTAKES ---
    // Identify signs with consecutive failures, repeated mistakes, low accuracy, or presence in reviewQueue
    const weakCandidates = [];
    for (const [id, stat] of Object.entries(itemMastery)) {
      if (!stat || stat.attempts === 0 || stat.status === 'mastered') continue;
      const mistakes = Math.max(0, stat.attempts - stat.correct);
      const consecutiveFailures = stat.consecutiveFailures || 0;
      const isReview = reviewQueue.includes(id);
      const isLowAcc = stat.accuracy < 60;

      if (consecutiveFailures >= 1 || isReview || isLowAcc || (mistakes >= 2 && stat.consecutiveCorrect === 0)) {
        let item = resolveItem(id, repository, profileData);
        if (item) {
          // Strictly adhere to level boundary: beginners only review beginner items
          if (currentLevel === 'beginner' && item.proficiencyLevel && item.proficiencyLevel !== 'beginner') {
            continue;
          }
          const severityScore = (consecutiveFailures * 35) + (mistakes * 15) + (100 - stat.accuracy) + (isReview ? 30 : 0) + (stat.reviewPriority || 0);
          weakCandidates.push({
            item,
            stat,
            mistakes,
            consecutiveFailures,
            accuracy: stat.accuracy,
            isReview,
            severityScore
          });
        }
      }
    }

    if (weakCandidates.length > 0) {
      weakCandidates.sort((a, b) => b.severityScore - a.severityScore);
      const topWeak = weakCandidates[0];
      const signName = topWeak.item.sentence || topWeak.item.word || topWeak.item.id;
      const hasRepeatedFails = topWeak.consecutiveFailures >= 2;

      const rationale = hasRepeatedFails
        ? `Repeated difficulty detected on "${signName}" (${topWeak.consecutiveFailures} consecutive misses, ${topWeak.accuracy}% accuracy). Immediate reinforcement required before continuing.`
        : topWeak.mistakes >= 2
          ? `Repeated difficulty detected on "${signName}" (${topWeak.mistakes} mistakes, ${topWeak.accuracy}% accuracy). Immediate reinforcement recommended.`
          : `Reinforce "${signName}" from recent practice mistake (${topWeak.accuracy}% accuracy) to consolidate long-term retention.`;

      return {
        state: this.states.REVIEW_WEAK_SIGNS,
        stateId: this.states.REVIEW_WEAK_SIGNS.id,
        badge: this.states.REVIEW_WEAK_SIGNS.badge,
        chipClass: this.states.REVIEW_WEAK_SIGNS.chipClass,
        areaTitle: hasRepeatedFails ? `Priority Review: ${signName}` : `Review Weak Signs: ${signName}`,
        rationale,
        targetItem: topWeak.item,
        level: currentLevel,
        isGap: true,
        priorityScore: 120 + topWeak.severityScore,
        metrics: {
          accuracy: topWeak.accuracy,
          attempts: topWeak.stat.attempts,
          mistakes: topWeak.mistakes,
          consecutiveFailures: topWeak.consecutiveFailures
        }
      };
    }

    // --- FACTOR 2: PRACTICE AGAIN (IN-PROGRESS SIGNS) ---
    // Signs attempted with moderate accuracy (>= 60%) but not yet reached mastery (attempts < 3 or consecutiveCorrect < 2)
    const inProgressCandidates = [];
    for (const [id, stat] of Object.entries(itemMastery)) {
      if (!stat || stat.attempts === 0 || stat.status === 'mastered') continue;
      if (stat.accuracy >= 60) {
        let item = resolveItem(id, repository, profileData);
        if (item) {
          if (item.proficiencyLevel && item.proficiencyLevel !== currentLevel) {
            continue;
          }
          inProgressCandidates.push({ item, stat });
        }
      }
    }

    if (inProgressCandidates.length > 0) {
      // Prioritize the sign most recently practiced or closest to mastery
      inProgressCandidates.sort((a, b) => (b.stat.lastPracticed || 0) - (a.stat.lastPracticed || 0));
      const chosen = inProgressCandidates[0];
      const signName = chosen.item.sentence || chosen.item.word || chosen.item.id;

      return {
        state: this.states.PRACTICE_AGAIN,
        stateId: this.states.PRACTICE_AGAIN.id,
        badge: this.states.PRACTICE_AGAIN.badge,
        chipClass: this.states.PRACTICE_AGAIN.chipClass,
        areaTitle: `Practice Again: ${signName}`,
        rationale: `"${signName}" is currently in progress (${chosen.stat.accuracy}% accuracy, ${chosen.stat.attempts} practice${chosen.stat.attempts > 1 ? 's' : ''}). Solidify mastery with another successful attempt.`,
        targetItem: chosen.item,
        level: currentLevel,
        isGap: false,
        priorityScore: 80,
        metrics: {
          accuracy: chosen.stat.accuracy,
          attempts: chosen.stat.attempts,
          mistakes: Math.max(0, chosen.stat.attempts - chosen.stat.correct)
        }
      };
    }

    // --- FACTOR 2.5: SPACED REPETITION & RETENTION DECAY ---
    // Signs practiced previously but inactive for > 3 days (preventing memory decay)
    const now = Date.now();
    const decayCandidates = [];
    for (const [id, stat] of Object.entries(itemMastery)) {
      if (!stat || stat.attempts === 0 || !stat.lastPracticed) continue;
      const daysSince = (now - stat.lastPracticed) / 86400000;
      if (daysSince >= 3 && stat.status !== 'mastered') {
        let item = resolveItem(id, repository, profileData);
        if (item && (item.proficiencyLevel === currentLevel || (!item.proficiencyLevel && currentLevel === 'beginner'))) {
          decayCandidates.push({ item, stat, daysSince });
        }
      }
    }
    if (decayCandidates.length > 0) {
      decayCandidates.sort((a, b) => b.daysSince - a.daysSince);
      const chosen = decayCandidates[0];
      const signName = chosen.item.sentence || chosen.item.word || chosen.item.id;
      return {
        state: this.states.PRACTICE_AGAIN,
        stateId: this.states.PRACTICE_AGAIN.id,
        badge: this.states.PRACTICE_AGAIN.badge,
        chipClass: this.states.PRACTICE_AGAIN.chipClass,
        areaTitle: `Memory Reinforcement: ${signName}`,
        rationale: `Practice "${signName}" to reinforce retention and prevent recall decay (${Math.round(chosen.daysSince)} days since last practice).`,
        targetItem: chosen.item,
        level: currentLevel,
        isGap: false,
        priorityScore: 78,
        metrics: {
          accuracy: chosen.stat.accuracy,
          attempts: chosen.stat.attempts,
          daysInactive: Math.round(chosen.daysSince)
        }
      };
    }

    // --- FACTOR 3: NEXT LEVEL PREPARATION ---
    // If learner demonstrates high mastery in current tier, prepare them for the upcoming level
    let currentTierMasteredCount = 0;
    for (const [id, stat] of Object.entries(itemMastery)) {
      if (stat && stat.status === 'mastered') {
        const itm = resolveItem(id, repository, profileData);
        if (itm && (itm.proficiencyLevel === currentLevel || (!itm.proficiencyLevel && currentLevel === 'beginner'))) {
          currentTierMasteredCount++;
        }
      }
    }

    const isReadyForNextLevelPrep = (
      reviewQueue.length === 0 &&
      (
        (currentLevel === 'beginner' && (levelProgress >= 70 || (currentTierMasteredCount >= 4 && overallAcc >= 70 && recentAcc >= 65))) ||
        (currentLevel === 'intermediate' && (levelProgress >= 75 && currentTierMasteredCount >= 6 && overallAcc >= 80 && recentAcc >= 75))
      )
    );

    if (isReadyForNextLevelPrep && repository && repository.isLoaded) {
      const nextTier = currentLevel === 'beginner' ? 'intermediate' : 'advanced';
      // Find a gentle transition sign: the shortest, most foundational sentence in the next tier
      const bridgeItems = repository.getItems({ level: nextTier }, profileData)
        .filter(item => !itemMastery[item.id] || itemMastery[item.id].attempts === 0);

      if (bridgeItems.length > 0) {
        bridgeItems.sort((a, b) => (a.sentence || '').length - (b.sentence || '').length);
        const bridgeSign = bridgeItems[0];
        const signName = bridgeSign.sentence || bridgeSign.word;

        return {
          state: this.states.NEXT_LEVEL_PREPARATION,
          stateId: this.states.NEXT_LEVEL_PREPARATION.id,
          badge: this.states.NEXT_LEVEL_PREPARATION.badge,
          chipClass: this.states.NEXT_LEVEL_PREPARATION.chipClass,
          areaTitle: `Next Level Preparation: Transition to ${nextTier.toUpperCase()}`,
          rationale: `Strong mastery established in ${currentLevel.toUpperCase()} (${overallAcc}% overall accuracy). Prepare for ${nextTier.toUpperCase()} with bridge expression: "${signName}".`,
          targetItem: bridgeSign,
          level: currentLevel,
          isGap: false,
          priorityScore: 75,
          metrics: {
            accuracy: overallAcc,
            attempts: totalAttempts,
            masteredCount: currentTierMasteredCount
          }
        };
      }
    }

    // --- FACTOR 4: CONTINUE LEARNING (ACTIVE CATEGORY OR NATURAL SEQUENCE) ---
    // If learner has an active category with uncompleted items, continue the natural sequence
    const activeGoal = profileData.activeGoal || 'all';
    if (activeGoal !== 'all' && repository && repository.isLoaded) {
      const catItems = repository.getItems({ category: activeGoal, level: currentLevel }, profileData)
        .filter(item => !itemMastery[item.id] || itemMastery[item.id].status !== 'mastered');

      if (catItems.length > 0) {
        const nextInCat = catItems[0];
        const signName = nextInCat.sentence || nextInCat.word;
        return {
          state: this.states.CONTINUE_LEARNING,
          stateId: this.states.CONTINUE_LEARNING.id,
          badge: this.states.CONTINUE_LEARNING.badge,
          chipClass: this.states.CONTINUE_LEARNING.chipClass,
          areaTitle: `Continue Learning: ${signName}`,
          rationale: `Continue your ${activeGoal.replace(/_/g, ' ')} curriculum progression by learning "${signName}".`,
          targetItem: nextInCat,
          level: currentLevel,
          isGap: false,
          priorityScore: 65,
          metrics: {
            category: activeGoal,
            remainingInCat: catItems.length
          }
        };
      }
    }

    // --- FACTOR 5: RECOMMENDED FOR YOU (UNSEEN CURATED CONTENT WITHIN TIER) ---
    // Prioritizes unseen content in the learner's current proficiency level
    let unseenCandidates = [];
    if (repository && repository.isLoaded) {
      unseenCandidates = repository.getItems({ level: currentLevel }, profileData)
        .filter(item => !itemMastery[item.id] || itemMastery[item.id].attempts === 0);
    }

    if (unseenCandidates.length === 0) {
      // Fallback to SIGN_LIBRARY matching current level
      const tierNum = currentLevel === 'beginner' ? 1 : currentLevel === 'intermediate' ? 2 : 3;
      unseenCandidates = SIGN_LIBRARY.filter(s => s.difficulty === tierNum && (!itemMastery[s.id] || itemMastery[s.id].attempts === 0));
    }

    if (unseenCandidates.length > 0) {
      // Prioritize foundational alphabets/numbers first for beginners with 0 attempts
      if (currentLevel === 'beginner') {
        unseenCandidates.sort((a, b) => {
          if (a.source === 'foundational' && b.source !== 'foundational') return -1;
          if (b.source === 'foundational' && a.source !== 'foundational') return 1;
          return (a.sentence || a.word || '').localeCompare(b.sentence || b.word || '', undefined, { numeric: true });
        });
      }

      const chosen = unseenCandidates[0];
      const signName = chosen.sentence || chosen.word || chosen.id;
      const catLabel = (chosen.category || 'general').replace(/_/g, ' ');

      return {
        state: this.states.RECOMMENDED_FOR_YOU,
        stateId: this.states.RECOMMENDED_FOR_YOU.id,
        badge: this.states.RECOMMENDED_FOR_YOU.badge,
        chipClass: this.states.RECOMMENDED_FOR_YOU.chipClass,
        areaTitle: `Recommended for You: ${signName}`,
        rationale: `Curated ${currentLevel} ISL sign: "${signName}" (${catLabel}). Build foundational signing confidence.`,
        targetItem: chosen,
        level: currentLevel,
        isGap: false,
        priorityScore: 50,
        metrics: {
          category: chosen.category,
          tier: currentLevel
        }
      };
    }

    // Ultimate fallback
    return this._getDefaultRecommendation(repository);
  }

  /**
   * Produces a multi-item collection across different recommendation states
   * for carousels, recommendation trays, and learning hubs.
   *
   * @param {Object} profileData 
   * @param {Object|null} repository 
   * @param {number} limit 
   * @returns {Array<Object>} List of recommendation cards
   */
  getMultiRecommendations(profileData, repository = null, limit = 4) {
    const results = [];
    const usedIds = new Set();

    // 1. Primary Recommendation is always first
    const primary = this.getPrimaryRecommendation(profileData, repository);
    if (primary && primary.targetItem) {
      results.push(primary);
      usedIds.add(String(primary.targetItem.id));
    }

    const currentLevel = (profileData && profileData.currentLevel || 'beginner').toLowerCase();
    const itemMastery = (profileData && profileData.itemMastery) || {};

    // 2. Add Weak Signs if not already added
    if (results.length < limit && profileData && Array.isArray(profileData.reviewQueue)) {
      for (const gapId of profileData.reviewQueue) {
        if (results.length >= limit) break;
        if (usedIds.has(String(gapId))) continue;

        const item = resolveItem(gapId, repository, profileData);
        if (item && (currentLevel !== 'beginner' || item.proficiencyLevel === 'beginner')) {
          const stat = itemMastery[gapId] || {};
          results.push({
            state: this.states.REVIEW_WEAK_SIGNS,
            stateId: this.states.REVIEW_WEAK_SIGNS.id,
            badge: this.states.REVIEW_WEAK_SIGNS.badge,
            chipClass: this.states.REVIEW_WEAK_SIGNS.chipClass,
            areaTitle: `Review: ${item.sentence || item.word}`,
            rationale: `Reinforce recent mistake (${stat.accuracy || 0}% accuracy).`,
            targetItem: item,
            level: currentLevel,
            isGap: true,
            priorityScore: 90
          });
          usedIds.add(String(item.id));
        }
      }
    }

    // 3. Add Practice Again (in progress) items
    if (results.length < limit) {
      for (const [id, stat] of Object.entries(itemMastery)) {
        if (results.length >= limit) break;
        if (usedIds.has(String(id))) continue;
        if (stat && stat.attempts > 0 && stat.status !== 'mastered' && stat.accuracy >= 60) {
          const item = resolveItem(id, repository, profileData);
          if (item && (currentLevel !== 'beginner' || item.proficiencyLevel === 'beginner')) {
            results.push({
              state: this.states.PRACTICE_AGAIN,
              stateId: this.states.PRACTICE_AGAIN.id,
              badge: this.states.PRACTICE_AGAIN.badge,
              chipClass: this.states.PRACTICE_AGAIN.chipClass,
              areaTitle: `Practice: ${item.sentence || item.word}`,
              rationale: `In progress (${stat.accuracy}% accuracy). Repeat to master.`,
              targetItem: item,
              level: currentLevel,
              isGap: false,
              priorityScore: 70
            });
            usedIds.add(String(item.id));
          }
        }
      }
    }

    // 4. Add Next Unseen items matching level
    if (results.length < limit && repository && repository.isLoaded) {
      const unseen = repository.getItems({ level: currentLevel }, profileData)
        .filter(item => !usedIds.has(String(item.id)) && (!itemMastery[item.id] || itemMastery[item.id].attempts === 0));

      for (const item of unseen) {
        if (results.length >= limit) break;
        results.push({
          state: this.states.RECOMMENDED_FOR_YOU,
          stateId: this.states.RECOMMENDED_FOR_YOU.id,
          badge: this.states.RECOMMENDED_FOR_YOU.badge,
          chipClass: this.states.RECOMMENDED_FOR_YOU.chipClass,
          areaTitle: `New: ${item.sentence || item.word}`,
          rationale: `Curated for ${currentLevel} proficiency.`,
          targetItem: item,
          level: currentLevel,
          isGap: false,
          priorityScore: 50
        });
        usedIds.add(String(item.id));
      }
    }

    return results;
  }

  _getDefaultRecommendation(repository = null) {
    let fallback = null;
    if (repository && repository.isLoaded && repository.items.length > 0) {
      fallback = repository.items[0];
    } else {
      fallback = SIGN_LIBRARY[0];
    }

    return {
      state: this.states.RECOMMENDED_FOR_YOU,
      stateId: this.states.RECOMMENDED_FOR_YOU.id,
      badge: this.states.RECOMMENDED_FOR_YOU.badge,
      chipClass: this.states.RECOMMENDED_FOR_YOU.chipClass,
      areaTitle: 'Foundational Alphabets & Hand Shapes',
      rationale: 'Master fundamental ISL manual hand shapes to establish a firm communication base.',
      targetItem: fallback,
      level: 'beginner',
      isGap: false,
      priorityScore: 50,
      metrics: { accuracy: 0, attempts: 0 }
    };
  }
}

// Global Singleton
export const recommendationEngine = new RecommendationEngine();
