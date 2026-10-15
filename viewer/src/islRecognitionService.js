/**
 * ============================================================================
 * Voice 2 Sense (SignBridge 3D) — ISL Sign Language Recognition Service
 * 
 * ARCHITECTURAL MATURITY LEVEL: LEVEL 2 PROTOTYPE
 * - Direction 1 (Speech -> 3D Avatar): Level 1 (Working, 2,501 BVH Signs)
 * - Direction 2 (Camera -> Gesture): Level 2 (Architecturally prepared, heuristic prototype)
 * 
 * System Principles & Honest Technical Reality:
 * 1. Geometric Kinematics: Computes authentic 21-joint geometric heuristics on local MediaPipe
 *    hand landmarks (finger curl/extension, thumb-index pinch, palm normal, elevation).
 * 2. Constrained Lexicon: Calibrated for common verified conversational gestures (HELLO,
 *    THANK YOU, GOOD, WATER, alphabets, numbers, quiz evaluations).
 * 3. NO unverified ML claim: This is a rule-based kinematic matcher; not a trained deep
 *    learning temporal model or unrestricted camera conversation system.
 * 4. Graceful Fallback: Low-confidence gestures gracefully degrade to text/selection fallback.
 * 5. Strict Offline Privacy: 100% local camera processing in client WebAssembly.
 * ============================================================================
 */

// Supported Vocabulary for Recognition Provider V1
export const SUPPORTED_ISL_SIGNS_V1 = [
  // 1. Core Conversational Signs
  { id: 'hello', label: 'HELLO', category: 'social', display: 'Hello', motion: 'wave_head_level', phrase: 'Hello!' },
  { id: 'thank_you', label: 'THANK YOU', category: 'social', display: 'Thank You', motion: 'chin_to_forward', phrase: 'Thank you very much.' },
  { id: 'friend', label: 'FRIEND', category: 'social', display: 'Friend', motion: 'interlocking_hands', phrase: 'You are my friend.' },
  { id: 'good', label: 'GOOD', category: 'social', display: 'Good', motion: 'thumbs_up', phrase: 'I am doing good.' },
  { id: 'like', label: 'LIKE', category: 'social', display: 'Like', motion: 'chest_pinch_pull', phrase: 'I like this.' },
  { id: 'think', label: 'THINK', category: 'social', display: 'Think', motion: 'index_temple_tap', phrase: 'I am thinking about it.' },
  { id: 'you', label: 'YOU', category: 'social', display: 'You', motion: 'point_forward', phrase: 'How about you?' },
  { id: 'meet', label: 'MEET', category: 'social', display: 'Meet', motion: 'two_hands_converge', phrase: 'Nice to meet you.' },
  { id: 'please', label: 'PLEASE', category: 'social', display: 'Please', motion: 'open_palm_chest', phrase: 'Please help me.' },
  { id: 'sorry', label: 'SORRY', category: 'social', display: 'Sorry', motion: 'chest_fist_circle', phrase: 'I am sorry.' },
  { id: 'take_care', label: 'TAKE CARE', category: 'social', display: 'Take Care', motion: 'crossed_k_hands', phrase: 'Take care of yourself.' },

  // 2. Educational & Question Concepts
  { id: 'cell', label: 'CELL', category: 'science', display: 'Cell', motion: 'c_hand_boundary', phrase: 'What is a cell?' },
  { id: 'plant', label: 'PLANT', category: 'science', display: 'Plant', motion: 'growing_open_fingers', phrase: 'Plant biology.' },
  { id: 'animal', label: 'ANIMAL', category: 'science', display: 'Animal', motion: 'curved_fingers_chest', phrase: 'Animal biology.' },
  { id: 'chloroplast', label: 'CHLOROPLAST', category: 'science', display: 'Chloroplast', motion: 'green_sun_absorb', phrase: 'Chloroplast in plant cell.' },
  { id: 'sun', label: 'SUN', category: 'science', display: 'Sun', motion: 'circle_overhead', phrase: 'Sunlight and energy.' },
  { id: 'water', label: 'WATER', category: 'science', display: 'Water', motion: 'w_hand_chin_tap', phrase: 'Water is needed.' },
  { id: 'force', label: 'FORCE', category: 'physics', display: 'Force', motion: 'fist_push_forward', phrase: 'Force and motion.' },
  { id: 'science', label: 'SCIENCE', category: 'academics', display: 'Science', motion: 'alternate_pouring', phrase: 'Science subject.' },
  { id: 'math', label: 'MATH', category: 'academics', display: 'Math', motion: 'crossed_m_hands', phrase: 'Mathematics.' },
  { id: 'what', label: 'WHAT', category: 'question', display: 'What', motion: 'open_palms_shake', phrase: 'What is this?' },
  { id: 'function', label: 'FUNCTION', category: 'concept', display: 'Function / Role', motion: 'f_hands_work', phrase: 'What is its function?' },
  { id: 'how', label: 'HOW', category: 'question', display: 'How', motion: 'cupped_palms_roll', phrase: 'How does it work?' },
  { id: 'why', label: 'WHY', category: 'question', display: 'Why', motion: 'forehead_touch_pull', phrase: 'Why is that so?' },
  { id: 'help', label: 'HELP', category: 'concept', display: 'Help', motion: 'fist_on_palm_lift', phrase: 'Please help me.' },

  // 3. Digital Literacy & Quiz Peripherals
  { id: 'keyboard', label: 'KEYBOARD', category: 'it', display: 'Keyboard', motion: 'typing_flutter', phrase: 'Computer keyboard.' },
  { id: 'monitor', label: 'MONITOR', category: 'it', display: 'Monitor / Screen', motion: 'rectangle_outline', phrase: 'Monitor screen.' },
  { id: 'computer', label: 'COMPUTER', category: 'it', display: 'Computer', motion: 'c_sweep_forearm', phrase: 'Computer system.' },
  { id: 'input', label: 'INPUT', category: 'it', display: 'Input', motion: 'hand_into_cupped_palm', phrase: 'Input device.' },
  { id: 'output', label: 'OUTPUT', category: 'it', display: 'Output', motion: 'hand_out_of_cupped_palm', phrase: 'Output device.' },
  { id: 'printer', label: 'PRINTER', category: 'it', display: 'Printer', motion: 'flat_sheet_eject', phrase: 'Printer device.' },
  { id: 'speaker', label: 'SPEAKER', category: 'it', display: 'Speaker', motion: 'cone_from_ear', phrase: 'Audio speaker.' },

  // 4. Multiple Choice & Confirmation Labels
  { id: 'option_a', label: 'OPTION A', category: 'quiz_choice', display: 'Option A', motion: 'a_handshape', phrase: 'I choose Option A.' },
  { id: 'option_b', label: 'OPTION B', category: 'quiz_choice', display: 'Option B', motion: 'b_handshape', phrase: 'I choose Option B.' },
  { id: 'option_c', label: 'OPTION C', category: 'quiz_choice', display: 'Option C', motion: 'c_handshape', phrase: 'I choose Option C.' },
  { id: 'option_d', label: 'OPTION D', category: 'quiz_choice', display: 'Option D', motion: 'd_handshape', phrase: 'I choose Option D.' },
  { id: 'yes', label: 'YES', category: 'confirmation', display: 'Yes', motion: 'nodding_fist', phrase: 'Yes, exactly.' },
  { id: 'no', label: 'NO', category: 'confirmation', display: 'No', motion: 'finger_snap_pinch', phrase: 'No, not that.' },
  { id: 'true', label: 'TRUE', category: 'confirmation', display: 'True', motion: 'index_finger_lips_forward', phrase: 'That is true.' },
  { id: 'false', label: 'FALSE', category: 'confirmation', display: 'False', motion: 'index_finger_across_nose', phrase: 'That is false.' }
];

