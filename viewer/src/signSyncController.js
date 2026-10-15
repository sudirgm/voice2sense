// ============================================================
// Centralized Sign ↔ Video Synchronization Controller
// Voice 2 Sense | SignBridge 3D Architecture
// ============================================================

import { OfflineTranslationService } from './offlineTranslationService.js';
import { signMatcher } from './signMatcher.js';

export class SignSyncController {
  constructor() {
    this.translationService = new OfflineTranslationService();
    // 1. Centralized Playback & Sync State
    this.currentLesson = null;
    this.currentVideoTime = 0;
    this.lastCheckedVideoTime = 0;
    this.playbackRate = 1.0; // Default 1x
    this.isPlaying = false;
    this.isBuffering = false;
    this.currentSign = null;
    this.signQueue = [];
    this.requestId = 0; // Monotonic Generation / Cancellation ID
    this.isManualOverride = false; // When true, user manual sign/speech has priority over passive video timeline

    // Player references
    this.activePlayer = null;
    this.activeIframeId = null;

    // References to 3D rendering components (registered by main.js)
    this.bvhMixer = null;
    this.currentAction = null;
    this.retargeter = null;
    this.fingerspeller = null;
    this.signMatcher = null;
    this.playBvhFn = null;
    this.resetAvatarFn = null;

    // Active async wait resolvers
    this._activeResolver = null;
    this._activeTimer = null;
    this._lastSpokenText = '';
    this._lastTimeCheck = 0;

    // Bind methods
    this.tick = this.tick.bind(this);
    this.setPlaybackRate = this.setPlaybackRate.bind(this);
    this.requestSign = this.requestSign.bind(this);
    this.stopActiveAnimation = this.stopActiveAnimation.bind(this);
  }

  // Register Three.js rendering hooks from main.js
  registerEngine({ bvhMixer, retargeter, fingerspeller, signMatcher, playBvhFn, resetAvatarFn }) {
    if (bvhMixer) this.bvhMixer = bvhMixer;
    if (retargeter) this.retargeter = retargeter;
    if (fingerspeller) this.fingerspeller = fingerspeller;
    if (signMatcher) this.signMatcher = signMatcher;
    if (playBvhFn) this.playBvhFn = playBvhFn;
    if (resetAvatarFn) this.resetAvatarFn = resetAvatarFn;
  }

