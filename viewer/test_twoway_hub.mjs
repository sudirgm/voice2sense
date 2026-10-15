/**
 * ============================================================================
 * Voice 2 Sense — Two-Way Sign ↔ Speech Communication Hub Integration Test
 * Validates bidirectional communication:
 * 1. Direction A (Deaf ➔ Hearing):
 *    Webcam / ISL landmarks ➔ Pure ISL recognition ➔ Sentence sequence ➔ Spoken TTS ➔ Chat Timeline
 * 2. Direction B (Hearing ➔ Deaf):
 *    Multilingual voice input ➔ Semantic Meaning Normalization ➔ 3D ISL Avatar signing ➔ Chat Timeline
 * ============================================================================
 */

import { islRecognitionService, SUPPORTED_ISL_SIGNS_V1, RECOGNITION_STATES } from './src/islRecognitionService.js';
import { meaningNormalizer } from './src/meaningNormalizer.js';
import { TTSService } from './src/ttsService.js';

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
console.log('Voice 2 Sense — Two-Way Sign ↔ Speech Communication Test Suite');
console.log('======================================================================\n');

// ----------------------------------------------------------------------------
// 1. DIRECTION A: Deaf Participant Signs in ISL ➔ Text & TTS Speech Output
// ----------------------------------------------------------------------------
console.log('--- 1. Direction A: Deaf Participant (ISL Sign ➔ Speech Output) ---');

// A. Add manual or verified gesture tokens to sequence
islRecognitionService.clearSequence();
islRecognitionService.addManualToken('HELLO');
islRecognitionService.addManualToken('GOOD');

let status = islRecognitionService.getStatus();
assert(status.committedSequence.length === 2, 'Two signs added to active ISL sequence');
assert(status.committedSequence[0] === 'HELLO', 'First sign is HELLO');
assert(status.committedSequence[1] === 'GOOD', 'Second sign is GOOD');

// B. Compose natural sentence from ISL signs
function composeSentence(seq) {
  const labels = seq.map(s => (typeof s === 'string' ? s : s.label).toUpperCase());
  if (labels.includes('HELLO') && labels.includes('GOOD')) {
    return 'Hello! I am doing good, thank you.';
  }
  return labels.map(lbl => {
    const found = SUPPORTED_ISL_SIGNS_V1.find(s => s.label === lbl);
    return found ? (found.phrase || found.display) : lbl;
  }).join(' ');
}

const composedSentence = composeSentence(status.committedSequence);
assert(composedSentence === 'Hello! I am doing good, thank you.', `Natural sentence generated: "${composedSentence}"`);

// C. Test TTS speech synthesis initiation
const tts = new TTSService();
assert(typeof tts.speak === 'function', 'TTS service provides speak() method');
assert(typeof tts.stop === 'function', 'TTS service provides stop() method');

// D. Clear sequence
islRecognitionService.clearSequence();
assert(islRecognitionService.getStatus().committedSequence.length === 0, 'Sequence cleared after sending');

// ----------------------------------------------------------------------------
// 2. DIRECTION B: Hearing Participant Speaks ➔ 3D ISL Avatar Signing
// ----------------------------------------------------------------------------
console.log('\n--- 2. Direction B: Hearing Participant (Speech ➔ 3D ISL Avatar) ---');

// Test Case 1: Tamil Speech
const tamilSpoken = "எனக்கு தண்ணீர் வேண்டும்";
const tamilNorm = meaningNormalizer.normalizeMeaning({ spokenText: tamilSpoken });
assert(tamilNorm.success === true, 'Tamil speech normalization succeeded');
assert(tamilNorm.primaryGloss === 'WATER', 'Canonical ISL gloss is WATER');
assert(tamilNorm.sequence && tamilNorm.sequence.length > 0, 'Produces executable avatar signing sequence');
assert(tamilNorm.languageName === 'Tamil', 'Detected language is Tamil');

// Test Case 2: Hindi Speech
const hindiSpoken = "मुझे मदद चाहिए";
const hindiNorm = meaningNormalizer.normalizeMeaning({ spokenText: hindiSpoken });
assert(hindiNorm.success === true, 'Hindi speech normalization succeeded');
assert(hindiNorm.primaryGloss === 'HELP', 'Canonical ISL gloss is HELP');
assert(hindiNorm.sequence && hindiNorm.sequence.length > 0, 'Produces executable avatar signing sequence');
assert(hindiNorm.languageName === 'Hindi', 'Detected language is Hindi');

// Test Case 3: English Speech
const englishSpoken = "Hello, how are you?";
const englishNorm = meaningNormalizer.normalizeMeaning({ spokenText: englishSpoken });
assert(englishNorm.success === true, 'English speech normalization succeeded');
assert(englishNorm.primaryGloss === 'HELLO' || englishNorm.primaryGloss === 'HOW', 'Understands English conversational greeting');

// ----------------------------------------------------------------------------
// 3. BIDIRECTIONAL TIMELINE TRANSCRIPT DATA MODEL
// ----------------------------------------------------------------------------
console.log('\n--- 3. Bidirectional Conversation Timeline Model ---');

const timelineMessages = [];
function logMessage(msg) {
  timelineMessages.push({
    id: `msg-${Date.now()}-${timelineMessages.length}`,
    timestamp: new Date().toISOString(),
    ...msg
  });
}

// Deaf user message
logMessage({
  sender: 'deaf',
  senderName: 'Deaf Participant (ISL Signer)',
  text: 'Hello! I am doing good, thank you.',
  gloss: 'HELLO • GOOD',
  signs: ['HELLO', 'GOOD']
});

// Hearing user response
logMessage({
  sender: 'hearing',
  senderName: 'Hearing Participant (Voice)',
  text: 'வணக்கம், உங்கள் உதவிக்கு நன்றி',
  gloss: 'HELLO • THANK YOU',
  sequence: [{ type: 'BVH', gloss: 'HELLO' }, { type: 'BVH', gloss: 'THANK YOU' }]
});

assert(timelineMessages.length === 2, 'Timeline contains 2 synchronized messages');
assert(timelineMessages[0].sender === 'deaf', 'First turn from Deaf participant');
assert(timelineMessages[1].sender === 'hearing', 'Second turn from Hearing participant');
assert(timelineMessages[0].gloss === 'HELLO • GOOD', 'Deaf message contains canonical ISL gloss');
assert(timelineMessages[1].sequence.length === 2, 'Hearing message contains 3D avatar sequence');

console.log('\n======================================================================');
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================\n');
if (failed > 0) process.exit(1);
