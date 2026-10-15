// ============================================================
// Personalized ISL Learning System — Adaptive Engine & Sign Data
// Voice 2 Sense | SignBridge 3D
// Deterministic / Rule-based only — NO AI, NO LLM, NO backend
// ============================================================

import { recommendationEngine, RECOMMENDATION_STATES } from './recommendationEngine.js';

/**
 * Difficulty Levels:
 * 1 = BEGINNER: Hand movements, Alphabets (A-Z) with official reference PNGs, Numbers (0-9), Basic common words
 * 2 = INTERMEDIATE: Phrases, Common communication, Multi-word combinations
 * 3 = ADVANCED: Complex phrases, Conversations, Authentic ISL dataset sequences
 */
export const DIFFICULTY_LEVELS = {
  BEGINNER: {
    id: 'beginner',
    label: 'Beginner',
    tier: 1,
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    speedPresets: [0.5, 0.75, 1.0],
    defaultSpeed: 0.75,
    description: 'Mastering hand shapes, A–Z alphabets (with reference images), numbers, and basic vocabulary.'
  },
  INTERMEDIATE: {
    id: 'intermediate',
    label: 'Intermediate',
    tier: 2,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    speedPresets: [1.0],
    defaultSpeed: 1.0,
    description: 'Practicing common communication, everyday phrases, and multi-sign combinations.'
  },
  ADVANCED: {
    id: 'advanced',
    label: 'Advanced',
    tier: 3,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    speedPresets: [1.0, 1.25, 1.5],
    defaultSpeed: 1.0,
    description: 'Fluency in complex sign sequences, full sentences, and conversational dialogue.'
  }
};

// Hand shape instruction dictionary for A-Z
// Helper functions for distractors
function getAlphabetDistractors(targetChar) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.replace(targetChar, '').split('');
  const shuffled = chars.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

