/**
 * LearnerStore - Reactive Learner Profile Telemetry & Storage Engine
 * Single source of truth for learner metrics, progress ring, proficiency tiering,
 * and adaptive recommendations synchronized to localStorage key 'signbridge_learner_profile_v2'.
 */

const STORAGE_KEY = 'signbridge_learner_profile_v2';
const LEGACY_KEY = 'v2s_isl_personalized_profile_v2';
const TOTAL_DATASET_SIGNS = 2501;

export class LearnerStore {
  constructor() {
    this.storageKey = STORAGE_KEY;
    this.data = this.loadProfile();
  }

  getDefaultProfile() {
    return {
      version: 2,
      learnerName: 'Learner',
      created: Date.now(),
      lastActive: Date.now(),
      currentLevel: 'beginner',
      levelProgress: 0,
      activeGoal: 'all',
      recommendedArea: 'Foundational Greetings & Everyday Expressions',
      recommendedTopic: 'Foundational Greetings & Everyday Expressions',
      lastRecommendationState: 'recommended_for_you',
      selectedPlaybackSpeed: 0.75,
      totalAttempts: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      accuracyRate: 100,
      currentStreak: 0,
      bestStreak: 0,
      lessonCompletionCount: 0,
      totalPracticeAttempts: 0,
      itemMastery: {},
      recentResults: [],
      reviewQueue: [],
      practiceHistory: [],
      categoryStats: {}
    };
  }

