/**
 * ============================================================================
 * Voice 2 Sense — Pure ISL Recognition Service Test Suite
 * Validates 21-joint 3D kinematic landmark calculations, gesture classification,
 * temporal state machine, and offline compatibility.
 * ============================================================================
 */

import { ISLRecognitionService, SUPPORTED_ISL_SIGNS_V1, RECOGNITION_STATES } from './src/islRecognitionService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('Voice 2 Sense — Pure ISL Landmark Recognition Test Suite');
console.log('======================================================================\n');

// 1. Service Initialization & Capability Discovery
console.log('--- 1. Service Capability Discovery ---');
const service = new ISLRecognitionService();
assert(service.version.includes('2.0.0'), 'Service version is 2.0.0 pure ISL');
assert(service.supportedSigns.length >= 30, `Supported verifiable signs count is ${service.supportedSigns.length} (>= 30)`);
assert(service.state === RECOGNITION_STATES.IDLE, 'Initial service state is IDLE');
const labels = service.getSupportedLabels();
assert(labels.includes('HELLO') && labels.includes('GOOD') && labels.includes('THANK YOU') && labels.includes('WATER'), 'Contains core conversational signs');
assert(labels.includes('CELL') && labels.includes('KEYBOARD') && labels.includes('OPTION A'), 'Contains educational & quiz signs');

// Helper: Generate simulated 21-landmark array
function createLandmarks(fingerStates = [false, false, false, false, false], centerY = 0.5, motion = 0) {
  // 0: Wrist at bottom
  const wrist = { x: 0.5, y: centerY + 0.15, z: 0 };
  const landmarks = [wrist];

  // 1-4: Thumb
  const isThumbUp = fingerStates[0];
  landmarks.push({ x: 0.45, y: centerY + 0.10, z: 0 }); // 1 CMC
  landmarks.push({ x: 0.42, y: centerY + 0.06, z: 0 }); // 2 MCP
  landmarks.push({ x: 0.40, y: isThumbUp ? centerY - 0.02 : centerY + 0.04, z: 0 }); // 3 IP
  landmarks.push({ x: 0.38, y: isThumbUp ? centerY - 0.08 : centerY + 0.04, z: 0 }); // 4 TIP

  // 5-20: Index, Middle, Ring, Pinky
  const xs = [0.46, 0.50, 0.54, 0.58];
  for (let f = 0; f < 4; f++) {
    const isExt = fingerStates[f + 1];
    const x = xs[f];
    landmarks.push({ x: x, y: centerY + 0.05, z: 0 }); // MCP
    landmarks.push({ x: x, y: centerY + 0.00, z: 0 }); // PIP
    landmarks.push({ x: x, y: isExt ? centerY - 0.06 : centerY + 0.02, z: 0 }); // DIP
    landmarks.push({ x: x, y: isExt ? centerY - 0.12 : centerY + 0.04, z: 0 }); // TIP
  }

  return landmarks;
}

// 2. Classifying Pure ISL Gestures
console.log('\n--- 2. Classifying Pure ISL Kinematic Gestures ---');

// Test A: GOOD (Thumbs Up at chest level)
const thumbsUpLandmarks = createLandmarks([true, false, false, false, false], 0.55);
const featuresThumbsUp = service.processLandmarkResults([thumbsUpLandmarks], 640, 480);
assert(featuresThumbsUp.handDetected, 'Hand detected for Thumbs Up');
assert(featuresThumbsUp.thumbUpright, 'Thumb is detected as upright');
assert(featuresThumbsUp.fingerCurled[1] && featuresThumbsUp.fingerCurled[2], 'Other fingers are curled');
const resGood = service.classifySequence([featuresThumbsUp, featuresThumbsUp, featuresThumbsUp]);
assert(resGood.rawLabel === 'GOOD', `Recognized gesture is GOOD (got ${resGood.rawLabel})`);
assert(resGood.confidence >= 0.85, `High confidence for GOOD (${Math.round(resGood.confidence * 100)}%)`);

// Test B: HELLO (Open 5 fingers at head level with wave)
const hello1 = createLandmarks([true, true, true, true, true], 0.35);
const hello2 = createLandmarks([true, true, true, true, true], 0.35);
hello2.forEach(p => p.x += 0.05); // lateral wave displacement
const hello3 = createLandmarks([true, true, true, true, true], 0.35);
hello3.forEach(p => p.x -= 0.05);