function getNumberDistractors(targetNum) {
  const nums = '0123456789'.replace(targetNum, '').split('');
  const shuffled = nums.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

// Hand shape instruction dictionary for A-Z
const ALPHABET_INSTRUCTIONS = {
  A: 'Make a fist with your thumb resting straight alongside your index finger.',
  B: 'Keep all four fingers extended straight upward together with your thumb folded across your palm.',
  C: 'Curve all fingers and thumb together to shape the letter "C".',
  D: 'Point your index finger straight up while your other three fingers curl to touch your thumb.',
  E: 'Curl all four fingertips tightly so they rest on top of your tucked thumb.',
  F: 'Touch your index finger and thumb tips together in a circle; keep other three fingers straight up.',
  G: 'Point your index finger forward horizontally with your thumb extended parallel to it.',
  H: 'Extend both your index and middle fingers together forward horizontally.',
  I: 'Extend only your pinky finger straight up while holding other fingers in a closed fist.',
  J: 'Form the "I" hand shape with pinky up and trace a gentle "J" curve in the air.',
  K: 'Point your index finger straight up, middle finger angled forward, thumb resting between them.',
  L: 'Extend your thumb and index finger at a 90-degree angle to form an "L" shape.',
  M: 'Fold your thumb under your first three fingers draped gently over it.',
  N: 'Fold your thumb under your first two fingers draped over it.',
  O: 'Curve all four fingers and thumb tips together to form an "O" shape.',
  P: 'Point your index finger downward with your middle finger extended and thumb touching it.',
  Q: 'Hold your hand downward with your index finger and thumb pointing downward in a pinch.',
  R: 'Cross your middle finger over your index finger, holding other fingers closed.',
  S: 'Make a solid fist with your thumb wrapped firmly across the front of your fingers.',
  T: 'Tuck your thumb between your index and middle finger inside a clenched fist.',
  U: 'Extend your index and middle fingers straight up together side-by-side.',
  V: 'Extend your index and middle fingers straight up in a separated "V" peace sign.',
  W: 'Extend your index, middle, and ring fingers upward in a separated "W" shape.',
  X: 'Bend your index finger into a hook shape while keeping other fingers curled in a fist.',
  Y: 'Extend only your thumb and pinky finger outward wide in the "hang loose" shape.',
  Z: 'Extend your index finger and trace the letter "Z" in the signing space.'
};

// Hand shape instruction dictionary for numbers 0-9
const NUMBER_INSTRUCTIONS = {
  '0': 'Touch all four fingertips and thumb tip together forming a closed circular "0" shape.',
  '1': 'Extend your index finger straight up with remaining fingers closed in a fist and thumb across them.',
  '2': 'Extend both your index and middle fingers straight up in a distinct "V" shape.',
  '3': 'Extend your index, middle, and ring fingers upward with pinky curled and thumb folded across.',
  '4': 'Extend all four fingers (index, middle, ring, pinky) straight upward with thumb folded across palm.',
  '5': 'Open your entire hand flat with all five fingers and thumb spread wide.',
  '6': 'Touch your thumb tip to your pinky finger tip while extending index, middle, and ring fingers.',
  '7': 'Touch your thumb tip to your ring finger tip while extending index, middle, and pinky fingers.',
  '8': 'Touch your thumb tip to your middle finger tip while extending index, ring, and pinky fingers.',
  '9': 'Touch your index finger and thumb tips together in a circle with middle, ring, and pinky extended.'
};

// ============================================================
// EXPANDED SIGN LIBRARY
// Structured, scalable dictionary across Beginner, Intermediate, Advanced
// ============================================================
export const SIGN_LIBRARY = [
  // ------------------------------------------------------------
  // 1. BEGINNER — Alphabets A–Z (Difficulty 1)
  // Uses authentic PNG images directly from "beginner sign lang/ALPHABETS/"
  // ------------------------------------------------------------
  ...('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => ({
    id: `alpha-${char.toLowerCase()}`,
    word: char,
    category: 'alphabets',
    difficulty: 1,
    gloss: char,
    animationType: 'letter',
    signRef: char,
    // Direct path to authentic files in "beginner sign lang/ALPHABETS/" (z is z.jpeg)
    imageRef: char === 'Z' ? '/beginner sign lang/ALPHABETS/z.jpeg' : `/beginner sign lang/ALPHABETS/${char}.png`,
    keywords: ['alphabet', 'letter', char.toLowerCase(), 'spelling', 'hand shape'],
    instruction: ALPHABET_INSTRUCTIONS[char] || `Form the ISL hand shape for letter ${char}.`,
    hint: `ISL letter ${char}. Reference hand shape shown in the guide image.`,
    distractors: getAlphabetDistractors(char)
  }))),

  // ------------------------------------------------------------
  // 2. BEGINNER — Numbers 0–9 (Difficulty 1)
  // Uses authentic images directly from "beginner sign lang/NUMBERS/"
  // ------------------------------------------------------------
  ...('0123456789'.split('').map(num => ({
    id: `num-${num}`,
    word: num,
    category: 'numbers',
    difficulty: 1,
    gloss: num,
    animationType: 'letter',
    signRef: num,
    // Direct path to authentic files in "beginner sign lang/NUMBERS/"
    imageRef: `/beginner sign lang/NUMBERS/${num}.jpeg`,
    keywords: ['number', 'digit', num, 'count'],
    instruction: NUMBER_INSTRUCTIONS[num] || `Form the standard ISL numeral hand configuration for ${num}.`,
    hint: `ISL numeral ${num}. Reference hand shape shown in the guide image.`,
    distractors: getNumberDistractors(num)
  }))),

  // ------------------------------------------------------------
  // 3. BEGINNER — Everyday Basic Words (Difficulty 1)
  // ------------------------------------------------------------
  {
    id: 'w-yes',
    word: 'Yes',
    category: 'words',
    difficulty: 1,
    gloss: 'YES',
    animationType: 'spell',
    signRef: 'YES',
    keywords: ['yes', 'agree', 'nod', 'affirmation'],
    instruction: 'Nod closed fist or fingerspell Y-E-S to indicate affirmation.',
    hint: 'Affirmative response sign.',
    distractors: ['No', 'Please', 'Maybe']
  },
  {
    id: 'w-no',
    word: 'No',
    category: 'words',
    difficulty: 1,
    gloss: 'NO',
    animationType: 'spell',
    signRef: 'NO',
    keywords: ['no', 'negation', 'refuse'],
    instruction: 'Snap index, middle, and thumb together firmly.',
    hint: 'Negative response sign.',
    distractors: ['Yes', 'Stop', 'Wait']
  },
  {
    id: 'w-help',
    word: 'Help',
    category: 'words',
    difficulty: 1,
    gloss: 'HELP',
    animationType: 'spell',
    signRef: 'HELP',
    keywords: ['help', 'assist', 'support', 'emergency'],
    instruction: 'Place closed fist with thumb up onto flat palm and raise both upward.',
    hint: 'Assistance request sign.',
    distractors: ['Home', 'Food', 'Water']
  },
  {
    id: 'w-water',
    word: 'Water',
    category: 'words',
    difficulty: 1,
    gloss: 'WATER',
    animationType: 'spell',
    signRef: 'WATER',
    keywords: ['water', 'drink', 'thirsty', 'liquid'],
    instruction: 'Form "W" hand shape and tap index finger against your chin.',
    hint: 'Water drink sign.',
    distractors: ['Food', 'Milk', 'Tea']
  },
  {
    id: 'w-food',
    word: 'Food',
    category: 'words',
    difficulty: 1,
    gloss: 'FOOD',
    animationType: 'spell',
    signRef: 'FOOD',
    keywords: ['food', 'eat', 'meal', 'hungry'],
    instruction: 'Bring flattened fingertips of dominant hand to lips repeatedly.',
    hint: 'Eating / meal sign.',
    distractors: ['Water', 'Book', 'Home']
  },
  {
    id: 'w-home',
    word: 'Home',
    category: 'words',
    difficulty: 1,
    gloss: 'HOME',
    animationType: 'spell',
    signRef: 'HOME',
    keywords: ['home', 'house', 'residence', 'stay'],
    instruction: 'Touch fingertips of flat hands together forming a roof shape.',
    hint: 'Home / house sign.',
    distractors: ['School', 'Work', 'Office']
  },
  {
    id: 'w-school',
    word: 'School',
    category: 'words',
    difficulty: 1,
    gloss: 'SCHOOL',
    animationType: 'spell',
    signRef: 'SCHOOL',
    keywords: ['school', 'study', 'class', 'student'],
    instruction: 'Clap flat dominant palm downward onto flat non-dominant palm twice.',
    hint: 'School / classroom sign.',
    distractors: ['Home', 'Book', 'Hospital']
  },
  {
    id: 'w-book',
    word: 'Book',
    category: 'words',
    difficulty: 1,
    gloss: 'BOOK',
    animationType: 'spell',
    signRef: 'BOOK',
    keywords: ['book', 'read', 'library', 'page'],
    instruction: 'Place palms together and open them upward as if opening a book.',
    hint: 'Book / reading sign.',
    distractors: ['School', 'Paper', 'Pen']
  },
  {
    id: 'w-friend',
    word: 'Friend',
    category: 'words',
    difficulty: 1,
    gloss: 'FRIEND',
    animationType: 'spell',
    signRef: 'FRIEND',
    keywords: ['friend', 'peer', 'companion', 'buddy'],
    instruction: 'Hook index fingers together in front of chest, then reverse and hook again.',
    hint: 'Friend / companion sign.',
    distractors: ['Family', 'Teacher', 'Enemy']
  },
  {
    id: 'w-name',
    word: 'Name',
    category: 'words',
    difficulty: 1,
    gloss: 'NAME',
    animationType: 'spell',
    signRef: 'NAME',
    keywords: ['name', 'identity', 'call'],
    instruction: 'Tap middle and index fingers of both hands across each other twice.',
    hint: 'Name / identity sign.',
    distractors: ['Sign', 'Number', 'Word']
  },
  {
    id: 'w-learn',
    word: 'Learn',
    category: 'words',
    difficulty: 1,
    gloss: 'LEARN',
    animationType: 'spell',
    signRef: 'LEARN',
    keywords: ['learn', 'study', 'knowledge', 'student'],
    instruction: 'Grasp imaginary knowledge from open palm and press it to your forehead.',
    hint: 'Learning / absorbing knowledge.',
    distractors: ['Teach', 'Read', 'Write']
  },
  {
    id: 'w-time',
    word: 'Time',
    category: 'words',
    difficulty: 1,
    gloss: 'TIME',
    animationType: 'spell',
    signRef: 'TIME',
    keywords: ['time', 'clock', 'hour'],
    instruction: 'Tap your bent index finger on the wrist of your non-dominant arm.',
    hint: 'Wrist watch / clock sign.',
    distractors: ['Day', 'Night', 'Today']
  },

  // ------------------------------------------------------------
  // 4. BEGINNER / INTERMEDIATE — Greetings & Polite Communication (Difficulty 1–2)
  // ------------------------------------------------------------
  {
    id: 'g-hello',
    word: 'Hello',
    category: 'greetings',
    difficulty: 1,
    gloss: 'HELLO',
    animationType: 'spell',
    signRef: 'HELLO',
    keywords: ['hello', 'greeting', 'salute'],
    instruction: 'Open flat hand near temple and extend outward in a respectful salute.',
    hint: 'Universal ISL greeting.',
    distractors: ['Goodbye', 'Thank You', 'Please']
  },
  {
    id: 'g-hi',
    word: 'Hi',
    category: 'greetings',
    difficulty: 1,
    gloss: 'HI',
    animationType: 'spell',
    signRef: 'HI',
    keywords: ['hi', 'hey', 'informal'],
    instruction: 'Casual wave with open palm raised beside shoulder.',
    hint: 'Informal wave greeting.',
    distractors: ['Bye', 'No', 'Yes']
  },
  {
    id: 'g-goodbye',
    word: 'Goodbye',
    category: 'greetings',
    difficulty: 1,
    gloss: 'GOODBYE',
    animationType: 'spell',
    signRef: 'GOODBYE',
    keywords: ['goodbye', 'bye', 'farewell', 'see you'],
    instruction: 'Open palm facing outward and wave fingers in farewell gesture.',
    hint: 'Farewell wave sign.',
    distractors: ['Hello', 'Welcome', 'Sorry']
  },
  {
    id: 'g-thanks',
    word: 'Thank You',
    category: 'greetings',
    difficulty: 1,
    gloss: 'THANKS',
    animationType: 'spell',
    signRef: 'THANKS',
    keywords: ['thanks', 'thank you', 'gratitude'],
    instruction: 'Touch fingertips of flat hand to your chin and extend outward towards person.',
    hint: 'Chin-to-forward gratitude sign.',
    distractors: ['Please', 'Sorry', 'Welcome']
  },
  {
    id: 'g-please',
    word: 'Please',
    category: 'greetings',
    difficulty: 1,
    gloss: 'PLEASE',
    animationType: 'spell',
    signRef: 'PLEASE',
    keywords: ['please', 'polite', 'request'],
    instruction: 'Rub flat palm in a gentle circular motion over your chest.',
    hint: 'Chest circular rub polite request.',
    distractors: ['Thank You', 'Sorry', 'Excuse Me']
  },
  {
    id: 'g-sorry',
    word: 'Sorry',
    category: 'greetings',
    difficulty: 1,
    gloss: 'SORRY',
    animationType: 'spell',
    signRef: 'SORRY',
    keywords: ['sorry', 'apologize', 'regret'],
    instruction: 'Make an "A" fist and rub it in a circular motion on your chest.',
    hint: 'Fist circular rub apology sign.',
    distractors: ['Please', 'Thank You', 'Hello']
  },
  {
    id: 'g-welcome',
    word: 'Welcome',
    category: 'greetings',
    difficulty: 2,
    gloss: 'WELCOME',
    animationType: 'spell',
    signRef: 'WELCOME',
    keywords: ['welcome', 'invite', 'enter'],
    instruction: 'Open palm swept gracefully inward towards your torso.',
    hint: 'Welcoming / hospitable gesture.',
    distractors: ['Goodbye', 'Wait', 'Stop']
  },
  {
    id: 'g-morning',
    word: 'Good Morning',
    category: 'greetings',
    difficulty: 2,
    gloss: 'GOOD MORNING',
    animationType: 'spell',
    signRef: 'MORNING',
    keywords: ['morning', 'good morning', 'day'],
    instruction: 'Combine GOOD (chin forward) and MORNING (arm rising like the sun).',
    hint: 'Compound morning greeting.',
    distractors: ['Good Night', 'Good Afternoon', 'Goodbye']
  },

  // ------------------------------------------------------------
  // 5. INTERMEDIATE — Family, Food & Places (Difficulty 2)
  // ------------------------------------------------------------
  {
    id: 'fam-father',
    word: 'Father',
    category: 'family',
    difficulty: 2,
    gloss: 'FATHER',
    animationType: 'spell',
    signRef: 'FATHER',
    keywords: ['father', 'dad', 'parent'],
    instruction: 'Touch thumb of open "5" hand to forehead twice.',
    hint: 'Forehead masculine family sign.',
    distractors: ['Mother', 'Brother', 'Son']
  },
  {
    id: 'fam-mother',
    word: 'Mother',
    category: 'family',
    difficulty: 2,
    gloss: 'MOTHER',
    animationType: 'spell',
    signRef: 'MOTHER',
    keywords: ['mother', 'mom', 'parent'],
    instruction: 'Touch thumb of open "5" hand to chin twice.',
    hint: 'Chin feminine family sign.',
    distractors: ['Father', 'Sister', 'Daughter']
  },
  {
    id: 'fam-family',
    word: 'Family',
    category: 'family',
    difficulty: 2,
    gloss: 'FAMILY',
    animationType: 'spell',
    signRef: 'FAMILY',
    keywords: ['family', 'relatives', 'household'],
    instruction: 'Touch "F" hands thumbs/index together and circle outward until pinkies meet.',
    hint: 'Circular unified family sign.',
    distractors: ['Friend', 'Team', 'School']
  },
  {
    id: 'act-walk',
    word: 'Walk',
    category: 'actions',
    difficulty: 2,
    gloss: 'WALK',
    animationType: 'spell',
    signRef: 'WALK',
    keywords: ['walk', 'go', 'steps', 'movement'],
    instruction: 'Move flat hands alternately downward and forward like footsteps.',
    hint: 'Alternating footstep motion.',
    distractors: ['Run', 'Sit', 'Jump']
  },
  {
    id: 'act-sleep',
    word: 'Sleep',
    category: 'actions',
    difficulty: 2,
    gloss: 'SLEEP',
    animationType: 'spell',
    signRef: 'SLEEP',
    keywords: ['sleep', 'rest', 'bed', 'tired'],
    instruction: 'Draw open hand downward over face while fingers gently close.',
    hint: 'Eyes closing / sleep motion.',
    distractors: ['Wake Up', 'Eat', 'Work']
  },
  {
    id: 'emo-happy',
    word: 'Happy',
    category: 'emotions',
    difficulty: 2,
    gloss: 'HAPPY',
    animationType: 'spell',
    signRef: 'HAPPY',
    keywords: ['happy', 'joy', 'smile', 'glad'],
    instruction: 'Brush flat open hands upward on chest with smiling expression.',
    hint: 'Upward chest brushing joy sign.',
    distractors: ['Sad', 'Angry', 'Tired']
  },
  {
    id: 'emo-sad',
    word: 'Sad',
    category: 'emotions',
    difficulty: 2,
    gloss: 'SAD',
    animationType: 'spell',
    signRef: 'SAD',
    keywords: ['sad', 'unhappy', 'cry', 'sorrow'],
    instruction: 'Bring open hands downward in front of face while dropping head slightly.',
    hint: 'Downward facial drop expression.',
    distractors: ['Happy', 'Angry', 'Excited']
  },
  {
    id: 'q-where',
    word: 'Where?',
    category: 'questions',
    difficulty: 2,
    gloss: 'WHERE?',
    animationType: 'spell',
    signRef: 'WHERE',
    keywords: ['where', 'location', 'place', 'question'],
    instruction: 'Wiggle upright index finger side-to-side with questioning eyebrows.',
    hint: 'Inquisitive finger wave question.',
    distractors: ['What?', 'Who?', 'When?']
  },

  // ------------------------------------------------------------
  // 6. INTERMEDIATE — Common Phrases & Daily Communication (Difficulty 2)
  // ------------------------------------------------------------
  {
    id: 'p-howru',
    word: 'How are you?',
    category: 'phrases',
    difficulty: 2,
    gloss: 'HOW ARE YOU',
    animationType: 'spell',
    signRef: 'HOW ARE YOU',
    keywords: ['how', 'how are you', 'question', 'health'],
    instruction: 'Roll curved hands outward from chest and point forward towards person.',
    hint: 'Curved hands rolling outward query.',
    distractors: ['I am fine', 'What is your name?', 'Nice to meet you']
  },
  {
    id: 'p-iamfine',
    word: 'I am fine',
    category: 'phrases',
    difficulty: 2,
    gloss: 'FINE ME',
    animationType: 'spell',
    signRef: 'FINE',
    keywords: ['fine', 'good', 'well', 'ok'],
    instruction: 'Touch thumb of open "5" hand to chest with upbeat, cheerful expression.',
    hint: 'Affirmative well-being sign.',
    distractors: ['How are you?', 'I am sad', 'I am busy']
  },
  {
    id: 'p-myname',
    word: 'My name is...',
    category: 'phrases',
    difficulty: 2,
    gloss: 'MY NAME',
    animationType: 'spell',
    signRef: 'MY NAME',
    keywords: ['my name', 'introduction', 'myself'],
    instruction: 'Press flat hand to chest (MY) then tap "H" fingers across twice (NAME).',
    hint: 'Introductory self-identification.',
    distractors: ['What is your name?', 'Nice to meet you', 'Where do you live?']
  },
  {
    id: 'p-nicemeet',
    word: 'Nice to meet you',
    category: 'phrases',
    difficulty: 2,
    gloss: 'NICE MEET',
    animationType: 'spell',
    signRef: 'NICE MEET',
    keywords: ['nice', 'meet', 'greeting', 'introduction'],
    instruction: 'Slide flat hand across palm (NICE) then bring index fingers together (MEET).',
    hint: 'Friendly acquaintance phrase.',
    distractors: ['See you later', 'Thank you very much', 'Where are you going?']
  },
  {
    id: 'p-repeat',
    word: 'Please repeat',
    category: 'phrases',
    difficulty: 2,
    gloss: 'REPEAT PLEASE',
    animationType: 'spell',
    signRef: 'REPEAT',
    keywords: ['repeat', 'again', 'one more time'],
    instruction: 'Arc curved right hand onto flat left palm repeatedly.',
    hint: 'Sign for repetition / again.',
    distractors: ['Slow down', 'Stop talking', 'Speak louder']
  },
  {
    id: 'p-slow',
    word: 'Sign slowly',
    category: 'phrases',
    difficulty: 2,
    gloss: 'SLOW DOWN',
    animationType: 'spell',
    signRef: 'SLOW',
    keywords: ['slow', 'speed', 'pace'],
    instruction: 'Caress back of non-dominant hand and wrist upward at a deliberate slow pace.',
    hint: 'Pacing / speed adjustment request.',
    distractors: ['Sign faster', 'Repeat that', 'Stop here']
  },
  {
    id: 'p-understand',
    word: 'I understand',
    category: 'phrases',
    difficulty: 2,
    gloss: 'UNDERSTAND ME',
    animationType: 'spell',
    signRef: 'UNDERSTAND',
    keywords: ['understand', 'comprehend', 'got it'],
    instruction: 'Flick index finger upward beside temple like an idea bulb lighting up.',
    hint: 'Comprehension confirmation.',
    distractors: ['I do not know', 'Please repeat', 'I am confused']
  },
  {
    id: 'p-seeyou',
    word: 'See you tomorrow',
    category: 'phrases',
    difficulty: 2,
    gloss: 'SEE YOU TOMORROW',
    animationType: 'spell',
    signRef: 'SEE TOMORROW',
    keywords: ['see', 'tomorrow', 'later', 'farewell'],
    instruction: 'Extend "V" forward from eyes (SEE) then push thumb forward from cheek (TOMORROW).',
    hint: 'Tomorrow farewell sign.',
    distractors: ['Good morning', 'See you yesterday', 'Goodbye forever']
  },

  // ------------------------------------------------------------
  // 7. ADVANCED — Complex Phrases & Authentic ISL Sentences (Difficulty 3)
  // Uses authentic ISL BVH dataset motions
  // ------------------------------------------------------------
  {
    id: 'c-canistay',
    word: 'Can I stay here tonight?',
    category: 'conversations',
    difficulty: 3,
    gloss: 'STAY HERE TONIGHT ME?',
    animationType: 'bvh',
    signRef: 'Train/1003115/1003115.bvh',
    fallbackSpell: 'CAN I STAY HERE TONIGHT',
    keywords: ['can i stay', 'stay here tonight', 'stay here', 'tonight'],
    instruction: 'Authentic ISL compound question: STAY + HERE + TONIGHT + interrogation marker.',
    hint: 'Compound sentence with location and temporal markers.',
    distractors: ['Where are you going now?', 'I will go home tomorrow', 'Do you want coffee?']
  },
  {
    id: 'c-nicething',
    word: 'What a nice thing to say!',
    category: 'conversations',
    difficulty: 3,
    gloss: 'NICE THING SAY//',
    animationType: 'bvh',
    signRef: 'Train/1003242/1003242.bvh',
    fallbackSpell: 'NICE THING SAY',
    keywords: ['nice', 'compliment', 'speak', 'say'],
    instruction: 'Conversational emotional response combining NICE with communicative SAY action.',
    hint: 'Expressive complimentary phrase.',
    distractors: ['I don’t want to talk', 'Please say that again', 'That is terrible news']
  },
  {
    id: 'c-pleaselock',
    word: 'Please lock the safe.',
    category: 'conversations',
    difficulty: 3,
    gloss: 'SAFE LOCK PLEASE//',
    animationType: 'bvh',
    signRef: 'Train/1003552/1003552.bvh',
    fallbackSpell: 'PLEASE LOCK SAFE',
    keywords: ['lock', 'door', 'safe', 'secure'],
    instruction: 'Imperative sign sentence: SAFE + twisting key motion (LOCK) + polite PLEASE.',
    hint: 'Security imperative command.',
    distractors: ['Please open the door', 'Where is my key?', 'Come into my room']
  },
  {
    id: 'c-bettermath',
    word: 'He is better than me at math.',
    category: 'conversations',
    difficulty: 3,
    gloss: 'ME MATH BETTER THAN HIM//',
    animationType: 'bvh',
    signRef: 'Train/1005354/1005354.bvh',
    fallbackSpell: 'HE IS BETTER AT MATH',
    keywords: ['better', 'math', 'compare', 'study'],
    instruction: 'Comparative ISL grammar: spatial pronoun reference + MATH + BETTER comparative inflection.',
    hint: 'Comparative syntax with topic-comment structure.',
    distractors: ['I am learning math today', 'He does not like school', 'We study together']
  },
  {
    id: 'c-walkhot',
    word: 'I want to take a walk, but it is too hot.',
    category: 'conversations',
    difficulty: 3,
    gloss: 'ME WALK WANT BUT DAY HOT TOO//',
    animationType: 'bvh',
    signRef: 'Train/1008659/1008659.bvh',
    fallbackSpell: 'WANT WALK BUT HOT',
    keywords: ['take a walk', 'too hot', 'walk but hot', 'weather'],
    instruction: 'Conjunctive sentence with contrast (BUT) and weather intensity marker (TOO HOT).',
    hint: 'Contrastive multi-clause sentence.',
    distractors: ['I love walking in rain', 'The weather is very cold', 'Let us go to the market']
  },
  {
    id: 'c-readbook',
    word: 'He was sitting and reading a book.',
    category: 'conversations',
    difficulty: 3,
    gloss: 'HE READ BOOK//',
    animationType: 'bvh',
    signRef: 'Train/1012610/1012610.bvh',
    fallbackSpell: 'HE READ BOOK',
    keywords: ['reading a book', 'sitting and reading', 'read book'],
    instruction: 'Dual predicate visual narrative: sitting spatial stance + reading scanning hand motion.',
    hint: 'Descriptive narrative sequence.',
    distractors: ['He was writing a letter', 'He closed his book', 'The teacher is talking']
  },
  {
    id: 'c-greencolor',
    word: 'I like the green colour.',
    category: 'conversations',
    difficulty: 3,
    gloss: 'GREEN COLOUR LIKE ME//',
    animationType: 'bvh',
    signRef: 'Train/1020329/1020329.bvh',
    fallbackSpell: 'I LIKE GREEN COLOR',
    keywords: ['green', 'color', 'like', 'preference'],
    instruction: 'Adjective-noun sentence structure: G-shake (GREEN) + LIKE pulling from chest.',
    hint: 'Personal preference expression.',
    distractors: ['I want a red flower', 'What color do you prefer?', 'Blue is my favorite color']
  },
  {
    id: 'c-givecoffee',
    word: 'Please give me a coffee.',
    category: 'conversations',
    difficulty: 3,
    gloss: 'COFFEE GIVE ME NOW//',
    animationType: 'bvh',
    signRef: 'Train/1035116/1035116.bvh',
    fallbackSpell: 'PLEASE GIVE ME COFFEE',
    keywords: ['give me coffee', 'coffee', 'give coffee'],
    instruction: 'COFFEE (grinding fists) + directional GIVE ME motion with request facial expression.',
    hint: 'Directional verb request sentence.',
    distractors: ['Do you have cold water?', 'I want tea please', 'The coffee is finished']
  },
  {
    id: 'c-noproblem',
    word: 'That will not be a problem.',
    category: 'conversations',
    difficulty: 3,
    gloss: 'THAT PROBLEM NOT BE//',
    animationType: 'bvh',
    signRef: 'Train/1111601/1111601.bvh',
    fallbackSpell: 'NOT A PROBLEM',
    keywords: ['problem', 'reassure', 'easy', 'agree'],
    instruction: 'Reassurance phrase: THAT + bent "V" hands brushing (PROBLEM) + firm negative shake.',
    hint: 'Reassuring conversational response.',
    distractors: ['That is a very big problem', 'Can you help me with this?', 'I do not know the answer']
  },
  {
    id: 'c-happy',
    word: 'I am really happy!',
    category: 'conversations',
    difficulty: 3,
    gloss: 'ME HAPPY REALLY//',
    animationType: 'bvh',
    signRef: 'Train/1232236/1232236.bvh',
    fallbackSpell: 'I AM REALLY HAPPY',
    keywords: ['really happy', 'i am really happy', 'very happy'],
    instruction: 'Emphatic emotional expression: ME + vigorous upward chest brush (HAPPY) + emphatic head nod.',
    hint: 'Expressive joy sentence.',
    distractors: ['I feel very tired today', 'Why are you smiling?', 'I am leaving now']
  }
];

