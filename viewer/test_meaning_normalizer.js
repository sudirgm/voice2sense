import { meaningNormalizer } from './src/meaningNormalizer.js';

console.log('='.repeat(70));
console.log('Voice 2 Sense — Multilingual Meaning Normalizer Test Suite');
console.log('='.repeat(70));

let passed = 0;
let total = 0;

function assert(condition, desc) {
  total++;
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
  }
}

// TEST 1: Tamil "எனக்கு தண்ணீர் வேண்டும்" -> Intent Water
console.log('\n--- 1. Testing Tamil: "எனக்கு தண்ணீர் வேண்டும்" ---');
const resTa = meaningNormalizer.normalizeMeaning({ spokenText: 'எனக்கு தண்ணீர் வேண்டும்' });
assert(resTa.success === true, 'Tamil normalization succeeded');
assert(resTa.detectedLanguage === 'ta', 'Detected language is Tamil (ta)');
assert(resTa.languageName === 'Tamil', 'Language name is Tamil');
assert(resTa.primaryGloss === 'WATER', 'Canonical gloss is WATER');
assert(resTa.nativeText === 'எனக்கு தண்ணீர் வேண்டும்', 'Preserves native Tamil script');
assert(!resTa.nativeText.includes('water') && !resTa.nativeText.includes('Water'), 'Rule 3: User-facing text contains no English translation');
assert(resTa.sequence && resTa.sequence.length > 0, 'Produces verified ISL sequence');

// TEST 2: Hindi "मुझे पानी चाहिए" -> Intent Water
console.log('\n--- 2. Testing Hindi: "मुझे पानी चाहिए" ---');
const resHi = meaningNormalizer.normalizeMeaning({ spokenText: 'मुझे पानी चाहिए' });
assert(resHi.success === true, 'Hindi normalization succeeded');
assert(resHi.detectedLanguage === 'hi', 'Detected language is Hindi (hi)');
assert(resHi.primaryGloss === 'WATER', 'Canonical gloss converges to WATER (Rule 1 & Rule 4)');
assert(resHi.canonicalMeaning === resTa.canonicalMeaning, 'Both Tamil and Hindi produce identical canonical meaning');

// TEST 3: Telugu "నాకు సహాయం కావాలి" -> Intent Help
console.log('\n--- 3. Testing Telugu: "నాకు సహాయం కావాలి" ---');
const resTe = meaningNormalizer.normalizeMeaning({ spokenText: 'నాకు సహాయం కావాలి' });
assert(resTe.success === true, 'Telugu normalization succeeded');
assert(resTe.detectedLanguage === 'te', 'Detected language is Telugu (te)');
assert(resTe.primaryGloss === 'HELP', 'Canonical gloss is HELP');

// TEST 4: Kannada "ನನಗೆ ನೀರು ಬೇಕು" -> Intent Water
console.log('\n--- 4. Testing Kannada: "ನನಗೆ ನೀರು ಬೇಕು" ---');
const resKn = meaningNormalizer.normalizeMeaning({ spokenText: 'ನನಗೆ ನೀರು ಬೇಕು' });
assert(resKn.success === true, 'Kannada normalization succeeded');
assert(resKn.detectedLanguage === 'kn', 'Detected language is Kannada (kn)');
assert(resKn.primaryGloss === 'WATER', 'Canonical gloss is WATER');

// TEST 5: Malayalam "എനിക്ക് വെള്ളം വേണം" -> Intent Water
console.log('\n--- 5. Testing Malayalam: "എനിക്ക് വെള്ളം വേണം" ---');
const resMl = meaningNormalizer.normalizeMeaning({ spokenText: 'എനിക്ക് വെള്ളം വേണം' });
assert(resMl.success === true, 'Malayalam normalization succeeded');
assert(resMl.detectedLanguage === 'ml', 'Detected language is Malayalam (ml)');
assert(resMl.primaryGloss === 'WATER', 'Canonical gloss is WATER');

// TEST 6: Rule 8 — Unclear Audio Handling
console.log('\n--- 6. Testing Unclear Audio (Rule 8) ---');
const resUnclear = meaningNormalizer.normalizeMeaning({ spokenText: 'I ... want ... [unclear]' });
assert(resUnclear.success === false, 'Unclear speech does not produce false match');
assert(resUnclear.errorType === 'UNCLEAR_AUDIO', 'Error type is UNCLEAR_AUDIO');
assert(resUnclear.userMessage.includes("couldn't clearly understand that"), 'Honest retry prompt provided');

// TEST 7: Rule 5 & 17 — Strict Non-Fabrication of Unverified ISL Signs
console.log('\n--- 7. Testing Missing/Unverified Concepts (Rule 5 & Rule 17) ---');
const resLimit = meaningNormalizer.normalizeMeaning({ 
  spokenText: 'I want to buy a blue electric bicycle tomorrow.' 
});
assert(resLimit.isFullyAvailable === false, 'Detects unavailable concepts');
assert(resLimit.limitationMessage.includes('currently unavailable'), 'Honest limitation message returned without fabricating signs');

console.log('\n' + '='.repeat(70));
console.log(`RESULTS: ${passed}/${total} assertions PASSED`);
console.log('='.repeat(70));

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
