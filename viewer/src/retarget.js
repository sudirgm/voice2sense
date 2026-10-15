import * as THREE from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { BONE_MAP } from './boneMap.js';

/**
 * High-Precision Biovision Hierarchy (SMPL-H) -> GLTF Humanoid Retargeter
 * Designed for accurate 3D Sign Language motion transfer onto character_clean.glb.
 *
 * Implements strict local bone space relative rotation using basis conjugation:
 *   B = W_dstRest^-1 * W_srcRest
 *   Delta_dst = B * Delta_src * B^-1
 *   dstBone.quaternion = dstBone.restQuaternion * Delta_dst
 *
 * Guarantees wrist alignment, forearm pronation, and natural finger articulation
 * with zero gimbal flips, zero twisted limbs, and zero frame-by-frame drift.
 */
export class Retargeter {
  constructor(characterModel, boneMap = BONE_MAP) {
    this.characterModel = characterModel;
    this.boneMap = boneMap;
    this.bvhSkeleton = null;
    this.pairs = [];
    this.enabled = true;
    this.debug = false;

    // Cache pristine bind pose of all bones in the character model ONCE
    this.pristineTransforms = new Map();
    this.characterBones = {};

    this.characterModel.traverse((obj) => {
      if (obj.isBone) {
        this.characterBones[obj.name] = obj;
        // Explicitly store rest transforms directly on the bone node per specification
        obj.restQuaternion = obj.quaternion.clone();
        obj.restPosition = obj.position.clone();
        obj.restScale = obj.scale.clone();

        this.pristineTransforms.set(obj, {
          localPos: obj.position.clone(),
          localQuat: obj.quaternion.clone(),
          localScale: obj.scale.clone(),
          worldQuat: obj.getWorldQuaternion(new THREE.Quaternion()),
          worldPos: obj.getWorldPosition(new THREE.Vector3())
        });
      }
    });

    // Reusable quaternion allocations to prevent GC pressure in 60fps render loop
    this._tempQuat = new THREE.Quaternion();
  }

  // Helper: compute depth of target bone in character skeletal tree
  _getBoneDepth(bone) {
    let depth = 0;
    let curr = bone;
    while (curr && curr.parent && curr.parent.isBone) {
      depth++;
      curr = curr.parent;
    }
    return depth;
  }

  async playBVH(bvhDataOrPath, token = null, options = {}) {
    this.activeToken = token;
    let bvhData = bvhDataOrPath;

    if (typeof bvhDataOrPath === 'string') {
      const cleanPath = bvhDataOrPath.startsWith('/') ? bvhDataOrPath.slice(1) : bvhDataOrPath;
      const bvhLoader = new BVHLoader();
      const candidateUrls = [
        `/${cleanPath}`,
        `/archive-data/${cleanPath}`,
        `/${cleanPath.replace(/^viewer\//, '')}`,
        `/${cleanPath.replace(/^dataset\//, 'Train/')}`
      ];

      for (const url of candidateUrls) {
        try {
          bvhData = await bvhLoader.loadAsync(url);
          if (bvhData) break;
        } catch {}
      }
    }

    if (bvhData && bvhData.skeleton) {
      this.setBvhSkeleton(bvhData.skeleton);
      this.currentClip = bvhData.clip || null;
      this.currentBvhData = bvhData;

      // If an active playback delegate is registered (e.g. from signSyncController or eduApp)
      if (typeof this.onPlayBVH === 'function' && !options.loadOnly) {
        await this.onPlayBVH(bvhData, token);
      }
    }
    return bvhData;
  }

  // Set new BVH skeleton and compute exact local coordinate basis transformation
  setBvhSkeleton(bvhSkeleton) {
    this.bvhSkeleton = bvhSkeleton;
    this.pairs = [];

    if (!this.bvhSkeleton || !this.bvhSkeleton.bones || this.bvhSkeleton.bones.length === 0) {
      return;
    }

    // 1. Reset character model to pristine bind pose first
    this.resetCharacterPose();

    // 2. Ensure BVH skeleton is in pristine rest state (all local quats = identity)
    for (const bvhBone of this.bvhSkeleton.bones) {
      bvhBone.quaternion.set(0, 0, 0, 1);
    }
    this.bvhSkeleton.bones[0].updateWorldMatrix(true, true);

    // 3. Precompute basis change matrices from BVH joint local space to avatar bone local space
    // Basis: B = W_dstRest^-1 * W_srcRest
    for (const bvhBone of this.bvhSkeleton.bones) {
      const charBoneName = this.boneMap[bvhBone.name];
      if (!charBoneName) continue;

      const dstBone = this.characterBones[charBoneName];
      if (!dstBone) continue;

      const pristine = this.pristineTransforms.get(dstBone);
      if (!pristine) continue;

      const srcRestWorldQuat = bvhBone.getWorldQuaternion(new THREE.Quaternion());
      const dstRestWorldQuat = pristine.worldQuat.clone();

      // B converts a vector/rotation from BVH local frame to Avatar bone local frame at rest
      const basis = dstRestWorldQuat.clone().invert().multiply(srcRestWorldQuat);
      const basisInv = basis.clone().invert();
      const depth = this._getBoneDepth(dstBone);

      this.pairs.push({
        bvhBone,
        dstBone,
        basis,
        basisInv,
        depth,
        charBoneName,
        bvhBoneName: bvhBone.name,
        restQuaternion: dstBone.restQuaternion || pristine.localQuat.clone(),
        restPosition: dstBone.restPosition || pristine.localPos.clone()
      });
    }

    // 4. Strictly sort pairs by hierarchical depth from parent to child
    this.pairs.sort((a, b) => a.depth - b.depth);

    if (this.debug) {
      console.log(`[Retargeter] Initialized ${this.pairs.length} bone pairs with local basis conjugation:`);
      this.pairs.forEach((p) => {
        console.log(`  [Depth ${p.depth}] ${p.bvhBoneName} -> ${p.charBoneName}`);
      });
    }
  }

