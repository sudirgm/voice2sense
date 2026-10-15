// ============================================================
// Smart Education Platform — App Controller
// Voice 2 Sense | SignBridge 3D
// Rule-based only — NO AI, NO LLM, NO backend
// ============================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { Fingerspeller } from './fingerspell.js';
import { Retargeter, debugPlaySingleBVH } from './retarget.js';
import { BONE_MAP } from './boneMap.js';
import { IslGrammar } from './islGrammar.js';
import { SentenceTimeline } from './sentenceTimeline.js';
import { OfflineTranslationService } from './offlineTranslationService.js';
import { CURRICULUM, findLessonById, findNextLesson, findPrevLesson, searchCurriculum, getLessonByChapterNum } from './curriculum.js';
import {
  SIGN_LIBRARY,
  LEARNING_GOALS,
  DIFFICULTY_LEVELS,
  LearnerProfile,
  AdaptiveLearningEngine,
  normalizeSignQuery,
  matchSignExact,
  searchSignLibrary,
  runSignAccuracyAudit
} from './learningEngine.js';
import { islKnowledgeRepository, REPOSITORY_CATEGORIES } from './islRepository.js';
import { learnerStore } from './learnerStore.js';
import { learningLoopController } from './learningLoop.js';
import { signMatcher } from './signMatcher.js';
import {
  PersonalizedLearningEngine,
  EDUCATION_PATHWAYS,
  INDIAN_STATES,
  CURRICULUM_BUNDLES
} from './personalizedLearning.js';
import { islRecognitionService, RECOGNITION_STATES } from './islRecognitionService.js';
import { academicAIService } from './academicAIService.js';
import { speechInputService, SPEECH_STATES, INDIAN_LANGUAGES } from './speechInputService.js';
import { ttsService, TTS_STATES } from './ttsService.js';

// Monotonic cancellation token counter & state for atomic BVH animation playback
let currentPlaybackSessionId = 0;
let currentPlaybackToken = 0;
let slerpAnimationId = null;
let searchDebounceTimer = null;

// Category grouping for Library Studio browser
const SIGN_CATEGORIES = {
  alphabets: { label: 'Alphabets A–Z', icon: '🔤', items: SIGN_LIBRARY.filter(s => s.category === 'alphabets') },
  numbers: { label: 'Numbers 0–9', icon: '🔢', items: SIGN_LIBRARY.filter(s => s.category === 'numbers') },
  words: { label: 'Basic Words', icon: '📝', items: SIGN_LIBRARY.filter(s => s.category === 'words') },
  greetings: { label: 'Greetings', icon: '👋', items: SIGN_LIBRARY.filter(s => s.category === 'greetings') },
  family: { label: 'Family & People', icon: '👨‍👩‍👧', items: SIGN_LIBRARY.filter(s => s.category === 'family') },
  actions: { label: 'Actions', icon: '🏃', items: SIGN_LIBRARY.filter(s => s.category === 'actions') },
  emotions: { label: 'Emotions', icon: '😊', items: SIGN_LIBRARY.filter(s => s.category === 'emotions') },
  questions: { label: 'Questions', icon: '❓', items: SIGN_LIBRARY.filter(s => s.category === 'questions') },
  phrases: { label: 'Common Phrases', icon: '💬', items: SIGN_LIBRARY.filter(s => s.category === 'phrases') },
  conversations: { label: 'Conversations', icon: '🗣️', items: SIGN_LIBRARY.filter(s => s.category === 'conversations') }
};

// Helper to escape HTML characters safely
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -------------------------------------------------------
// SMART ASSISTANT — RULE-BASED INTENT MATCHING
// -------------------------------------------------------

// Subject alias map
const SUBJECT_ALIASES = {
  'dsa': 'dsa', 'data structure': 'dsa', 'data structures': 'dsa', 'algorithm': 'dsa',
  'algorithms': 'dsa', 'ds': 'dsa', 'algo': 'dsa',
  'dbms': 'dbms', 'database': 'dbms', 'databases': 'dbms', 'rdbms': 'dbms', 'sql': 'dbms',
  'db': 'dbms',
  'os': 'os', 'operating system': 'os', 'operating systems': 'os',
  'cn': 'cn', 'network': 'cn', 'networking': 'cn', 'networks': 'cn', 'computer network': 'cn',
  'computer networks': 'cn'
};

// Intent detection patterns
const INTENT_PATTERNS = [
  { regex: /next\s*lesson/i, intent: 'next_lesson' },
  { regex: /chapter\s*(\d+)/i, intent: 'open_chapter', capture: 1 },
  { regex: /(?:open|show|go\s*to|navigate\s*to|take\s*me\s*to)\s+chapter\s*(\d+)/i, intent: 'open_chapter', capture: 1 },
  { regex: /(?:open|show|go\s*to|navigate|switch)\s+(.+)/i, intent: 'open_topic', capture: 1 },
  { regex: /(?:teach|learn|study|help\s*me\s*with|explain)\s+(.+)/i, intent: 'open_topic', capture: 1 },
  { regex: /(?:i\s+want|i\s+need)\s+(.+)/i, intent: 'open_topic', capture: 1 },
  { regex: /(.+)/i, intent: 'search', capture: 1 }
];

function resolveAssistantQuery(input, currentLessonId) {
  const text = input.trim().toLowerCase();

  // Check for "next lesson"
  if (/next\s*(lesson|topic|chapter)?/.test(text)) {
    if (currentLessonId) {
      const next = findNextLesson(currentLessonId);
      if (next) return { action: 'navigate', result: next, message: `Opening next lesson: **${next.lesson.title}**` };
    }
    return { action: 'none', message: "You're not currently in a lesson. Select a subject to start." };
  }

  // Check for "chapter N" pattern
  const chapterMatch = text.match(/chapter\s*(\d+)/);
  if (chapterMatch) {
    const num = parseInt(chapterMatch[1]);
    // Try to find in current subject first
    for (const subject of CURRICULUM) {
      const found = getLessonByChapterNum(subject.id, num);
      if (found) return { action: 'navigate', result: found, message: `Opening **${found.chapter.title}** — ${found.lesson.title}` };
    }
    return { action: 'none', message: `Chapter ${num} not found. Try a subject name first, then chapter number.` };
  }

  // Check for subject-only query
  const subjectId = SUBJECT_ALIASES[text];
  if (subjectId) {
    const subject = CURRICULUM.find(s => s.id === subjectId);
    return {
      action: 'show_subject',
      subjectId,
      message: `Opening **${subject.title}** — select a chapter to begin.`
    };
  }

  // Full keyword search
  const searchText = text
    .replace(/^(open|show|go to|teach me|learn|study|explain|i want|i need|help me with|navigate to)\s+/i, '')
    .trim();

  // Check subject aliases in search text
  for (const [alias, id] of Object.entries(SUBJECT_ALIASES)) {
    if (searchText.includes(alias)) {
      // Try to find a specific lesson too
      const results = searchCurriculum(searchText);
      if (results.length > 0) {
        return {
          action: 'navigate',
          result: results[0],
          message: `Found: **${results[0].lesson.title}** in ${results[0].subject.title}`
        };
      }
      // Just open the subject
      const subject = CURRICULUM.find(s => s.id === id);
      return { action: 'show_subject', subjectId: id, message: `Opening **${subject.title}**` };
    }
  }

  // General search
  const results = searchCurriculum(searchText);
  if (results.length > 0) {
    return {
      action: 'navigate',
      result: results[0],
      message: `Found: **${results[0].lesson.title}** in ${results[0].subject.title}`
    };
  }

  return {
    action: 'none',
    message: `I couldn't find that lesson. Try something like:\n• "Open DBMS"\n• "Teach me normalization"\n• "Show operating systems"\n• "Chapter 2"`
  };
}

// ============================================================
// EXPLICIT FAIL-SAFE VIEW ACTIVATOR WITH INLINE DISPLAY OVERRIDES
// ============================================================
export function activateView(targetViewId, targetNavBtn) {
  console.log(`[Router] Switching exclusively to view: ${targetViewId}`);

  // 1. Hide EVERY top-level view container via inline styles to prevent CSS specificity bypass
  const allViews = document.querySelectorAll('.app-view-container');
  allViews.forEach(view => {
    view.style.setProperty('display', 'none', 'important');
  });

  // 2. Show ONLY the target view
  const targetView = document.getElementById(targetViewId);
  if (targetView) {
    targetView.style.setProperty('display', 'flex', 'important');
  } else {
    console.error(`[Router] View container #${targetViewId} not found in DOM!`);
  }

  // 3. Reset active state on ALL top nav buttons
  const allNavBtns = document.querySelectorAll('.nav-btn, .nav-tab-btn, header button');
  allNavBtns.forEach(btn => {
    btn.classList.remove('active', 'btn-active');
    btn.style.removeProperty('background');
    btn.style.removeProperty('box-shadow');
  });

  // 4. Highlight strictly the clicked button
  if (targetNavBtn) {
    targetNavBtn.classList.add('active');
  }

  // 5. Toggle Landing Navbar vs Portal Navbar, Context Bar & Status Bar
  const landingNav = document.getElementById('landing-navbar-content');
  const portalNav = document.getElementById('portal-navbar-content');
  const userMenu = document.getElementById('header-user-menu');
  const contextBar = document.getElementById('portal-context-bar');
  const statusBar = document.getElementById('portal-bottom-status-bar');

  const isHomeView = targetViewId === 'view-landing' || targetViewId === 'landing-view';

  if (isHomeView) {
    if (landingNav) landingNav.style.display = 'flex';
    if (portalNav) portalNav.style.display = 'none';
    if (userMenu) userMenu.style.display = 'none';
    if (contextBar) contextBar.style.display = 'none';
    if (statusBar) statusBar.style.display = 'none';
  } else {
    if (landingNav) landingNav.style.display = 'none';
    if (portalNav) portalNav.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'flex';
    if (contextBar) contextBar.style.display = 'none';
    if (statusBar) statusBar.style.display = 'flex';

    // Context-specific group display: show only when needed
    const grpComm = document.getElementById('context-group-communicate');
    const grpLearn = document.getElementById('context-group-learn');
    const grpExplore = document.getElementById('context-group-explore');
    const grpStudy = document.getElementById('context-group-study');
    const grpAvatar = document.getElementById('context-group-avatar');

    if (grpComm) grpComm.style.display = 'none';
    if (grpLearn) grpLearn.style.display = 'none';
    if (grpExplore) grpExplore.style.display = 'none';
    if (grpStudy) grpStudy.style.display = 'none';
    if (grpAvatar) grpAvatar.style.display = 'none';

    if (targetViewId === 'view-realtime-comm' || targetViewId === 'realtime-comm-view') {
      if (grpComm) grpComm.style.display = 'flex';
    } else if (targetViewId === 'view-skill-dev') {
      if (grpLearn) grpLearn.style.display = 'flex';
    } else if (targetViewId === 'view-personalized-learning' || targetViewId === 'view-academic-assistance') {
      if (grpStudy) grpStudy.style.display = 'flex';
    } else if (targetViewId === 'view-isl-repository') {
      if (grpExplore) grpExplore.style.display = 'flex';
    } else {
      if (grpComm) grpComm.style.display = 'flex';
    }

    // Update ARIA Current page indicator
    document.querySelectorAll('.primary-nav-btn').forEach(b => {
      b.removeAttribute('aria-current');
      b.classList.remove('active');
    });
    if (targetNavBtn && targetNavBtn.classList.contains('primary-nav-btn')) {
      targetNavBtn.setAttribute('aria-current', 'page');
      targetNavBtn.classList.add('active');
    } else {
      if (targetViewId === 'view-realtime-comm' || targetViewId === 'realtime-comm-view') {
        const btn = document.getElementById('btn-mode-screen');
        btn?.setAttribute('aria-current', 'page');
        btn?.classList.add('active');
      } else if (targetViewId === 'view-skill-dev') {
        const btn = document.getElementById('btn-nav-learn');
        btn?.setAttribute('aria-current', 'page');
        btn?.classList.add('active');
      } else if (targetViewId === 'view-personalized-learning' || targetViewId === 'view-academic-assistance') {
        const btn = document.getElementById('btn-nav-study');
        btn?.setAttribute('aria-current', 'page');
        btn?.classList.add('active');
      } else if (targetViewId === 'view-isl-repository' || targetViewId === 'view-repository') {
        const btn = document.getElementById('btn-nav-explore-top');
        btn?.setAttribute('aria-current', 'page');
        btn?.classList.add('active');
      } else if (targetViewId === 'view-landing' || targetViewId === 'landing-view') {
        const btn = document.getElementById('btn-nav-home');
        btn?.setAttribute('aria-current', 'page');
        btn?.classList.add('active');
      }
    }

    // Update three-dots active label
    const threeDotsLabel = document.getElementById('three-dots-active-label');
    if (threeDotsLabel) {
      if (targetViewId === 'view-realtime-comm' || targetViewId === 'realtime-comm-view') {
        threeDotsLabel.textContent = 'COMMUNICATE';
      } else if (targetViewId === 'view-skill-dev') {
        threeDotsLabel.textContent = 'LEARN';
      } else if (targetViewId === 'view-personalized-learning') {
        threeDotsLabel.textContent = 'PERSONALIZED';
      } else if (targetViewId === 'view-academic-assistance') {
        threeDotsLabel.textContent = 'ASSISTANT';
      } else if (targetViewId === 'view-isl-repository' || targetViewId === 'view-repository') {
        threeDotsLabel.textContent = 'EXPLORE';
      } else if (targetViewId === 'view-landing' || targetViewId === 'landing-view') {
        threeDotsLabel.textContent = 'HOME';
      }
    }
  }

  // Ensure persistent right-side canvas container is hidden for Personalized Learning
  if (
    targetViewId === 'view-personalized-learning' ||
    targetViewId === 'personalized-learning' ||
    targetViewId === 'curriculum' ||
    targetViewId === 'view-academic-assistance' ||
    targetViewId === 'academic-assistance' ||
    targetViewId === 'assistant' ||
    targetViewId === 'view-landing' ||
    targetViewId === 'landing-view' ||
    targetViewId === 'view-isl-repository' ||
    targetViewId === 'view-realtime-comm' ||
    targetViewId === 'realtime-comm-view'
  ) {
    const cc = document.getElementById('canvas-container');
    if (cc) {
      cc.classList.add('hidden-canvas');
      cc.setAttribute('data-active-view', targetViewId);
    }
  }

  // 6. Trigger resize for Three.js camera/canvas
  window.dispatchEvent(new Event('resize'));
}

if (typeof window !== 'undefined') {
  window.activateView = activateView;
}

// -------------------------------------------------------
// MAIN EDU APP CLASS
// -------------------------------------------------------
class EduApp {
  constructor() {
    this.currentTab = null;
    this.selectedSubjectId = null;
    this.selectedChapterId = null;
    this.currentLessonId = null;
    this.assistantHistory = [];

    // Personalized ISL Learning System state
    this.learnerProfile = new LearnerProfile();
    this.learningEngine = new AdaptiveLearningEngine(this.learnerProfile);
    this.currentLessonItem = null;
    this.currentQuiz = null;
    this.selectedQuizAnswer = null;
    this.slMode = 'guided'; // 'guided' | 'library'
    this.slCategory = 'all';

    // Feature 1 & 2 Personalized Learning State
    this.plVideoMode = 'original'; // 'original' (audio on) | 'isl' (audio off, ISL primary)
    this.plTwoWayActive = false;
    this.plTwoWayMode = 'doubt'; // 'doubt' | 'quiz'
    this.plActiveQuizMatchedIndex = null;
    this.plLastDoubtResult = null;

    // Academic Assistance Two-Way Learning Assistant State
    this.assistantInputMode = 'type'; // 'type' | 'speak' | 'sign'
    this.assistantActiveConcept = null;
    this.assistantTtsActiveId = null;
    this.assistantVoiceActive = false;
    this.assistantIslActive = false;

    this.repoLevelFilter = 'all';
    this.repoStatusFilter = 'all';
    this.repoCategoryFilter = 'all';
    this.slSearchQuery = '';

    // Repository grid architecture state
    this.currentViewId = 'landing-view';
    this.repoCurrentPage = 1;
    this.repoPageSize = 24;
    this.repoSearchQuery = '';

    // Offline Multilingual Translation Service (IndicTrans2 + Indic NLP)
    this.translationService = new OfflineTranslationService();
    this.bhashiniService = this.translationService; // Backwards-compatible alias
    this.isSlMicActive = false;
    this.slMicStream = null;
    this.slSpeechRecognition = null;

    // Sign Learn 3D scene
    this.sl = {
      scene: null, camera: null, renderer: null, controls: null,
      character: null, fingerspeller: null, retargeter: null,
      signMatcher: signMatcher,
      bvhLoader: new BVHLoader(), bvhMixer: null, bvhRoot: null, bvhCache: new Map(),
      animFrame: null, loaded: false, loading: false, busy: false, letterTimeout: null,
      playbackSpeed: 1.0, currentSign: null, requestId: 0,
      sentenceTimeline: null, currentSentence: '', currentGlossSequence: []
    };

    this.init();
  }