  loadProfile() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.storageKey) || localStorage.getItem(LEGACY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const def = this.getDefaultProfile();
            const merged = { ...def, ...parsed };
            merged.itemMastery = parsed.itemMastery && typeof parsed.itemMastery === 'object' ? parsed.itemMastery : {};
            return merged;
          }
        }
      }
    } catch (err) {
      console.warn('[LearnerStore] Failed to read profile from localStorage:', err);
    }
    return this.getDefaultProfile();
  }

  saveProfile(profile = this.data) {
    try {
      if (typeof localStorage !== 'undefined') {
        profile.lastActive = Date.now();
        const serialized = JSON.stringify(profile);
        localStorage.setItem(this.storageKey, serialized);
        try {
          localStorage.setItem(LEGACY_KEY, serialized);
        } catch {}
      }
    } catch (err) {
      console.error('[LearnerStore] Failed to save profile to localStorage:', err);
    }
  }

  /**
   * Determine dynamic recommended topic based on level and uncompleted signs
   */
  getRecommendedTopic(level, profile = this.data) {
    const lvl = (level || 'Beginner').toLowerCase();

    // 1. If repository is loaded in browser window, query for first uncompleted sign in this tier
    if (typeof window !== 'undefined' && window.islKnowledgeRepository?.isLoaded) {
      const items = window.islKnowledgeRepository.items || [];
      const uncompletedInLevel = items.find(item => {
        const isLevel = (item.level || '').toLowerCase() === lvl;
        const stat = profile.itemMastery?.[String(item.id)];
        const isDone = stat && (stat.status === 'learned' || stat.status === 'mastered' || (stat.correct && stat.correct > 0));
        return isLevel && !isDone;
      });

      if (uncompletedInLevel) {
        const phrase = uncompletedInLevel.phrase || uncompletedInLevel.text || '';
        return `${level} Sign: "${phrase}"`;
      }
    }

    // 2. Curated level-appropriate defaults
    if (lvl === 'advanced') {
      return 'Complex Multi-Clause Narratives & Technical Signs';
    } else if (lvl === 'intermediate') {
      return 'Conversational Structures & Practical Signs';
    } else {
      return 'Foundational Greetings & Everyday Expressions';
    }
  }

  /**
   * Calculates proficiency tier strictly per specification:
   * Beginner: < 25 signs
   * Intermediate: 25–79 signs
   * Advanced: 80+ signs
   */
  getProficiencyLevel(completedCount) {
    if (completedCount >= 80) return 'Advanced';
    if (completedCount >= 25) return 'Intermediate';
    return 'Beginner';
  }

  /**
   * Count completed signs
   */
  getCompletedSignsCount(profile = this.data) {
    const mastery = profile.itemMastery || {};
    return Object.values(mastery).filter(item =>
      item && (item.status === 'learned' || item.status === 'mastered' || (item.correct && item.correct > 0))
    ).length;
  }

  /**
   * Record a completed practice attempt
   * @param {string|number} signId - Sign identifier (e.g. 1000648)
   * @param {object} options - { success: boolean, accuracy: number }
   */
  recordAttempt(signId, { success = true, accuracy = 1.0 } = {}) {
    const p = this.loadProfile();
    const idStr = String(signId);

    if (!p.itemMastery) p.itemMastery = {};
    if (!p.itemMastery[idStr]) {
      p.itemMastery[idStr] = {
        status: 'learning',
        attempts: 0,
        correct: 0,
        accuracy: 0,
        consecutiveCorrect: 0,
        consecutiveFailures: 0,
        practiceAttempts: 0,
        lastPracticed: null,
        reviewPriority: 0
      };
    }

    const stat = p.itemMastery[idStr];
    stat.attempts = (stat.attempts || 0) + 1;
    stat.practiceAttempts = (stat.practiceAttempts || 0) + 1;
    stat.lastPracticed = Date.now();

    if (success) {
      stat.correct = (stat.correct || 0) + 1;
      stat.consecutiveCorrect = (stat.consecutiveCorrect || 0) + 1;
      stat.consecutiveFailures = 0;
      stat.status = stat.consecutiveCorrect >= 3 ? 'mastered' : 'learned';
    } else {
      stat.consecutiveFailures = (stat.consecutiveFailures || 0) + 1;
      stat.consecutiveCorrect = 0;
      stat.status = 'needs_review';
    }

    const accPercent = Math.round((accuracy !== undefined ? accuracy : (success ? 1 : 0)) * 100);
    stat.accuracy = Math.round(((stat.accuracy || 0) * (stat.attempts - 1) + accPercent) / stat.attempts);

    // Global counters
    p.totalAttempts = (p.totalAttempts || 0) + 1;
    p.totalPracticeAttempts = (p.totalPracticeAttempts || 0) + 1;
    if (success) {
      p.correctAnswers = (p.correctAnswers || 0) + 1;
      p.currentStreak = (p.currentStreak || 0) + 1;
      if (p.currentStreak > (p.bestStreak || 0)) p.bestStreak = p.currentStreak;
    } else {
      p.incorrectAnswers = (p.incorrectAnswers || 0) + 1;
      p.currentStreak = 0;
    }

    if (p.totalAttempts > 0) {
      p.accuracyRate = Math.round((p.correctAnswers / p.totalAttempts) * 100);
    }

    // Completed signs count
    const completedCount = this.getCompletedSignsCount(p);

    // Dynamic level: Beginner (<25), Intermediate (25–79), Advanced (80+)
    const level = this.getProficiencyLevel(completedCount);
    p.currentLevel = level.toLowerCase();
    p.levelProgress = Math.min(100, Math.round((completedCount / TOTAL_DATASET_SIGNS) * 100));

    // Dynamic recommended topic
    p.recommendedTopic = this.getRecommendedTopic(level, p);
    p.recommendedArea = p.recommendedTopic;

    // Append to practice history
    if (!Array.isArray(p.practiceHistory)) p.practiceHistory = [];
    p.practiceHistory.unshift({
      id: idStr,
      timestamp: Date.now(),
      success,
      accuracy: accPercent,
      level
    });
    if (p.practiceHistory.length > 50) p.practiceHistory.length = 50;

    // Persist to storage
    this.data = p;
    this.saveProfile(p);

    // Real-time DOM synchronization
    this.updateProfileCardDOM(p, completedCount, level);

    return {
      profile: p,
      completedCount,
      level,
      stat
    };
  }

  /**
   * Record practice reps for a sign without assessment scoring,
   * directly updating practice telemetry and contributing to learner state.
   * @param {string|number} signId
   * @param {number} reps
   */
  recordPracticeRep(signId, reps = 1) {
    const p = this.loadProfile();
    const idStr = String(signId);

    if (!p.itemMastery) p.itemMastery = {};
    if (!p.itemMastery[idStr]) {
      p.itemMastery[idStr] = {
        status: 'learning',
        attempts: 0,
        correct: 0,
        accuracy: 0,
        consecutiveCorrect: 0,
        consecutiveFailures: 0,
        practiceAttempts: 0,
        lastPracticed: null,
        reviewPriority: 0
      };
    }

    const stat = p.itemMastery[idStr];
    stat.practiceAttempts = (stat.practiceAttempts || 0) + reps;
    stat.lastPracticed = Date.now();
    p.totalPracticeAttempts = (p.totalPracticeAttempts || 0) + reps;

    this.data = p;
    this.saveProfile(p);
    this.updateProfileCardDOM(p);

    return {
      totalPracticeAttempts: p.totalPracticeAttempts,
      itemPracticeReps: stat.practiceAttempts
    };
  }

  /**
   * Update the DOM elements in #learner-profile-card and Home stages in real time
   */
  updateProfileCardDOM(profile = this.data, completedCount = null, level = null) {
    if (typeof document === 'undefined') return;
    const p = profile || this.loadProfile();
    const completed = completedCount !== null ? completedCount : this.getCompletedSignsCount(p);
    const currentLevel = level || this.getProficiencyLevel(completed);
    const currentLevelLower = currentLevel.toLowerCase();
    const progressPercent = ((completed / TOTAL_DATASET_SIGNS) * 100).toFixed(1) + '%';
    const recTopic = p.recommendedTopic || this.getRecommendedTopic(currentLevel, p);

    // Real-time updates to #learner-profile-card
    const signsLearnedEl = document.getElementById('metric-signs-learned');
    if (signsLearnedEl) signsLearnedEl.textContent = completed;

    const progressPercentEl = document.getElementById('metric-progress-percent');
    if (progressPercentEl) progressPercentEl.textContent = progressPercent;

    const profBadgeEl = document.getElementById('profile-proficiency-badge');
    if (profBadgeEl) {
      profBadgeEl.textContent = currentLevel;
      profBadgeEl.className = `badge-${currentLevelLower}`;
    }

    const recTopicEl = document.getElementById('profile-recommended-topic');
    if (recTopicEl) recTopicEl.textContent = recTopic;

    const accuracyEl = document.getElementById('metric-accuracy');
    if (accuracyEl) {
      accuracyEl.textContent = (p.totalAttempts > 0) ? `${p.accuracyRate || 0}%` : '100%';
    }

    // Sync other landing page telemetry elements
    const homeLearned = document.getElementById('home-stat-learned');
    if (homeLearned) homeLearned.textContent = completed;

    const homeProgress = document.getElementById('home-progress-percent');
    if (homeProgress) homeProgress.textContent = progressPercent;

    const homeBar = document.getElementById('home-progress-bar');
    if (homeBar) homeBar.style.width = progressPercent;

    const homeRing = document.getElementById('home-progress-ring-circle');
    const homeRingPercent = document.getElementById('home-ring-percent');
    if (homeRing) {
      const circumference = 144.51;
      const num = parseFloat(progressPercent) || 0;
      const offset = circumference - (num / 100) * circumference;
      homeRing.style.strokeDashoffset = `${offset}`;
    }
    if (homeRingPercent) {
      homeRingPercent.textContent = progressPercent;
    }

    const homeLevelBadge = document.getElementById('home-level-badge');
    const homeLevelText = document.getElementById('home-level-text');
    if (homeLevelBadge && homeLevelText) {
      homeLevelText.textContent = currentLevel.toUpperCase();
      homeLevelBadge.className = `home-level-badge level-${currentLevelLower}`;
    }

    const homeRecArea = document.getElementById('home-rec-area');
    if (homeRecArea) homeRecArea.textContent = recTopic;

    // Visual progression steps
    const stepBeginner = document.getElementById('home-tier-step-beginner');
    const stepIntermediate = document.getElementById('home-tier-step-intermediate');
    const stepAdvanced = document.getElementById('home-tier-step-advanced');
    [stepBeginner, stepIntermediate, stepAdvanced].forEach(s => s?.classList?.remove?.('current', 'completed'));
    if (currentLevelLower === 'beginner') {
      stepBeginner?.classList?.add?.('current');
    } else if (currentLevelLower === 'intermediate') {
      stepBeginner?.classList?.add?.('completed');
      stepIntermediate?.classList?.add?.('current');
    } else if (currentLevelLower === 'advanced') {
      stepBeginner?.classList?.add?.('completed');
      stepIntermediate?.classList?.add?.('completed');
      stepAdvanced?.classList?.add?.('current');
    }

    // Broadcast custom event for application subscribers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('learnerProfileUpdated', {
        detail: { profile: p, completed, level: currentLevel, progressPercent }
      }));
    }
  }
}

export const learnerStore = new LearnerStore();

if (typeof window !== 'undefined') {
  window.learnerStore = learnerStore;
}

export default learnerStore;
