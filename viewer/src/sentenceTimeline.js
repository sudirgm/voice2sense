// ============================================================
// Sentence Timeline & Playback Controller for 3D ISL Avatar
// Voice 2 Sense | SignBridge 3D
// Deterministic / Rule-based only — NO AI, NO LLM, NO backend
// ============================================================

import * as THREE from 'three';

export class SentenceTimeline {
  constructor({ characterModel, fingerspeller, retargeter, bvhLoader, scene }) {
    this.characterModel = characterModel;
    this.fingerspeller = fingerspeller;
    this.retargeter = retargeter;
    this.bvhLoader = bvhLoader;
    this.scene = scene;

    // Cache for loaded BVH clips
    this.bvhCache = new Map();
    this.activeMixer = null;
    this.activeBvhRoot = null;

    // Authoritative Playback State
    this.state = {
      currentSentence: '',
      currentGlossSequence: [],
      currentSignIndex: -1,
      currentAnimation: null,
      playbackSpeed: 1.0,
      isPlaying: false,
      isPaused: false,
      requestId: 0
    };

    // Active timers / resolvers for cancellation and pause/resume
    this._activeTimeout = null;
    this._pauseResumeResolve = null;
    this._remainingDuration = 0;
    this._stepStartTime = 0;

    // Event listeners
    this.listeners = {
      signStart: [],
      signEnd: [],
      letterStep: [],
      sentenceComplete: [],
      stateChange: []
    };
  }

