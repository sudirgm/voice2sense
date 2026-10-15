/**
 * ============================================================================
 * Voice 2 Sense — Academic AI Service
 * 
 * Central Two-Way Syllabus-Aware Offline Academic Learning Engine:
 * - Multi-turn conversational session history & follow-up context resolution
 * - Deep syllabus integration with PersonalizedLearningEngine (active bundle,
 *   grade level, subjects, units, concepts, mastery, prerequisites)
 * - Multi-modal response generation:
 *     1. Direct Answer
 *     2. Simple Explanation (calibrated to learner's grade level)
 *     3. Real-World / Visual Example
 *     4. Important Points (bulleted key takeaways)
 *     5. Key ISL Concept Terms (mapped to 3D Avatar vocabulary)
 *     6. Direct Lesson Jump Link (to 7-stage Digital Classroom Studio)
 * - Strict offline execution: local deterministic curriculum knowledge graph
 *   with graceful fallback to general academic science/math/IT principles.
 * ============================================================================
 */

import { CURRICULUM } from './curriculum.js';

// Pre-compiled general academic knowledge base for foundational science, math, and digital concepts
const GENERAL_ACADEMIC_KNOWLEDGE = {
  'newton_second_law': {
    aliases: ["newton's second law", "newtons second law", "second law of motion", "f=ma", "force mass acceleration", "newton 2nd law", "newton second law"],
    subject: "Physics",
    topic: "Laws of Motion",
    gradeLevel: "Class 9–10 (Secondary)",
    directAnswer: "Newton's Second Law of Motion states that the rate of change of momentum of an object is directly proportional to the applied unbalanced force, and takes place in the direction in which the force acts. In standard mathematical form: **F = m × a** (Force = Mass × Acceleration).",
    simpleExplanation: "If you push an object harder (more Force), it speeds up faster (more Acceleration). But if the object is heavier (more Mass), it needs a much bigger push to get that same speed change. In simple terms: heavier things are harder to accelerate, and harder pushes create faster movement.",
    example: "Imagine pushing an empty shopping cart versus a cart completely loaded with heavy textbooks. If you push both carts with the exact same muscle force, the empty cart accelerates forward very quickly, while the heavy cart moves forward much more slowly because its greater mass resists acceleration.",
    importantPoints: [
      "Formula: F = m · a (Force = Mass × Acceleration).",
      "SI Unit of Force is the Newton (N), where 1 N = 1 kg·m/s².",
      "Acceleration is directly proportional to net force and inversely proportional to mass.",
      "When net force is zero, acceleration is zero (which directly connects back to Newton's First Law)."
    ],
    keyIslTerms: ["FORCE", "WHAT", "FUNCTION", "SCIENCE"],
    relatedConcepts: ["Newton's First Law", "Inertia", "Momentum", "Mass"]
  },
  'newton_first_law': {
    aliases: ["newton's first law", "newtons first law", "first law of motion", "law of inertia", "inertia", "newton first law"],
    subject: "Physics",
    topic: "Laws of Motion",
    gradeLevel: "Class 9–10 (Secondary)",
    directAnswer: "Newton's First Law of Motion states that an object at rest stays at rest, and an object in motion stays in motion with the same speed and in the same direction, unless acted upon by an unbalanced external force.",
    simpleExplanation: "Things cannot start, stop, or change direction all by themselves. They need an outside push or pull (force) to change what they are doing. This natural resistance to change in motion is called inertia.",
    example: "When a moving bus suddenly hits the brakes, your upper body jerks forward. Your feet stop because they are in contact with the bus floor, but your upper body wants to keep moving forward due to inertia.",
    importantPoints: [
      "Also widely known as the Law of Inertia.",
      "Mass is the quantitative measure of an object's inertia.",
      "No force is needed to keep an object moving at constant velocity in friction-free space."
    ],
    keyIslTerms: ["FORCE", "FUNCTION", "WHAT"],
    relatedConcepts: ["Inertia", "Newton's Second Law", "Friction"]
  },
  'plant_cell': {
    aliases: ["plant cell", "plant cells", "cell wall", "chloroplast", "chloroplasts", "plant cell structure"],
    subject: "Biology / Science",
    topic: "Cellular Biology",
    gradeLevel: "Class 9–10 (Secondary)",
    directAnswer: "A plant cell is a eukaryotic cell characterized by a rigid outer cell wall made of cellulose, chloroplasts containing green chlorophyll for photosynthesis, and a large central vacuole for maintaining turgor pressure.",
    simpleExplanation: "Unlike animal cells, plant cells have a rigid outer 'armor' called the cell wall that gives plants their upright structure without needing a skeleton. They also have tiny green food factories called chloroplasts that capture sunlight to make sugar (photosynthesis).",
    example: "When you bite into a fresh crisp celery stick or apple, that loud 'crunch' you hear and feel is the mechanical breaking of millions of rigid cellulose cell walls pressurized with water in their vacuoles.",
    importantPoints: [
      "Rigid cell wall composed primarily of cellulose provides mechanical structural support.",
      "Chloroplasts contain chlorophyll pigments that absorb sunlight for photosynthesis.",
      "Large central vacuole maintains osmotic balance and cell turgidity.",
      "Plant cells have fixed, angular geometric shapes compared to flexible animal cells."
    ],
    keyIslTerms: ["CELL", "PLANT", "CHLOROPLAST", "FUNCTION", "SUN", "WATER"],
    relatedConcepts: ["Photosynthesis", "Cell Wall", "Vacuole", "Animal Cell"]
  },
  'photosynthesis': {
    aliases: ["photosynthesis", "photo synthesis", "how plants make food", "light reaction"],
    subject: "Biology / Science",
    topic: "Plant Physiology",
    gradeLevel: "Class 9–10 (Secondary)",
    directAnswer: "Photosynthesis is the biochemical process by which green plants and certain organisms convert sunlight, water, and carbon dioxide into chemical energy (glucose) and release oxygen as a byproduct. Chemical equation: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂.",
    simpleExplanation: "Plants act like miniature solar power plants. They take carbon dioxide from the air through microscopic leaf pores (stomata), drink water from their roots, and use green chlorophyll inside chloroplasts to trap sunlight, baking their own food (glucose) and releasing oxygen for us to breathe.",
    example: "Green leaves turn toward a window in a classroom. The leaves expand their surface area to trap as many solar photons as possible inside their chloroplasts, generating starch that the plant stores in stems and roots (like potatoes or carrots).",
    importantPoints: [
      "Occurs within chloroplast organelles of plant cells.",
      "Requires carbon dioxide, water, chlorophyll, and radiant sunlight.",
      "Produces glucose (nutrient energy) and releases breathable oxygen gas.",
      "Forms the foundation of almost every biological food chain on Earth."
    ],
    keyIslTerms: ["PLANT", "SUN", "WATER", "FUNCTION", "CELL"],
    relatedConcepts: ["Chloroplast", "Plant Cell", "Cellular Respiration"]
  },
  'keyboard': {
    aliases: ["keyboard", "what is a keyboard", "computer keyboard", "input device keyboard"],
    subject: "Computer Science / IT",
    topic: "Computer Hardware & Peripherals",
    gradeLevel: "Class 6–10 (Secondary)",
    directAnswer: "A keyboard is a primary alphanumeric input peripheral device used to enter text, numbers, and operational control commands into a computer or digital system.",
    simpleExplanation: "When you press any key on a keyboard, a tiny electronic circuit switch under the key closes. The keyboard's internal controller detects which key was pressed, turns that key press into a standardized digital binary code (like ASCII or Unicode), and sends it to the computer CPU to appear on your screen.",
    example: "Typing the letter 'A' sends binary code `01000001` (ASCII 65) through the USB or Bluetooth connection into the computer operating system, which instantly renders the glyph 'A' inside your active word processor or search bar.",
    importantPoints: [
      "Classified fundamentally as an Input Peripheral Device.",
      "Standard international layout is QWERTY (named after top row letters).",
      "Contains alphanumeric keys, function keys (F1–F12), control keys (Ctrl, Alt), and navigation keys.",
      "Transfers keystrokes as digital scancodes to the computer operating system."
    ],
    keyIslTerms: ["KEYBOARD", "COMPUTER", "INPUT", "FUNCTION"],
    relatedConcepts: ["Monitor", "Input Device", "Output Device", "CPU"]
  },
  'monitor': {
    aliases: ["monitor", "display", "screen", "computer monitor", "output device monitor"],
    subject: "Computer Science / IT",
    topic: "Computer Hardware & Peripherals",
    gradeLevel: "Class 6–10 (Secondary)",
    directAnswer: "A monitor is an electronic visual output peripheral device that displays text, images, and video generated by a computer's graphics processor (GPU).",
    simpleExplanation: "The monitor receives electrical video signals from the computer and turns them into visual patterns of colored light using millions of tiny colored dots called pixels (Red, Green, Blue) so you can see what the computer is doing.",
    example: "When you open an educational video in Voice 2 Sense, the graphics processor computes color values for 1920×1080 pixels at 60 times every second, illuminating the monitor screen so you can clearly view the 3D ISL avatar demonstrations.",
    importantPoints: [
      "Classified fundamentally as an Output Peripheral Device.",
      "Modern monitors utilize LCD (Liquid Crystal Display), LED, or OLED display technologies.",
      "Key metrics include screen resolution (e.g. Full HD 1080p, 4K), aspect ratio (16:9), and refresh rate (60Hz–144Hz)."
    ],
    keyIslTerms: ["MONITOR", "COMPUTER", "OUTPUT", "FUNCTION"],
    relatedConcepts: ["Keyboard", "Output Device", "Printer", "Graphics Card"]
  }
};

