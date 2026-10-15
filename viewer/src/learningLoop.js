/**
 * LearningLoopController - Pedagogical Learning Loop Engine
 * Implements 3-Phase Stepper: Learn & Observe -> Practice -> Assess -> Recommendation
 * Single source of truth: 2,501 authentic ISL dataset records & authentic reference assets.
 */

import { islKnowledgeRepository, REPOSITORY_CATEGORIES } from './islRepository.js';
import { learnerStore } from './learnerStore.js';

export class LearningLoopController {
  constructor(options = {}) {
    this.container = options.container || null;
    this.content = null;
    this.stepper = null;
    this.currentItem = null;
    this.currentPhase = 1; // 1: Learn, 2: Practice, 3: Assess
    this.currentSpeed = 0.75;
    this.isLooping = false;
    this.loopInterval = null;
    this.assessmentAnswered = false;
    this.assessmentOptions = [];
    this.activeStepIndex = 1;
    this.currentPracticeReps = 0;

    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;

    this.container = document.getElementById('learning-loop-container');
    this.content = document.getElementById('learning-loop-content');
    this.stepper = document.getElementById('loop-stepper');

    // Close button & overlay background dismissal
    document.getElementById('btn-close-learning-loop')?.addEventListener('click', () => this.close());
    this.container?.addEventListener('click', (e) => {
      if (e.target === this.container) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    // Expose globally for UI triggers
    if (typeof window !== 'undefined') {
      window.learningLoop = this;
      window.openLearningLoop = (itemOrId) => this.open(itemOrId);
    }
  }

  isOpen() {
    return this.container && !this.container.classList.contains('hidden');
  }

  /**
   * Open the Pedagogical Learning Loop for a target sign item or sign ID
   * @param {Object|string|number} itemOrId
   */
  async open(itemOrId) {
    if (!itemOrId) return;

    // Resolve sign item
    let item = itemOrId;
    if (typeof itemOrId === 'string' || typeof itemOrId === 'number') {
      const idStr = String(itemOrId);
      if (!islKnowledgeRepository.isLoaded) {
        await islKnowledgeRepository.init();
      }
      item = islKnowledgeRepository.getItemById(idStr) ||
        islKnowledgeRepository.items.find(i => String(i.id) === idStr) || null;
    }

    if (!item) {
      console.warn('[LearningLoop] Unable to resolve sign item:', itemOrId);
      return;
    }

    this.currentItem = item;
    this.currentSpeed = 0.75;
    this.isLooping = false;
    this.currentPracticeReps = 0;
    this.clearLoopInterval();

    // Ensure DOM references are bound
    if (!this.container || !this.content) {
      this.init();
    }

    // Dock overlay alongside persistent 3D canvas on desktop
    if (typeof document !== 'undefined') {
      document.body.classList.add('learning-loop-active');
    }

    // Show container
    if (this.container) {
      this.container.classList.remove('hidden');
      this.container.setAttribute('aria-hidden', 'false');
    }

    // Ensure persistent 3D Three.js avatar canvas is visible as companion viewport
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      canvasContainer.classList.remove('hidden-canvas');
      window.eduApp?.resizePersistentCanvas?.();
    }

    // Begin at Phase 1: Learn & Observe
    this.setPhase(1);
  }

  /**
   * Close the learning loop
   */
  close() {
    this.clearLoopInterval();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('learning-loop-active');
    }
    if (this.container) {
      this.container.classList.add('hidden');
      this.container.setAttribute('aria-hidden', 'true');
    }
    if (window.eduApp) {
      window.eduApp.sl.isMasked = false;
      window.eduApp.stopCurrentSign?.();
      window.eduApp.resizePersistentCanvas?.();
    }
  }

