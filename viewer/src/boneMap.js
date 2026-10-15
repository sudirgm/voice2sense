// Complete bone mapping between SMPL-H (BVH) and Quaternius / Unreal-standard rig (GLTF)
export const BONE_MAP = {
  // Spine & Head
  'pelvis': 'pelvis',
  'spine1': 'spine_01',
  'spine2': 'spine_02',
  'spine3': 'spine_03',
  'neck': 'neck_01',
  'head': 'Head',

  // Left Arm
  'left_collar': 'clavicle_l',
  'left_shoulder': 'upperarm_l',
  'left_elbow': 'lowerarm_l',
  'left_wrist': 'hand_l',

  // Left Fingers
  'left_thumb1': 'thumb_01_l',
  'left_thumb2': 'thumb_02_l',
  'left_thumb3': 'thumb_03_l',
  'left_index1': 'index_01_l',
  'left_index2': 'index_02_l',
  'left_index3': 'index_03_l',
  'left_middle1': 'middle_01_l',
  'left_middle2': 'middle_02_l',
  'left_middle3': 'middle_03_l',
  'left_ring1': 'ring_01_l',
  'left_ring2': 'ring_02_l',
  'left_ring3': 'ring_03_l',
  'left_pinky1': 'pinky_01_l',
  'left_pinky2': 'pinky_02_l',
  'left_pinky3': 'pinky_03_l',

  // Right Arm
  'right_collar': 'clavicle_r',
  'right_shoulder': 'upperarm_r',
  'right_elbow': 'lowerarm_r',
  'right_wrist': 'hand_r',

  // Right Fingers
  'right_thumb1': 'thumb_01_r',
  'right_thumb2': 'thumb_02_r',
  'right_thumb3': 'thumb_03_r',
  'right_index1': 'index_01_r',
  'right_index2': 'index_02_r',
  'right_index3': 'index_03_r',
  'right_middle1': 'middle_01_r',
  'right_middle2': 'middle_02_r',
  'right_middle3': 'middle_03_r',
  'right_ring1': 'ring_01_r',
  'right_ring2': 'ring_02_r',
  'right_ring3': 'ring_03_r',
  'right_pinky1': 'pinky_01_r',
  'right_pinky2': 'pinky_02_r',
  'right_pinky3': 'pinky_03_r',

  // Lower Body (Legs & Feet)
  'left_hip': 'thigh_l',
  'left_knee': 'calf_l',
  'left_ankle': 'foot_l',
  'left_foot': 'ball_l',
  'right_hip': 'thigh_r',
  'right_knee': 'calf_r',
  'right_ankle': 'foot_r',
  'right_foot': 'ball_r'
};