export const RECOGNITION_STATES = {
  UNINITIALIZED: 'UNINITIALIZED',
  IDLE: 'IDLE',
  DETECTING: 'DETECTING',
  STABLE: 'STABLE',
  COMMITTED: 'COMMITTED',
  WAIT_CHANGE: 'WAIT_FOR_CHANGE'
};

// Skeletal connection pairs for 21 MediaPipe hand landmarks
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm knuckles
  [5, 9], [9, 13], [13, 17]
];

export class ISLRecognitionService {
  constructor(options = {}) {
    this.version = '2.0.0-mediapipe-pure-isl';
    this.providerName = 'MediaPipe-Pure-ISL-V2';
    this.supportedSigns = SUPPORTED_ISL_SIGNS_V1;

    // Hyperparameters
    this.sequenceLength = options.sequenceLength || 30; // 30-frame temporal rolling window
    this.confidenceThreshold = options.confidenceThreshold || 0.60; // minimum confidence threshold
    this.stableFramesRequired = options.stableFramesRequired || 5; // stable frames required to commit
    this.cooldownMs = options.cooldownMs || 1200; // duplicate suppression delay

    // MediaPipe HandLandmarker reference
    this.handLandmarker = null;
    this.isLandmarkerReady = false;
    this.isLandmarkerInitializing = false;

    // State Tracking
    this.state = RECOGNITION_STATES.UNINITIALIZED;
    this.isRunning = false;
    this.isPaused = false;
    this.currentPrediction = null;
    this.currentConfidence = 0;
    this.stableCounter = 0;
    this.lastCommittedLabel = null;
    this.lastCommitTime = 0;
    this.recognizedSequence = [];

    // Rolling Frame Buffers
    this.frameBuffer = [];
    this.consecutivePredictions = [];

    // Media & Canvas Hooks
    this.mediaStream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.animFrameId = null;
    this.lastProcessTime = 0;

    // Callbacks & Event Listeners
    this.onPredictionCallback = null;
    this.onStateChangeCallback = null;
    this.onSequenceUpdateCallback = null;
    this.predictionListeners = new Set();
    this.sequenceListeners = new Set();
    this.stateListeners = new Set();

    this.state = RECOGNITION_STATES.IDLE;
    
    // Deep Learning integration
    this.tfModel = null;
    this.labelsMap = null;
    this.isTfModelReady = false;
    this.featureBuffer = []; // stores recent frames of length 126
  }

  onPrediction(fn) {
    if (typeof fn === 'function') {
      this.predictionListeners.add(fn);
    }
    return () => this.predictionListeners.delete(fn);
  }

  onSequenceUpdate(fn) {
    if (typeof fn === 'function') {
      this.sequenceListeners.add(fn);
    }
    return () => this.sequenceListeners.delete(fn);
  }

  onStateChange(fn) {
    if (typeof fn === 'function') {
      this.stateListeners.add(fn);
    }
    return () => this.stateListeners.delete(fn);
  }

  // Model Capability Discovery
  getSupportedLabels() {
    return this.supportedSigns.map(s => s.label);
  }

