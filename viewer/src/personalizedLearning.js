/**
 * Voice 2 Sense (SignBridge 3D)
 * Personalized Learning Intelligence Engine & Offline Curriculum Infrastructure
 * 
 * CORE ARCHITECTURE:
 * Student + Actual Education Pathway + Versioned Curriculum Bundle
 *    ↓ Offline Curriculum Understanding (State Boards, CBSE, ICSE, NIOS, IEP, Vocational, Custom)
 *    ↓ Prerequisite Graph & Baseline Analysis (Grade ≠ Knowledge level)
 *    ↓ Knowledge-Gap & Misconception Diagnosis
 *    ↓ Dynamic Personalized Learning Path
 *    ↓ ISL-First Digital Classroom (Introduce → Explain → See → Sign → Practice → Check → Master)
 *    ↓ Spaced Retention Review (SM-2 Interval Scheduling)
 *    ↓ Continuous Adaptive Next Step
 */

export const EDUCATION_PATHWAYS = [
  { id: 'state_board', name: 'State Board', fullName: 'State Board of Secondary Education', badge: 'State Curriculum', description: 'Curriculum frameworks administered by individual Indian State governments.' },
  { id: 'cbse', name: 'CBSE', fullName: 'Central Board of Secondary Education', badge: 'National Board', description: 'National secondary curriculum framework with integrated STEM & social sciences.' },
  { id: 'icse', name: 'ICSE / CISCE', fullName: 'Council for the Indian School Certificate Examinations', badge: 'CISCE Board', description: 'Comprehensive secondary curriculum with detailed analytical sciences.' },
  { id: 'nios', name: 'NIOS / Open Schooling', fullName: 'National Institute of Open Schooling', badge: 'Open Learning', description: 'Self-paced secondary education designed for flexibility and inclusive access.' },
  { id: 'home_based', name: 'Home-based / IEP', fullName: 'Individualized Education Plan (IEP)', badge: 'Adaptive Pace', description: 'Personalized learner-centric roadmap calibrated to individual cognitive pace.' },
  { id: 'vocational', name: 'Vocational / NSQF', fullName: 'National Skills Qualifications Framework', badge: 'Skill Development', description: 'Practical industry-aligned vocational competencies and digital accessibility skills.' },
  { id: 'custom', name: 'Custom Curriculum', fullName: 'Learner / Institution-Defined Syllabus', badge: 'Custom Bundle', description: 'Imported or school-provided versioned JSON curriculum bundle.' }
];

export const INDIAN_STATES = [
  'Tamil Nadu State Board',
  'Maharashtra State Board',
  'Karnataka State Board',
  'Delhi State Board',
  'Uttar Pradesh Madhyamik',
  'Kerala State Board',
  'Andhra Pradesh Board',
  'Telangana State Board',
  'West Bengal Board (WBBSE)',
  'Gujarat Secondary Board',
  'Punjab School Education Board',
  'Bihar School Examination Board',
  'All-India / Central Framework'
];

/**
 * Versioned Curriculum Bundles (Offline Package Registry)
 * Each bundle is self-contained and operates completely offline without cloud dependencies.
 */