export class AcademicAIService {
  constructor() {
    this.sessionHistory = []; // [ { id, role, query, answerData, timestamp } ]
    this.activeContextConcept = null; // concept or topic from the most recent turn
  }

  /**
   * Clears active session conversation history
   */
  clearHistory() {
    this.sessionHistory = [];
    this.activeContextConcept = null;
  }

  /**
   * Retrieves conversation history array
   */
  getHistory() {
    return [...this.sessionHistory];
  }

  /**
   * Main unified processing pipeline for academic queries.
   * Invoked for Text, Voice (translated), and ISL input channels.
   * 
   * @param {string} queryRaw - Raw or translated question text
   * @param {string} inputMode - 'type' | 'speak' | 'sign'
   * @param {object} plEngine - PersonalizedLearningEngine instance
   * @returns {Promise<object>} Structured academic response
   */
  async resolveQuery(queryRaw, inputMode = 'type', plEngine = null) {
    const query = String(queryRaw || '').trim();
    if (!query) {
      return this._formatEmptyResponse();
    }

    // 1. Detect if this is a follow-up query referencing previous conversation turn
    const followUpContext = this._resolveFollowUpContext(query);
    const effectiveQuery = followUpContext.resolvedQuery;

    // 2. Syllabus Context Extraction from Personalized Learning Engine
    const syllabusContext = this._extractSyllabusContext(plEngine);

    // 3. Search Active Curriculum First (Priority 1)
    let matchedConcept = null;
    let matchSource = null;
    let answerData = null;

    if (plEngine) {
      const activeResult = this._searchActiveCurriculum(effectiveQuery, plEngine, syllabusContext);
      if (activeResult && activeResult.found) {
        matchedConcept = activeResult.concept;
        matchSource = activeResult.source;
        answerData = activeResult.answerData;
      }
    }

    // 4. If not found in active curriculum, search General Academic Knowledge Base (Priority 2)
    if (!answerData) {
      const generalResult = this._searchGeneralAcademicKnowledge(effectiveQuery, followUpContext.previousConcept);
      if (generalResult) {
        matchedConcept = generalResult.concept;
        matchSource = generalResult.source;
        answerData = generalResult.answerData;
      }
    }

    // 5. Fallback: Check University / IT Curriculum (Priority 3)
    if (!answerData) {
      const itResult = this._searchItCurriculum(effectiveQuery);
      if (itResult) {
        matchedConcept = itResult.concept;
        matchSource = itResult.source;
        answerData = itResult.answerData;
      }
    }

    // 6. If completely unresolvable, return truthful pedagogical fallback (never hallucinate)
    if (!answerData) {
      answerData = {
        found: false,
        topicTitle: query,
        sourceType: 'unresolved',
        sourceBadge: 'Syllabus Search',
        directAnswer: "I couldn't find a reliable answer in your current learning material.",
        simpleExplanation: "Your active curriculum and local academic knowledge base don't currently contain a verified lesson for this inquiry. Try asking about topics in your active syllabus, or browse your subjects in Personalized Learning.",
        example: "Try asking: \"What is a plant cell?\", \"Explain Newton's Second Law\", \"What is a keyboard?\", or \"Teach me Linked Lists\".",
        importantPoints: [
          "Check the subject list in Personalized Learning for supported curriculum units.",
          "You can import a custom curriculum bundle in JSON format to expand the syllabus.",
          "Use the sign mode to sign supported terms like CELL, PLANT, KEYBOARD, or FUNCTION."
        ],
        keyIslTerms: ["HELP", "WHAT", "SCIENCE"],
        lessonNav: null
      };
    }

    // Update active context concept for next follow-up turn
    if (answerData.found && matchedConcept) {
      this.activeContextConcept = {
        title: matchedConcept.title || answerData.topicTitle,
        subject: matchedConcept.subjectTitle || answerData.subject || 'General Science',
        details: matchedConcept,
        answerData: answerData
      };
    }

    // Record turn in session history
    const turnRecord = {
      id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant',
      userQuery: query,
      effectiveQuery: effectiveQuery,
      inputMode: inputMode,
      isFollowUp: followUpContext.isFollowUp,
      answerData: answerData,
      syllabusContext: syllabusContext,
      timestamp: Date.now()
    };
    this.sessionHistory.push(turnRecord);

    return answerData;
  }