const fH1 = service.processLandmarkResults([hello1], 640, 480);
const fH2 = service.processLandmarkResults([hello2], 640, 480);
const fH3 = service.processLandmarkResults([hello3], 640, 480);
const resHello = service.classifySequence([fH1, fH2, fH3]);
assert(resHello.rawLabel === 'HELLO', `Recognized gesture is HELLO (got ${resHello.rawLabel})`);
assert(resHello.confidence >= 0.85, `High confidence for HELLO (${Math.round(resHello.confidence * 100)}%)`);

// Test C: YOU (Index pointing forward)
const youLandmarks = createLandmarks([false, true, false, false, false], 0.52);
const fYou = service.processLandmarkResults([youLandmarks], 640, 480);
assert(fYou.fingerExtensions[1] > 0.75, 'Index finger extended');
assert(fYou.fingerCurled[2] && fYou.fingerCurled[3] && fYou.fingerCurled[4], 'Middle, Ring, Pinky curled');
const resYou = service.classifySequence([fYou, fYou, fYou]);
assert(resYou.rawLabel === 'YOU', `Recognized gesture is YOU (got ${resYou.rawLabel})`);

// Test D: WATER (W handshape near chin: Index, Middle, Ring extended)
const waterLandmarks = createLandmarks([false, true, true, true, false], 0.40);
const fWater = service.processLandmarkResults([waterLandmarks], 640, 480);
const resWater = service.classifySequence([fWater, fWater, fWater]);
assert(resWater.rawLabel === 'WATER', `Recognized gesture is WATER (got ${resWater.rawLabel})`);

// Test E: KEYBOARD (Palms down typing at waist level)
const kbLandmarks = createLandmarks([true, true, true, true, true], 0.78);
const fKb1 = service.processLandmarkResults([kbLandmarks], 640, 480);
const kbLandmarks2 = createLandmarks([true, true, true, true, true], 0.78);
kbLandmarks2.forEach(p => p.y += 0.03); // typing flutter
const fKb2 = service.processLandmarkResults([kbLandmarks2], 640, 480);
const resKb = service.classifySequence([fKb1, fKb2, fKb1]);
assert(resKb.rawLabel === 'KEYBOARD', `Recognized gesture is KEYBOARD (got ${resKb.rawLabel})`);

// Test F: QUIZ OPTION A (Solid fist)
const fistLandmarks = createLandmarks([false, false, false, false, false], 0.55);
const fFist = service.processLandmarkResults([fistLandmarks], 640, 480);
const resA = service.classifySequence([fFist, fFist, fFist]);
assert(resA.rawLabel === 'OPTION A', `Recognized gesture is OPTION A (got ${resA.rawLabel})`);

// 3. Temporal State Machine & Multi-Sign Sequence Building
console.log('\n--- 3. Temporal State Machine & Sequence Builder ---');
let lastReportedState = null;
let lastReportedPrediction = null;
service.onStateChangeCallback = (st) => { lastReportedState = st; };
service.onPredictionCallback = (pred) => { lastReportedPrediction = pred; };

// Feed stable HELLO across 6 frames
for (let i = 0; i < 6; i++) {
  service.handlePredictionStabilization(resHello);
}
assert(service.state === RECOGNITION_STATES.STABLE, 'Transitions to STABLE after required stable frames');
assert(lastReportedPrediction && lastReportedPrediction.isReliable, 'Prediction flagged as reliable');
assert(service.getPrediction() === 'HELLO', 'Active prediction matches HELLO');

// Commit the active prediction
const committed1 = service.commitActivePrediction();
assert(committed1 === 'HELLO', 'Successfully committed HELLO');
assert(service.getStatus().committedSequence.length === 1, 'Committed sequence contains 1 token');
assert(service.state === RECOGNITION_STATES.COMMITTED, 'State is COMMITTED');

// Add another sign manually or via gesture
const committed2 = service.addManualToken('YOU');
assert(committed2 === 'YOU', 'Successfully added YOU token');
assert(service.getStatus().committedSequence.join(' ') === 'HELLO YOU', 'Committed sequence is "HELLO YOU"');

// Clear sequence
service.clearSequence();
assert(service.getStatus().committedSequence.length === 0, 'Sequence cleared successfully');

console.log('\n======================================================================');
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