// User interest / goal categories
export const LEARNING_GOALS = [
  { id: 'all', label: 'All Categories', icon: '🌟', description: 'Comprehensive balanced curriculum' },
  { id: 'alphabets', label: 'Alphabets A–Z', icon: '🔤', description: 'Beginner A–Z with authentic reference images' },
  { id: 'numbers', label: 'Numbers 0–9', icon: '🔢', description: 'Counting and numeric digits' },
  { id: 'words', label: 'Basic Words', icon: '📝', description: 'Essential everyday vocabulary' },
  { id: 'greetings', label: 'Greetings', icon: '👋', description: 'Polite conversation openers' },
  { id: 'family', label: 'Family & People', icon: '👨‍👩‍👧', description: 'Relational signs and family members' },
  { id: 'actions', label: 'Actions', icon: '🏃', description: 'Everyday physical verbs' },
  { id: 'emotions', label: 'Emotions', icon: '😊', description: 'Feelings and sentiment expressions' },
  { id: 'questions', label: 'Questions', icon: '❓', description: 'Inquisitive interrogative words' },
  { id: 'phrases', label: 'Phrases', icon: '💬', description: 'Everyday conversational exchanges' },
  { id: 'conversations', label: 'Conversations', icon: '🗣️', description: 'Authentic ISL sentences and dialogue' }
];