  /**
   * Detects follow-up intents like "give me an example", "what is its formula?", "tell me more", etc.
   */
  _resolveFollowUpContext(query) {
    const qLower = query.toLowerCase().trim();
    const prev = this.activeContextConcept;

    if (!prev) {
      return { isFollowUp: false, resolvedQuery: query, previousConcept: null };
    }

    // Patterns indicating a follow-up request about the previous topic
    const followUpPatterns = [
      /^(?:give\s+me|show\s+me|provide|tell\s+me)?\s*(?:an?\s+)?example/i,
      /^(?:what\s+is|give\s+me)?\s*(?:the\s+)?formula/i,
      /^(?:why|how\s+does\s+it\s+work|how\s+so)/i,
      /^(?:explain\s+more|tell\s+me\s+more|elaborate|in\s+detail)/i,
      /^(?:what\s+are\s+its\s+applications|where\s+is\s+it\s+used)/i,
      /^(?:what\s+does\s+it\s+mean|what\s+is\s+it)/i,
      /\b(?:it|this|that|its|these|those)\b/i
    ];

    const isMatch = followUpPatterns.some(p => p.test(qLower));

    if (isMatch) {
      const combined = `${prev.title} ${query}`;
      return {
        isFollowUp: true,
        resolvedQuery: combined,
        previousConcept: prev
      };
    }

    return { isFollowUp: false, resolvedQuery: query, previousConcept: null };
  }

