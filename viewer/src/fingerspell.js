import * as THREE from 'three';

// ASL / ISL 3D Fingerspelling Alphabet Engine for SignBridge 3D
// Rigged to Quaternius / Standard Humanoid rig 67 articulated bones

const _tempEuler = new THREE.Euler();
const _tempQuat = new THREE.Quaternion();

export class Fingerspeller {
  constructor(characterModel) {
    this.characterModel = characterModel;
    this.bones = {};
    this.restQuats = new Map();

    this.characterModel.traverse((child) => {
      if (child.isBone) {
        this.bones[child.name] = child;
        this.restQuats.set(child, child.quaternion.clone());
      }
    });

    // Bone references
    this.rUpper = this.bones['upperarm_r'];
    this.rLower = this.bones['lowerarm_r'];
    this.rHand = this.bones['hand_r'];

    this.lUpper = this.bones['upperarm_l'];
    this.lLower = this.bones['lowerarm_l'];
    this.lHand = this.bones['hand_l'];

    this.rThumb = [this.bones['thumb_01_r'], this.bones['thumb_02_r'], this.bones['thumb_03_r']].filter(Boolean);
    this.rIndex = [this.bones['index_01_r'], this.bones['index_02_r'], this.bones['index_03_r']].filter(Boolean);
    this.rMiddle = [this.bones['middle_01_r'], this.bones['middle_02_r'], this.bones['middle_03_r']].filter(Boolean);
    this.rRing = [this.bones['ring_01_r'], this.bones['ring_02_r'], this.bones['ring_03_r']].filter(Boolean);
    this.rPinky = [this.bones['pinky_01_r'], this.bones['pinky_02_r'], this.bones['pinky_03_r']].filter(Boolean);

    this.lThumb = [this.bones['thumb_01_l'], this.bones['thumb_02_l'], this.bones['thumb_03_l']].filter(Boolean);
    this.lIndex = [this.bones['index_01_l'], this.bones['index_02_l'], this.bones['index_03_l']].filter(Boolean);
    this.lMiddle = [this.bones['middle_01_l'], this.bones['middle_02_l'], this.bones['middle_03_l']].filter(Boolean);
    this.lRing = [this.bones['ring_01_l'], this.bones['ring_02_l'], this.bones['ring_03_l']].filter(Boolean);
    this.lPinky = [this.bones['pinky_01_l'], this.bones['pinky_02_l'], this.bones['pinky_03_l']].filter(Boolean);

    // Default right arm signing base pose (comfortably at chest/solar-plexus signing space)
    // Mathematically calibrated to character_clean.glb rest skeleton:
    // Upper arm: rotated forward & downward into natural signing rest
    // Lower arm: elbow bent forward into chest-level signing area with ample forward clearance (x ≈ -0.22, y ≈ 1.28, z ≈ +0.40)
    const restUpper = this.restQuats.get(this.rUpper);
    const restLower = this.restQuats.get(this.rLower);

    this.baseUpperQuat = (restUpper ? restUpper.clone() : new THREE.Quaternion()).multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.75, 0.5, 0.7))
    );
    this.baseLowerQuat = (restLower ? restLower.clone() : new THREE.Quaternion()).multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.85, 0, 0.05))
    );

    // Natural rest pose (arms down at sides) to prevent rigid T-pose
    const restUpperL = this.restQuats.get(this.lUpper);
    const restLowerL = this.restQuats.get(this.lLower);

    this.idleUpperRQuat = (restUpper ? restUpper.clone() : new THREE.Quaternion()).multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 1.2)) // Drop arm down
    );
    this.idleLowerRQuat = (restLower ? restLower.clone() : new THREE.Quaternion()).multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)) // Slight bend
    );
    this.idleUpperLQuat = (restUpperL ? restUpperL.clone() : new THREE.Quaternion()).multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -1.2)) // Drop arm down
    );
    this.idleLowerLQuat = (restLowerL ? restLowerL.clone() : new THREE.Quaternion()).multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)) // Slight bend
    );

    // 2-Handed ISL Active Signing Base Pose for the Left Arm (held up as a canvas)
    this.signingLeftUpperQuat = (restUpperL ? restUpperL.clone() : new THREE.Quaternion()).multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 0, -0.6))
    );
    this.signingLeftLowerQuat = (restLowerL ? restLowerL.clone() : new THREE.Quaternion()).multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, 0, -0.2))
    );
    
    // Left hand base wrists
    this.leftWristFlatUp = new THREE.Quaternion(0.3, 0.4, 0.6, 0.6); // Palm up
    this.leftWristFlatRight = new THREE.Quaternion(0, 0.7, 0, 0.7); // Palm facing right

    // Precomputed optimal wrist orientations ensuring palm and finger configuration face the user/camera directly:
    // 1. Default (A-B, D-F, I-N, R-Z, 1-9): Palm faces camera directly (World Z = +1.0),
    //    fingers point upright (World Y = +1.0), knuckles spread horizontally across camera view (World X = +1.0)
    this.wristQuatDefault = new THREE.Quaternion(0.201326, -0.365351, -0.685559, 0.596653);
    this.baseHandQuat = this.wristQuatDefault.clone();

    // 2. G and H: Fingers pointing horizontally inward across the chest, palm facing camera directly (World Z = +1.0)
    this.wristQuatG_H = new THREE.Quaternion(0.507517, -0.692851, -0.351326, 0.372765);

    // 3. C, O, 0: Angled at 30 deg 3/4 turn towards avatar midline so both the curve profile and opening are visible
    this.wristQuatC_O = new THREE.Quaternion(0.037315, -0.493437, -0.713534, 0.495980);

    // 4. P and Q: Downward-forward angle with palm angled toward camera for clear finger silhouette
    this.wristQuatP_Q = new THREE.Quaternion(-0.457470, 0.844632, -0.186608, 0.206146);
  }

  // Curl a multi-joint finger: curlAmount from 0.0 (fully straight) to 1.0 (fully clenched fist)
  setFingerCurl(joints, curlAmount, spreadAngle = 0) {
    if (!joints || joints.length === 0) return;

    // Joint 1 (knuckle)
    if (joints[0]) {
      const rest = this.restQuats.get(joints[0]);
      if (rest) {
        _tempEuler.set(curlAmount * 1.1, spreadAngle, 0);
        _tempQuat.setFromEuler(_tempEuler);
        joints[0].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
    // Joint 2 (middle knuckle)
    if (joints[1]) {
      const rest = this.restQuats.get(joints[1]);
      if (rest) {
        _tempEuler.set(curlAmount * 1.4, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        joints[1].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
    // Joint 3 (fingertip)
    if (joints[2]) {
      const rest = this.restQuats.get(joints[2]);
      if (rest) {
        _tempEuler.set(curlAmount * 1.0, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        joints[2].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
  }

  // Set thumb position and flexion
  setThumbPose(curlAmount, foldAcross = 0) {
    if (!this.rThumb || this.rThumb.length === 0) return;
    if (this.rThumb[0]) {
      const rest = this.restQuats.get(this.rThumb[0]);
      if (rest) {
        _tempEuler.set(curlAmount * 0.5, foldAcross * 0.8, -0.2);
        _tempQuat.setFromEuler(_tempEuler);
        this.rThumb[0].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
    if (this.rThumb[1]) {
      const rest = this.restQuats.get(this.rThumb[1]);
      if (rest) {
        _tempEuler.set(curlAmount * 0.8, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        this.rThumb[1].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
    if (this.rThumb[2]) {
      const rest = this.restQuats.get(this.rThumb[2]);
      if (rest) {
        _tempEuler.set(curlAmount * 0.5, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        this.rThumb[2].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
  }

  // Left hand helpers
  setLeftFingerCurl(joints, curlAmount, spreadAngle = 0) {
    if (!joints || joints.length === 0) return;
    if (joints[0]) {
      const rest = this.restQuats.get(joints[0]);
      if (rest) {
        _tempEuler.set(curlAmount * 1.1, -spreadAngle, 0); // Note negative spread for mirror
        _tempQuat.setFromEuler(_tempEuler);
        joints[0].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
    if (joints[1]) {
      const rest = this.restQuats.get(joints[1]);
      if (rest) {
        _tempEuler.set(curlAmount * 1.4, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        joints[1].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
    if (joints[2]) {
      const rest = this.restQuats.get(joints[2]);
      if (rest) {
        _tempEuler.set(curlAmount * 1.0, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        joints[2].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
  }

  setLeftThumbPose(curlAmount, foldAcross = 0) {
    if (!this.lThumb || this.lThumb.length === 0) return;
    if (this.lThumb[0]) {
      const rest = this.restQuats.get(this.lThumb[0]);
      if (rest) {
        _tempEuler.set(curlAmount * 0.5, -foldAcross * 0.8, 0.2); // Mirror foldAcross and Z twist
        _tempQuat.setFromEuler(_tempEuler);
        this.lThumb[0].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
    if (this.lThumb[1]) {
      const rest = this.restQuats.get(this.lThumb[1]);
      if (rest) {
        _tempEuler.set(curlAmount * 0.8, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        this.lThumb[1].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
    if (this.lThumb[2]) {
      const rest = this.restQuats.get(this.lThumb[2]);
      if (rest) {
        _tempEuler.set(curlAmount * 0.5, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        this.lThumb[2].quaternion.copy(rest).multiply(_tempQuat);
      }
    }
  }

  // Pose character hand to match letter A-Z (2-Handed ISL)
  poseLetter(letterChar) {
    const char = (letterChar || 'A').toUpperCase();

    // 1. ISL Base Pose for Arms
    if (this.rUpper) this.rUpper.quaternion.copy(this.baseUpperQuat);
    if (this.rLower) this.rLower.quaternion.copy(this.baseLowerQuat);
    if (this.lUpper) this.lUpper.quaternion.copy(this.signingLeftUpperQuat);
    if (this.lLower) this.lLower.quaternion.copy(this.signingLeftLowerQuat);

    // Default right and left hand orientations
    if (this.rHand) this.rHand.quaternion.copy(this.wristQuatDefault);
    if (this.lHand) this.lHand.quaternion.copy(this.leftWristFlatRight);

    // Default left hand shape (Flat, slightly spread)
    this.setLeftFingerCurl(this.lIndex, 0.1, 0.1);
    this.setLeftFingerCurl(this.lMiddle, 0.1, 0.05);
    this.setLeftFingerCurl(this.lRing, 0.1, -0.05);
    this.setLeftFingerCurl(this.lPinky, 0.1, -0.1);
    this.setLeftThumbPose(0.2, -0.2);

    // 2. ISL 2-Handed Letter Shapes
    switch (char) {
      // VOWELS: Right index touches tips of left hand fingers
      case 'A': // Right index touches Left Thumb
        if (this.lHand) this.lHand.quaternion.copy(this.leftWristFlatUp);
        this.setFingerCurl(this.rIndex, 0.2);
        this.setFingerCurl(this.rMiddle, 1.0);
        this.setFingerCurl(this.rRing, 1.0);
        this.setFingerCurl(this.rPinky, 1.0);
        this.setThumbPose(0.8, 0.4);
        break;
      case 'E': // Right index touches Left Index
        if (this.lHand) this.lHand.quaternion.copy(this.leftWristFlatUp);
        this.setFingerCurl(this.rIndex, 0.2);
        this.setFingerCurl(this.rMiddle, 1.0);
        this.setFingerCurl(this.rRing, 1.0);
        this.setFingerCurl(this.rPinky, 1.0);
        this.setThumbPose(0.8, 0.4);
        this.setLeftFingerCurl(this.lIndex, 0.4); // Bring index forward slightly
        break;
      case 'I': // Right index touches Left Middle
        if (this.lHand) this.lHand.quaternion.copy(this.leftWristFlatUp);
        this.setFingerCurl(this.rIndex, 0.2);
        this.setFingerCurl(this.rMiddle, 1.0);
        this.setFingerCurl(this.rRing, 1.0);
        this.setFingerCurl(this.rPinky, 1.0);
        this.setThumbPose(0.8, 0.4);
        this.setLeftFingerCurl(this.lMiddle, 0.4);
        break;
      case 'O': // Right index touches Left Ring
        if (this.lHand) this.lHand.quaternion.copy(this.leftWristFlatUp);
        this.setFingerCurl(this.rIndex, 0.2);
        this.setFingerCurl(this.rMiddle, 1.0);
        this.setFingerCurl(this.rRing, 1.0);
        this.setFingerCurl(this.rPinky, 1.0);
        this.setThumbPose(0.8, 0.4);
        this.setLeftFingerCurl(this.lRing, 0.4);
        break;
      case 'U': // Right index touches Left Pinky
        if (this.lHand) this.lHand.quaternion.copy(this.leftWristFlatUp);
        this.setFingerCurl(this.rIndex, 0.2);
        this.setFingerCurl(this.rMiddle, 1.0);
        this.setFingerCurl(this.rRing, 1.0);
        this.setFingerCurl(this.rPinky, 1.0);
        this.setThumbPose(0.8, 0.4);
        this.setLeftFingerCurl(this.lPinky, 0.4);
        break;

      // CONSONANTS (Selected examples, fallback to generic shapes for simplicity in this iteration)
      case 'B': // Right fingers flat against Left palm
      case 'C':
      case 'D':
      case 'F':
      case 'G':
      case 'H':
      case 'J':
      case 'K':
      case 'L':
      case 'M':
      case 'N':
      case 'P':
      case 'Q':
      case 'R':
      case 'S':
      case 'T':
      case 'V':
      case 'W':
      case 'X':
      case 'Y':
      case 'Z':
        // Generic 2-handed interactions (Right flat against left palm)
        if (this.lHand) this.lHand.quaternion.copy(this.leftWristFlatUp);
        this.setFingerCurl(this.rIndex, 0.1);
        this.setFingerCurl(this.rMiddle, 0.1);
        this.setFingerCurl(this.rRing, 0.1);
        this.setFingerCurl(this.rPinky, 0.1);
        this.setThumbPose(0.3, 0.1);
        break;

      default:
        // Default idle for non-alphabet
        if (this.lUpper) this.lUpper.quaternion.copy(this.idleUpperLQuat);
        if (this.lLower) this.lLower.quaternion.copy(this.idleLowerLQuat);
        this.setFingerCurl(this.rIndex, 0.5);
        this.setFingerCurl(this.rMiddle, 0.5);
        this.setFingerCurl(this.rRing, 0.5);
        this.setFingerCurl(this.rPinky, 0.5);
        this.setThumbPose(0.5, 0.4);
        break;
    }

    // Refresh matrices
    this.characterModel.updateWorldMatrix(true, true);
  }
  /**
   * Procedural Fingerspelling Animation:
   * Smoothly interpolates hand & finger joints into authentic ASL/ISL letter pose over durationMs,
   * then holds the target handshape for holdMs.
   * @param {string} char
   * @param {Object} [options={}]
   * @param {number} [options.durationMs=300] Transition duration in milliseconds
   * @param {number} [options.holdMs=200] Pose hold duration in milliseconds
   * @returns {Promise<void>}
   */
  async playLetterPose(char, options = {}) {
    const { durationMs = 300, holdMs = 200 } = options;
    const letter = (char || '').toUpperCase();
    if (!letter) return;

    // Collect all bones articulated by fingerspeller
    const articulatedBones = [
      this.rUpper, this.rLower, this.rHand,
      this.lUpper, this.lLower, this.lHand,
      ...(this.rThumb || []),
      ...(this.rIndex || []),
      ...(this.rMiddle || []),
      ...(this.rRing || []),
      ...(this.rPinky || []),
      ...(this.lThumb || []),
      ...(this.lIndex || []),
      ...(this.lMiddle || []),
      ...(this.lRing || []),
      ...(this.lPinky || [])
    ].filter(Boolean);

    // 1. Snapshot starting bone quaternions
    const startQuats = new Map();
    articulatedBones.forEach(bone => {
      startQuats.set(bone, bone.quaternion.clone());
    });

    // 2. Pose the character into target letter configuration
    this.poseLetter(letter);

    // 3. Snapshot target letter quaternions
    const targetQuats = new Map();
    articulatedBones.forEach(bone => {
      targetQuats.set(bone, bone.quaternion.clone());
    });

    // 4. Restore starting quaternions for smooth SLERP interpolation
    articulatedBones.forEach(bone => {
      const q = startQuats.get(bone);
      if (q) bone.quaternion.copy(q);
    });
    if (this.characterModel?.updateWorldMatrix) {
      this.characterModel.updateWorldMatrix(true, true);
    }

    // 5. Interpolate from startQuats to targetQuats over durationMs
    if (durationMs > 0 && typeof requestAnimationFrame !== 'undefined') {
      const startTime = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / durationMs, 1.0);
          // Ease-out cubic: 1 - (1 - t)^3
          const t = 1 - Math.pow(1 - progress, 3);

          articulatedBones.forEach(bone => {
            const sq = startQuats.get(bone);
            const tq = targetQuats.get(bone);
            if (sq && tq) {
              bone.quaternion.slerpQuaternions(sq, tq, t);
            }
          });
          if (this.characterModel?.updateWorldMatrix) {
            this.characterModel.updateWorldMatrix(true, true);
          }

          if (progress < 1.0) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    } else {
      // Instant assignment fallback (headless Node.js or durationMs <= 0)
      articulatedBones.forEach(bone => {
        const tq = targetQuats.get(bone);
        if (tq) bone.quaternion.copy(tq);
      });
      if (this.characterModel?.updateWorldMatrix) {
        this.characterModel.updateWorldMatrix(true, true);
      }
    }

    // 6. Hold target pose for holdMs
    if (holdMs > 0) {
      await new Promise(r => setTimeout(r, holdMs));
    }
  }

  // Reset all bones posed by fingerspeller back to their rest pose
  // We apply a natural idle pose to the arms here so the avatar doesn't freeze in a strict T-pose
  resetToRestPose() {
    this.restQuats.forEach((quat, bone) => {
      bone.quaternion.copy(quat);
    });
    
    // Apply natural idle arm drop
    if (this.rUpper) this.rUpper.quaternion.copy(this.idleUpperRQuat);
    if (this.rLower) this.rLower.quaternion.copy(this.idleLowerRQuat);
    if (this.lUpper) this.lUpper.quaternion.copy(this.idleUpperLQuat);
    if (this.lLower) this.lLower.quaternion.copy(this.idleLowerLQuat);

    this.characterModel.updateWorldMatrix(true, true);
  }
}