  // Add event listener
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.warn('[SentenceTimeline] Listener error:', e); }
      });
    }
    if (event !== 'stateChange') {
      this.emit('stateChange', { ...this.state });
    }
  }

  getState() {
    return { ...this.state };
  }

  setSpeed(speed) {
    const s = parseFloat(speed);
    if (!s || isNaN(s)) return;
    this.state.playbackSpeed = Math.max(0.5, Math.min(2.0, s));
    if (this.activeMixer) {
      this.activeMixer.timeScale = this.state.playbackSpeed;
    }
    this.emit('stateChange', { ...this.state });
  }

  // Interrupt and cancel all active animations, timers, and sequences
  stop() {
    this.state.requestId++;
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentSignIndex = -1;
    this.state.currentAnimation = null;

    if (this._activeTimeout) {
      clearTimeout(this._activeTimeout);
      this._activeTimeout = null;
    }
    if (this._pauseResumeResolve) {
      this._pauseResumeResolve();
      this._pauseResumeResolve = null;
    }

    if (this.activeMixer) {
      try { this.activeMixer.stopAllAction(); } catch {}
    }
    if (this.activeBvhRoot && this.activeBvhRoot.parent) {
      this.scene.remove(this.activeBvhRoot);
      this.activeBvhRoot = null;
    }
    if (this.retargeter) {
      this.retargeter.bvhSkeleton = null;
    }

    this.emit('stateChange', { ...this.state });
  }

  pause() {
    if (!this.state.isPlaying || this.state.isPaused) return;
    this.state.isPaused = true;

    if (this._activeTimeout) {
      clearTimeout(this._activeTimeout);
      this._activeTimeout = null;
      const elapsed = performance.now() - this._stepStartTime;
      this._remainingDuration = Math.max(50, this._remainingDuration - elapsed);
    }

    if (this.activeMixer) {
      this.activeMixer.timeScale = 0;
    }

    this.emit('stateChange', { ...this.state });
  }

  resume() {
    if (!this.state.isPlaying || !this.state.isPaused) return;
    this.state.isPaused = false;

    if (this.activeMixer) {
      this.activeMixer.timeScale = this.state.playbackSpeed;
    }

    if (this._pauseResumeResolve) {
      const resolve = this._pauseResumeResolve;
      this._pauseResumeResolve = null;
      const dur = this._remainingDuration || 200;
      this._stepStartTime = performance.now();
      this._activeTimeout = setTimeout(() => {
        this._activeTimeout = null;
        resolve();
      }, dur);
    }

    this.emit('stateChange', { ...this.state });
  }

  replay() {
    if (!this.state.currentSentence || this.state.currentGlossSequence.length === 0) return;
    this.playSequence(this.state.currentSentence, this.state.currentGlossSequence);
  }

  /**
   * Play an entire ISL sentence as ONE continuous animation sequence.
   * Eliminates T-pose resets between signs and provides natural transitions.
   */
  async playSequence(sentenceText, glossSequence) {
    if (!glossSequence || glossSequence.length === 0) return;

    // 1. Immediate Preemption of previous sequence
    this.stop();
    const reqId = this.state.requestId;

    this.state.currentSentence = sentenceText;
    this.state.currentGlossSequence = glossSequence;
    this.state.currentSignIndex = 0;
    this.state.isPlaying = true;
    this.state.isPaused = false;

    this.emit('stateChange', { ...this.state });

    // 2. Play each sign sequentially in a continuous timeline
    for (let i = 0; i < glossSequence.length; i++) {
      if (reqId !== this.state.requestId) return;

      this.state.currentSignIndex = i;
      const item = glossSequence[i];
      this.state.currentAnimation = item;

      this.emit('signStart', { item, index: i, total: glossSequence.length, reqId });

      // Execute sign with speed scaling and cancellation checks
      await this._executeSign(item, reqId);

      if (reqId !== this.state.requestId) return;

      this.emit('signEnd', { item, index: i, total: glossSequence.length, reqId });

      // Smooth inter-sign transition pause (NO T-pose reset!)
      if (i < glossSequence.length - 1) {
        const transitionDuration = Math.round(Math.max(60, 140 / this.state.playbackSpeed));
        await this._delay(transitionDuration, reqId);
        if (reqId !== this.state.requestId) return;
      }
    }

    // 3. Sentence Completed naturally
    if (reqId === this.state.requestId) {
      this.state.isPlaying = false;
      this.state.currentAnimation = null;
      this.emit('sentenceComplete', {
        sentence: sentenceText,
        glossSequence: glossSequence,
        reqId
      });
    }
  }

  /**
   * Internal delay promise with pause/resume and cancellation support
   */
  _delay(durationMs, reqId) {
    if (reqId !== this.state.requestId) return Promise.resolve();

    return new Promise((resolve) => {
      this._remainingDuration = durationMs;
      this._stepStartTime = performance.now();

      if (this.state.isPaused) {
        this._pauseResumeResolve = resolve;
        return;
      }

      this._activeTimeout = setTimeout(() => {
        this._activeTimeout = null;
        resolve();
      }, durationMs);

      this._pauseResumeResolve = resolve;
    });
  }

  /**
   * Execute a single sign in the timeline
   */
  async _executeSign(item, reqId) {
    if (reqId !== this.state.requestId) return;

    const speed = this.state.playbackSpeed;

    // A. Fingerspelled proper noun or word (e.g., proper name "Sudir" -> S-U-D-I-R)
    if (item.type === 'fingerspell' && item.letters && item.letters.length > 0) {
      for (let lIdx = 0; lIdx < item.letters.length; lIdx++) {
        if (reqId !== this.state.requestId) return;
        const letter = item.letters[lIdx].toUpperCase();

        if (this.fingerspeller) {
          this.fingerspeller.poseLetter(letter);
        }

        this.emit('letterStep', {
          item,
          letter,
          index: lIdx,
          total: item.letters.length,
          word: item.label || item.gloss,
          type: 'fingerspell',
          reqId
        });

        const letterHold = Math.round(Math.max(100, 500 / speed));
        await this._delay(letterHold, reqId);

        if (lIdx < item.letters.length - 1) {
          const letterTransition = Math.round(Math.max(40, 100 / speed));
          await this._delay(letterTransition, reqId);
        }
      }
      return;
    }

    // B. Numeral Sign (e.g., Number 2, 3, 5)
    if (item.type === 'number' || /^\d$/.test(item.signRef)) {
      const digit = item.signRef;
      if (this.fingerspeller) {
        this.fingerspeller.poseLetter(digit);
      }
      this.emit('letterStep', {
        item,
        letter: digit,
        index: 0,
        total: 1,
        word: `Number ${digit}`,
        type: 'number',
        reqId
      });
      const numHold = Math.round(Math.max(250, 900 / speed));
      await this._delay(numHold, reqId);
      return;
    }

    // C. Single Alphabet Sign (A-Z)
    if (item.type === 'letter' && item.signRef.length === 1) {
      if (this.fingerspeller) {
        this.fingerspeller.poseLetter(item.signRef);
      }
      this.emit('letterStep', {
        item,
        letter: item.signRef,
        index: 0,
        total: 1,
        word: `Alphabet ${item.signRef}`,
        type: 'letter',
        reqId
      });
      const charHold = Math.round(Math.max(250, 850 / speed));
      await this._delay(charHold, reqId);
      return;
    }

    // D. BVH motion clip (if available in bvhCache or signRef)
    if (item.type === 'bvh' || (item.signRef && item.signRef.endsWith('.bvh'))) {
      await this._playBvhClip(item.signRef, reqId);
      return;
    }

    // E. Known Lexical Gestures / Words via Fingerspeller or Expressive Pose
    // Examples: HELLO, ME, YOU, HAVE, WANT, LEARN, BOOK, HELP, PLEASE, NOT, WHAT
    const handled = this._poseLexicalGesture(item);
    
    if (handled) {
      const wordHold = Math.round(Math.max(300, 850 / speed));
      await this._delay(wordHold, reqId);
    } else {
      // Fallback: fully fingerspell unknown words (OOV)
      const gloss = (item.signRef || item.gloss || '').toUpperCase().replace(/[^\w]/g, '');
      console.log(`[Timeline] Missing BVH/gesture for "${gloss}", falling back to complete fingerspelling.`);
      const letters = gloss.split('');
      for (let lIdx = 0; lIdx < letters.length; lIdx++) {
        if (reqId !== this.state.requestId) return;
        const letter = letters[lIdx];
        if (this.fingerspeller) {
          this.fingerspeller.poseLetter(letter);
        }
        
        this.emit('letterStep', {
          item,
          letter,
          index: lIdx,
          total: letters.length,
          word: gloss,
          type: 'fingerspell_fallback',
          reqId
        });

        const letterHold = Math.round(Math.max(100, 500 / speed));
        await this._delay(letterHold, reqId);

        if (lIdx < letters.length - 1) {
          const letterTransition = Math.round(Math.max(40, 100 / speed));
          await this._delay(letterTransition, reqId);
        }
      }
    }
  }

  /**
   * Expressive natural hand gestures for core ISL sentence words
   */
  _poseLexicalGesture(item) {
    if (!this.fingerspeller) return;
    const gloss = (item.signRef || item.gloss || '').toUpperCase().replace(/[^\w]/g, '');

    switch (gloss) {
      case 'HELLO':
        // Wave gesture at shoulder/forehead
        this.fingerspeller.poseLetter('B');
        if (this.fingerspeller.rHand) {
          this.fingerspeller.rHand.quaternion.multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.25))
          );
        }
        break;

      case 'ME':
      case 'MY':
        // Pointing index or flat palm to chest
        this.fingerspeller.poseLetter('1');
        if (this.fingerspeller.rHand) {
          // Angle wrist slightly inward toward chest
          this.fingerspeller.rHand.quaternion.multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.4, 0))
          );
        }
        break;

      case 'YOU':
      case 'YOUR':
        // Pointing index forward toward viewer / addressee
        this.fingerspeller.poseLetter('1');
        if (this.fingerspeller.rHand) {
          this.fingerspeller.rHand.quaternion.multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0, 0))
          );
        }
        break;

      case 'WHAT':
      case 'HOW':
        // Open palm upward questioning gesture
        this.fingerspeller.poseLetter('5');
        if (this.fingerspeller.rHand) {
          this.fingerspeller.rHand.quaternion.multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, 0.3))
          );
        }
        break;

      case 'BOOK':
        // Flat open palms (like opening a book)
        this.fingerspeller.poseLetter('B');
        break;

      case 'HELP':
        // Thumbs up gesture supported on base
        this.fingerspeller.poseLetter('A');
        if (this.fingerspeller.rHand) {
          this.fingerspeller.rHand.quaternion.multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.4))
          );
        }
        break;

      case 'PLEASE':
      case 'THANK_YOU':
      case 'THANKYOU':
        // Flat hand at chest / chin
        this.fingerspeller.poseLetter('B');
        break;

      case 'NOT':
      case 'NO':
        // Negation sign (firm snap / thumbs outward)
        this.fingerspeller.poseLetter('A');
        break;

      case 'WANT':
      case 'LEARN':
      case 'SIGN':
      case 'SIGNLANGUAGE':
        // Five finger active signing pose
        this.fingerspeller.poseLetter('5');
        break;

      default:
        // Signal to caller that this gesture is unhandled and should be fingerspelled completely
        return false;
    }
    return true;
  }

  /**
   * Play BVH motion clip with speed scaling and graceful completion
   */
  async _playBvhClip(bvhPath, reqId) {
    if (reqId !== this.state.requestId || !this.bvhLoader) return;
    
    console.log('▶️ PLAYING ANIMATION:', bvhPath);

    try {
      let bvhData = this.bvhCache.get(bvhPath);
      if (!bvhData) {
        try {
          bvhData = await this.bvhLoader.loadAsync(`/${bvhPath}`);
        } catch {
          bvhData = await this.bvhLoader.loadAsync(`/archive-data/${bvhPath}`);
        }
        this.bvhCache.set(bvhPath, bvhData);
      }

      if (reqId !== this.state.requestId) return;

      // Clean old root if any
      if (this.activeBvhRoot && this.activeBvhRoot.parent) {
        this.scene.remove(this.activeBvhRoot);
      }
      if (this.activeMixer) {
        try { this.activeMixer.stopAllAction(); } catch {}
      }

      const bvhSkeleton = bvhData.skeleton;
      this.activeBvhRoot = bvhSkeleton.bones[0];
      this.activeBvhRoot.visible = false;
      this.scene.add(this.activeBvhRoot);

      if (this.retargeter) {
        this.retargeter.setBvhSkeleton(bvhSkeleton);
        this.retargeter.enabled = true;
      }

      this.activeMixer = new THREE.AnimationMixer(this.activeBvhRoot);
      const action = this.activeMixer.clipAction(bvhData.clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.timeScale = this.state.playbackSpeed;
      action.play();

      const clipDuration = (bvhData.clip.duration || 1.5) / this.state.playbackSpeed;
      await this._delay(Math.round(clipDuration * 1000), reqId);

    } catch (err) {
      console.warn('[SentenceTimeline] BVH playback warning:', err);
    }
  }

  // Update mixer per frame
  update(delta) {
    if (this.activeMixer && this.state.isPlaying && !this.state.isPaused) {
      this.activeMixer.update(delta * this.state.playbackSpeed);
    }
  }
}