  clearLoopInterval() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }

  /**
   * Transition to a specific phase (1, 2, or 3)
   * @param {number} phaseNumber
   */
  setPhase(phaseNumber) {
    this.currentPhase = Math.max(1, Math.min(3, phaseNumber));
    this.clearLoopInterval();

    // Update Stepper Navigation
    this.updateStepperUI();

    // Render corresponding phase template
    if (this.currentPhase === 1) {
      this.renderPhase1();
    } else if (this.currentPhase === 2) {
      this.renderPhase2();
    } else if (this.currentPhase === 3) {
      this.renderPhase3();
    }
  }

  updateStepperUI() {
    const steps = document.querySelectorAll('#loop-stepper .loop-step');
    steps.forEach(stepEl => {
      const stepNum = parseInt(stepEl.dataset.step, 10);
      stepEl.classList.remove('active', 'completed');
      if (stepNum === this.currentPhase) {
        stepEl.classList.add('active');
      } else if (stepNum < this.currentPhase) {
        stepEl.classList.add('completed');
      }
    });

    const titleEl = document.getElementById('loop-dialog-title');
    if (titleEl) {
      const phrase = this.currentItem?.phrase || this.currentItem?.sentence || this.currentItem?.word || 'Sign';
      if (this.currentPhase === 1) {
        titleEl.textContent = `Phase 1: Learn & Observe — "${phrase}"`;
      } else if (this.currentPhase === 2) {
        titleEl.textContent = `Phase 2: Practice & Mechanics — "${phrase}"`;
      } else if (this.currentPhase === 3) {
        titleEl.textContent = `Phase 3: Comprehension Assessment`;
      }
    }
  }

  /**
   * Helper: check if item is alphabet or number and resolve reference image path
   */
  getReferenceAsset(item) {
    if (!item) return null;
    const phrase = (item.phrase || item.sentence || item.word || '').trim();
    const cat = (item.category || '').toLowerCase();

    // 1. Alphabet check
    if (cat === 'alphabets' || (phrase.length === 1 && /^[A-Za-z]$/.test(phrase))) {
      const letter = phrase.length === 1 ? phrase.toUpperCase() : (item.id.replace(/\D/g, '') ? String.fromCharCode(65 + (parseInt(item.id, 10) % 26)) : 'A');
      const ext = letter === 'Z' ? 'jpeg' : 'png';
      return {
        type: 'alphabet',
        label: `ISL Handshape: Alphabet "${letter}"`,
        primaryUrl: `/alphabets/${letter}.${ext}`,
        fallbackUrl: `/beginner sign lang/ALPHABETS/${letter}.${ext}`
      };
    }

    // 2. Number check
    if (cat === 'numbers' || (phrase.length === 1 && /^[0-9]$/.test(phrase))) {
      const num = phrase.length === 1 ? phrase : (item.id.replace(/\D/g, '') ? String(parseInt(item.id, 10) % 10) : '1');
      return {
        type: 'number',
        label: `ISL Handshape: Number "${num}"`,
        primaryUrl: `/numbers/${num}.jpeg`,
        fallbackUrl: `/beginner sign lang/NUMBERS/${num}.jpeg`
      };
    }

    return null;
  }

  /**
   * Triggers playback on 3D avatar via eduApp
   */
  playSign(speed = 0.75, masked = false) {
    if (!window.eduApp || !this.currentItem) return;
    window.eduApp.sl.playbackSpeed = speed;
    window.eduApp.sl.isMasked = masked;
    window.eduApp.playSignItem(this.currentItem);
  }

  // ============================================================
  // PHASE 1: LEARN & OBSERVE
  // ============================================================
  renderPhase1() {
    if (!this.content || !this.currentItem) return;
    const item = this.currentItem;
    const phrase = item.phrase || item.sentence || item.word || '';
    const level = (item.level || item.proficiencyLevel || 'Beginner').toUpperCase();
    const catMeta = REPOSITORY_CATEGORIES[item.category] || { label: item.category || 'General', icon: '💬' };
    const refAsset = this.getReferenceAsset(item);

    // Avatar automatically signs the BVH motion at 0.75x speed
    this.currentSpeed = 0.75;
    this.playSign(0.75, false);

    let refHtml = '';
    if (refAsset) {
      refHtml = `
        <div class="loop-ref-card">
          <div class="ref-media-box">
            <img src="${refAsset.primaryUrl}"
                 alt="${refAsset.label}"
                 class="ref-img"
                 onerror="if (!this.dataset.triedFallback) { this.dataset.triedFallback='1'; this.src='${refAsset.fallbackUrl}'; } else { this.parentElement.style.display='none'; }" />
          </div>
          <div class="ref-meta">
            <span class="ref-badge">Authentic 2D Reference</span>
            <h5 class="ref-title">${refAsset.label}</h5>
            <p class="ref-desc">Observe the authentic finger articulation and wrist angle alongside the 3D avatar signing on the right.</p>
          </div>
        </div>
      `;
    }

    const masteryStat = window.learnerStore?.data?.itemMastery?.[String(item.id)];
    const isReview = masteryStat && (masteryStat.status === 'learned' || masteryStat.status === 'needs_review');
    const srBadgeHtml = isReview 
      ? `<span class="sign-tier-tag" style="background-color: #8b5cf6; color: white;">Spaced Repetition Review</span>` 
      : `<span class="sign-tier-tag" style="background-color: #3b82f6; color: white;">New Concept</span>`;

    const instructionHtml = item.instruction ? `
      <div class="loop-instruction-card" style="margin-top: 1.2rem; padding: 1rem; background-color: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 6px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #3b82f6; display: flex; align-items: center; gap: 0.5rem;"><span style="font-size: 1.2rem;">🧠</span> Kinematic Instruction</h4>
        <p style="margin: 0; line-height: 1.5; font-size: 0.95rem;">${item.instruction}</p>
        ${item.hint ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; opacity: 0.9; border-top: 1px solid rgba(59, 130, 246, 0.2); padding-top: 0.5rem;"><strong>Context:</strong> ${item.hint}</p>` : ''}
      </div>
    ` : '';

    this.content.innerHTML = `
      <div class="phase-container phase-1-view">
        <div class="loop-overview-card">
          <div class="loop-meta-header">
            <span class="sign-id-tag">Sign #${item.id}</span>
            <span class="sign-tier-tag tier-${level.toLowerCase()}">${level}</span>
            <span class="sign-cat-tag">${catMeta.icon} ${catMeta.label}</span>
            ${srBadgeHtml}
          </div>
          <h2 class="loop-sign-title">${phrase}</h2>
          <p class="loop-sign-hint"><strong>ISL Gloss:</strong> ${item.gloss || phrase} · Demonstrating authentic Biovision motion kinematics.</p>
          ${instructionHtml}
        </div>

        ${refHtml}

        <div class="loop-control-card">
          <div class="control-row-header">
            <span class="control-title">Observation Playback Speed</span>
            <span class="control-note">Default: 0.75x slow motion for visual analysis</span>
          </div>
          <div class="speed-btn-group" id="phase1-speed-group">
            <button class="btn-speed ${this.currentSpeed === 0.5 ? 'active' : ''}" data-speed="0.5">0.5x</button>
            <button class="btn-speed ${this.currentSpeed === 0.75 ? 'active' : ''}" data-speed="0.75">0.75x</button>
            <button class="btn-speed ${this.currentSpeed === 1.0 ? 'active' : ''}" data-speed="1.0">1.0x</button>
            <button class="btn-speed ${this.currentSpeed === 1.25 ? 'active' : ''}" data-speed="1.25">1.25x</button>
            <button class="btn-replay-loop" id="phase1-replay-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Replay Sign
            </button>
          </div>
        </div>

        <div class="loop-action-footer">
          <div class="footer-info">
            <span>Next: Phase 2 will guide you through motion checkpoints and posture tips.</span>
          </div>
          <button id="loop-btn-ready-practice" class="btn-loop-primary">
            Ready to Practice →
          </button>
        </div>
      </div>
    `;

    // Speed button handlers
    this.content.querySelectorAll('#phase1-speed-group .btn-speed').forEach(btn => {
      btn.addEventListener('click', () => {
        this.content.querySelectorAll('#phase1-speed-group .btn-speed').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentSpeed = parseFloat(btn.dataset.speed);
        this.playSign(this.currentSpeed, false);
      });
    });

    document.getElementById('phase1-replay-btn')?.addEventListener('click', () => {
      this.playSign(this.currentSpeed, false);
    });

    // Primary CTA -> Advance to Phase 2
    document.getElementById('loop-btn-ready-practice')?.addEventListener('click', () => {
      this.setPhase(2);
    });
  }

  /**
   * Record practice repetition to learnerStore, contributing directly to learner telemetry
   * @param {number} reps
   * @param {boolean} fromUserAction
   */
  recordPracticeAttempt(reps = 1, fromUserAction = false) {
    if (!this.currentItem) return;
    this.currentPracticeReps += reps;
    const res = learnerStore.recordPracticeRep(this.currentItem.id, reps);

    const counterBadge = document.getElementById('practice-reps-counter');
    if (counterBadge) {
      counterBadge.textContent = `Reps: ${this.currentPracticeReps} Logged`;
      counterBadge.classList.add('badge-pulse');
      setTimeout(() => counterBadge.classList.remove('badge-pulse'), 600);
    }

    const toastHint = document.getElementById('practice-toast-hint');
    if (toastHint) {
      toastHint.innerHTML = `<span style="color:#34d399;font-weight:600;">✓ Practice rep recorded in your learning journey! Sign total: ${res.itemPracticeReps}</span>`;
    }
  }

  // ============================================================
  // PHASE 2: PRACTICE
  // ============================================================
  renderPhase2() {
    if (!this.content || !this.currentItem) return;
    const item = this.currentItem;
    const phrase = item.phrase || item.sentence || item.word || '';

    // Play at regular 1.0x or previous selected speed
    this.playSign(this.currentSpeed, false);

    this.content.innerHTML = `
      <div class="phase-container phase-2-view">
        <div class="practice-intro-banner">
          <div class="intro-badge">Phase 2: Practice Mode</div>
          <h3 class="practice-heading">Kinematic Checkpoints &amp; Signing Tips</h3>
          <p class="practice-desc">Perform the sign along with the 3D avatar. Practice freely in loop mode without timing pressure.</p>
        </div>

        <!-- Practice Repetition & Learner Journey Tracker -->
        <div class="practice-telemetry-card">
          <div class="telemetry-header">
            <div class="telemetry-title-wrap">
              <span class="telemetry-icon">🎯</span>
              <div>
                <strong class="telemetry-title">Neuromuscular Practice Tracker</strong>
                <span class="telemetry-sub">Each rehearsal contributes directly to your learner profile &amp; retention stats</span>
              </div>
            </div>
            <div class="telemetry-badge" id="practice-reps-counter">Reps: ${this.currentPracticeReps} Logged</div>
          </div>
          <div class="telemetry-action-row">
            <button id="btn-record-practice-rep" class="btn-rep-record" title="Record completed physical repetition">
              <span class="btn-rep-icon">✓</span>
              <span>I Practiced This Sign (+1 Rep)</span>
            </button>
            <span class="telemetry-hint" id="practice-toast-hint">Rehearsing with the avatar builds neuromuscular memory and tracks progress.</span>
          </div>
        </div>

        <!-- Step-by-Step Contextual Practice Checkpoint -->
        <div class="checkpoint-stepper-card" style="background-color: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2);">
          <div class="card-heading" style="color: #10b981;">Target Mechanics & Execution</div>
          <div class="checkpoint-list" style="margin-top: 0.5rem;">
            <div class="checkpoint-item active" data-step="1" style="background-color: white; cursor: default;">
              <span class="cp-num" style="background-color: #10b981;">Focus</span>
              <div class="cp-info">
                <strong>${phrase}</strong>
                <p style="font-size: 1rem; color: #1f2937; margin-top: 0.25rem;">${item.instruction || 'Follow the avatar\'s precise handshapes and spatial trajectory.'}</p>
                ${item.hint ? `<p style="margin-top: 0.5rem; font-size: 0.85rem; color: #4b5563;"><em>Tip: ${item.hint}</em></p>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Signing Execution Tips -->
        <div class="practice-tips-grid">
          <div class="tip-box">
            <span class="tip-icon">👁️</span>
            <div>
              <strong>Hand Visibility</strong>
              <p>Keep signing space between chest and lower chin. Avoid blocking face gestures.</p>
            </div>
          </div>
          <div class="tip-box">
            <span class="tip-icon">📐</span>
            <div>
              <strong>Wrist Orientation</strong>
              <p>Maintain upright wrist angles without excessive backward hyperextension.</p>
            </div>
          </div>
          <div class="tip-box">
            <span class="tip-icon">⏱️</span>
            <div>
              <strong>Tempo Control</strong>
              <p>Sign with fluid pacing; emphasize the final gesture shape cleanly.</p>
            </div>
          </div>
        </div>

        <!-- Free Looping Controls -->
        <div class="practice-loop-controls">
          <button id="btn-toggle-loop" class="btn-practice-ctrl ${this.isLooping ? 'looping-active' : ''}">
            <span class="loop-icon">🔁</span>
            <span id="loop-btn-label">${this.isLooping ? 'Looping: ON' : 'Loop Sign: OFF'}</span>
          </button>
          <button id="btn-replay-practice" class="btn-practice-ctrl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Replay Motion
          </button>
          <div class="practice-speed-pills" id="phase2-speed-group">
            <button class="pill-speed ${this.currentSpeed === 0.75 ? 'active' : ''}" data-speed="0.75">0.75x</button>
            <button class="pill-speed ${this.currentSpeed === 1.0 ? 'active' : ''}" data-speed="1.0">1.0x</button>
          </div>
        </div>

        <div class="loop-action-footer">
          <button id="loop-btn-back-phase1" class="btn-loop-secondary">
            ← Back to Observe
          </button>
          <button id="loop-btn-take-assessment" class="btn-loop-primary">
            Take Assessment →
          </button>
        </div>
      </div>
    `;

    // Telemetry explicit practice button listener
    document.getElementById('btn-record-practice-rep')?.addEventListener('click', () => {
      this.recordPracticeAttempt(1, true);
    });

    // Looping toggle listener
    const loopBtn = document.getElementById('btn-toggle-loop');
    const loopLabel = document.getElementById('loop-btn-label');
    loopBtn?.addEventListener('click', () => {
      this.isLooping = !this.isLooping;
      if (this.isLooping) {
        loopBtn.classList.add('looping-active');
        if (loopLabel) loopLabel.textContent = 'Looping: ON';
        this.clearLoopInterval();
        this.playSign(this.currentSpeed, false);
        this.recordPracticeAttempt(1, false);
        this.loopInterval = setInterval(() => {
          if (this.isLooping && this.isOpen()) {
            this.playSign(this.currentSpeed, false);
            this.recordPracticeAttempt(1, false);
          } else {
            this.clearLoopInterval();
          }
        }, 3200);
      } else {
        loopBtn.classList.remove('looping-active');
        if (loopLabel) loopLabel.textContent = 'Loop Sign: OFF';
        this.clearLoopInterval();
      }
    });

    document.getElementById('btn-replay-practice')?.addEventListener('click', () => {
      this.playSign(this.currentSpeed, false);
      this.recordPracticeAttempt(1, true);
    });

    // Speed controls
    this.content.querySelectorAll('#phase2-speed-group .pill-speed').forEach(b => {
      b.addEventListener('click', () => {
        this.content.querySelectorAll('#phase2-speed-group .pill-speed').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.currentSpeed = parseFloat(b.dataset.speed);
        this.playSign(this.currentSpeed, false);
      });
    });

    // Checkpoint clicks
    this.content.querySelectorAll('.checkpoint-item').forEach(cp => {
      cp.addEventListener('click', () => {
        this.content.querySelectorAll('.checkpoint-item').forEach(x => x.classList.remove('active'));
        cp.classList.add('active');
        this.playSign(this.currentSpeed, false);
      });
    });

    // Navigation
    document.getElementById('loop-btn-back-phase1')?.addEventListener('click', () => {
      this.setPhase(1);
    });

    document.getElementById('loop-btn-take-assessment')?.addEventListener('click', () => {
      this.setPhase(3);
    });
  }

  // ============================================================
  // PHASE 3: ASSESS
  // ============================================================
  renderPhase3() {
    if (!this.content || !this.currentItem) return;
    this.clearLoopInterval();
    const item = this.currentItem;
    const correctPhrase = (item.phrase || item.sentence || item.word || '').trim();

    this.assessmentAnswered = false;

    // Generate 4 multiple-choice options (1 correct, 3 distractors from same category or level)
    this.assessmentOptions = this.generateDistractors(item);

    // Avatar plays authentic sign clip WITHOUT showing title
    this.playSign(1.0, true);

    const optionsHtml = this.assessmentOptions.map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      return `
        <button class="assessment-opt-btn" data-phrase="${opt}">
          <span class="opt-prefix">${letter}</span>
          <span class="opt-text">${opt}</span>
        </button>
      `;
    }).join('');

    this.content.innerHTML = `
      <div class="phase-container phase-3-view">
        <div class="assessment-challenge-card">
          <div class="challenge-badge">Phase 3: Comprehension Assessment • Visual Identification</div>
          <h3 class="challenge-title">Identify the Demonstrated ISL Sign</h3>
          <p class="challenge-sub">Watch the 3D avatar sign carefully. Cognitive recognition testing directly evaluates receptive language competence.</p>
          
          <div class="masked-avatar-banner">
            <span class="mystery-tag">🎭 Mystery Sign (#${item.id})</span>
            <button id="btn-replay-assessment" class="btn-replay-mystery">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Replay Mystery Sign
            </button>
          </div>
        </div>

        <div class="assessment-options-grid" id="assessment-options-grid">
          ${optionsHtml}
        </div>

        <!-- Feedback & Next CTA Container -->
        <div id="assessment-feedback-area" class="assessment-feedback-area hidden">
          <!-- Populated upon answer selection -->
        </div>
      </div>
    `;

    document.getElementById('btn-replay-assessment')?.addEventListener('click', () => {
      this.playSign(1.0, true);
    });

    // Attach option click handlers
    this.content.querySelectorAll('.assessment-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.assessmentAnswered) return;
        const selected = btn.dataset.phrase;
        this.handleAssessmentSelection(selected, btn, correctPhrase);
      });
    });
  }

  /**
   * Generates 3 distractors from same category/level plus correct phrase, shuffled
   */
  generateDistractors(targetItem) {
    const correctPhrase = (targetItem.phrase || targetItem.sentence || targetItem.word || '').trim();
    const allItems = islKnowledgeRepository.items || [];
    const pool = [];

    // Prioritize distractors from same category
    for (const it of allItems) {
      const text = (it.phrase || it.sentence || it.word || '').trim();
      if (text && text !== correctPhrase && !pool.includes(text)) {
        if (it.category === targetItem.category) {
          pool.push(text);
        }
      }
    }

    // Fallback: same level
    if (pool.length < 3) {
      for (const it of allItems) {
        const text = (it.phrase || it.sentence || it.word || '').trim();
        if (text && text !== correctPhrase && !pool.includes(text)) {
          if (it.level === targetItem.level || it.proficiencyLevel === targetItem.proficiencyLevel) {
            pool.push(text);
          }
        }
      }
    }

    // General fallback
    if (pool.length < 3) {
      for (const it of allItems) {
        const text = (it.phrase || it.sentence || it.word || '').trim();
        if (text && text !== correctPhrase && !pool.includes(text)) {
          pool.push(text);
          if (pool.length >= 6) break;
        }
      }
    }

    // Shuffle and pick 3
    this.shuffleArray(pool);
    const chosen = pool.slice(0, 3);
    chosen.push(correctPhrase);
    this.shuffleArray(chosen);
    return chosen;
  }

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Handle user choice during Phase 3 assessment
   */
  handleAssessmentSelection(selectedPhrase, selectedBtn, correctPhrase) {
    this.assessmentAnswered = true;
    const isCorrect = selectedPhrase.trim().toLowerCase() === correctPhrase.trim().toLowerCase();
    const feedbackArea = document.getElementById('assessment-feedback-area');
    const allButtons = this.content.querySelectorAll('.assessment-opt-btn');

    // Disable all option buttons
    allButtons.forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.phrase.trim().toLowerCase() === correctPhrase.trim().toLowerCase()) {
        btn.classList.add('opt-correct');
      }
    });

    if (!isCorrect) {
      selectedBtn.classList.add('opt-incorrect');
    }

    // Automatically log attempt via learnerStore
    const signId = this.currentItem.id;
    learnerStore.recordAttempt(signId, {
      success: isCorrect,
      accuracy: isCorrect ? 1.0 : 0.0
    });

    // Update local item status
    if (isCorrect) {
      this.currentItem.status = 'learned';
      this.currentItem.statusLabel = 'Learned';
    } else {
      this.currentItem.status = 'needs_review';
      this.currentItem.statusLabel = 'Needs Review';
      if (window.eduApp?.learnerProfile?.data) {
        const queue = window.eduApp.learnerProfile.data.reviewQueue || [];
        if (!queue.includes(signId)) queue.push(signId);
      }
    }

    // Render feedback & Next Recommended Sign CTA
    if (feedbackArea) {
      feedbackArea.classList.remove('hidden');
      
      const remediationHtml = !isCorrect && this.currentItem.instruction ? `
        <div style="margin-top: 1rem; padding: 1rem; background-color: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; border-radius: 6px; text-align: left;">
          <h4 style="margin: 0 0 0.5rem 0; color: #d97706; display: flex; align-items: center; gap: 0.5rem;"><span>💡</span> Remediation & Review</h4>
          <p style="margin: 0; font-size: 0.95rem; color: #4b5563;">You saw the sign for <strong>"${correctPhrase}"</strong>. Remember the specific mechanics:</p>
          <p style="margin: 0.5rem 0 0 0; font-weight: 500;">${this.currentItem.instruction}</p>
          ${this.currentItem.hint ? `<p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #6b7280;"><em>${this.currentItem.hint}</em></p>` : ''}
        </div>
      ` : '';

      feedbackArea.innerHTML = `
        <div class="result-banner ${isCorrect ? 'result-pass' : 'result-fail'}">
          <div class="result-icon">${isCorrect ? '🎉' : '⚠️'}</div>
          <div class="result-text">
            <h4>${isCorrect ? 'Correct! Outstanding Comprehension' : 'Not Quite Right'}</h4>
            <p>
              ${isCorrect
                ? `You correctly identified <strong>"${correctPhrase}"</strong>. Sign has been marked as <strong>LEARNED</strong> and your mastery progress increased!`
                : `The demonstrated sign was <strong>"${correctPhrase}"</strong>. Added to your <strong>NEEDS REVIEW</strong> reinforcement queue.`
              }
            </p>
            ${remediationHtml}
          </div>
        </div>

        <div class="post-assess-actions">
          <button id="btn-replay-revealed" class="btn-loop-secondary">
            Replay Revealed Sign
          </button>
          <button id="loop-btn-next-recommended" class="btn-loop-primary btn-pulse">
            Next Recommended Sign →
          </button>
        </div>
      `;

      document.getElementById('btn-replay-revealed')?.addEventListener('click', () => {
        this.playSign(1.0, false);
      });

      // Hook into islRepository.getRecommendations() for the post-assessment CTA
      document.getElementById('loop-btn-next-recommended')?.addEventListener('click', () => {
        this.loadNextRecommendedSign();
      });
    }

    // Unmask title in avatar view
    if (window.eduApp) {
      window.eduApp.sl.isMasked = false;
      const wordEl = document.getElementById('edu-sl-info-word');
      if (wordEl) wordEl.textContent = correctPhrase;
    }
  }

  /**
   * Hook into islRepository.getRecommendations() to transition directly to the next recommended sign
   */
  loadNextRecommendedSign() {
    const profile = learnerStore.data;
    // Query repository recommendations
    const recs = islKnowledgeRepository.getRecommendations(profile, 6) || [];
    
    // Find next recommendation distinct from current item
    let nextSign = recs.find(item => String(item.id) !== String(this.currentItem?.id));

    // Fallback: pick any unmastered sign matching learner tier
    if (!nextSign) {
      const items = islKnowledgeRepository.items || [];
      const currentLevel = (profile.currentLevel || 'beginner').toLowerCase();
      nextSign = items.find(i =>
        (i.level || i.proficiencyLevel || '').toLowerCase() === currentLevel &&
        String(i.id) !== String(this.currentItem?.id)
      );
    }

    // Fallback: any item
    if (!nextSign && islKnowledgeRepository.items.length > 0) {
      nextSign = islKnowledgeRepository.items[Math.floor(Math.random() * islKnowledgeRepository.items.length)];
    }

    if (nextSign) {
      this.open(nextSign);
    } else {
      this.close();
    }
  }
}

export const learningLoopController = new LearningLoopController();

if (typeof window !== 'undefined') {
  window.learningLoopController = learningLoopController;
}

export default learningLoopController;