// ============================================================
// LOCAL LEARNER PROFILE & PERSISTENT PROGRESS TRACKING
// Persists persistently in localStorage
// ============================================================
export const LEARNING_LOOP_STATES = {
  LEARN: 'learn',
  PRACTICE: 'practice',
  ASSESS: 'assess',
  IDENTIFY_GAP: 'identify_gap',
  RECOMMEND: 'recommend',
  LEARN_AGAIN: 'learn_again'
};

const PROFILE_STORAGE_KEY = 'signbridge_learner_profile_v2';
const LEGACY_STORAGE_KEY = 'v2s_isl_personalized_profile_v2';

export class LearnerProfile {
  constructor() {
    this.data = this.loadProfile();
  }

  getDefaultProfile() {
    return {
      version: 2,
      learnerName: 'Learner',
      created: Date.now(),
      lastActive: Date.now(),
      // Automated performance-driven level: 'beginner' | 'intermediate' | 'advanced'
      currentLevel: 'beginner',
      levelProgress: 0,
      activeGoal: 'all',
      recommendedArea: 'Foundational Alphabets & Hand Shapes',
      lastRecommendationState: 'recommended_for_you',
      selectedPlaybackSpeed: 0.75,
      // Core progress metrics (clean initial baseline - NO fake progress)
      totalAttempts: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      accuracyRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      lessonCompletionCount: 0,
      totalPracticeAttempts: 0,
      // Per-sign mastery
      itemMastery: {},
      // Rolling evaluation window (last 15 attempts)
      recentResults: [],
      // Review queue of sign IDs needing reinforcement (learning gaps)
      reviewQueue: [],
      // Chronological log of recent practice activities
      practiceHistory: [],
      // Category specific progress tracking (calculated from actual lessons)
      categoryStats: {
        alphabets: { completed: 0, mastered: 0, total: 26, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' },
        numbers: { completed: 0, mastered: 0, total: 10, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' },
        words: { completed: 0, mastered: 0, total: 12, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' },
        greetings: { completed: 0, mastered: 0, total: 8, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' },
        family: { completed: 0, mastered: 0, total: 3, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' },
        actions: { completed: 0, mastered: 0, total: 2, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' },
        emotions: { completed: 0, mastered: 0, total: 2, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' },
        questions: { completed: 0, mastered: 0, total: 1, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' },
        phrases: { completed: 0, mastered: 0, total: 8, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' },
        conversations: { completed: 0, mastered: 0, total: 10, attempts: 0, correct: 0, incorrect: 0, accuracy: 0, needsReview: 0, masteryScore: 0, status: 'untouched' }
      }
    };
  }

  loadProfile() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const def = this.getDefaultProfile();
            const merged = { ...def, ...parsed };

            // Sanitize & validate fields defensively against corrupted or legacy storage
            merged.learnerName = (typeof parsed.learnerName === 'string' && parsed.learnerName.trim().length > 0)
              ? parsed.learnerName.trim().slice(0, 30)
              : def.learnerName;

            merged.currentLevel = ['beginner', 'intermediate', 'advanced'].includes((parsed.currentLevel || '').toLowerCase())
              ? parsed.currentLevel.toLowerCase()
              : def.currentLevel;

            merged.levelProgress = Number.isFinite(parsed.levelProgress)
              ? Math.max(0, Math.min(100, Math.round(parsed.levelProgress)))
              : def.levelProgress;

            merged.accuracyRate = Number.isFinite(parsed.accuracyRate)
              ? Math.max(0, Math.min(100, Math.round(parsed.accuracyRate)))
              : def.accuracyRate;

            merged.totalAttempts = Math.max(0, Number(parsed.totalAttempts) || 0);
            merged.correctAnswers = Math.max(0, Number(parsed.correctAnswers) || 0);
            merged.incorrectAnswers = Math.max(0, Number(parsed.incorrectAnswers) || 0);
            merged.currentStreak = Math.max(0, Number(parsed.currentStreak) || 0);
            merged.bestStreak = Math.max(0, Number(parsed.bestStreak) || 0);
            merged.lessonCompletionCount = Math.max(0, Number(parsed.lessonCompletionCount) || 0);
            merged.totalPracticeAttempts = Math.max(0, Number(parsed.totalPracticeAttempts) || 0);

            merged.activeGoal = (typeof parsed.activeGoal === 'string' && parsed.activeGoal.trim().length > 0)
              ? parsed.activeGoal.trim()
              : def.activeGoal;

            merged.recommendedArea = (typeof parsed.recommendedArea === 'string' && parsed.recommendedArea.trim().length > 0)
              ? parsed.recommendedArea.trim()
              : def.recommendedArea;

            merged.lastRecommendationState = (typeof parsed.lastRecommendationState === 'string' && parsed.lastRecommendationState.trim().length > 0)
              ? parsed.lastRecommendationState.trim()
              : def.lastRecommendationState;

            if (Number.isFinite(parsed.selectedPlaybackSpeed) && parsed.selectedPlaybackSpeed > 0) {
              merged.selectedPlaybackSpeed = parsed.selectedPlaybackSpeed;
            } else {
              merged.selectedPlaybackSpeed = def.selectedPlaybackSpeed;
            }

            // Sanitized arrays
            merged.reviewQueue = Array.isArray(parsed.reviewQueue)
              ? parsed.reviewQueue.filter(id => id !== null && id !== undefined).map(String)
              : [];

            merged.practiceHistory = Array.isArray(parsed.practiceHistory)
              ? parsed.practiceHistory.filter(h => h && typeof h === 'object').slice(0, 30)
              : [];

            merged.recentResults = Array.isArray(parsed.recentResults)
              ? parsed.recentResults.filter(r => typeof r === 'boolean').slice(-15)
              : [];

            // Item mastery: validate each item structure with extended analytics
            merged.itemMastery = {};
            if (parsed.itemMastery && typeof parsed.itemMastery === 'object' && !Array.isArray(parsed.itemMastery)) {
              const validStatuses = ['new', 'learning', 'practicing', 'mastered', 'needs_review'];
              for (const [id, stat] of Object.entries(parsed.itemMastery)) {
                if (stat && typeof stat === 'object') {
                  merged.itemMastery[id] = {
                    status: validStatuses.includes(stat.status) ? stat.status : 'new',
                    attempts: Math.max(0, Number(stat.attempts) || 0),
                    correct: Math.max(0, Number(stat.correct) || 0),
                    accuracy: Math.max(0, Math.min(100, Math.round(Number(stat.accuracy) || 0))),
                    consecutiveCorrect: Math.max(0, Number(stat.consecutiveCorrect) || 0),
                    consecutiveFailures: Math.max(0, Number(stat.consecutiveFailures) || 0),
                    practiceAttempts: Math.max(0, Number(stat.practiceAttempts) || 0),
                    lastPracticed: stat.lastPracticed ? Number(stat.lastPracticed) : null,
                    reviewPriority: Math.max(0, Number(stat.reviewPriority) || 0)
                  };
                }
              }
            }

            // Category stats with composite mastery metrics
            merged.categoryStats = { ...def.categoryStats };
            if (parsed.categoryStats && typeof parsed.categoryStats === 'object') {
              const validCatStatuses = ['untouched', 'in_progress', 'mastered', 'needs_improvement'];
              for (const [cat, cstat] of Object.entries(parsed.categoryStats)) {
                if (cstat && typeof cstat === 'object') {
                  merged.categoryStats[cat] = {
                    completed: Math.max(0, Number(cstat.completed) || 0),
                    mastered: Math.max(0, Number(cstat.mastered) || 0),
                    total: Math.max(0, Number(cstat.total) || def.categoryStats[cat]?.total || 10),
                    attempts: Math.max(0, Number(cstat.attempts) || 0),
                    correct: Math.max(0, Number(cstat.correct) || 0),
                    incorrect: Math.max(0, Number(cstat.incorrect) || 0),
                    accuracy: Math.max(0, Math.min(100, Math.round(Number(cstat.accuracy) || 0))),
                    needsReview: Math.max(0, Number(cstat.needsReview) || 0),
                    masteryScore: Math.max(0, Math.min(100, Math.round(Number(cstat.masteryScore) || 0))),
                    status: validCatStatuses.includes(cstat.status) ? cstat.status : 'untouched'
                  };
                }
              }
            }

            return merged;
          }
        }
      }
    } catch (e) {
      console.warn('[LearnerProfile] Failed to parse profile, resetting with defaults:', e);
    }
    return this.getDefaultProfile();
  }

  save() {
    try {
      this.data.lastActive = Date.now();
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(this.data);
        localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
        try {
          localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
        } catch {}
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('learnerProfileUpdated', { detail: { profile: this.data } }));
      }
    } catch (e) {
      console.error('[LearnerProfile] Failed to save profile:', e);
    }
  }

  reset() {
    this.data = this.getDefaultProfile();
    this.save();
  }

  setLearnerName(name) {
    if (name && typeof name === 'string' && name.trim().length > 0) {
      this.data.learnerName = name.trim().slice(0, 30);
      this.save();
    }
    return this.data.learnerName;
  }

  getItemStats(itemId) {
    if (!this.data.itemMastery[itemId]) {
      this.data.itemMastery[itemId] = {
        status: 'new',
        attempts: 0,
        correct: 0,
        accuracy: 0,
        consecutiveCorrect: 0,
        consecutiveFailures: 0,
        practiceAttempts: 0,
        lastPracticed: null,
        reviewPriority: 0
      };
    }
    return this.data.itemMastery[itemId];
  }

  recordPracticeAttempt(itemId, reps = 1) {
    const stat = this.getItemStats(itemId);
    stat.practiceAttempts = (stat.practiceAttempts || 0) + reps;
    stat.lastPracticed = Date.now();
    if (stat.status === 'new') {
      stat.status = 'learning';
    }
    this.data.totalPracticeAttempts = (this.data.totalPracticeAttempts || 0) + reps;
    this.save();
    return stat;
  }

  recordAttempt(itemId, reps = 1) {
    return this.recordPracticeAttempt(itemId, reps);
  }

  getMasteredCount() {
    return Object.values(this.data.itemMastery).filter(item => item.status === 'mastered').length;
  }

  getCompletedCount() {
    return Object.values(this.data.itemMastery).filter(item => item.attempts > 0).length;
  }

  getSignsLearnedCount() {
    return this.getMasteredCount();
  }

  getSignsInProgressCount() {
    return Object.values(this.data.itemMastery).filter(item => item.attempts > 0 && item.status !== 'mastered').length;
  }

  getPracticePerformance() {
    const p = this.data;
    return {
      totalAttempts: p.totalAttempts,
      correctAnswers: p.correctAnswers,
      incorrectAnswers: p.incorrectAnswers,
      accuracyRate: p.accuracyRate,
      currentStreak: p.currentStreak,
      bestStreak: p.bestStreak,
      lessonCompletionCount: p.lessonCompletionCount,
      practiceAttempts: p.totalPracticeAttempts || 0
    };
  }

  getLearningGaps() {
    const p = this.data;
    const gapIds = new Set(p.reviewQueue || []);
    // Also include items with attempts >= 1 and accuracy < 60%
    for (const [id, stat] of Object.entries(p.itemMastery || {})) {
      if (stat.attempts >= 1 && stat.accuracy < 60) {
        gapIds.add(id);
      }
    }
    return Array.from(gapIds);
  }

  addToReviewQueue(signId) {
    const id = String(signId);
    if (!Array.isArray(this.data.reviewQueue)) this.data.reviewQueue = [];
    if (!this.data.reviewQueue.includes(id)) {
      this.data.reviewQueue.push(id);
      if (!this.data.itemMastery[id]) {
        this.getItemStats(id);
      }
      if (this.data.itemMastery[id].status !== 'mastered') {
        this.data.itemMastery[id].status = 'needs_review';
      }
      this.save();
      return true;
    }
    return false;
  }

  removeFromReviewQueue(signId) {
    const id = String(signId);
    if (!Array.isArray(this.data.reviewQueue)) return false;
    const initialLen = this.data.reviewQueue.length;
    this.data.reviewQueue = this.data.reviewQueue.filter(x => x !== id);
    if (this.data.reviewQueue.length !== initialLen) {
      if (this.data.itemMastery[id] && this.data.itemMastery[id].status === 'needs_review') {
        this.data.itemMastery[id].status = this.data.itemMastery[id].attempts > 0 ? 'learning' : 'new';
      }
      this.save();
      return true;
    }
    return false;
  }

  toggleReviewQueue(signId) {
    if (this.isInReviewQueue(signId)) {
      this.removeFromReviewQueue(signId);
      return false;
    } else {
      this.addToReviewQueue(signId);
      return true;
    }
  }

  isInReviewQueue(signId) {
    const id = String(signId);
    return Array.isArray(this.data.reviewQueue) && this.data.reviewQueue.includes(id);
  }

  /**
   * Generates a personalized recommendation following the chain:
   * Learner Profile → current level → learning history → practice performance → learning gaps → recommended ISL content
   * @param {Object|null} repository 
   * @returns {Object} Recommendation object
   */
  getRecommendation(repository = null) {
    const rec = recommendationEngine.getPrimaryRecommendation(this.data, repository);
    this.data.recommendedArea = rec.areaTitle;
    this.data.lastRecommendationState = rec.stateId;
    return rec;
  }

  /**
   * Returns a diverse set of recommendation cards across all 5 recommendation states:
   * Recommended for You, Continue Learning, Practice Again, Review Weak Signs, Next Level Preparation
   */
  getMultiRecommendations(repository = null, limit = 4) {
    return recommendationEngine.getMultiRecommendations(this.data, repository, limit);
  }

  getMasteredContent(repository = null) {
    const results = [];
    for (const [id, stat] of Object.entries(this.data.itemMastery || {})) {
      if (stat && stat.status === 'mastered') {
        let item = repository ? (repository.getItemById(id, this.data) || repository.getItemById(`alpha-${String(id).toLowerCase()}`, this.data) || repository.getItemById(`num-${String(id).toLowerCase()}`, this.data)) : null;
        if (!item) {
          const fallback = SIGN_LIBRARY.find(s => s.id === id || s.word.toLowerCase() === String(id).toLowerCase());
          if (fallback) item = { ...fallback, sentence: fallback.word, source: 'sign_library' };
        }
        if (item) results.push({ item, stat });
      }
    }
    return results;
  }

  getWeakContent(repository = null) {
    const results = [];
    for (const [id, stat] of Object.entries(this.data.itemMastery || {})) {
      if (!stat || (stat.attempts === 0 && (stat.practiceAttempts || 0) === 0)) continue;
      const isWeak = (stat.consecutiveFailures || 0) >= 2 || stat.accuracy < 60 || stat.status === 'needs_review' || (this.data.reviewQueue || []).includes(id);
      if (isWeak && stat.status !== 'mastered') {
        let item = repository ? (repository.getItemById(id, this.data) || repository.getItemById(`alpha-${String(id).toLowerCase()}`, this.data) || repository.getItemById(`num-${String(id).toLowerCase()}`, this.data)) : null;
        if (!item) {
          const fallback = SIGN_LIBRARY.find(s => s.id === id || s.word.toLowerCase() === String(id).toLowerCase());
          if (fallback) item = { ...fallback, sentence: fallback.word, source: 'sign_library' };
        }
        if (item) results.push({ item, stat, priority: stat.reviewPriority || 50 });
      }
    }
    results.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return results;
  }

  getForgottenReviewContent(repository = null, maxAgeMs = 3 * 86400000) {
    const now = Date.now();
    const results = [];
    for (const [id, stat] of Object.entries(this.data.itemMastery || {})) {
      if (!stat || stat.attempts === 0 || !stat.lastPracticed) continue;
      const isOverdue = (now - stat.lastPracticed) > maxAgeMs;
      const inQueue = (this.data.reviewQueue || []).includes(id);
      if (isOverdue || inQueue) {
        let item = repository ? (repository.getItemById(id, this.data) || repository.getItemById(`alpha-${String(id).toLowerCase()}`, this.data) || repository.getItemById(`num-${String(id).toLowerCase()}`, this.data)) : null;
        if (!item) {
          const fallback = SIGN_LIBRARY.find(s => s.id === id || s.word.toLowerCase() === String(id).toLowerCase());
          if (fallback) item = { ...fallback, sentence: fallback.word, source: 'sign_library' };
        }
        if (item) results.push({ item, stat, ageDays: Math.round((now - stat.lastPracticed) / 86400000) });
      }
    }
    return results;
  }

  getUntouchedContent(repository = null) {
    const untouched = [];
    const source = (repository && repository.isLoaded) ? repository.items : SIGN_LIBRARY;
    for (const item of source) {
      const stat = this.data.itemMastery[item.id];
      if (!stat || (stat.attempts === 0 && (stat.practiceAttempts || 0) === 0)) {
        untouched.push(item);
      }
    }
    return untouched;
  }

  getCategoriesNeedingImprovement() {
    const results = [];
    for (const [cat, stat] of Object.entries(this.data.categoryStats || {})) {
      if (stat.status === 'needs_improvement' || stat.needsReview > 0 || (stat.attempts >= 3 && stat.accuracy < 65)) {
        results.push({ category: cat, ...stat });
      }
    }
    return results;
  }

  getMasteredCategories() {
    const results = [];
    for (const [cat, stat] of Object.entries(this.data.categoryStats || {})) {
      if (stat.status === 'mastered' || (stat.mastered >= 3 && (stat.masteryScore || 0) >= 75)) {
        results.push({ category: cat, ...stat });
      }
    }
    return results;
  }

  getAnalyticsSummary(repository = null) {
    const p = this.data;
    const mastered = this.getMasteredContent(repository);
    const weak = this.getWeakContent(repository);
    const forgotten = this.getForgottenReviewContent(repository);
    const categoriesNeedingWork = this.getCategoriesNeedingImprovement();
    const masteredCats = this.getMasteredCategories();
    const hasData = p.totalAttempts > 0 || (p.totalPracticeAttempts || 0) > 0;

    return {
      learnerName: p.learnerName,
      currentLevel: p.currentLevel,
      overallProgress: p.levelProgress,
      signsLearned: mastered.length,
      signsInProgress: this.getSignsInProgressCount(),
      accuracyRate: hasData ? p.accuracyRate : 0,
      hasSufficientData: hasData,
      totalAttempts: p.totalAttempts,
      totalPracticeAttempts: p.totalPracticeAttempts || 0,
      currentStreak: p.currentStreak,
      bestStreak: p.bestStreak,
      needsReviewCount: (p.reviewQueue || []).length,
      weakContentCount: weak.length,
      forgottenReviewCount: forgotten.length,
      categoriesNeedingImprovement: categoriesNeedingWork,
      masteredCategories: masteredCats,
      categoryStats: p.categoryStats,
      recommendedArea: p.recommendedArea,
      lastRecommendationState: p.lastRecommendationState
    };
  }

  updateCategoryStats(repository = null) {
    const cats = Object.keys(this.data.categoryStats);
    cats.forEach(cat => {
      const signs = SIGN_LIBRARY.filter(s => s.category === cat);
      let totalCount = signs.length;
      if (repository && repository.isLoaded) {
        const repoMatching = repository.items.filter(s => s.category === cat);
        if (repoMatching.length > 0) totalCount = repoMatching.length;
      }

      let completed = 0;
      let mastered = 0;
      let totalCorrect = 0;
      let totalAttempts = 0;
      let incorrect = 0;
      let needsReview = 0;

      for (const [id, stat] of Object.entries(this.data.itemMastery || {})) {
        if (!stat) continue;
        let itemCat = null;
        const libSign = SIGN_LIBRARY.find(s => s.id === id || s.word.toLowerCase() === String(id).toLowerCase());
        if (libSign) {
          itemCat = libSign.category;
        } else if (repository && repository.isLoaded) {
          const repoSign = repository.getItemById(id) || repository.getItemById(`alpha-${String(id).toLowerCase()}`) || repository.getItemById(`num-${String(id).toLowerCase()}`);
          if (repoSign) itemCat = repoSign.category;
        }

        if (itemCat === cat) {
          if (stat.attempts > 0 || stat.practiceAttempts > 0) completed++;
          totalCorrect += (stat.correct || 0);
          totalAttempts += (stat.attempts || 0);
          incorrect += Math.max(0, (stat.attempts || 0) - (stat.correct || 0));
          if (stat.status === 'mastered') mastered++;
          if (this.data.reviewQueue.includes(id) || stat.status === 'needs_review' || (stat.consecutiveFailures || 0) >= 2) {
            needsReview++;
          }
        }
      }

      const acc = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

      // Calculate composite Performance Mastery Index (0-100%):
      // 1. Mastery ratio: (mastered / targetBenchmark) * 40%
      // 2. Accuracy ratio: (totalCorrect / totalAttempts) * 40%
      // 3. Consistency / low-error ratio: (1 - errorRatio) * 20%
      const targetBenchmark = Math.min(totalCount, cat === 'alphabets' ? 5 : cat === 'numbers' ? 4 : 4);
      const masteryRatio = targetBenchmark > 0 ? Math.min(1, mastered / targetBenchmark) : 0;
      const accRatio = totalAttempts > 0 ? (totalCorrect / totalAttempts) : 0;
      const consistencyRatio = totalAttempts > 0 ? Math.max(0, 1 - (needsReview / Math.max(1, totalAttempts))) : 1;

      let masteryScore = 0;
      if (totalAttempts > 0 || completed > 0) {
        masteryScore = Math.min(100, Math.round((masteryRatio * 40) + (accRatio * 40) + (consistencyRatio * 20)));
      }

      let catStatus = 'untouched';
      if (totalAttempts > 0 || completed > 0) {
        if (needsReview > 0 || (totalAttempts >= 3 && acc < 65)) {
          catStatus = 'needs_improvement';
        } else if (mastered >= 3 && masteryScore >= 70) {
          catStatus = 'mastered';
        } else {
          catStatus = 'in_progress';
        }
      }

      this.data.categoryStats[cat] = {
        completed,
        mastered,
        total: Math.max(totalCount, completed),
        attempts: totalAttempts,
        correct: totalCorrect,
        incorrect,
        accuracy: acc,
        needsReview,
        masteryScore,
        status: catStatus
      };
    });
  }
}

// ============================================================
// ADAPTIVE DIFFICULTY & LESSON SESSION ENGINE
// Manages: LEARN → PRACTICE → QUIZ/ASSESSMENT → RESULT
// ============================================================
export class AdaptiveLearningEngine {
  constructor(learnerProfile) {
    this.profile = learnerProfile;
    this.library = SIGN_LIBRARY;
    this.recalculateLevel();
  }

  /**
   * Deterministically evaluate learner level from performance & consistency.
   * Prioritizes Beginner content (Alphabets, Numbers, Basic Words).
   * Does NOT promote to Intermediate after a single item.
   * Employs hysteresis to prevent unstable flip-flopping.
   */
  recalculateLevel() {
    const p = this.profile.data;
    const total = p.totalAttempts;
    const overallAcc = total > 0 ? (p.correctAnswers / total) * 100 : 0;
    p.accuracyRate = Math.round(overallAcc);

    const recent = p.recentResults.slice(-10);
    const recentAcc = recent.length > 0
      ? (recent.filter(Boolean).length / recent.length) * 100
      : overallAcc;

    const masteredCount = this.profile.getMasteredCount();
    const completedCount = this.profile.getCompletedCount();
    const currentTier = p.currentLevel || 'beginner';

    // Promotion Criteria:
    // Beginner -> Intermediate: requires substantial practice across beginner content!
    // Minimum 12 total attempts, >= 8 completed items, >= 4 mastered items, overallAcc >= 70%, recentAcc >= 65%, reviewQueue <= 1
    const reviewGapsCount = (p.reviewQueue || []).length;
    const qualifiesIntermediate = (total >= 12 && completedCount >= 8 && masteredCount >= 4 && overallAcc >= 70 && recentAcc >= 65 && reviewGapsCount <= 1);
    // Intermediate -> Advanced: >= 30 total attempts, >= 18 completed, >= 8 mastered, overallAcc >= 80%, recentAcc >= 75%, reviewQueue === 0
    const qualifiesAdvanced = (total >= 30 && completedCount >= 18 && masteredCount >= 8 && overallAcc >= 80 && recentAcc >= 75 && reviewGapsCount === 0);

    // Demotion Criteria (with hysteresis):
    const demoteFromAdvanced = (recent.length >= 8 && recentAcc < 55);
    const demoteFromIntermediate = (recent.length >= 8 && recentAcc < 45);

    let nextLevel = currentTier;
    if (currentTier === 'beginner') {
      if (qualifiesIntermediate) nextLevel = 'intermediate';
    } else if (currentTier === 'intermediate') {
      if (qualifiesAdvanced) nextLevel = 'advanced';
      else if (demoteFromIntermediate) nextLevel = 'beginner';
    } else if (currentTier === 'advanced') {
      if (demoteFromAdvanced) nextLevel = 'intermediate';
    }

    p.currentLevel = nextLevel;

    // Genuine, activity-based level progress calculation:
    // If no attempts and no practice reps, progress is strictly 0% (never fabricated)
    if (total === 0 && (p.totalPracticeAttempts || 0) === 0) {
      p.levelProgress = 0;
    } else if (nextLevel === 'beginner') {
      const compScore = Math.min(40, (completedCount / 8) * 40);
      const mastScore = Math.min(35, (masteredCount / 4) * 35);
      const accScore = Math.min(25, (overallAcc / 70) * 25);
      const gapPenalty = Math.min(20, reviewGapsCount * 5);
      p.levelProgress = Math.max(0, Math.min(99, Math.round(compScore + mastScore + accScore - gapPenalty)));
    } else if (nextLevel === 'intermediate') {
      const compScore = Math.min(40, (Math.max(0, completedCount - 8) / 10) * 40);
      const mastScore = Math.min(35, (Math.max(0, masteredCount - 4) / 4) * 35);
      const accScore = Math.min(25, (overallAcc / 80) * 25);
      const gapPenalty = Math.min(20, reviewGapsCount * 5);
      p.levelProgress = Math.max(0, Math.min(99, Math.round(compScore + mastScore + accScore - gapPenalty)));
    } else {
      const mastScore = Math.min(50, (masteredCount / 12) * 50);
      const accScore = Math.min(50, (overallAcc / 85) * 50);
      p.levelProgress = Math.max(0, Math.min(100, Math.round(mastScore + accScore)));
    }

    // Refresh recommendation area title using multi-factor recommendation engine
    const rec = recommendationEngine.getPrimaryRecommendation(p);
    p.recommendedArea = rec.areaTitle;
    p.lastRecommendationState = rec.stateId;

    this.profile.updateCategoryStats();
    this.profile.save();
    return nextLevel;
  }

  /**
   * Build a bite-sized teaching lesson batch:
   * Consumes recommendationEngine when activeGoal === 'all', or respects strict category isolation.
   */
  createLessonBatch(repository = null) {
    const p = this.profile.data;
    const currentTier = DIFFICULTY_LEVELS[(p.currentLevel || 'beginner').toUpperCase()].tier;
    const activeGoal = p.activeGoal || 'all';

    // 1. If activeGoal is 'all', query recommendationEngine for the primary guided lesson
    if (activeGoal === 'all') {
      const rec = recommendationEngine.getPrimaryRecommendation(p, repository);
      if (rec && rec.targetItem) {
        return {
          signs: [rec.targetItem],
          isReview: rec.isGap,
          lessonTitle: `${rec.state.title}: ${rec.targetItem.sentence || rec.targetItem.word}`,
          category: rec.targetItem.category,
          tier: rec.targetItem.proficiencyLevel === 'beginner' ? 1 : rec.targetItem.proficiencyLevel === 'intermediate' ? 2 : 3,
          recommendationState: rec.stateId,
          rationale: rec.rationale
        };
      }
    }

    // 2. Check if review items should be served within specific category
    if (p.reviewQueue.length > 0 && Math.random() < 0.35) {
      // Review items MUST match activeGoal if specific category selected
      const reviewCandidateIds = (activeGoal === 'all')
        ? p.reviewQueue
        : p.reviewQueue.filter(id => {
            const s = this.library.find(item => item.id === id);
            return s && s.category === activeGoal;
          });

      if (reviewCandidateIds.length > 0) {
        const reviewId = reviewCandidateIds[0];
        const reviewSign = this.library.find(s => s.id === reviewId);
        if (reviewSign) {
          return {
            signs: [reviewSign],
            isReview: true,
            lessonTitle: `Review Session: ${reviewSign.word}`,
            category: reviewSign.category,
            tier: reviewSign.difficulty
          };
        }
      }
    }

    // 2. Strict category isolation
    let pool = [];
    if (activeGoal === 'alphabets') {
      // ONLY Alphabets A-Z
      pool = this.library.filter(s => s.category === 'alphabets');
    } else if (activeGoal === 'numbers') {
      // ONLY Numbers 0-9
      pool = this.library.filter(s => s.category === 'numbers');
    } else if (activeGoal !== 'all') {
      // Strict category filtering for any other selected category
      pool = this.library.filter(s => s.category === activeGoal);
    } else {
      // 'all' category: filter by current tier
      pool = this.library.filter(s => {
        return (s.difficulty === currentTier) || (currentTier > 1 && s.difficulty <= currentTier);
      });
      if (pool.length === 0) {
        pool = this.library.filter(s => s.difficulty <= currentTier);
      }
    }

    // Sort: Needs Review > New > Learning > Practicing > Mastered, maintaining clean natural sequence within groups
    const priority = { 'needs_review': 5, 'new': 4, 'learning': 3, 'practicing': 2, 'mastered': 1 };
    pool.sort((a, b) => {
      const statA = this.profile.getItemStats(a.id);
      const statB = this.profile.getItemStats(b.id);
      const prioDiff = (priority[statB.status] || 1) - (priority[statA.status] || 1);
      if (prioDiff !== 0) return prioDiff;
      // Maintain alphabetical or numerical order for untouched signs
      return a.word.localeCompare(b.word, undefined, { numeric: true });
    });

    const chosen = pool.slice(0, 1);
    const sign = chosen[0] || this.library[0];

    return {
      signs: [sign],
      isReview: p.reviewQueue.includes(sign.id),
      lessonTitle: sign.category === 'alphabets'
        ? `Alphabet Lesson: Letter ${sign.word}`
        : sign.category === 'numbers'
          ? `Number Lesson: Number ${sign.word}`
          : `Lesson: ${sign.word}`,
      category: sign.category,
      tier: sign.difficulty
    };
  }

  /**
   * Evaluate quiz answer & update persistent mastery state
   * Supports both SIGN_LIBRARY signs and any of the 2,501 repository sentences/signs
   */
  recordQuizResult(signId, isCorrect, chosenAnswer, signItem = null) {
    const p = this.profile.data;
    const sign = signItem || this.library.find(s => s.id === signId) || {
      id: signId,
      word: signId,
      sentence: signId,
      category: 'general_expression',
      difficulty: 1,
      proficiencyLevel: 'beginner'
    };

    p.totalAttempts++;
    if (isCorrect) {
      p.correctAnswers++;
      p.currentStreak++;
      if (p.currentStreak > p.bestStreak) p.bestStreak = p.currentStreak;
    } else {
      p.incorrectAnswers++;
      p.currentStreak = 0;
      if (!p.reviewQueue.includes(signId)) {
        p.reviewQueue.push(signId);
      }
    }

    p.recentResults.push(isCorrect);
    if (p.recentResults.length > 15) p.recentResults.shift();

    const stat = this.profile.getItemStats(signId);
    stat.attempts++;
    if (isCorrect) {
      stat.correct++;
      stat.consecutiveCorrect = (stat.consecutiveCorrect || 0) + 1;
      stat.consecutiveFailures = 0;
    } else {
      stat.consecutiveCorrect = 0;
      stat.consecutiveFailures = (stat.consecutiveFailures || 0) + 1;
    }
    stat.accuracy = Math.round((stat.correct / stat.attempts) * 100);
    stat.lastPracticed = Date.now();

    // Mastery state advancement with consecutive failures tracking
    const oldStatus = stat.status;
    if (!isCorrect) {
      stat.status = 'needs_review';
    } else if (stat.attempts >= 3 && stat.accuracy >= 75 && stat.consecutiveCorrect >= 2 && (stat.consecutiveFailures || 0) === 0) {
      stat.status = 'mastered';
      p.reviewQueue = p.reviewQueue.filter(id => id !== signId);
    } else if (stat.attempts >= 2) {
      stat.status = 'practicing';
    } else {
      stat.status = 'learning';
    }

    // Dynamic review priority calculation:
    // Higher score indicates urgent revision required
    if (stat.status === 'mastered') {
      stat.reviewPriority = 0;
    } else {
      let prio = 0;
      if (stat.consecutiveFailures >= 2) {
        prio += 50 + (stat.consecutiveFailures * 10);
      } else if (stat.consecutiveFailures === 1) {
        prio += 25;
      }
      if (stat.accuracy < 50) prio += 25;
      else if (stat.accuracy < 70) prio += 10;
      if (p.reviewQueue.includes(signId)) prio += 20;
      stat.reviewPriority = prio;
    }

    p.lessonCompletionCount++;

    const displayWord = sign.sentence || sign.word || signId;
    const difficultyNum = sign.difficulty || (sign.proficiencyLevel === 'beginner' ? 1 : sign.proficiencyLevel === 'intermediate' ? 2 : 3);

    p.practiceHistory.unshift({
      id: `act-${Date.now()}`,
      signId,
      word: displayWord,
      category: sign.category || 'general_expression',
      difficulty: difficultyNum,
      isCorrect,
      chosenAnswer,
      timestamp: Date.now(),
      statusAfter: stat.status
    });
    if (p.practiceHistory.length > 30) p.practiceHistory.pop();

    this.recalculateLevel();

    return {
      isCorrect,
      oldStatus,
      newStatus: stat.status,
      signAccuracy: stat.accuracy,
      consecutiveFailures: stat.consecutiveFailures,
      consecutiveCorrect: stat.consecutiveCorrect,
      reviewPriority: stat.reviewPriority,
      currentLevel: p.currentLevel,
      streak: p.currentStreak,
      overallAccuracy: p.accuracyRate,
      reviewQueueLength: p.reviewQueue.length
    };
  }

  recordPracticeAttempt(signId, reps = 1) {
    return this.profile.recordPracticeAttempt(signId, reps);
  }

  /**
   * Generate interactive assessment questions specifically for the taught signs
   * Strict distractor pool isolation:
   * - Alphabets: only other letters A-Z
   * - Numbers: only other numbers 0-9
   * - Repository signs/sentences: authentic peers from same category/level
   */
  generateAssessment(taughtSigns, preferredType = null, repository = null) {
    return taughtSigns.map(sign => {
      const correctAnswer = sign.sentence || sign.word;
      let distractorPool = [];

      if (sign.category === 'alphabets') {
        distractorPool = getAlphabetDistractors(correctAnswer);
      } else if (sign.category === 'numbers') {
        distractorPool = getNumberDistractors(correctAnswer);
      } else if (sign.distractors && sign.distractors.length >= 3) {
        distractorPool = [...sign.distractors];
      } else {
        if (repository && repository.isLoaded) {
          const peers = repository.getItems({ category: sign.category })
            .map(s => s.sentence || s.word)
            .filter(w => w !== correctAnswer);
          distractorPool.push(...peers);
        }
        const sameCat = this.library
          .filter(s => s.category === sign.category && (s.word || s.sentence) !== correctAnswer)
          .map(s => s.word || s.sentence);
        distractorPool.push(...sameCat);
      }

      // Guarantee 3 unique distractors
      const uniqueDistractors = Array.from(new Set(distractorPool.filter(w => w !== correctAnswer)))
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      // Fallback if needed to reach exactly 3 distractors
      if (uniqueDistractors.length < 3) {
        const fallbackList = (repository && repository.isLoaded)
          ? repository.getItems({ level: sign.proficiencyLevel || 'beginner' }).map(s => s.sentence || s.word)
          : this.library.map(s => s.word);
        for (const w of fallbackList) {
          if (!uniqueDistractors.includes(w) && w !== correctAnswer) {
            uniqueDistractors.push(w);
            if (uniqueDistractors.length === 3) break;
          }
        }
      }

      const options = [correctAnswer, ...uniqueDistractors].sort(() => 0.5 - Math.random());

      // Determine question type:
      let qType = preferredType;
      if (!qType) {
        if (sign.category === 'alphabets' && sign.imageRef) {
          qType = Math.random() < 0.5 ? 'hand_shape_identify' : 'avatar_identify';
        } else if (sign.category === 'numbers' && sign.imageRef) {
          qType = Math.random() < 0.5 ? 'hand_shape_identify' : 'avatar_identify';
        } else if (sign.isPredefinedDataset || sign.animationType === 'bvh') {
          qType = 'avatar_identify';
        } else if (sign.category === 'phrases' || sign.category === 'conversations') {
          qType = 'word_meaning';
        } else {
          qType = Math.random() < 0.5 ? 'avatar_identify' : 'word_meaning';
        }
      }

      let promptText = '';
      let imageRef = null;
      let badgeLabel = 'Avatar Demonstration';

      if (qType === 'hand_shape_identify' && sign.imageRef) {
        promptText = sign.category === 'alphabets'
          ? `Which ISL alphabet letter does this authoritative hand shape represent?`
          : `Which ISL number (0–9) does this authoritative hand shape represent?`;
        imageRef = sign.imageRef;
        badgeLabel = sign.category === 'alphabets' ? 'Alphabet Hand-Shape Check' : 'Number Hand-Shape Check';
      } else if (sign.category === 'alphabets') {
        promptText = `Which ISL alphabet letter is demonstrated by the 3D avatar?`;
        badgeLabel = 'ISL Alphabet Recognition';
      } else if (sign.category === 'numbers') {
        promptText = `Which number (0–9) is represented by the 3D avatar?`;
        badgeLabel = 'Number Sign Recognition';
      } else if (sign.isPredefinedDataset || sign.animationType === 'bvh') {
        promptText = `Which sentence or statement is communicated by this 3D ISL avatar signing demonstration?`;
        badgeLabel = `ISL Sentence Comprehension (${(sign.proficiencyLevel || 'beginner').toUpperCase()})`;
      } else if (sign.category === 'phrases' || sign.category === 'conversations') {
        promptText = `Which phrase or meaning is communicated by this ISL demonstration?`;
        badgeLabel = 'Phrase Comprehension';
      } else {
        promptText = `Identify the everyday word or concept demonstrated by the avatar:`;
        badgeLabel = 'Vocabulary Recognition';
      }

      return {
        signId: sign.id,
        sign,
        qType,
        correctAnswer,
        options,
        promptText,
        imageRef,
        badgeLabel
      };
    });
  }

  /**
   * Create a milestone review session batch using previously learned or review-queued signs
   */
  createReviewBatch() {
    const p = this.profile.data;
    const activeGoal = p.activeGoal || 'all';
    let reviewSign = null;

    // First check reviewQueue matching activeGoal
    if (p.reviewQueue.length > 0) {
      const qId = p.reviewQueue.find(id => {
        const s = this.library.find(item => item.id === id);
        return s && (activeGoal === 'all' || s.category === activeGoal);
      });
      if (qId) reviewSign = this.library.find(s => s.id === qId);
    }

    // Otherwise pick a previously completed sign with lowest accuracy in current category
    if (!reviewSign) {
      const completedIds = Object.keys(p.itemMastery).filter(id => {
        const s = this.library.find(item => item.id === id);
        return s && (activeGoal === 'all' || s.category === activeGoal) && (p.itemMastery[id].attempts > 0);
      });
      if (completedIds.length > 0) {
        completedIds.sort((a, b) => (p.itemMastery[a].accuracy || 0) - (p.itemMastery[b].accuracy || 0));
        reviewSign = this.library.find(s => s.id === completedIds[0]);
      }
    }

    if (!reviewSign) {
      return this.createLessonBatch();
    }

    return {
      signs: [reviewSign],
      isReview: true,
      lessonTitle: `Review Challenge: ${reviewSign.word}`,
      category: reviewSign.category,
      tier: reviewSign.difficulty
    };
  }

  getPlaybackSettings() {
    const levelKey = (this.profile.data.currentLevel || 'beginner').toUpperCase();
    const config = DIFFICULTY_LEVELS[levelKey] || DIFFICULTY_LEVELS.BEGINNER;
    return {
      level: config.id,
      presets: config.speedPresets,
      defaultSpeed: config.defaultSpeed
    };
  }
}

// ============================================================
// AUTHORITATIVE SIGN SELECTION & EXACT MATCHING PIPELINE
// Strict accuracy rules:
// - Exact normalized match prioritized first (No fuzzy hijacking)
// - Whole-keyword matching only when no direct match exists
// - Deterministic fallback (fingerspelling) for unknown words
// - Internal test suite verifying A-Z, 0-9, core signs & phrases
// ============================================================

/**
 * Normalizes user input for sign matching:
 * - Trims whitespace
 * - Collapses consecutive spaces
 * - Lowercases
 * - Strips harmless punctuation (. , ! ? ; : " ' - etc.)
 * - Preserves semantic word tokens
 */
export function normalizeSignQuery(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Authoritative Exact Sign Matcher for Learn Sign Language.
 * Prioritizes:
 * 1. Single character check (A-Z or 0-9)
 * 2. Exact word, gloss, or ID match
 * 3. Exact whole-keyword match
 * 4. Deterministic fallback (exact fingerspelling of input, NEVER an unrelated sign)
 */
export function matchSignExact(input) {
  const norm = normalizeSignQuery(input);
  if (!norm) return null;

  // Tier 1: Single character check (Alphabet A-Z or Number 0-9)
  if (norm.length === 1) {
    if (/[a-z]/.test(norm)) {
      const alphaSign = SIGN_LIBRARY.find(s => s.id === `alpha-${norm}`);
      if (alphaSign) {
        return {
          sign: alphaSign,
          matchType: 'exact_alphabet',
          score: 1.0,
          query: input,
          normalized: norm,
          expectedAnimation: alphaSign.signRef
        };
      }
    } else if (/[0-9]/.test(norm)) {
      const numSign = SIGN_LIBRARY.find(s => s.id === `num-${norm}`);
      if (numSign) {
        return {
          sign: numSign,
          matchType: 'exact_number',
          score: 1.0,
          query: input,
          normalized: norm,
          expectedAnimation: numSign.signRef
        };
      }
    }
  }

  // Tier 2: Strict Exact word or gloss or ID match
  for (const s of SIGN_LIBRARY) {
    const sWord = normalizeSignQuery(s.word);
    const sGloss = normalizeSignQuery(s.gloss);
    const sId = normalizeSignQuery(s.id);
    const sRef = normalizeSignQuery(s.signRef);

    if (sWord === norm || sGloss === norm || sId === norm || sRef === norm) {
      return {
        sign: s,
        matchType: 'exact_sign',
        score: 1.0,
        query: input,
        normalized: norm,
        expectedAnimation: s.signRef
      };
    }
  }

  // Tier 3: Strict Whole-keyword exact match
  for (const s of SIGN_LIBRARY) {
    if (Array.isArray(s.keywords)) {
      for (const kw of s.keywords) {
        if (normalizeSignQuery(kw) === norm) {
          return {
            sign: s,
            matchType: 'exact_keyword',
            score: 0.95,
            query: input,
            normalized: norm,
            expectedAnimation: s.signRef
          };
        }
      }
    }
  }

  // Tier 4: Fallback — Deterministic fingerspelling of the EXACT input (never random/unrelated sign)
  const cleanWord = input.trim();
  const fallbackSign = {
    id: `fallback-${norm.replace(/\s+/g, '-')}`,
    word: cleanWord,
    category: 'words',
    difficulty: 1,
    gloss: norm.toUpperCase(),
    animationType: norm.length === 1 ? 'letter' : 'spell',
    signRef: norm.toUpperCase(),
    fallbackSpell: norm.toUpperCase(),
    instruction: `Fingerspelling for "${cleanWord}".`,
    hint: `Fingerspelled sequence for "${cleanWord}".`
  };

  return {
    sign: fallbackSign,
    matchType: 'deterministic_fallback',
    score: 0.5,
    query: input,
    normalized: norm,
    expectedAnimation: fallbackSign.signRef
  };
}

/**
 * Ranked Search for Library Studio Grid
 * Multi-tier ranking ensures exact matches appear at index 0:
 * 1. Exact matches (word, gloss, id)
 * 2. Word prefix matches (starts with)
 * 3. Gloss prefix / Exact whole-keyword matches
 * 4. Substring matches
 */
export function searchSignLibrary(query) {
  const q = normalizeSignQuery(query);
  if (!q) return [];

  const exactMatches = [];
  const prefixWordMatches = [];
  const prefixGlossMatches = [];
  const substringMatches = [];
  const seen = new Set();

  for (const s of SIGN_LIBRARY) {
    const sWord = normalizeSignQuery(s.word);
    const sGloss = normalizeSignQuery(s.gloss);
    const sId = normalizeSignQuery(s.id);
    if (sWord === q || sGloss === q || sId === q) {
      exactMatches.push(s);
      seen.add(s.id);
    }
  }

  for (const s of SIGN_LIBRARY) {
    if (seen.has(s.id)) continue;
    if (normalizeSignQuery(s.word).startsWith(q)) {
      prefixWordMatches.push(s);
      seen.add(s.id);
    }
  }

  for (const s of SIGN_LIBRARY) {
    if (seen.has(s.id)) continue;
    const sGloss = normalizeSignQuery(s.gloss);
    const exactKw = s.keywords?.some(k => normalizeSignQuery(k) === q);
    if (sGloss.startsWith(q) || exactKw) {
      prefixGlossMatches.push(s);
      seen.add(s.id);
    }
  }

  for (const s of SIGN_LIBRARY) {
    if (seen.has(s.id)) continue;
    const sWord = normalizeSignQuery(s.word);
    const sGloss = normalizeSignQuery(s.gloss);
    const kwSub = s.keywords?.some(k => normalizeSignQuery(k).includes(q));
    if (sWord.includes(q) || sGloss.includes(q) || kwSub) {
      substringMatches.push(s);
      seen.add(s.id);
    }
  }

  return [
    ...exactMatches,
    ...prefixWordMatches,
    ...prefixGlossMatches,
    ...substringMatches
  ];
}

/**
 * Comprehensive Accuracy Audit Test Suite
 * Tests:
 * - A-Z (26 alphabets)
 * - 0-9 (10 numbers)
 * - Core signs: HELLO, THANK YOU, PLEASE, SORRY, YES, NO, FAMILY, HOME
 * - Conversational phrases
 * Verifies INPUT -> EXPECTED GLOSS -> EXPECTED SIGN ID -> EXPECTED ANIMATION -> ACTUAL ANIMATION
 */
export function runSignAccuracyAudit() {
  const testSuite = [
    // Alphabets A-Z
    ...('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => ({
      input: char,
      expectedGloss: char,
      expectedSignId: `alpha-${char.toLowerCase()}`,
      expectedAnimation: char
    }))),
    // Numbers 0-9
    ...('0123456789'.split('').map(num => ({
      input: num,
      expectedGloss: num,
      expectedSignId: `num-${num}`,
      expectedAnimation: num
    }))),
    // Core Signs
    { input: 'HELLO', expectedGloss: 'HELLO', expectedSignId: 'g-hello', expectedAnimation: 'HELLO' },
    { input: 'HI', expectedGloss: 'HI', expectedSignId: 'g-hi', expectedAnimation: 'HI' },
    { input: 'THANK YOU', expectedGloss: 'THANKS', expectedSignId: 'g-thanks', expectedAnimation: 'THANKS' },
    { input: 'PLEASE', expectedGloss: 'PLEASE', expectedSignId: 'g-please', expectedAnimation: 'PLEASE' },
    { input: 'SORRY', expectedGloss: 'SORRY', expectedSignId: 'g-sorry', expectedAnimation: 'SORRY' },
    { input: 'YES', expectedGloss: 'YES', expectedSignId: 'w-yes', expectedAnimation: 'YES' },
    { input: 'NO', expectedGloss: 'NO', expectedSignId: 'w-no', expectedAnimation: 'NO' },
    { input: 'FAMILY', expectedGloss: 'FAMILY', expectedSignId: 'fam-family', expectedAnimation: 'FAMILY' },
    { input: 'HOME', expectedGloss: 'HOME', expectedSignId: 'w-home', expectedAnimation: 'HOME' },
    { input: 'WATER', expectedGloss: 'WATER', expectedSignId: 'w-water', expectedAnimation: 'WATER' },
    { input: 'FOOD', expectedGloss: 'FOOD', expectedSignId: 'w-food', expectedAnimation: 'FOOD' },
    { input: 'SCHOOL', expectedGloss: 'SCHOOL', expectedSignId: 'w-school', expectedAnimation: 'SCHOOL' },
    { input: 'BOOK', expectedGloss: 'BOOK', expectedSignId: 'w-book', expectedAnimation: 'BOOK' },
    // Phrases & Conversations
    { input: 'How are you?', expectedGloss: 'HOW ARE YOU', expectedSignId: 'p-howru', expectedAnimation: 'HOW ARE YOU' },
    { input: 'Nice to meet you', expectedGloss: 'NICE MEET', expectedSignId: 'p-nicemeet', expectedAnimation: 'NICE MEET' },
    { input: 'Can I stay here tonight?', expectedGloss: 'STAY HERE TONIGHT ME?', expectedSignId: 'c-canistay', expectedAnimation: 'Train/1003115/1003115.bvh' },
    { input: 'What a nice thing to say!', expectedGloss: 'NICE THING SAY//', expectedSignId: 'c-nicething', expectedAnimation: 'Train/1003242/1003242.bvh' },
    { input: 'Please lock the safe.', expectedGloss: 'SAFE LOCK PLEASE//', expectedSignId: 'c-pleaselock', expectedAnimation: 'Train/1003552/1003552.bvh' },
    { input: 'He is better than me at math.', expectedGloss: 'ME MATH BETTER THAN HIM//', expectedSignId: 'c-bettermath', expectedAnimation: 'Train/1005354/1005354.bvh' },
    { input: 'I like the green colour.', expectedGloss: 'GREEN COLOUR LIKE ME//', expectedSignId: 'c-greencolor', expectedAnimation: 'Train/1020329/1020329.bvh' },
    { input: 'Please give me a coffee.', expectedGloss: 'COFFEE GIVE ME NOW//', expectedSignId: 'c-givecoffee', expectedAnimation: 'Train/1035116/1035116.bvh' },
    { input: 'That will not be a problem.', expectedGloss: 'THAT PROBLEM NOT BE//', expectedSignId: 'c-noproblem', expectedAnimation: 'Train/1111601/1111601.bvh' },
    { input: 'I am really happy!', expectedGloss: 'ME HAPPY REALLY//', expectedSignId: 'c-happy', expectedAnimation: 'Train/1232236/1232236.bvh' }
  ];