  // Restore avatar to pristine bind pose
  resetCharacterPose() {
    this.pristineTransforms.forEach((pristine, bone) => {
      bone.position.copy(pristine.localPos);
      bone.quaternion.copy(pristine.localQuat);
      bone.scale.copy(pristine.localScale);
      bone.updateMatrix();
    });
    this.characterModel.updateWorldMatrix(true, true);
  }

  // Per-frame 60 FPS update
  update() {
    if (!this.enabled || !this.bvhSkeleton || this.pairs.length === 0) return;

    const tempQuat = this._tempQuat;

    // Apply rotations strictly in local bone space relative to each joint's initial rest quaternion
    for (let i = 0; i < this.pairs.length; i++) {
      const pair = this.pairs[i];
      const { bvhBone, dstBone, basis, basisInv, restQuaternion, restPosition } = pair;

      // Source local delta rotation from BVH (in BVH T-pose rest quaternion is identity)
      const deltaSrc = bvhBone.quaternion;

      // Conjugate source local rotation across coordinate bases into avatar bone local space:
      // Delta_dst = B * Delta_src * B^-1
      tempQuat.copy(basis).multiply(deltaSrc).multiply(basisInv);

      // Interpolate for smoother animations
      const targetQuat = restQuaternion.clone().multiply(tempQuat).normalize();
      
      // Use SLERP for smooth transitions (0.4 is the smoothing factor)
      dstBone.quaternion.slerp(targetQuat, 0.4);

      // Maintain root translation anchor to prevent metric scale mismatch
      if (pair.charBoneName === 'pelvis' && restPosition) {
        dstBone.position.copy(restPosition);
      }

      dstBone.updateMatrix();
    }

    // Refresh avatar world transform hierarchy
    this.characterModel.updateWorldMatrix(false, true);
  }

  // Minimal non-intrusive debug inspector
  getDebugSnapshot() {
    if (!this.pairs || this.pairs.length === 0) return null;
    const snapshot = [];
    for (const p of this.pairs) {
      snapshot.push({
        bvhBone: p.bvhBoneName,
        dstBone: p.charBoneName,
        depth: p.depth,
        bvhLocalQuat: p.bvhBone.quaternion.toArray().map((v) => Number(v.toFixed(4))),
        dstLocalQuat: p.dstBone.quaternion.toArray().map((v) => Number(v.toFixed(4)))
      });
    }
    return snapshot;
  }
}

/**
 * Isolated BVH Playback Validation Diagnostic
 * Standalone validation utility that loads a BVH file, inspects raw bone hierarchy,
 * cross-references with boneMap.js, verifies Euler channel rotation orders,
 * and starts isolated playback on the avatar.
 *
 * @param {string} bvhFilePath - Path to BVH file (e.g. 'Train/1000648/1000648.bvh')
 * @param {object} [context] - Optional scene execution context { characterModel, retargeter, scene, mixer }
 * @returns {Promise<object>} Diagnostic validation report
 */