  // -------------------------------------------------------
  // 2. PLAYBACK SPEED (Synchronized to BOTH Video and 3D Avatar)
  // -------------------------------------------------------
  setPlaybackRate(rate, updatePlayer = true) {
    const num = parseFloat(rate);
    const validSpeeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    if (isNaN(num) || !validSpeeds.includes(num)) return;

    this.playbackRate = num;

    // 1. Update active YouTube video player speed
    if (updatePlayer && this.activePlayer && typeof this.activePlayer.setPlaybackRate === 'function') {
      try {
        this.activePlayer.setPlaybackRate(this.playbackRate);
      } catch (err) {
        console.warn('[SignSync] Failed to set player playback rate:', err);
      }
    }

    // 2. Update Three.js 3D avatar animation mixer playback rate
    if (this.currentAction) {
      this.currentAction.setEffectiveTimeScale(this.playbackRate);
    }

    // 3. Update all speed selector chips in UI across the site
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.mini-chip, .speed-chip, .curr-speed-chip').forEach(chip => {
        chip.classList.toggle('active', parseFloat(chip.dataset.speed) === this.playbackRate);
      });
    }

    // 4. Dispatch global speed event
    this._dispatchSpeedUpdate(this.playbackRate);
  }

  _dispatchSignUpdate(detail) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('signbridge-sign-update', { detail }));
    }
  }

  _dispatchSpeedUpdate(speed) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('signbridge-speed-update', { detail: { speed } }));
    }
  }

  getPlaybackRate() {
    return this.playbackRate;
  }

  // -------------------------------------------------------
  // 3. YOUTUBE / LESSON PLAYER ATTACHMENT & EVENT HANDLING
  // -------------------------------------------------------
  attachPlayer(iframeIdOrElement, lesson = null) {
    this.detachPlayer();

    if (lesson) {
      this.currentLesson = lesson;
    }
    this.isManualOverride = false;
    this.currentVideoTime = (lesson && lesson.startTime) ? lesson.startTime : 0;
    this.lastCheckedVideoTime = this.currentVideoTime;

    const iframe = typeof iframeIdOrElement === 'string' 
      ? document.getElementById(iframeIdOrElement) 
      : iframeIdOrElement;

    if (!iframe) return;

    this.activeIframeId = iframe.id;

    // Initialize YouTube IFrame API Player
    const initYT = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initYT, 100);
        return;
      }

      try {
        this.activePlayer = new window.YT.Player(iframe, {
          events: {
            onReady: (e) => {
              this.activePlayer = e.target;
              try {
                this.activePlayer.setPlaybackRate(this.playbackRate);
              } catch {}
            },
            onStateChange: (e) => {
              this.handlePlayerStateChange(e.data);
            },
            onPlaybackRateChange: (e) => {
              if (e.data && e.data !== this.playbackRate) {
                this.setPlaybackRate(e.data, false);
              }
            }
          }
        });
      } catch (err) {
        console.warn('[SignSync] Error attaching YT.Player:', err);
      }
    };

    initYT();
  }

  detachPlayer() {
    if (this.activePlayer && typeof this.activePlayer.destroy === 'function') {
      try {
        this.activePlayer.destroy();
      } catch {}
    }
    this.activePlayer = null;
    this.activeIframeId = null;
  }

  handlePlayerStateChange(state) {
    if (!window.YT) return;

    switch (state) {
      case window.YT.PlayerState.PLAYING:
        this.isPlaying = true;
        this.isBuffering = false;
        // Resume 3D avatar animation mixer if paused
        if (this.currentAction) {
          this.currentAction.paused = false;
        }
        break;

      case window.YT.PlayerState.PAUSED:
        this.isPlaying = false;
        this.isBuffering = false;
        // Pause 3D avatar animation mixer in place
        if (this.currentAction) {
          this.currentAction.paused = true;
        }
        window.dispatchEvent(new CustomEvent('signbridge-sign-update', {
          detail: { type: 'pause', label: '', gloss: 'PAUSED', status: 'PAUSED' }
        }));
        break;

      case window.YT.PlayerState.BUFFERING:
        this.isBuffering = true;
        // Pause avatar while video buffers
        if (this.currentAction) {
          this.currentAction.paused = true;
        }
        window.dispatchEvent(new CustomEvent('signbridge-sign-update', {
          detail: { type: 'buffer', label: '', gloss: 'BUFFERING', status: 'BUFFERING' }
        }));
        break;

      case window.YT.PlayerState.ENDED:
        this.isPlaying = false;
        this.isBuffering = false;
        this.stopActiveAnimation();
        break;
    }
  }

  // -------------------------------------------------------
  // 4. TICK & REAL-TIME VIDEO TIME SYNC
  // -------------------------------------------------------
  tick(delta) {
    if (!this.activePlayer) return;

    // Rate-limit video time polling to ~100ms interval to reduce postMessage overhead
    const now = performance.now();
    if (now - this._lastTimeCheck < 100) return;
    this._lastTimeCheck = now;

    // Check player current time if available
    let time = 0;
    try {
      if (typeof this.activePlayer.getCurrentTime === 'function') {
        time = this.activePlayer.getCurrentTime();
      }
    } catch {}

    // Safeguard player state in case postMessage event was missed
    try {
      if (typeof this.activePlayer.getPlayerState === 'function') {
        const pState = this.activePlayer.getPlayerState();
        if (window.YT) {
          if (pState === window.YT.PlayerState.PLAYING && (!this.isPlaying || this.isBuffering)) {
            this.isPlaying = true;
            this.isBuffering = false;
            if (this.currentAction) this.currentAction.paused = false;
          } else if (pState === window.YT.PlayerState.PAUSED && this.isPlaying) {
            this.isPlaying = false;
            this.isBuffering = false;
            if (this.currentAction) this.currentAction.paused = true;
          } else if (pState === window.YT.PlayerState.BUFFERING && !this.isBuffering) {
            this.isBuffering = true;
            if (this.currentAction) this.currentAction.paused = true;
          }
        }
      }
    } catch {}

    if (time > 0) {
      // Detect seeking (large jump in currentTime)
      if (Math.abs(time - this.lastCheckedVideoTime) > 1.5) {
        this.handleSeek(time);
      }
      this.currentVideoTime = time;
      this.lastCheckedVideoTime = time;

      // When playing in a curriculum lesson and not in manual override,
      // synchronize signs with lesson video timing
      if (this.isPlaying && !this.isBuffering && this.currentLesson && !this.isManualOverride) {
        this.syncLessonVideoTime(time);
      }
    }
  }

  // Handle user seeking forward or backward in the lesson video
  handleSeek(newTime) {
    this.currentVideoTime = newTime;
    this.lastCheckedVideoTime = newTime;
    // Seeking releases manual override and syncs to new video position
    this.isManualOverride = false;
    this.invalidate('seek');

    if (this.currentLesson && this.isPlaying) {
      this.syncLessonVideoTime(newTime, true);
    }
  }

  // Map lesson video time directly to concept/sign
  syncLessonVideoTime(videoTime, force = false) {
    if (!this.currentLesson || !this.currentLesson.keywords || this.currentLesson.keywords.length === 0) return;

    const keywords = this.currentLesson.keywords;
    const lessonStart = this.currentLesson.startTime || 0;
    const elapsed = Math.max(0, videoTime - lessonStart);

    // Each concept in lesson maps to a segment of the video (approx 4s per concept cycle to keep avatar active)
    const conceptDuration = 4; 
    const conceptIndex = Math.floor(elapsed / conceptDuration) % keywords.length;
    const targetConcept = keywords[conceptIndex];

    if (force || !this.currentSign || (this.currentSign.label !== targetConcept && !this.isQueueActive())) {
      this.requestConceptSign(targetConcept, keywords, false);
    }
  }

  // -------------------------------------------------------
  // 5. PREEMPTION & INTERRUPTION (CRITICAL)
  // -------------------------------------------------------
  // When a new speech phrase, manual text, or concept click arrives:
  // Immediately cancel old queue and start new request from the beginning.
  requestSign(sequenceOrItem, options = {}) {
    if (!sequenceOrItem) return;

    // 1. Invalidate previous generation
    this.requestId++;
    const currentReqId = this.requestId;

    // 2. Safely interrupt any active animation & timer
    this.stopActiveAnimation();

    // 3. Mark manual override if user initiated (click / speech / input)
    if (options.isManual !== false) {
      this.isManualOverride = true;
    }

    // 4. Format sequence
    let sequence = [];
    if (Array.isArray(sequenceOrItem)) {
      sequence = [...sequenceOrItem];
    } else if (typeof sequenceOrItem === 'object') {
      sequence = [sequenceOrItem];
    }

    if (sequence.length === 0) return;

    this.signQueue = sequence;

    // 5. Run sequence under currentReqId
    this._runSequence(currentReqId);
  }

  // Concept sign matching helper
  requestConceptSign(conceptTerm, contextKeywords = [], isManual = true) {
    if (!conceptTerm || !this.signMatcher) return;

    let matched = null;
    if (typeof this.signMatcher.matchConceptToSign === 'function') {
      matched = this.signMatcher.matchConceptToSign(conceptTerm, contextKeywords);
    }

    if (matched && matched.sample) {
      this.requestSign([{
        type: matched.type || 'word',
        label: conceptTerm,
        gloss: matched.gloss || matched.sample.gloss,
        sample: matched.sample
      }], { isManual });
    } else {
      const seq = this.signMatcher.translateSequence(conceptTerm);
      if (seq && seq.length > 0) {
        this.requestSign(seq, { isManual });
      }
    }
  }

  // Invalidate without starting new sign
  invalidate(reason = '') {
    this.requestId++;
    this.stopActiveAnimation();
  }

  // Safely interrupt active BVH, fingerspelling, and queue
  stopActiveAnimation() {
    this.signQueue = [];
    this.currentSign = null;

    // Unblock any active BVH or letter delay promise
    if (this._activeResolver) {
      const r = this._activeResolver;
      this._activeResolver = null;
      r();
    }
    if (this._activeTimer) {
      clearTimeout(this._activeTimer);
      this._activeTimer = null;
    }

    // Stop Three.js AnimationMixer
    if (this.bvhMixer) {
      try {
        this.bvhMixer.stopAllAction();
      } catch {}
    }

    // Reset avatar to pristine humanoid rest pose
    if (typeof this.resetAvatarFn === 'function') {
      this.resetAvatarFn();
    } else if (this.retargeter) {
      this.retargeter.resetCharacterPose();
      this.retargeter.enabled = true;
      if (this.fingerspeller && typeof this.fingerspeller.resetToRestPose === 'function') {
        this.fingerspeller.resetToRestPose();
      }
    }
  }

  isQueueActive() {
    return this.signQueue.length > 0 || this.currentSign !== null;
  }

  // -------------------------------------------------------
  // 6. INTERNAL SEQUENCE RUNNER (STRICT REQUEST ID CHECK)
  // -------------------------------------------------------
  async _runSequence(reqId) {
    while (this.signQueue.length > 0) {
      // Check if preempted by a newer request
      if (reqId !== this.requestId) return;

      const item = this.signQueue.shift();
      this.currentSign = item;

      const sample = item.sample || { bvh: item.path || item.bvh, id: item.id, sentence: item.phrase || item.word || item.label, gloss: item.gloss };

      if (item.type === 'phrase' || item.type === 'word' || item.type === 'BVH') {
        if (reqId !== this.requestId) return;

        // Dispatch HUD update
        this._dispatchSignUpdate({
          type: item.type,
          label: item.label || item.phrase || item.word || `Sign #${item.id}`,
          gloss: item.gloss || `ID: #${item.id}`,
          status: item.type === 'word' ? 'WORD SIGN' : 'SIGNING'
        });

        if (this.retargeter) this.retargeter.enabled = true;

        // Play BVH motion using registered engine
        if (typeof this.playBvhFn === 'function') {
          await this.playBvhFn(sample, reqId);
        } else if (this.retargeter) {
          await this.retargeter.playBVH(sample.bvh);
        }

        if (reqId !== this.requestId) return;

      } else if (item.type === 'FINGERSPELL' && Array.isArray(item.chars)) {
        if (reqId !== this.requestId) return;

        this._dispatchSignUpdate({
          type: 'FINGERSPELL',
          label: item.word,
          gloss: `FS: ${item.word}`,
          status: 'FINGERSPELLING'
        });

        if (this.retargeter) this.retargeter.enabled = false;

        const dur = Math.max(80, Math.round(300 / (this.playbackRate || 1.0)));
        const hold = Math.max(60, Math.round(200 / (this.playbackRate || 1.0)));

        for (const char of item.chars) {
          if (reqId !== this.requestId) return;
          if (this.fingerspeller && typeof this.fingerspeller.playLetterPose === 'function') {
            await this.fingerspeller.playLetterPose(char, { durationMs: dur, holdMs: hold });
          } else if (this.fingerspeller && typeof this.fingerspeller.poseLetter === 'function') {
            this.fingerspeller.poseLetter(char);
            await new Promise((r) => {
              this._activeResolver = r;
              this._activeTimer = setTimeout(() => { this._activeResolver = null; this._activeTimer = null; r(); }, dur + hold);
            });
          }
        }

        if (this.retargeter) this.retargeter.enabled = true;

      } else if (item.type === 'letter') {
        if (reqId !== this.requestId) return;

        this._dispatchSignUpdate({
          type: 'letter',
          label: item.word,
          letter: item.letter,
          gloss: `FS: ${item.letter}`,
          status: 'FINGERSPELLING'
        });

        if (this.retargeter) this.retargeter.enabled = false;
        const dur = Math.max(80, Math.round(300 / (this.playbackRate || 1.0)));
        const hold = Math.max(60, Math.round(200 / (this.playbackRate || 1.0)));

        if (this.fingerspeller && typeof this.fingerspeller.playLetterPose === 'function') {
          await this.fingerspeller.playLetterPose(item.letter, { durationMs: dur, holdMs: hold });
        } else if (this.fingerspeller) {
          this.fingerspeller.poseLetter(item.letter);
          await new Promise((resolve) => {
            this._activeResolver = resolve;
            this._activeTimer = setTimeout(() => {
              this._activeResolver = null;
              this._activeTimer = null;
              resolve();
            }, dur + hold);
          });
        }

        if (reqId !== this.requestId) return;
      }
    }

    // Sequence completed naturally under the same reqId
    if (reqId === this.requestId) {
      this.currentSign = null;
      if (typeof this.resetAvatarFn === 'function') {
        this.resetAvatarFn();
      }

      this._dispatchSignUpdate({
        type: 'idle', label: '', gloss: 'READY', status: 'READY'
      });
    }
  }

  // -------------------------------------------------------
  // FEATURE 6: SEQUENTIAL ANIMATION CONTROLLER
  // -------------------------------------------------------
  async waitDelay(ms) {
    return new Promise((resolve) => {
      this._activeResolver = resolve;
      this._activeTimer = setTimeout(() => {
        this._activeResolver = null;
        this._activeTimer = null;
        resolve();
      }, ms);
    });
  }

  async slerpToNeutralRestPose(durationMs = 250) {
    if (typeof this.resetAvatarFn === 'function') {
      this.resetAvatarFn();
    }
    if (!this.retargeter || !this.retargeter.characterModel) {
      return this.waitDelay(durationMs);
    }

    const retargeter = this.retargeter;
    retargeter.bvhSkeleton = null;
    if (this.bvhMixer) {
      try { this.bvhMixer.stopAllAction(); } catch {}
    }
    if (this.fingerspeller && typeof this.fingerspeller.resetToRestPose === 'function') {
      this.fingerspeller.resetToRestPose();
    }

    const pristineMap = retargeter.pristineTransforms;
    if (!pristineMap || pristineMap.size === 0) {
      retargeter.resetCharacterPose();
      return;
    }

    const startQuats = new Map();
    pristineMap.forEach((pristine, bone) => {
      startQuats.set(bone, bone.quaternion.clone());
    });

    const reqId = this.requestId;
    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    await new Promise((resolve) => {
      const step = (now) => {
        if (reqId !== this.requestId) return resolve();

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1.0);
        const t = 1 - Math.pow(1 - progress, 3); // Ease-out cubic

        pristineMap.forEach((pristine, bone) => {
          const startQ = startQuats.get(bone);
          if (startQ) {
            bone.quaternion.slerpQuaternions(startQ, pristine.localQuat, t);
          }
        });
        if (retargeter.characterModel?.updateWorldMatrix) {
          retargeter.characterModel.updateWorldMatrix(true, true);
        }

        if (progress < 1.0) {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(step);
          } else {
            setTimeout(() => step(Date.now()), 16);
          }
        } else {
          retargeter.resetCharacterPose();
          resolve();
        }
      };

      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(step);
      } else {
        setTimeout(() => step(Date.now()), 16);
      }
    });
  }

  /**
   * Feature 6: Executes a parsed ISL sign sequence strictly in series:
   * for (const sign of parsedSequence) {
   *   if (sign.type === 'BVH') {
   *     await retargeter.playBVH(sign.path);
   *   } else if (sign.type === 'FINGERSPELL') {
   *     for (const char of sign.chars) {
   *       await fingerspeller.playLetterPose(char, { durationMs: 300, holdMs: 200 });
   *     }
   *   }
   *   await waitDelay(100); // Inter-token pause
   * }
   * await slerpToNeutralRestPose(250);
   * @param {Array<Object>} parsedSequence
   * @param {Object} [options={}]
   */
  async executeParsedSequence(parsedSequence, options = {}) {
    if (!Array.isArray(parsedSequence) || parsedSequence.length === 0) return;

    // Invalidate previous running sequence
    this.requestId++;
    const reqId = this.requestId;
    this.stopActiveAnimation();

    const retargeter = this.retargeter;
    const fingerspeller = this.fingerspeller;
    const waitDelay = (ms) => this.waitDelay(ms);
    const slerpToNeutralRestPose = (duration) => this.slerpToNeutralRestPose(duration);

    try {
      for (const sign of parsedSequence) {
        if (reqId !== this.requestId) return;

        if (sign.type === 'BVH') {
          // Update HUD state
          if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
            window.dispatchEvent(new CustomEvent('signbridge-sign-update', {
              detail: {
                type: 'BVH',
                label: sign.word || sign.phrase || `Sign #${sign.id}`,
                gloss: sign.gloss || `ID: #${sign.id}`,
                status: 'SIGNING'
              }
            }));
          }

          if (retargeter) {
            retargeter.enabled = true;
            await retargeter.playBVH(sign.path);
          } else if (typeof this.playBvhFn === 'function') {
            await this.playBvhFn({ bvh: sign.path, id: sign.id }, reqId);
          } else {
            await waitDelay(1200 / (this.playbackRate || 1.0));
          }

        } else if (sign.type === 'FINGERSPELL') {
          if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
            window.dispatchEvent(new CustomEvent('signbridge-sign-update', {
              detail: {
                type: 'FINGERSPELL',
                label: sign.word,
                gloss: `FS: ${sign.word}`,
                status: 'FINGERSPELLING'
              }
            }));
          }

          if (retargeter) retargeter.enabled = false;

          const dur = Math.max(80, Math.round(300 / (this.playbackRate || 1.0)));
          const hold = Math.max(60, Math.round(200 / (this.playbackRate || 1.0)));

          for (const char of sign.chars) {
            if (reqId !== this.requestId) return;
            if (fingerspeller && typeof fingerspeller.playLetterPose === 'function') {
              await fingerspeller.playLetterPose(char, { durationMs: dur, holdMs: hold });
            } else if (fingerspeller && typeof fingerspeller.poseLetter === 'function') {
              fingerspeller.poseLetter(char);
              await waitDelay(dur + hold);
            }
          }

          if (retargeter) retargeter.enabled = true;
        }

        if (reqId !== this.requestId) return;
        await waitDelay(100); // Inter-token pause
      }

      if (reqId === this.requestId) {
        await slerpToNeutralRestPose(250);
        if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
          window.dispatchEvent(new CustomEvent('signbridge-sign-update', {
            detail: { type: 'idle', label: '', gloss: 'READY', status: 'READY' }
          }));
        }
      }
    } catch (err) {
      console.warn('[SignSyncController] Error executing sequence:', err);
    }
  }

  async processInputToISL(rawText) {
    if (!rawText) return [];
    if (!this.signMatcher) {
      this.signMatcher = signMatcher;
    }
    if (this.signMatcher && !this.signMatcher.isLoaded) {
      await this.signMatcher.init();
    }
    const sequence = this.signMatcher.parseAndMatchSequence(rawText);
    await this.executeParsedSequence(sequence);
    return sequence;
  }

  // -------------------------------------------------------
  // 7. SPEECH RECOGNITION INTERFACE (WITH PREEMPTION)
  // -------------------------------------------------------
  async handleSpeechInput(inputData, isFinal = true) {
    if (!inputData) return;

    let text = typeof inputData === 'string' ? inputData.trim() : (inputData.final || inputData.interim || '').trim();
    let audioBlob = typeof inputData === 'object' && inputData.audioBlob ? inputData.audioBlob : null;

    if (!text && !audioBlob) return;

    // Check if Learn Sign Language experience is active
    if (window._eduApp && typeof window._eduApp.isSignLearnActive === 'function' && window._eduApp.isSignLearnActive()) {
      window._eduApp.handleSpeechInput(text, audioBlob);
      return;
    }

    // Ignore exact duplicate of active phrase if queue is active
    if (text && text === this._lastSpokenText && this.isQueueActive()) return;
    if (text) this._lastSpokenText = text;

    if (!this.signMatcher || !this.signMatcher.isLoaded) return;

    // Preempt previous animation immediately!
    this.invalidate('speech');
    const reqId = ++this.requestId;

    // Route speech/text through the local offline pipeline (Whisper -> Indic NLP -> IndicTrans2 -> English)
    const transResult = await this.translationService.processMultilingualInput({
      text,
      audioBlob,
      requestId: reqId
    });

    if (reqId !== this.requestId || transResult.aborted) return;

    const englishText = (transResult.englishText || text).trim();
    if (!englishText) return;

    // Required development log
    console.log('[ISL] input sent to signMatcher:', englishText);

    // Pass translated English internally to existing signMatcher.js
    const sequence = this.signMatcher.translateSequence(englishText);
    if (sequence && sequence.length > 0) {
      this.requestSign(sequence, { isManual: true });
    }
  }

  // Helper to switch curriculum lesson cleanly
  setCurrentLesson(lesson) {
    this.currentLesson = lesson;
    this.invalidate('lesson_change');
  }
}

// Global Singleton Instance
export const signSyncController = new SignSyncController();

if (typeof window !== 'undefined') {
  window.signSyncController = signSyncController;
}

export default signSyncController;