export const CURRICULUM_BUNDLES = {
  // 1. TAMIL NADU STATE BOARD (Class 10)
  'tn-state-10-2026': {
    bundleId: 'tn-state-10-2026',
    curriculumId: 'tn-state-10',
    boardSystem: 'Tamil Nadu State Board',
    stateRegion: 'Tamil Nadu State Board',
    educationalLevel: 'Class 10 (Secondary)',
    academicYear: '2026–27',
    bundleVersion: '1.0.0',
    pathwayId: 'state_board',
    pathwayName: 'Tamil Nadu State Board (Class 10)',
    title: 'Tamil Nadu SSLC Science & Mathematics',
    description: 'Samacheer Kalvi secondary curriculum adapted for authentic visual Indian Sign Language interpretation.',
    subjects: [
      {
        id: 'tn-sci-10',
        title: 'Science & Living World',
        shortTitle: 'Science',
        icon: '🔬',
        color: '#3b82f6',
        description: 'Plant and animal physiology, chemical reactions, laws of motion, and ecological balance.',
        units: [
          {
            id: 'tn-u1',
            unitNum: 1,
            title: 'Unit 1: Plant Anatomy & Plant Physiology',
            topics: [
              {
                id: 'tn-t1',
                title: 'Cellular Plant Tissues & Plastids',
                concepts: [
                  {
                    id: 'tn-cell-plastids',
                    title: 'Plant Cells & Chloroplast Anatomy',
                    subjectId: 'tn-sci-10',
                    unitId: 'tn-u1',
                    difficulty: 'Beginner',
                    prerequisites: [],
                    learningOutcome: 'Identify internal structure of plant cells, cellulose cell wall, and describe chloroplast stroma and thylakoids in ISL motion.',
                    overview: 'Plant cells are characterized by rigid cell walls made of cellulose and specialized green organelles called chloroplasts that capture sunlight for photosynthesis.',
                    notes: {
                      definitions: [
                        { term: 'Cell Wall', def: 'The outer protective, non-living rigid layer surrounding the plant cell membrane, composed of cellulose.' },
                        { term: 'Chloroplast', def: 'A double-membrane organelle containing chlorophyll pigments that performs photosynthesis.' },
                        { term: 'Thylakoid', def: 'Disc-like membrane structures inside chloroplasts where light-dependent reactions take place.' }
                      ],
                      keyPoints: [
                        'Plant cells possess a fixed rectangular shape supported by the rigid cell wall.',
                        'Animal cells lack cell walls and chloroplasts, possessing flexible membranes instead.',
                        'The large central vacuole in mature plant cells maintains turgor pressure against the cell wall.'
                      ],
                      visualTakeaway: 'Look for rigid outer green cell boundaries and disc-shaped green chloroplasts when observing plant cells under the microscope.'
                    },
                    media: {
                      type: 'local',
                      title: 'Microscopic Comparison: Plant vs Animal Cell Morphology',
                      duration: '3:45',
                      poster: 'assets/posters/cell_structure.jpg',
                      transcript: 'Under optical magnification, plant cells show definite rectangular cellular walls. Inside, green discoid bodies called chloroplasts circulate within the cytoplasm. In contrast, animal cells show flexible boundaries without chloroplasts.',
                      captions: 'Captions synchronized with visual ISL concept terminology.'
                    },
                    islKeywords: ['plant', 'animal', 'sun', 'water', 'life', 'organism'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL term for PLANT and CELL WALL to develop motor signing memory.',
                        targetReps: 5
                      },
                      {
                        type: 'concept_check',
                        prompt: 'Distinguish between plant and animal cellular boundaries.',
                        question: 'What gives a plant cell its rigid fixed structure?',
                        options: ['Cellulose Cell Wall', 'Flexible Plasma Membrane', 'Blood Vessel', 'Muscle Fiber'],
                        correctIndex: 0,
                        explanation: 'The cellulose cell wall is rigid and maintains the shape of the plant cell.'
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'Which specific organelle in plant cells contains chlorophyll and captures sunlight?',
                          options: ['Chloroplast', 'Mitochondria', 'Golgi apparatus', 'Lysosome'],
                          correctIndex: 0,
                          explanation: 'Chloroplasts contain green chlorophyll pigments that absorb light energy.',
                          misconceptionTag: 'organelle_differentiation'
                        },
                        {
                          question: 'How do animal cells differ fundamentally from plant cells in their outer boundary?',
                          options: ['Animal cells only have a flexible cell membrane without a cell wall', 'Animal cells have a wooden wall', 'Animal cells have no membrane at all', 'Animal cells are made of stone'],
                          correctIndex: 0,
                          explanation: 'Animal cells lack a cell wall; they are enclosed solely by a flexible plasma membrane.',
                          misconceptionTag: 'cellular_boundary'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: null,
                      guidance: 'Review microscopic plant cell anatomy and repeat the visual ISL keyword demonstrations for PLANT, SUN, and ORGANISM.'
                    }
                  },
                  {
                    id: 'tn-photosynthesis-light',
                    title: 'Photosynthesis & Transpiration in Leaves',
                    subjectId: 'tn-sci-10',
                    unitId: 'tn-u1',
                    difficulty: 'Intermediate',
                    prerequisites: ['tn-cell-plastids'],
                    learningOutcome: 'Explain the physiological mechanism of light reaction and stomatal transpiration in green leaves.',
                    overview: 'Leaves convert solar energy, water, and atmospheric carbon dioxide into glucose and oxygen through biochemical reactions in chloroplasts while releasing excess water through stomata.',
                    notes: {
                      definitions: [
                        { term: 'Photosynthesis', def: 'The biochemical process by which green plants synthesize carbohydrates from carbon dioxide and water in the presence of sunlight.' },
                        { term: 'Stomata', def: 'Microscopic pores on leaf surfaces regulated by guard cells that facilitate gas exchange and water transpiration.' },
                        { term: 'Transpiration', def: 'The evaporation of water from plant leaves through open stomatal apertures.' }
                      ],
                      keyPoints: [
                        'Equation: 6CO2 + 6H2O + Sunlight → C6H12O6 (Glucose) + 6O2.',
                        'Guard cells swell with water to open stomata and shrink to close them, preventing wilting.',
                        'Transpiration pull helps draw water and dissolved minerals from roots up to the leaves.'
                      ],
                      visualTakeaway: 'Sunlight + Water + Carbon Dioxide enter the leaf chloroplast; Oxygen and Glucose are produced.'
                    },
                    media: {
                      type: 'local',
                      title: 'Stomatal Gas Exchange & Transpiration Stream',
                      duration: '4:10',
                      poster: 'assets/posters/photosynthesis.jpg',
                      transcript: 'Water drawn from soil travels upward through xylem conduits. Solar photons strike chlorophyll in leaf cells, splitting water molecules into oxygen and fueling carbohydrate synthesis.',
                      captions: 'Full transcript available offline.'
                    },
                    islKeywords: ['sun', 'water', 'air', 'work', 'change', 'measure'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL glosses for SUN, WATER, and AIR.',
                        targetReps: 5
                      },
                      {
                        type: 'concept_check',
                        prompt: 'Identify the primary gaseous byproduct released by plants during photosynthesis.',
                        question: 'What gas do leaves release into the atmosphere during daytime photosynthesis?',
                        options: ['Oxygen', 'Carbon dioxide', 'Methane', 'Nitrogen'],
                        correctIndex: 0,
                        explanation: 'Oxygen (O2) is produced when water molecules are split during light reactions.'
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'Which microscopic leaf structures control the opening and closing of pores for gas exchange?',
                          options: ['Guard cells', 'Epidermal hairs', 'Xylem vessels', 'Root caps'],
                          correctIndex: 0,
                          explanation: 'Pairs of guard cells flank each stoma and regulate its aperture size.',
                          misconceptionTag: 'stomatal_regulation'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: 'tn-cell-plastids',
                      guidance: 'Photosynthesis occurs inside chloroplasts. Review the chloroplast anatomy concept before continuing.'
                    }
                  }
                ]
              }
            ]
          },
          {
            id: 'tn-u2',
            unitNum: 2,
            title: 'Unit 2: Laws of Motion & Gravitation',
            topics: [
              {
                id: 'tn-t2',
                title: 'Forces & Newton’s Laws',
                concepts: [
                  {
                    id: 'tn-motion-inertia',
                    title: 'Inertia & Newton’s First Law',
                    subjectId: 'tn-sci-10',
                    unitId: 'tn-u2',
                    difficulty: 'Beginner',
                    prerequisites: [],
                    learningOutcome: 'Define inertia and demonstrate how unbalanced forces alter an object state of rest or uniform motion.',
                    overview: 'Inertia is the natural tendency of an object to resist changes in its velocity. Without an external unbalanced force, resting objects remain stationary and moving objects continue at steady speed.',
                    notes: {
                      definitions: [
                        { term: 'Inertia', def: 'The inherent property of a body to resist any change in its state of rest or state of uniform motion.' },
                        { term: 'Unbalanced Force', def: 'A net non-zero force that causes acceleration or deceleration of a mass.' }
                      ],
                      keyPoints: [
                        'Mass is a direct quantitative measure of inertia: greater mass means greater inertia.',
                        'When a bus stops abruptly, standing passengers lurch forward due to inertia of motion.',
                        'Newton’s first law provides the qualitative definition of force.'
                      ],
                      visualTakeaway: 'A stationary ball stays still until kicked; once rolling, friction eventually stops it.'
                    },
                    media: {
                      type: 'local',
                      title: 'Everyday Demonstrations of Inertia & Balanced Forces',
                      duration: '3:30',
                      poster: 'assets/posters/inertia.jpg',
                      transcript: 'A coin resting on a card over a drinking glass drops directly into the cup when the card is flicked rapidly, illustrating inertia of rest.',
                      captions: 'Clear visual demonstration with ISL signing overlay.'
                    },
                    islKeywords: ['stop', 'walk', 'run', 'car', 'force', 'speed'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL concepts for SPEED, STOP, and FORCE.',
                        targetReps: 5
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'Why do passengers lurch forward when a moving bus brakes suddenly?',
                          options: ['Inertia of motion keeps the upper body moving', 'Gravity pushes them forward', 'Air resistance pulls them', 'The wheels pull their feet backward'],
                          correctIndex: 0,
                          explanation: 'Their bodies were in motion along with the bus and tend to continue moving forward due to inertia.',
                          misconceptionTag: 'inertia_application'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: null,
                      guidance: 'Observe the bus stopping simulation and practice signing the concept of RESISTING CHANGE.'
                    }
                  },
                  {
                    id: 'tn-motion-second-law',
                    title: 'Newton’s Second Law: Force & Momentum',
                    subjectId: 'tn-sci-10',
                    unitId: 'tn-u2',
                    difficulty: 'Intermediate',
                    prerequisites: ['tn-motion-inertia'],
                    learningOutcome: 'State Newton’s second law of motion, derive the mathematical formula F = m * a, and calculate force from mass and acceleration.',
                    overview: 'Newton’s second law of motion states that the rate of change of momentum of an object is directly proportional to the applied unbalanced force, and takes place in the direction in which the force acts. Mathematically: F = m × a (Force = Mass × Acceleration).',
                    notes: {
                      definitions: [
                        { term: 'Newton’s Second Law', def: 'The rate of change of momentum of an object is directly proportional to the applied unbalanced force: F = m · a.' },
                        { term: 'Momentum (p)', def: 'The product of mass and velocity of an object: p = m · v, measured in kg·m/s.' },
                        { term: 'Newton (N)', def: 'The SI unit of force required to accelerate a 1 kg mass at 1 m/s².' }
                      ],
                      keyPoints: [
                        'Mathematical expression: Force = Mass × Acceleration (F = m · a).',
                        'Heavier objects require significantly greater force to achieve the same acceleration rate.',
                        'A cricket fielder pulls hands backward when catching a ball to increase contact time and reduce impact force.',
                        'Newton’s second law provides the quantitative measurement of force.'
                      ],
                      visualTakeaway: 'Pushing an empty supermarket cart accelerates quickly; pushing a loaded heavy cart requires much greater force.'
                    },
                    media: {
                      type: 'local',
                      title: 'Mathematical Derivation of F = ma & Momentum in Everyday Life',
                      duration: '4:15',
                      poster: 'assets/posters/force.jpg',
                      transcript: 'Visual demonstration showing how applying force to different masses alters acceleration, with cricket ball catching kinematics.',
                      captions: 'Detailed bilingual Tamil & English subtitles with authentic ISL signer.'
                    },
                    islKeywords: ['force', 'speed', 'car', 'heavy', 'fast', 'push'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing FORCE, MASS, ACCELERATION, and PUSH in ISL.',
                        targetReps: 5
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'What happens to the acceleration of an object if the applied net force is doubled while mass stays constant?',
                          options: ['Acceleration is doubled', 'Acceleration is halved', 'Acceleration remains unchanged', 'Acceleration drops to zero'],
                          correctIndex: 0,
                          explanation: 'According to F = m · a, acceleration is directly proportional to force. Doubling force doubles acceleration.',
                          misconceptionTag: 'force_acceleration_proportionality'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: 'tn-motion-inertia',
                      guidance: 'Review the relationship between mass and force, and practice the ISL demonstration for FORCE.'
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'tn-math-10',
        title: 'Mathematics & Spatial Logic',
        shortTitle: 'Mathematics',
        icon: '📐',
        color: '#10b981',
        description: 'Linear equations, arithmetic progressions, coordinate geometry, and statistics.',
        units: [
          {
            id: 'tn-m-u1',
            unitNum: 1,
            title: 'Unit 1: Relations, Functions & Numbers',
            topics: [
              {
                id: 'tn-m-t1',
                title: 'Sequences & Series',
                concepts: [
                  {
                    id: 'tn-math-ap',
                    title: 'Arithmetic Progression (A.P.) & Common Difference',
                    subjectId: 'tn-math-10',
                    unitId: 'tn-m-u1',
                    difficulty: 'Intermediate',
                    prerequisites: [],
                    learningOutcome: 'Identify arithmetic progressions, calculate common difference d, and determine the nth term formula.',
                    overview: 'An arithmetic progression is a sequence of numbers where each successive term is obtained by adding a fixed constant difference (d) to the preceding term.',
                    notes: {
                      definitions: [
                        { term: 'Arithmetic Progression', def: 'A sequence of numbers in which the difference between consecutive terms remains constant.' },
                        { term: 'Common Difference (d)', def: 'The constant difference d = a(n) - a(n-1) between any two consecutive terms.' },
                        { term: 'General Term', def: 'The nth term is given by t(n) = a + (n - 1)d, where a is the initial term.' }
                      ],
                      keyPoints: [
                        'If d > 0, the sequence is increasing (e.g. 2, 5, 8, 11...).',
                        'If d < 0, the sequence is decreasing (e.g. 20, 15, 10, 5...).',
                        'If d = 0, all terms are equal (constant progression).'
                      ],
                      visualTakeaway: 'Steps on a staircase: each step elevates by the exact same height (common difference).'
                    },
                    media: {
                      type: 'local',
                      title: 'Visualizing Number Patterns as Constant Steps',
                      duration: '3:15',
                      poster: 'assets/posters/math_patterns.jpg',
                      transcript: 'Consider numbers 3, 7, 11, 15. The difference between each consecutive pair is 4. Since the step is constant, this forms an Arithmetic Progression.',
                      captions: 'Step-by-step numerical breakdown with ISL count articulation.'
                    },
                    islKeywords: ['number', 'measure', 'equal', 'different', 'more', 'less'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL numbers and mathematical concept EQUAL.',
                        targetReps: 5
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'In the sequence 5, 9, 13, 17..., what is the common difference d?',
                          options: ['4', '5', '8', '3'],
                          correctIndex: 0,
                          explanation: '9 - 5 = 4, 13 - 9 = 4. The common difference d is 4.',
                          misconceptionTag: 'common_difference'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: null,
                      guidance: 'Calculate the difference between adjacent terms: subtract the first number from the second number.'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // 2. CBSE SECONDARY (Class 9–10)
  'cbse-sec-2026': {
    bundleId: 'cbse-sec-2026',
    curriculumId: 'cbse-sec',
    boardSystem: 'CBSE',
    stateRegion: 'All-India / Central',
    educationalLevel: 'Class 9–10 (Secondary)',
    academicYear: '2026–27',
    bundleVersion: '1.2.0',
    pathwayId: 'cbse',
    pathwayName: 'CBSE Secondary (Class 9–10)',
    title: 'CBSE National Secondary Academic Bundle',
    description: 'Central Board scientific foundations, matter transformations, cell biology, and Newtonian mechanics.',
    subjects: [
      {
        id: 'cbse-sci',
        title: 'Science & The Living World',
        shortTitle: 'Science',
        icon: '🔬',
        color: '#3b82f6',
        description: 'Biological systems, chemical states of matter, and physical laws of motion.',
        units: [
          {
            id: 'cbse-sci-u1',
            unitNum: 1,
            title: 'Unit 1: The Fundamental Unit of Life & Tissues',
            topics: [
              {
                id: 'cbse-sci-t1',
                title: 'Cellular Organization',
                concepts: [
                  {
                    id: 'cbse-cell-struct',
                    title: 'Plant Cells vs Animal Cells',
                    subjectId: 'cbse-sci',
                    unitId: 'cbse-sci-u1',
                    difficulty: 'Beginner',
                    prerequisites: [],
                    learningOutcome: 'Identify microscopic cell structures and compare morphological differences between plant and animal cells in ISL motion.',
                    overview: 'All living organisms are built from cells. Plant cells feature rigid cellulose walls and green chloroplasts for trapping sunlight energy, while animal cells have flexible cell membranes.',
                    notes: {
                      definitions: [
                        { term: 'Cell Membrane', def: 'A semi-permeable lipid bilayer that regulates molecular transport into and out of all living cells.' },
                        { term: 'Cell Wall', def: 'A tough, protective cellulose layer found outside the cell membrane of plant cells.' },
                        { term: 'Chloroplast', def: 'Organelle containing green chlorophyll pigments that captures solar photons for photosynthesis.' }
                      ],
                      keyPoints: [
                        'Plant cells possess both a cell membrane and an outer cell wall; animal cells possess only a cell membrane.',
                        'Plant cells contain green chloroplasts for photosynthesis; animal cells do not.',
                        'Plant cells usually have a single prominent central vacuole, while animal cells have small temporary vacuoles.'
                      ],
                      visualTakeaway: 'Plant cell = Green box with rigid wall. Animal cell = Flexible round shape with centered nucleus.'
                    },
                    media: {
                      type: 'local',
                      title: 'Microscopic Comparison: Plant vs Animal Cells',
                      duration: '3:50',
                      poster: 'assets/posters/cell_structure.jpg',
                      transcript: 'When onion peel cells are viewed under the microscope, prominent rectangular cells with thick walls are visible. Human cheek cells, in contrast, appear rounded and pliable.',
                      captions: 'Visual ISL signing synchronized to cellular organelle labels.'
                    },
                    islKeywords: ['plant', 'animal', 'sun', 'water', 'life', 'organism'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL vocabulary for PLANT, ANIMAL, and LIFE.',
                        targetReps: 5
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'Which organelle is present in plant cells to capture sunlight but absent in animal cells?',
                          options: ['Chloroplasts', 'Cell membrane', 'Nerve fiber', 'Blood cell'],
                          correctIndex: 0,
                          explanation: 'Chloroplasts contain chlorophyll, which traps sunlight for photosynthesis in plant cells.',
                          misconceptionTag: 'cellular_organelles'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: null,
                      guidance: 'Observe the 3D model comparison between plant and animal cell boundaries.'
                    }
                  },
                  {
                    id: 'cbse-cell-tissues',
                    title: 'Plant & Animal Tissues',
                    subjectId: 'cbse-sci',
                    unitId: 'cbse-sci-u1',
                    difficulty: 'Intermediate',
                    prerequisites: ['cbse-cell-struct'],
                    learningOutcome: 'Explain how specialized cells combine into functional tissues to support life functions.',
                    overview: 'A tissue is an organized cluster of similar cells performing a specialized role. Plant tissues include xylem for water transport, while animal tissues include muscle and protective skin layers.',
                    notes: {
                      definitions: [
                        { term: 'Tissue', def: 'A cooperative group of interconnected, specialized cells with similar embryonic origin and common function.' },
                        { term: 'Xylem', def: 'Vascular plant tissue that conducts water and dissolved minerals upwards from roots.' },
                        { term: 'Epithelial Tissue', def: 'Protective animal tissue forming continuous sheets over internal and external body surfaces.' }
                      ],
                      keyPoints: [
                        'Single cells combine into tissues; tissues combine into organs; organs form complete physiological systems.',
                        'Plant tissues are categorized into meristematic (dividing) and permanent tissues.',
                        'Animal tissues include epithelial, connective, muscular, and nervous tissues.'
                      ],
                      visualTakeaway: 'Individual bricks (cells) form a wall (tissue), which forms a room (organ).'
                    },
                    media: {
                      type: 'local',
                      title: 'Specialized Biological Tissues in Action',
                      duration: '4:05',
                      poster: 'assets/posters/tissues.jpg',
                      transcript: 'Muscle tissues contract to generate movement, while vascular xylem tubes conduct water throughout tall trees under cohesive capillary tension.',
                      captions: 'Bilingual captions with ISL signer guidance.'
                    },
                    islKeywords: ['water', 'body', 'work', 'system', 'different', 'change'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL terms for SYSTEM and WORK.',
                        targetReps: 5
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'What is a cooperative group of similar cells working together called?',
                          options: ['A tissue', 'An organ system', 'A molecule', 'A species'],
                          correctIndex: 0,
                          explanation: 'A tissue is defined as a collection of interconnected, specialized cells with a common function.',
                          misconceptionTag: 'tissue_definition'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: 'cbse-cell-struct',
                      guidance: 'Cells are the fundamental building blocks of tissues. Review plant and animal cell differences first.'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // 3. MAHARASHTRA STATE BOARD (Class 10)
  'mh-state-10-2026': {
    bundleId: 'mh-state-10-2026',
    curriculumId: 'mh-state-10',
    boardSystem: 'Maharashtra State Board',
    stateRegion: 'Maharashtra State Board',
    educationalLevel: 'Class 10 (Secondary)',
    academicYear: '2026–27',
    bundleVersion: '1.0.0',
    pathwayId: 'state_board',
    pathwayName: 'Maharashtra State Board (Class 10)',
    title: 'Maharashtra SSC Science & Technology',
    description: 'Maharashtra State Board of Secondary and Higher Secondary Education (MSBSHSE) Science curriculum.',
    subjects: [
      {
        id: 'mh-sci-10',
        title: 'Science & Technology Part 1 & 2',
        shortTitle: 'Science',
        icon: '⚡',
        color: '#f59e0b',
        description: 'Gravitation, chemical reactions, electric currents, life processes, and environmental management.',
        units: [
          {
            id: 'mh-u1',
            unitNum: 1,
            title: 'Unit 1: Gravitation & Planetary Motion',
            topics: [
              {
                id: 'mh-t1',
                title: 'Gravitational Dynamics',
                concepts: [
                  {
                    id: 'mh-grav-laws',
                    title: 'Kepler’s Laws & Universal Gravitation',
                    subjectId: 'mh-sci-10',
                    unitId: 'mh-u1',
                    difficulty: 'Intermediate',
                    prerequisites: [],
                    learningOutcome: 'State Kepler’s three empirical laws of planetary motion and explain Newton’s inverse square law of gravitation in ISL.',
                    overview: 'Johannes Kepler formulated three planetary laws: planetary orbits are elliptical with the Sun at one focus; equal areas are swept in equal times; and orbital period squared is proportional to semi-major axis cubed.',
                    notes: {
                      definitions: [
                        { term: 'Universal Gravitation', def: 'Every particle in the universe attracts every other particle with a force proportional to the product of their masses and inversely proportional to the square of the distance between them.' },
                        { term: 'Elliptical Orbit', def: 'A closed oval curve with two focal points around which celestial bodies travel.' }
                      ],
                      keyPoints: [
                        'Kepler’s 1st Law: The orbit of a planet is an ellipse with the Sun at one of the foci.',
                        'Kepler’s 2nd Law: The line joining the planet and the Sun sweeps equal areas in equal intervals of time.',
                        'Kepler’s 3rd Law: The square of orbital period (T^2) is directly proportional to the cube of mean distance (r^3).'
                      ],
                      visualTakeaway: 'Planets move faster when nearest to the Sun (perihelion) and slower when farthest (aphelion).'
                    },
                    media: {
                      type: 'local',
                      title: 'Kepler’s Planetary Motion & Elliptical Orbits',
                      duration: '3:40',
                      poster: 'assets/posters/gravitation.jpg',
                      transcript: 'Planets travel along elongated oval trajectories. When closer to the central gravitational mass of the Sun, orbital velocity visibly increases.',
                      captions: 'Bilingual subtitles with 3D signer animation.'
                    },
                    islKeywords: ['sun', 'earth', 'speed', 'time', 'equal', 'force'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL concepts for SUN, EARTH, and FORCE.',
                        targetReps: 5
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'According to Kepler’s First Law, what is the geometric shape of planetary orbits around the Sun?',
                          options: ['An Ellipse', 'A Perfect Circle', 'A Straight Line', 'A Triangle'],
                          correctIndex: 0,
                          explanation: 'Planetary orbits are ellipses with the Sun situated at one of the focal points.',
                          misconceptionTag: 'planetary_orbit_geometry'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: null,
                      guidance: 'Observe the 3D orbital animation and note how the planet speed changes along the oval ellipse.'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // 4. NIOS OPEN SCHOOLING (Secondary)
  'nios-sec-2026': {
    bundleId: 'nios-sec-2026',
    curriculumId: 'nios-sec',
    boardSystem: 'NIOS',
    stateRegion: 'All-India / Open Schooling',
    educationalLevel: 'Class 9–10 (Secondary)',
    academicYear: '2026–27',
    bundleVersion: '1.0.0',
    pathwayId: 'nios',
    pathwayName: 'NIOS / Open Schooling (Secondary)',
    title: 'NIOS Digital Literacy & Applied Sciences',
    description: 'National Institute of Open Schooling secondary curriculum emphasizing self-paced vocational and scientific literacy.',
    subjects: [
      {
        id: 'nios-it',
        title: 'Data Entry & Digital Literacy',
        shortTitle: 'Data Entry IT',
        icon: '💻',
        color: '#8b5cf6',
        description: 'Computer hardware components, file organization, keyboarding, and digital office tools.',
        units: [
          {
            id: 'nios-it-u1',
            unitNum: 1,
            title: 'Unit 1: Basics of Computer Systems',
            topics: [
              {
                id: 'nios-it-t1',
                title: 'Hardware & Operating Systems',
                concepts: [
                  {
                    id: 'nios-comp-basics',
                    title: 'Input, Output & Storage Devices',
                    subjectId: 'nios-it',
                    unitId: 'nios-it-u1',
                    difficulty: 'Beginner',
                    prerequisites: [],
                    learningOutcome: 'Classify primary computer peripheral devices into input, output, and secondary storage categories in ISL.',
                    overview: 'A computer accepts raw input data through peripherals like keyboards, processes binary logic in the central processor, and displays outputs on monitors or stores it permanently.',
                    notes: {
                      definitions: [
                        { term: 'Input Device', def: 'Hardware used to feed alphanumeric data, commands, or audio signals into a computer (keyboard, scanner, microphone).' },
                        { term: 'Output Device', def: 'Hardware that converts processed digital data into human-readable form (monitor screen, printer, speaker).' },
                        { term: 'Storage Device', def: 'Medium that preserves files and programs permanently (SSD, hard disk, USB drive).' }
                      ],
                      keyPoints: [
                        'Input = entering information into system; Output = receiving results from system.',
                        'Central Processing Unit (CPU) is the computation brain connecting input to output.',
                        'Primary memory (RAM) is temporary; secondary storage (SSD/HDD) retains data when powered off.'
                      ],
                      visualTakeaway: 'Hands on keyboard (Input) → CPU processing → Monitor displaying letters (Output).'
                    },
                    media: {
                      type: 'local',
                      title: 'Computer Peripheral Architecture Explained',
                      duration: '3:20',
                      poster: 'assets/posters/computer_peripherals.jpg',
                      transcript: 'Typing on keys sends electrical signals. The microprocessor translates binary code and presents rendered fonts upon the display screen.',
                      captions: 'ISL signer terminology displayed.'
                    },
                    islKeywords: ['computer', 'work', 'read', 'write', 'fast', 'help'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL terms for COMPUTER, READ, and WRITE.',
                        targetReps: 5
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'Which device is used specifically to enter text and command input into a computer system?',
                          options: ['Keyboard', 'Monitor', 'Printer', 'Speaker'],
                          correctIndex: 0,
                          explanation: 'A keyboard is the primary alphanumeric input device for user text entry.',
                          misconceptionTag: 'peripheral_classification'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: null,
                      guidance: 'Review the distinction between sending data into a machine (input) and seeing results (output).'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // 5. INDIVIDUALIZED EDUCATION PLAN (IEP / Home-Based)
  'home-iep-2026': {
    bundleId: 'home-iep-2026',
    curriculumId: 'home-iep',
    boardSystem: 'Individualized Education Plan',
    stateRegion: 'Adaptive / Home-based',
    educationalLevel: 'Adaptive Pace',
    academicYear: '2026–27',
    bundleVersion: '1.0.0',
    pathwayId: 'home_based',
    pathwayName: 'Individualized Education Plan (IEP)',
    title: 'Adaptive Practical Living & Environmental Health',
    description: 'Custom paced educational modules designed around learner specific cognitive strengths and foundational life skills.',
    subjects: [
      {
        id: 'iep-life-sci',
        title: 'Everyday Life Science & Health',
        shortTitle: 'Life Science',
        icon: '🌱',
        color: '#14b8a6',
        description: 'Personal nutrition, environmental hygiene, water conservation, and body systems.',
        units: [
          {
            id: 'iep-u1',
            unitNum: 1,
            title: 'Unit 1: Nutrition & Balanced Diet',
            topics: [
              {
                id: 'iep-t1',
                title: 'Nutritional Groups',
                concepts: [
                  {
                    id: 'iep-nutrition-basics',
                    title: 'Food Groups: Energy, Growth & Protection',
                    subjectId: 'iep-life-sci',
                    unitId: 'iep-u1',
                    difficulty: 'Beginner',
                    prerequisites: [],
                    learningOutcome: 'Identify essential food categories (carbohydrates, proteins, vitamins) and build a balanced daily plate in ISL.',
                    overview: 'Our bodies require balanced nutrients: carbohydrates provide daily energy, proteins repair and build muscle, and vitamins defend against illnesses.',
                    notes: {
                      definitions: [
                        { term: 'Carbohydrates', def: 'Energy-rich foods such as rice, wheat, and millets that fuel everyday activity.' },
                        { term: 'Proteins', def: 'Bodybuilding nutrients found in pulses, milk, and eggs that support tissue growth and repair.' },
                        { term: 'Vitamins & Minerals', def: 'Protective elements abundant in fresh vegetables and fruits that keep eyes, skin, and immune system healthy.' }
                      ],
                      keyPoints: [
                        'Eating only one food group leads to nutrient deficiencies.',
                        'Drinking sufficient clean water daily is essential for nutrient transport and temperature regulation.',
                        'Fresh leafy vegetables provide vitamins, minerals, and dietary fiber.'
                      ],
                      visualTakeaway: 'Divide your plate: 1/2 vegetables and fruits, 1/4 whole grains, 1/4 protein.'
                    },
                    media: {
                      type: 'local',
                      title: 'Building a Healthy Balanced Plate Everyday',
                      duration: '3:10',
                      poster: 'assets/posters/nutrition.jpg',
                      transcript: 'Every meal fuels your body. Whole grains provide sustained stamina; pulses and milk rebuild muscles; colorful vegetables provide protective immunity.',
                      captions: 'Illustrated with real foods and authentic ISL signs.'
                    },
                    islKeywords: ['eat', 'food', 'water', 'clean', 'good', 'body'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL concepts for FOOD, WATER, and GOOD.',
                        targetReps: 5
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'Which nutrient group is primarily responsible for building muscle and repairing bodily tissues?',
                          options: ['Proteins', 'Sugars only', 'Oils only', 'Salt'],
                          correctIndex: 0,
                          explanation: 'Proteins are the essential structural nutrients needed for muscle synthesis and cell repair.',
                          misconceptionTag: 'nutrient_roles'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: null,
                      guidance: 'Review the balanced plate illustration and practice signing the three primary food groups.'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // 6. VOCATIONAL & NSQF SKILL CURRICULUM
  'vocational-nsqf-2026': {
    bundleId: 'vocational-nsqf-2026',
    curriculumId: 'vocational-nsqf',
    boardSystem: 'NSQF Vocational Skill',
    stateRegion: 'All-India / Practical Skill',
    educationalLevel: 'Vocational / Skill Development',
    academicYear: '2026–27',
    bundleVersion: '1.0.0',
    pathwayId: 'vocational',
    pathwayName: 'Vocational / NSQF Skill Curriculum',
    title: 'Web Design & Accessible Digital Interfaces',
    description: 'Practical vocational competencies, digital accessibility, and interactive web technologies.',
    subjects: [
      {
        id: 'voc-web',
        title: 'Web Design & Accessible Interfaces',
        shortTitle: 'Web & IT Skills',
        icon: '💻',
        color: '#8b5cf6',
        description: 'Hypertext structure, responsive layouts, and accessible digital design.',
        units: [
          {
            id: 'voc-web-u1',
            unitNum: 1,
            title: 'Unit 1: Hypertext Structure & Digital Semantics',
            topics: [
              {
                id: 'voc-web-t1',
                title: 'HTML Essentials',
                concepts: [
                  {
                    id: 'voc-html-semantics',
                    title: 'Semantic Web Structure & Accessibility',
                    subjectId: 'voc-web',
                    unitId: 'voc-web-u1',
                    difficulty: 'Beginner',
                    prerequisites: [],
                    learningOutcome: 'Construct an accessible digital page structure utilizing standard semantic layout elements.',
                    overview: 'Semantic HTML markup provides meaningful structural context to browsers and assistive screen readers using tags like header, main, nav, and article.',
                    notes: {
                      definitions: [
                        { term: 'Semantic Markup', def: 'Tags that clearly describe their meaning to both browser and developer (e.g. <header>, <article>).' },
                        { term: 'Accessibility (a11y)', def: 'Design of products and web pages so that people with disabilities can perceive, understand, and navigate them.' }
                      ],
                      keyPoints: [
                        'Using <main> declares the central unique content of the page.',
                        '<button> should be used for clickable interactive actions, rather than plain unstyled divs.',
                        'Alt text on images ensures screen reader users understand visual information.'
                      ],
                      visualTakeaway: 'A well-structured document is like an organized newspaper: Header at top, Navigation bar, Main article body, Footer at bottom.'
                    },
                    media: {
                      type: 'local',
                      title: 'Building Accessible Interfaces for Assistive Technology',
                      duration: '4:00',
                      poster: 'assets/posters/web_design.jpg',
                      transcript: 'Semantic tags communicate document hierarchy directly to screen readers and assistive devices, enabling seamless navigation for all users.',
                      captions: 'Captioned and signed in ISL.'
                    },
                    islKeywords: ['computer', 'write', 'read', 'rule', 'look', 'work'],
                    practiceActivities: [
                      {
                        type: 'repetition',
                        prompt: 'Practice signing the ISL concepts for COMPUTER, WRITE, and RULE.',
                        targetReps: 5
                      }
                    ],
                    assessment: {
                      questions: [
                        {
                          question: 'Which semantic HTML element represents the primary, central content of an educational web document?',
                          options: ['<main>', '<footer>', '<aside>', '<head>'],
                          correctIndex: 0,
                          explanation: 'The <main> tag designates the dominant and unique content of the page document body.',
                          misconceptionTag: 'html_semantics'
                        }
                      ]
                    },
                    remediation: {
                      prerequisiteId: null,
                      guidance: 'Review the anatomical comparison between newspaper layout and semantic HTML elements.'
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};

// Aliases for backwards compatibility
export const STANDARD_CURRICULA = CURRICULUM_BUNDLES;

// Storage keys
export const SCHOOL_STATE_STORAGE_KEY = 'v2s_learner_school_state_v2';
export const CONCEPT_MASTERY_KEY = 'v2s_concept_mastery_v2';
export const CUSTOM_BUNDLES_KEY = 'v2s_custom_bundles_v2';
export const PATHWAY_CONFIG_KEY = 'v2s_pathway_config_v2';

/**
 * Enterprise Offline Personalized Learning Intelligence Engine
 */
export class PersonalizedLearningEngine {
  constructor(learnerProfile = null) {
    this.learnerProfile = learnerProfile;
    this.customBundles = this.loadCustomBundles();
    this.schoolState = this.loadSchoolState();
    this.conceptMastery = this.loadConceptMastery();
    this.activeCurriculumId = this.schoolState.activeBundleId || null;
    this.activeSubjectId = null;
    this.activeConceptId = this.schoolState.lastActiveConcept?.conceptId || null;
    this.activeStudioStep = 'notes'; // 'notes' | 'video' | 'terms' | 'practice' | 'assess' | 'adapt'
  }

  // School State Loading & Saving
  loadSchoolState() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SCHOOL_STATE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch (e) {
      console.warn('[PersonalizedLearning] Error loading school state:', e);
    }
    return {
      activeBundleId: null,
      lastActiveConcept: null, // { conceptId, subjectId, timestamp }
      completedConcepts: [],
      spacedReviewQueue: [], // [ { conceptId, nextReviewDue, intervalDays, repetitions } ]
      diagnosedGaps: [],
      dailyPlanDate: null,
      dailyPlanItems: [],
      hasCompletedDiagnostic: false,
      isConfigured: false
    };
  }

  saveSchoolState() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SCHOOL_STATE_STORAGE_KEY, JSON.stringify(this.schoolState));
      }
    } catch (e) {
      console.error('[PersonalizedLearning] Error saving school state:', e);
    }
  }

  // Custom Bundle Persistence
  loadCustomBundles() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(CUSTOM_BUNDLES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch (e) {
      console.warn('[PersonalizedLearning] Error loading custom bundles:', e);
    }
    return {};
  }

  saveCustomBundles() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CUSTOM_BUNDLES_KEY, JSON.stringify(this.customBundles));
      }
    } catch (e) {
      console.error('[PersonalizedLearning] Error saving custom bundles:', e);
    }
  }

  // Concept Mastery Persistence
  loadConceptMastery() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(CONCEPT_MASTERY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch (e) {
      console.warn('[PersonalizedLearning] Error loading concept mastery:', e);
    }
    return {};
  }

  saveConceptMastery() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONCEPT_MASTERY_KEY, JSON.stringify(this.conceptMastery));
      }
    } catch (e) {
      console.error('[PersonalizedLearning] Error saving concept mastery:', e);
    }
  }

  // Onboarding & Readiness Checks
  hasConfiguredCurriculum() {
    const active = this.getActiveCurriculum();
    return Boolean(active && active.subjects && active.subjects.length > 0);
  }

  hasConfiguredProfile() {
    if (!this.learnerProfile || !this.learnerProfile.data) return false;
    const p = this.learnerProfile.data;
    return Boolean(p.isCustomConfigured || (p.learnerName && p.learnerName !== 'Learner'));
  }

  hasCompletedBaseline() {
    return Boolean(this.schoolState && this.schoolState.hasCompletedDiagnostic);
  }

  hasCompletedOnboarding() {
    return this.hasConfiguredProfile() && this.hasConfiguredCurriculum() && this.hasCompletedBaseline();
  }

  isPathBuilt() {
    return Boolean(this.schoolState && this.hasConfiguredCurriculum());
  }

  // Active Curriculum Management
  getAllCurricula() {
    return { ...CURRICULUM_BUNDLES, ...this.customBundles };
  }

  getAvailableBundles() {
    const all = this.getAllCurricula();
    return Object.values(all).map(b => ({
      bundleId: b.bundleId || b.id,
      curriculumId: b.curriculumId || b.id,
      boardSystem: b.boardSystem || b.pathwayName,
      stateRegion: b.stateRegion || 'All-India',
      educationalLevel: b.educationalLevel || 'Secondary',
      academicYear: b.academicYear || '2026–27',
      bundleVersion: b.bundleVersion || '1.0.0',
      pathwayId: b.pathwayId,
      pathwayName: b.pathwayName,
      title: b.title,
      description: b.description,
      subjectCount: (b.subjects || []).length
    }));
  }

  getActiveCurriculum() {
    const id = this.activeCurriculumId || this.schoolState.activeBundleId;
    if (!id) return null;
    const all = this.getAllCurricula();
    return all[id] || null;
  }

  setActiveCurriculum(bundleId) {
    const all = this.getAllCurricula();
    if (all[bundleId]) {
      this.activeCurriculumId = bundleId;
      this.schoolState.activeBundleId = bundleId;
      this.schoolState.isConfigured = true;
      this.activeSubjectId = null;
      this.saveSchoolState();
    }
  }

  // Last Active Concept (Continue Learning Hero)
  getLastActiveConcept() {
    const curr = this.getActiveCurriculum();
    if (!curr) return null;

    if (this.schoolState.lastActiveConcept) {
      const c = this.getConceptById(this.schoolState.lastActiveConcept.conceptId);
      if (c) return c;
    }

    // Default to the first concept of the first subject
    const all = this.getAllActiveConcepts();
    return all[0] || null;
  }

  setLastActiveConcept(conceptId) {
    const c = this.getConceptById(conceptId);
    if (c) {
      this.activeConceptId = conceptId;
      this.schoolState.lastActiveConcept = {
        conceptId,
        subjectId: c.subjectId,
        unitId: c.unitId,
        timestamp: Date.now()
      };
      this.saveSchoolState();
    }
  }

  // Concept Access
  getAllActiveConcepts() {
    const curr = this.getActiveCurriculum();
    if (!curr) return [];
    const list = [];
    (curr.subjects || []).forEach(subj => {
      (subj.units || []).forEach(unit => {
        (unit.topics || []).forEach(topic => {
          (topic.concepts || []).forEach(c => {
            list.push({
              ...c,
              subjectTitle: subj.title,
              subjectShortTitle: subj.shortTitle || subj.title,
              subjectIcon: subj.icon || '📖',
              subjectColor: subj.color || '#3b82f6',
              unitTitle: unit.title,
              topicTitle: topic.title
            });
          });
        });
      });
    });
    return list;
  }

  getConceptById(conceptId) {
    const all = this.getAllActiveConcepts();
    return all.find(c => c.id === conceptId) || null;
  }

  getConceptState(conceptId) {
    return this.conceptMastery[conceptId] || {
      attempts: 0,
      correct: 0,
      accuracy: 0,
      practiceReps: 0,
      status: 'not_assessed',
      lastAssessed: null
    };
  }

  // Spaced Retention Scheduler (SM-2 based)
  getSpacedReviewItems() {
    const now = Date.now();
    const queue = this.schoolState.spacedReviewQueue || [];
    return queue
      .filter(item => item.nextReviewDue <= now)
      .map(item => {
        const c = this.getConceptById(item.conceptId);
        return c ? { ...item, concept: c } : null;
      })
      .filter(Boolean);
  }

  // Dynamic Daily Learning Plan
  generateDailyPlan() {
    const concepts = this.getAllActiveConcepts();
    if (concepts.length === 0) return [];

    const plan = [];

    // Item 1: Continue Active Concept
    const lastActive = this.getLastActiveConcept();
    if (lastActive) {
      plan.push({
        type: 'continue',
        badge: 'CONTINUE',
        badgeClass: 'badge-continue',
        icon: '▶',
        concept: lastActive,
        title: `Continue: ${lastActive.title}`,
        description: `Pick up your active lesson in ${lastActive.subjectShortTitle}.`,
        actionLabel: 'Resume Lesson',
        targetStep: 'notes'
      });
    }

    // Item 2: Targeted Gap Remediation (if exists)
    const gaps = this.getIdentifiedLearningGaps();
    if (gaps.length > 0) {
      const topGap = gaps[0];
      plan.push({
        type: 'remediate',
        badge: 'NEEDS ATTENTION',
        badgeClass: 'badge-gap',
        icon: '⚠️',
        concept: topGap.concept,
        title: `Remediate: ${topGap.concept.title}`,
        description: topGap.reason,
        actionLabel: 'Review in ISL',
        targetStep: 'terms'
      });
    }

    // Item 3: Spaced Retention Review
    const dueReviews = this.getSpacedReviewItems();
    if (dueReviews.length > 0) {
      const reviewItem = dueReviews[0];
      plan.push({
        type: 'review',
        badge: 'SPACED REVIEW',
        badgeClass: 'badge-review',
        icon: '🧠',
        concept: reviewItem.concept,
        title: `Memory Check: ${reviewItem.concept.title}`,
        description: 'Scheduled review to consolidate retention into long-term memory.',
        actionLabel: 'Quick Review',
        targetStep: 'assess'
      });
    } else {
      // Practice developing concept
      const developing = concepts.find(c => this.getConceptState(c.id).status === 'developing');
      if (developing && developing.id !== lastActive?.id) {
        plan.push({
          type: 'practice',
          badge: 'PRACTICE',
          badgeClass: 'badge-practice',
          icon: '🎯',
          concept: developing,
          title: `Practice: ${developing.title}`,
          description: 'Strengthen conceptual accuracy through signing repetitions.',
          actionLabel: 'Sign Along Drill',
          targetStep: 'practice'
        });
      }
    }

    // Item 4: Milestone Assessment Check
    const unassessed = concepts.find(c => this.getConceptState(c.id).status === 'not_assessed' && c.id !== lastActive?.id);
    if (unassessed) {
      plan.push({
        type: 'assess',
        badge: 'ASSESS',
        badgeClass: 'badge-assess',
        icon: '📝',
        concept: unassessed,
        title: `Comprehension: ${unassessed.title}`,
        description: 'Establish your comprehension baseline on this concept.',
        actionLabel: 'Start Check',
        targetStep: 'assess'
      });
    }

    return plan.slice(0, 4);
  }

  // Diagnostic Assessment Probe
  completeDiagnosticAssessment(results = {}) {
    Object.entries(results).forEach(([cId, isCorrect]) => {
      this.recordAssessmentResult(cId, isCorrect);
    });
    this.schoolState.hasCompletedDiagnostic = true;
    this.saveSchoolState();
    return this.getMasterySummary();
  }

  // Prerequisite Graph & Gap Diagnosis
  getPrerequisiteGaps(conceptId) {
    const c = this.getConceptById(conceptId);
    if (!c || !c.prerequisites || c.prerequisites.length === 0) return [];

    const gaps = [];
    c.prerequisites.forEach(prereqId => {
      const state = this.getConceptState(prereqId);
      if (state.status !== 'strong') {
        const pr = this.getConceptById(prereqId);
        if (pr) gaps.push(pr);
      }
    });
    return gaps;
  }

  getIdentifiedLearningGaps() {
    const concepts = this.getAllActiveConcepts();
    const gaps = [];

    concepts.forEach(c => {
      const state = this.getConceptState(c.id);
      if (state.status === 'needs_support') {
        const prereqGaps = this.getPrerequisiteGaps(c.id);
        gaps.push({
          concept: c,
          reason: `Assessment accuracy below mastery threshold (${state.accuracy}% across ${state.attempts} attempt${state.attempts > 1 ? 's' : ''})`,
          severity: 'high',
          missingPrerequisites: prereqGaps,
          action: 'Reinforce in ISL'
        });
      } else if (state.attempts > 1 && state.accuracy < 75) {
        gaps.push({
          concept: c,
          reason: `Repeated practice attempts (${state.attempts} attempts &middot; ${state.accuracy}% accuracy)`,
          severity: 'medium',
          missingPrerequisites: [],
          action: 'Practice Key Terms'
        });
      }
    });

    return gaps;
  }

  // Real-time Mastery Calculations
  getMasterySummary() {
    const concepts = this.getAllActiveConcepts();
    let strong = 0;
    let developing = 0;
    let needsSupport = 0;
    let notAssessed = 0;

    concepts.forEach(c => {
      const state = this.getConceptState(c.id);
      if (state.status === 'strong') strong++;
      else if (state.status === 'developing') developing++;
      else if (state.status === 'needs_support') needsSupport++;
      else notAssessed++;
    });

    const total = concepts.length;
    const assessed = strong + developing + needsSupport;
    return {
      total,
      strong,
      developing,
      needsSupport,
      notAssessed,
      assessedRatio: total > 0 ? Math.round((assessed / total) * 100) : 0,
      masteryRatio: total > 0 ? Math.round((strong / total) * 100) : 0
    };
  }

  // Interactive Learning Studio Operations
  recordPracticeRep(conceptId) {
    if (!this.conceptMastery[conceptId]) {
      this.conceptMastery[conceptId] = {
        attempts: 0,
        correct: 0,
        accuracy: 0,
        practiceReps: 0,
        status: 'developing',
        lastAssessed: null
      };
    }
    this.conceptMastery[conceptId].practiceReps = (this.conceptMastery[conceptId].practiceReps || 0) + 1;
    if (this.conceptMastery[conceptId].status === 'not_assessed') {
      this.conceptMastery[conceptId].status = 'developing';
    }
    this.saveConceptMastery();
    this.setLastActiveConcept(conceptId);
    return this.conceptMastery[conceptId].practiceReps;
  }

  recordAssessmentResult(conceptId, isCorrect) {
    if (!this.conceptMastery[conceptId]) {
      this.conceptMastery[conceptId] = {
        attempts: 0,
        correct: 0,
        accuracy: 0,
        practiceReps: 0,
        status: 'not_assessed',
        lastAssessed: null
      };
    }
    const rec = this.conceptMastery[conceptId];
    rec.attempts = (rec.attempts || 0) + 1;
    if (isCorrect) rec.correct = (rec.correct || 0) + 1;
    rec.accuracy = Math.round((rec.correct / rec.attempts) * 100);
    rec.lastAssessed = Date.now();

    // Determine mastery level
    if (rec.accuracy >= 80 && rec.attempts >= 1) {
      rec.status = 'strong';
      if (!this.schoolState.completedConcepts.includes(conceptId)) {
        this.schoolState.completedConcepts.push(conceptId);
      }
      // Schedule next spaced review (SM-2 intervals: 3 days, 7 days, 14 days, 30 days)
      this.scheduleSpacedReview(conceptId, true);
    } else if (rec.accuracy >= 50) {
      rec.status = 'developing';
    } else {
      rec.status = 'needs_support';
      this.scheduleSpacedReview(conceptId, false);
    }

    this.saveConceptMastery();
    this.setLastActiveConcept(conceptId);
    this.saveSchoolState();
    return this.getConceptState(conceptId);
  }

  scheduleSpacedReview(conceptId, passed) {
    let queue = this.schoolState.spacedReviewQueue || [];
    let existing = queue.find(q => q.conceptId === conceptId);

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    if (!existing) {
      existing = {
        conceptId,
        nextReviewDue: now + (passed ? 3 * DAY_MS : 1 * DAY_MS),
        intervalDays: passed ? 3 : 1,
        repetitions: passed ? 1 : 0,
        lastReviewed: now
      };
      queue.push(existing);
    } else {
      if (passed) {
        existing.repetitions += 1;
        existing.intervalDays = Math.min(30, Math.round(existing.intervalDays * 2));
        existing.nextReviewDue = now + existing.intervalDays * DAY_MS;
      } else {
        existing.repetitions = 0;
        existing.intervalDays = 1;
        existing.nextReviewDue = now + 1 * DAY_MS;
      }
      existing.lastReviewed = now;
    }

    this.schoolState.spacedReviewQueue = queue;
    this.saveSchoolState();
  }

  // Interactive Learning Path Sequence
  getPersonalizedPath() {
    const concepts = this.getAllActiveConcepts();
    if (concepts.length === 0) return [];

    const path = [];
    const gaps = this.getIdentifiedLearningGaps();
    const lastActive = this.getLastActiveConcept();

    // 1. Gaps requiring remediation
    gaps.forEach(g => {
      path.push({
        concept: g.concept,
        nodeStatus: 'gap',
        badge: 'REINFORCE GAP',
        rationale: g.reason,
        prerequisites: (g.concept.prerequisites || []).map(pid => {
          const pr = this.getConceptById(pid);
          return { id: pid, title: pr ? pr.title : pid, state: this.getConceptState(pid) };
        }),
        currentMastery: this.getConceptState(g.concept.id),
        actionLabel: 'Reinforce in ISL',
        targetStep: 'terms'
      });
    });

    // 2. Currently Active Concept
    if (lastActive && !path.some(p => p.concept.id === lastActive.id)) {
      const state = this.getConceptState(lastActive.id);
      path.push({
        concept: lastActive,
        nodeStatus: 'current',
        badge: 'CURRENT LESSON',
        rationale: 'Continue where you left off in your curriculum journey.',
        prerequisites: (lastActive.prerequisites || []).map(pid => {
          const pr = this.getConceptById(pid);
          return { id: pid, title: pr ? pr.title : pid, state: this.getConceptState(pid) };
        }),
        currentMastery: state,
        actionLabel: 'Continue Lesson',
        targetStep: 'notes'
      });
    }

    // 3. Concepts with met prerequisites (Next unlock)
    concepts.forEach(c => {
      if (path.some(p => p.concept.id === c.id)) return;
      const state = this.getConceptState(c.id);
      const prereqs = c.prerequisites || [];
      const isLocked = prereqs.some(pid => this.getConceptState(pid).status !== 'strong');

      if (state.status === 'strong') {
        path.push({
          concept: c,
          nodeStatus: 'mastered',
          badge: 'MASTERED',
          rationale: `Concept mastered with ${state.accuracy}% accuracy.`,
          prerequisites: prereqs.map(pid => ({ id: pid, title: pid })),
          currentMastery: state,
          actionLabel: 'Review Concept',
          targetStep: 'notes'
        });
      } else if (isLocked) {
        path.push({
          concept: c,
          nodeStatus: 'locked',
          badge: 'PREREQUISITE LOCKED',
          rationale: 'Master previous foundation concepts first before unlocking this step.',
          prerequisites: prereqs.map(pid => ({ id: pid, title: pid })),
          currentMastery: state,
          actionLabel: 'Prerequisite Required',
          targetStep: 'notes'
        });
      } else {
        path.push({
          concept: c,
          nodeStatus: 'ready',
          badge: 'READY TO LEARN',
          rationale: 'Prerequisites met. Ready to explore in ISL.',
          prerequisites: prereqs.map(pid => ({ id: pid, title: pid })),
          currentMastery: state,
          actionLabel: 'Learn in ISL',
          targetStep: 'notes'
        });
      }
    });

    return path;
  }

  // Developer / Institution Curriculum Bundle Ingestion
  importCurriculumBundle(rawBundle) {
    try {
      const bundle = typeof rawBundle === 'string' ? JSON.parse(rawBundle) : rawBundle;
      if (!bundle || !bundle.subjects || !Array.isArray(bundle.subjects)) {
        return { success: false, error: 'Invalid bundle structure: subjects array is required.' };
      }

      const bundleId = bundle.bundleId || 'custom-' + Date.now();
      const cleanBundle = {
        bundleId,
        curriculumId: bundle.curriculumId || bundleId,
        boardSystem: bundle.boardSystem || bundle.pathwayName || 'Custom Educational Bundle',
        stateRegion: bundle.stateRegion || 'Custom',
        educationalLevel: bundle.educationalLevel || 'Adaptive',
        academicYear: bundle.academicYear || '2026–27',
        bundleVersion: bundle.bundleVersion || '1.0.0',
        pathwayId: bundle.pathwayId || 'custom',
        pathwayName: bundle.pathwayName || 'Custom Curriculum Bundle',
        title: bundle.title || 'Imported Curriculum Bundle',
        description: bundle.description || 'Offline bundle loaded into Voice 2 Sense.',
        subjects: bundle.subjects
      };

      this.customBundles[bundleId] = cleanBundle;
      this.saveCustomBundles();
      this.setActiveCurriculum(bundleId);
      return { success: true, bundle: cleanBundle };
    } catch (e) {
      return { success: false, error: 'Failed to parse curriculum bundle: ' + e.message };
    }
  }

  exportCurriculumBundle(bundleId) {
    const all = this.getAllCurricula();
    const bundle = all[bundleId] || this.getActiveCurriculum();
    if (!bundle) return null;
    return JSON.stringify(bundle, null, 2);
  }

  getPersonalizedNextSteps() {
    const gaps = this.getIdentifiedLearningGaps();
    if (gaps.length > 0) {
      const topGap = gaps[0];
      return [{
        tag: 'remediate',
        concept: topGap.concept,
        title: topGap.concept.title,
        rationale: topGap.reason,
        actionLabel: 'Reinforce in ISL',
        targetStep: 'terms'
      }];
    }
    const path = this.getPersonalizedPath();
    const ready = path.find(p => p.nodeStatus === 'ready');
    if (ready) {
      return [{
        tag: 'advance',
        concept: ready.concept,
        title: ready.concept.title,
        rationale: ready.rationale || 'Next recommended concept along your personalized curriculum path.',
        actionLabel: 'Learn in ISL',
        targetStep: 'notes'
      }];
    }
    const current = path.find(p => p.nodeStatus === 'current');
    if (current) {
      return [{
        tag: 'continue',
        concept: current.concept,
        title: current.concept.title,
        rationale: 'Continue your active lesson module.',
        actionLabel: 'Continue Lesson',
        targetStep: 'notes'
      }];
    }
    const all = this.getAllActiveConcepts();
    if (all.length > 0) {
      return [{
        tag: 'review',
        concept: all[0],
        title: all[0].title,
        rationale: 'Review foundation concept in your curriculum.',
        actionLabel: 'Review Concept',
        targetStep: 'notes'
      }];
    }
    return [];
  }

  getSubjectsSummary() {
    const curr = this.getActiveCurriculum();
    if (!curr || !curr.subjects) return [];

    return curr.subjects.map(subj => {
      const concepts = [];
      (subj.units || []).forEach(unit => {
        (unit.topics || []).forEach(topic => {
          (topic.concepts || []).forEach(c => {
            concepts.push({
              ...c,
              unitTitle: unit.title,
              topicTitle: topic.title
            });
          });
        });
      });

      const total = concepts.length;
      let mastered = 0;
      let developing = 0;
      let nextRec = null;

      concepts.forEach(c => {
        const state = this.getConceptState(c.id);
        if (state.status === 'strong') {
          mastered++;
        } else if (state.status === 'developing') {
          developing++;
          if (!nextRec) nextRec = c;
        } else if (!nextRec) {
          nextRec = c;
        }
      });

      if (!nextRec && concepts.length > 0) {
        nextRec = concepts[0];
      }

      const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;
      const currentTopic = nextRec ? nextRec.topicTitle : (subj.units?.[0]?.topics?.[0]?.title || 'Foundation Units');

      return {
        id: subj.id,
        title: subj.title,
        shortTitle: subj.shortTitle || subj.title,
        icon: subj.icon || '📖',
        color: subj.color || '#3b82f6',
        description: subj.description || '',
        totalConcepts: total,
        masteredCount: mastered,
        developingCount: developing,
        progressPercent: progress,
        currentTopic,
        nextConcept: nextRec
      };
    });
  }

  resetToOnboarding() {
    this.schoolState = {
      activeBundleId: null,
      lastActiveConcept: null,
      completedConcepts: [],
      spacedReviewQueue: [],
      diagnosedGaps: [],
      dailyPlanDate: null,
      dailyPlanItems: [],
      hasCompletedDiagnostic: false,
      isConfigured: false
    };
    this.saveSchoolState();
    this.activeCurriculumId = null;
    this.activeConceptId = null;
    this.conceptMastery = {};
    this.saveConceptMastery();
  }

  /**
   * Offline Educational Doubt Resolution Engine (Feature 2 - Mode 1)
   * Deterministic, rule-based hierarchical search across:
   * 1. Current Lesson (Definitions, Key Points, Overview, Transcript)
   * 2. Current Topic / Unit
   * 3. Current Subject
   * 4. Student's Full Curriculum Knowledge Base
   * 
   * Zero cloud LLM, Zero hallucination.
   * If not found confidently, returns exact fallback.
   * 
   * @param {string|string[]} query - Recognized ISL tokens or question text
   * @param {string} [activeConceptId] - Active lesson ID
   * @returns {Object} Structured educational answer or verified fallback
   */
  searchLocalEducationalContent(query, activeConceptId = null) {
    const rawTokens = Array.isArray(query)
      ? query
      : String(query || '').trim().split(/\s+/).filter(Boolean);

    if (rawTokens.length === 0) {
      return {
        found: false,
        query: '',
        question: 'Doubt query empty',
        answer: "I couldn't find a reliable answer in your current learning material.",
        keyConcepts: [],
        source: null
      };
    }

    const queryStr = rawTokens.join(' ').toLowerCase();
    const cleanTokens = rawTokens
      .map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(t => t.length > 1);

    const activeConcept = activeConceptId ? this.getConceptById(activeConceptId) : this.getLastActiveConcept();
    const allConcepts = this.getAllActiveConcepts();

    // Priority 1: Search Active Concept (Current Lesson)
    if (activeConcept) {
      const match = this._scoreConceptContent(activeConcept, cleanTokens, queryStr);
      if (match.score >= 0.35) {
        return {
          found: true,
          query: rawTokens.join(' '),
          question: this._formatDoubtQuestion(rawTokens, activeConcept.title),
          answer: match.bestText,
          keyConcepts: match.matchedTerms,
          source: `Current Lesson: ${activeConcept.title} (${activeConcept.unitTitle || 'Active Unit'})`,
          conceptId: activeConcept.id,
          conceptTitle: activeConcept.title
        };
      }
    }

    // Priority 2: Search Same Unit/Topic Concepts
    if (activeConcept && activeConcept.unitId) {
      const sameUnit = allConcepts.filter(c => c.unitId === activeConcept.unitId && c.id !== activeConcept.id);
      for (const c of sameUnit) {
        const match = this._scoreConceptContent(c, cleanTokens, queryStr);
        if (match.score >= 0.4) {
          return {
            found: true,
            query: rawTokens.join(' '),
            question: this._formatDoubtQuestion(rawTokens, c.title),
            answer: match.bestText,
            keyConcepts: match.matchedTerms,
            source: `Current Topic / Unit: ${c.title}`,
            conceptId: c.id,
            conceptTitle: c.title
          };
        }
      }
    }

    // Priority 3: Search Same Subject Concepts
    if (activeConcept && activeConcept.subjectId) {
      const sameSubject = allConcepts.filter(c => c.subjectId === activeConcept.subjectId && c.id !== activeConcept.id);
      for (const c of sameSubject) {
        const match = this._scoreConceptContent(c, cleanTokens, queryStr);
        if (match.score >= 0.45) {
          return {
            found: true,
            query: rawTokens.join(' '),
            question: this._formatDoubtQuestion(rawTokens, c.title),
            answer: match.bestText,
            keyConcepts: match.matchedTerms,
            source: `Current Subject: ${c.title}`,
            conceptId: c.id,
            conceptTitle: c.title
          };
        }
      }
    }

    // Priority 4: Search Entire Active Curriculum Bundle
    let bestGlobalMatch = null;
    let highestScore = 0;
    for (const c of allConcepts) {
      const match = this._scoreConceptContent(c, cleanTokens, queryStr);
      if (match.score > highestScore) {
        highestScore = match.score;
        bestGlobalMatch = { concept: c, match };
      }
    }

    if (bestGlobalMatch && highestScore >= 0.5) {
      const c = bestGlobalMatch.concept;
      return {
        found: true,
        query: rawTokens.join(' '),
        question: this._formatDoubtQuestion(rawTokens, c.title),
        answer: bestGlobalMatch.match.bestText,
        keyConcepts: bestGlobalMatch.match.matchedTerms,
        source: `Curriculum Knowledge Base: ${c.title} (${c.subjectShortTitle || 'Curriculum'})`,
        conceptId: c.id,
        conceptTitle: c.title
      };
    }

    // Exact required fallback when no reliable answer is verified
    return {
      found: false,
      query: rawTokens.join(' '),
      question: this._formatDoubtQuestion(rawTokens),
      answer: "I couldn't find a reliable answer in your current learning material.",
      keyConcepts: [],
      source: null
    };
  }

  _scoreConceptContent(concept, tokens, queryStr) {
    let score = 0;
    let bestText = concept.overview || concept.learningOutcome || '';
    const matchedTerms = [];

    // 1. Check notes definitions
    const defs = concept.notes?.definitions || [];
    for (const d of defs) {
      const tNorm = (d.term || '').toLowerCase();
      const defNorm = (d.def || '').toLowerCase();

      // Direct term hit
      for (const token of tokens) {
        if (tNorm.includes(token)) {
          score += 0.5;
          matchedTerms.push(d.term);
          bestText = `${d.term}: ${d.def}`;
          break;
        }
      }

      // Definition text hit
      for (const token of tokens) {
        if (defNorm.includes(token)) {
          score += 0.2;
          if (!matchedTerms.includes(d.term)) matchedTerms.push(d.term);
          if (!bestText || bestText === concept.overview) {
            bestText = `${d.term}: ${d.def}`;
          }
        }
      }
    }

    // 2. Check concept title & keywords
    const cTitle = (concept.title || '').toLowerCase();
    for (const token of tokens) {
      if (cTitle.includes(token)) {
        score += 0.35;
        matchedTerms.push(concept.title);
      }
    }

    const kws = concept.islKeywords || [];
    for (const kw of kws) {
      if (tokens.includes(kw.toLowerCase())) {
        score += 0.25;
        matchedTerms.push(kw.toUpperCase());
      }
    }

    // 3. Check keyPoints
    const pts = concept.notes?.keyPoints || [];
    for (const pt of pts) {
      const ptLower = pt.toLowerCase();
      let ptHit = 0;
      for (const token of tokens) {
        if (ptLower.includes(token)) ptHit++;
      }
      if (ptHit >= 2) {
        score += 0.3;
        bestText = pt;
      }
    }

    // Deduplicate matched terms
    const uniqueTerms = Array.from(new Set(matchedTerms)).slice(0, 4);

    return {
      score: Math.min(score, 1.0),
      bestText: bestText,
      matchedTerms: uniqueTerms.length > 0 ? uniqueTerms : [concept.title]
    };
  }

  _formatDoubtQuestion(tokens, contextTitle = '') {
    const joined = tokens.join(' ').toUpperCase();
    if (joined.includes('WHAT') && joined.includes('FUNCTION')) {
      return `What is the function of ${contextTitle || joined.replace(/WHAT|FUNCTION/g, '').trim()}?`;
    }
    if (joined.includes('WHAT')) {
      return `What is ${contextTitle || joined.replace(/WHAT/g, '').trim()}?`;
    }
    if (joined.includes('HOW')) {
      return `How does ${contextTitle || joined.replace(/HOW/g, '').trim()} work?`;
    }
    return `Inquiry: "${joined}"${contextTitle ? ` regarding ${contextTitle}` : ''}`;
  }
}