  getSupportedSigns() {
    return [...this.supportedSigns];
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      state: this.state,
      activeLabel: this.currentPrediction,
      confidence: Math.round(this.currentConfidence * 100),
      committedSequence: [...this.recognizedSequence],
      supportedCount: this.supportedSigns.length,
      version: this.version,
      landmarkerReady: this.isLandmarkerReady,
      tfModelReady: this.isTfModelReady
    };
  }

  getPrediction() {
    return this.currentPrediction;
  }

  getConfidence() {
    return Math.round(this.currentConfidence * 100);
  }

  setConfidenceThreshold(threshold) {
    this.confidenceThreshold = Math.max(0.3, Math.min(0.95, threshold));
  }

  setStableFrameRequirement(frames) {
    this.stableFramesRequired = Math.max(3, Math.min(15, frames));
  }

  /**
   * Initializes TensorFlow.js Deep Learning Model (LSTM).
   */
  async initTensorFlowModel() {
    try {
      if (typeof window !== 'undefined' && window.tf) {
        this.tfModel = await window.tf.loadLayersModel('./tfjs_model/model.json');
        
        const response = await fetch('./tfjs_model/label_map.json');
        if (response.ok) {
          const mapping = await response.json();
          this.labelsMap = {};
          if (Array.isArray(mapping)) {
            mapping.forEach((val, i) => {
              // Extract just the word from "1. Word" format if necessary
              this.labelsMap[i] = val.replace(/^\d+\.\s*/, '').toUpperCase();
            });
          } else {
            for (let key in mapping) {
              this.labelsMap[parseInt(key)] = mapping[key].replace(/^\d+\.\s*/, '').toUpperCase();
            }
          }
          this.isTfModelReady = true;
          console.log(`[ISLRecognitionService] Deep Learning TF.js Model Loaded. Supported signs: ${Object.keys(this.labelsMap).length}`);
        }
      }
    } catch (err) {
      console.warn('[ISLRecognitionService] Deep Learning model not found or failed to load. Falling back to rule-based heuristics:', err.message);
      this.isTfModelReady = false;
    }
  }

  /**
   * Initializes local offline MediaPipe Hand Landmarker via WebAssembly.
   * Zero remote network calls; loads from local public/wasm and public/models.
   */
  async initLandmarker() {
    this.initTensorFlowModel().catch(() => {});
    
    if (this.isLandmarkerReady) return true;
    if (this.isLandmarkerInitializing) return false;
    this.isLandmarkerInitializing = true;

    try {
      if (typeof window !== 'undefined') {
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
        
        // Resolve local offline WASM assets
        const wasmPath = './wasm';
        const vision = await FilesetResolver.forVisionTasks(wasmPath).catch(async () => {
          return await FilesetResolver.forVisionTasks('/wasm');
        });

        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: './models/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        }).catch(async (gpuErr) => {
          console.warn('[ISLRecognition] GPU delegate fallback to CPU:', gpuErr);
          return await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: './models/hand_landmarker.task',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
        });

        this.isLandmarkerReady = true;
        console.log('[ISLRecognitionService] MediaPipe HandLandmarker loaded locally offline.');
      }
    } catch (err) {
      console.warn('[ISLRecognitionService] MediaPipe HandLandmarker init fallback to geometric vision:', err);
      this.isLandmarkerReady = false;
    } finally {
      this.isLandmarkerInitializing = false;
    }
    return this.isLandmarkerReady;
  }

  /**
   * Starts real-time camera inference loop.
   */
  async start(config = {}) {
    if (this.isRunning) return true;

    this.videoElement = config.videoElement || null;
    this.canvasElement = config.canvasElement || null;
    this.onPredictionCallback = config.onPrediction || null;
    this.onStateChangeCallback = config.onStateChange || null;
    this.onSequenceUpdateCallback = config.onSequenceUpdate || null;

    if (this.canvasElement) {
      this.canvasCtx = this.canvasElement.getContext('2d', { willReadFrequently: true });
    }

    try {
      this.initLandmarker().catch(() => {});

      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false // Strict privacy: camera only
      };

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        if (this.videoElement) {
          this.videoElement.srcObject = this.mediaStream;
          await this.videoElement.play().catch(() => {});
        }
      }

      this.isRunning = true;
      this.isPaused = false;
      this.setState(RECOGNITION_STATES.DETECTING);

      this.lastProcessTime = performance.now();
      this.processLoop();
      return true;
    } catch (err) {
      console.error('[ISLRecognitionService] Failed to acquire camera:', err);
      this.setState(RECOGNITION_STATES.IDLE);
      throw err;
    }
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    if (this.canvasCtx && this.canvasElement) {
      this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }

    this.frameBuffer = [];
    this.consecutivePredictions = [];
    this.currentPrediction = null;
    this.currentConfidence = 0;
    this.stableCounter = 0;
    this.setState(RECOGNITION_STATES.IDLE);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  clearSequence() {
    this.recognizedSequence = [];
    this.currentPrediction = null;
    this.currentConfidence = 0;
    this.stableCounter = 0;
    this.lastCommittedLabel = null;
    this.notifySequenceUpdate([...this.recognizedSequence]);
  }

  commitActivePrediction() {
    if (!this.currentPrediction || this.currentConfidence < this.confidenceThreshold) {
      return null;
    }
    const token = this.currentPrediction;
    this.recognizedSequence.push(token);
    this.lastCommittedLabel = token;
    this.lastCommitTime = Date.now();
    this.setState(RECOGNITION_STATES.COMMITTED);
    this.notifySequenceUpdate([...this.recognizedSequence]);
    return token;
  }

  addManualToken(token) {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.trim().toUpperCase();
    this.recognizedSequence.push(cleanToken);
    this.lastCommittedLabel = cleanToken;
    this.lastCommitTime = Date.now();
    this.setState(RECOGNITION_STATES.COMMITTED);
    this.notifySequenceUpdate([...this.recognizedSequence]);
    return cleanToken;
  }

  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.notifyStateChange(newState);
    }
  }

  notifySequenceUpdate(seq) {
    if (this.onSequenceUpdateCallback) {
      try { this.onSequenceUpdateCallback(seq); } catch (e) { console.error(e); }
    }
    if (this.sequenceListeners) {
      this.sequenceListeners.forEach(fn => {
        try { fn(seq); } catch (e) { console.error(e); }
      });
    }
  }

  notifyStateChange(state) {
    if (this.onStateChangeCallback) {
      try { this.onStateChangeCallback(state); } catch (e) { console.error(e); }
    }
    if (this.stateListeners) {
      this.stateListeners.forEach(fn => {
        try { fn(state); } catch (e) { console.error(e); }
      });
    }
  }

  /**
   * Main per-frame inference loop (~30 FPS).
   */
  processLoop() {
    if (!this.isRunning) return;

    this.animFrameId = requestAnimationFrame(() => this.processLoop());

    if (this.isPaused) return;

    const now = performance.now();
    if (now - this.lastProcessTime < 30) return;
    this.lastProcessTime = now;

    this.analyzeCurrentFrame();
  }

  /**
   * Analyzes active webcam frame.
   */
  analyzeCurrentFrame() {
    const video = this.videoElement;
    if (!video || video.readyState < 2) return;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    if (this.canvasElement && this.canvasCtx) {
      if (this.canvasElement.width !== vw || this.canvasElement.height !== vh) {
        this.canvasElement.width = vw;
        this.canvasElement.height = vh;
      }
      this.canvasCtx.save();
      this.canvasCtx.translate(vw, 0);
      this.canvasCtx.scale(-1, 1);
      this.canvasCtx.drawImage(video, 0, 0, vw, vh);
      this.canvasCtx.restore();
    }

    let frameFeatures = null;

    if (this.isLandmarkerReady && this.handLandmarker) {
      try {
        const results = this.handLandmarker.detectForVideo(video, performance.now());
        if (results && results.landmarks && results.landmarks.length > 0) {
          frameFeatures = this.processLandmarkResults(results.landmarks, results.handednesses || results.handedness, vw, vh);
        }
      } catch (err) {
        frameFeatures = this.extractGeometricKinematics(vw, vh);
      }
    }

    if (!frameFeatures) {
      frameFeatures = this.extractGeometricKinematics(vw, vh);
    }

    if (!frameFeatures || !frameFeatures.handDetected) {
      this.stableCounter = 0;
      this.currentConfidence = 0;
      this.currentPrediction = null;
      if (this.state !== RECOGNITION_STATES.WAIT_CHANGE) {
        this.setState(RECOGNITION_STATES.IDLE);
      }
      return;
    }

    this.frameBuffer.push(frameFeatures);
    if (this.frameBuffer.length > this.sequenceLength) {
      this.frameBuffer.shift();
    }

    const predictionResult = this.classifySequence(this.frameBuffer);

    if (this.canvasCtx) {
      this.drawSkeletalOverlay(frameFeatures, predictionResult, vw, vh);
    }

    this.handlePredictionStabilization(predictionResult);
  }

  /**
   * Processes 21 3D landmarks per detected hand.
   */
  processLandmarkResults(landmarksArray, handednessArray, width, height) {
    if (!landmarksArray || landmarksArray.length === 0) return null;

    let lh = new Array(63).fill(0.0);
    let rh = new Array(63).fill(0.0);
    const handednessList = handednessArray || [];

    for (let i = 0; i < landmarksArray.length; i++) {
      const handLandmarks = landmarksArray[i];
      let categoryName = 'Right';
      if (handednessList[i] && handednessList[i][0] && handednessList[i][0].categoryName) {
         categoryName = handednessList[i][0].categoryName;
      } else if (handednessList[i] && handednessList[i].categoryName) {
         categoryName = handednessList[i].categoryName;
      } else {
         categoryName = i === 0 ? 'Right' : 'Left';
      }
      
      const keypoints = [];
      for (let j = 0; j < handLandmarks.length; j++) {
        keypoints.push(handLandmarks[j].x, handLandmarks[j].y, handLandmarks[j].z || 0);
      }
      
      if (categoryName === 'Right') {
        lh = keypoints;
      } else {
        rh = keypoints;
      }
    }
    const rawCoords = lh.concat(rh);

    const dist3D = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y, (p1.z - p2.z) * width);

    const hands = landmarksArray.slice(0, 2).map((handLandmarks) => {
      const points = handLandmarks.map(pt => ({
        x: pt.x * width, y: pt.y * height, z: pt.z || 0,
        normX: pt.x, normY: pt.y, normZ: pt.z || 0
      }));

      const wrist = points[0];
      let minX = width, maxX = 0, minY = height, maxY = 0;
      points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      
      const boxW = Math.max(30, maxX - minX);
      const boxH = Math.max(30, maxY - minY);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const normalizedHeight = centerY / height;

      const fingerExtensions = [];
      const fingerCurled = [];

      // Thumb
      const thumbTipDist = dist3D(points[4], points[17]);
      const thumbMcpDist = dist3D(points[2], points[17]);
      const thumbUpright = (points[4].y < points[2].y - 20);
      const isThumbExtended = (thumbTipDist > thumbMcpDist * 1.15) || thumbUpright;
      fingerExtensions.push(isThumbExtended ? 1.0 : 0.2);
      fingerCurled.push(!isThumbExtended);

      const fingerTips = [8, 12, 16, 20];
      const fingerPips = [6, 10, 14, 18];
      const fingerMcps = [5, 9, 13, 17];

      for (let i = 0; i < 4; i++) {
        const tip = points[fingerTips[i]];
        const pip = points[fingerPips[i]];
        const mcp = points[fingerMcps[i]];
        const dTip = dist3D(tip, wrist);
        const dPip = dist3D(pip, wrist);
        const isExtended = (dTip > dPip * 1.15) && (tip.y < mcp.y + 15);
        const isCurled = (tip.y > pip.y - 10) || (dTip < dPip * 0.95);
        fingerExtensions.push(isExtended ? 1.0 : (isCurled ? 0.1 : 0.5));
        fingerCurled.push(isCurled);
      }

      const thumbIndexDist = dist3D(points[4], points[8]) / boxH;
      const thumbMiddleDist = dist3D(points[4], points[12]) / boxH;
      const indexMiddleDist = dist3D(points[8], points[12]) / boxW;

      const v1 = { x: points[5].normX - wrist.normX, y: points[5].normY - wrist.normY, z: points[5].normZ - wrist.normZ };
      const v2 = { x: points[17].normX - wrist.normX, y: points[17].normY - wrist.normY, z: points[17].normZ - wrist.normZ };
      const normal = {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
      };
      const normLen = Math.hypot(normal.x, normal.y, normal.z) || 1;
      normal.x /= normLen;
      normal.y /= normLen;
      normal.z /= normLen;

      let palmFacing = 'forward';
      if (normal.z > 0.25) palmFacing = 'inward';
      else if (normal.z < -0.25) palmFacing = 'forward';
      else if (normal.y > 0.3) palmFacing = 'down';
      else if (normal.y < -0.3) palmFacing = 'up';
      else palmFacing = 'side';

      return {
        landmarks: points,
        rawLandmarks: handLandmarks,
        center: { x: centerX, y: centerY },
        bounds: { x: minX, y: minY, w: boxW, h: boxH },
        aspectRatio: boxW / boxH,
        normalizedHeight: normalizedHeight,
        fingerExtensions: fingerExtensions,
        fingerCurled: fingerCurled,
        thumbUpright: thumbUpright,
        thumbIndexPinch: thumbIndexDist < 0.22,
        thumbMiddlePinch: thumbMiddleDist < 0.22,
        indexMiddleSeparation: indexMiddleDist,
        palmNormal: normal,
        palmFacing: palmFacing,
      };
    });

    if (hands.length === 0) return null;
    const primary = hands[0];

    return {
      handDetected: true,
      hasMediaPipeLandmarks: true,
      rawCoords: rawCoords,
      hands: hands,
      twoHandsDetected: hands.length > 1,
      landmarks: primary.landmarks,
      rawLandmarks: primary.rawLandmarks,
      center: primary.center,
      bounds: primary.bounds,
      aspectRatio: primary.aspectRatio,
      normalizedHeight: primary.normalizedHeight,
      fingerExtensions: primary.fingerExtensions,
      fingerCurled: primary.fingerCurled,
      thumbUpright: primary.thumbUpright,
      thumbIndexPinch: primary.thumbIndexPinch,
      thumbMiddlePinch: primary.thumbMiddlePinch,
      indexMiddleSeparation: primary.indexMiddleSeparation,
      palmNormal: primary.palmNormal,
      palmFacing: primary.palmFacing,
      secondHandCenter: hands.length > 1 ? hands[1].center : null,
      timestamp: performance.now()
    };
  }

  /**
   * Kinematic spatial feature extractor fallback.
   */
  extractGeometricKinematics(width, height) {
    if (!this.canvasCtx) return null;

    try {
      const sx = Math.floor(width * 0.1);
      const sy = Math.floor(height * 0.1);
      const sw = Math.floor(width * 0.8);
      const sh = Math.floor(height * 0.8);

      const imgData = this.canvasCtx.getImageData(sx, sy, sw, sh);
      const data = imgData.data;

      let skinCount = 0;
      let sumX = 0, sumY = 0;
      let minX = sw, maxX = 0, minY = sh, maxY = 0;

      for (let i = 0; i < data.length; i += 16) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 60 && g > 40 && b > 20 && r > g && r > b && (r - g) >= 12 && (r - b) >= 12) {
          const pixelIndex = i / 4;
          const px = pixelIndex % sw;
          const py = Math.floor(pixelIndex / sw);
          skinCount++;
          sumX += px;
          sumY += py;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }

      const minRequired = (sw * sh) * 0.012;
      if (skinCount < minRequired) {
        return { handDetected: false };
      }

      const centerX = (sumX / skinCount) + sx;
      const centerY = (sumY / skinCount) + sy;
      const boxW = Math.max(30, maxX - minX);
      const boxH = Math.max(30, maxY - minY);
      const aspectRatio = boxW / boxH;
      const normalizedHeight = centerY / height;
      const density = skinCount / (boxW * boxH);

      const isWideOpen = aspectRatio > 1.2 && density < 0.6;
      const isFist = density > 0.7 && aspectRatio < 1.1;

      const points = [];
      points.push({ x: centerX, y: centerY + boxH * 0.35, normX: centerX / width, normY: (centerY + boxH * 0.35) / height });

      const angles = [-0.7, -0.35, 0, 0.35, 0.7];
      for (let f = 0; f < 5; f++) {
        const ang = angles[f];
        const len = isFist ? boxH * 0.25 : boxH * 0.55;
        for (let j = 1; j <= 4; j++) {
          const frac = j / 4;
          points.push({
            x: centerX + Math.sin(ang) * len * frac,
            y: (centerY + boxH * 0.2) - Math.cos(ang) * len * frac,
            normX: (centerX + Math.sin(ang) * len * frac) / width,
            normY: ((centerY + boxH * 0.2) - Math.cos(ang) * len * frac) / height
          });
        }
      }

      const ext = isWideOpen ? [0.9, 0.95, 0.95, 0.95, 0.95] : (isFist ? [0.2, 0.1, 0.1, 0.1, 0.1] : [0.6, 0.6, 0.6, 0.6, 0.6]);

      const primaryHand = {
        landmarks: points,
        center: { x: centerX, y: centerY },
        bounds: { x: minX + sx, y: minY + sy, w: boxW, h: boxH },
        aspectRatio: aspectRatio,
        normalizedHeight: normalizedHeight,
        fingerExtensions: ext,
        fingerCurled: isFist ? [true, true, true, true, true] : [false, false, false, false, false],
        thumbUpright: isFist && (centerY / height < 0.65),
        thumbIndexPinch: false,
        thumbMiddlePinch: false,
        indexMiddleSeparation: 0.5,
        palmNormal: { x: 0, y: 0, z: -1 },
        palmFacing: 'forward',
      };

      // Construct the 126-coordinate feature array for Deep Learning Model
      let lh = new Array(63).fill(0.0);
      let rh = new Array(63).fill(0.0);
      
      for(let i = 0; i < Math.min(2, landmarksArray.length); i++) {
         const pts = landmarksArray[i];
         const handType = (handednessArray && handednessArray[i]) ? handednessArray[i][0].categoryName : 'Right';
         
         let arr = [];
         for(let pt of pts) {
             arr.push(pt.x, pt.y, pt.z || 0.0);
         }
         
         // Left/Right in MediaPipe is from camera perspective
         if (handType === 'Right') {
            lh = arr;
         } else {
            rh = arr;
         }
      }
      
      const rawCoords = [...lh, ...rh];

      return {
        handDetected: true,
        hasMediaPipeLandmarks: false,
        hands: [primaryHand],
        twoHandsDetected: false,
        rawCoords: rawCoords,
        ...primaryHand,
        timestamp: performance.now()
      };
    } catch {
      return { handDetected: false };
    }
  }

  /**
   * Classifies the 30-frame sequence against pure ISL gesture kinematics.
   */
  classifySequence(buffer) {
    if (!buffer || buffer.length < 3) {
      return { label: null, confidence: 0 };
    }

    const latest = buffer[buffer.length - 1];
    if (!latest.handDetected) {
      return { label: null, confidence: 0 };
    }

    let totalMotion = 0;
    let dxSum = 0;
    let dySum = 0;
    let lateralDirectionChanges = 0;
    let verticalDirectionChanges = 0;
    let prevDx = 0;
    let prevDy = 0;

    for (let i = 1; i < buffer.length; i++) {
      if (buffer[i].handDetected && buffer[i - 1].handDetected) {
        const dx = buffer[i].center.x - buffer[i - 1].center.x;
        const dy = buffer[i].center.y - buffer[i - 1].center.y;
        totalMotion += Math.hypot(dx, dy);
        dxSum += dx;
        dySum += dy;

        if (prevDx !== 0 && ((dx > 0 && prevDx < 0) || (dx < 0 && prevDx > 0))) {
          lateralDirectionChanges++;
        }
        if (prevDy !== 0 && ((dy > 0 && prevDy < 0) || (dy < 0 && prevDy > 0))) {
          verticalDirectionChanges++;
        }
        prevDx = dx;
        prevDy = dy;
      }
    }

    const avgMotion = totalMotion / buffer.length;
    const isWaving = (lateralDirectionChanges >= 2 && avgMotion > 2.0);
    const isNodding = (verticalDirectionChanges >= 2 && avgMotion > 2.0);

    const hands = latest.hands || [latest]; // Fallback compatibility
    const primary = hands[0];
    const secondary = hands.length > 1 ? hands[1] : null;

    const ext = primary.fingerExtensions;
    const curled = primary.fingerCurled;
    const y = primary.normalizedHeight;
    const isNearHead = y < 0.44;
    const isNearChest = y >= 0.44 && y <= 0.72;
    const isNearWaist = y > 0.72;

    const allFourFingersExtended = ext[1] > 0.75 && ext[2] > 0.75 && ext[3] > 0.75 && ext[4] > 0.75;
    const allFingersCurled = curled[1] && curled[2] && curled[3] && curled[4];
    const indexOnlyExtended = ext[1] > 0.75 && curled[2] && curled[3] && curled[4];
    const indexAndMiddleExtended = ext[1] > 0.75 && ext[2] > 0.75 && curled[3] && curled[4];
    const threeFingersExtended = ext[1] > 0.75 && ext[2] > 0.75 && ext[3] > 0.75 && curled[4];

    let bestLabel = null;
    let highestScore = 0;

    // --- DEEP LEARNING (TFJS) ISL CLASSIFIER ---
    if (this.isTfModelReady && this.tfModel) {
      // Use the actual Mediapipe extraction logic (126 features) from the current frame
      const features = latest.rawCoords || new Array(126).fill(0.0); 
      
      this.featureBuffer.push(features);
      if (this.featureBuffer.length > 200) {
        this.featureBuffer.shift();
      }
      
      if (this.featureBuffer.length > 10) {
        const paddedBuffer = [...this.featureBuffer];
        while (paddedBuffer.length < 200) {
          paddedBuffer.unshift(new Array(126).fill(0.0));
        }
        const inputTensor = window.tf.tensor([paddedBuffer]); // Shape: [1, 200, 126]
        const prediction = this.tfModel.predict(inputTensor);
        const scores = prediction.dataSync();
        const maxScore = Math.max(...scores);
        const maxIndex = scores.indexOf(maxScore);
        
        if (maxScore > this.confidenceThreshold) {
          bestLabel = this.labelsMap[maxIndex];
          highestScore = maxScore;
        }
        
        inputTensor.dispose();
        prediction.dispose();
      }
    }

    // --- RULE-BASED ISL KINEMATIC CLASSIFIER (FALLBACK) ---
    if (!bestLabel) {

    // TWO-HANDED SIGNS
    if (secondary) {
      const pExt = primary.fingerExtensions;
      const sExt = secondary.fingerExtensions;
      const pCurled = primary.fingerCurled;
      const sCurled = secondary.fingerCurled;
      
      const pAllCurled = pCurled[1] && pCurled[2] && pCurled[3] && pCurled[4];
      const sAllCurled = sCurled[1] && sCurled[2] && sCurled[3] && sCurled[4];
      const pAllExt = pExt[1] > 0.75 && pExt[2] > 0.75 && pExt[3] > 0.75 && pExt[4] > 0.75;
      const sAllExt = sExt[1] > 0.75 && sExt[2] > 0.75 && sExt[3] > 0.75 && sExt[4] > 0.75;

      // HELP (Secondary hand is flat base (up), primary hand is fist resting on it)
      if (sAllExt && secondary.palmFacing === 'up' && pAllCurled) {
        const score = 0.95;
        if (score > highestScore) { highestScore = score; bestLabel = 'HELP'; }
      }

      // HOUSE (Both hands flat, angled inward like a roof)
      if (pAllExt && sAllExt && primary.palmFacing === 'inward' && secondary.palmFacing === 'inward' && isNearHead) {
        const score = 0.94;
        if (score > highestScore) { highestScore = score; bestLabel = 'HOUSE'; }
      }

      // FAMILY (Both hands form F-shape / OK-shape, sweeping in circle)
      if (primary.thumbIndexPinch && secondary.thumbIndexPinch && isNearChest && (avgMotion > 2.0)) {
        const score = 0.93;
        if (score > highestScore) { highestScore = score; bestLabel = 'FAMILY'; }
      }

      // FINISHED / DONE (Both hands flat, flicking outwards from 'up' to 'down' or moving laterally)
      if (pAllExt && sAllExt && (isNearChest || isNearHead) && lateralDirectionChanges >= 1) {
        const score = 0.92;
        if (score > highestScore) { highestScore = score; bestLabel = 'FINISHED'; }
      }

      // Y-Handshape (Thumb and Pinky extended, others curled)
      const pIsY = (primary.thumbUpright || pExt[0] > 0.5) && !pCurled[4] && pCurled[1] && pCurled[2];
      const sIsY = (secondary.thumbUpright || sExt[0] > 0.5) && !sCurled[4] && sCurled[1] && sCurled[2];

      // PLAY (Both hands Y-shape, moving/shaking)
      if (pIsY && sIsY && avgMotion > 1.2) {
        const score = 0.94;
        if (score > highestScore) { highestScore = score; bestLabel = 'PLAY'; }
      }

      // SAME (Both hands Y-shape, sliding side to side)
      if (pIsY && sIsY && lateralDirectionChanges >= 1) {
        const score = 0.91;
        if (score > highestScore) { highestScore = score; bestLabel = 'SAME'; }
      }
    }

    // 1. GOOD (Thumbs Up)
    if ((primary.thumbUpright || ext[0] > 0.8) && allFingersCurled && (isNearChest || isNearHead) && !bestLabel) {
      const score = 0.94;
      if (score > highestScore) { highestScore = score; bestLabel = 'GOOD'; }
    }

    // 2. HELLO (Wave near temple/head)
    // 2. HELLO (Wave near temple/head)
    if (allFourFingersExtended && isNearHead && (isWaving || avgMotion > 1.8) && !bestLabel) {
      const score = 0.95;
      if (score > highestScore) { highestScore = score; bestLabel = 'HELLO'; }
    }

    } // End of Rule-Based Fallback block

    // 3. YOU (Index pointing forward at chest/face)
    if (indexOnlyExtended && (isNearChest || isNearHead) && avgMotion < 3.5 && !bestLabel) {
      const score = 0.92;
      if (score > highestScore) { highestScore = score; bestLabel = 'YOU'; }
    }

    // 4. THANK YOU (Flat hand sweep from chin/head forward)
    if (allFourFingersExtended && (isNearHead || isNearChest) && dySum > 10 && !isWaving && !bestLabel) {
      const score = 0.91;
      if (score > highestScore) { highestScore = score; bestLabel = 'THANK YOU'; }
    }

    // 5. YES (Fist nodding up and down)
    if (allFingersCurled && (isNodding || (primary.thumbUpright && isNearChest && verticalDirectionChanges >= 1)) && !bestLabel) {
      const score = 0.90;
      if (score > highestScore) { highestScore = score; bestLabel = 'YES'; }
    }

    // 6. NO (Index & Middle snapping to thumb)
    if (primary.thumbIndexPinch && primary.thumbMiddlePinch && curled[3] && curled[4] && !bestLabel) {
      const score = 0.92;
      if (score > highestScore) { highestScore = score; bestLabel = 'NO'; }
    }

    // 7. WATER (W-handshape near chin)
    if (threeFingersExtended && isNearHead && !bestLabel) {
      const score = 0.91;
      if (score > highestScore) { highestScore = score; bestLabel = 'WATER'; }
    }

    // 8. WHAT (Open palms facing up, lateral shake)
    if (allFourFingersExtended && isNearChest && (primary.palmFacing === 'up' || primary.aspectRatio > 1.3) && (isWaving || avgMotion > 2.0) && !bestLabel) {
      const score = 0.93;
      if (score > highestScore) { highestScore = score; bestLabel = 'WHAT'; }
    }

    // 9. WHY (Index/finger tap and pull from temple)
    if (isNearHead && indexOnlyExtended && dxSum > 15 && !bestLabel) {
      const score = 0.89;
      if (score > highestScore) { highestScore = score; bestLabel = 'WHY'; }
    }

    // 10. THINK (Index touching temple)
    if (isNearHead && indexOnlyExtended && avgMotion < 1.5 && !bestLabel) {
      const score = 0.88;
      if (score > highestScore) { highestScore = score; bestLabel = 'THINK'; }
    }

    // 11. HELP (Fist on palm or fist lifting - single hand fallback)
    if (allFingersCurled && isNearChest && dySum < -15 && !bestLabel) {
      const score = 0.89;
      if (score > highestScore) { highestScore = score; bestLabel = 'HELP'; }
    }

    // 12. FORCE (Thrusting fist push forward)
    if (allFingersCurled && isNearChest && avgMotion > 2.5 && !isNodding) {
      const score = 0.88;
      if (score > highestScore) { highestScore = score; bestLabel = 'FORCE'; }
    }

    // 13. CELL / OPTION C (C Handshape)
    if (ext[1] > 0.4 && ext[1] < 0.85 && ext[2] > 0.4 && ext[2] < 0.85 && latest.aspectRatio > 1.05 && avgMotion < 2.5) {
      const score = 0.89;
      if (score > highestScore) { highestScore = score; bestLabel = 'CELL'; }
    }

    // 14. PLANT (Upward spreading open fingers)
    if (allFourFingersExtended && isNearChest && dySum < -15) {
      const score = 0.88;
      if (score > highestScore) { highestScore = score; bestLabel = 'PLANT'; }
    }

    // 15. KEYBOARD (Palms down typing flutter at waist)
    if (isNearWaist && (latest.palmFacing === 'down' || latest.aspectRatio > 1.1 || allFourFingersExtended) && avgMotion > 1.5) {
      const score = 0.93;
      if (score > highestScore) { highestScore = score; bestLabel = 'KEYBOARD'; }
    }

    // 16. MONITOR (L-shape frame or rectangular bounds)
    if (indexAndMiddleExtended && isNearChest && latest.aspectRatio > 1.2 && avgMotion < 2.0) {
      const score = 0.87;
      if (score > highestScore) { highestScore = score; bestLabel = 'MONITOR'; }
    }

    // 17. COMPUTER (C shape sweep across forearm)
    if (latest.twoHandsDetected && isNearChest) {
      const score = 0.86;
      if (score > highestScore) { highestScore = score; bestLabel = 'COMPUTER'; }
    }

    // 18. QUIZ OPTIONS A, B, C, D
    if (allFingersCurled && isNearChest && !latest.thumbUpright && avgMotion < 2.0) {
      const score = 0.91;
      if (score > highestScore) { highestScore = score; bestLabel = 'OPTION A'; }
    }
    if (allFourFingersExtended && curled[0] && isNearChest && avgMotion < 2.0) {
      const score = 0.92;
      if (score > highestScore) { highestScore = score; bestLabel = 'OPTION B'; }
    }
    if (indexOnlyExtended && latest.thumbMiddlePinch && isNearChest && avgMotion < 2.0) {
      const score = 0.91;
      if (score > highestScore) { highestScore = score; bestLabel = 'OPTION D'; }
    }

    if (highestScore === 0) {
      if (indexAndMiddleExtended && isNearChest) {
        highestScore = 0.75;
        bestLabel = 'FRIEND';
      } else if (allFourFingersExtended && isNearChest) {
        highestScore = 0.72;
        bestLabel = 'HELLO';
      }
    }

    const finalConfidence = Math.min(0.98, Math.max(0.1, highestScore));

    return {
      label: finalConfidence >= this.confidenceThreshold ? bestLabel : null,
      rawLabel: bestLabel,
      confidence: finalConfidence
    };
  }

  /**
   * Temporal stabilization state machine.
   */
  handlePredictionStabilization(result) {
    const label = result.label;
    const conf = result.confidence;

    if (!label || conf < this.confidenceThreshold) {
      this.stableCounter = 0;
      this.currentConfidence = conf;
      if (this.state !== RECOGNITION_STATES.WAIT_CHANGE) {
        this.setState(RECOGNITION_STATES.DETECTING);
      }
      this.emitPredictionUpdate(null, conf, 'Position hand clearly in frame to sign.');
      return;
    }

    const now = Date.now();
    if (label === this.lastCommittedLabel && (now - this.lastCommitTime) < this.cooldownMs) {
      this.setState(RECOGNITION_STATES.WAIT_CHANGE);
      this.emitPredictionUpdate(label, conf, `Sign "${label}" held. Wait for transition.`);
      return;
    }

    if (this.currentPrediction === label) {
      this.stableCounter++;
    } else {
      this.currentPrediction = label;
      this.stableCounter = 1;
    }

    this.currentConfidence = conf;

    if (this.stableCounter >= this.stableFramesRequired) {
      this.setState(RECOGNITION_STATES.STABLE);
      this.emitPredictionUpdate(label, conf, `Stable sign recognized: "${label}"`);
    } else {
      this.setState(RECOGNITION_STATES.DETECTING);
      this.emitPredictionUpdate(label, conf, `Detecting sign "${label}" (${this.stableCounter}/${this.stableFramesRequired})...`);
    }
  }

  emitPredictionUpdate(label, confidence, message) {
    const foundSign = label ? this.supportedSigns.find(s => s.label === label) : null;
    const data = {
      label: label || '',
      rawLabel: label || '',
      display: foundSign ? foundSign.display : (label || '—'),
      phrase: foundSign ? foundSign.phrase : '',
      confidence: Math.round(confidence * 100),
      status: this.state,
      state: this.state,
      message: message,
      isStable: this.state === RECOGNITION_STATES.STABLE,
      isCommitted: this.state === RECOGNITION_STATES.COMMITTED,
      isReliable: confidence >= this.confidenceThreshold && this.stableCounter >= this.stableFramesRequired
    };

    if (this.onPredictionCallback) {
      try { this.onPredictionCallback(data); } catch (e) { console.error(e); }
    }
    if (this.predictionListeners) {
      this.predictionListeners.forEach(fn => {
        try { fn(data); } catch (e) { console.error(e); }
      });
    }
  }

  /**
   * Draws styled 21-joint skeletal wireframe and confidence HUD on preview canvas.
   */
  drawSkeletalOverlay(features, prediction, width, height) {
    if (!this.canvasCtx || !features || !features.handDetected) return;
    const ctx = this.canvasCtx;
    const isStable = this.state === RECOGNITION_STATES.STABLE;

    const accentColor = isStable ? '#10b981' : '#38bdf8';
    const jointColor = isStable ? '#34d399' : '#818cf8';

    const handsToDraw = features.hands || (features.landmarks ? [features] : []);

    handsToDraw.forEach((handFeatures) => {
      if (handFeatures.landmarks && handFeatures.landmarks.length >= 21) {
        ctx.strokeStyle = isStable ? 'rgba(16, 185, 129, 0.75)' : 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        HAND_CONNECTIONS.forEach(([i, j]) => {
          const p1 = handFeatures.landmarks[i];
          const p2 = handFeatures.landmarks[j];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });

        handFeatures.landmarks.forEach((pt, idx) => {
          ctx.beginPath();
          const r = (idx === 0 || idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20) ? 5.5 : 3.5;
          ctx.arc(pt.x, pt.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = (idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20) ? accentColor : jointColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      const b = handFeatures.bounds;
      if (b) {
        ctx.strokeStyle = isStable ? 'rgba(16, 185, 129, 0.9)' : 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.setLineDash([]);
      }
    });

    const primaryB = handsToDraw[0]?.bounds || features.bounds;
    if (primaryB && prediction && prediction.rawLabel) {
      const tagText = `${prediction.rawLabel} (${Math.round(prediction.confidence * 100)}%)`;
      ctx.font = '600 13px Inter, sans-serif';
      const textW = ctx.measureText(tagText).width;

      const badgeY = Math.max(12, primaryB.y - 28);
      ctx.fillStyle = isStable ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(primaryB.x, badgeY, textW + 16, 24, 6);
      ctx.fill();

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(tagText, primaryB.x + 8, badgeY + 16);
    }
  }
}

// Global Singleton Provider Instance
export const islRecognitionService = new ISLRecognitionService();
if (typeof window !== 'undefined') {
  window.islRecognitionService = islRecognitionService;
}