  /**
   * Extracts active syllabus context from PersonalizedLearningEngine
   */
  _extractSyllabusContext(plEngine) {
    if (!plEngine) {
      return {
        hasSyllabus: false,
        pathwayName: 'General Secondary Curriculum',
        boardSystem: 'Secondary Education',
        educationalLevel: 'Class 9–10 (Secondary)',
        activeSubjectTitle: 'Science & Digital Literacy',
        activeConceptTitle: null
      };
    }

    const curr = plEngine.getActiveCurriculum();
    const lastActive = plEngine.getLastActiveConcept();

    return {
      hasSyllabus: !!curr,
      bundleId: curr?.bundleId || null,
      pathwayName: curr?.pathwayName || curr?.boardSystem || 'State Board of Secondary Education',
      boardSystem: curr?.boardSystem || 'Secondary Education',
      educationalLevel: curr?.educationalLevel || plEngine.learnerProfile?.data?.educationLevel || 'Class 9–10 (Secondary)',
      academicYear: curr?.academicYear || '2026–27',
      activeSubjectTitle: lastActive?.subjectTitle || (curr?.subjects?.[0]?.title) || 'General Science',
      activeConceptTitle: lastActive?.title || null,
      activeConceptId: lastActive?.id || null
    };
  }

  /**
   * Searches the active curriculum bundle loaded in Personalized Learning
   */
  _searchActiveCurriculum(query, plEngine, syllabusContext) {
    const rawTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const allConcepts = plEngine.getAllActiveConcepts();
    if (!allConcepts || allConcepts.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;

    for (const c of allConcepts) {
      let score = 0;
      const cTitle = (c.title || '').toLowerCase();
      const cOverview = (c.overview || c.explanation || '').toLowerCase();
      const cKeywords = (c.islKeywords || []).map(k => String(k).toLowerCase());

      for (const t of rawTokens) {
        if (cTitle.includes(t)) score += 0.45;
        if (cKeywords.some(k => k.includes(t))) score += 0.35;
        if (cOverview.includes(t)) score += 0.20;
      }

      // Check ordinal mismatch (prevent First Law falsely matching Second Law)
      if (rawTokens.includes('second') && cTitle.includes('first') && !cTitle.includes('second')) {
        score -= 1.0;
      }
      if (rawTokens.includes('first') && cTitle.includes('second') && !cTitle.includes('first')) {
        score -= 1.0;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = c;
      }
    }

    if (bestMatch && highestScore >= 0.4) {
      const defs = bestMatch.notes?.definitions || [];
      const primaryDef = defs[0] ? `${defs[0].term}: ${defs[0].def}` : (bestMatch.overview || bestMatch.explanation);
      const pts = bestMatch.notes?.keyPoints || [
        bestMatch.learningOutcome || `Demonstrate visual comprehension of ${bestMatch.title}.`,
        `Curriculum reference: ${syllabusContext.boardSystem} ${bestMatch.unitTitle || 'Active Unit'}.`
      ];

      return {
        found: true,
        concept: bestMatch,
        source: `Active Syllabus: ${syllabusContext.boardSystem} > ${bestMatch.subjectTitle || 'Science'} > ${bestMatch.title}`,
        answerData: {
          found: true,
          topicTitle: bestMatch.title,
          subject: bestMatch.subjectTitle || 'Science',
          sourceType: 'active_syllabus',
          sourceBadge: `Active Syllabus · ${syllabusContext.boardSystem}`,
          directAnswer: primaryDef,
          simpleExplanation: bestMatch.overview || bestMatch.explanation || `In your ${syllabusContext.educationalLevel} curriculum, ${bestMatch.title} is a core foundational concept.`,
          example: this._generateCurriculumExample(bestMatch),
          importantPoints: pts,
          keyIslTerms: (bestMatch.islKeywords || [bestMatch.title.toUpperCase()]).map(k => k.toUpperCase()),
          lessonNav: {
            conceptId: bestMatch.id,
            title: bestMatch.title,
            subjectId: bestMatch.subjectId || null
          }
        }
      };
    }

    return null;
  }

  /**
   * Searches the pre-compiled general academic knowledge base (Physics, Bio, IT)
   */
  _searchGeneralAcademicKnowledge(query, contextConcept = null) {
    const qLower = query.toLowerCase();

    for (const [key, item] of Object.entries(GENERAL_ACADEMIC_KNOWLEDGE)) {
      const match = item.aliases.some(alias => qLower.includes(alias));
      if (match) {
        return {
          found: true,
          concept: { title: item.aliases[0].toUpperCase(), ...item },
          source: `General Academic Knowledge Base (${item.subject})`,
          answerData: {
            found: true,
            topicTitle: item.aliases[0].toUpperCase(),
            subject: item.subject,
            sourceType: 'general_academic',
            sourceBadge: `Academic Knowledge Base · ${item.subject}`,
            directAnswer: item.directAnswer,
            simpleExplanation: item.simpleExplanation,
            example: item.example,
            importantPoints: item.importantPoints,
            keyIslTerms: item.keyIslTerms,
            lessonNav: null
          }
        };
      }
    }

    return null;
  }

  /**
   * Searches higher-education computer science / IT curriculum (DSA, DBMS, OS, Networks)
   */
  _searchItCurriculum(query) {
    const qLower = query.toLowerCase();

    for (const subj of CURRICULUM) {
      for (const chap of (subj.chapters || [])) {
        for (const les of (chap.lessons || [])) {
          const match = (les.keywords || []).some(k => {
            const kLower = k.toLowerCase().trim();
            if (kLower.length <= 2) return false;
            const regex = new RegExp(`\\b${kLower.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
            return regex.test(qLower);
          }) ||
          (qLower.length >= 4 && les.title.toLowerCase().includes(qLower)) ||
          (les.title.length >= 6 && qLower.includes(les.title.toLowerCase()));
          if (match) {
            return {
              found: true,
              concept: les,
              source: `Computer Science Curriculum (${subj.shortTitle} > ${chap.title})`,
              answerData: {
                found: true,
                topicTitle: les.title,
                subject: subj.title,
                sourceType: 'it_curriculum',
                sourceBadge: `Curriculum Knowledge Base · ${subj.shortTitle}`,
                directAnswer: `${les.title} is a core computer science topic covered in ${chap.title}.`,
                simpleExplanation: les.description || `This lesson covers fundamental computational structures, time-space efficiency, and operational mechanics.`,
                example: `In practical software systems, ${les.title} is used to organize memory, speed up data searches, or manage hardware resources efficiently.`,
                importantPoints: [
                  `Covered in ${subj.title} — ${chap.title}.`,
                  `Video demonstration & visual lesson available (Duration: ${les.duration}).`,
                  `Key searchable topics: ${(les.keywords || []).slice(0, 5).join(', ')}.`
                ],
                keyIslTerms: ["COMPUTER", "FUNCTION", "WHAT", "SCIENCE"],
                lessonNav: {
                  conceptId: les.id,
                  title: les.title,
                  subjectId: subj.id
                }
              }
            };
          }
        }
      }
    }

    return null;
  }

  _generateCurriculumExample(concept) {
    const tLower = (concept.title || '').toLowerCase();
    if (tLower.includes('cell') || tLower.includes('plant')) {
      return "When observing a thin slice of onion peel under a classroom microscope, each plant cell appears as a distinct rectangular box surrounded by a dark, rigid cell wall.";
    }
    if (tLower.includes('chloroplast') || tLower.includes('plastid')) {
      return "Leaves exposed to abundant sunlight develop deep green color due to high concentrations of active chloroplasts, allowing the plant to produce starch rapidly.";
    }
    if (tLower.includes('keyboard') || tLower.includes('input')) {
      return "Pressing a key on your computer or phone converts mechanical motion into an electrical signal that appears instantly as a letter or command.";
    }
    return `In daily life, ${concept.title} is observed whenever we analyze the physical and biological systems operating in our environment.`;
  }

  _formatEmptyResponse() {
    return {
      found: false,
      topicTitle: 'Empty Query',
      sourceType: 'empty',
      sourceBadge: 'Standby',
      directAnswer: "Please ask a question using text, speech, or Indian Sign Language.",
      simpleExplanation: "Voice 2 Sense Academic Assistance connects to your curriculum notes, textbooks, and ISL signing repository to help you understand academic concepts.",
      example: "You can type 'Explain Newton's Second Law', speak in your native language, or sign using your webcam.",
      importantPoints: [
        "Select Type (⌨️), Speak (🎙️), or Sign (🤟) from the input bar below.",
        "Your question will be answered with Text, Audio (TTS), and 3D Avatar ISL.",
        "Follow-up questions remember your current academic topic."
      ],
      keyIslTerms: ["HELP", "SCIENCE"],
      lessonNav: null
    };
  }
}

export const academicAIService = new AcademicAIService();