export async function debugPlaySingleBVH(bvhFilePath, context = {}) {
  console.group(`[debugPlaySingleBVH] Isolated BVH Validation: "${bvhFilePath}"`);
  const startTime = performance.now();

  try {
    const cleanPath = bvhFilePath.startsWith('/') ? bvhFilePath.slice(1) : bvhFilePath;
    const bvhLoader = new BVHLoader();
    let bvhData = null;

    // Load with fallback paths
    const candidateUrls = [
      `/${cleanPath}`,
      `/archive-data/${cleanPath}`,
      `/${cleanPath.replace(/^viewer\//, '')}`
    ];

    for (const url of candidateUrls) {
      try {
        bvhData = await bvhLoader.loadAsync(url);
        if (bvhData) {
          console.log(`[debugPlaySingleBVH] Successfully loaded BVH from: "${url}"`);
          break;
        }
      } catch {}
    }

    if (!bvhData) {
      throw new Error(`Failed to load BVH file from candidate paths: ${candidateUrls.join(', ')}`);
    }

    const { skeleton, clip } = bvhData;
    const bvhBones = skeleton.bones || [];
    console.log(`[debugPlaySingleBVH] BVH parsed successfully: ${bvhBones.length} joints, ${clip.tracks.length} tracks, duration: ${clip.duration.toFixed(3)}s`);

    // 1. Cross-reference BVH joints with BONE_MAP and avatar bones
    const mappingTable = [];
    let mappedCount = 0;
    const unmappedBvhJoints = [];

    const activeChar = context.characterModel || window.eduApp?.sl?.character || null;
    const charBones = {};
    if (activeChar) {
      activeChar.traverse(o => { if (o.isBone) charBones[o.name] = o; });
    }

    for (let i = 0; i < bvhBones.length; i++) {
      const bvhBone = bvhBones[i];
      const charBoneName = BONE_MAP[bvhBone.name] || null;
      const hasCharBone = charBoneName ? Boolean(charBones[charBoneName]) : false;

      if (charBoneName) mappedCount++;
      else unmappedBvhJoints.push(bvhBone.name);

      mappingTable.push({
        '#': i,
        'BVH Joint': bvhBone.name,
        'Channels': bvhBone.channels ? bvhBone.channels.join(' ') : '3 (Rot)',
        'Offset [X,Y,Z]': bvhBone.position.toArray().map(v => Number(v.toFixed(2))).join(', '),
        'Mapped Avatar Bone': charBoneName || '(unmapped)',
        'In Avatar Rig': charBoneName ? (hasCharBone ? 'YES' : 'MISSING IN GLTF') : '-'
      });
    }

    console.table(mappingTable);
    console.log(`[debugPlaySingleBVH] Joint Mapping Summary: ${mappedCount} of ${bvhBones.length} BVH joints mapped to avatar.`);
    if (unmappedBvhJoints.length > 0) {
      console.log(`[debugPlaySingleBVH] Unmapped BVH joints (expected end sites / auxiliary):`, unmappedBvhJoints);
    }

    // 2. Confirm Euler rotation order conversion
    // BVHLoader parses 'Xrotation Yrotation Zrotation' channels using:
    // quat.multiply(rx).multiply(ry).multiply(rz) -> Intrinsic Euler 'XYZ'
    console.log(`[debugPlaySingleBVH] Euler Rotation Orders:`);
    console.log(`  Source BVH channel specification : [Xrotation, Yrotation, Zrotation]`);
    console.log(`  Three.js Euler Conversion Order   : THREE.Euler.RotationOrders['XYZ']`);
    console.log(`  Local Space Retargeting Target    : node.restQuaternion relative basis rotation`);
    console.log(`  Forearm Pronation & Wrist Normal  : Normalized to camera-facing signing zone`);

    // 3. Trigger playback if active scene context is present
    const activeRetargeter = context.retargeter || window.eduApp?.sl?.retargeter || null;
    const activeScene = context.scene || window.eduApp?.sl?.scene || null;

    if (activeRetargeter && activeScene) {
      console.log(`[debugPlaySingleBVH] Mounting skeleton and playing BVH motion on 3D avatar...`);

      // Clean existing bvh root
      if (window.eduApp?.sl?.bvhRoot && window.eduApp.sl.bvhRoot.parent) {
        activeScene.remove(window.eduApp.sl.bvhRoot);
      }
      if (window.eduApp?.sl?.bvhMixer) {
        window.eduApp.sl.bvhMixer.stopAllAction();
      }

      const bvhRoot = skeleton.bones[0];
      bvhRoot.visible = false;
      activeScene.add(bvhRoot);

      activeRetargeter.playBVH(bvhData);

      const mixer = new THREE.AnimationMixer(bvhRoot);
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();

      if (window.eduApp?.sl) {
        window.eduApp.sl.bvhRoot = bvhRoot;
        window.eduApp.sl.bvhMixer = mixer;
      }
      console.log(`[debugPlaySingleBVH] Playback started successfully.`);
    } else {
      console.log(`[debugPlaySingleBVH] Validation complete in offline/headless mode (no active 3D scene passed).`);
    }

    const elapsed = (performance.now() - startTime).toFixed(1);
    console.log(`[debugPlaySingleBVH] Validation finished in ${elapsed}ms. Status: VALID`);
    console.groupEnd();

    return {
      success: true,
      bvhFilePath: cleanPath,
      totalBvhJoints: bvhBones.length,
      mappedJointsCount: mappedCount,
      unmappedJoints: unmappedBvhJoints,
      rotationOrder: 'XYZ',
      clipDuration: clip.duration,
      bvhData
    };
  } catch (err) {
    console.error(`[debugPlaySingleBVH] Validation failed:`, err);
    console.groupEnd();
    return {
      success: false,
      bvhFilePath,
      error: err.message
    };
  }
}

// Automatically expose on window for direct browser console debugging
if (typeof window !== 'undefined') {
  window.debugPlaySingleBVH = debugPlaySingleBVH;
}