  const results = [];
  let passedCount = 0;

  for (const t of testSuite) {
    const matched = matchSignExact(t.input);
    const sign = matched?.sign;
    const actualGloss = sign?.gloss;
    const actualSignId = sign?.id;
    const actualAnimation = sign?.signRef;

    const isGlossMatch = normalizeSignQuery(actualGloss) === normalizeSignQuery(t.expectedGloss);
    const isIdMatch = actualSignId === t.expectedSignId;
    const isAnimMatch = actualAnimation === t.expectedAnimation;
    const isAccurate = isGlossMatch && isIdMatch && isAnimMatch;

    if (isAccurate) passedCount++;

    results.push({
      input: t.input,
      normalized: matched?.normalized,
      expectedGloss: t.expectedGloss,
      actualGloss,
      expectedSignId: t.expectedSignId,
      actualSignId,
      expectedAnimation: t.expectedAnimation,
      actualAnimation,
      accurate: isAccurate
    });
  }

  const accuracyRate = Math.round((passedCount / testSuite.length) * 100);
  const auditReport = {
    total: testSuite.length,
    totalTests: testSuite.length,
    passed: passedCount,
    passedCount,
    failed: testSuite.length - passedCount,
    failedCount: testSuite.length - passedCount,
    accuracyPct: accuracyRate,
    accuracyRate: `${accuracyRate}%`,
    status: passedCount === testSuite.length ? 'ALL_PASSED' : 'FAILURES_DETECTED',
    results
  };

  console.log(`[SignLearn Audit Suite] Completed ${testSuite.length} tests: ${passedCount} passed, ${testSuite.length - passedCount} failed (${accuracyRate}% accurate).`);
  return auditReport;
}