  init() {
    this.setupHomeLanding();
    this.setupViewRouting();
    this.setupRepoFiltersAndSearch();
    this.interceptExistingButtons();
    this.bindEduNavButtons();
    this.setupCurriculumTab();
    this.setupAssistantTab();
    this.setupSignLearnTab();
    this.setupSpeechAndTextInput();

    // Initialize Learner Profile Telemetry in real time
    if (typeof learnerStore !== 'undefined') {
      learnerStore.updateProfileCardDOM();
    }

    // Cross-tab and window storage synchronization
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if ((e.key === 'signbridge_learner_profile_v2' || e.key === 'v2s_isl_personalized_profile_v2') && e.newValue) {
          try {
            this.learnerProfile.data = this.learnerProfile.loadProfile();
            if (typeof learnerStore !== 'undefined') {
              learnerStore.data = learnerStore.loadProfile();
              learnerStore.updateProfileCardDOM();
            }
            this.learningEngine.recalculateLevel();
            this.syncAllLearnerViews();
          } catch (err) {
            console.warn('[EduApp] Storage sync notification error:', err);
          }
        }
      });

      // Event-driven reactive update listener
      window.addEventListener('learnerProfileUpdated', (e) => {
        if (e.detail?.profile) {
          this.learnerProfile.data = e.detail.profile;
          this.renderHomeLearnerProfile();
          this.updatePerformanceHeaderUI();
        }
      });
    }
  }

  // Synchronize all views displaying learner progress across the entire application
  syncAllLearnerViews() {
    if (typeof learnerStore !== 'undefined') {
      learnerStore.updateProfileCardDOM();
    }
    this.renderHomeLearnerProfile();
    this.updatePerformanceHeaderUI();
    this.renderCategoryProgress();
    this.renderPracticeHistory();
    this.refreshLibraryGrid();
    this.renderRepositoryGrid();
  }


  // Setup Persistent View Routing and Resize Observers
  setupViewRouting() {
    window.switchView = (viewId, btn) => this.switchView(viewId, btn);
    window.activateView = activateView;

    // Primary Navbar Navigation Buttons (Mutually Exclusive Atomic Router)
    const btnHome = document.getElementById('btn-nav-home');
    btnHome?.addEventListener('click', () => this.switchView('view-landing', btnHome));

    const btnScreen = document.getElementById('btn-mode-screen');
    btnScreen?.addEventListener('click', () => this.switchView('view-realtime-comm', btnScreen));

    const btnStudio = document.getElementById('btn-mode-studio');
    btnStudio?.addEventListener('click', () => this.switchView('view-isl-repository', btnStudio));

    const btnCurriculum = document.getElementById('edu-btn-curriculum');
    btnCurriculum?.addEventListener('click', () => this.switchView('view-personalized-learning', btnCurriculum));

    const btnAssistant = document.getElementById('edu-btn-assistant');
    btnAssistant?.addEventListener('click', () => this.switchView('view-academic-assistance', btnAssistant));

    const btnSignLearn = document.getElementById('edu-btn-signlearn');
    btnSignLearn?.addEventListener('click', () => this.switchView('view-skill-dev', btnSignLearn));

    // --- SIMPLIFIED PORTAL EXPERIENCE INTERACTIONS ---
    // 1. Home 4 Primary User Goals
    document.getElementById('btn-goal-communicate')?.addEventListener('click', () => {
      this.switchView('view-realtime-comm');
    });
    document.getElementById('btn-goal-learn-isl')?.addEventListener('click', () => {
      this.switchView('view-skill-dev');
    });
    document.getElementById('btn-goal-explore-isl')?.addEventListener('click', () => {
      this.switchView('view-isl-repository');
    });
    document.getElementById('btn-goal-learn-subjects')?.addEventListener('click', () => {
      this.switchView('view-personalized-learning');
    });

    // 2. Returning Learner "Continue Learning" Action
    document.getElementById('btn-home-continue-learning')?.addEventListener('click', () => {
      const legacyBtn = document.getElementById('btn-continue-learning');
      if (legacyBtn) {
        legacyBtn.click();
      } else {
        this.switchView('view-personalized-learning');
      }
    });

    // 3. Quick Guide Help Modal
    const helpModal = document.getElementById('portal-help-modal');
    const openHelp = () => {
      if (helpModal) {
        helpModal.classList.remove('hidden');
        helpModal.style.display = 'flex';
      }
    };
    const closeHelp = () => {
      if (helpModal) {
        helpModal.classList.add('hidden');
        helpModal.style.display = 'none';
      }
    };
    document.getElementById('btn-portal-help')?.addEventListener('click', openHelp);
    document.getElementById('btn-close-help-modal')?.addEventListener('click', closeHelp);
    document.getElementById('btn-help-modal-done')?.addEventListener('click', closeHelp);
    helpModal?.addEventListener('click', (e) => {
      if (e.target === helpModal) closeHelp();
    });

    // 4. Real-Time Communication Quick Action Buttons
    document.getElementById('btn-rtc-quick-speak')?.addEventListener('click', () => {
      document.getElementById('btn-toggle-mic')?.click();
    });
    document.getElementById('btn-rtc-quick-capture')?.addEventListener('click', () => {
      document.getElementById('btn-start-capture')?.click();
    });

    // 5. Primary Navigation (6 Clear Primary Destinations)
    const btnNavHome = document.getElementById('btn-nav-home');
    btnNavHome?.addEventListener('click', (e) => {
      this.switchView('view-landing', e.currentTarget);
    });

    const btnNavComm = document.getElementById('btn-mode-screen');
    btnNavComm?.addEventListener('click', (e) => {
      this.switchView('view-realtime-comm', e.currentTarget);
    });

    const btnNavLearn = document.getElementById('btn-nav-learn');
    btnNavLearn?.addEventListener('click', (e) => {
      this.switchView('view-skill-dev', e.currentTarget);
    });

    const btnNavExploreTop = document.getElementById('btn-nav-explore-top');
    btnNavExploreTop?.addEventListener('click', (e) => {
      this.switchView('view-isl-repository', e.currentTarget);
    });

    const btnNavStudy = document.getElementById('btn-nav-study');
    btnNavStudy?.addEventListener('click', (e) => {
      this.switchView('view-personalized-learning', e.currentTarget);
    });

    // My Avatar Modal Controls
    const avatarModal = document.getElementById('portal-avatar-modal');
    const openAvatarModal = () => {
      if (avatarModal) {
        avatarModal.classList.remove('hidden');
        avatarModal.style.display = 'flex';
      }
    };
    const closeAvatarModal = () => {
      if (avatarModal) {
        avatarModal.classList.add('hidden');
        avatarModal.style.display = 'none';
      }
    };
    document.getElementById('btn-nav-avatar')?.addEventListener('click', openAvatarModal);
    document.getElementById('btn-close-avatar-modal')?.addEventListener('click', closeAvatarModal);
    document.getElementById('btn-avatar-modal-done')?.addEventListener('click', closeAvatarModal);
    document.getElementById('pam-btn-export')?.addEventListener('click', () => {
      closeAvatarModal();
      document.getElementById('btn-export-glb')?.click();
    });
    document.getElementById('pam-btn-recenter')?.addEventListener('click', () => {
      window.dispatchEvent(new Event('resize'));
    });
    document.querySelectorAll('#pam-speed-options .setting-chip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#pam-speed-options .setting-chip-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const speed = parseFloat(e.currentTarget.getAttribute('data-speed')) || 1.0;
        if (window.floatingSignerManager?.options?.onSpeedChange) {
          window.floatingSignerManager.options.onSpeedChange(speed);
        }
      });
    });

    // Secondary Context Bar Navigation Sub-Actions
    document.getElementById('btn-context-alphabets')?.addEventListener('click', () => {
      this.switchView('view-skill-dev');
      document.querySelector('.tab-btn[data-tab="level-1"]')?.click();
    });
    document.getElementById('btn-context-numbers')?.addEventListener('click', () => {
      this.switchView('view-skill-dev');
      document.querySelector('.tab-btn[data-tab="level-1"]')?.click();
    });
    document.getElementById('btn-study-videos')?.addEventListener('click', () => {
      document.getElementById('btn-open-yt-modal')?.click();
    });
    document.getElementById('btn-avatar-ctx-speed')?.addEventListener('click', openAvatarModal);
    document.getElementById('btn-avatar-ctx-recenter')?.addEventListener('click', () => {
      window.dispatchEvent(new Event('resize'));
    });

    // Breadcrumb Back Navigation
    document.getElementById('as-breadcrumb-back')?.addEventListener('click', () => {
      this.switchView('view-personalized-learning');
    });
    document.querySelectorAll('.breadcrumb-trail .crumb-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const route = e.currentTarget.getAttribute('data-route');
        if (route) this.switchView(route);
      });
    });

    // Top Utility Help button
    document.getElementById('btn-top-help')?.addEventListener('click', openHelp);

    const brandHome = document.getElementById('brand-home-link');
    brandHome?.addEventListener('click', () => {
      this.switchView('view-landing', document.getElementById('btn-nav-home'));
    });
    brandHome?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.switchView('view-landing', document.getElementById('btn-nav-home'));
      }
    });

    // 5b. Professional Header User Menu & Dropdown
    const userDropdown = document.getElementById('user-dropdown-menu');
    const btnTopSettings = document.getElementById('btn-top-settings');
    const btnUserAvatar = document.getElementById('btn-user-avatar');

    const toggleUserDropdown = (e) => {
      e?.stopPropagation();
      if (!userDropdown) return;
      const isShown = userDropdown.style.display === 'flex';
      userDropdown.style.display = isShown ? 'none' : 'flex';
      btnTopSettings?.setAttribute('aria-expanded', String(!isShown));
      btnUserAvatar?.setAttribute('aria-expanded', String(!isShown));
    };

    const closeUserDropdown = () => {
      if (userDropdown && userDropdown.style.display === 'flex') {
        userDropdown.style.display = 'none';
        btnTopSettings?.setAttribute('aria-expanded', 'false');
        btnUserAvatar?.setAttribute('aria-expanded', 'false');
      }
    };
    window.closeUserDropdown = closeUserDropdown;

    btnTopSettings?.addEventListener('click', toggleUserDropdown);
    btnUserAvatar?.addEventListener('click', toggleUserDropdown);

    document.addEventListener('click', (e) => {
      // Safe check for navThreeDotsMenu to prevent ReferenceError on click
      const threeDotsMenu = document.getElementById('nav-three-dots-menu');
      const btnThreeDots = document.getElementById('btn-nav-three-dots');
      
      if (threeDotsMenu && threeDotsMenu.style.display === 'flex') {
        if (!threeDotsMenu.contains(e.target) && (!btnThreeDots || !btnThreeDots.contains(e.target))) {
          if (typeof closeThreeDotsMenu === 'function') {
             closeThreeDotsMenu();
          } else {
             threeDotsMenu.style.display = 'none';
          }
        }
      }
      
      if (userDropdown && userDropdown.style.display === 'flex') {
        if (!userDropdown.contains(e.target) &&
            !btnTopSettings?.contains(e.target) &&
            !btnUserAvatar?.contains(e.target)) {
          closeUserDropdown();
        }
      }
    });

    document.getElementById('dropdown-item-settings')?.addEventListener('click', () => {
      closeUserDropdown();
      openSettings();
    });

    document.getElementById('dropdown-item-contrast')?.addEventListener('click', () => {
      closeUserDropdown();
      const isHighContrast = document.body.classList.toggle('high-contrast-mode');
      document.querySelectorAll('#setting-contrast-options .setting-chip-btn').forEach(b => {
        const mode = b.getAttribute('data-contrast');
        b.classList.toggle('active', isHighContrast ? mode === 'high' : mode === 'standard');
      });
    });

    let currentSpeedIdx = 1;
    const speedProgression = [0.5, 1.0, 1.5, 2.0];
    document.getElementById('dropdown-item-speed')?.addEventListener('click', () => {
      currentSpeedIdx = (currentSpeedIdx + 1) % speedProgression.length;
      const newSpeed = speedProgression[currentSpeedIdx];
      const speedText = document.querySelector('#dropdown-item-speed span:last-child');
      if (speedText) speedText.textContent = `Signer Speed (${newSpeed}x)`;
      if (window.floatingSignerManager?.options?.onSpeedChange) {
        window.floatingSignerManager.options.onSpeedChange(newSpeed);
      }
      document.querySelectorAll('#setting-speed-options .setting-chip-btn').forEach(b => {
        b.classList.toggle('active', parseFloat(b.getAttribute('data-speed')) === newSpeed);
      });
    });

    document.getElementById('dropdown-item-help')?.addEventListener('click', () => {
      closeUserDropdown();
      openHelp();
    });

    // 6. Platform Settings & Accessibility Modal
    const settingsModal = document.getElementById('portal-settings-modal');
    const openSettings = () => {
      if (settingsModal) {
        settingsModal.classList.remove('hidden');
        settingsModal.style.display = 'flex';
      }
    };
    const closeSettings = () => {
      if (settingsModal) {
        settingsModal.classList.add('hidden');
        settingsModal.style.display = 'none';
      }
    };
    document.getElementById('btn-nav-settings')?.addEventListener('click', openSettings);
    document.getElementById('drawer-nav-settings')?.addEventListener('click', () => {
      closeDrawer();
      openSettings();
    });
    document.getElementById('btn-close-settings-modal')?.addEventListener('click', closeSettings);
    document.getElementById('btn-settings-modal-done')?.addEventListener('click', closeSettings);
    settingsModal?.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettings();
    });

    // Settings Speed Chips
    document.querySelectorAll('#setting-speed-options .setting-chip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#setting-speed-options .setting-chip-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const speed = parseFloat(e.currentTarget.getAttribute('data-speed')) || 1.0;
        if (window.floatingSignerManager?.options?.onSpeedChange) {
          window.floatingSignerManager.options.onSpeedChange(speed);
        }
      });
    });

    // Settings Text Size Chips
    document.querySelectorAll('#setting-textsize-options .setting-chip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#setting-textsize-options .setting-chip-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const size = e.currentTarget.getAttribute('data-size');
        document.body.classList.remove('text-scale-large', 'text-scale-xlarge');
        if (size === 'large') document.body.classList.add('text-scale-large');
        if (size === 'xlarge') document.body.classList.add('text-scale-xlarge');
      });
    });

    // Settings Contrast Chips
    document.querySelectorAll('#setting-contrast-options .setting-chip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#setting-contrast-options .setting-chip-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const contrast = e.currentTarget.getAttribute('data-contrast');
        if (contrast === 'high') {
          document.body.classList.add('high-contrast-mode');
        } else {
          document.body.classList.remove('high-contrast-mode');
        }
      });
    });

    // 7. Mobile & Secondary Drawer Navigation
    const mobileDrawer = document.getElementById('portal-mobile-drawer');
    const hamburgerBtn = document.getElementById('btn-hamburger-menu');
    const openDrawer = () => {
      if (mobileDrawer) {
        mobileDrawer.classList.remove('hidden');
        mobileDrawer.style.display = 'flex';
        hamburgerBtn?.setAttribute('aria-expanded', 'true');
      }
    };
    const closeDrawer = () => {
      if (mobileDrawer) {
        mobileDrawer.classList.add('hidden');
        mobileDrawer.style.display = 'none';
        hamburgerBtn?.setAttribute('aria-expanded', 'false');
      }
    };
    hamburgerBtn?.addEventListener('click', () => {
      const isHidden = mobileDrawer?.style.display === 'none' || mobileDrawer?.classList.contains('hidden');
      if (isHidden) openDrawer(); else closeDrawer();
    });
    document.getElementById('btn-close-drawer')?.addEventListener('click', closeDrawer);
    document.getElementById('drawer-backdrop')?.addEventListener('click', closeDrawer);

    // Drawer destination routing
    document.getElementById('drawer-nav-communicate')?.addEventListener('click', () => {
      closeDrawer();
      this.switchView('view-realtime-comm');
    });
    document.getElementById('drawer-nav-learn')?.addEventListener('click', () => {
      closeDrawer();
      this.switchView('view-skill-dev');
    });
    document.getElementById('drawer-nav-explore')?.addEventListener('click', () => {
      closeDrawer();
      this.switchView('view-isl-repository');
    });
    document.getElementById('drawer-nav-home')?.addEventListener('click', () => {
      closeDrawer();
      this.switchView('view-landing');
    });
    document.getElementById('drawer-act-speak')?.addEventListener('click', () => {
      closeDrawer();
      this.switchView('view-realtime-comm');
      document.getElementById('btn-toggle-mic')?.click();
    });
    document.getElementById('drawer-act-capture')?.addEventListener('click', () => {
      closeDrawer();
      this.switchView('view-realtime-comm');
      document.getElementById('btn-start-capture')?.click();
    });
    document.getElementById('drawer-act-twoway')?.addEventListener('click', () => {
      closeDrawer();
      this.switchView('view-realtime-comm');
      document.getElementById('btn-rtc-submode-twoway')?.click();
    });
    document.getElementById('drawer-act-export')?.addEventListener('click', () => {
      closeDrawer();
      document.getElementById('btn-export-glb')?.click();
    });
    document.getElementById('drawer-nav-help')?.addEventListener('click', () => {
      closeDrawer();
      openHelp();
    });

    // 8. Secondary Context Bar Actions
    document.getElementById('btn-context-twoway')?.addEventListener('click', () => {
      this.switchView('view-realtime-comm');
      document.getElementById('btn-rtc-submode-twoway')?.click();
    });
    document.getElementById('btn-quick-switch-explore')?.addEventListener('click', () => {
      this.switchView('view-isl-repository');
    });
    document.getElementById('btn-status-help')?.addEventListener('click', openHelp);

    // 9. Accessible Keyboard Navigation (Left/Right Arrows on Primary Nav, Esc to close modals)
    const primaryNavItems = Array.from(document.querySelectorAll('.portal-primary-nav-items .primary-nav-btn'));
    primaryNavItems.forEach((btn, idx) => {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIdx = (idx + 1) % primaryNavItems.length;
          primaryNavItems[nextIdx]?.focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevIdx = (idx - 1 + primaryNavItems.length) % primaryNavItems.length;
          primaryNavItems[prevIdx]?.focus();
        }
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeUserDropdown();
        closeDrawer();
        closeSettings();
        closeHelp();
        closeAvatarModal();
      }
    });

    // Practice button in persistent side-panel
    document.getElementById('edu-sl-practice-sign-btn')?.addEventListener('click', () => {
      const current = this.sl.currentSign;
      if (current) {
        learningLoopController.open(current);
      } else if (islKnowledgeRepository.items.length > 0) {
        learningLoopController.open(islKnowledgeRepository.items[0]);
      }
    });

    // ResizeObserver on persistent canvas container
    window.addEventListener('resize', () => this.resizePersistentCanvas());
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer && window.ResizeObserver) {
      new ResizeObserver(() => this.resizePersistentCanvas()).observe(canvasContainer);
    }
  }

  // Mutually Exclusive Tab Navigation Router
  switchView(targetKey, explicitNavBtn = null) {
    const VIEW_MAP = {
      // Home
      'home': { viewId: 'view-landing', btnId: 'btn-nav-home' },
      'landing': { viewId: 'view-landing', btnId: 'btn-nav-home' },
      'view-landing': { viewId: 'view-landing', btnId: 'btn-nav-home' },
      'landing-view': { viewId: 'view-landing', btnId: 'btn-nav-home' },

      // ISL Knowledge Repository
      'repository': { viewId: 'view-isl-repository', btnId: 'btn-mode-studio' },
      'repo': { viewId: 'view-isl-repository', btnId: 'btn-mode-studio' },
      'studio': { viewId: 'view-isl-repository', btnId: 'btn-mode-studio' },
      'view-repository': { viewId: 'view-isl-repository', btnId: 'btn-mode-studio' },
      'view-isl-repository': { viewId: 'view-isl-repository', btnId: 'btn-mode-studio' },
      'repository-view': { viewId: 'view-isl-repository', btnId: 'btn-mode-studio' },

      // Personalized Learning
      'personalized-learning': { viewId: 'view-personalized-learning', btnId: 'edu-btn-curriculum' },
      'curriculum': { viewId: 'view-personalized-learning', btnId: 'edu-btn-curriculum' },
      'view-personalized-learning': { viewId: 'view-personalized-learning', btnId: 'edu-btn-curriculum' },

      // Real-Time Communication
      'realtime-comm': { viewId: 'view-realtime-comm', btnId: 'btn-mode-screen' },
      'screen': { viewId: 'view-realtime-comm', btnId: 'btn-mode-screen' },
      'comm': { viewId: 'view-realtime-comm', btnId: 'btn-mode-screen' },
      'view-realtime-comm': { viewId: 'view-realtime-comm', btnId: 'btn-mode-screen' },
      'realtime-comm-view': { viewId: 'view-realtime-comm', btnId: 'btn-mode-screen' },

      // ISL Skill Development
      'skill-dev': { viewId: 'view-skill-dev', btnId: 'edu-btn-signlearn' },
      'signlearn': { viewId: 'view-skill-dev', btnId: 'edu-btn-signlearn' },
      'practice': { viewId: 'view-skill-dev', btnId: 'edu-btn-signlearn' },
      'view-skill-dev': { viewId: 'view-skill-dev', btnId: 'edu-btn-signlearn' },
      'skill-dev-view': { viewId: 'view-skill-dev', btnId: 'edu-btn-signlearn' },

      // Academic Assistance
      'academic-assistance': { viewId: 'view-academic-assistance', btnId: 'edu-btn-assistant' },
      'assistant': { viewId: 'view-academic-assistance', btnId: 'edu-btn-assistant' },
      'view-academic-assistance': { viewId: 'view-academic-assistance', btnId: 'edu-btn-assistant' },

      // Learn & Study (Unified)
      'study': { viewId: 'view-personalized-learning', btnId: 'btn-nav-study' },
      'learn-study': { viewId: 'view-personalized-learning', btnId: 'btn-nav-study' },
      'view-study': { viewId: 'view-personalized-learning', btnId: 'btn-nav-study' }
    };

    const mapping = VIEW_MAP[targetKey] || { viewId: targetKey, btnId: null };
    let targetViewId = mapping.viewId;
    if (targetViewId === 'view-repository' && !document.getElementById('view-repository')) {
      targetViewId = 'view-isl-repository';
    }
    const targetNavBtn = explicitNavBtn || (mapping.btnId ? document.getElementById(mapping.btnId) : null);

    // Call authoritative fail-safe activator
    activateView(targetViewId, targetNavBtn);

    // Maintain class-based active state for backward-compatibility
    document.querySelectorAll('.app-view-container, .view-panel').forEach(panel => {
      panel.classList.remove('active-view', 'active');
    });
    const targetPanel = document.getElementById(targetViewId);
    if (targetPanel) {
      targetPanel.classList.add('active-view', 'active');
    }

    // Inner stage activation & 3D Avatar Mode Sync
    if (targetViewId === 'view-personalized-learning') {
      window.setMode?.('curriculum');
      const canvasMount = document.getElementById('edu-curriculum-canvas');
      if (canvasMount && window.mountCurriculumSigner) {
        window.mountCurriculumSigner(canvasMount);
      }
      this.renderPersonalizedLearning?.();
    } else if (targetViewId === 'view-academic-assistance') {
      window.setMode?.('curriculum');
      const assistantCanvasMount = document.getElementById('edu-assistant-avatar-canvas');
      if (assistantCanvasMount && window.mountCurriculumSigner) {
        window.mountCurriculumSigner(assistantCanvasMount);
      }
      this.updateAssistantSyllabusHeader();
    } else if (targetViewId === 'view-skill-dev') {
      window.setMode?.('signlearn');
    } else if (targetViewId === 'view-realtime-comm') {
      document.getElementById('screen-stage')?.classList.add('active');
      window.setMode?.('screen');
    } else if (targetViewId === 'view-isl-repository') {
      document.getElementById('studio-stage')?.classList.add('active');
      window.setMode?.('studio');
      this.renderRepositoryGrid();
    } else if (targetViewId === 'view-landing') {
      window.setMode?.('home');
    }

    this.currentViewId = targetViewId;
    this.currentTab = targetKey;

    // Detach video player or stop active animation if leaving active 3D avatar views
    if (targetViewId !== 'view-personalized-learning' && targetViewId !== 'view-academic-assistance') {
      if (window.signSyncController) {
        window.signSyncController.detachPlayer();
        window.signSyncController.stopActiveAnimation();
      }
      window.unmountCurriculumSigner?.();
    }

    // Manage Persistent Canvas layer (Hidden for Landing, ISL Repository, Real-Time Communication, Personalized Learning, and Academic Assistance)
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      canvasContainer.setAttribute('data-active-view', targetViewId);
      if (
        targetViewId === 'view-landing' ||
        targetViewId === 'landing-view' ||
        targetViewId === 'view-isl-repository' ||
        targetViewId === 'view-realtime-comm' ||
        targetViewId === 'realtime-comm-view' ||
        targetViewId === 'view-personalized-learning' ||
        targetViewId === 'personalized-learning' ||
        targetViewId === 'curriculum' ||
        targetViewId === 'view-academic-assistance' ||
        targetViewId === 'academic-assistance' ||
        targetViewId === 'assistant'
      ) {
        canvasContainer.classList.add('hidden-canvas');
      } else {
        canvasContainer.classList.remove('hidden-canvas');
      }
    }

    // Mini 3D Signer visibility: only in Real-Time Communication
    if (targetViewId === 'view-realtime-comm' || targetViewId === 'realtime-comm-view') {
      window.showCornerWidget?.();
    } else {
      window.hideCornerWidget?.();
    }

    // Ensure 3D scene loop is running
    if (!this.sl.loaded && !this.sl.loading) {
      this.initSignLearnScene();
    } else if (this.sl.loaded) {
      this.startSignLearnLoop();
    }

    // View-specific data rendering
    if (targetViewId === 'view-isl-repository' || targetViewId === 'view-repository' || targetViewId === 'repository-view') {
      this.renderRepositoryGrid();
    } else if (targetViewId === 'view-skill-dev' || targetViewId === 'skill-dev-view') {
      this.updatePerformanceHeaderUI();
      this.renderCategoryProgress();
      this.renderPracticeHistory();
      if (!this.currentLessonItem) {
        const rec = this.learnerProfile.getRecommendation(islKnowledgeRepository);
        if (rec && rec.targetItem) {
          this.presentTeachingSign(rec.targetItem, rec.isGap);
        } else {
          this.startGuidedLesson();
        }
      }
    } else if (targetViewId === 'view-landing' || targetViewId === 'landing-view') {
      this.renderHomeLearnerProfile();
    }

    this.resizePersistentCanvas();
    window.dispatchEvent(new Event('resize'));
  }

  resizePersistentCanvas() {
    const container = document.getElementById('edu-signlearn-canvas') || document.getElementById('canvas-container');
    if (!container || !this.sl.renderer || !this.sl.camera) return;
    const rect = container.getBoundingClientRect();
    const w = container.clientWidth || Math.round(rect.width);
    const h = container.clientHeight || Math.round(rect.height);
    if (w > 20 && h > 20) {
      const aspect = w / h;
      this.sl.camera.aspect = aspect;
      if (aspect < 0.85) {
        const factor = 0.85 / Math.max(0.45, aspect);
        this.sl.camera.position.set(-0.08, 1.36, 1.38 * factor);
      } else {
        this.sl.camera.position.set(-0.08, 1.36, 1.38);
      }
      this.sl.camera.updateProjectionMatrix();
      this.sl.renderer.setSize(w, h, false);
    }
  }

  interceptExistingButtons() {
    // Intercepted and routed directly by setupViewRouting
  }

  bindEduNavButtons() {
    // Intercepted and routed directly by setupViewRouting
  }

  hideAllEduStages() {
    if (window.signSyncController) {
      window.signSyncController.detachPlayer();
      window.signSyncController.stopActiveAnimation();
    }
    window.unmountCurriculumSigner?.();

    // Stop Sign Learn secondary render loop immediately
    if (this.sl.animFrame) {
      cancelAnimationFrame(this.sl.animFrame);
      this.sl.animFrame = null;
    }

    ['edu-stage-curriculum', 'edu-stage-assistant', 'edu-stage-signlearn'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
    ['edu-btn-curriculum', 'edu-btn-assistant', 'edu-btn-signlearn'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
    this.currentTab = null;
  }

  switchTab(tab) {
    this.switchView(tab);
  }

  // -------------------------------------------------------
  // HOME LANDING & LEARNER PROFILE MANAGEMENT
  // -------------------------------------------------------
  setupHomeLanding() {
    // Initialize the authentic 2,501 sign repository
    islKnowledgeRepository.init().then(() => {
      this.renderHomeLearnerProfile();
    });

    // Learner Name Editing
    const editBtn = document.getElementById('home-btn-edit-name');
    const editWrap = document.getElementById('home-name-edit-wrap');
    const nameInput = document.getElementById('home-input-name');
    const saveBtn = document.getElementById('home-btn-save-name');
    const cancelBtn = document.getElementById('home-btn-cancel-name');

    const nameRow = document.querySelector('.profile-name-row');

    editBtn?.addEventListener('click', () => {
      if (editWrap) {
        editWrap.classList.remove('hidden');
        if (nameRow) nameRow.classList.add('hidden');
        if (nameInput) {
          nameInput.value = this.learnerProfile.data.learnerName || 'Learner';
          nameInput.focus();
        }
      }
    });

    const commitName = () => {
      if (nameInput && nameInput.value.trim()) {
        this.learnerProfile.setLearnerName(nameInput.value.trim());
        editWrap?.classList.add('hidden');
        if (nameRow) nameRow.classList.remove('hidden');
        this.syncAllLearnerViews();
      }
    };

    saveBtn?.addEventListener('click', commitName);
    nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitName();
      if (e.key === 'Escape') {
        editWrap?.classList.add('hidden');
        if (nameRow) nameRow.classList.remove('hidden');
      }
    });
    cancelBtn?.addEventListener('click', () => {
      editWrap?.classList.add('hidden');
      if (nameRow) nameRow.classList.remove('hidden');
    });

    // Continue Learning Action from Persistent Learner Profile Card & Home
    const continueLearningHandler = () => {
      const rec = this.learnerProfile.getRecommendation(islKnowledgeRepository);
      this.switchView('view-skill-dev');
      if (rec && rec.targetItem) {
        this.presentTeachingSign(rec.targetItem, rec.isGap);
        this.setPhase('learn');
      } else {
        this.startGuidedLesson();
      }
    };
    document.getElementById('btn-continue-learning')?.addEventListener('click', continueLearningHandler);
    document.getElementById('home-btn-continue-learning')?.addEventListener('click', continueLearningHandler);

    // Profile Name Direct Editing from Learner Profile Card
    document.getElementById('profile-name')?.addEventListener('click', () => {
      const current = this.learnerProfile.data.learnerName || 'Learner';
      const updated = prompt('Enter your learner profile name:', current);
      if (updated && updated.trim()) {
        this.learnerProfile.setLearnerName(updated.trim());
        this.syncAllLearnerViews();
      }
    });

    // Primary Entry Grid Data-Route Navigation
    document.querySelectorAll('.landing-entry-grid .entry-card, [data-route]').forEach(card => {
      card.addEventListener('click', () => {
        const route = card.getAttribute('data-route');
        if (route) {
          this.switchView(route);
          if (route === 'skill-dev' || route === 'view-skill-dev') {
            this.startGuidedLesson();
          }
        }
      });
    });

    // Three Primary Entry Card Actions on Home
    // 1. Communication Access (Directs to Real-Time Communication)
    document.getElementById('home-action-screen')?.addEventListener('click', () => {
      this.switchView('view-realtime-comm');
    });

    document.getElementById('home-action-yt')?.addEventListener('click', () => {
      this.switchView('view-realtime-comm');
      document.getElementById('btn-open-yt-modal')?.click();
    });

    // 2. Personalized Learning (Directs to Academic Lessons & Video Support)
    document.getElementById('home-action-curriculum')?.addEventListener('click', () => {
      this.switchView('view-personalized-learning');
    });

    document.getElementById('home-action-assistant')?.addEventListener('click', () => {
      this.switchView('view-academic-assistance');
    });

    // 3. ISL Skill Development (Directs to Learn & Practice Sign Language)
    document.getElementById('home-action-learn')?.addEventListener('click', () => {
      this.switchView('view-skill-dev');
      this.startGuidedLesson();
    });

    document.getElementById('home-action-repo')?.addEventListener('click', () => {
      this.switchView('view-isl-repository');
    });
    document.getElementById('home-action-studio')?.addEventListener('click', () => {
      this.switchView('view-isl-repository');
    });

    document.getElementById('home-action-gaps')?.addEventListener('click', () => {
      this.switchView('view-skill-dev');
      const gaps = this.learnerProfile.getLearningGaps();
      if (gaps.length > 0) {
        this.startReviewQuiz();
      } else {
        this.startGuidedLesson();
      }
    });

    // Brand Home Link (return to landing page from anywhere)
    document.getElementById('brand-home-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('view-landing');
    });

    // All "Enter Portal" Primary Call-to-Actions (Opens existing portal at Real-Time Communication)
    document.querySelectorAll('.btn-enter-portal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView('view-realtime-comm');
      });
    });

    // Landing Page Capabilities, Split-Pillar & Footer Navigation Buttons
    document.querySelectorAll('.capability-launch-btn, .split-cta-btn, .portal-jump-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.getAttribute('data-target');
        if (target) {
          this.switchView(target);
          if (target === 'view-skill-dev') {
            this.startGuidedLesson?.();
          }
        }
      });
    });

    // Quick Sign Preview Motion Chips (Hero Section)
    document.querySelectorAll('.quick-sign-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const phrase = chip.getAttribute('data-phrase');
        this.switchView('view-isl-repository');
        if (phrase) {
          const searchInput = document.getElementById('repo-search-input');
          if (searchInput) {
            searchInput.value = phrase;
            searchInput.dispatchEvent(new Event('input'));
          }
          if (typeof window.playLibrarySentence === 'function') {
            window.playLibrarySentence(phrase);
          }
        }
      });
    });

    // Back to Top Button
    document.getElementById('btn-landing-back-to-top')?.addEventListener('click', () => {
      const scrollContainer = document.getElementById('view-landing');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    // Smooth In-Page Anchor Scrolling for Landing Navbar & Links
    document.querySelectorAll('#landing-navbar-content a[href^="#"], .hero-btn[href^="#"], .landing-footer a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#') && href.length > 1) {
          const targetEl = document.getElementById(href.slice(1));
          const scrollContainer = document.getElementById('view-landing');
          if (targetEl && scrollContainer) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    // IntersectionObserver for Scroll-Triggered Reveal Animations
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      }, {
        threshold: 0.08,
        rootMargin: '0px 0px -30px 0px'
      });

      document.querySelectorAll('.reveal-on-scroll').forEach(el => revealObserver.observe(el));
    } else {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-visible'));
    }

    // ── NEW: lp-reveal observer (new landing page classes) ──
    const landingScrollEl = document.getElementById('view-landing');

    if (typeof window !== 'undefined' && 'IntersectionObserver' in window && landingScrollEl) {
      const lpRevealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-revealed');
            lpRevealObserver.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.08,
        rootMargin: '0px 0px -20px 0px',
        root: landingScrollEl
      });
      document.querySelectorAll('.lp-reveal').forEach(el => lpRevealObserver.observe(el));
    } else {
      document.querySelectorAll('.lp-reveal').forEach(el => el.classList.add('lp-revealed'));
    }

    // ── NEW: Scroll progress bar ──
    const lpProgress = document.getElementById('lp-scroll-progress');
    if (lpProgress && landingScrollEl) {
      landingScrollEl.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = landingScrollEl;
        const pct = scrollHeight <= clientHeight ? 0 : (scrollTop / (scrollHeight - clientHeight)) * 100;
        lpProgress.style.width = pct + '%';
      }, { passive: true });
    }

    // ── NEW: Smooth scroll for .lp-scroll-to anchor links ──
    document.querySelectorAll('.lp-scroll-to[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#') && href.length > 1) {
          const targetEl = document.querySelector(href) || document.getElementById(href.slice(1));
          const scrollContainer = document.getElementById('view-landing');
          if (targetEl && scrollContainer) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    // ── NEW: Particle canvas animation (hero section) ──
    this._initLandingParticles();

    // Initial render
    this.renderHomeLearnerProfile();
  }

  _initLandingParticles() {
    const canvas = document.getElementById('lp-particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = null;
    const particles = [];
    const COUNT = 60;

    const resize = () => {
      canvas.width = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 1280;
      canvas.height = canvas.offsetHeight || canvas.parentElement?.offsetHeight || 720;
    };
    resize();

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.5 + 0.1
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${p.alpha})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.07 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    // Stop animation when landing page is hidden (performance)
    const observer = new MutationObserver(() => {
      const landing = document.getElementById('view-landing');
      if (landing && landing.style.display === 'none' && animId) {
        cancelAnimationFrame(animId);
        animId = null;
      } else if (landing && landing.style.display !== 'none' && !animId) {
        draw();
      }
    });
    const landing = document.getElementById('view-landing');
    if (landing) observer.observe(landing, { attributes: true, attributeFilter: ['style'] });

    window.addEventListener('resize', resize, { passive: true });
  }


  renderHomeLearnerProfile() {
    const p = this.learnerProfile.data;

    // 1. Learner Name (Sync both widgets)
    const nameEl = document.getElementById('home-learner-name');
    if (nameEl) nameEl.textContent = p.learnerName || 'Learner';
    const profNameEl = document.getElementById('profile-name');
    if (profNameEl) profNameEl.textContent = p.learnerName || 'Learner';

    // 2. Current Proficiency Level Badge (Sync both widgets)
    const levelBadge = document.getElementById('home-level-badge');
    const levelText = document.getElementById('home-level-text');
    const currentLevel = (p.currentLevel || 'beginner').toLowerCase();

    if (levelBadge && levelText) {
      levelText.textContent = currentLevel.toUpperCase();
      levelBadge.className = `home-level-badge level-${currentLevel}`;
    }

    const profBadge = document.getElementById('profile-proficiency-badge');
    if (profBadge) {
      profBadge.textContent = currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);
      profBadge.className = `badge-${currentLevel}`;
    }

    // 3. Visual Progression Steps (Beginner → Intermediate → Advanced)
    const stepBeginner = document.getElementById('home-tier-step-beginner');
    const stepIntermediate = document.getElementById('home-tier-step-intermediate');
    const stepAdvanced = document.getElementById('home-tier-step-advanced');

    [stepBeginner, stepIntermediate, stepAdvanced].forEach(s => s?.classList.remove('current', 'completed'));

    if (currentLevel === 'beginner') {
      stepBeginner?.classList.add('current');
    } else if (currentLevel === 'intermediate') {
      stepBeginner?.classList.add('completed');
      stepIntermediate?.classList.add('current');
    } else if (currentLevel === 'advanced') {
      stepBeginner?.classList.add('completed');
      stepIntermediate?.classList.add('completed');
      stepAdvanced?.classList.add('current');
    }

    // 4. Progress Percentage, Bar Fill & Dynamic Progress Ring
    const percentEl = document.getElementById('home-progress-percent');
    const barEl = document.getElementById('home-progress-bar');
    const ringCircle = document.getElementById('home-progress-ring-circle');
    const ringLabel = document.getElementById('home-ring-percent');
    const metricProgressEl = document.getElementById('metric-progress-percent');
    const progress = Math.min(100, Math.max(0, p.levelProgress || 0));

    if (percentEl) percentEl.textContent = `${progress}%`;
    if (metricProgressEl) metricProgressEl.textContent = `${progress}%`;
    if (barEl) barEl.style.width = `${progress}%`;

    // Dynamic SVG Circular Progress Ring (r = 23, circumference = 2 * PI * 23 ≈ 144.51)
    if (ringCircle) {
      const circumference = 144.51;
      const offset = circumference - (progress / 100) * circumference;
      ringCircle.style.strokeDashoffset = `${offset}`;
    }
    if (ringLabel) ringLabel.textContent = `${progress}%`;

    // 5. Core Metrics (Accurate, non-fabricated telemetry)
    const learnedEl = document.getElementById('home-stat-learned');
    const inProgressEl = document.getElementById('home-stat-inprogress');
    const totalEl = document.getElementById('home-stat-total');
    const accEl = document.getElementById('home-stat-accuracy');
    const attemptsEl = document.getElementById('home-stat-attempts');
    const streakEl = document.getElementById('home-stat-streak');
    const bestStreakEl = document.getElementById('home-stat-best-streak');
    const reviewEl = document.getElementById('home-stat-review');
    const catMasteryEl = document.getElementById('home-stat-cat-mastery');

    const learnedCount = this.learnerProfile.getSignsLearnedCount();
    const inProgressCount = this.learnerProfile.getSignsInProgressCount();
    const totalCount = 2501;
    const masteredCategoriesCount = this.learnerProfile.getMasteredCategories().length;
    const totalCatsCount = Object.keys(this.learnerProfile.data.categoryStats || {}).length || 10;
    const reviewQueueLength = (p.reviewQueue || []).length;

    const metricSignsLearnedEl = document.getElementById('metric-signs-learned');
    if (metricSignsLearnedEl) metricSignsLearnedEl.textContent = learnedCount;

    const metricAccuracyEl = document.getElementById('metric-accuracy');
    if (metricAccuracyEl) {
      metricAccuracyEl.textContent = (p.totalAttempts > 0) ? `${p.accuracyRate || 0}%` : '0%';
    }

    if (learnedEl) learnedEl.textContent = learnedCount;
    if (inProgressEl) inProgressEl.textContent = inProgressCount;
    if (totalEl) totalEl.textContent = `/ ${totalCount.toLocaleString()}`;
    if (accEl) {
      accEl.textContent = (p.totalAttempts > 0) ? `${p.accuracyRate || 0}%` : '--';
    }
    if (attemptsEl) attemptsEl.textContent = p.totalAttempts || 0;
    if (streakEl) streakEl.textContent = p.currentStreak || 0;
    if (bestStreakEl) bestStreakEl.textContent = p.bestStreak || 0;
    if (reviewEl) reviewEl.textContent = reviewQueueLength;
    if (catMasteryEl) catMasteryEl.textContent = `${masteredCategoriesCount} / ${totalCatsCount}`;

    // Toggle Returning Learner Experience Card if genuine learning activity exists
    const returningCard = document.getElementById('home-returning-learner-card');
    if (returningCard) {
      if (learnedCount > 0 || (p.totalAttempts && p.totalAttempts > 0) || reviewQueueLength > 0) {
        returningCard.classList.remove('hidden');
        returningCard.style.display = 'block';
      } else {
        returningCard.classList.add('hidden');
        returningCard.style.display = 'none';
      }
    }

    // 6. Recommendation Area
    const rec = this.learnerProfile.getRecommendation(islKnowledgeRepository);
    const recAreaEl = document.getElementById('home-rec-area');
    const recRationaleEl = document.getElementById('home-rec-rationale');
    const recStatusEl = document.getElementById('home-rec-status-tag');
    const ctaTextEl = document.getElementById('home-btn-cta-text');
    const profRecTopicEl = document.getElementById('profile-recommended-topic');

    if (profRecTopicEl) {
      profRecTopicEl.textContent = rec.areaTitle || 'Foundational Greetings';
    }
    if (recAreaEl) recAreaEl.textContent = rec.areaTitle;
    if (recRationaleEl) recRationaleEl.textContent = rec.rationale;
    if (recStatusEl) {
      recStatusEl.textContent = rec.badge;
      recStatusEl.className = `rec-status-chip ${rec.chipClass || 'rec-chip-recommended'}`;
    }
    if (ctaTextEl && rec.state?.actionText) {
      ctaTextEl.textContent = rec.state.actionText;
    }

    // 7. Multi-State Recommendation Pathway Cards
    const trayEl = document.getElementById('home-rec-cards-tray');
    if (trayEl) {
      trayEl.innerHTML = '';
      const multiRecs = this.learnerProfile.getMultiRecommendations(islKnowledgeRepository, 4);
      multiRecs.forEach(itemRec => {
        const sign = itemRec.targetItem;
        if (!sign) return;
        const card = document.createElement('div');
        const cardClass = itemRec.stateId === 'review_weak_signs' ? 'card-weak'
          : itemRec.stateId === 'practice_again' ? 'card-practice'
          : itemRec.stateId === 'continue_learning' ? 'card-continue'
          : itemRec.stateId === 'next_level_preparation' ? 'card-nextlevel'
          : 'card-recommended';

        const catMeta = REPOSITORY_CATEGORIES[sign.category] || { label: sign.category || 'General', icon: '💬' };
        const levelStr = (sign.proficiencyLevel || 'beginner').toUpperCase();

        card.className = `home-rec-card ${cardClass}`;
        card.innerHTML = `
          <div class="home-rec-card-top">
            <span class="rec-status-chip ${itemRec.chipClass || 'rec-chip-recommended'}">${itemRec.badge}</span>
            <span class="repo-level-tag level-${(sign.proficiencyLevel || 'beginner').toLowerCase()}">${levelStr}</span>
          </div>
          <div class="home-rec-card-title">${sign.sentence || sign.word}</div>
          <div class="home-rec-card-meta-row">
            <span class="card-category-tag">${catMeta.icon} ${catMeta.label}</span>
            <span class="card-gloss-pill">${sign.gloss || ''}</span>
          </div>
          <div class="home-rec-card-rationale">${itemRec.rationale}</div>
          <button class="home-rec-card-action-btn" data-sign-id="${sign.id}">
            <span>${itemRec.state?.actionText || 'Practice Sign'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </button>
        `;

        card.querySelector('.home-rec-card-action-btn')?.addEventListener('click', () => {
          this.switchTab('signlearn');
          this.presentTeachingSign(sign, itemRec.isGap);
          this.setPhase('learn');
        });

        trayEl.appendChild(card);
      });
    }
  }

  // -------------------------------------------------------
  // PERSONALIZED LEARNING TAB (OFFLINE ADAPTIVE DIGITAL SCHOOL)
  // -------------------------------------------------------
  setupCurriculumTab() {
    this.initPersonalizedLearning();
  }

  initPersonalizedLearning() {
    this.plEngine = new PersonalizedLearningEngine(this.learnerProfile);
    window.personalizedLearningEngine = this.plEngine;
    this.plActiveConcept = null;
    this.plActiveStep = 'introduce';
    this.plSelectedSubjectId = null;
    this.plSelectedOnboardBundleId = 'tn-state-10-2026';
    this.plDiagnosticResponses = {};

    // Ensure default curriculum bundle if none set
    if (!this.plEngine.getActiveCurriculum()) {
      this.plEngine.setActiveCurriculum('tn-state-10-2026');
    }

    // ONBOARDING FLOW HANDLERS
    this.setupPlOnboardingHandlers();

    // DIGITAL SCHOOL & BUNDLE MANAGER HANDLERS
    this.setupPlPlatformHandlers();

    // CLASSROOM STUDIO 7-STAGE HANDLERS
    this.setupPlStudioHandlers();

    // MODAL HANDLERS
    this.setupPlModalHandlers();

    // Real-Time Sign HUD Listener
    if (!this._plSignListenerBound) {
      this._plSignListenerBound = true;
      window.addEventListener('signbridge-sign-update', (e) => {
        const detail = e.detail;
        if (!detail) return;
        const glossEl = document.getElementById('pl-hud-active-gloss');
        const phraseEl = document.getElementById('pl-hud-active-phrase');
        const statusEl = document.getElementById('pl-avatar-status-label');
        const noticeEl = document.getElementById('pl-hud-unavailable-notice');

        if (glossEl) glossEl.textContent = detail.gloss || detail.label || 'STANDBY';
        if (phraseEl) phraseEl.textContent = detail.label ? `Signing: "${detail.label}"` : 'Select any key concept term to observe 3D sign';
        if (statusEl) statusEl.textContent = detail.status === 'SIGNING' ? '3D ISL Signer Active' : '3D ISL Signer Ready';
        if (noticeEl) {
          if (detail.unavailable) {
            noticeEl.classList.remove('hidden');
          } else {
            noticeEl.classList.add('hidden');
          }
        }
      });
    }

    this.renderPersonalizedLearning();
  }

  setupPlOnboardingHandlers() {
    // Populate state dropdown in onboarding step 1
    const stateSel = document.getElementById('pl-ob-select-state');
    if (stateSel) {
      stateSel.innerHTML = INDIAN_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
      stateSel.value = this.learnerProfile?.data?.stateRegion || 'Tamil Nadu State Board';
    }

    const pathwaySel = document.getElementById('pl-ob-select-pathway');
    const stateGroup = document.getElementById('pl-ob-state-group');
    pathwaySel?.addEventListener('change', () => {
      if (stateGroup) {
        stateGroup.style.display = pathwaySel.value === 'state_board' ? 'flex' : 'none';
      }
    });

    // Step 1 -> Step 2
    document.getElementById('pl-btn-ob-next-1')?.addEventListener('click', () => {
      const nameInp = document.getElementById('pl-ob-input-name');
      const pSel = document.getElementById('pl-ob-select-pathway');
      const sSel = document.getElementById('pl-ob-select-state');
      const lSel = document.getElementById('pl-ob-select-level');
      const iSel = document.getElementById('pl-ob-select-isl');
      const gInp = document.getElementById('pl-ob-input-goal');

      const name = nameInp?.value.trim() || 'Learner';
      if (this.learnerProfile && this.learnerProfile.data) {
        this.learnerProfile.data.learnerName = name;
        this.learnerProfile.data.educationPathway = pSel?.value || 'state_board';
        this.learnerProfile.data.stateRegion = sSel?.value || 'Tamil Nadu State Board';
        this.learnerProfile.data.educationLevel = lSel?.value || 'Class 9–10 (Secondary)';
        this.learnerProfile.data.islProficiency = iSel?.value || 'Intermediate';
        this.learnerProfile.data.activeGoal = gInp?.value.trim() || 'Conceptual Clarity';
        this.learnerProfile.data.isCustomConfigured = true;
        this.learnerProfile.save();
      }

      // Recommend default bundle based on pathway
      if (pSel?.value === 'state_board') {
        this.plSelectedOnboardBundleId = sSel?.value?.includes('Maharashtra') ? 'mh-state-10-2026' : 'tn-state-10-2026';
      } else if (pSel?.value === 'cbse') {
        this.plSelectedOnboardBundleId = 'cbse-sec-2026';
      } else if (pSel?.value === 'nios') {
        this.plSelectedOnboardBundleId = 'nios-sec-2026';
      } else if (pSel?.value === 'home_based') {
        this.plSelectedOnboardBundleId = 'home-iep-2026';
      } else if (pSel?.value === 'vocational') {
        this.plSelectedOnboardBundleId = 'vocational-nsqf-2026';
      }

      this.showOnboardingStep(2);
      this.renderOnboardingBundles();
    });

    // Step 2 Back & Next
    document.getElementById('pl-btn-ob-back-2')?.addEventListener('click', () => {
      this.showOnboardingStep(1);
    });

    document.getElementById('pl-btn-ob-next-2')?.addEventListener('click', () => {
      if (this.plSelectedOnboardBundleId) {
        this.plEngine.setActiveCurriculum(this.plSelectedOnboardBundleId);
      }
      this.showOnboardingStep(3);
      this.renderOnboardingDiagnostic();
    });

    document.getElementById('pl-btn-ob-import-json')?.addEventListener('click', () => {
      this._openIngestModal?.();
    });

    // Step 3 Back & Submit
    document.getElementById('pl-btn-ob-back-3')?.addEventListener('click', () => {
      this.showOnboardingStep(2);
    });

    document.getElementById('pl-btn-ob-submit-diagnostic')?.addEventListener('click', () => {
      this.plEngine.completeDiagnosticAssessment(this.plDiagnosticResponses);
      this.renderPersonalizedLearning();
    });
  }

  showOnboardingStep(stepNum) {
    [1, 2, 3].forEach(n => {
      const pane = document.getElementById(`pl-ob-pane-${n}`);
      const indicator = document.getElementById(`pl-ob-step-indicator-${n}`);
      if (pane) {
        pane.classList.toggle('hidden', n !== stepNum);
        pane.classList.toggle('active', n === stepNum);
      }
      if (indicator) {
        indicator.classList.toggle('active', n === stepNum);
        indicator.classList.toggle('completed', n < stepNum);
      }
    });
  }

  renderOnboardingBundles() {
    const container = document.getElementById('pl-ob-bundle-cards');
    if (!container) return;
    const bundles = this.plEngine.getAvailableBundles();
    container.innerHTML = bundles.map(b => `
      <div class="pl-bundle-card ${b.bundleId === this.plSelectedOnboardBundleId ? 'selected' : ''}" data-bundle-id="${b.bundleId}">
        <span class="pl-bc-tag">${escapeHtml(b.boardSystem)}</span>
        <h4 class="pl-bc-title">${escapeHtml(b.title)}</h4>
        <div class="pl-bc-meta">${escapeHtml(b.educationalLevel)} &middot; ${escapeHtml(b.academicYear)}</div>
        <div class="pl-bc-subjects">${b.subjectCount} Subjects Available Offline</div>
      </div>
    `).join('');

    container.querySelectorAll('.pl-bundle-card').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.pl-bundle-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.plSelectedOnboardBundleId = card.dataset.bundleId;
      });
    });
  }

  renderOnboardingDiagnostic() {
    const container = document.getElementById('pl-ob-diagnostic-questions-container');
    if (!container) return;

    const allConcepts = this.plEngine.getAllActiveConcepts();
    const sampleConcepts = allConcepts.slice(0, 3);
    this.plDiagnosticResponses = {};

    container.innerHTML = sampleConcepts.map((c, idx) => {
      const q = c.assessment?.question || `What is the core function of ${c.title}?`;
      const opts = c.assessment?.options || ['Primary foundation structure', 'Secondary metabolic role', 'Inactive non-functional part'];
      const correctIdx = c.assessment?.correctIndex ?? 0;

      return `
        <div class="pl-diag-q-card" data-concept-id="${c.id}" data-correct-idx="${correctIdx}">
          <div class="pl-diag-q-title">Question ${idx + 1}: ${escapeHtml(q)}</div>
          <div class="pl-diag-opts">
            ${opts.map((opt, oIdx) => `
              <button class="pl-diag-opt-btn" data-opt-idx="${oIdx}">${escapeHtml(opt)}</button>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.pl-diag-q-card').forEach(card => {
      const cId = card.dataset.conceptId;
      const correctIdx = parseInt(card.dataset.correctIdx, 10);
      card.querySelectorAll('.pl-diag-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          card.querySelectorAll('.pl-diag-opt-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          const chosenIdx = parseInt(btn.dataset.optIdx, 10);
          this.plDiagnosticResponses[cId] = chosenIdx === correctIdx;
        });
      });
    });
  }

  setupPlPlatformHandlers() {
    // Continue Hero button
    document.getElementById('pl-btn-hero-continue')?.addEventListener('click', () => {
      const last = this.plEngine.getLastActiveConcept();
      if (last) this.loadPlConceptIntoStudio(last, 'notes');
    });

    document.getElementById('pl-btn-hero-practice')?.addEventListener('click', () => {
      const last = this.plEngine.getLastActiveConcept();
      if (last) this.loadPlConceptIntoStudio(last, 'practice');
    });

    // Bundle manager shortcut & reset onboarding
    document.getElementById('pl-btn-open-bundle-manager')?.addEventListener('click', () => {
      document.getElementById('pl-bundle-manager-area')?.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('pl-btn-reset-onboarding')?.addEventListener('click', () => {
      if (confirm('Reset your profile and re-run guided onboarding? Your historical mastery will be preserved.')) {
        this.plEngine.resetToOnboarding();
        if (this.learnerProfile?.data) {
          this.learnerProfile.data.isCustomConfigured = false;
          this.learnerProfile.save();
        }
        this.renderPersonalizedLearning();
      }
    });

    document.getElementById('pl-btn-import-bundle-modal')?.addEventListener('click', () => {
      this._openIngestModal?.();
    });

    document.getElementById('pl-btn-export-bundle-json')?.addEventListener('click', () => {
      const active = this.plEngine.getActiveCurriculum();
      if (!active) return;
      const json = this.plEngine.exportCurriculumBundle(active.bundleId);
      if (!json) return;
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${active.bundleId}-curriculum.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  setupPlStudioHandlers() {
    // Close Classroom Studio
    document.getElementById('pl-btn-close-studio')?.addEventListener('click', () => {
      document.getElementById('pl-active-learning-area')?.classList.add('hidden');
      if (window.signSyncController) window.signSyncController.stopActiveAnimation();
    });

    // 7-Stage Pedagogy Navigation Tabs
    document.querySelectorAll('#pl-studio-tabs .pl-st-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const step = tab.dataset.step;
        if (step) this.setPlStudioStep(step);
      });
    });

    // In-Pane Next/Back Navigation Buttons
    document.querySelectorAll('#pl-active-learning-area [data-nav-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-nav-step');
        if (target) this.setPlStudioStep(target);
      });
    });

    // Recenter 3D Viewport
    document.getElementById('pl-btn-recenter-avatar')?.addEventListener('click', () => {
      const mount = document.getElementById('edu-curriculum-canvas');
      if (mount && window.mountCurriculumSigner) {
        window.mountCurriculumSigner(mount);
      }
    });

    // Speed Chips
    document.querySelectorAll('#pl-speed-chips-group .pl-speed-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const spd = parseFloat(chip.dataset.speed);
        document.querySelectorAll('#pl-speed-chips-group .pl-speed-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (window.signSyncController) {
          window.signSyncController.setPlaybackRate(spd);
        } else if (window.setGlobalPlaybackSpeed) {
          window.setGlobalPlaybackSpeed(spd);
        }
      });
    });

    // Practice Drill Controls
    document.getElementById('pl-btn-record-rep')?.addEventListener('click', () => {
      if (!this.plActiveConcept) return;
      const reps = this.plEngine.recordPracticeRep(this.plActiveConcept.id);
      const repEl = document.getElementById('pl-drill-rep-count');
      if (repEl) repEl.textContent = reps;
      this.renderPlContinueHero();
      this.renderPlSubjects();
      this.renderPlPathNodes();
    });

    document.getElementById('pl-btn-replay-concept-sign')?.addEventListener('click', () => {
      if (!this.plActiveConcept) return;
      const term = (this.plActiveConcept.islKeywords && this.plActiveConcept.islKeywords[0]) || this.plActiveConcept.title;
      window.signCurriculumText?.(term, this.plActiveConcept.islKeywords || []);
    });

    // Proceed to Step 7 button from Assess
    document.getElementById('pl-btn-goto-master')?.addEventListener('click', () => {
      this.setPlStudioStep('master');
    });

    // Step 7 Adapt action button
    document.getElementById('pl-btn-master-action')?.addEventListener('click', () => {
      const nextSteps = this.plEngine.getPersonalizedNextSteps();
      if (nextSteps.length > 0) {
        this.loadPlConceptIntoStudio(nextSteps[0].concept, nextSteps[0].targetStep || 'notes');
      }
    });

    document.getElementById('pl-btn-return-school')?.addEventListener('click', () => {
      document.getElementById('pl-active-learning-area')?.classList.add('hidden');
      document.getElementById('pl-school-header')?.scrollIntoView({ behavior: 'smooth' });
    });

    // ============================================================
    // FEATURE 1: VIDEO LESSON WITH AUDIO-OFF ISL MODE
    // Controls: [ 🔊 Original Audio ] vs [ 🤟 ISL Learning Mode ]
    // ============================================================
    document.getElementById('pl-btn-original-audio')?.addEventListener('click', () => {
      this.setPlVideoAudioMode('original');
    });

    document.getElementById('pl-btn-isl-mode')?.addEventListener('click', () => {
      this.setPlVideoAudioMode('isl');
    });

    // ============================================================
    // FEATURE 2: TWO-WAY ISL COMMUNICATION LAYER
    // Student ↕ ISL Recognition ↕ Educational Content ↕ 3D Avatar
    // ============================================================
    document.getElementById('pl-btn-toggle-twoway')?.addEventListener('click', () => {
      this.togglePlTwoWay();
    });

    document.getElementById('pl-btn-close-twoway')?.addEventListener('click', () => {
      this.togglePlTwoWay(false);
    });

    document.getElementById('pl-twoway-tab-doubt')?.addEventListener('click', () => {
      this.setPlTwoWayMode('doubt');
    });

    document.getElementById('pl-twoway-tab-quiz')?.addEventListener('click', () => {
      this.setPlTwoWayMode('quiz');
    });

    // Camera Hardware Streaming Controls
    document.getElementById('pl-btn-start-camera')?.addEventListener('click', () => {
      this.startPlTwoWayCamera();
    });

    document.getElementById('pl-btn-toggle-cam-stream')?.addEventListener('click', () => {
      if (islRecognitionService.isRunning) {
        this.stopPlTwoWayCamera();
      } else {
        this.startPlTwoWayCamera();
      }
    });

    document.getElementById('pl-btn-clear-sequence')?.addEventListener('click', () => {
      this.clearPlTwoWaySequence();
    });

    document.getElementById('pl-btn-try-again')?.addEventListener('click', () => {
      this.retryPlTwoWayRecognition();
    });

    document.getElementById('pl-btn-submit-twoway')?.addEventListener('click', () => {
      this.submitPlTwoWayInput();
    });

    // Mode 1: Ask a Doubt Confirmation Actions
    document.getElementById('pl-btn-doubt-send')?.addEventListener('click', () => {
      const q = this.getPlActiveDoubtQuery();
      this.submitPlDoubtInquiry(q);
    });

    document.getElementById('pl-btn-doubt-retry')?.addEventListener('click', () => {
      this.retryPlTwoWayRecognition();
    });

    document.getElementById('pl-btn-play-doubt-avatar')?.addEventListener('click', () => {
      this.playDoubtExplanationOnAvatar();
    });

    // Mode 2: Answer Quiz Confirmation Actions
    document.getElementById('pl-btn-quiz-confirm-send')?.addEventListener('click', () => {
      this.submitPlQuizAnswerFromISL();
    });

    document.getElementById('pl-btn-quiz-try-again')?.addEventListener('click', () => {
      this.retryPlTwoWayRecognition();
    });

    // Sample doubt prompt chips for quick concept verification
    document.querySelectorAll('#pl-twoway-panel .pl-sample-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tokens = (chip.dataset.tokens || chip.textContent).trim();
        if (tokens) {
          const doubtQuery = document.getElementById('pl-doubt-confirm-query');
          const doubtSendBtn = document.getElementById('pl-btn-doubt-send');
          if (doubtQuery) doubtQuery.textContent = tokens;
          if (doubtSendBtn) doubtSendBtn.disabled = false;
          this.submitPlDoubtInquiry(tokens);
        }
      });
    });

    // Initialize vocabulary capability discovery list
    this.populatePlVocabList();
  }

  // ============================================================
  // FEATURE 1 IMPLEMENTATION: Video Lesson Audio-Off ISL Mode
  // ============================================================
  setPlVideoAudioMode(mode = 'original') {
    this.plVideoMode = mode;
    const btnOriginal = document.getElementById('pl-btn-original-audio');
    const btnIsl = document.getElementById('pl-btn-isl-mode');
    const banner = document.getElementById('pl-isl-mode-banner');
    const videoEl = document.getElementById('pl-active-video-element');
    const modeTag = document.getElementById('pl-video-mode-indicator-tag');

    if (mode === 'isl') {
      // VIDEO AUDIO = OFF
      // The video continues playing normally, but its original audio must be muted.
      // Do NOT simply pause the video!
      if (videoEl) {
        videoEl.muted = true;
      }
      btnIsl?.classList.add('active');
      btnOriginal?.classList.remove('active');
      banner?.classList.remove('hidden');
      if (modeTag) {
        modeTag.textContent = '🤟 ISL Learning Mode (Audio Muted)';
        modeTag.className = 'pl-vid-mode-indicator';
      }

      // ISL interpretation becomes primary communication layer
      const statusLabel = document.getElementById('pl-avatar-status-label');
      if (statusLabel) {
        statusLabel.textContent = '🤟 ISL Primary Layer Active';
      }

      // Trigger 3D avatar visual sign demonstration of active concept
      if (this.plActiveConcept) {
        const term = (this.plActiveConcept.islKeywords && this.plActiveConcept.islKeywords[0]) || this.plActiveConcept.title;
        window.signCurriculumText?.(term, this.plActiveConcept.islKeywords || []);
      }
    } else {
      // Original Audio ON: normal video audio
      if (videoEl) {
        videoEl.muted = false;
        videoEl.volume = 1.0;
      }
      btnOriginal?.classList.add('active');
      btnIsl?.classList.remove('active');
      banner?.classList.add('hidden');
      if (modeTag) {
        modeTag.textContent = '🔊 Original Audio Track';
        modeTag.className = 'pl-vid-mode-indicator original';
      }
    }
  }

  renderPlVideoPlayer(container, concept) {
    if (!container || !concept) return;
    const isMuted = this.plVideoMode === 'isl';

    container.innerHTML = `
      <div class="pl-video-player-frame" id="pl-video-frame">
        <canvas class="pl-video-sim-canvas" id="pl-video-canvas"></canvas>
        <video class="pl-video-element hidden" id="pl-active-video-element" playsinline loop ${isMuted ? 'muted' : ''}></video>
        <div class="pl-video-watermark-hud">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 6px #38bdf8;"></span>
          <span>Voice 2 Sense Educational Media &middot; Offline</span>
        </div>
        <div class="pl-video-controls-bar">
          <div class="pl-video-scrub-wrap" id="pl-vid-scrub">
            <div class="pl-video-scrub-progress" id="pl-vid-progress" style="width: 25%;"></div>
          </div>
          <div class="pl-video-btn-row">
            <div class="pl-video-left-btns">
              <button class="pl-vid-play-btn" id="pl-vid-toggle-play" title="Play/Pause">
                <svg id="pl-vid-play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              </button>
              <span class="pl-vid-timecode" id="pl-vid-timecode">01:12 / ${escapeHtml(concept.video?.duration || concept.media?.duration || '03:45')}</span>
            </div>
            <span class="pl-vid-mode-indicator ${isMuted ? '' : 'original'}" id="pl-video-mode-indicator-tag">
              ${isMuted ? '🤟 ISL Learning Mode (Audio Muted)' : '🔊 Original Audio Track'}
            </span>
          </div>
        </div>
      </div>
    `;

    // Start interactive simulation loop on canvas with authentic educational graphics
    this.startPlVideoSimulation(concept);
    this.setPlVideoAudioMode(this.plVideoMode || 'original');
  }

  startPlVideoSimulation(concept) {
    const canvas = document.getElementById('pl-video-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth || 640;
    canvas.height = canvas.clientHeight || 360;

    let isPlaying = true;
    let progress = 0.25;

    const playBtn = document.getElementById('pl-vid-toggle-play');
    const playIcon = document.getElementById('pl-vid-play-icon');
    const progressBar = document.getElementById('pl-vid-progress');
    const scrub = document.getElementById('pl-vid-scrub');

    scrub?.addEventListener('click', (e) => {
      const rect = scrub.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      progress = pos;
      if (progressBar) progressBar.style.width = `${pos * 100}%`;
    });

    playBtn?.addEventListener('click', () => {
      isPlaying = !isPlaying;
      if (playIcon) {
        playIcon.innerHTML = isPlaying
          ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
          : '<polygon points="5 3 19 12 5 21 5 3"/>';
      }
    });

    let t = 0;
    const renderSim = () => {
      if (!document.getElementById('pl-video-canvas')) return;
      if (isPlaying) {
        t += 0.02;
        progress = (progress + 0.0006) % 1.0;
        if (progressBar) progressBar.style.width = `${progress * 100}%`;
      }

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2 - 20;

      // Subtle background grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Render domain visualization
      const titleLower = (concept.title || '').toLowerCase();
      if (titleLower.includes('cell') || titleLower.includes('plant') || titleLower.includes('plastid')) {
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 4;
        ctx.strokeRect(cx - 140, cy - 75, 280, 150);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 134, cy - 69, 268, 138);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.beginPath();
        ctx.ellipse(cx + 20, cy, 65, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        for (let i = 0; i < 6; i++) {
          const ang = t + (i * Math.PI / 3);
          const chX = cx + Math.cos(ang) * 85;
          const chY = cy + Math.sin(ang) * 45;
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.ellipse(chX, chY, 13, 7, ang, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#6ee7b7';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = '#34d399';
        ctx.fillText('PLANT CELL STRUCTURE — Rigid Cellulose Wall & Chloroplasts', cx - 185, cy + 105);
      } else if (titleLower.includes('keyboard') || titleLower.includes('input') || titleLower.includes('device') || titleLower.includes('computer')) {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 120, cy - 70, 240, 105);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(cx - 110, cy - 60, 220, 85);

        ctx.strokeRect(cx - 130, cy + 50, 260, 38);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        for (let k = 0; k < 12; k++) {
          const kx = cx - 120 + (k * 20);
          ctx.fillRect(kx, cy + 57, 15, 11);
        }

        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('COMPUTER PERIPHERALS: KEYBOARD (Input) → CPU → MONITOR (Output)', cx - 210, cy + 115);
      } else {
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x < w; x += 6) {
          const y = cy + Math.sin((x * 0.02) + t * 2) * 35;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = '#c7d2fe';
        ctx.fillText(`${concept.title.toUpperCase()} — VISUAL EDUCATIONAL LESSON`, cx - 160, cy + 90);
      }

      requestAnimationFrame(renderSim);
    };

    renderSim();
  }

  // ============================================================
  // FEATURE 2 IMPLEMENTATION: Two-Way ISL Communication Layer
  // ============================================================
  togglePlTwoWay(forceState = null) {
    const panel = document.getElementById('pl-twoway-panel');
    const toggleBtn = document.getElementById('pl-btn-toggle-twoway');
    if (!panel) return;

    this.plTwoWayActive = (forceState !== null) ? forceState : panel.classList.contains('hidden');
    if (this.plTwoWayActive) {
      panel.classList.remove('hidden');
      toggleBtn?.classList.add('active');
      this.populatePlVocabList();
      if (this.plTwoWayMode === 'quiz') {
        this.updatePlTwoWayQuizCard();
      }
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      panel.classList.add('hidden');
      toggleBtn?.classList.remove('active');
      this.stopPlTwoWayCamera();
    }
  }

  setPlTwoWayMode(mode = 'doubt') {
    this.plTwoWayMode = mode;
    const tabDoubt = document.getElementById('pl-twoway-tab-doubt');
    const tabQuiz = document.getElementById('pl-twoway-tab-quiz');
    const viewDoubt = document.getElementById('pl-twoway-view-doubt');
    const viewQuiz = document.getElementById('pl-twoway-view-quiz');

    if (mode === 'doubt') {
      tabDoubt?.classList.add('active');
      tabQuiz?.classList.remove('active');
      viewDoubt?.classList.add('active');
      viewQuiz?.classList.remove('active');
    } else {
      tabQuiz?.classList.add('active');
      tabDoubt?.classList.remove('active');
      viewQuiz?.classList.add('active');
      viewDoubt?.classList.remove('active');
      this.updatePlTwoWayQuizCard();
    }
  }

  async startPlTwoWayCamera() {
    const video = document.getElementById('pl-twoway-video');
    const canvas = document.getElementById('pl-twoway-canvas');
    const placeholder = document.getElementById('pl-twoway-camera-placeholder');
    const toggleBtn = document.getElementById('pl-btn-toggle-cam-stream');

    try {
      await islRecognitionService.start({
        videoElement: video,
        canvasElement: canvas,
        onPrediction: (pred) => this.onPlRecognitionPrediction(pred),
        onStateChange: (state) => this.onPlRecognitionStateChange(state),
        onSequenceUpdate: (seq) => this.onPlRecognitionSequence(seq)
      });

      placeholder?.classList.add('hidden');
      if (toggleBtn) toggleBtn.textContent = 'Stop Camera';
    } catch (err) {
      console.error('[EduApp] Camera start failed:', err);
      const msg = document.getElementById('pl-twoway-status-msg');
      if (msg) msg.textContent = 'Camera unavailable. Please grant webcam permissions.';
    }
  }

  stopPlTwoWayCamera() {
    islRecognitionService.stop();
    const placeholder = document.getElementById('pl-twoway-camera-placeholder');
    const toggleBtn = document.getElementById('pl-btn-toggle-cam-stream');
    placeholder?.classList.remove('hidden');
    if (toggleBtn) toggleBtn.textContent = 'Start Camera';
    const tag = document.getElementById('pl-twoway-status-tag');
    if (tag) {
      tag.textContent = 'STANDBY';
      tag.className = 'pl-twoway-status-badge';
    }
  }

  onPlRecognitionPrediction(res) {
    const predLabel = document.getElementById('pl-twoway-pred-label');
    const confText = document.getElementById('pl-twoway-conf-text');
    const confBar = document.getElementById('pl-twoway-conf-bar');
    const statusMsg = document.getElementById('pl-twoway-status-msg');
    const doubtQuery = document.getElementById('pl-doubt-confirm-query');
    const doubtSendBtn = document.getElementById('pl-btn-doubt-send');

    if (predLabel) {
      predLabel.textContent = res.label || (res.confidence > 25 ? 'DETECTING...' : '—');
    }
    if (confText) confText.textContent = `${res.confidence}%`;
    if (confBar) {
      confBar.style.width = `${res.confidence}%`;
      confBar.style.background = res.isReliable ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #38bdf8, #818cf8)';
    }
    if (statusMsg) {
      statusMsg.textContent = res.message || 'Position hand in frame to sign.';
    }

    // Update Mode 1 Doubt Target
    if (this.plTwoWayMode === 'doubt' && res.label && res.isReliable) {
      const currentSeq = islRecognitionService.getStatus().committedSequence;
      const combined = [...currentSeq, res.label].join(' ');
      if (doubtQuery) doubtQuery.textContent = combined;
      if (doubtSendBtn) doubtSendBtn.disabled = false;
    }

    // Update Mode 2 Quiz Option Match
    if (this.plTwoWayMode === 'quiz' && res.label && res.isReliable) {
      this.matchPredictedSignToQuiz(res.label);
    }
  }

  onPlRecognitionStateChange(state) {
    const tag = document.getElementById('pl-twoway-status-tag');
    if (!tag) return;

    if (state === RECOGNITION_STATES.STABLE) {
      tag.textContent = 'STABLE SIGN';
      tag.className = 'pl-twoway-status-badge stable';
    } else if (state === RECOGNITION_STATES.DETECTING) {
      tag.textContent = 'DETECTING';
      tag.className = 'pl-twoway-status-badge';
    } else if (state === RECOGNITION_STATES.WAIT_CHANGE) {
      tag.textContent = 'SIGN COMMITTED';
      tag.className = 'pl-twoway-status-badge';
    } else {
      tag.textContent = 'STANDBY';
      tag.className = 'pl-twoway-status-badge';
    }
  }

  onPlRecognitionSequence(seq) {
    const box = document.getElementById('pl-twoway-seq-chips');
    const doubtQuery = document.getElementById('pl-doubt-confirm-query');
    const doubtSendBtn = document.getElementById('pl-btn-doubt-send');

    if (box) {
      if (!seq || seq.length === 0) {
        box.innerHTML = '<span class="pl-twoway-empty-hint">No signs committed yet. Sign and hold to add.</span>';
      } else {
        box.innerHTML = seq.map((s, idx) => `
          <div class="pl-twoway-seq-chip">
            <span>#${idx + 1}</span>
            <strong>${escapeHtml(s)}</strong>
          </div>
        `).join('');
      }
    }

    if (doubtQuery) {
      doubtQuery.textContent = seq.join(' ') || '—';
    }
    if (doubtSendBtn) {
      doubtSendBtn.disabled = (seq.length === 0);
    }
  }

  clearPlTwoWaySequence() {
    islRecognitionService.clearSequence();
    const doubtQuery = document.getElementById('pl-doubt-confirm-query');
    const doubtSendBtn = document.getElementById('pl-btn-doubt-send');
    if (doubtQuery) doubtQuery.textContent = '—';
    if (doubtSendBtn) doubtSendBtn.disabled = true;
    this.resetQuizMatching();
  }

  retryPlTwoWayRecognition() {
    const predLabel = document.getElementById('pl-twoway-pred-label');
    const statusMsg = document.getElementById('pl-twoway-status-msg');
    if (predLabel) predLabel.textContent = '—';
    if (statusMsg) statusMsg.textContent = 'Ready for sign. Position hand clearly in frame.';
    this.resetQuizMatching();
  }

  submitPlTwoWayInput() {
    const token = islRecognitionService.commitActivePrediction();
    if (this.plTwoWayMode === 'doubt') {
      const q = this.getPlActiveDoubtQuery();
      if (q) this.submitPlDoubtInquiry(q);
    } else if (this.plTwoWayMode === 'quiz') {
      if (this.plActiveQuizMatchedIndex !== null) {
        this.submitPlQuizAnswerFromISL();
      }
    }
  }

  getPlActiveDoubtQuery() {
    const seq = islRecognitionService.getStatus().committedSequence;
    if (seq && seq.length > 0) return seq.join(' ');
    const active = islRecognitionService.getPrediction();
    return active || '';
  }

  submitPlDoubtInquiry(queryText) {
    if (!queryText || !queryText.trim()) return;
    const clean = queryText.trim();
    console.log('[EduApp] submitPlDoubtInquiry:', clean);

    const activeId = this.plActiveConcept ? this.plActiveConcept.id : null;
    const result = this.plEngine.searchLocalEducationalContent(clean, activeId);

    const card = document.getElementById('pl-doubt-result-card');
    const qTitle = document.getElementById('pl-doubt-question-title');
    const sPill = document.getElementById('pl-doubt-source-text');
    const aBody = document.getElementById('pl-doubt-answer-body') || document.getElementById('pl-doubt-answer-text');
    const chipsBox = document.getElementById('pl-doubt-key-chips');
    const availStatus = document.getElementById('pl-doubt-avail-status');

    if (qTitle) qTitle.textContent = result.question || clean;
    if (sPill) sPill.textContent = result.source || 'Local Curriculum Search';
    if (aBody) aBody.textContent = result.answer;

    this.plLastDoubtResult = result;

    if (chipsBox) {
      chipsBox.innerHTML = '';
      if (result.keyConcepts && result.keyConcepts.length > 0) {
        result.keyConcepts.forEach(cTerm => {
          const chip = document.createElement('button');
          chip.className = 'pl-doubt-key-chip';
          chip.innerHTML = `<span>🤟</span> <span>${escapeHtml(cTerm)}</span>`;
          chip.addEventListener('click', () => {
            window.signCurriculumText?.(cTerm, result.keyConcepts);
          });
          chipsBox.appendChild(chip);
        });
      } else {
        chipsBox.innerHTML = '<span style="font-size: 12px; color: #94a3b8;">No specific ISL key terms mapped.</span>';
      }
    }

    if (availStatus) availStatus.textContent = '';
    card?.classList.remove('hidden');
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  playDoubtExplanationOnAvatar() {
    const result = this.plLastDoubtResult;
    const availStatus = document.getElementById('pl-doubt-avail-status');
    if (!result || !result.keyConcepts || result.keyConcepts.length === 0) {
      if (availStatus) availStatus.textContent = 'ISL sign unavailable for this term.';
      return;
    }

    const firstTerm = result.keyConcepts[0];
    const glossEl = document.getElementById('pl-hud-active-gloss');
    const phraseEl = document.getElementById('pl-hud-active-phrase');
    if (glossEl) glossEl.textContent = firstTerm.toUpperCase();
    if (phraseEl) phraseEl.textContent = `Explaining Doubt: "${firstTerm}"`;

    if (window.signCurriculumText) {
      const success = window.signCurriculumText(firstTerm, result.keyConcepts);
      if (!success && availStatus) {
        availStatus.textContent = 'ISL sign unavailable for this term. Displaying text explanation.';
      } else if (availStatus) {
        availStatus.textContent = `✓ Demonstrating "${firstTerm}" on 3D avatar.`;
      }
    }
  }

  updatePlTwoWayQuizCard(concept = null) {
    const c = concept || this.plActiveConcept;
    if (!c) return;

    const qTextEl = document.getElementById('pl-twoway-quiz-question-text');
    const optsList = document.getElementById('pl-twoway-quiz-options-list');
    const matchedText = document.getElementById('pl-twoway-quiz-matched-text');
    const submitBtn = document.getElementById('pl-btn-quiz-confirm-send');
    const fbBanner = document.getElementById('pl-twoway-quiz-feedback');

    if (fbBanner) fbBanner.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = true;
    if (matchedText) matchedText.textContent = '—';
    this.plActiveQuizMatchedIndex = null;

    const qText = c.assessment?.question || c.assessment?.questions?.[0]?.question || `Which answer best describes ${c.title}?`;
    const options = c.assessment?.options || c.assessment?.questions?.[0]?.options || [c.title, 'Option B', 'Option C', 'Option D'];

    if (qTextEl) qTextEl.textContent = qText;

    if (optsList) {
      optsList.innerHTML = options.map((opt, idx) => `
        <div class="pl-quiz-opt-item" id="pl-quiz-opt-item-${idx}" data-index="${idx}" data-text="${escapeHtml(opt)}">
          <span class="pl-quiz-opt-letter">${String.fromCharCode(65 + idx)}</span>
          <span class="pl-quiz-opt-lbl">${escapeHtml(opt)}</span>
        </div>
      `).join('');
    }
  }

  matchPredictedSignToQuiz(signLabel) {
    const c = this.plActiveConcept;
    if (!c) return;

    const options = c.assessment?.options || c.assessment?.questions?.[0]?.options || [];
    const matchedText = document.getElementById('pl-twoway-quiz-matched-text');
    const submitBtn = document.getElementById('pl-btn-quiz-confirm-send');

    const sNorm = (signLabel || '').toUpperCase().trim();
    let targetIndex = null;

    // 1. Direct Choice Letter: "OPTION A" -> 0, "A" -> 0, etc.
    if (sNorm === 'OPTION A' || sNorm === 'A') targetIndex = 0;
    else if (sNorm === 'OPTION B' || sNorm === 'B') targetIndex = 1;
    else if (sNorm === 'OPTION C' || sNorm === 'C') targetIndex = 2;
    else if (sNorm === 'OPTION D' || sNorm === 'D') targetIndex = 3;
    else {
      // 2. Direct lexical text matching with option words
      options.forEach((opt, idx) => {
        const oNorm = opt.toUpperCase();
        if (oNorm.includes(sNorm) || sNorm.includes(oNorm)) {
          targetIndex = idx;
        }
      });
    }

    if (targetIndex !== null && targetIndex < options.length) {
      this.plActiveQuizMatchedIndex = targetIndex;
      document.querySelectorAll('.pl-quiz-opt-item').forEach(el => el.classList.remove('matched'));
      const matchedEl = document.getElementById(`pl-quiz-opt-item-${targetIndex}`);
      matchedEl?.classList.add('matched');

      const chosenOptionText = options[targetIndex];
      if (matchedText) {
        matchedText.textContent = `"${sNorm}" → Option ${String.fromCharCode(65 + targetIndex)}: ${chosenOptionText}`;
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  resetQuizMatching() {
    this.plActiveQuizMatchedIndex = null;
    document.querySelectorAll('.pl-quiz-opt-item').forEach(el => el.classList.remove('matched'));
    const matchedText = document.getElementById('pl-twoway-quiz-matched-text');
    const submitBtn = document.getElementById('pl-btn-quiz-confirm-send');
    if (matchedText) matchedText.textContent = '—';
    if (submitBtn) submitBtn.disabled = true;
  }

  submitPlQuizAnswerFromISL() {
    const idx = this.plActiveQuizMatchedIndex;
    const c = this.plActiveConcept;
    if (idx === null || !c) return;

    const correctIdx = c.assessment?.correctIndex ?? c.assessment?.questions?.[0]?.correctIndex ?? 0;
    const isCorrect = (idx === correctIdx);

    // Adaptive Learning Integration: Update assessment performance & concept mastery
    this.plEngine.recordAssessmentResult(c.id, isCorrect);

    // Visual feedback in Two-Way Quiz card
    const fbBanner = document.getElementById('pl-twoway-quiz-feedback');
    const fbTitle = document.getElementById('pl-twoway-quiz-fb-title');
    const fbDesc = document.getElementById('pl-twoway-quiz-fb-desc');

    const optItem = document.getElementById(`pl-quiz-opt-item-${idx}`);
    if (optItem) {
      optItem.classList.add(isCorrect ? 'correct' : 'incorrect');
    }
    if (!isCorrect) {
      document.getElementById(`pl-quiz-opt-item-${correctIdx}`)?.classList.add('correct');
    }

    if (fbBanner && fbTitle && fbDesc) {
      fbBanner.className = isCorrect ? 'pl-quiz-feedback-banner' : 'pl-quiz-feedback-banner error';
      fbTitle.textContent = isCorrect
        ? '✓ Correct! Answer Verified via ISL Recognition'
        : '✗ Incorrect. Practice this concept in your pathway.';
      fbDesc.textContent = isCorrect
        ? 'Concept mastery updated. Your ISL answer was recorded in the adaptive learning engine.'
        : 'Review the definitions in Step 2 and practice signing with the 3D avatar.';
      fbBanner.classList.remove('hidden');
    }

    // Refresh school mastery statistics
    this.renderPlContinueHero();
    this.renderPlSubjects();
    this.renderPlPathNodes();
    this.renderPlGapsAndRevision();
  }

  populatePlVocabList() {
    const list = document.getElementById('pl-twoway-vocab-list');
    const badge = document.getElementById('pl-vocab-count-badge');
    if (!list) return;

    const signs = islRecognitionService.getSupportedSigns();
    if (badge) badge.textContent = `${signs.length} Signs`;

    list.innerHTML = signs.map(s => `
      <div class="pl-vocab-chip" title="Category: ${s.category} | Motion: ${s.motion}">
        ${escapeHtml(s.display || s.label)}
      </div>
    `).join('');
  }

  setupPlModalHandlers() {
    // 1. Configure Pathway Modal
    const openPathwayModal = () => {
      const modal = document.getElementById('pl-pathway-modal');
      if (!modal) return;
      const curr = this.plEngine.getActiveCurriculum();
      const pathSel = document.getElementById('pl-input-pathway-select');
      const stateSel = document.getElementById('pl-input-state-select');
      const instInp = document.getElementById('pl-input-institution');
      const levelSel = document.getElementById('pl-input-edu-level');
      const goalInp = document.getElementById('pl-input-goal');

      if (pathSel) pathSel.value = (curr && curr.pathwayId) || this.learnerProfile?.data?.educationPathway || 'state_board';
      if (instInp) instInp.value = this.learnerProfile?.data?.institution || '';
      if (levelSel) levelSel.value = this.learnerProfile?.data?.educationLevel || 'Class 9–10 (Secondary)';
      if (goalInp) goalInp.value = this.learnerProfile?.data?.activeGoal || 'Conceptual Clarity';

      if (stateSel) {
        stateSel.innerHTML = INDIAN_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
        stateSel.value = this.learnerProfile?.data?.stateRegion || 'Tamil Nadu State Board';
      }

      modal.classList.remove('hidden');
    };

    const closePathwayModal = () => {
      document.getElementById('pl-pathway-modal')?.classList.add('hidden');
    };

    this._openPathwayModal = openPathwayModal;
    this._closePathwayModal = closePathwayModal;

    document.getElementById('pl-btn-close-pathway-modal')?.addEventListener('click', closePathwayModal);
    document.getElementById('pl-btn-cancel-pathway')?.addEventListener('click', closePathwayModal);

    document.getElementById('pl-btn-save-pathway')?.addEventListener('click', () => {
      const pathSel = document.getElementById('pl-input-pathway-select');
      const stateSel = document.getElementById('pl-input-state-select');
      const instInp = document.getElementById('pl-input-institution');
      const levelSel = document.getElementById('pl-input-edu-level');
      const goalInp = document.getElementById('pl-input-goal');

      const pathwayId = pathSel?.value || 'state_board';
      if (this.learnerProfile?.data) {
        this.learnerProfile.data.educationPathway = pathwayId;
        this.learnerProfile.data.stateRegion = stateSel?.value || 'Tamil Nadu State Board';
        this.learnerProfile.data.institution = instInp?.value.trim() || '';
        this.learnerProfile.data.educationLevel = levelSel?.value || 'Class 9–10 (Secondary)';
        this.learnerProfile.data.activeGoal = goalInp?.value.trim() || 'Conceptual Clarity';
        this.learnerProfile.data.isCustomConfigured = true;
        this.learnerProfile.save();
      }

      if (pathwayId === 'state_board') {
        const isMh = stateSel?.value?.includes('Maharashtra');
        this.plEngine.setActiveCurriculum(isMh ? 'mh-state-10-2026' : 'tn-state-10-2026');
      } else if (pathwayId === 'cbse') {
        this.plEngine.setActiveCurriculum('cbse-sec-2026');
      } else if (pathwayId === 'nios') {
        this.plEngine.setActiveCurriculum('nios-sec-2026');
      } else if (pathwayId === 'home_based') {
        this.plEngine.setActiveCurriculum('home-iep-2026');
      } else if (pathwayId === 'vocational') {
        this.plEngine.setActiveCurriculum('vocational-nsqf-2026');
      }

      this.plActiveConcept = null;
      this.renderPersonalizedLearning();
      this.updateAssistantSyllabusHeader();
      closePathwayModal();
    });

    // 2. Add Curriculum Ingestion Modal
    const openIngestModal = () => {
      document.getElementById('pl-ingestion-modal')?.classList.remove('hidden');
      document.getElementById('pl-ingest-status-msg')?.classList.add('hidden');
    };
    const closeIngestModal = () => {
      document.getElementById('pl-ingestion-modal')?.classList.add('hidden');
    };

    this._openIngestModal = openIngestModal;
    this._closeIngestModal = closeIngestModal;

    document.getElementById('pl-btn-close-ingestion-modal')?.addEventListener('click', closeIngestModal);

    // Ingestion tabs
    const tabUpload = document.getElementById('pl-tab-upload-file');
    const tabBuilder = document.getElementById('pl-tab-manual-builder');
    const viewUpload = document.getElementById('pl-ingest-view-upload');
    const viewBuilder = document.getElementById('pl-ingest-view-builder');

    tabUpload?.addEventListener('click', () => {
      tabUpload.classList.add('active');
      tabBuilder?.classList.remove('active');
      viewUpload?.classList.remove('hidden');
      viewUpload?.classList.add('active');
      viewBuilder?.classList.add('hidden');
      viewBuilder?.classList.remove('active');
    });

    tabBuilder?.addEventListener('click', () => {
      tabBuilder.classList.add('active');
      tabUpload?.classList.remove('active');
      viewBuilder?.classList.remove('hidden');
      viewBuilder?.classList.add('active');
      viewUpload?.classList.add('hidden');
      viewUpload?.classList.remove('active');
    });

    // File Input & Dropzone
    const fileInput = document.getElementById('pl-syllabus-file-input');
    const browseBtn = document.getElementById('pl-btn-browse-file');
    const dropzone = document.getElementById('pl-syllabus-dropzone');
    const statusMsg = document.getElementById('pl-ingest-status-msg');

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });
    dropzone?.addEventListener('click', () => fileInput?.click());

    const handleBundleFile = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          const res = this.plEngine.importCurriculumBundle(text);
          if (res.success && statusMsg) {
            statusMsg.textContent = `✓ Successfully imported bundle "${res.bundle.title}" into your offline digital school!`;
            statusMsg.className = 'pl-status-msg success';
            statusMsg.classList.remove('hidden');
            setTimeout(() => {
              this.renderPersonalizedLearning();
              closeIngestModal();
            }, 1000);
          } else if (statusMsg) {
            statusMsg.textContent = res.error || 'Failed to parse bundle format. Expected valid curriculum JSON.';
            statusMsg.className = 'pl-status-msg error';
            statusMsg.classList.remove('hidden');
          }
        }
      };
      reader.readAsText(file);
    };

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      handleBundleFile(file);
    });

    // Custom Concept Builder
    document.getElementById('pl-btn-add-custom-concept')?.addEventListener('click', () => {
      const sTitle = document.getElementById('pl-custom-subj-title')?.value.trim() || 'Custom Subject';
      const cTitle = document.getElementById('pl-custom-concept-title')?.value.trim();
      const cDesc = document.getElementById('pl-custom-concept-desc')?.value.trim() || 'Custom educational concept explanation.';
      const cTerms = document.getElementById('pl-custom-concept-terms')?.value.trim();

      if (!cTitle) {
        alert('Please enter a concept title.');
        return;
      }

      const rawBundle = {
        bundleId: 'custom-' + Date.now(),
        curriculumId: 'custom-bundle',
        boardSystem: 'Custom Institution Curriculum',
        stateRegion: 'Custom',
        educationalLevel: 'Adaptive Level',
        academicYear: '2026–27',
        bundleVersion: '1.0.0',
        pathwayId: 'custom',
        pathwayName: 'Custom Curriculum',
        title: sTitle,
        description: 'Locally constructed curriculum concept.',
        subjects: [{
          id: 'subj-' + Date.now(),
          title: sTitle,
          shortTitle: sTitle,
          icon: '📝',
          color: '#3b82f6',
          description: 'Custom subject module',
          units: [{
            id: 'u-1',
            unitNum: 1,
            title: 'Unit 1: ' + sTitle,
            topics: [{
              id: 't-1',
              title: cTitle,
              concepts: [{
                id: 'concept-' + Date.now(),
                title: cTitle,
                difficulty: 'Beginner',
                prerequisites: [],
                learningOutcome: 'Understand ' + cTitle + ' through authentic ISL comprehension.',
                overview: cDesc,
                notes: {
                  definitions: [{ term: cTitle, def: cDesc }],
                  keyPoints: [cDesc, 'Review key terminology with 3D signing.']
                },
                video: {
                  title: cTitle + ' - Demonstration',
                  offlineAvailable: true,
                  duration: '4:20',
                  transcript: cDesc
                },
                islKeywords: cTerms ? cTerms.split(',').map(s => s.trim()).filter(Boolean) : [cTitle.toLowerCase()],
                practice: {
                  drills: ['Recognition', 'Sign along'],
                  targetReps: 5
                },
                assessment: {
                  question: 'What is the primary role of ' + cTitle + '?',
                  options: [cDesc, 'Unrelated concept B', 'Unrelated concept C'],
                  correctIndex: 0,
                  explanation: 'Verified from your custom concept definition.'
                }
              }]
            }]
          }]
        }]
      };

      this.plEngine.importCurriculumBundle(rawBundle);
      this.renderPersonalizedLearning();
      closeIngestModal();
    });
  }

  // Primary Renderer for Personalized Learning Digital School
  renderPersonalizedLearning() {
    if (!this.plEngine) {
      this.plEngine = new PersonalizedLearningEngine(this.learnerProfile);
    }

    // Always ensure persistent right-side canvas container is completely hidden on Personalized Learning
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      canvasContainer.classList.add('hidden-canvas');
      canvasContainer.setAttribute('data-active-view', 'view-personalized-learning');
    }

    const hasOnboarded = this.plEngine.hasCompletedOnboarding();
    const onboardView = document.getElementById('pl-onboarding-view');
    const platformView = document.getElementById('pl-platform-view');

    if (!hasOnboarded) {
      // STATE 1: GUIDED ONBOARDING
      if (onboardView) onboardView.classList.remove('hidden');
      if (platformView) platformView.classList.add('hidden');

      const greetingEl = document.getElementById('pl-header-greeting');
      if (greetingEl) greetingEl.textContent = 'Welcome to Your Learning Space 👋';

      const currBadge = document.getElementById('pl-header-curriculum-badge');
      if (currBadge) currBadge.innerHTML = '<span>Configuration Required</span>';

      const masteryEl = document.getElementById('pl-header-mastery-pct');
      if (masteryEl) masteryEl.textContent = '0%';

      this.showOnboardingStep(1);
    } else {
      // STATE 2: RETURNING STUDENT DIGITAL SCHOOL PLATFORM
      if (onboardView) onboardView.classList.add('hidden');
      if (platformView) platformView.classList.remove('hidden');

      const pData = this.learnerProfile?.data || {};
      const learnerName = pData.learnerName || 'Learner';
      const hour = new Date().getHours();
      const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

      const greetingEl = document.getElementById('pl-header-greeting');
      if (greetingEl) greetingEl.textContent = `${timeGreeting}, ${learnerName} 👋`;

      const curr = this.plEngine.getActiveCurriculum();
      const currBadge = document.getElementById('pl-header-curriculum-badge');
      if (currBadge && curr) {
        currBadge.innerHTML = `<span>${escapeHtml(curr.boardSystem || curr.title)} &middot; ${escapeHtml(curr.educationalLevel || 'Secondary')}</span>`;
      }

      const summary = this.plEngine.getMasterySummary();
      const masteryEl = document.getElementById('pl-header-mastery-pct');
      if (masteryEl) masteryEl.textContent = `${summary.masteryRatio}%`;

      // Render School Sections
      this.renderPlContinueHero();
      this.renderPlTodayPlan();
      this.renderPlSubjects();
      this.renderPlPathNodes();
      this.renderPlGapsAndRevision();
      this.renderPlBundleManager();
    }
  }

  // Section 1: Continue Learning Hero (Most Prominent Action)
  renderPlContinueHero() {
    const c = this.plEngine.getLastActiveConcept();
    if (!c) return;

    const titleEl = document.getElementById('pl-continue-concept-title');
    const badgeEl = document.getElementById('pl-continue-subject-badge');
    const crumbEl = document.getElementById('pl-continue-breadcrumb');
    const descEl = document.getElementById('pl-continue-desc');

    const curr = this.plEngine.getActiveCurriculum();

    if (titleEl) titleEl.textContent = c.title;
    if (badgeEl) badgeEl.textContent = c.subjectShortTitle || 'Science';
    if (crumbEl) {
      crumbEl.innerHTML = `<span>${escapeHtml(curr ? curr.boardSystem : 'Curriculum')}</span> &gt; <span>${escapeHtml(c.unitTitle || 'Unit')}</span> &gt; <span>${escapeHtml(c.topicTitle || 'Topic')}</span>`;
    }
    if (descEl) descEl.textContent = c.overview || c.learningOutcome || 'Explore this concept through structured notes, visual media, and authentic ISL 3D signing.';
  }

  // Section 2: Today's Learning (Dynamic Daily Plan)
  renderPlTodayPlan() {
    const container = document.getElementById('pl-today-plan-container');
    if (!container) return;

    const plan = this.plEngine.generateDailyPlan();
    if (plan.length === 0) {
      container.innerHTML = '<div class="pl-path-empty-box"><p>No learning items scheduled for today. Select any subject below to begin.</p></div>';
      return;
    }

    container.innerHTML = plan.map(item => `
      <div class="pl-today-card" data-concept-id="${item.concept.id}" data-target-step="${item.targetStep}">
        <div class="pl-tc-head">
          <span class="pl-tc-badge ${item.badgeClass}">${escapeHtml(item.badge)}</span>
          <span class="pl-tc-icon">${item.icon}</span>
        </div>
        <h4 class="pl-tc-title">${escapeHtml(item.title)}</h4>
        <p class="pl-tc-desc">${escapeHtml(item.description)}</p>
        <div class="pl-tc-action">
          <span>${escapeHtml(item.actionLabel)}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.pl-today-card').forEach(card => {
      card.addEventListener('click', () => {
        const cId = card.dataset.conceptId;
        const targetStep = card.dataset.targetStep || 'notes';
        const c = this.plEngine.getConceptById(cId);
        if (c) this.loadPlConceptIntoStudio(c, targetStep);
      });
    });
  }

  // Section 3: My Subjects (Real Progress, Zero Fabrication)
  renderPlSubjects() {
    const container = document.getElementById('pl-subjects-cards-container');
    if (!container) return;

    const subjects = this.plEngine.getSubjectsSummary();
    if (subjects.length === 0) {
      container.innerHTML = '<div class="pl-path-empty-box"><p>Add your curriculum to begin exploring subjects.</p></div>';
      return;
    }

    container.innerHTML = subjects.map(s => `
      <div class="pl-subject-card" data-subject-id="${s.id}">
        <div class="pl-sc-header">
          <div class="pl-sc-icon-title">
            <span class="pl-sc-icon">${s.icon}</span>
            <h3 class="pl-sc-title">${escapeHtml(s.title)}</h3>
          </div>
          <span class="pl-continue-time">${s.progressPercent}% Complete</span>
        </div>
        <div class="pl-sc-progress-bar">
          <div class="pl-sc-progress-fill" style="width: ${s.progressPercent}%;"></div>
        </div>
        <div class="pl-sc-stats-row">
          <span>${s.masteredCount} of ${s.totalConcepts} Mastered</span>
          <span>${s.developingCount} Developing</span>
        </div>
        <div class="pl-sc-next-box">
          <div>
            <div class="pl-sc-next-label">CURRENT TOPIC</div>
            <div class="pl-sc-next-title">${escapeHtml(s.currentTopic)}</div>
          </div>
          <button class="pl-btn-open-concept" data-concept-id="${s.nextConcept ? s.nextConcept.id : ''}">
            <span>Learn in ISL</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.pl-btn-open-concept, .pl-subject-card').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const cId = el.dataset.conceptId || el.querySelector('.pl-btn-open-concept')?.dataset.conceptId;
        const c = cId ? this.plEngine.getConceptById(cId) : null;
        if (c) {
          this.loadPlConceptIntoStudio(c, 'notes');
        } else {
          const sId = el.dataset.subjectId;
          const s = subjects.find(sub => sub.id === sId);
          if (s && s.nextConcept) this.loadPlConceptIntoStudio(s.nextConcept, 'notes');
        }
      });
    });
  }

  // Section 4: My Learning Path (Visual Node Timeline)
  renderPlPathNodes() {
    const container = document.getElementById('pl-path-node-timeline');
    if (!container) return;

    const path = this.plEngine.getPersonalizedPath();
    if (path.length === 0) {
      container.innerHTML = '<div class="pl-path-empty-box"><p>No concepts in active path.</p></div>';
      return;
    }

    container.innerHTML = path.map((item, idx) => {
      const c = item.concept;
      const statusClass = item.nodeStatus;
      let badgeClass = 'badge-continue';
      if (item.nodeStatus === 'mastered') badgeClass = 'badge-assess';
      if (item.nodeStatus === 'gap') badgeClass = 'badge-gap';
      if (item.nodeStatus === 'locked') badgeClass = 'status-not-assessed';

      return `
        <div class="pl-path-node ${statusClass}" data-concept-id="${c.id}" data-target-step="${item.targetStep}">
          <div class="pl-pn-head">
            <span class="pl-pn-badge ${badgeClass}">${escapeHtml(item.badge)}</span>
            <span class="pl-path-seq-num">#${idx + 1}</span>
          </div>
          <h4 class="pl-pn-title">${escapeHtml(c.title)}</h4>
          <p class="pl-pn-sub">${escapeHtml(item.rationale)}</p>
          <div class="pl-pn-action">
            <span>${escapeHtml(item.actionLabel)} &rarr;</span>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.pl-path-node').forEach(node => {
      node.addEventListener('click', () => {
        const cId = node.dataset.conceptId;
        const targetStep = node.dataset.targetStep || 'notes';
        const c = this.plEngine.getConceptById(cId);
        if (c) this.loadPlConceptIntoStudio(c, targetStep);
      });
    });
  }

  // Section 5 & 6: Needs Attention and Spaced Revision
  renderPlGapsAndRevision() {
    const gapsContainer = document.getElementById('pl-gaps-container');
    const revContainer = document.getElementById('pl-spaced-revision-container');

    // 1. Learning Gaps
    if (gapsContainer) {
      const gaps = this.plEngine.getIdentifiedLearningGaps();
      if (gaps.length === 0) {
        gapsContainer.innerHTML = `
          <div class="pl-gap-card" style="border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.06);">
            <div class="pl-gap-info">
              <strong style="color: #34d399;">✓ No Critical Gaps Flagged</strong>
              <span style="color: #94a3b8;">All assessed concepts meet or exceed mastery criteria.</span>
            </div>
          </div>
        `;
      } else {
        gapsContainer.innerHTML = gaps.map(g => `
          <div class="pl-gap-card">
            <div class="pl-gap-info">
              <strong class="pl-gap-title">${escapeHtml(g.concept.title)}</strong>
              <span class="pl-gap-desc">${escapeHtml(g.reason)}</span>
            </div>
            <button class="pl-btn-open-concept" data-concept-id="${g.concept.id}">
              <span>Reinforce in ISL</span>
            </button>
          </div>
        `).join('');

        gapsContainer.querySelectorAll('.pl-btn-open-concept').forEach(btn => {
          btn.addEventListener('click', () => {
            const c = this.plEngine.getConceptById(btn.dataset.conceptId);
            if (c) this.loadPlConceptIntoStudio(c, 'terms');
          });
        });
      }
    }

    // 2. Spaced Revision
    if (revContainer) {
      const reviews = this.plEngine.getSpacedReviewItems();
      if (reviews.length === 0) {
        revContainer.innerHTML = `
          <div class="pl-rev-card" style="border-color: rgba(56, 189, 248, 0.3); background: rgba(56, 189, 248, 0.06);">
            <div class="pl-rev-info">
              <strong style="color: #38bdf8;">🧠 Retention Queue Consolidated</strong>
              <span style="color: #94a3b8;">No concepts currently due for interval memory review.</span>
            </div>
          </div>
        `;
      } else {
        revContainer.innerHTML = reviews.map(r => `
          <div class="pl-rev-card">
            <div class="pl-rev-info">
              <strong class="pl-rev-title">${escapeHtml(r.concept.title)}</strong>
              <span class="pl-rev-desc">${r.repetitions} repetition(s) completed &middot; ${r.intervalDays} day interval</span>
            </div>
            <button class="pl-btn-open-concept" data-concept-id="${r.concept.id}">
              <span>Review Concept</span>
            </button>
          </div>
        `).join('');

        revContainer.querySelectorAll('.pl-btn-open-concept').forEach(btn => {
          btn.addEventListener('click', () => {
            const c = this.plEngine.getConceptById(btn.dataset.conceptId);
            if (c) this.loadPlConceptIntoStudio(c, 'notes');
          });
        });
      }
    }
  }

  // Section 7: Curriculum Bundles & Offline Manager
  renderPlBundleManager() {
    const container = document.getElementById('pl-bundles-list-container');
    if (!container) return;

    const bundles = this.plEngine.getAvailableBundles();
    const active = this.plEngine.getActiveCurriculum();
    const activeId = active ? (active.bundleId || active.id) : '';

    container.innerHTML = bundles.map(b => `
      <div class="pl-bundle-item-card ${b.bundleId === activeId ? 'active' : ''}">
        <div class="pl-bic-head">
          <span class="pl-bic-tag">${escapeHtml(b.boardSystem)}</span>
          ${b.bundleId === activeId ? '<span class="pl-bic-active-pill">ACTIVE CURRICULUM</span>' : ''}
        </div>
        <h4 class="pl-bic-title">${escapeHtml(b.title)}</h4>
        <p class="pl-bic-desc">${escapeHtml(b.description || '')}</p>
        <div class="pl-bic-footer">
          <span class="pl-c-badge not-assessed">${b.subjectCount} Subjects</span>
          ${b.bundleId !== activeId ? `
            <button class="pl-btn-secondary pl-btn-sm pl-btn-switch-bundle" data-bundle-id="${b.bundleId}">
              <span>Switch Curriculum</span>
            </button>
          ` : '<span style="font-size: 11px; color: #38bdf8; font-weight: 700;">✓ Current</span>'}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.pl-btn-switch-bundle').forEach(btn => {
      btn.addEventListener('click', () => {
        const bId = btn.dataset.bundleId;
        this.plEngine.setActiveCurriculum(bId);
        this.renderPersonalizedLearning();
        this.updateAssistantSyllabusHeader();
      });
    });
  }

  // Section 8: Load Concept into the 7-Stage Digital Classroom Studio
  loadPlConceptIntoStudio(concept, initialStep = 'introduce') {
    if (!concept) return;
    this.plActiveConcept = concept;
    this.plEngine.setLastActiveConcept(concept.id);
    this.updateAssistantSyllabusHeader();

    const studioEl = document.getElementById('pl-active-learning-area');
    if (studioEl) studioEl.classList.remove('hidden');

    const curr = this.plEngine.getActiveCurriculum();
    const titleEl = document.getElementById('pl-studio-concept-title');
    const breadcrumbEl = document.getElementById('pl-studio-breadcrumb');

    if (titleEl) titleEl.textContent = concept.title;
    if (breadcrumbEl) {
      breadcrumbEl.innerHTML = `<span>${escapeHtml(curr ? curr.boardSystem : 'Curriculum')}</span> &middot; <span>${escapeHtml(concept.unitTitle || 'Unit')}</span> &middot; <span>${escapeHtml(concept.topicTitle || 'Topic')}</span>`;
    }

    // Step 1: Introduce
    const introOverview = document.getElementById('pl-intro-overview-text');
    const introOutcome = document.getElementById('pl-intro-outcome-text');
    if (introOverview) introOverview.textContent = concept.overview || concept.explanation || 'Educational overview for this concept.';
    if (introOutcome) introOutcome.textContent = concept.learningOutcome || 'Demonstrate conceptual clarity through structured notes and authentic ISL comprehension.';

    // Step 2: Notes & Explain
    const defsList = document.getElementById('pl-notes-definitions-list');
    const ptsList = document.getElementById('pl-notes-keypoints-list');
    if (defsList) {
      const defs = concept.notes?.definitions || [{ term: concept.title, def: concept.overview || concept.explanation }];
      defsList.innerHTML = defs.map(d => `
        <div class="pl-def-item">
          <span class="pl-def-term">${escapeHtml(d.term)}:</span>
          <span class="pl-def-text">${escapeHtml(d.def)}</span>
        </div>
      `).join('');
    }
    if (ptsList) {
      const pts = concept.notes?.keyPoints || [concept.learningOutcome || 'Focus on the visual representation of this concept.'];
      ptsList.innerHTML = pts.map(pt => `<li>${escapeHtml(pt)}</li>`).join('');
    }

    // Step 3: See & Video (Feature 1: Video Lesson with Audio-Off ISL Mode)
    const videoBox = document.getElementById('pl-video-container');
    const transcriptEl = document.getElementById('pl-video-transcript-text');
    if (videoBox) {
      this.renderPlVideoPlayer(videoBox, concept);
    }
    if (transcriptEl) {
      transcriptEl.textContent = concept.video?.transcript || concept.overview || 'Educational audio transcript available for full visual comprehension.';
    }

    // Update Two-Way ISL Mode 2 Quiz Card with current concept assessment
    this.updatePlTwoWayQuizCard(concept);

    // Step 4: Sign (ISL Terms Deck)
    const chipsContainer = document.getElementById('pl-concept-keywords-chips');
    const noticeEl = document.getElementById('pl-hud-unavailable-notice');
    if (noticeEl) noticeEl.classList.add('hidden');

    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      const keywords = concept.islKeywords || [concept.title.toLowerCase()];
      keywords.forEach((kw, idx) => {
        const chip = document.createElement('button');
        chip.className = 'pl-concept-term-chip' + (idx === 0 ? ' active' : '');
        chip.innerHTML = `<span class="chip-dot"></span><span>${escapeHtml(kw)}</span>`;
        chip.addEventListener('click', () => {
          chipsContainer.querySelectorAll('.pl-concept-term-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');

          const glossEl = document.getElementById('pl-hud-active-gloss');
          const phraseEl = document.getElementById('pl-hud-active-phrase');
          if (glossEl) glossEl.textContent = kw.toUpperCase();
          if (phraseEl) phraseEl.textContent = `Demonstrating: "${kw}"`;

          window.signCurriculumText?.(kw, keywords);
        });
        chipsContainer.appendChild(chip);
      });
    }

    // Step 5: Practice Drill Counter
    const repEl = document.getElementById('pl-drill-rep-count');
    const state = this.plEngine.getConceptState(concept.id);
    if (repEl) repEl.textContent = state.practiceReps || 0;

    // Step 6: Assess
    const qEl = document.getElementById('pl-assess-question-text');
    const optsList = document.getElementById('pl-assess-options-list');
    const fbBox = document.getElementById('pl-assess-feedback-box');
    const gotoMasterBtn = document.getElementById('pl-btn-goto-master');

    if (qEl) qEl.textContent = concept.assessment?.question || `What is the primary role of ${concept.title}?`;
    if (fbBox) fbBox.classList.add('hidden');
    if (gotoMasterBtn) gotoMasterBtn.disabled = true;

    if (optsList) {
      optsList.innerHTML = '';
      const options = concept.assessment?.options || [concept.title, 'Alternative B', 'Alternative C', 'Alternative D'];
      const correctIdx = concept.assessment?.correctIndex ?? 0;

      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'pl-assess-option-btn';
        btn.innerHTML = `<span class="pl-opt-letter">${String.fromCharCode(65 + idx)}</span><span>${escapeHtml(opt)}</span>`;
        btn.addEventListener('click', () => {
          optsList.querySelectorAll('.pl-assess-option-btn').forEach(b => b.disabled = true);
          const isCorrect = idx === correctIdx;
          if (isCorrect) {
            btn.classList.add('correct');
          } else {
            btn.classList.add('incorrect');
            const cBtn = optsList.children[correctIdx];
            if (cBtn) cBtn.classList.add('correct');
          }

          this.plEngine.recordAssessmentResult(concept.id, isCorrect);

          if (fbBox) {
            const fTitle = document.getElementById('pl-feedback-title');
            const fDesc = document.getElementById('pl-feedback-desc');
            if (fTitle) {
              fTitle.textContent = isCorrect ? '✓ Correct! Concept Comprehension Verified' : '✗ Incorrect. Concept Flagged for Practice';
              fTitle.className = isCorrect ? 'pl-fb-title success' : 'pl-fb-title error';
            }
            if (fDesc) {
              fDesc.textContent = concept.assessment?.explanation || (isCorrect ? 'Well done! You demonstrated concept mastery.' : 'Review the structured notes and sign along to reinforce understanding.');
            }
            fbBox.classList.remove('hidden');
          }

          if (gotoMasterBtn) gotoMasterBtn.disabled = false;
          this.renderPlContinueHero();
          this.renderPlSubjects();
          this.renderPlPathNodes();
          this.renderPlGapsAndRevision();
        });
        optsList.appendChild(btn);
      });
    }

    // Step 7: Master & Adapt
    this.refreshPlMasterPane(concept);

    this.setPlStudioStep(initialStep);

    // Mount 3D avatar within studio canvas
    const canvasMount = document.getElementById('edu-curriculum-canvas');
    if (canvasMount && window.mountCurriculumSigner) {
      window.mountCurriculumSigner(canvasMount);
    }

    setTimeout(() => {
      if (this.plActiveConcept && this.plActiveConcept.id === concept.id) {
        const signTerm = (concept.islKeywords && concept.islKeywords[0]) || concept.title;
        window.signCurriculumText?.(signTerm, concept.islKeywords || []);
      }
    }, 600);

    studioEl?.scrollIntoView({ behavior: 'smooth' });
  }

  refreshPlMasterPane(concept) {
    const state = this.plEngine.getConceptState(concept.id);
    const mStatus = document.getElementById('pl-master-status-badge');
    const mAcc = document.getElementById('pl-master-accuracy');
    const mAtt = document.getElementById('pl-master-attempts');
    const mReps = document.getElementById('pl-master-reps');

    if (mStatus) mStatus.textContent = state.status.replace('_', ' ').toUpperCase();
    if (mAcc) mAcc.textContent = `${state.accuracy}%`;
    if (mAtt) mAtt.textContent = state.attempts || 0;
    if (mReps) mReps.textContent = state.practiceReps || 0;

    const adaptTag = document.getElementById('pl-master-adapt-tag');
    const adaptTitle = document.getElementById('pl-master-adapt-title');
    const adaptDesc = document.getElementById('pl-master-adapt-desc');
    const adaptBtn = document.getElementById('pl-btn-master-action');

    const nextSteps = this.plEngine.getPersonalizedNextSteps();
    const nextRec = nextSteps[0];

    if (nextRec) {
      if (adaptTag) adaptTag.textContent = nextRec.tag.toUpperCase();
      if (adaptTitle) adaptTitle.textContent = nextRec.title;
      if (adaptDesc) adaptDesc.textContent = nextRec.rationale;
      if (adaptBtn) {
        const span = adaptBtn.querySelector('span');
        if (span) span.textContent = nextRec.actionLabel;
      }
    }
  }

  setPlStudioStep(stepId) {
    this.plActiveStep = stepId;

    document.querySelectorAll('#pl-studio-tabs .pl-st-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.step === stepId);
    });

    document.querySelectorAll('#pl-active-learning-area .pl-step-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `pl-step-${stepId}`);
    });

    if (stepId === 'video' && this.plActiveConcept) {
      const videoBox = document.getElementById('pl-video-container');
      if (videoBox && !document.getElementById('pl-video-canvas')) {
        this.renderPlVideoPlayer(videoBox, this.plActiveConcept);
      }
    }

    if (stepId === 'terms') {
      if (this.plActiveConcept) {
        const term = (this.plActiveConcept.islKeywords && this.plActiveConcept.islKeywords[0]) || this.plActiveConcept.title;
        window.signCurriculumText?.(term, this.plActiveConcept.islKeywords || []);
      }
    }

    if (stepId === 'master' && this.plActiveConcept) {
      this.refreshPlMasterPane(this.plActiveConcept);
    }
  }

  selectCurriculumSubject(subjectId) {
    this.plSelectedSubjectId = subjectId;
    this.renderPlSubjects();
  }

  openCurriculumLesson(lessonId) {
    const concept = this.plEngine?.getConceptById(lessonId) || this.plEngine?.getAllActiveConcepts().find(c => c.id.includes(lessonId) || lessonId.includes(c.id));
    if (concept) {
      this.loadPlConceptIntoStudio(concept, 'introduce');
    }
  }

  selectSubject(subjectId) {
    this.selectCurriculumSubject(subjectId);
  }

  openLesson(lessonId, chapter, subject) {
    this.openCurriculumLesson(lessonId);
  }
  // -------------------------------------------------------
  // ACADEMIC ASSISTANCE TAB (TWO-WAY SYLLABUS-AWARE SYSTEM)
  // -------------------------------------------------------
  setupAssistantTab() {
    this.updateAssistantSyllabusHeader();

    // 1. Unified Bottom Input Bar: Text Input & Send
    const searchInput = document.getElementById('assistant-search-input');
    const sendBtn = document.getElementById('assistant-send-btn');

    sendBtn?.addEventListener('click', () => this.submitAcademicQueryFromInput());
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitAcademicQueryFromInput();
      }
    });

    // 2. Regional Voice Input Controller
    const langSelect = document.getElementById('assistant-voice-lang-select');
    const micBtn = document.getElementById('assistant-btn-mic');
    const stopVoiceBtn = document.getElementById('assistant-btn-voice-stop');
    const cancelVoiceBtn = document.getElementById('assistant-btn-voice-cancel');

    if (langSelect) {
      langSelect.value = speechInputService.getLanguage();
      langSelect.addEventListener('change', () => {
        speechInputService.setLanguage(langSelect.value);
      });
    }

    micBtn?.addEventListener('click', () => this.toggleAssistantVoice());
    stopVoiceBtn?.addEventListener('click', () => this.stopAssistantVoice());
    cancelVoiceBtn?.addEventListener('click', () => this.cancelAssistantVoice());

    // Wire speech service events
    speechInputService.onStateChange = (state) => {
      const voiceBar = document.getElementById('assistant-voice-active-bar');
      const micEl = document.getElementById('assistant-btn-mic');
      const statusTitle = document.getElementById('assistant-voice-status-title');

      if (state === SPEECH_STATES.LISTENING) {
        voiceBar?.classList.remove('hidden');
        micEl?.classList.add('listening');
        const langName = speechInputService.getLanguageName ? speechInputService.getLanguageName() : 'selected language';
        if (statusTitle) statusTitle.textContent = `Listening... Speak your academic doubt in ${langName}`;
      } else if (state === SPEECH_STATES.PROCESSING) {
        micEl?.classList.remove('listening');
        if (statusTitle) statusTitle.textContent = 'Processing speech & translating internally...';
      } else if (state === SPEECH_STATES.ERROR) {
        micEl?.classList.remove('listening');
      } else {
        voiceBar?.classList.add('hidden');
        micEl?.classList.remove('listening');
      }
    };

    speechInputService.onAudioLevel = (level) => {
      const bar = document.getElementById('assistant-voice-vu-bar');
      if (bar) bar.style.width = `${level}%`;
    };

    speechInputService.onInterimTranscript = (text) => {
      const statusTitle = document.getElementById('assistant-voice-status-title');
      if (statusTitle && text) {
        statusTitle.textContent = `"${text}..."`;
      }
    };

    speechInputService.onFinalResult = (res) => {
      if (res && res.spokenText) {
        document.getElementById('assistant-voice-active-bar')?.classList.add('hidden');
        document.getElementById('assistant-btn-mic')?.classList.remove('listening');
        this.submitAcademicQuery(res.spokenText, 'speak', res.englishText);
      }
    };

    speechInputService.onError = (err) => {
      const statusTitle = document.getElementById('assistant-voice-status-title');
      const isDenied = err?.code === 'permission-denied' || err?.code === 'not-allowed';
      const isNoSpeech = err?.code === 'no-speech';

      if (statusTitle) {
        if (isDenied) {
          statusTitle.textContent = '❌ Microphone access denied. Voice input requires microphone permission.';
        } else if (isNoSpeech) {
          statusTitle.textContent = '⚠️ No speech detected. Please speak clearly into your microphone.';
        } else {
          statusTitle.textContent = err?.message || 'Speech recognition failed.';
        }
      }

      if (typeof window.showToast === 'function') {
        window.showToast(isDenied
          ? 'Microphone permission denied. Please allow microphone permissions in browser settings.'
          : (err?.message || 'Speech input error.'));
      }

      setTimeout(() => {
        document.getElementById('assistant-voice-active-bar')?.classList.add('hidden');
        document.getElementById('assistant-btn-mic')?.classList.remove('listening');
      }, isDenied ? 4000 : 2500);
    };

    // 3. Indian Sign Language (ISL) Camera Controls
    const cameraBtn = document.getElementById('assistant-btn-camera');
    const closeIslBtn = document.getElementById('assistant-btn-close-isl');
    const startCamBtn = document.getElementById('assistant-btn-start-camera');
    const toggleCamBtn = document.getElementById('assistant-btn-toggle-cam');
    const clearSeqBtn = document.getElementById('assistant-btn-clear-seq');
    const submitIslBtn = document.getElementById('assistant-btn-submit-isl');

    cameraBtn?.addEventListener('click', () => this.toggleAssistantIslPanel());
    closeIslBtn?.addEventListener('click', () => this.closeAssistantIslPanel());
    startCamBtn?.addEventListener('click', () => this.startAssistantIslCamera());
    toggleCamBtn?.addEventListener('click', () => this.toggleAssistantIslCamera());
    clearSeqBtn?.addEventListener('click', () => this.clearAssistantIslSequence());
    submitIslBtn?.addEventListener('click', () => this.submitAssistantIslQuery());

    // Quick Sign Pick buttons (Verifiable vocabulary shortcuts)
    document.querySelectorAll('.isl-vocab-shortcuts .ivs-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const sign = chip.dataset.sign || chip.textContent.trim();
        if (sign) {
          this.addSignToAssistantSequence(sign);
        }
      });
    });

    // 4. Quick Prompt Shortcut Chips
    document.querySelectorAll('.assistant-quick-prompts .prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query || chip.textContent.replace(/^"|"$/g, '').trim();
        if (query) {
          const inp = document.getElementById('assistant-search-input');
          if (inp) inp.value = query;
          this.submitAcademicQuery(query, 'type');
        }
      });
    });

    // 5. Navigation & Avatar Controls
    document.getElementById('edu-assistant-btn-jump-pl')?.addEventListener('click', () => {
      this.switchView('view-personalized-learning');
    });

    document.getElementById('assistant-btn-open-in-studio')?.addEventListener('click', () => {
      const c = this.assistantActiveConcept || this.plEngine?.getLastActiveConcept();
      if (c) {
        this.switchView('view-personalized-learning');
        this.loadPlConceptIntoStudio(c, 'introduce');
      }
    });

    document.getElementById('assistant-btn-recenter-avatar')?.addEventListener('click', () => {
      const mount = document.getElementById('edu-assistant-avatar-canvas');
      if (mount && window.mountCurriculumSigner) {
        window.mountCurriculumSigner(mount);
      }
    });

    document.querySelectorAll('#assistant-speed-chips .as-speed-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const spd = parseFloat(chip.dataset.speed);
        document.querySelectorAll('#assistant-speed-chips .as-speed-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (window.signSyncController) {
          window.signSyncController.setPlaybackRate(spd);
        } else if (window.setGlobalPlaybackSpeed) {
          window.setGlobalPlaybackSpeed(spd);
        }
      });
    });

    // 6. TTS state listener for button syncing
    ttsService.onStateChange = ({ state, messageId }) => {
      document.querySelectorAll('.ans-tts-btn').forEach(btn => {
        const mId = btn.dataset.msgId;
        if (mId === messageId && state === TTS_STATES.PLAYING) {
          btn.classList.add('playing');
          btn.innerHTML = `<span>⏸️ Pause</span>`;
        } else if (mId === messageId && state === TTS_STATES.PAUSED) {
          btn.classList.remove('playing');
          btn.innerHTML = `<span>▶️ Resume</span>`;
        } else {
          btn.classList.remove('playing');
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg><span>Listen (TTS)</span>`;
        }
      });
    };
  }

  // Helper to open/toggle the ISL Camera panel
  toggleAssistantIslPanel() {
    const panel = document.getElementById('assistant-isl-mode-panel');
    const camBtn = document.getElementById('assistant-btn-camera');
    if (!panel) return;
    const isCurrentlyOpen = !panel.classList.contains('hidden');
    if (isCurrentlyOpen) {
      this.closeAssistantIslPanel();
    } else {
      panel.classList.remove('hidden');
      camBtn?.classList.add('active');
      this.startAssistantIslCamera();
      setTimeout(() => {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  closeAssistantIslPanel() {
    const panel = document.getElementById('assistant-isl-mode-panel');
    const camBtn = document.getElementById('assistant-btn-camera');
    panel?.classList.add('hidden');
    camBtn?.classList.remove('active');
    this.stopAssistantIslCamera();
  }

  updateAssistantSyllabusHeader() {
    const badge = document.getElementById('edu-assistant-curriculum-badge');
    const topicBadge = document.getElementById('edu-assistant-active-topic-badge');
    const accTitle = document.getElementById('assistant-acc-title');
    const accDesc = document.getElementById('assistant-acc-desc');

    if (!this.plEngine) {
      this.plEngine = window.personalizedLearningEngine || new PersonalizedLearningEngine(this.learnerProfile);
      window.personalizedLearningEngine = this.plEngine;
    }

    const curr = this.plEngine?.getActiveCurriculum();
    const lastActive = this.plEngine?.getLastActiveConcept();

    if (curr) {
      if (badge) {
        badge.textContent = `${curr.boardSystem || curr.pathwayName} (${curr.educationalLevel || 'Class 10'}) · ${lastActive?.subjectTitle || curr.subjects?.[0]?.title || 'Science'}`;
      }
      if (topicBadge) {
        topicBadge.textContent = `Current: ${lastActive ? lastActive.title : 'Overview'}`;
      }
      if (accTitle && lastActive) {
        accTitle.textContent = lastActive.title;
      }
      if (accDesc && lastActive) {
        accDesc.textContent = lastActive.overview || lastActive.explanation || 'Active curriculum concept from your personalized learning pathway.';
      }
    } else {
      if (badge) badge.textContent = 'Tamil Nadu SSLC (Class 10) · Science';
      if (topicBadge) topicBadge.textContent = 'Current: Newton\'s Second Law / Cell Biology';
    }
  }

  submitAcademicQueryFromInput() {
    const input = document.getElementById('assistant-search-input');
    const text = input?.value?.trim();
    if (!text) return;
    if (input) input.value = '';
    this.submitAcademicQuery(text, 'type');
  }

  // Voice Controls
  async toggleAssistantVoice() {
    if (speechInputService.state === SPEECH_STATES.LISTENING) {
      await this.stopAssistantVoice();
    } else {
      await speechInputService.startListening();
    }
  }

  async stopAssistantVoice() {
    await speechInputService.stopListening();
  }

  cancelAssistantVoice() {
    speechInputService.cancel();
    document.getElementById('assistant-voice-active-bar')?.classList.add('hidden');
    document.getElementById('assistant-btn-mic')?.classList.remove('listening');
  }

  // ISL Camera Controls with Explicit Permission & Error States
  async startAssistantIslCamera() {
    const video = document.getElementById('assistant-isl-video');
    const canvas = document.getElementById('assistant-isl-canvas');
    const placeholder = document.getElementById('assistant-isl-placeholder');
    const phTitle = document.getElementById('assistant-isl-ph-title');
    const phDesc = document.getElementById('assistant-isl-ph-desc');
    const startCamBtn = document.getElementById('assistant-btn-start-camera');
    const toggleCamBtn = document.getElementById('assistant-btn-toggle-cam');
    const statusTag = document.getElementById('assistant-isl-status-tag');
    const hint = document.getElementById('assistant-isl-hint');

    // 1. State: Camera permission requested
    if (statusTag) {
      statusTag.textContent = 'REQUESTING ACCESS';
      statusTag.className = 'assistant-hud-badge';
    }
    if (phTitle) phTitle.textContent = 'Requesting Camera Permission...';
    if (phDesc) phDesc.textContent = 'Please click "Allow" on your browser permission prompt to enable ISL gesture recognition.';
    if (startCamBtn) startCamBtn.style.display = 'none';
    if (hint) hint.textContent = 'Requesting webcam access. Please approve the prompt in your browser.';

    try {
      await islRecognitionService.start({
        videoElement: video,
        canvasElement: canvas,
        onPrediction: (res) => this.onAssistantIslPrediction(res),
        onStateChange: (state) => this.onAssistantIslStateChange(state),
        onSequenceUpdate: (seq) => this.onAssistantIslSequenceUpdate(seq)
      });

      // 2. State: Camera permission granted & stream active
      placeholder?.classList.add('hidden');
      if (toggleCamBtn) {
        toggleCamBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
          <span>Stop Camera</span>
        `;
      }
      if (statusTag) {
        statusTag.textContent = 'CAMERA ACTIVE';
        statusTag.className = 'assistant-hud-badge stable';
      }
      if (hint) hint.textContent = 'Camera active · Show signs clearly in frame (e.g. WHAT, CELL, FORCE, KEYBOARD) or tap quick signs below.';
      this.assistantIslActive = true;
    } catch (err) {
      console.warn('[EduApp] Assistant ISL Camera start error:', err);
      placeholder?.classList.remove('hidden');
      if (startCamBtn) {
        startCamBtn.style.display = 'inline-block';
        startCamBtn.textContent = 'Retry Camera';
      }

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        // State: Camera permission denied
        if (statusTag) {
          statusTag.textContent = 'PERMISSION DENIED';
          statusTag.className = 'assistant-hud-badge error';
        }
        if (phTitle) phTitle.textContent = 'Camera Permission Blocked';
        if (phDesc) phDesc.textContent = 'Browser blocked camera access. Please allow camera permissions in your address bar and click Retry.';
        if (hint) hint.textContent = 'Camera access denied. You can still construct questions using Quick Sign Pick below!';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        // State: Camera unavailable
        if (statusTag) {
          statusTag.textContent = 'NO CAMERA FOUND';
          statusTag.className = 'assistant-hud-badge error';
        }
        if (phTitle) phTitle.textContent = 'No Webcam Detected';
        if (phDesc) phDesc.textContent = 'No video capture device was found on this system. You can use Text, Voice, or Quick Sign Pick buttons.';
        if (hint) hint.textContent = 'Webcam unavailable. Tap Quick Sign Pick buttons below to ask your doubt in ISL.';
      } else {
        // State: Generic camera failure
        if (statusTag) {
          statusTag.textContent = 'CAMERA ERROR';
          statusTag.className = 'assistant-hud-badge error';
        }
        if (phTitle) phTitle.textContent = 'Camera Unavailable';
        if (phDesc) phDesc.textContent = err.message || 'Unable to initialize webcam stream. Please check settings or select signs below.';
        if (hint) hint.textContent = 'Camera error. Use Quick Sign Pick buttons below or type/speak your doubt.';
      }
      this.assistantIslActive = false;
    }
  }

  stopAssistantIslCamera() {
    islRecognitionService.stop();
    const placeholder = document.getElementById('assistant-isl-placeholder');
    const phTitle = document.getElementById('assistant-isl-ph-title');
    const phDesc = document.getElementById('assistant-isl-ph-desc');
    const startCamBtn = document.getElementById('assistant-btn-start-camera');
    const toggleCamBtn = document.getElementById('assistant-btn-toggle-cam');
    const statusTag = document.getElementById('assistant-isl-status-tag');
    const hint = document.getElementById('assistant-isl-hint');

    placeholder?.classList.remove('hidden');
    if (phTitle) phTitle.textContent = 'Camera Standby';
    if (phDesc) phDesc.textContent = 'Click "Start Camera" to activate your webcam for ISL gesture recognition.';
    if (startCamBtn) {
      startCamBtn.style.display = 'inline-block';
      startCamBtn.textContent = 'Start Camera';
    }
    if (toggleCamBtn) {
      toggleCamBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
        <span>Start Camera</span>
      `;
    }
    if (statusTag) {
      statusTag.textContent = 'STANDBY';
      statusTag.className = 'assistant-hud-badge';
    }
    if (hint) hint.textContent = 'Camera stopped. Click "Start Camera" or tap Quick Sign Pick chips below.';
    this.assistantIslActive = false;
  }

  toggleAssistantIslCamera() {
    if (islRecognitionService.isRunning) {
      this.stopAssistantIslCamera();
    } else {
      this.startAssistantIslCamera();
    }
  }

  onAssistantIslPrediction(res) {
    const predLabel = document.getElementById('assistant-isl-pred-label');
    const confText = document.getElementById('assistant-isl-conf-text');
    const confBar = document.getElementById('assistant-isl-conf-bar');
    const hint = document.getElementById('assistant-isl-hint');

    if (!res || !res.label) {
      if (predLabel) predLabel.textContent = '—';
      if (confText) confText.textContent = '0%';
      if (confBar) {
        confBar.style.width = '0%';
        confBar.style.background = 'linear-gradient(90deg, #38bdf8, #818cf8)';
      }
      if (hint) hint.textContent = 'No sign detected. Position hand clearly in front of camera.';
      return;
    }

    if (predLabel) predLabel.textContent = res.label;
    if (confText) confText.textContent = `${res.confidence}%`;
    if (confBar) {
      confBar.style.width = `${res.confidence}%`;
      if (res.confidence >= 65) {
        confBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
      } else {
        confBar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
      }
    }

    if (hint) {
      if (res.confidence >= 65) {
        hint.textContent = `Recognized sign "${res.label}" (${res.confidence}%). Hold steady to commit.`;
      } else {
        hint.textContent = `Low confidence (${res.confidence}%). Hold sign steadier or select from Quick Sign Pick.`;
      }
    }
  }

  onAssistantIslStateChange(state) {
    const tag = document.getElementById('assistant-isl-status-tag');
    if (!tag) return;

    if (state === RECOGNITION_STATES.STABLE) {
      tag.textContent = 'STABLE SIGN';
      tag.className = 'assistant-hud-badge stable';
    } else if (state === RECOGNITION_STATES.DETECTING) {
      tag.textContent = 'DETECTING';
      tag.className = 'assistant-hud-badge';
    } else if (state === RECOGNITION_STATES.COMMITTED || state === RECOGNITION_STATES.WAIT_CHANGE) {
      tag.textContent = 'COMMITTED';
      tag.className = 'assistant-hud-badge stable';
    } else {
      tag.textContent = 'STANDBY';
      tag.className = 'assistant-hud-badge';
    }
  }

  addSignToAssistantSequence(sign) {
    if (!sign) return;
    islRecognitionService.addManualToken(sign);
  }

  onAssistantIslSequenceUpdate(seq) {
    const box = document.getElementById('assistant-isl-seq-box');
    const count = document.getElementById('assistant-isl-seq-count');
    const submitBtn = document.getElementById('assistant-btn-submit-isl');

    const total = (seq && Array.isArray(seq)) ? seq.length : 0;
    if (count) count.textContent = `${total} sign${total === 1 ? '' : 's'}`;

    if (box) {
      if (total === 0) {
        box.innerHTML = '<span class="as-seq-empty">Show signs to your camera or tap supported concepts below.</span>';
      } else {
        box.innerHTML = seq.map(tok => `<span class="as-seq-token">${escapeHtml(tok)}</span>`).join(' ');
      }
    }

    if (submitBtn) {
      submitBtn.disabled = (total === 0);
    }
  }

  clearAssistantIslSequence() {
    islRecognitionService.clearSequence();
    const count = document.getElementById('assistant-isl-seq-count');
    if (count) count.textContent = '0 signs';
    const submitBtn = document.getElementById('assistant-btn-submit-isl');
    if (submitBtn) submitBtn.disabled = true;
    const box = document.getElementById('assistant-isl-seq-box');
    if (box) box.innerHTML = '<span class="as-seq-empty">Show signs to your camera or tap supported concepts below.</span>';
  }

  retryAssistantIslSequence() {
    const predLabel = document.getElementById('assistant-isl-pred-label');
    const hint = document.getElementById('assistant-isl-hint');
    if (predLabel) predLabel.textContent = '—';
    if (hint) hint.textContent = 'Ready for sign. Position hand clearly in camera view.';
  }

  submitAssistantIslQuery() {
    // Commit active prediction if present
    islRecognitionService.commitActivePrediction();
    const seq = islRecognitionService.getStatus().committedSequence;
    const queryText = (seq && seq.length > 0) ? seq.join(' ') : (islRecognitionService.getPrediction() || '');

    if (!queryText.trim()) return;

    // Close ISL panel smoothly
    this.closeAssistantIslPanel();
    this.clearAssistantIslSequence();

    // Submit academic query in Sign mode
    this.submitAcademicQuery(queryText.trim(), 'sign');
  }

  // Unified Multi-Modal Academic Processing
  async submitAcademicQuery(queryText, mode = 'type', internalEnglish = null) {
    const clean = queryText.trim();
    if (!clean) return;

    const feed = document.getElementById('assistant-feed');
    if (!feed) return;

    // 1. Render User Message Card
    const modeIcons = { type: '⌨️', speak: '🎙️', sign: '🤟' };
    const modeLabels = { type: 'Text Doubt', speak: 'Spoken Voice Doubt', sign: 'ISL Camera Doubt' };

    const userMsg = document.createElement('div');
    userMsg.className = 'assistant-msg user-msg';
    userMsg.innerHTML = `
      <div class="msg-avatar">${modeIcons[mode] || '👤'}</div>
      <div class="msg-content">
        <div class="user-msg-meta">
          <span>${modeLabels[mode] || 'Question'}</span>
        </div>
        <p class="user-msg-text">${escapeHtml(clean)}</p>
      </div>
    `;
    feed.appendChild(userMsg);
    feed.scrollTop = feed.scrollHeight;
    userMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 2. Render Thinking Indicator
    const thinkingId = `thinking-${Date.now()}`;
    const thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'assistant-msg bot-msg';
    thinkingMsg.id = thinkingId;
    thinkingMsg.innerHTML = `
      <div class="msg-avatar">🤖</div>
      <div class="msg-content">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #38bdf8; font-weight: 600;">
          <span class="assistant-pulse-dot"></span>
          <span>Consulting your active syllabus &amp; generating multi-modal answer...</span>
        </div>
      </div>
    `;
    feed.appendChild(thinkingMsg);
    feed.scrollTop = feed.scrollHeight;
    thinkingMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 3. Resolve Query through Offline Academic AI Service
    const effectiveQuery = internalEnglish || clean;
    const answerData = await academicAIService.resolveQuery(effectiveQuery, mode, this.plEngine);

    // Remove thinking message
    document.getElementById(thinkingId)?.remove();

    // 4. Render Rich Structured Academic Answer Card
    const msgId = `ans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const botMsg = document.createElement('div');
    botMsg.className = 'assistant-msg bot-msg';
    botMsg.id = msgId;

    const islChipsHtml = (answerData.keyIslTerms || []).map(term => `
      <button class="ans-isl-chip" data-term="${escapeHtml(term)}">
        <span>🤟</span>
        <span>${escapeHtml(term)}</span>
      </button>
    `).join('');

    const pointsListHtml = (answerData.importantPoints || []).map(pt => `
      <li>${escapeHtml(pt)}</li>
    `).join('');

    const lessonJumpBtnHtml = answerData.lessonNav ? `
      <button class="ans-studio-jump-btn" data-concept-id="${escapeHtml(answerData.lessonNav.conceptId)}">
        <span>📖 Open in Classroom Studio</span>
      </button>
    ` : '';

    botMsg.innerHTML = `
      <div class="msg-avatar">🤖</div>
      <div class="msg-content">
        <div class="bot-answer-card">
          <div class="bot-card-header">
            <h4 class="bot-card-title">${escapeHtml(answerData.topicTitle || 'Academic Response')}</h4>
            <span class="bot-card-source">${escapeHtml(answerData.sourceBadge || 'Curriculum Knowledge')}</span>
          </div>

          <!-- 1. Direct Answer -->
          <div class="ans-section">
            <span class="ans-sec-label">Direct Answer:</span>
            <div class="ans-direct-answer">${escapeHtml(answerData.directAnswer)}</div>
          </div>

          <!-- 2. Simple Explanation -->
          <div class="ans-section">
            <span class="ans-sec-label">Simple Explanation:</span>
            <p class="ans-explanation-text">${escapeHtml(answerData.simpleExplanation)}</p>
          </div>

          <!-- 3. Real-World / Visual Example -->
          <div class="ans-example-box">
            <div class="ans-example-title">
              <span>💡</span>
              <span>Real-World / Visual Example:</span>
            </div>
            <p class="ans-example-text">${escapeHtml(answerData.example)}</p>
          </div>

          <!-- 4. Important Points -->
          <div class="ans-section">
            <span class="ans-sec-label">Important Points to Remember:</span>
            <ul class="ans-points-list">
              ${pointsListHtml}
            </ul>
          </div>

          <!-- 5. Key ISL Concept Terms -->
          ${answerData.keyIslTerms && answerData.keyIslTerms.length > 0 ? `
            <div class="ans-section">
              <span class="ans-sec-label">Key ISL Terms (Click to Sign on 3D Avatar):</span>
              <div class="ans-isl-terms-row">
                ${islChipsHtml}
              </div>
            </div>
          ` : ''}

          <!-- Multi-Modal Controls Toolbar -->
          <div class="ans-multimodal-toolbar">
            <div class="ans-toolbar-left">
              <button class="ans-tts-btn" data-msg-id="${msgId}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                <span>Listen (TTS)</span>
              </button>
              <button class="ans-avatar-btn" data-msg-id="${msgId}">
                <span>🤟 Sign on 3D Avatar</span>
              </button>
            </div>
            <div class="ans-toolbar-right">
              ${lessonJumpBtnHtml}
            </div>
          </div>

        </div>
      </div>
    `;

    // Wire Card Listeners
    // TTS Audio Button
    const ttsBtn = botMsg.querySelector('.ans-tts-btn');
    const fullAudioText = `${answerData.directAnswer}. ${answerData.simpleExplanation}. Example: ${answerData.example}.`;
    ttsBtn?.addEventListener('click', () => {
      this.playAssistantTts(fullAudioText, msgId, ttsBtn);
    });

    // 3D Avatar Sign Button
    const avatarBtn = botMsg.querySelector('.ans-avatar-btn');
    avatarBtn?.addEventListener('click', () => {
      this.signConceptOnAssistantAvatar(answerData.keyIslTerms || [answerData.topicTitle]);
    });

    // Individual ISL Chips
    botMsg.querySelectorAll('.ans-isl-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const term = chip.dataset.term;
        if (term) this.signConceptOnAssistantAvatar(term, answerData.keyIslTerms || []);
      });
    });

    // Lesson Jump Button
    const studioJumpBtn = botMsg.querySelector('.ans-studio-jump-btn');
    studioJumpBtn?.addEventListener('click', () => {
      const cId = studioJumpBtn.dataset.conceptId;
      const concept = this.plEngine?.getConceptById(cId);
      if (concept) {
        this.switchView('view-personalized-learning');
        this.loadPlConceptIntoStudio(concept, 'introduce');
      }
    });

    feed.appendChild(botMsg);
    feed.scrollTop = feed.scrollHeight;
    botMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 5. Update Right Column Active Concept Card
    const accTitle = document.getElementById('assistant-acc-title');
    const accDesc = document.getElementById('assistant-acc-desc');
    if (accTitle) accTitle.textContent = answerData.topicTitle;
    if (accDesc) accDesc.textContent = answerData.directAnswer;
    if (answerData.concept) {
      this.assistantActiveConcept = answerData.concept;
    }

    // 6. Deaf / Non-Speaking Accessibility Automation:
    // If the student signed their doubt or has ISL proficiency preference, automatically demonstrate on avatar
    if (mode === 'sign' || this.learnerProfile?.data?.islProficiency === 'Advanced') {
      this.signConceptOnAssistantAvatar(answerData.keyIslTerms || [answerData.topicTitle]);
    }
  }

  playAssistantTts(text, msgId, btnEl) {
    const currentState = ttsService.getState();
    if (currentState.currentMessageId === msgId && currentState.state === TTS_STATES.PLAYING) {
      ttsService.pause();
    } else if (currentState.currentMessageId === msgId && currentState.state === TTS_STATES.PAUSED) {
      ttsService.resume();
    } else {
      ttsService.speak(text, msgId);
    }
  }

  signConceptOnAssistantAvatar(termOrTerms, contextKeywords = []) {
    const mount = document.getElementById('edu-assistant-avatar-canvas');
    if (mount && window.mountCurriculumSigner) {
      window.mountCurriculumSigner(mount);
    }

    const allKeywords = Array.isArray(termOrTerms) ? termOrTerms : [termOrTerms, ...contextKeywords];
    const firstTerm = Array.isArray(termOrTerms) ? (termOrTerms[0] || 'SCIENCE') : termOrTerms;

    const glossEl = document.getElementById('assistant-hud-active-gloss');
    const phraseEl = document.getElementById('assistant-hud-active-phrase');
    const noticeEl = document.getElementById('assistant-hud-unavailable-notice');

    if (glossEl) glossEl.textContent = firstTerm.toUpperCase();
    if (phraseEl) phraseEl.textContent = `Demonstrating ISL Concept: "${firstTerm}"`;
    if (noticeEl) noticeEl.classList.add('hidden');

    if (window.signCurriculumText) {
      const success = window.signCurriculumText(firstTerm, allKeywords);
      if (!success && noticeEl) {
        noticeEl.classList.remove('hidden');
      }
    }
  }

  // -------------------------------------------------------
  // LEARN SIGN LANGUAGE TAB — PERSONALIZED LEARNING ENGINE
  // -------------------------------------------------------
  setupSignLearnTab() {
    this.initSkillDevScaffoldView();
    this.renderGoalChips();
    this.bindModeSwitcher();
    this.bindPlaybackControls();
    this.bindPhaseButtons();
    this.updatePerformanceHeaderUI();
    this.renderCategoryProgress();
    this.renderPracticeHistory();
    this.setupRepositoryFilters();
    this.renderSignCategories();
    this.bindLibrarySearch();

    // Start initial adaptive lesson (Teaching phase first)
    this.startGuidedLesson();
  }

  initSkillDevScaffoldView() {
    // 1. Level tabs (Beginner / Intermediate / Advanced)
    const levelBtns = document.querySelectorAll('#skill-level-tabs .skill-level-btn');
    levelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        levelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const level = btn.dataset.level || 'beginner';

        const begPanel = document.getElementById('skill-beginner-panel');
        const intPanel = document.getElementById('skill-intermediate-panel');
        const advPanel = document.getElementById('skill-advanced-panel');

        if (begPanel) begPanel.style.display = level === 'beginner' ? 'flex' : 'none';
        if (intPanel) intPanel.style.display = level === 'intermediate' ? 'flex' : 'none';
        if (advPanel) advPanel.style.display = level === 'advanced' ? 'flex' : 'none';

        const tierBadge = document.getElementById('skill-tier-badge');
        if (tierBadge) {
          tierBadge.textContent = `Level: ${level.charAt(0).toUpperCase() + level.slice(1)}`;
        }
      });
    });

    // 2. Alphabets A–Z grid
    const alphaGrid = document.getElementById('skill-alphabets-grid');
    if (alphaGrid) {
      alphaGrid.innerHTML = '';
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      letters.forEach(letter => {
        const ext = letter === 'Z' ? 'jpeg' : 'png';
        const imgUrl = `/alphabets/${letter}.${ext}`;

        const chip = document.createElement('button');
        chip.className = 'char-chip';
        chip.dataset.char = letter;
        chip.title = `ISL Handshape: Alphabet "${letter}"`;
        chip.innerHTML = `<span class="char-letter">${letter}</span>`;

        chip.addEventListener('click', () => {
          learningLoopController.open({
            id: letter,
            phrase: letter,
            category: 'alphabets',
            imageUrl: imgUrl
          });
        });
        alphaGrid.appendChild(chip);
      });
    }

    // 3. Numbers 0–9 grid
    const numGrid = document.getElementById('skill-numbers-grid');
    if (numGrid) {
      numGrid.innerHTML = '';
      for (let i = 0; i <= 9; i++) {
        const numStr = String(i);
        const imgUrl = `/numbers/${numStr}.jpeg`;

        const chip = document.createElement('button');
        chip.className = 'char-chip';
        chip.dataset.char = numStr;
        chip.title = `ISL Handshape: Number "${numStr}"`;
        chip.innerHTML = `<span class="char-letter">${numStr}</span>`;

        chip.addEventListener('click', () => {
          learningLoopController.open({
            id: numStr,
            phrase: numStr,
            category: 'numbers',
            imageUrl: imgUrl
          });
        });
        numGrid.appendChild(chip);
      }
    }

    // 4. Curated ISL Signs from authentic repository
    islKnowledgeRepository.init().then(() => {
      this.renderSkillSigns();
    });
  }

  renderSkillSigns() {
    const items = islKnowledgeRepository.items || [];
    if (items.length === 0) return;

    // Beginner signs (first 16 items or level === 'beginner')
    const begItems = items.filter(i => (i.level || '').toLowerCase() === 'beginner').slice(0, 16);
    const intItems = items.filter(i => (i.level || '').toLowerCase() === 'intermediate').slice(0, 16);
    const advItems = items.filter(i => (i.level || '').toLowerCase() === 'advanced').slice(0, 16);

    const actualBeg = begItems.length >= 8 ? begItems : items.slice(0, 16);
    const actualInt = intItems.length >= 8 ? intItems : items.slice(16, 32);
    const actualAdv = advItems.length >= 8 ? advItems : items.slice(32, 48);

    const renderGrid = (gridId, badgeId, signs) => {
      const grid = document.getElementById(gridId);
      const badge = document.getElementById(badgeId);
      if (badge) badge.textContent = `${signs.length} Curated Signs`;
      if (!grid) return;
      grid.innerHTML = '';

      signs.forEach(item => {
        const card = document.createElement('div');
        card.className = 'skill-sign-card';
        card.dataset.id = item.id;
        const phrase = item.phrase || item.sentence || item.word || `Sign #${item.id}`;
        const gloss = item.gloss || phrase;

        card.innerHTML = `
          <h4 class="skill-sign-card-title">${escapeHtml(phrase)}</h4>
          <span class="skill-sign-card-gloss">ISL: ${escapeHtml(gloss)}</span>
          <div class="skill-sign-card-footer">
            <span class="status-indicator status-${item.status || 'not_started'}">${item.statusLabel || 'Available'}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn-play-sign-mini" style="padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:11px;cursor:pointer;">Play</button>
              <button class="btn-start-learn-loop" data-id="${item.id}">Learn</button>
            </div>
          </div>
        `;

        card.querySelector('.btn-play-sign-mini')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.playSignItem(item);
        });

        card.querySelector('.btn-start-learn-loop')?.addEventListener('click', (e) => {
          e.stopPropagation();
          learningLoopController.open(item);
        });

        card.addEventListener('click', () => {
          this.playSignItem(item);
        });

        grid.appendChild(card);
      });
    };

    renderGrid('skill-beginner-signs-grid', 'beginner-signs-count', actualBeg);
    renderGrid('skill-intermediate-signs-grid', 'intermediate-signs-count', actualInt);
    renderGrid('skill-advanced-signs-grid', 'advanced-signs-count', actualAdv);
  }

  // Repository Multi-Facet Filter Listeners (Level, Status, Search)
  setupRepositoryFilters() {
    // Level filter pills
    const levelPills = document.querySelectorAll('#repo-level-filter-pills .repo-filter-pill');
    levelPills.forEach(pill => {
      pill.addEventListener('click', () => {
        levelPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.repoLevelFilter = pill.dataset.level || 'all';
        this.refreshLibraryGrid();
      });
    });

    // Status filter pills
    const statusPills = document.querySelectorAll('#repo-status-filter-pills .repo-filter-pill');
    statusPills.forEach(pill => {
      pill.addEventListener('click', () => {
        statusPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.repoStatusFilter = pill.dataset.status || 'all';
        this.refreshLibraryGrid();
      });
    });

    // Search clear button
    const clearBtn = document.getElementById('edu-sl-search-clear');
    const searchInput = document.getElementById('edu-sl-search-input');
    clearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      this.slSearchQuery = '';
      clearBtn.classList.add('hidden');
      this.refreshLibraryGrid();
    });

    // Reinforce button in feedback banner (Learning Loop: Learn Again)
    const reinforceBtn = document.getElementById('edu-sl-btn-reinforce');
    reinforceBtn?.addEventListener('click', () => {
      if (this.currentLessonItem) {
        this.presentTeachingSign(this.currentLessonItem, true);
        this.setPhase('learn');
      }
    });
  }

  // 1. Learning Goals / Interests (Influences content selection, NOT difficulty level)
  renderGoalChips() {
    const container = document.getElementById('edu-sl-goals-chips');
    if (!container) return;
    container.innerHTML = '';

    const currentGoal = this.learnerProfile.data.activeGoal || 'all';

    LEARNING_GOALS.forEach(goal => {
      const chip = document.createElement('button');
      chip.className = `edu-sl-goal-chip ${goal.id === currentGoal ? 'active' : ''}`;
      chip.dataset.goalId = goal.id;
      chip.innerHTML = `<span>${goal.icon}</span> <span>${goal.label}</span>`;
      chip.title = goal.description;

      chip.addEventListener('click', () => {
        this.learnerProfile.data.activeGoal = goal.id;
        this.learnerProfile.save();
        this.syncAllLearnerViews();
        this.renderGoalChips();

        // If in guided lesson, pick next sign matching the newly chosen goal
        if (this.slMode === 'guided') {
          this.startGuidedLesson();
        }
      });
      container.appendChild(chip);
    });
  }

  // 2. Mode Switcher (Guided Adaptive Lesson vs Library Studio)
  bindModeSwitcher() {
    const guidedBtn = document.getElementById('edu-sl-mode-guided');
    const libraryBtn = document.getElementById('edu-sl-mode-library');
    const guidedView = document.getElementById('edu-sl-guided-view');
    const libraryView = document.getElementById('edu-sl-library-view');

    guidedBtn?.addEventListener('click', () => {
      this.slMode = 'guided';
      guidedBtn.classList.add('active');
      libraryBtn?.classList.remove('active');
      guidedView?.classList.remove('hidden');
      libraryView?.classList.add('hidden');
      if (this.currentLessonItem) {
        this.previewSign(this.currentLessonItem);
      }
    });

    libraryBtn?.addEventListener('click', () => {
      this.slMode = 'library';
      libraryBtn.classList.add('active');
      guidedBtn?.classList.remove('active');
      libraryView?.classList.remove('hidden');
      guidedView?.classList.add('hidden');
      this.refreshLibraryGrid();
    });
  }

  // Standardize the 5 meaningful pedagogical states across the app:
  // 'New', 'Learning', 'Practicing', 'Mastered', 'Needs Review'
  getMasteryState(rawStatus, id = null) {
    const isReview = (rawStatus === 'needs_review') ||
      (id && this.learnerProfile?.data?.reviewQueue?.includes(id));
    if (isReview) {
      return { key: 'needs_review', label: 'Needs Review', classKey: 'needs_review', icon: '⚠️' };
    }
    const s = (rawStatus || 'new').toLowerCase();
    if (s === 'mastered' || s === 'learned') {
      return { key: 'mastered', label: 'Mastered', classKey: 'mastered', icon: '🏆' };
    }
    if (s === 'practicing') {
      return { key: 'practicing', label: 'Practicing', classKey: 'practicing', icon: '🔄' };
    }
    if (s === 'learning' || s === 'in_progress') {
      return { key: 'learning', label: 'Learning', classKey: 'learning', icon: '📖' };
    }
    return { key: 'new', label: 'New', classKey: 'new', icon: '⚪' };
  }

  // 3. Automated Level & Statistics Header
  updatePerformanceHeaderUI() {
    const p = this.learnerProfile.data;
    const currentLevel = (p.currentLevel || 'beginner').toLowerCase();
    const config = DIFFICULTY_LEVELS[currentLevel.toUpperCase()] || DIFFICULTY_LEVELS.BEGINNER;

    // Level Badge
    const badge = document.getElementById('edu-sl-level-badge');
    const badgeText = document.getElementById('edu-sl-level-text');
    if (badge && badgeText) {
      badge.className = `edu-sl-level-badge level-${currentLevel}`;
      badgeText.textContent = config.label;
    }

    // Right signer preview mini badge
    const signerLevelBadge = document.getElementById('edu-sl-signer-level-badge');
    if (signerLevelBadge) {
      signerLevelBadge.textContent = `Level: ${config.label}`;
      signerLevelBadge.style.borderColor = config.color;
      signerLevelBadge.style.color = config.color;
    }

    // Stats
    const progEl = document.getElementById('edu-stat-progress');
    if (progEl) progEl.textContent = `${p.levelProgress || 0}%`;

    const accEl = document.getElementById('edu-stat-acc');
    if (accEl) {
      accEl.textContent = (p.totalAttempts > 0) ? `${p.accuracyRate || 0}%` : '--';
    }

    const mastEl = document.getElementById('edu-stat-mastered');
    if (mastEl) mastEl.textContent = this.learnerProfile.getMasteredCount();

    const revEl = document.getElementById('edu-stat-review');
    if (revEl) revEl.textContent = p.reviewQueue.length;

    const streakEl = document.getElementById('edu-stat-streak');
    if (streakEl) streakEl.textContent = p.currentStreak || 0;

    // Progress bar towards next milestone
    const progLabel = document.getElementById('edu-sl-progress-label');
    const progPercent = document.getElementById('edu-sl-progress-percent');
    const progBar = document.getElementById('edu-sl-progress-bar');

    if (progLabel && progPercent && progBar) {
      const nextTierLabel = currentLevel === 'beginner'
        ? 'Intermediate Tier'
        : currentLevel === 'intermediate'
          ? 'Advanced Tier'
          : 'Advanced Fluency';

      progLabel.textContent = `Progress to ${nextTierLabel}`;
      progPercent.textContent = `${p.levelProgress || 0}%`;
      progBar.style.width = `${Math.min(100, p.levelProgress || 0)}%`;
      progBar.style.background = `linear-gradient(90deg, #6366f1, ${config.color})`;
    }

    // Recommended Lesson Strip (Real-time synchronization with Learner Profile & Recommendation Engine)
    const recStrip = document.getElementById('edu-sl-recommended-strip');
    const recChip = document.getElementById('edu-sl-rec-chip');
    const recTitle = document.getElementById('edu-sl-rec-title');
    const recRationale = document.getElementById('edu-sl-rec-rationale');
    const recActionBtn = document.getElementById('edu-sl-btn-start-rec');

    const rec = this.learnerProfile.getRecommendation(islKnowledgeRepository);
    if (rec && rec.targetItem) {
      if (recStrip) recStrip.classList.remove('hidden');
      if (recChip) {
        recChip.textContent = rec.badge;
        recChip.className = `rec-status-chip ${rec.chipClass || 'rec-chip-recommended'}`;
      }
      if (recTitle) recTitle.textContent = rec.targetItem.sentence || rec.targetItem.word;
      if (recRationale) recRationale.textContent = rec.rationale;

      if (recActionBtn) {
        recActionBtn.onclick = () => {
          this.presentTeachingSign(rec.targetItem, rec.isGap);
          this.setPhase('learn');
        };
      }
    }

    // Render level-adapted speed presets
    this.renderSpeedPresets();
  }

  // 4. Level-Adapted Avatar Speed Presets
  renderSpeedPresets() {
    const container = document.getElementById('edu-sl-speed-presets');
    if (!container) return;
    container.innerHTML = '';

    const settings = this.learningEngine.getPlaybackSettings();
    // Preserve learner's selected speed if supported in current tier presets, otherwise fallback to tier default
    let currentSpeed = this.learnerProfile.data.selectedPlaybackSpeed || this.sl.playbackSpeed;
    if (!currentSpeed || !settings.presets.some(p => Math.abs(p - currentSpeed) < 0.05)) {
      currentSpeed = settings.defaultSpeed;
    }
    this.sl.playbackSpeed = currentSpeed;

    settings.presets.forEach(speed => {
      const btn = document.createElement('button');
      btn.className = `edu-sl-speed-btn ${Math.abs(speed - currentSpeed) < 0.05 ? 'active' : ''}`;
      btn.textContent = `${speed}x`;
      btn.title = `Set avatar signing playback speed to ${speed}x`;

      btn.addEventListener('click', () => {
        this.sl.playbackSpeed = speed;
        this.learnerProfile.data.selectedPlaybackSpeed = speed;
        this.learnerProfile.save();

        if (this.sl.sentenceTimeline) {
          this.sl.sentenceTimeline.setSpeed(speed);
        }
        this.renderSpeedPresets();

        // If timeline is actively signing, dynamic speed scaling is already applied live
        const timelineState = this.sl.sentenceTimeline?.getState();
        if (timelineState && timelineState.isPlaying) {
          return;
        }

        // Otherwise replay current sentence or sign at new speed
        if (timelineState && timelineState.currentSentence) {
          this.sl.sentenceTimeline.replay();
        } else if (this.sl.currentSign) {
          this.previewSign(this.sl.currentSign);
        }
      });
      container.appendChild(btn);
    });
  }

  // 5. Playback Controls Binding
  bindPlaybackControls() {
    // Play/Pause Button (Sentence Timeline Toggle)
    const playpauseBtn = document.getElementById('edu-sl-playpause-btn');
    playpauseBtn?.addEventListener('click', () => {
      if (!this.sl.sentenceTimeline) return;
      const state = this.sl.sentenceTimeline.getState();
      if (state.isPlaying) {
        if (state.isPaused) {
          this.sl.sentenceTimeline.resume();
        } else {
          this.sl.sentenceTimeline.pause();
        }
      } else if (state.currentSentence) {
        this.sl.sentenceTimeline.replay();
      } else if (this.sl.currentSign) {
        this.previewSign(this.sl.currentSign);
      }
    });

    // Replay Button
    const replayBtn = document.getElementById('edu-sl-replay-btn');
    replayBtn?.addEventListener('click', () => {
      const timelineState = this.sl.sentenceTimeline?.getState();
      if (timelineState && timelineState.currentSentence) {
        this.sl.sentenceTimeline.replay();
      } else if (this.sl.currentSign) {
        this.previewSign(this.sl.currentSign);
      } else if (this.currentLessonItem) {
        this.previewSign(this.currentLessonItem);
      }
    });

    // Sentence Translation Input & Button
    const sentenceInput = document.getElementById('edu-sl-sentence-input');
    const sentenceBtn = document.getElementById('edu-sl-sentence-btn');

    const triggerSentenceSign = () => {
      const text = (sentenceInput?.value || '').trim();
      if (text) {
        this.playSentence(text);
      }
    };

    sentenceBtn?.addEventListener('click', triggerSentenceSign);
    sentenceInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerSentenceSign();
      }
    });

    // Quick Sentence Example Chips
    document.querySelectorAll('.edu-sl-example-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const sentence = chip.dataset.sentence || chip.textContent.replace(/^"|"$/g, '').trim();
        if (sentenceInput) sentenceInput.value = sentence;
        this.playSentence(sentence);
      });
    });

    // Voice Microphone Button for Multilingual Speech Input
    const micBtn = document.getElementById('edu-sl-mic-btn');
    const micLabel = document.getElementById('edu-sl-mic-label');

    micBtn?.addEventListener('click', async () => {
      if (!this.isSlMicActive) {
        try {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (SpeechRecognition) {
            this.slSpeechRecognition = new SpeechRecognition();
            this.slSpeechRecognition.continuous = false;
            this.slSpeechRecognition.interimResults = false;

            this.slSpeechRecognition.onresult = (event) => {
              const transcript = event.results?.[0]?.[0]?.transcript || '';
              if (transcript) {
                this.handleSpeechInput(transcript);
              }
              this.stopSlMic();
            };

            this.slSpeechRecognition.onerror = (e) => {
              console.warn('[EduApp] Mic recognition notice:', e.error);
              this.stopSlMic();
            };

            this.slSpeechRecognition.onend = () => {
              this.stopSlMic();
            };

            this.slSpeechRecognition.start();
          }

          if (navigator.mediaDevices?.getUserMedia) {
            this.slMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }

          this.isSlMicActive = true;
          micBtn?.classList.add('active');
          if (micLabel) micLabel.textContent = 'Listening...';
        } catch (err) {
          console.warn('[EduApp] Mic access notice:', err);
          this.stopSlMic();
        }
      } else {
        this.stopSlMic();
      }
    });

    // Practice This Sign button in Right Preview Panel
    const practiceThisBtn = document.getElementById('edu-sl-practice-sign-btn');
    practiceThisBtn?.addEventListener('click', () => {
      if (this.sl.currentSign) {
        // Switch to guided mode with this sign
        this.slMode = 'guided';
        document.getElementById('edu-sl-mode-guided')?.classList.add('active');
        document.getElementById('edu-sl-mode-library')?.classList.remove('active');
        document.getElementById('edu-sl-guided-view')?.classList.remove('hidden');
        document.getElementById('edu-sl-library-view')?.classList.add('hidden');

        this.currentLessonItem = this.sl.currentSign;
        this.presentTeachingSign(this.sl.currentSign, false);
        this.setPhase('learn');
      }
    });
  }

  stopSlMic() {
    this.isSlMicActive = false;
    const micBtn = document.getElementById('edu-sl-mic-btn');
    const micLabel = document.getElementById('edu-sl-mic-label');
    micBtn?.classList.remove('active');
    if (micLabel) micLabel.textContent = 'Voice';

    if (this.slSpeechRecognition) {
      try { this.slSpeechRecognition.stop(); } catch {}
      this.slSpeechRecognition = null;
    }
    if (this.slMicStream) {
      try {
        this.slMicStream.getTracks().forEach(t => t.stop());
      } catch {}
      this.slMicStream = null;
    }
  }

  // 6. Phase State Transitions (LEARN → PRACTICE → ASSESS → FEEDBACK → NEXT)
  bindPhaseButtons() {
    // Phase 1 -> Replay 3D Avatar
    document.getElementById('edu-sl-btn-replay-observe')?.addEventListener('click', () => {
      if (this.currentLessonItem) {
        this.previewSign(this.currentLessonItem);
      }
    });

    // Phase 1 -> Phase 2: Start Practice / Rehearsal
    const startPracticeBtn = document.getElementById('edu-sl-btn-start-practice');
    startPracticeBtn?.addEventListener('click', () => {
      if (!this.currentLessonItem) return;
      this.startPracticePhase();
    });

    // Phase 2 -> Replay & Mirror Avatar
    document.getElementById('edu-sl-btn-replay-practice')?.addEventListener('click', () => {
      if (this.currentLessonItem) {
        this.previewSign(this.currentLessonItem);
        this.recordRehearsalRep();
      }
    });

    // Phase 2 -> +1 Rep Completed button
    document.getElementById('edu-sl-btn-record-rep')?.addEventListener('click', () => {
      this.recordRehearsalRep();
    });

    // Phase 2 -> Phase 1: Back to Learn & Observe
    document.getElementById('edu-sl-btn-back-to-observe')?.addEventListener('click', () => {
      this.setPhase('learn');
      if (this.currentLessonItem) {
        this.previewSign(this.currentLessonItem);
      }
    });

    // Phase 2 -> Phase 3: Start Assessment Quiz
    document.getElementById('edu-sl-btn-start-assess')?.addEventListener('click', () => {
      if (!this.currentLessonItem) return;
      if ((this.currentPracticeReps || 0) === 0) {
        this.recordRehearsalRep();
      }
      this.prepareQuiz();
    });

    // Phase 3 -> Phase 2: Back to Practice
    const backToPracticeBtn = document.getElementById('edu-sl-btn-back-to-practice');
    backToPracticeBtn?.addEventListener('click', () => {
      this.startPracticePhase();
    });

    // Fallback: Phase 3 -> Phase 1: Back to Learn
    const backToLearnBtn = document.getElementById('edu-sl-btn-back-to-learn');
    backToLearnBtn?.addEventListener('click', () => {
      this.setPhase('learn');
      if (this.currentLessonItem) {
        this.previewSign(this.currentLessonItem);
      }
    });

    // Phase 3: Submit Quiz Answer
    const checkBtn = document.getElementById('edu-sl-check-btn');
    checkBtn?.addEventListener('click', () => {
      this.handleQuizSubmit();
    });

    // Phase 3: Continue to Next Sign
    const nextBtn = document.getElementById('edu-sl-next-btn');
    nextBtn?.addEventListener('click', () => {
      this.handleNextLessonSign();
    });

    // Feedback banner Next button
    document.getElementById('edu-sl-btn-feedback-next')?.addEventListener('click', () => {
      this.handleNextLessonSign();
    });
  }

  recordRehearsalRep() {
    this.currentPracticeReps = (this.currentPracticeReps || 0) + 1;
    if (this.currentLessonItem) {
      this.learningEngine.recordPracticeAttempt(this.currentLessonItem.id, 1);
    }
    const repCountEl = document.getElementById('edu-sl-practice-rep-count');
    const badgeEl = document.getElementById('edu-sl-practice-attempts-badge');
    if (repCountEl) repCountEl.textContent = this.currentPracticeReps;
    if (badgeEl) badgeEl.textContent = `${this.currentPracticeReps} Rep${this.currentPracticeReps === 1 ? '' : 's'}`;
    this.syncAllLearnerViews();
  }

  startPracticePhase() {
    if (!this.currentLessonItem) return;
    const sign = this.currentLessonItem;
    this.currentPracticeReps = this.currentPracticeReps || 0;

    const wordEl = document.getElementById('edu-sl-practice-word');
    const glossEl = document.getElementById('edu-sl-practice-gloss');
    const targetBadge = document.getElementById('edu-sl-practice-target-badge');
    const attemptsBadge = document.getElementById('edu-sl-practice-attempts-badge');
    const repCountEl = document.getElementById('edu-sl-practice-rep-count');
    const instructionEl = document.getElementById('edu-sl-practice-instruction');

    const displayWord = sign.sentence || sign.word;
    if (wordEl) wordEl.textContent = displayWord;
    if (glossEl) glossEl.textContent = sign.gloss || displayWord;
    if (targetBadge) targetBadge.textContent = `Target: ${displayWord}`;
    if (repCountEl) repCountEl.textContent = this.currentPracticeReps;
    if (attemptsBadge) attemptsBadge.textContent = `${this.currentPracticeReps} Rep${this.currentPracticeReps === 1 ? '' : 's'}`;

    if (instructionEl) {
      if (sign.category === 'alphabets') {
        instructionEl.textContent = `Mirror the 3D avatar on the right. Practice forming the letter ${sign.word} hand shape at chest height.`;
      } else if (sign.category === 'numbers') {
        instructionEl.textContent = `Mirror the 3D avatar on the right. Rehearse the numeral ${sign.word} finger configuration with active dominant hand.`;
      } else {
        instructionEl.textContent = `Mirror the 3D avatar on the right. Rehearse the hand posture and motion flow for "${displayWord}" 2–3 times.`;
      }
    }

    this.setPhase('practice');
    this.previewSign(sign);
  }

  setPhase(phase) {
    this.currentPhase = phase;
    const learnEl = document.getElementById('edu-sl-phase-learn');
    const practiceEl = document.getElementById('edu-sl-phase-practice');
    const quizEl = document.getElementById('edu-sl-phase-quiz');

    if (learnEl) {
      learnEl.classList.toggle('hidden', phase !== 'learn');
      learnEl.classList.toggle('active', phase === 'learn');
    }
    if (practiceEl) {
      practiceEl.classList.toggle('hidden', phase !== 'practice');
      practiceEl.classList.toggle('active', phase === 'practice');
    }
    if (quizEl) {
      quizEl.classList.toggle('hidden', phase !== 'quiz' && phase !== 'assess');
      quizEl.classList.toggle('active', phase === 'quiz' || phase === 'assess');
    }
  }

  // 7. Guided Adaptive Lesson Flow (Teaching first — NO quiz at start)
  startGuidedLesson() {
    // Completely reset previous quiz UI, feedback, and selections so categories never cross-contaminate
    this.selectedQuizAnswer = null;
    this.currentAssessment = null;

    const feedbackBanner = document.getElementById('edu-sl-feedback-banner');
    if (feedbackBanner) feedbackBanner.classList.add('hidden');

    const optionsContainer = document.getElementById('edu-sl-quiz-options');
    if (optionsContainer) optionsContainer.innerHTML = '';

    const quizImgWrap = document.getElementById('edu-sl-quiz-img-wrap');
    const quizImg = document.getElementById('edu-sl-quiz-img');
    if (quizImgWrap) quizImgWrap.classList.add('hidden');
    if (quizImg) quizImg.src = '';

    const batch = this.learningEngine.createLessonBatch(islKnowledgeRepository);
    this.currentBatch = batch;
    const sign = batch.signs[0];
    if (sign) {
      this.presentTeachingSign(sign, batch.isReview);
      this.setPhase('learn');
    }
  }

  presentTeachingSign(sign, isReview = false) {
    this.currentLessonItem = sign;
    this.selectedQuizAnswer = null;
    this.currentPracticeReps = 0;

    // Review Notification Banner
    const reviewBanner = document.getElementById('edu-sl-review-banner');
    const reviewText = document.getElementById('edu-sl-review-text');
    if (reviewBanner && reviewText) {
      if (isReview) {
        reviewBanner.classList.remove('hidden');
        reviewText.textContent = 'Spaced Review Session: Reinforcing signs from previous mistakes to consolidate memory.';
      } else {
        reviewBanner.classList.add('hidden');
      }
    }

    // Core Teaching Details
    const wordEl = document.getElementById('edu-sl-concept-word');
    const glossEl = document.getElementById('edu-sl-concept-gloss');
    const instructionEl = document.getElementById('edu-sl-concept-instruction');
    const hintEl = document.getElementById('edu-sl-concept-hint');
    const catEl = document.getElementById('edu-sl-concept-category');
    const diffEl = document.getElementById('edu-sl-concept-difficulty');
    const statusEl = document.getElementById('edu-sl-concept-status');

    const stat = this.learnerProfile.getItemStats(sign.id);
    if (!sign.word && sign.sentence) sign.word = sign.sentence;
    const levelKey = (sign.proficiencyLevel || (sign.difficulty === 1 ? 'beginner' : sign.difficulty === 2 ? 'intermediate' : 'advanced') || 'beginner').toUpperCase();
    const diffConfig = DIFFICULTY_LEVELS[levelKey] || DIFFICULTY_LEVELS.BEGINNER;

    if (wordEl) wordEl.textContent = sign.word;
    if (glossEl) glossEl.textContent = sign.gloss;
    if (catEl) catEl.textContent = (sign.category || 'general').toUpperCase();

    // Contextual instruction
    if (instructionEl) {
      if (sign.category === 'alphabets') {
        instructionEl.textContent = `Form the ISL hand shape for letter ${sign.word}. ${sign.instruction || ''}`;
      } else if (sign.category === 'numbers') {
        instructionEl.textContent = `Form the ISL hand shape for number ${sign.word}. ${sign.instruction || ''}`;
      } else {
        instructionEl.textContent = sign.instruction || 'Observe the hand posture, motion orientation, and signing speed demonstrated by the 3D avatar.';
      }
    }

    if (hintEl) {
      hintEl.textContent = sign.hint || 'Watch the 3D avatar on the right and observe the hand shape closely.';
    }

    if (diffEl) {
      diffEl.textContent = diffConfig.label;
      diffEl.style.color = diffConfig.color;
      diffEl.style.borderColor = diffConfig.borderColor;
      diffEl.style.background = diffConfig.bgColor;
    }
    if (statusEl) {
      const stateObj = this.getMasteryState(isReview ? 'needs_review' : stat.status, sign.id);
      statusEl.textContent = stateObj.label.toUpperCase();
      statusEl.className = `meta-tag status-tag mastery-${stateObj.classKey}`;
    }

    // Micro parameter chips
    const handParam = document.getElementById('edu-sl-param-hand');
    const spaceParam = document.getElementById('edu-sl-param-space');
    const motionParam = document.getElementById('edu-sl-param-motion');
    if (handParam) {
      handParam.textContent = sign.category === 'conversations' ? 'Two-Hand Coordination' : 'Dominant Hand Active';
    }
    if (spaceParam) {
      spaceParam.textContent = (sign.category === 'alphabets' || sign.category === 'numbers') ? 'Chest-Height Signing Space' : 'Torso & Face Level';
    }
    if (motionParam) {
      motionParam.textContent = sign.animationType === 'letter' ? 'Static Finger Shape' : 'Dynamic Motion Flow';
    }

    // Right Column: Authoritative Visual Teaching Reference PNG/JPEG (alphabets and numbers)
    const mediaWrap = document.getElementById('edu-sl-teaching-media-wrap');
    const teachingImg = document.getElementById('edu-sl-teaching-img');
    const charWrap = document.getElementById('edu-sl-teaching-char-wrap');

    // Ensure fallback notice element exists in mediaWrap
    let unavailableNotice = document.getElementById('edu-sl-img-unavailable-notice');
    if (!unavailableNotice && mediaWrap) {
      unavailableNotice = document.createElement('div');
      unavailableNotice.id = 'edu-sl-img-unavailable-notice';
      unavailableNotice.className = 'edu-sl-img-unavailable-notice hidden';
      unavailableNotice.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #ef4444; font-weight: 600;">
          <div style="font-size: 26px; margin-bottom: 6px;">⚠️</div>
          <div style="font-size: 14px; margin-bottom: 4px;">Reference image unavailable</div>
          <div id="edu-sl-missing-asset-path" style="font-size: 11px; color: #94a3b8; font-family: monospace;"></div>
        </div>
      `;
      mediaWrap.appendChild(unavailableNotice);
    }

    const isBeginnerVisual = (sign.category === 'alphabets' || sign.category === 'numbers') && sign.imageRef;

    if (isBeginnerVisual) {
      if (mediaWrap) mediaWrap.style.display = 'flex';
      if (charWrap) charWrap.classList.add('hidden');
      if (unavailableNotice) unavailableNotice.classList.add('hidden');

      if (teachingImg) {
        teachingImg.style.display = 'block';
        teachingImg.onload = () => {
          teachingImg.style.display = 'block';
          if (unavailableNotice) unavailableNotice.classList.add('hidden');
        };
        teachingImg.onerror = () => {
          teachingImg.style.display = 'none';
          if (unavailableNotice) {
            unavailableNotice.classList.remove('hidden');
            const pathEl = document.getElementById('edu-sl-missing-asset-path');
            if (pathEl) pathEl.textContent = sign.imageRef;
          }
          console.warn(`[EduApp] Reference image unavailable for ${sign.category} "${sign.word}": ${sign.imageRef}`);
        };
        // Reset src before setting to avoid displaying prior category image
        teachingImg.src = sign.imageRef;
        teachingImg.alt = `ISL ${sign.category === 'alphabets' ? 'Alphabet' : 'Number'} ${sign.word} authoritative reference`;
      }
    } else {
      // Non-image signs (basic words, phrases, conversations)
      if (mediaWrap) mediaWrap.style.display = 'none';
      if (teachingImg) {
        teachingImg.src = '';
      }
      if (unavailableNotice) unavailableNotice.classList.add('hidden');
      if (charWrap) {
        charWrap.classList.remove('hidden');
        const movementEl = document.getElementById('edu-sl-char-movement');
        const orientEl = document.getElementById('edu-sl-char-orientation');
        const contextEl = document.getElementById('edu-sl-char-context');
        if (movementEl) movementEl.textContent = sign.animationType === 'bvh' ? 'Authentic 3D ISL Motion' : 'Smooth fingerspelled sequence';
        if (orientEl) orientEl.textContent = sign.category === 'greetings' ? 'Conversational frontal plane' : 'Forward signing position';
        if (contextEl) contextEl.textContent = sign.keywords ? sign.keywords.slice(0, 3).join(', ') : 'Daily communication';
      }
    }

    // Reset Quiz view states
    const checkBtn = document.getElementById('edu-sl-check-btn');
    const nextBtn = document.getElementById('edu-sl-next-btn');
    const feedbackBanner = document.getElementById('edu-sl-feedback-banner');
    if (checkBtn) {
      checkBtn.disabled = true;
      checkBtn.classList.remove('hidden');
    }
    if (nextBtn) nextBtn.classList.add('hidden');
    if (feedbackBanner) feedbackBanner.classList.add('hidden');

    // Always enter Learn & Observe phase first
    this.setPhase('learn');

    // Play 3D avatar demonstration cleanly at current speed
    this.previewSign(sign);
  }

  // 8. Quiz Preparation & Assessment (Phase 3 — only after Learn & Observe + Practice)
  prepareQuiz() {
    if (!this.currentLessonItem) return;
    this.prepareQuizForSign(this.currentLessonItem);
  }

  startPracticeForSign(item) {
    if (!item) return;
    // Switch view to guided mode
    this.slMode = 'guided';
    const guidedBtn = document.getElementById('edu-sl-mode-guided');
    const libraryBtn = document.getElementById('edu-sl-mode-library');
    const guidedView = document.getElementById('edu-sl-guided-view');
    const libraryView = document.getElementById('edu-sl-library-view');

    guidedBtn?.classList.add('active');
    libraryBtn?.classList.remove('active');
    guidedView?.classList.remove('hidden');
    libraryView?.classList.add('hidden');

    this.currentLessonItem = item;
    this.presentTeachingSign(item, item.isGap || false);
    this.setPhase('learn');
  }

  prepareQuizForSign(item) {
    this.currentLessonItem = item;
    const assessments = this.learningEngine.generateAssessment([item], null, islKnowledgeRepository);
    this.currentAssessment = assessments[0];
    this.selectedQuizAnswer = null;

    const promptEl = document.getElementById('edu-sl-quiz-prompt');
    const typeBadge = document.getElementById('edu-sl-quiz-type-badge');
    const targetBadge = document.getElementById('edu-sl-quiz-target-badge');
    const imgWrap = document.getElementById('edu-sl-quiz-img-wrap');
    const quizImg = document.getElementById('edu-sl-quiz-img');
    const optionsContainer = document.getElementById('edu-sl-quiz-options');
    const checkBtn = document.getElementById('edu-sl-check-btn');
    const nextBtn = document.getElementById('edu-sl-next-btn');
    const feedbackBanner = document.getElementById('edu-sl-feedback-banner');
    const feedbackActions = document.getElementById('edu-sl-feedback-actions');

    const displayWord = item.sentence || item.word;
    if (promptEl) promptEl.textContent = this.currentAssessment.promptText;
    if (typeBadge) typeBadge.textContent = this.currentAssessment.badgeLabel;
    if (targetBadge) targetBadge.textContent = `Sign: ${displayWord}`;

    // Optional hand-shape image prompt
    if (imgWrap && quizImg) {
      if (this.currentAssessment.imageRef) {
        imgWrap.classList.remove('hidden');
        quizImg.src = this.currentAssessment.imageRef;
        quizImg.alt = `ISL Hand Shape Question`;
      } else {
        imgWrap.classList.add('hidden');
      }
    }

    // Reset controls
    if (checkBtn) {
      checkBtn.disabled = true;
      checkBtn.classList.remove('hidden');
    }
    if (nextBtn) nextBtn.classList.add('hidden');
    if (feedbackBanner) feedbackBanner.classList.add('hidden');
    if (feedbackActions) feedbackActions.classList.add('hidden');

    // Render 4 options in 2x2 grid
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      this.currentAssessment.options.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.className = 'edu-sl-quiz-opt-btn';
        btn.innerHTML = `
          <span class="opt-label">${String.fromCharCode(65 + idx)}. ${optText}</span>
          <span class="opt-indicator">○</span>
        `;
        btn.addEventListener('click', () => {
          if (btn.disabled) return; // Prevent change after submit
          this.selectedQuizAnswer = optText;

          // Visual selection (answer is NOT revealed before submission!)
          optionsContainer.querySelectorAll('.edu-sl-quiz-opt-btn').forEach(b => {
            b.classList.remove('selected');
            const ind = b.querySelector('.opt-indicator');
            if (ind) ind.textContent = '○';
          });
          btn.classList.add('selected');
          const ind = btn.querySelector('.opt-indicator');
          if (ind) ind.textContent = '●';

          if (checkBtn) checkBtn.disabled = false;
        });
        optionsContainer.appendChild(btn);
      });
    }

    // Replay avatar demonstration
    this.previewSign(item);
    this.setPhase('quiz');
  }

  handleQuizSubmit() {
    if (!this.currentLessonItem || !this.currentAssessment || !this.selectedQuizAnswer) return;

    const isCorrect = (this.selectedQuizAnswer === this.currentAssessment.correctAnswer);
    const result = this.learningEngine.recordQuizResult(
      this.currentLessonItem.id,
      isCorrect,
      this.selectedQuizAnswer,
      this.currentLessonItem
    );

    // Prevent multiple submissions & visually highlight correct/incorrect options
    const optionsContainer = document.getElementById('edu-sl-quiz-options');
    if (optionsContainer) {
      optionsContainer.querySelectorAll('.edu-sl-quiz-opt-btn').forEach(btn => {
        btn.disabled = true; // Lock all buttons
        const text = btn.querySelector('.opt-label')?.textContent.substring(3).trim();
        const ind = btn.querySelector('.opt-indicator');

        if (text === this.currentAssessment.correctAnswer) {
          btn.classList.add('correct');
          if (ind) ind.textContent = '✓';
        } else if (text === this.selectedQuizAnswer && !isCorrect) {
          btn.classList.add('incorrect');
          if (ind) ind.textContent = '✗';
        } else {
          btn.style.opacity = '0.5';
        }
      });
    }

    // Display immediate feedback banner with Performance Analysis & Adaptive Recommendation
    const feedbackBanner = document.getElementById('edu-sl-feedback-banner');
    const feedbackIcon = document.getElementById('edu-sl-feedback-icon');
    const feedbackTitle = document.getElementById('edu-sl-feedback-title');
    const feedbackDetail = document.getElementById('edu-sl-feedback-detail');
    const feedbackActions = document.getElementById('edu-sl-feedback-actions');
    const reinforceBtn = document.getElementById('edu-sl-btn-reinforce');
    const feedbackNextBtn = document.getElementById('edu-sl-btn-feedback-next');

    // Update Performance Metric Chips
    const fbAcc = document.getElementById('edu-sl-fb-acc');
    const fbMastery = document.getElementById('edu-sl-fb-mastery');
    const fbStreak = document.getElementById('edu-sl-fb-streak');
    if (fbAcc) fbAcc.textContent = `${result.signAccuracy}%`;
    if (fbMastery) {
      const stateObj = this.getMasteryState(result.newStatus, this.currentLessonItem.id);
      fbMastery.textContent = stateObj.label.toUpperCase();
    }
    if (fbStreak) fbStreak.textContent = `${result.streak} 🔥`;

    // Adaptive Recommendation evaluation right after assessment
    const nextRec = this.learnerProfile.getRecommendation(islKnowledgeRepository);
    const recBadgeEl = document.getElementById('edu-sl-fb-rec-badge');
    const recTitleEl = document.getElementById('edu-sl-fb-rec-title');
    const recRationaleEl = document.getElementById('edu-sl-fb-rec-rationale');

    if (recBadgeEl) {
      recBadgeEl.textContent = nextRec.badge;
      recBadgeEl.className = `rec-status-chip ${nextRec.chipClass || 'rec-chip-recommended'}`;
    }
    if (recTitleEl) recTitleEl.textContent = nextRec.areaTitle;
    if (recRationaleEl) recRationaleEl.textContent = nextRec.rationale;

    if (feedbackBanner && feedbackTitle && feedbackDetail && feedbackIcon) {
      feedbackBanner.className = `edu-sl-feedback-banner ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
      feedbackIcon.textContent = isCorrect ? '✓' : '✗';

      if (isCorrect) {
        feedbackTitle.textContent = '✓ Correct! Outstanding recognition.';
        feedbackDetail.textContent = `Correct Answer: "${this.currentAssessment.correctAnswer}" · Mastery: ${result.newStatus.toUpperCase()} · Sign Accuracy: ${result.signAccuracy}%`;
        if (reinforceBtn) reinforceBtn.classList.add('hidden');
        if (feedbackNextBtn) feedbackNextBtn.classList.remove('hidden');
      } else {
        const failNote = (result.consecutiveFailures && result.consecutiveFailures >= 2) ? ` (${result.consecutiveFailures} consecutive misses)` : '';
        feedbackTitle.textContent = `✗ Incorrect. The correct answer was: "${this.currentAssessment.correctAnswer}".`;
        feedbackDetail.textContent = `Identified as a Learning Gap on "${this.currentLessonItem.sentence || this.currentLessonItem.word}"${failNote} (${result.signAccuracy}% accuracy). Prioritized for revision.`;
        if (reinforceBtn) reinforceBtn.classList.remove('hidden');
        if (feedbackNextBtn) feedbackNextBtn.classList.remove('hidden');
      }
      feedbackBanner.classList.remove('hidden');
      if (feedbackActions) feedbackActions.classList.remove('hidden');
    }

    // Toggle Action Buttons
    const checkBtn = document.getElementById('edu-sl-check-btn');
    const nextBtn = document.getElementById('edu-sl-next-btn');
    if (checkBtn) checkBtn.classList.add('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');

    // Update Persistent Progress Indicators
    this.syncAllLearnerViews();
  }

  handleNextLessonSign() {
    this.sessionLessonsCompleted = (this.sessionLessonsCompleted || 0) + 1;

    // After a reasonable lesson set (every 4 signs), trigger a short review quiz of previously learned signs
    if (this.sessionLessonsCompleted >= 4) {
      this.sessionLessonsCompleted = 0;
      this.startReviewQuiz();
    } else {
      this.startGuidedLesson();
    }
  }

  startReviewQuiz() {
    const batch = this.learningEngine.createReviewBatch();
    this.currentBatch = batch;
    const sign = batch.signs[0];
    if (sign) {
      this.presentTeachingSign(sign, true);
      this.setPhase('learn');
    }
  }

  // 9. Category Mastery Progress Grid (Independent tracking for Alphabets, Numbers, Words, etc.)
  renderCategoryProgress() {
    const container = document.getElementById('edu-sl-cat-prog-grid');
    if (!container) return;
    container.innerHTML = '';

    const stats = this.learnerProfile.data.categoryStats || {};
    const activeGoal = this.learnerProfile.data.activeGoal || 'all';

    const catDefinitions = [
      { id: 'alphabets', label: 'Alphabets A–Z', icon: '🔤' },
      { id: 'numbers', label: 'Numbers 0–9', icon: '🔢' },
      { id: 'words', label: 'Basic Words', icon: '📝' },
      { id: 'greetings', label: 'Greetings', icon: '👋' },
      { id: 'family', label: 'Family & People', icon: '👨‍👩‍👧' },
      { id: 'actions', label: 'Actions', icon: '🏃' },
      { id: 'emotions', label: 'Emotions', icon: '😊' },
      { id: 'questions', label: 'Questions', icon: '❓' },
      { id: 'phrases', label: 'Common Phrases', icon: '💬' },
      { id: 'conversations', label: 'Conversations', icon: '🗣️' }
    ];

    catDefinitions.forEach(cat => {
      const data = stats[cat.id] || { completed: 0, mastered: 0, total: 10, accuracy: 0, masteryScore: 0, status: 'untouched', needsReview: 0, attempts: 0 };
      const isActive = (activeGoal === cat.id);
      const catStatus = data.status || 'untouched';
      const statusLabel = catStatus === 'mastered' ? '🏆 Mastered'
        : catStatus === 'needs_improvement' ? '⚠️ Needs Review'
        : catStatus === 'in_progress' ? '🔄 In Progress'
        : '⚪ Not Started';
      const badgeClass = `cat-badge-${catStatus}`;
      const masteryScore = data.masteryScore || 0;

      const card = document.createElement('div');
      card.className = `cat-prog-card ${isActive ? 'cat-prog-active' : ''}`;
      card.title = `Filter and practice ${cat.label} (Click to isolate category)`;
      card.innerHTML = `
        <div class="cat-prog-header">
          <span class="cat-prog-name">${cat.icon} ${cat.label}</span>
          <span class="cat-badge-status ${badgeClass}">${statusLabel}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; margin:2px 0 4px 0;">
          <span>${data.mastered}/${data.total} mastered</span>
          <span style="font-weight:700; color:${catStatus === 'mastered' ? '#34d399' : catStatus === 'needs_improvement' ? '#fca5a5' : '#a78bfa'};">${masteryScore}% mastery</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10px; color:#64748b; margin-bottom:4px;">
          <span>Accuracy: ${data.attempts > 0 ? `${data.accuracy}%` : 'No attempts'}</span>
          <span>${data.needsReview > 0 ? `⚠️ ${data.needsReview} gaps` : '✓ No gaps'}</span>
        </div>
        <div class="cat-prog-bar-bg">
          <div class="cat-prog-bar-fill" style="width: ${masteryScore}%;"></div>
        </div>
      `;

      // Clicking a category card in the matrix switches the active goal immediately
      card.addEventListener('click', () => {
        this.learnerProfile.data.activeGoal = cat.id;
        this.learnerProfile.save();
        this.syncAllLearnerViews();
        this.renderGoalChips();
        this.startGuidedLesson();
      });

      container.appendChild(card);
    });
  }

  renderPracticeHistory() {
    const container = document.getElementById('edu-sl-history-list');
    if (!container) return;

    const history = this.learnerProfile.data.practiceHistory || [];
    if (history.length === 0) {
      container.innerHTML = '<div class="history-empty">Complete your first practice challenge to track your learning journey!</div>';
      return;
    }

    container.innerHTML = '';
    history.slice(0, 8).forEach(item => {
      const row = document.createElement('div');
      const stateObj = this.getMasteryState(item.statusAfter, item.signId);
      row.className = `history-item ${item.isCorrect ? 'history-item-correct' : 'history-item-incorrect'}`;
      row.innerHTML = `
        <div class="history-item-left">
          <span class="history-item-word">${item.word}</span>
          <span class="meta-tag">${item.category}</span>
        </div>
        <div class="history-item-right">
          <span class="history-item-badge ${item.isCorrect ? 'history-badge-correct' : 'history-badge-incorrect'}">
            ${item.isCorrect ? '✓ Correct' : '✗ Mistake'}
          </span>
          <span class="meta-tag status-tag mastery-${stateObj.classKey}">${stateObj.label}</span>
        </div>
      `;
      container.appendChild(row);
    });
  }

  // 7. ISL Knowledge Repository Studio Browse & Search
  renderSignCategories() {
    const tabBar = document.getElementById('edu-sign-category-tabs');
    if (!tabBar) return;
    tabBar.innerHTML = '';

    const currentCat = this.repoCategoryFilter || 'all';
    const totalCount = islKnowledgeRepository.isLoaded ? islKnowledgeRepository.items.length : 2501;

    // All Categories tab
    const allBtn = document.createElement('button');
    allBtn.className = `edu-sign-cat-btn ${currentCat === 'all' ? 'active' : ''}`;
    allBtn.dataset.category = 'all';
    allBtn.innerHTML = `📚 All Categories (${totalCount})`;
    allBtn.addEventListener('click', () => this.selectSignCategory('all'));
    tabBar.appendChild(allBtn);

    // Dynamic categories from ISL Knowledge Repository
    Object.entries(REPOSITORY_CATEGORIES).forEach(([key, cat]) => {
      const count = islKnowledgeRepository.isLoaded
        ? islKnowledgeRepository.items.filter(s => s.category === key).length
        : 0;
      const btn = document.createElement('button');
      btn.className = `edu-sign-cat-btn ${key === currentCat ? 'active' : ''}`;
      btn.dataset.category = key;
      btn.innerHTML = `${cat.icon} ${cat.label} (${count})`;
      btn.addEventListener('click', () => this.selectSignCategory(key));
      tabBar.appendChild(btn);
    });
  }

  bindLibrarySearch() {
    const searchInput = document.getElementById('edu-sl-search-input');
    const clearBtn = document.getElementById('edu-sl-search-clear');

    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      const query = e.target.value;
      searchDebounceTimer = setTimeout(() => {
        this.slSearchQuery = query.trim().toLowerCase();
        if (clearBtn) {
          clearBtn.classList.toggle('hidden', !this.slSearchQuery);
        }
        this.refreshLibraryGrid();
      }, 150);
    });
  }

  selectSignCategory(key) {
    this.repoCategoryFilter = key;
    this.slCategory = key;
    document.querySelectorAll('.edu-sign-cat-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.category === key));
    this.refreshLibraryGrid();
  }

  refreshLibraryGrid() {
    const grid = document.getElementById('edu-sign-grid');
    if (!grid) return;

    // Ensure repository is initialized
    if (!islKnowledgeRepository.isLoaded) {
      grid.innerHTML = '<div class="history-empty" style="width: 100%; text-align: center; padding: 30px;">Loading 2,501 authentic ISL repository items...</div>';
      islKnowledgeRepository.init().then(() => {
        this.renderSignCategories();
        this.refreshLibraryGrid();
      });
      return;
    }

    grid.innerHTML = '';

    const filters = {
      level: this.repoLevelFilter || 'all',
      status: this.repoStatusFilter || 'all',
      category: this.repoCategoryFilter || 'all',
      query: this.slSearchQuery || ''
    };

    const p = this.learnerProfile.data;
    const items = islKnowledgeRepository.getItems(filters, p);
    const stats = islKnowledgeRepository.getStats(p);

    const countBadge = document.getElementById('edu-repo-count-badge');
    if (countBadge) {
      countBadge.textContent = `Showing ${items.length.toLocaleString()} of 2,501 Signs`;
    }

    const clearBtn = document.getElementById('edu-sl-search-clear');
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', !this.slSearchQuery);
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="history-empty" style="width: 100%; text-align: center; padding: 40px 20px;">
          <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No matching ISL signs found</div>
          <div style="font-size: 12px; color: var(--text-muted);">Try adjusting your level, status filter, category, or search query.</div>
        </div>
      `;
      return;
    }

    // Display first 120 items for ultra-smooth responsiveness
    const displayItems = items.slice(0, 120);

    displayItems.forEach(item => {
      const isSelected = this.sl.currentSign?.id === item.id;
      const card = document.createElement('div');

      let recBadgeHtml = '';
      if (item.recommendationReasonType === 'weak_performance') {
        recBadgeHtml = `<span class="rec-badge rec-badge-weak" title="${item.recommendationExplanation || 'Weak performance needs review'}">⚠️ Weak Performance</span>`;
      } else if (item.recommendationReasonType === 'revision') {
        recBadgeHtml = `<span class="rec-badge rec-badge-revision" title="${item.recommendationExplanation || 'Revision sign'}">🔄 Revision</span>`;
      } else if (item.recommendationReasonType === 'new_learning') {
        recBadgeHtml = `<span class="rec-badge rec-badge-new" title="${item.recommendationExplanation || 'New sign for your level'}">✨ New Learning</span>`;
      } else if (item.recommendationReasonType === 'next_level') {
        recBadgeHtml = `<span class="rec-badge rec-badge-next" title="${item.recommendationExplanation || 'Next level challenge'}">🚀 Next Level</span>`;
      }

      const perfText = item.performance.attempts > 0
        ? `${item.performance.attempts} att · ${item.performance.accuracy}% acc`
        : 'Not attempted';

      const catMeta = REPOSITORY_CATEGORIES[item.category] || { label: item.category || 'General', icon: '💬' };
      const displayWord = item.sentence || item.word;

      const isReviewSign = item.isGap || item.masteryStatus === 'needs_review' || p.reviewQueue?.includes(item.id);
      const stateObj = this.getMasteryState(isReviewSign ? 'needs_review' : (item.masteryStatus || item.status), item.id);
      let statusHtml = '';
      if (stateObj.key === 'needs_review') {
        statusHtml = '<span class="meta-tag status-tag status-review">⚠️ Needs Review</span>';
      } else if (stateObj.key === 'mastered') {
        statusHtml = '<span class="meta-tag status-tag status-learned">🏆 Mastered</span>';
      } else if (stateObj.key === 'practicing') {
        statusHtml = '<span class="meta-tag status-tag status-practicing">🔄 Practicing</span>';
      } else if (stateObj.key === 'learning') {
        statusHtml = '<span class="meta-tag status-tag status-inprogress">📖 Learning</span>';
      } else {
        statusHtml = '<span class="meta-tag status-tag status-notstarted">⚪ New</span>';
      }

      card.className = `edu-sign-card-rich card-status-${item.status} ${isSelected ? 'active' : ''} ${item.isGap ? 'is-gap' : ''} ${item.recommendationEligibility ? 'is-recommended' : ''}`;
      card.dataset.id = item.id;
      card.innerHTML = `
        <div class="edu-sign-card-header">
          <span class="edu-sign-card-id">#${item.id}</span>
          <div class="edu-sign-card-tags">
            ${recBadgeHtml}
            <span class="repo-level-tag level-${item.proficiencyLevel}">${item.proficiencyLevel}</span>
          </div>
        </div>
        <div class="edu-sign-card-sentence" title="${displayWord}">${displayWord}</div>
        <div class="edu-sign-card-gloss" title="ISL Gloss: ${item.gloss}">GLOSS: ${item.gloss}</div>
        <div class="edu-sign-card-footer">
          <div class="card-footer-left">
            <span class="card-category-tag">${catMeta.icon} ${catMeta.label}</span>
          </div>
          <div class="card-footer-right">
            <span class="card-perf-tag">${perfText}</span>
            ${statusHtml}
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.playSignItem(item);
      });

      grid.appendChild(card);
    });

    if (items.length > 120) {
      const moreNotice = document.createElement('div');
      moreNotice.style.cssText = 'width: 100%; text-align: center; padding: 14px; font-size: 11px; color: var(--text-muted);';
      moreNotice.textContent = `Showing first 120 of ${items.length.toLocaleString()} matching signs. Refine filters or search to view more.`;
      grid.appendChild(moreNotice);
    }
  }

  // -------------------------------------------------------
  // FEATURE 3: ISL KNOWLEDGE COMMAND CENTER ENGINE
  // 2,501 Predefined Signs · 24-Card Pagination · Real-time Telemetry & Filters
  // -------------------------------------------------------
  setupRepoFiltersAndSearch() {
    const searchInput = document.getElementById('repo-search-input');
    const searchClear = document.getElementById('repo-search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          this.repoSearchQuery = e.target.value.trim();
          this.repoCurrentPage = 1;
          this.renderRepositoryGrid();
        }, 150);
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.repoSearchQuery = '';
        this.repoCurrentPage = 1;
        searchClear.classList.add('hidden');
        this.renderRepositoryGrid();
      });
    }

    // Quick Filter Chips (All, Beginner, Intermediate, Advanced, Needs Review, Mastered)
    const filterChips = document.querySelectorAll('#repo-quick-filters .repo-filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filterType = chip.dataset.filter || 'all';
        if (filterType === 'all') {
          this.repoLevelFilter = 'all';
          this.repoStatusFilter = 'all';
        } else if (filterType === 'beginner' || filterType === 'intermediate' || filterType === 'advanced') {
          this.repoLevelFilter = filterType;
          this.repoStatusFilter = 'all';
        } else if (filterType === 'needs_review') {
          this.repoLevelFilter = 'all';
          this.repoStatusFilter = 'needs_review';
        } else if (filterType === 'mastered') {
          this.repoLevelFilter = 'all';
          this.repoStatusFilter = 'mastered';
        }
        this.repoCurrentPage = 1;
        this.renderRepositoryGrid();
      });
    });

    // Clear category filter button
    const clearCatBtn = document.getElementById('repo-clear-category-btn');
    if (clearCatBtn) {
      clearCatBtn.addEventListener('click', () => {
        this.repoCategoryFilter = 'all';
        clearCatBtn.classList.add('hidden');
        this.repoCurrentPage = 1;
        this.renderExploreCategories();
        this.renderRepositoryGrid();
      });
    }

    // Toggle Inspector Dock button
    const btnToggleInspector = document.getElementById('btn-toggle-inspector');
    const viewportSection = document.getElementById('studio-viewport-section');
    if (btnToggleInspector && viewportSection) {
      btnToggleInspector.addEventListener('click', () => {
        const isCollapsed = viewportSection.classList.toggle('collapsed');
        btnToggleInspector.classList.toggle('active', !isCollapsed);
        const label = document.getElementById('inspector-toggle-label') || btnToggleInspector.querySelector('.btn-toggle-label');
        if (label) {
          label.textContent = isCollapsed ? '3D Avatar: Hidden' : '3D Avatar: Docked';
        }
        // Force Three.js viewport resize
        window.dispatchEvent(new Event('resize'));
        this.resizePersistentCanvas?.();
      });
    }

    // Inspector Companion Action Buttons
    document.getElementById('inspector-btn-learn')?.addEventListener('click', () => {
      const current = this.sl.currentSign || islKnowledgeRepository.items[0];
      if (current) {
        learningLoopController.open(current);
        learningLoopController.setPhase(1);
      }
    });

    document.getElementById('inspector-btn-practice')?.addEventListener('click', () => {
      const current = this.sl.currentSign || islKnowledgeRepository.items[0];
      if (current) {
        learningLoopController.open(current);
        learningLoopController.setPhase(2);
      }
    });

    document.getElementById('inspector-btn-review')?.addEventListener('click', () => {
      const current = this.sl.currentSign;
      if (current) {
        this.learnerProfile.toggleReviewQueue(current.id);
        this.updateInspectorSignDetails(current);
        this.renderRepositoryGrid();
      }
    });

    // Speed chips in studio inspector
    document.querySelectorAll('#repo-speed-chips .speed-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#repo-speed-chips .speed-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const speed = parseFloat(chip.dataset.speed) || 1.0;
        this.sl.playbackSpeed = speed;
        if (this.sl.bvhMixer) {
          this.sl.bvhMixer.timeScale = speed;
        }
      });
    });

    // Pagination controls
    const scrollGridToTop = () => {
      const grid = document.getElementById('repo-card-grid');
      if (grid) {
        grid.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const commandCenter = document.getElementById('repo-command-center');
      if (commandCenter) {
        commandCenter.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    document.getElementById('repo-first-btn')?.addEventListener('click', () => {
      if (this.repoCurrentPage > 1) {
        this.repoCurrentPage = 1;
        this.renderRepositoryGrid();
        scrollGridToTop();
      }
    });

    document.getElementById('repo-prev-btn')?.addEventListener('click', () => {
      if (this.repoCurrentPage > 1) {
        this.repoCurrentPage--;
        this.renderRepositoryGrid();
        scrollGridToTop();
      }
    });

    document.getElementById('repo-next-btn')?.addEventListener('click', () => {
      if (this.repoCurrentPage < (this.repoTotalPages || 1)) {
        this.repoCurrentPage++;
        this.renderRepositoryGrid();
        scrollGridToTop();
      }
    });

    document.getElementById('repo-last-btn')?.addEventListener('click', () => {
      if (this.repoCurrentPage < (this.repoTotalPages || 1)) {
        this.repoCurrentPage = this.repoTotalPages;
        this.renderRepositoryGrid();
        scrollGridToTop();
      }
    });
  }

  // Render "Explore by Knowledge" Category Tiles (Authentic categories only)
  renderExploreCategories() {
    const container = document.getElementById('repo-categories-grid');
    if (!container) return;

    if (!islKnowledgeRepository.isLoaded) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">Loading categories...</div>';
      return;
    }

    const currentCat = this.repoCategoryFilter || 'all';
    const clearCatBtn = document.getElementById('repo-clear-category-btn');
    if (clearCatBtn) {
      clearCatBtn.classList.toggle('hidden', currentCat === 'all');
    }

    container.innerHTML = '';
    const allItems = islKnowledgeRepository.items;

    Object.entries(REPOSITORY_CATEGORIES).forEach(([key, cat]) => {
      const count = allItems.filter(s => s.category === key).length;
      const isActive = (key === currentCat);

      const card = document.createElement('div');
      card.className = `repo-cat-card ${isActive ? 'active' : ''}`;
      card.dataset.category = key;
      card.title = `${cat.label}: ${count.toLocaleString()} predefined signs`;
      card.innerHTML = `
        <div class="repo-cat-icon-box">${cat.icon || '💬'}</div>
        <div class="repo-cat-info">
          <div class="repo-cat-name">${cat.label}</div>
          <div class="repo-cat-count">${count.toLocaleString()} signs</div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (this.repoCategoryFilter === key) {
          this.repoCategoryFilter = 'all';
        } else {
          this.repoCategoryFilter = key;
        }
        this.repoCurrentPage = 1;
        this.renderExploreCategories();
        this.renderRepositoryGrid();
      });

      container.appendChild(card);
    });
  }

  // Render Knowledge Command Center Grid
  renderRepositoryGrid() {
    const grid = document.getElementById('repo-card-grid');
    if (!grid) return;

    if (!islKnowledgeRepository.isLoaded) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Loading 2,501 authentic ISL dataset signs...</div>';
      islKnowledgeRepository.init().then(() => {
        this.renderExploreCategories();
        this.renderRepositoryGrid();
      });
      return;
    }

    // Always keep category tiles synchronized
    this.renderExploreCategories();

    const p = this.learnerProfile.data;
    const filters = {
      level: this.repoLevelFilter || 'all',
      status: this.repoStatusFilter || 'all',
      category: this.repoCategoryFilter || 'all',
      query: this.repoSearchQuery || ''
    };

    const items = islKnowledgeRepository.getItems(filters, p);
    const totalItems = items.length;
    const pageSize = this.repoPageSize || 24;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    this.repoTotalPages = totalPages;

    if (this.repoCurrentPage > totalPages) this.repoCurrentPage = totalPages;
    if (this.repoCurrentPage < 1) this.repoCurrentPage = 1;

    const startIdx = (this.repoCurrentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalItems);
    const pageItems = items.slice(startIdx, endIdx);

    // Update Telemetry in Command Center Hero
    const totalSignsEl = document.getElementById('telemetry-total-signs');
    if (totalSignsEl) {
      totalSignsEl.textContent = `${islKnowledgeRepository.items.length.toLocaleString()}`;
    }

    // Compute live learner stats across full repository without mutating source data
    let masteredCount = 0;
    let reviewCount = p.reviewQueue?.length || 0;
    let progressCount = 0;

    islKnowledgeRepository.items.forEach(item => {
      const enriched = islKnowledgeRepository.enrichItemWithState(item, p);
      if (enriched.status === 'mastered') masteredCount++;
      else if (enriched.status === 'in_progress' || enriched.status === 'learning' || enriched.status === 'practicing') progressCount++;
      if (enriched.status === 'needs_review' && !p.reviewQueue?.includes(item.id)) reviewCount++;
    });

    const statMasteredEl = document.getElementById('repo-stat-mastered');
    if (statMasteredEl) statMasteredEl.textContent = masteredCount.toLocaleString();

    const statReviewEl = document.getElementById('repo-stat-review');
    if (statReviewEl) statReviewEl.textContent = reviewCount.toLocaleString();

    const statProgressEl = document.getElementById('repo-stat-progress');
    if (statProgressEl) statProgressEl.textContent = progressCount.toLocaleString();

    // Update counter badge in search bar
    const countBadge = document.getElementById('repo-count-badge');
    if (countBadge) {
      countBadge.textContent = totalItems === 0
        ? '0 Signs Found'
        : `Showing ${startIdx + 1}–${endIdx} of ${totalItems.toLocaleString()} Signs`;
    }

    // Update clear search button
    const searchClear = document.getElementById('repo-search-clear');
    if (searchClear) {
      searchClear.classList.toggle('hidden', !this.repoSearchQuery);
    }

    // Update pagination controls
    const firstBtn = document.getElementById('repo-first-btn');
    const prevBtn = document.getElementById('repo-prev-btn');
    const nextBtn = document.getElementById('repo-next-btn');
    const lastBtn = document.getElementById('repo-last-btn');
    const pageInfo = document.getElementById('repo-page-info');
    const pageNumbersContainer = document.getElementById('repo-page-numbers');

    if (pageInfo) {
      pageInfo.textContent = totalItems === 0 ? 'Page 0 of 0' : `Page ${this.repoCurrentPage} of ${totalPages}`;
    }
    if (firstBtn) firstBtn.disabled = this.repoCurrentPage <= 1;
    if (prevBtn) prevBtn.disabled = this.repoCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.repoCurrentPage >= totalPages;
    if (lastBtn) lastBtn.disabled = this.repoCurrentPage >= totalPages;

    // Render interactive page number chips (up to 5 pages window)
    if (pageNumbersContainer) {
      pageNumbersContainer.innerHTML = '';
      if (totalPages > 1) {
        const startPage = Math.max(1, this.repoCurrentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        const adjustedStart = Math.max(1, endPage - 4);

        for (let pg = adjustedStart; pg <= endPage; pg++) {
          const pgBtn = document.createElement('button');
          pgBtn.className = `repo-page-num ${pg === this.repoCurrentPage ? 'active' : ''}`;
          pgBtn.textContent = pg;
          pgBtn.title = `Go to page ${pg}`;
          pgBtn.addEventListener('click', () => {
            this.repoCurrentPage = pg;
            this.renderRepositoryGrid();
            document.getElementById('repo-card-grid')?.scrollTo({ top: 0, behavior: 'smooth' });
          });
          pageNumbersContainer.appendChild(pgBtn);
        }
      }
    }

    grid.innerHTML = '';

    if (totalItems === 0) {
      grid.innerHTML = `
        <div class="repo-empty-state">
          <div class="repo-empty-icon">🔍</div>
          <h3 class="repo-empty-title">No matching ISL signs found</h3>
          <p class="repo-empty-msg">No repository items match your current query and filters. Try clearing search or selecting "All".</p>
          <button class="repo-empty-reset-btn" id="repo-empty-reset-btn">Reset All Filters</button>
        </div>
      `;
      document.getElementById('repo-empty-reset-btn')?.addEventListener('click', () => {
        this.repoSearchQuery = '';
        const searchInput = document.getElementById('repo-search-input');
        if (searchInput) searchInput.value = '';
        this.repoLevelFilter = 'all';
        this.repoStatusFilter = 'all';
        this.repoCategoryFilter = 'all';
        document.querySelectorAll('#repo-quick-filters .repo-filter-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.filter === 'all');
        });
        this.repoCurrentPage = 1;
        this.renderExploreCategories();
        this.renderRepositoryGrid();
      });
      return;
    }

    pageItems.forEach(item => {
      const card = document.createElement('div');
      const isSelected = this.sl.currentSign?.id === item.id;
      const isInReview = this.learnerProfile.isInReviewQueue(item.id);
      const catMeta = REPOSITORY_CATEGORIES[item.category] || { label: item.category || 'General', icon: '💬' };
      const displayWord = item.phrase || item.sentence || item.word || `Sign #${item.id}`;

      // Learning state calculation from learner profile
      const isReviewSign = item.isGap || item.masteryStatus === 'needs_review' || isInReview;
      const stateObj = this.getMasteryState(isReviewSign ? 'needs_review' : (item.masteryStatus || item.status), item.id);

      card.className = `repo-card ${isSelected ? 'active active-playing' : ''}`;
      card.dataset.id = item.id;

      const perfHtml = item.performance?.attempts > 0
        ? `<span class="repo-perf-chip" title="${item.performance.attempts} attempts, ${item.performance.accuracy}% accuracy">${item.performance.attempts} att · ${item.performance.accuracy}%</span>`
        : '';

      const descHtml = item.description || item.meaning
        ? `<p class="repo-card-desc" title="${item.description || item.meaning}">${item.description || item.meaning}</p>`
        : '';

      card.innerHTML = `
        <div class="repo-card-top">
          <span class="repo-card-id">#${item.id}</span>
          <div class="repo-card-badges">
            <span class="repo-cat-tag" title="Category: ${catMeta.label}">${catMeta.icon} ${catMeta.label}</span>
            <span class="repo-badge-level level-${(item.level || 'beginner').toLowerCase()}">${item.level || 'Beginner'}</span>
          </div>
        </div>
        <div class="repo-card-body">
          <h3 class="repo-card-title" title="${displayWord}">${displayWord}</h3>
          <div class="repo-card-gloss"><span class="gloss-prefix">GLOSS:</span> ${item.gloss || '---'}</div>
          ${descHtml}
        </div>
        <div class="repo-card-meta">
          <span class="repo-status-pill status-${stateObj.key || item.status || 'not_started'}">${stateObj.icon || '⚪'} ${stateObj.label || item.statusLabel || 'Not Started'}</span>
          ${perfHtml}
        </div>
        <div class="repo-card-actions">
          <button class="btn-card-action btn-card-play" data-action="play" title="Play 3D ISL Sign on Avatar">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Play Sign</span>
          </button>
          <button class="btn-card-action btn-card-learn" data-action="learn" title="Open Pedagogical Learning Loop Phase 1 (Observe & Learn)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
            <span>Learn</span>
          </button>
          <button class="btn-card-action btn-card-practice" data-action="practice" title="Open Practice Phase (Assess & Drill)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
            <span>Practice</span>
          </button>
          <button class="btn-card-action btn-card-review ${isInReview ? 'active' : ''}" data-action="review" title="${isInReview ? 'Remove sign from Review Queue' : 'Add sign to Review Queue'}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
            <span class="review-label">${isInReview ? 'In Review' : 'Review'}</span>
          </button>
        </div>
      `;

      // Entire card click -> Play Sign & select
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-action')) return;
        this.playSignItem(item);
      });

      // Play Sign button
      card.querySelector('.btn-card-play')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playSignItem(item);
      });

      // Learn button -> opens Learning Loop Phase 1
      card.querySelector('.btn-card-learn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        learningLoopController.open(item);
        learningLoopController.setPhase(1);
      });

      // Practice button -> opens Learning Loop Phase 2
      card.querySelector('.btn-card-practice')?.addEventListener('click', (e) => {
        e.stopPropagation();
        learningLoopController.open(item);
        learningLoopController.setPhase(2);
      });

      // Add/Remove Review button -> toggles reviewQueue
      card.querySelector('.btn-card-review')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.learnerProfile.toggleReviewQueue(item.id);
        if (this.sl.currentSign?.id === item.id) {
          this.updateInspectorSignDetails(item);
        }
        this.renderRepositoryGrid();
      });

      grid.appendChild(card);
    });

    // If an item is already active/selected, ensure inspector reflects it
    if (this.sl.currentSign) {
      this.updateInspectorSignDetails(this.sl.currentSign);
    } else if (pageItems.length > 0) {
      this.updateInspectorSignDetails(pageItems[0]);
    }
  }

  // Update Inspector Panel with sign metadata and review state
  updateInspectorSignDetails(item) {
    if (!item) return;
    const catMeta = REPOSITORY_CATEGORIES[item.category] || { label: item.category || 'General', icon: '💬' };
    const displayWord = item.phrase || item.sentence || item.word || `Sign #${item.id}`;
    const isInReview = this.learnerProfile.isInReviewQueue(item.id);

    // 1. Update Repository HUD elements
    const hudSentence = document.getElementById('hud-sentence-text');
    const hudGloss = document.getElementById('hud-gloss-text');
    const hudCatTag = document.getElementById('hud-category-tag');
    const hudDesc = document.getElementById('hud-description-text');
    const inspectorLevel = document.getElementById('inspector-level-badge');
    const inspectorSignId = document.getElementById('inspector-sign-id');
    const inspectorStatus = document.getElementById('inspector-status-pill');
    const inspectorReviewBtn = document.getElementById('inspector-btn-review');
    const inspectorReviewLabel = document.getElementById('inspector-review-label');

    if (hudSentence) hudSentence.textContent = displayWord;
    if (hudGloss) hudGloss.textContent = item.gloss || '---';
    if (hudCatTag) {
      hudCatTag.textContent = `${catMeta.icon} ${catMeta.label}`;
      hudCatTag.style.display = 'inline-flex';
    }
    if (hudDesc) {
      const desc = item.description || item.meaning || '';
      hudDesc.textContent = desc;
      hudDesc.style.display = desc ? 'block' : 'none';
    }
    if (inspectorLevel) {
      inspectorLevel.textContent = item.level || 'Beginner';
      inspectorLevel.className = `inspector-level-badge level-${(item.level || 'beginner').toLowerCase()}`;
    }
    if (inspectorSignId) {
      inspectorSignId.textContent = `#${item.id}`;
    }
    if (inspectorStatus) {
      const isReviewSign = item.isGap || item.masteryStatus === 'needs_review' || isInReview;
      const stateObj = this.getMasteryState(isReviewSign ? 'needs_review' : (item.masteryStatus || item.status), item.id);
      inspectorStatus.textContent = `${stateObj.icon || '⚪'} ${stateObj.label || item.statusLabel || 'Not Started'}`;
      inspectorStatus.className = `inspector-status-pill status-${stateObj.key || item.status || 'not_started'}`;
    }
    if (inspectorReviewBtn) {
      inspectorReviewBtn.classList.toggle('active', isInReview);
    }
    if (inspectorReviewLabel) {
      inspectorReviewLabel.textContent = isInReview ? 'In Review' : 'Add to Review';
    }

    // Keep active styling on matching card in grid
    document.querySelectorAll('#repo-card-grid .repo-card').forEach(c => {
      const isThis = c.dataset.id === String(item.id);
      c.classList.toggle('active', isThis);
      c.classList.toggle('active-playing', isThis);
    });
  }

  // Play repository item on 3D avatar using authentic pipeline
  playSignItem(item) {
    if (!item) return;
    this.sl.currentSign = item;
    this.updateInspectorSignDetails(item);

    // Play BVH via authoritative signSyncController
    const bvhPath = item.bvh || `Train/${item.id}/${item.id}.bvh`;
    const resolvedSample = {
      id: String(item.id),
      bvh: bvhPath,
      sentence: item.sentence || item.word || item.phrase,
      gloss: item.gloss
    };

    if (window.signSyncController) {
      window.signSyncController.requestSign({
        type: 'BVH',
        id: String(item.id),
        path: bvhPath,
        label: resolvedSample.sentence,
        gloss: resolvedSample.gloss,
        sample: resolvedSample
      }, { isManual: true });
    }
  }

  executeSignAnimation(item) {
    return this.playSignItem(item);
  }

  async playBvhSign(sample, reqId) {
    if (!sample) return;
    if (window.signSyncController && typeof window.signSyncController.playBvhFn === 'function') {
      return window.signSyncController.playBvhFn(sample, reqId);
    }
    const bvhPath = typeof sample === 'string' ? sample : (sample.bvh || sample.path);
    if (window.signSyncController) {
      window.signSyncController.requestSign({
        type: 'BVH',
        id: String(sample.id || ''),
        path: bvhPath,
        label: sample.sentence || sample.word || '',
        gloss: sample.gloss || '',
        sample: sample
      }, { isManual: true });
    }
  }

  // Stop active animation immediately and reset all state
  stopCurrentSign() {
    this.sl.requestId = (this.sl.requestId || 0) + 1;
    if (this.translationService) {
      this.translationService.cancel();
    }
    if (this.sl.sentenceTimeline) {
      this.sl.sentenceTimeline.stop();
    }
    if (this.sl.letterTimeout) {
      clearTimeout(this.sl.letterTimeout);
      this.sl.letterTimeout = null;
    }
    if (this.sl.bvhMixer) {
      try {
        if (this.sl.activeBvhFinishHandler) {
          this.sl.bvhMixer.removeEventListener('finished', this.sl.activeBvhFinishHandler);
          this.sl.activeBvhFinishHandler = null;
        }
        this.sl.bvhMixer.stopAllAction();
      } catch {}
    }
    if (this.sl.bvhRoot && this.sl.bvhRoot.parent) {
      this.sl.scene.remove(this.sl.bvhRoot);
    }
    if (this.sl.retargeter) {
      this.sl.retargeter.bvhSkeleton = null;
      this.sl.retargeter.resetCharacterPose();
    }
    if (this.sl.fingerspeller && typeof this.sl.fingerspeller.resetToRestPose === 'function') {
      this.sl.fingerspeller.resetToRestPose();
    }
    const overlay = document.getElementById('edu-sl-letter-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  isSignLearnActive() {
    return this.currentTab === 'signlearn' ||
      document.getElementById('edu-stage-signlearn')?.classList.contains('active');
  }

  // Handle incoming spoken words/sentences in ANY language via offline translation with immediate cancellation
  async handleSpeechInput(spokenText, audioBlob = null) {
    const clean = (spokenText || '').trim();
    if (!clean && !audioBlob) return;
    
    console.log('🎤 STEP 2 - Text recognized:', clean);
    console.log('🎤 RECOGNIZED TEXT:', clean);

    // 1. Immediate cancellation of any previous animation / fingerspelling / sentence / speech request
    this.stopCurrentSign();
    this.translationService.cancel();
    const reqId = ++this.sl.requestId;

    const statusEl = document.getElementById('edu-sl-status');
    if (statusEl) {
      statusEl.textContent = 'Understanding speech...';
    }

    // 2. Process via offline multilingual pipeline internally (detect language, STT, translate to English)
    const result = await this.translationService.processMultilingualInput({
      text: clean,
      audioBlob,
      requestId: reqId
    });

    // 3. Preemption check: If another input arrived while translating, discard response immediately
    if (reqId !== this.sl.requestId || result.aborted) return;
    
    console.log('🎤 STEP 3 - Language detected:', result.detectedLanguage);
    console.log('🌐 STEP 4 - Translation input:', clean);
    console.log('🌐 STEP 5 - Translation output:', result.englishText);

    const englishInput = (result.englishText || clean).trim();
    if (!englishInput) return;

    // Display user's original speech in input box (NEVER the translated English!)
    const inputEl = document.getElementById('edu-sl-sentence-input');
    if (inputEl) {
      inputEl.value = clean || englishInput;
    }

    // Check if input is a sentence or multi-word phrase
    const words = englishInput.split(/\s+/).filter(Boolean);
    if (words.length > 1 || /[.?!,;:]/.test(englishInput)) {
      this.playSentence(englishInput, { originalText: clean, sourceLang: result.sourceLanguage, reqId });
      return;
    }

    // Required development log
    console.log('[ISL] input sent to signMatcher:', englishInput);

    // Single word / token:
    // Check if matched in authentic sign library
    const matched = matchSignExact(englishInput);
    if (matched && matched.sign && (matched.tier <= 3 || matched.score >= 0.8)) {
      this.previewSign(matched.sign);
      return;
    }

    // Otherwise route through sentence signing engine
    this.playSentence(englishInput, { originalText: clean, sourceLang: result.sourceLanguage, reqId });
  }

  // -------------------------------------------------------
  // COMPLETE ISL SENTENCE SIGNING ENGINE
  // -------------------------------------------------------
  async playSentence(sentenceText, meta = {}) {
    const raw = (sentenceText || '').trim();
    if (!raw) return;

    // 1. Immediate interruption / cancellation of any previous animation
    if (!meta.reqId || meta.reqId !== this.sl.requestId) {
      this.stopCurrentSign();
      this.translationService.cancel();
      this.sl.requestId = (this.sl.requestId || 0) + 1;
    }
    const reqId = this.sl.requestId;

    // Check if text needs internal offline translation (e.g. if entered directly in non-English)
    let englishText = raw;
    const detectedLang = meta.sourceLang || this.translationService.detectLanguage(raw);

    if (detectedLang !== 'en') {
      const statusEl = document.getElementById('edu-sl-status');
      if (statusEl) statusEl.textContent = 'Understanding speech...';

      const res = await this.translationService.processMultilingualInput({
        text: raw,
        requestId: reqId
      });

      if (reqId !== this.sl.requestId || res.aborted) return;
      englishText = res.englishText || raw;
    }

    // 2. ISL Grammar Transformation: Topic-Comment, SOV, WH-to-end, Negation-to-end, quantifiers
    const translation = IslGrammar.translate(englishText);
    const { sentence, sentenceType, glossSequence } = translation;

    this.sl.currentSentence = sentence;
    this.sl.currentGlossSequence = glossSequence;
    this.sl.currentSign = null;

    console.log(
      `%c[ISL Sentence Signing]%c\n` +
      `INPUT TEXT:         "${meta.originalText || raw}"\n` +
      `SOURCE LANGUAGE:    ${detectedLang}\n` +
      `INTERNAL ENGLISH:   "${englishText}"\n` +
      `SENTENCE TYPE:      ${sentenceType}\n` +
      `ISL GLOSS SEQUENCE: [${glossSequence.map(g => g.label).join(' → ')}]\n` +
      `SPEED:              ${this.sl.playbackSpeed}x\n` +
      `REQUEST ID:         #${reqId}`,
      'color: #10b981; font-weight: bold;',
      'color: inherit;'
    );

    // 3. UI State: Update sentence bar & input (NEVER show internal English translation!)
    const inputEl = document.getElementById('edu-sl-sentence-input');
    const displayInInput = meta.originalText || raw;
    if (inputEl && inputEl.value !== displayInInput) {
      inputEl.value = displayInInput;
    }

    // 4. Render Live ISL Gloss Sequence Strip
    const glossWrap = document.getElementById('edu-sl-gloss-strip-wrap');
    const glossStrip = document.getElementById('edu-sl-gloss-strip');
    const typeBadge = document.getElementById('edu-sl-sentence-type-badge');

    if (typeBadge) {
      typeBadge.textContent = sentenceType;
    }

    if (glossStrip) {
      glossStrip.innerHTML = '';
      glossSequence.forEach((item, idx) => {
        const chip = document.createElement('div');
        chip.className = 'edu-sl-gloss-chip pending';
        chip.id = `edu-sl-chip-${idx}`;
        chip.dataset.index = idx;
        chip.innerHTML = `
          <span class="chip-num">${idx + 1}</span>
          <span class="chip-gloss">${item.label}</span>
          <span class="chip-type">${item.type === 'fingerspell' ? 'FS' : item.type === 'number' ? 'NUM' : item.type === 'letter' ? 'CHAR' : 'SIGN'}</span>
        `;
        chip.addEventListener('click', () => {
          if (this.sl.sentenceTimeline) {
            this.sl.sentenceTimeline._executeSign(item, this.sl.requestId);
          }
        });
        glossStrip.appendChild(chip);
      });
    }
    if (glossWrap) glossWrap.classList.remove('hidden');

    // 5. Update Right Info Panel (Never expose internal English translation)
    const wordEl = document.getElementById('edu-sl-info-word');
    const hintEl = document.getElementById('edu-sl-info-hint');
    const typeEl = document.getElementById('edu-sl-info-type');
    const masteryEl = document.getElementById('edu-sl-info-mastery');

    if (wordEl) wordEl.textContent = `"${displayInInput}"`;
    if (hintEl) hintEl.textContent = `ISL Sequence: ${glossSequence.map(g => g.label).join(' → ')}`;
    if (typeEl) typeEl.textContent = `Complete ISL Sentence (${sentenceType})`;
    if (masteryEl) {
      masteryEl.textContent = 'ACTIVE';
      masteryEl.className = 'edu-sl-status-pill mastery-learning';
    }

    const statusEl = document.getElementById('edu-sl-status');
    if (statusEl) {
      statusEl.textContent = `Demonstrating ISL sentence (${this.sl.playbackSpeed}x)...`;
    }

    // 6. Ensure 3D Avatar Scene is Initialized
    if (!this.sl.loaded) {
      await this.initSignLearnScene();
    }
    if (reqId !== this.sl.requestId) return;

    if (this.sl.sentenceTimeline) {
      this.sl.sentenceTimeline.setSpeed(this.sl.playbackSpeed);
      this.sl.sentenceTimeline.playSequence(sentence, glossSequence);
    }
  }

  // Sentence Timeline Event Handlers
  onTimelineSignStart({ item, index, total, reqId }) {
    if (reqId !== this.sl.requestId) return;

    // Update gloss chips
    const glossStrip = document.getElementById('edu-sl-gloss-strip');
    if (glossStrip) {
      const chips = glossStrip.querySelectorAll('.edu-sl-gloss-chip');
      chips.forEach((chip, i) => {
        if (i < index) {
          chip.className = 'edu-sl-gloss-chip completed';
        } else if (i === index) {
          chip.className = 'edu-sl-gloss-chip active';
          chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
          chip.className = 'edu-sl-gloss-chip pending';
        }
      });
    }

    // Update Right Panel Info
    const wordEl = document.getElementById('edu-sl-info-word');
    const hintEl = document.getElementById('edu-sl-info-hint');
    const typeEl = document.getElementById('edu-sl-info-type');
    const statusEl = document.getElementById('edu-sl-status');

    const typeDesc = item.type === 'fingerspell'
      ? `Fingerspelling: "${item.label}"`
      : item.type === 'number'
        ? `Number Sign: "${item.signRef}"`
        : item.type === 'letter'
          ? `Alphabet Pose: "${item.signRef}"`
          : item.type === 'bvh'
            ? `Authentic ISL Motion: "${item.label}"`
            : `ISL Lexical Sign: "${item.label}"`;

    if (wordEl) wordEl.textContent = item.label;
    if (hintEl) hintEl.textContent = `Sign ${index + 1} of ${total} in "${this.sl.currentSentence}"`;
    if (typeEl) typeEl.textContent = typeDesc;
    if (statusEl) {
      statusEl.textContent = `Signing "${item.label}" (${index + 1}/${total}) [${this.sl.playbackSpeed}x]`;
    }

    // If not a fingerspelled/letter/number sign, hide letter overlay
    if (item.type !== 'fingerspell' && item.type !== 'number' && item.type !== 'letter') {
      const overlay = document.getElementById('edu-sl-letter-overlay');
      if (overlay) overlay.classList.add('hidden');
    }
  }

  onTimelineLetterStep({ item, letter, index, total, word, type, reqId }) {
    if (reqId !== this.sl.requestId) return;

    const overlay = document.getElementById('edu-sl-letter-overlay');
    const letterCharEl = document.getElementById('edu-sl-letter-char');
    const letterWordEl = document.getElementById('edu-sl-letter-word');
    const letterStepEl = document.getElementById('edu-sl-letter-step');
    const statusEl = document.getElementById('edu-sl-status');

    if (overlay) {
      overlay.classList.remove('hidden');
      if (letterCharEl) letterCharEl.textContent = letter;
      if (letterWordEl) letterWordEl.textContent = word || item.label;
      if (letterStepEl) {
        letterStepEl.textContent = type === 'fingerspell'
          ? `Letter ${index + 1} of ${total}`
          : type === 'number'
            ? 'ISL Number Pose'
            : 'ISL Alphabet Pose';
      }
    }

    if (statusEl) {
      statusEl.textContent = type === 'fingerspell'
        ? `Fingerspelling "${word}": showing letter ${letter} (${index + 1}/${total}) [${this.sl.playbackSpeed}x]`
        : `Showing sign "${letter}" [${this.sl.playbackSpeed}x]`;
    }
  }

  onTimelineSignEnd({ item, index, total, reqId }) {
    if (reqId !== this.sl.requestId) return;
    const chip = document.getElementById(`edu-sl-chip-${index}`);
    if (chip) {
      chip.className = 'edu-sl-gloss-chip completed';
    }
  }

  onTimelineSentenceComplete({ sentence, glossSequence, reqId }) {
    if (reqId !== this.sl.requestId) return;

    const glossStrip = document.getElementById('edu-sl-gloss-strip');
    if (glossStrip) {
      glossStrip.querySelectorAll('.edu-sl-gloss-chip').forEach(chip => {
        chip.className = 'edu-sl-gloss-chip completed';
      });
    }

    const overlay = document.getElementById('edu-sl-letter-overlay');
    if (overlay) overlay.classList.add('hidden');

    const statusEl = document.getElementById('edu-sl-status');
    if (statusEl) {
      statusEl.textContent = `Completed sentence: "${sentence}" (Replay anytime)`;
    }

    const wordEl = document.getElementById('edu-sl-info-word');
    if (wordEl) wordEl.textContent = `"${sentence}"`;

    const masteryEl = document.getElementById('edu-sl-info-mastery');
    if (masteryEl) {
      masteryEl.textContent = 'COMPLETED';
      masteryEl.className = 'edu-sl-status-pill mastery-mastered';
    }

    this.updatePlayPauseUI(false, false);
  }

  onTimelineStateChange(state) {
    this.updatePlayPauseUI(state.isPlaying, state.isPaused);
  }

  updatePlayPauseUI(isPlaying, isPaused) {
    const pauseIcon = document.getElementById('edu-sl-pause-icon');
    const playIcon = document.getElementById('edu-sl-play-icon');
    const textEl = document.getElementById('edu-sl-playpause-text');

    if (isPlaying) {
      if (isPaused) {
        if (pauseIcon) pauseIcon.classList.add('hidden');
        if (playIcon) playIcon.classList.remove('hidden');
        if (textEl) textEl.textContent = 'Resume';
      } else {
        if (pauseIcon) pauseIcon.classList.remove('hidden');
        if (playIcon) playIcon.classList.add('hidden');
        if (textEl) textEl.textContent = 'Pause';
      }
    } else {
      if (pauseIcon) pauseIcon.classList.add('hidden');
      if (playIcon) playIcon.classList.remove('hidden');
      if (textEl) textEl.textContent = 'Play';
    }
  }

  // 8. 3D Avatar Preview & Sign Playback
  // Monotonic Cancellation-Safe BVH Playback Controller
  async playSignItem(item) {
    if (!item) return;

    // Invalidate any running animation: currentPlaybackSessionId++
    currentPlaybackSessionId++;
    currentPlaybackToken = currentPlaybackSessionId;
    // Capture local session token: const thisSession = currentPlaybackSessionId;
    const thisSession = currentPlaybackSessionId;

    // Abort active BVH frame steps and clear pending timeouts
    if (slerpAnimationId) {
      cancelAnimationFrame(slerpAnimationId);
      slerpAnimationId = null;
    }
    this.stopCurrentSign();
    this.sl.currentSign = item;

    // Hide sentence strip when viewing an individual sign
    const glossWrap = document.getElementById('edu-sl-gloss-strip-wrap');
    if (glossWrap) glossWrap.classList.add('hidden');

    // Highlight the clicked card with an .active-playing CSS class
    document.querySelectorAll('.sign-card, .edu-sign-card-rich, .edu-sign-item').forEach(c => {
      const isThis = c.dataset.id === String(item.id);
      c.classList.toggle('active', isThis);
      c.classList.toggle('active-playing', isThis);
    });

    const isRTC = this.currentViewId === 'view-realtime-comm' || this.currentViewId === 'realtime-comm-view';
    const isPersonalized = this.currentViewId === 'view-personalized-learning' || this.currentViewId === 'personalized-learning' || this.currentViewId === 'curriculum';
    const isHiddenView = isRTC || isPersonalized || this.currentViewId === 'view-landing' || this.currentViewId === 'view-isl-repository';
    const canvasContainer = document.getElementById('canvas-container');
    if (!isHiddenView && canvasContainer && canvasContainer.classList.contains('hidden-canvas')) {
      canvasContainer.classList.remove('hidden-canvas');
      this.resizePersistentCanvas();
    }

    // Update Right Panel Info Card / HUD immediately
    const wordEl = document.getElementById('edu-sl-info-word');
    const hintEl = document.getElementById('edu-sl-info-hint');
    const typeEl = document.getElementById('edu-sl-info-type');
    const masteryEl = document.getElementById('edu-sl-info-mastery');
    const levelEl = document.getElementById('edu-sl-info-level');
    const catEl = document.getElementById('edu-sl-info-cat');
    const statusEl = document.getElementById('edu-sl-status');

    const stat = this.learnerProfile.getItemStats(item.id);
    const displayWord = item.phrase || item.sentence || item.text || item.word;
    const catMeta = REPOSITORY_CATEGORIES[item.category] || { label: item.category || 'General', icon: '💬' };
    const levelStr = (item.level || item.proficiencyLevel || 'beginner').toUpperCase();

    if (wordEl) wordEl.textContent = this.sl.isMasked ? '??? (Comprehension Assessment)' : displayWord;
    if (hintEl) hintEl.textContent = this.sl.isMasked ? 'Comprehension Test — Observe avatar motion carefully' : (item.hint || `ISL Gloss: ${item.gloss || displayWord}`);
    if (levelEl) {
      levelEl.textContent = levelStr;
      levelEl.className = `meta-tag meta-tag-level repo-level-tag level-${levelStr.toLowerCase()}`;
    }
    if (catEl) {
      catEl.textContent = `${catMeta.icon} ${catMeta.label}`;
    }
    const isAlphabetOrNumber = (item.category || '').toLowerCase() === 'alphabets' || 
                               (item.category || '').toLowerCase() === 'numbers' || 
                               (displayWord.length === 1 && /^[A-Za-z0-9]$/.test(displayWord));

    if (typeEl) {
      typeEl.textContent = isAlphabetOrNumber ? 'Procedural Fingerspelling' : 'Authentic ISL Motion (BVH)';
    }
    if (masteryEl) {
      const isReviewSign = item.isGap || stat.status === 'needs_review' || (this.learnerProfile?.data?.reviewQueue || []).includes(item.id);
      const stateObj = this.getMasteryState(isReviewSign ? 'needs_review' : stat.status, item.id);
      masteryEl.textContent = stateObj.label.toUpperCase();
      masteryEl.className = `edu-sl-status-pill mastery-${stateObj.classKey}`;
    }

    const speed = this.sl.playbackSpeed || 1.0;
    if (statusEl) statusEl.textContent = `Playing ISL motion for "${displayWord}"...`;

    // Direct playback through authoritative signSyncController
    const hasNumericId = /^\d+$/.test(String(item.id));
    const hasExplicitBvh = typeof item.bvh === 'string' && item.bvh.length > 0;

    if (window.signSyncController) {
      if (!isAlphabetOrNumber && (hasExplicitBvh || hasNumericId)) {
        const bvhPath = item.bvh || `Train/${item.id}/${item.id}.bvh`;
        const resolvedSample = {
          id: String(item.id),
          bvh: bvhPath,
          sentence: displayWord,
          gloss: item.gloss || displayWord
        };
        window.signSyncController.requestSign({
          type: 'BVH',
          id: String(item.id),
          path: bvhPath,
          label: displayWord,
          gloss: item.gloss || displayWord,
          sample: resolvedSample
        }, { isManual: true });
      } else {
        window.signSyncController.requestSign({
          type: 'FINGERSPELL',
          word: displayWord,
          label: displayWord,
          gloss: item.gloss || displayWord,
          chars: [displayWord]
        }, { isManual: true });
      }

      if (typeof learnerStore !== 'undefined') {
        learnerStore.recordAttempt(item.id, { success: true, accuracy: 1.0 });
        if (this.learnerProfile) {
          this.learnerProfile.data = learnerStore.data;
          this.syncAllLearnerViews();
        }
      }
      return;
    }

    // Ensure 3D avatar scene is initialized (fallback)
    if (!this.sl.loaded) {
      await this.initSignLearnScene();
    }

    // Guard execution: In every frame tick or resolution callback, check if currentPlaybackSessionId !== thisSession
    if (currentPlaybackSessionId !== thisSession) return;

    const retargeter = this.sl.retargeter;
    if (!retargeter) {
      console.warn('[EduApp] Retargeter not available for playback.');
      return;
    }

    try {
      const bvhFilePath = 'Train/' + item.id + '/' + item.id + '.bvh';

      // Invoke the retargeter: await retargeter.playBVH('Train/' + id + '/' + id + '.bvh')
      let bvhData = null;
      if (this.sl.bvhCache?.has(bvhFilePath)) {
        bvhData = this.sl.bvhCache.get(bvhFilePath);
        await retargeter.playBVH(bvhData, thisSession);
      } else {
        bvhData = await retargeter.playBVH(bvhFilePath, thisSession);
        if (bvhData && this.sl.bvhCache) {
          this.sl.bvhCache.set(bvhFilePath, bvhData);
        }
      }

      // Guard execution: If stale, immediately abort and do NOT commit state
      if (currentPlaybackSessionId !== thisSession) return;

      if (!bvhData || !bvhData.skeleton || !bvhData.clip) {
        throw new Error(`Failed to load valid BVH animation from ${bvhFilePath}`);
      }

      // Clean previous BVH root & stop previous mixer
      if (this.sl.bvhRoot && this.sl.bvhRoot.parent) {
        this.sl.scene.remove(this.sl.bvhRoot);
      }
      if (this.sl.bvhMixer) {
        try { this.sl.bvhMixer.stopAllAction(); } catch {}
      }

      const bvhSkeleton = bvhData.skeleton;
      this.sl.bvhRoot = bvhSkeleton.bones[0];
      this.sl.bvhRoot.visible = false;
      this.sl.scene.add(this.sl.bvhRoot);

      this.sl.bvhMixer = new THREE.AnimationMixer(this.sl.bvhRoot);
      const action = this.sl.bvhMixer.clipAction(bvhData.clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.timeScale = speed;
      action.play();

      if (statusEl) statusEl.textContent = `Playing ISL motion: "${displayWord}" (${speed}x)`;

      // Cleanup any previous finish listener
      if (this.sl.activeBvhFinishHandler && this.sl.bvhMixer) {
        this.sl.bvhMixer.removeEventListener('finished', this.sl.activeBvhFinishHandler);
      }

      let hasCleanlyCompleted = false;

      const onCleanCompletion = () => {
        if (hasCleanlyCompleted) return;
        // Guard execution: In resolution callback, check if currentPlaybackSessionId !== thisSession. If stale, immediately abort and do NOT commit state.
        if (currentPlaybackSessionId !== thisSession) return;
        hasCleanlyCompleted = true;

        if (statusEl) {
          statusEl.textContent = `Demonstrated: "${displayWord}" (Completed)`;
        }

        // LEARNER PROFILE AUTO-SYNC:
        // When a sign completes without interruption, automatically execute:
        learnerStore.recordAttempt(item.id, { success: true, accuracy: 1.0 });

        // Synchronize internal learnerProfile instance and views
        if (this.learnerProfile) {
          this.learnerProfile.data = learnerStore.data;
          this.syncAllLearnerViews();
        }

        // On clean completion, smoothly interpolate (SLERP, 250ms) avatar joints back to the rest quaternion pose
        this.slerpAvatarToRestPose(thisSession, 250);

        // Remove .active-playing CSS class from cards
        document.querySelectorAll(`.sign-card[data-id="${item.id}"]`).forEach(c => {
          c.classList.remove('active-playing');
        });

        if (this.sl.bvhMixer && this.sl.activeBvhFinishHandler) {
          this.sl.bvhMixer.removeEventListener('finished', this.sl.activeBvhFinishHandler);
          this.sl.activeBvhFinishHandler = null;
        }
      };

      this.sl.activeBvhFinishHandler = onCleanCompletion;
      this.sl.bvhMixer.addEventListener('finished', onCleanCompletion);

      // Clip duration fallback to ensure clean completion trigger
      const clipDuration = bvhData.clip.duration || 2.0;
      const durationMs = Math.max(200, (clipDuration / speed) * 1000);
      setTimeout(() => {
        if (currentPlaybackSessionId === thisSession && !hasCleanlyCompleted) {
          onCleanCompletion();
        }
      }, durationMs + 80);

    } catch (err) {
      if (currentPlaybackSessionId !== thisSession) return;
      console.warn(`[EduApp] Playback error for sign item #${item.id}:`, err);
      if (statusEl) statusEl.textContent = `Unable to play ISL motion for #${item.id}.`;
      document.querySelectorAll(`.sign-card[data-id="${item.id}"]`).forEach(c => {
        c.classList.remove('active-playing');
      });
    }
  }

  // Smooth Quaternion SLERP transition returning all avatar joints to rest quaternion pose (250ms)
  slerpAvatarToRestPose(sessionToken, duration = 250) {
    if (!this.sl.retargeter || !this.sl.character) return;

    // Disengage BVH skeleton so retargeter update loop does not override SLERP
    this.sl.retargeter.bvhSkeleton = null;
    if (this.sl.bvhMixer) {
      try { this.sl.bvhMixer.stopAllAction(); } catch {}
    }

    const boneStarts = new Map();
    this.sl.retargeter.pristineTransforms.forEach((pristine, bone) => {
      boneStarts.set(bone, bone.quaternion.clone());
    });

    const startTime = performance.now();

    const animateSlerp = (now) => {
      // Guard: Abort immediately if session token changed
      if (sessionToken !== currentPlaybackSessionId) return;

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      // Cubic ease-out
      const t = 1 - Math.pow(1 - progress, 3);

      this.sl.retargeter.pristineTransforms.forEach((pristine, bone) => {
        const startQ = boneStarts.get(bone);
        if (startQ) {
          bone.quaternion.slerpQuaternions(startQ, pristine.localQuat, t);
          bone.updateMatrix();
        }
      });
      this.sl.character.updateWorldMatrix(true, true);

      if (progress < 1.0) {
        slerpAnimationId = requestAnimationFrame(animateSlerp);
      } else {
        this.sl.retargeter.resetCharacterPose();
        slerpAnimationId = null;
      }
    };

    slerpAnimationId = requestAnimationFrame(animateSlerp);
  }

  // ============================================================
  // FEATURE 6: REAL-TIME VOICE/TEXT TRANSLATION WITH ISL MATCHER
  // ============================================================
  setupSpeechAndTextInput() {
    const SpeechRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    const micButtons = [
      document.getElementById('edu-sl-mic-btn')
    ].filter(Boolean);

    let activeRecognition = null;
    let isListening = false;

    const stopListening = () => {
      isListening = false;
      this.isSlMicActive = false;
      micButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      const micLabel = document.getElementById('edu-sl-mic-label');
      if (micLabel) micLabel.textContent = 'Voice';
      if (activeRecognition) {
        try { activeRecognition.stop(); } catch {}
        activeRecognition = null;
      }
      if (this.slMicStream) {
        try { this.slMicStream.getTracks().forEach(t => t.stop()); } catch {}
        this.slMicStream = null;
      }
      const statusEl = document.getElementById('edu-sl-status');
      if (statusEl && statusEl.textContent.includes('Listening')) {
        statusEl.textContent = 'Voice input standby.';
      }
    };

    const startListening = async () => {
      if (!SpeechRec) {
        console.warn('[EduApp] SpeechRecognition API not supported in this browser.');
        if (typeof window.showToast === 'function') {
          window.showToast('Speech Recognition not supported in this browser.');
        }
        return;
      }

      try {
        const recognition = new SpeechRec();
        // Configure strictly according to specifications:
        // continuous = false, interimResults = false, lang = 'en-US'
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          console.log('🎤 STEP 1 - Audio captured (start)');
          isListening = true;
          this.isSlMicActive = true;
          micButtons.forEach(btn => {
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
          });
          const micLabel = document.getElementById('edu-sl-mic-label');
          if (micLabel) micLabel.textContent = 'Listening...';
          const statusEl = document.getElementById('edu-sl-status');
          if (statusEl) statusEl.textContent = 'Listening for voice input (en-IN)...';
        };

        // Pipe recognized text to processInputToISL(rawText)
        recognition.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          if (transcript.trim()) {
            this.processInputToISL(transcript.trim());
          }
          stopListening();
        };

        recognition.onerror = (e) => {
          console.warn('[EduApp] Speech recognition notice:', e.error);
          const isDenied = e.error === 'not-allowed' || e.error === 'service-not-allowed';
          const isNoSpeech = e.error === 'no-speech';
          const statusEl = document.getElementById('edu-sl-status');
          if (statusEl) {
            if (isDenied) {
              statusEl.textContent = 'Microphone permission denied. Voice input requires microphone access.';
            } else if (isNoSpeech) {
              statusEl.textContent = 'No speech detected. Please speak clearly into the microphone.';
            } else {
              statusEl.textContent = `Speech input notice: ${e.error}`;
            }
          }
          if (isDenied && typeof window.showToast === 'function') {
            window.showToast('Microphone permission denied. No audio input available.');
          }
          stopListening();
        };

        recognition.onend = () => {
          stopListening();
        };

        if (navigator.mediaDevices?.getUserMedia) {
          try {
            this.slMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (err) {
            console.warn('[EduApp] Mic stream permission error:', err);
            const statusEl = document.getElementById('edu-sl-status');
            if (statusEl) {
              statusEl.textContent = 'Microphone access denied. Voice input requires microphone permission.';
            }
            if (typeof window.showToast === 'function') {
              window.showToast('Microphone access denied. Please allow microphone permissions in browser settings.');
            }
            stopListening();
            return;
          }
        }

        activeRecognition = recognition;
        this.slSpeechRecognition = recognition;
        recognition.start();
      } catch (err) {
        console.warn('[EduApp] Error starting SpeechRecognition:', err);
        const statusEl = document.getElementById('edu-sl-status');
        if (statusEl) {
          statusEl.textContent = 'Microphone access denied or speech service unavailable.';
        }
        stopListening();
      }
    };

    micButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isListening) {
          startListening();
        } else {
          stopListening();
        }
      });
    });

    // Pipe text typed into #manual-text-input to processInputToISL(rawText)
    const manualInput = document.getElementById('manual-text-input');
    const btnManualSign = document.getElementById('btn-manual-sign');

    const submitManualInput = () => {
      const val = manualInput?.value?.trim();
      if (val) {
        this.processInputToISL(val);
      }
    };

    btnManualSign?.addEventListener('click', (e) => {
      e.preventDefault();
      submitManualInput();
    });

    manualInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitManualInput();
      }
    });

    // Wire simulation / testing prompt strip chips
    document.querySelectorAll('.test-phrase-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const phrase = chip.dataset.phrase || chip.textContent.trim();
        if (phrase) {
          if (manualInput) manualInput.value = phrase;
          this.processInputToISL(phrase);
        }
      });
    });

    // Sentence input in Sign Learn tab
    const sentenceInput = document.getElementById('edu-sl-sentence-input');
    sentenceInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = sentenceInput.value?.trim();
        if (val) {
          this.processInputToISL(val);
        }
      }
    });
  }

  /**
   * Feature 6: Real-Time Voice/Text Translation with Procedural Fingerspelling Fallback
   * Pipes recognized speech or manual text input to signMatcher.parseAndMatchSequence(rawText)
   * and executes sequential animation controller via signSyncController.
   * @param {string} rawText
   * @returns {Promise<Array<Object>>}
   */
  async processInputToISL(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return [];
    const clean = rawText.trim();
    console.log('[EduApp] processInputToISL:', clean);

    // 1. Update UI caption & status displays
    const speechEl = document.getElementById('caption-speech-text');
    const glossEl = document.getElementById('caption-gloss-text');
    const statusEl = document.getElementById('edu-sl-status') || document.getElementById('caption-status');
    const infoWordEl = document.getElementById('edu-sl-info-word');
    const manualInput = document.getElementById('manual-text-input');
    const sentenceInput = document.getElementById('edu-sl-sentence-input');

    if (speechEl) speechEl.textContent = clean;
    if (infoWordEl) infoWordEl.textContent = clean;
    if (manualInput && manualInput.value !== clean) manualInput.value = clean;
    if (sentenceInput && sentenceInput.value !== clean) sentenceInput.value = clean;
    if (statusEl) statusEl.textContent = `Translating to ISL: "${clean}"...`;

    // 2. Ensure signMatcher is initialized
    const matcher = this.sl.signMatcher || window.signMatcher;
    if (matcher && !matcher.isLoaded) {
      await matcher.init();
    }

    // 3. Parse and match sequence:
    // - normalize, remove fillers ('is','am','are','the','a','an')
    // - reorder interrogatives to end
    // - match tokens to BVH or fallback to FINGERSPELL
    const parsedSequence = matcher ? matcher.parseAndMatchSequence(clean) : [];
    console.log('[EduApp] Parsed ISL sequence:', parsedSequence);

    // 4. Update gloss strip / HUD
    if (glossEl) {
      const glossTokens = parsedSequence.map(s => s.type === 'BVH' ? (s.gloss || s.word || s.id) : `FS:${s.word}`);
      glossEl.textContent = glossTokens.join(' ') || 'STANDBY';
    }

    // 5. Ensure 3D avatar viewport is visible (if in assistant/skill tabs; Personalized Learning uses its own lesson studio canvas)
    const isRTC = this.currentViewId === 'view-realtime-comm' || this.currentViewId === 'realtime-comm-view';
    const isPersonalized = this.currentViewId === 'view-personalized-learning' || this.currentViewId === 'personalized-learning' || this.currentViewId === 'curriculum';
    const isAssistant = this.currentViewId === 'view-academic-assistance' || this.currentViewId === 'academic-assistance' || this.currentViewId === 'assistant';
    const isHiddenView = isRTC || isPersonalized || isAssistant || this.currentViewId === 'view-landing' || this.currentViewId === 'view-isl-repository';
    const canvasContainer = document.getElementById('canvas-container');
    if (!isHiddenView && canvasContainer && canvasContainer.classList.contains('hidden-canvas')) {
      canvasContainer.classList.remove('hidden-canvas');
      this.resizePersistentCanvas?.();
    }

    // 6. Execute sequence via centralized signSyncController or local fallback
    if (window.signSyncController && typeof window.signSyncController.executeParsedSequence === 'function') {
      await window.signSyncController.executeParsedSequence(parsedSequence);
    } else {
      await this.executeParsedSequenceLocally(parsedSequence);
    }

    if (statusEl) statusEl.textContent = `ISL Execution Complete: "${clean}"`;
    return parsedSequence;
  }

  async executeParsedSequenceLocally(parsedSequence) {
    if (!Array.isArray(parsedSequence) || parsedSequence.length === 0) return;

    this.sl.requestId = (this.sl.requestId || 0) + 1;
    const reqId = this.sl.requestId;
    this.stopCurrentSign();

    const retargeter = this.sl.retargeter;
    const fingerspeller = this.sl.fingerspeller;
    const waitDelay = (ms) => new Promise(r => setTimeout(r, ms));

    for (const sign of parsedSequence) {
      if (reqId !== this.sl.requestId) return;

      if (sign.type === 'BVH') {
        const item = { id: sign.id, bvh: sign.path, sentence: sign.phrase || sign.word || `Sign #${sign.id}`, gloss: sign.gloss };
        await this.playBvhSign(item, reqId);
      } else if (sign.type === 'FINGERSPELL') {
        const overlay = document.getElementById('edu-sl-letter-overlay');
        const overlayLetter = document.getElementById('edu-sl-overlay-letter');
        const overlayWord = document.getElementById('edu-sl-overlay-word');

        if (retargeter) retargeter.enabled = false;

        for (const char of sign.chars) {
          if (reqId !== this.sl.requestId) return;

          if (overlay && overlayLetter) {
            overlay.classList.remove('hidden');
            overlayLetter.textContent = char;
            if (overlayWord) overlayWord.textContent = sign.word;
          }

          if (fingerspeller && typeof fingerspeller.playLetterPose === 'function') {
            await fingerspeller.playLetterPose(char, { durationMs: 300, holdMs: 200 });
          } else if (fingerspeller && typeof fingerspeller.poseLetter === 'function') {
            fingerspeller.poseLetter(char);
            await waitDelay(300 + 200);
          }
        }

        if (overlay) overlay.classList.add('hidden');
        if (retargeter) retargeter.enabled = true;
      }

      if (reqId !== this.sl.requestId) return;
      await waitDelay(100);
    }

    if (reqId === this.sl.requestId) {
      this.slerpAvatarToRestPose(reqId, 250);
    }
  }

  previewSign(item) {
    if (!item) return;

    // If item is from the authentic 2,501 dataset or has BVH motion, use monotonic cancellation controller
    if (item.animationType === 'bvh' || item.isPredefinedDataset || (item.id && !isNaN(Number(item.id)))) {
      return this.playSignItem(item);
    }

    this.stopCurrentSign();
    this.sl.currentSign = item;

    // Hide sentence strip when viewing an individual sign
    const glossWrap = document.getElementById('edu-sl-gloss-strip-wrap');
    if (glossWrap) glossWrap.classList.add('hidden');

    // Highlight active card in grid
    document.querySelectorAll('.edu-sign-card-rich, .edu-sign-item').forEach(c =>
      c.classList.toggle('active', c.dataset.id === item.id));

    // Update Right Panel Info Card
    const wordEl = document.getElementById('edu-sl-info-word');
    const hintEl = document.getElementById('edu-sl-info-hint');
    const typeEl = document.getElementById('edu-sl-info-type');
    const masteryEl = document.getElementById('edu-sl-info-mastery');
    const levelEl = document.getElementById('edu-sl-info-level');
    const catEl = document.getElementById('edu-sl-info-cat');

    const stat = this.learnerProfile.getItemStats(item.id);
    const displayWord = item.sentence || item.word;
    const catMeta = REPOSITORY_CATEGORIES[item.category] || { label: item.category || 'General', icon: '💬' };
    const levelStr = (item.proficiencyLevel || (item.difficulty === 1 ? 'beginner' : item.difficulty === 2 ? 'intermediate' : 'advanced') || 'beginner').toUpperCase();

    if (wordEl) wordEl.textContent = displayWord;
    if (hintEl) hintEl.textContent = item.hint || `ISL Gloss: ${item.gloss}`;
    if (levelEl) {
      levelEl.textContent = levelStr;
      levelEl.className = `meta-tag meta-tag-level repo-level-tag level-${levelStr.toLowerCase()}`;
    }
    if (catEl) {
      catEl.textContent = `${catMeta.icon} ${catMeta.label}`;
    }
    if (typeEl) {
      typeEl.textContent = item.animationType === 'bvh'
        ? 'Authentic ISL Motion'
        : item.animationType === 'letter'
          ? 'Hand Shape Pose'
          : 'Fingerspelled Sequence';
    }
    if (masteryEl) {
      const stateObj = this.getMasteryState(stat.status, item.id);
      masteryEl.textContent = stateObj.label.toUpperCase();
      masteryEl.className = `edu-sl-status-pill mastery-${stateObj.classKey}`;
    }

    const currentReqId = this.sl.requestId;

    // Trigger 3D Avatar Rendering
    if (this.sl.loaded) {
      this.executeSignAnimation(item, currentReqId);
    } else {
      this.initSignLearnScene().then(() => {
        if (currentReqId === this.sl.requestId) {
          this.executeSignAnimation(item, currentReqId);
        }
      });
    }
  }

  executeSignAnimation(item, reqId = null) {
    if (!item) return;
    if (reqId !== null && reqId !== this.sl.requestId) return;

    // Internal accuracy audit log (Strict requirement for verification)
    const animDesc = item.animationType === 'bvh'
      ? item.signRef
      : item.animationType === 'letter'
        ? `poseLetter(${item.signRef})`
        : `fingerspellSequence(${item.signRef || item.word})`;

    console.log(
      `%c[Sign Accuracy Audit]%c\n` +
      `INPUT:        ${item.word}\n` +
      `NORMALIZED:   ${normalizeSignQuery(item.word)}\n` +
      `MATCHED SIGN: ${item.word}\n` +
      `SIGN ID:      ${item.id}\n` +
      `GLOSS:        ${item.gloss}\n` +
      `ANIMATION:    ${animDesc}`,
      'color: #38bdf8; font-weight: bold;',
      'color: inherit;'
    );

    if (item.animationType === 'bvh') {
      this.playBvhSign(item, reqId);
    } else {
      this.animateSignLearnPose(item, reqId);
    }
  }

  // Fingerspelling hand pose animation with synchronized letter overlay
  async animateSignLearnPose(item, existingReqId = null) {
    const reqId = existingReqId !== null ? existingReqId : ((this.sl.requestId = (this.sl.requestId || 0) + 1));
    if (reqId !== this.sl.requestId) return;

    clearTimeout(this.sl.letterTimeout);

    // Stop active BVH if any and reset to humanoid rest pose
    if (this.sl.bvhMixer) {
      this.sl.bvhMixer.stopAllAction();
    }
    if (this.sl.bvhRoot && this.sl.bvhRoot.parent) {
      this.sl.scene.remove(this.sl.bvhRoot);
    }
    if (this.sl.retargeter) {
      this.sl.retargeter.bvhSkeleton = null;
      this.sl.retargeter.resetCharacterPose();
    }

    const { fingerspeller } = this.sl;
    if (!fingerspeller) return;

    const statusEl = document.getElementById('edu-sl-status');
    const overlay = document.getElementById('edu-sl-letter-overlay');
    const letterCharEl = document.getElementById('edu-sl-letter-char');
    const letterWordEl = document.getElementById('edu-sl-letter-word');
    const letterStepEl = document.getElementById('edu-sl-letter-step');

    const speed = this.sl.playbackSpeed || 1.0;
    const signText = item.signRef || item.word || 'A';

    if (item.animationType === 'letter' && signText.length === 1) {
      // Single letter/number — pose directly and display active character prominently
      const char = signText.toUpperCase();
      fingerspeller.poseLetter(char);

      const isAlphabet = item.category === 'alphabets';
      const isNumber = item.category === 'numbers';
      const typeStr = isNumber ? `Number "${char}"` : isAlphabet ? `Alphabet "${char}"` : `Sign "${char}"`;

      if (statusEl) {
        statusEl.textContent = `Demonstrating ${typeStr} (Observe hand shape — ${speed}x)`;
      }

      if (overlay) {
        overlay.classList.remove('hidden');
        if (letterCharEl) letterCharEl.textContent = char;
        if (letterWordEl) letterWordEl.textContent = isNumber ? `Number ${char}` : isAlphabet ? `Alphabet ${char}` : `Sign ${char}`;
        if (letterStepEl) letterStepEl.textContent = isNumber ? 'ISL Number Hand Shape' : 'ISL Alphabet Hand Shape';
      }

      // Keep handshape held and stable long enough for the learner to recognize and practice
      const holdDuration = Math.round(Math.max(500, 2200 / speed));
      await new Promise(r => {
        this.sl.letterTimeout = setTimeout(r, holdDuration);
      });

      if (reqId !== this.sl.requestId) return;

      if (statusEl) {
        statusEl.textContent = `${typeStr} Demonstrated (Replay anytime)`;
      }
    } else {
      // Sequence — spell letter by letter with strict pose-completion synchronization
      const letters = signText.replace(/\s+/g, '').split('');

      for (let i = 0; i < letters.length; i++) {
        if (reqId !== this.sl.requestId) return;

        const char = letters[i].toUpperCase();

        // 1. Pose hand and update UI simultaneously (Single Source of Truth)
        fingerspeller.poseLetter(char);

        if (overlay) {
          overlay.classList.remove('hidden');
          if (letterCharEl) letterCharEl.textContent = char;
          if (letterWordEl) letterWordEl.textContent = signText.toUpperCase();
          if (letterStepEl) letterStepEl.textContent = `Letter ${i + 1} of ${letters.length}`;
        }

        if (statusEl) {
          statusEl.textContent = `Spelling "${signText}": Showing letter ${char} (${i + 1}/${letters.length}) [${speed}x]`;
        }

        // 2. Pose completion duration strictly scaled by speed
        const holdDuration = Math.round(Math.max(100, 650 / speed));
        await new Promise(r => {
          this.sl.letterTimeout = setTimeout(r, holdDuration);
        });

        if (reqId !== this.sl.requestId) return;

        // 3. Clear transition pause before displaying next letter
        if (i < letters.length - 1) {
          const pauseDuration = Math.round(Math.max(40, 140 / speed));
          await new Promise(r => {
            this.sl.letterTimeout = setTimeout(r, pauseDuration);
          });
          if (reqId !== this.sl.requestId) return;
        }
      }

      if (reqId !== this.sl.requestId) return;

      if (statusEl) {
        statusEl.textContent = `Demonstrated: "${signText}" (Replay anytime)`;
      }

      // Keep final letter visible briefly then gracefully hide
      await new Promise(r => {
        this.sl.letterTimeout = setTimeout(() => {
          if (reqId === this.sl.requestId && overlay) {
            overlay.classList.add('hidden');
          }
          r();
        }, Math.round(Math.max(200, 900 / speed)));
      });
    }
  }

  // Authentic BVH motion playback
  async playBvhSign(item, existingReqId = null) {
    const reqId = existingReqId !== null ? existingReqId : ((this.sl.requestId = (this.sl.requestId || 0) + 1));
    if (reqId !== this.sl.requestId) return;

    clearTimeout(this.sl.letterTimeout);

    // Stop active mixer & clean previous bvh root immediately so old animation never lingers during async load
    if (this.sl.bvhMixer) {
      this.sl.bvhMixer.stopAllAction();
    }
    if (this.sl.bvhRoot && this.sl.bvhRoot.parent) {
      this.sl.scene.remove(this.sl.bvhRoot);
    }
    if (this.sl.retargeter) {
      this.sl.retargeter.bvhSkeleton = null;
      this.sl.retargeter.resetCharacterPose();
    }

    const statusEl = document.getElementById('edu-sl-status');
    const speed = this.sl.playbackSpeed || 1.0;

    if (statusEl) statusEl.textContent = `Loading ISL motion for "${item.word}"...`;

    try {
      let bvhData = this.sl.bvhCache.get(item.signRef);
      if (!bvhData) {
        try {
          bvhData = await this.sl.bvhLoader.loadAsync(`/${item.signRef}`);
        } catch {
          bvhData = await this.sl.bvhLoader.loadAsync(`/archive-data/${item.signRef}`);
        }
        this.sl.bvhCache.set(item.signRef, bvhData);
      }

      if (reqId !== this.sl.requestId) return;

      // Clean previous bvh root if exists
      if (this.sl.bvhRoot && this.sl.bvhRoot.parent) {
        this.sl.scene.remove(this.sl.bvhRoot);
      }
      if (this.sl.bvhMixer) {
        this.sl.bvhMixer.stopAllAction();
      }

      const bvhSkeleton = bvhData.skeleton;
      this.sl.bvhRoot = bvhSkeleton.bones[0];
      this.sl.bvhRoot.visible = false;
      this.sl.scene.add(this.sl.bvhRoot);

      if (this.sl.retargeter) {
        this.sl.retargeter.setBvhSkeleton(bvhSkeleton);
      }

      this.sl.bvhMixer = new THREE.AnimationMixer(this.sl.bvhRoot);
      const action = this.sl.bvhMixer.clipAction(bvhData.clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.timeScale = speed;
      action.play();

      if (statusEl) statusEl.textContent = `Playing ISL motion: "${item.word}" (${speed}x)`;

      if (this.sl.activeBvhFinishHandler && this.sl.bvhMixer) {
        this.sl.bvhMixer.removeEventListener('finished', this.sl.activeBvhFinishHandler);
      }
      const onFinish = () => {
        if (reqId === this.sl.requestId && statusEl) {
          statusEl.textContent = `Demonstrated: "${item.word}" (Replay anytime)`;
        }
        this.sl.bvhMixer?.removeEventListener('finished', onFinish);
        if (this.sl.activeBvhFinishHandler === onFinish) {
          this.sl.activeBvhFinishHandler = null;
        }
      };
      this.sl.activeBvhFinishHandler = onFinish;
      this.sl.bvhMixer.addEventListener('finished', onFinish);

    } catch (err) {
      console.warn('[EduApp] BVH load failed, falling back to fingerspelling:', err);
      if (reqId === this.sl.requestId) {
        const fallbackItem = {
          animationType: 'spell',
          word: item.fallbackSpell || item.word,
          signRef: item.fallbackSpell || item.word
        };
        this.animateSignLearnPose(fallbackItem, reqId);
      }
    }
  }

  // -------------------------------------------------------
  // SIGN LEARN 3D SCENE (Dedicated WebGL context)
  // -------------------------------------------------------
  async initSignLearnScene() {
    if (this.sl.loaded || this.sl.loading) return;
    this.sl.loading = true;

    const container = document.getElementById('edu-signlearn-canvas');
    if (!container) return;

    const statusEl = document.getElementById('edu-sl-status');
    if (statusEl) statusEl.textContent = 'Loading 3D avatar...';

    // Scene
    this.sl.scene = new THREE.Scene();
    this.sl.scene.background = new THREE.Color(0x0d1117);
    this.sl.scene.fog = new THREE.FogExp2(0x0d1117, 0.08);

    // Camera: Automatically position & zoom to focus on the active chest-level signing hand and upper body
    this.sl.camera = new THREE.PerspectiveCamera(45, (container.clientWidth / container.clientHeight) || 1, 0.1, 30);
    this.sl.camera.position.set(-0.08, 1.36, 1.38);

    // Renderer
    try {
      this.sl.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      this.sl.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    }
    this.sl.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.sl.renderer.shadowMap.enabled = true;
    this.sl.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.sl.renderer.toneMappingExposure = 1.2;

    const w = container.clientWidth || 320;
    const h = container.clientHeight || 400;
    this.sl.renderer.setSize(w, h);
    const dom = this.sl.renderer.domElement;
    if (!container.contains(dom)) {
      container.insertBefore(dom, container.firstChild);
    }

    // Orbit Controls: centered on chest/shoulder signing space and upper body
    this.sl.controls = new OrbitControls(this.sl.camera, this.sl.renderer.domElement);
    this.sl.controls.target.set(-0.08, 1.34, 0.20);
    this.sl.controls.enableDamping = true;
    this.sl.controls.dampingFactor = 0.08;
    this.sl.controls.minDistance = 0.35;
    this.sl.controls.maxDistance = 2.6;
    this.sl.controls.maxPolarAngle = Math.PI / 2 + 0.1;

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.1);
    this.sl.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.8);
    dir.position.set(2.5, 4, 3);
    dir.castShadow = true;
    this.sl.scene.add(dir);

    // Dedicated key light illuminating active signing hand from front-right for finger separation
    const handKeyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    handKeyLight.position.set(-1.5, 2.0, 2.5);
    handKeyLight.target.position.set(-0.15, 1.35, 0.40);
    this.sl.scene.add(handKeyLight);
    this.sl.scene.add(handKeyLight.target);

    const rim = new THREE.DirectionalLight(0x6366f1, 1.3);
    rim.position.set(-3, 3, -3);
    this.sl.scene.add(rim);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3, 64),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.sl.scene.add(floor);
    this.sl.scene.add(new THREE.GridHelper(6, 24, 0x6366f1, 0x1e293b));

    // Load Character
    try {
      const loader = new GLTFLoader();
      let gltf;
      try {
        gltf = await loader.loadAsync('/character_clean.glb');
      } catch {
        gltf = await loader.loadAsync('/archive-data/character_clean.glb');
      }
      this.sl.character = gltf.scene;
      this.sl.character.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.roughness = 0.45;
            child.material.metalness = 0.15;
          }
        }
      });
      this.sl.scene.add(this.sl.character);

      // Initialize Fingerspeller and BVH Retargeter
      this.sl.fingerspeller = new Fingerspeller(this.sl.character);
      this.sl.retargeter = new Retargeter(this.sl.character, BONE_MAP);

      this.sl.retargeter.onPlayBVH = async (bvhData, token) => {
        return this.playBvhSign({ bvhData, bvh: bvhData.clip }, token);
      };

      if (typeof window !== 'undefined' && window.signSyncController && !window.signSyncController.playBvhFn) {
        window.signSyncController.registerEngine({
          bvhMixer: this.sl.bvhMixer,
          retargeter: this.sl.retargeter,
          fingerspeller: this.sl.fingerspeller,
          signMatcher: this.sl.signMatcher,
          playBvhFn: (sample, reqId) => this.playBvhSign(sample, reqId),
          resetAvatarFn: () => this.stopCurrentSign()
        });
      }

      // Expose debugPlaySingleBVH tied to this active avatar scene
      window.debugPlaySingleBVH = (bvhPath) => {
        return debugPlaySingleBVH(bvhPath, {
          characterModel: this.sl.character,
          retargeter: this.sl.retargeter,
          scene: this.sl.scene,
          mixer: this.sl.bvhMixer
        });
      };

      // Initialize Sentence Timeline Controller
      this.sl.sentenceTimeline = new SentenceTimeline({
        characterModel: this.sl.character,
        fingerspeller: this.sl.fingerspeller,
        retargeter: this.sl.retargeter,
        bvhLoader: this.sl.bvhLoader,
        scene: this.sl.scene
      });

      this.sl.sentenceTimeline.on('signStart', (data) => this.onTimelineSignStart(data));
      this.sl.sentenceTimeline.on('letterStep', (data) => this.onTimelineLetterStep(data));
      this.sl.sentenceTimeline.on('signEnd', (data) => this.onTimelineSignEnd(data));
      this.sl.sentenceTimeline.on('sentenceComplete', (data) => this.onTimelineSentenceComplete(data));
      this.sl.sentenceTimeline.on('stateChange', (data) => this.onTimelineStateChange(data));

      this.sl.loaded = true;

      if (statusEl) statusEl.textContent = '3D Avatar ready. Select or practice a sign.';

      // Default sign preview
      const itemToPlay = this.currentLessonItem || this.sl.currentSign;
      if (itemToPlay) {
        this.executeSignAnimation(itemToPlay);
      } else {
        this.sl.fingerspeller.poseLetter('A');
      }
    } catch (err) {
      console.error('[EduApp] Sign learn avatar load error:', err);
      if (statusEl) statusEl.textContent = 'Avatar unavailable. Ensure character_clean.glb is present.';
    }

    // Start render loop
    this.startSignLearnLoop();

    // Handle resize
    const resizeObs = new ResizeObserver(() => this.resizeSignLearn());
    resizeObs.observe(container);

    this.resizeSignLearn();
    requestAnimationFrame(() => this.resizeSignLearn());
    setTimeout(() => this.resizeSignLearn(), 100);

    this.sl.loading = false;
  }

  startSignLearnLoop() {
    if (this.sl.animFrame) return; // Prevent duplicate loops
    let lastTime = performance.now();

    const loop = (now) => {
      const isSignLearnActive = this.currentTab === 'signlearn' ||
        document.getElementById('edu-stage-signlearn')?.classList.contains('active') ||
        document.body.classList.contains('learning-loop-active');

      if (!isSignLearnActive || document.hidden) {
        this.sl.animFrame = null;
        return;
      }
      this.sl.animFrame = requestAnimationFrame(loop);
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      try {
        this.sl.controls?.update();

        if (this.sl.bvhMixer) {
          this.sl.bvhMixer.update(delta * (this.sl.playbackSpeed || 1.0));
        }
        if (this.sl.sentenceTimeline) {
          this.sl.sentenceTimeline.update(delta);
        }
        if (this.sl.retargeter && this.sl.retargeter.enabled && this.sl.retargeter.bvhSkeleton) {
          this.sl.retargeter.update();
        }

        if (this.sl.renderer && this.sl.scene && this.sl.camera) {
          this.sl.renderer.render(this.sl.scene, this.sl.camera);
        }
      } catch (err) {
        console.warn('[EduApp] Sign learn frame warning:', err);
        if (this.sl.renderer && this.sl.scene && this.sl.camera) {
          try {
            this.sl.renderer.render(this.sl.scene, this.sl.camera);
          } catch {}
        }
      }
    };
    this.sl.animFrame = requestAnimationFrame(loop);
  }

  resizeSignLearn() {
    this.resizePersistentCanvas();
  }
}

// -------------------------------------------------------
// BOOTSTRAP & ACCURACY AUDIT
// -------------------------------------------------------
window.runSignAccuracyAudit = runSignAccuracyAudit;

const initEdu = () => {
  if (!window._eduApp) {
    window._eduApp = new EduApp();
    window.eduApp = window._eduApp;
    window.processInputToISL = (rawText) => window._eduApp?.processInputToISL(rawText);
    if (typeof window !== 'undefined' && window.location.search.includes('pip=native')) {
      window._eduApp.switchView('view-realtime-comm');
    }
    try {
      const auditRes = runSignAccuracyAudit();
      console.log(`%c[Sign Accuracy Audit] Initial Validation: ${auditRes.passed}/${auditRes.total} signs passed (${auditRes.accuracyPct}% accuracy)`, 'color: #10b981; font-weight: bold;');
    } catch (e) {
      console.warn('[Sign Accuracy Audit] Initial audit notice:', e);
    }
  }
};
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initEdu();
} else {
  window.addEventListener('DOMContentLoaded', initEdu);
  window.addEventListener('load', initEdu);
}
