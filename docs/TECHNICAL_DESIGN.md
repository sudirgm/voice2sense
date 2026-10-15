# Voice2Sense — Technical Design Document

## 1. System Overview

**Voice2Sense** (incorporating **SignBridge 3D**) is an assistive communication and educational technology platform designed to bridge the interaction barrier between Deaf/Hard-of-Hearing (DHH) individuals and hearing peers, educators, and service providers across India.

The system combines:
1. **Bidirectional Two-Way Communication Hub**: Seamlessly translates spoken vernacular audio into Indian Sign Language (ISL) 3D avatar animations, and classifies incoming webcam hand gestures into text and natural synthesized speech.
2. **Adaptive ISL Educational Studio**: A curriculum-aligned learning portal integrating spaced repetition, interactive kinematic checks, and deterministic syllabus exploration.
3. **Privacy-Preserving Edge Architecture**: Performs continuous 21-joint skeletal landmark extraction and sign classification client-side via WebAssembly and WebGL/WebGPU, ensuring camera feeds never leave the user's device.

---

## 2. High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Client["Client Application (Vite + Three.js + WebAssembly)"]
        UI["User Interface (HTML5 / Vanilla CSS Design System)"]
        AppCoord["Application Coordinators (main.js & eduApp.js)"]
        
        subgraph InputPipes["Input Pipelines"]
            SpeechIn["Speech Input Service (Web Speech API / Audio Stream)"]
            VisionIn["Camera Feed (MediaDevices.getUserMedia)"]
            DocIn["Screen & Presentation Capture (DisplayMedia API)"]
        end
        
        subgraph EdgeInference["Edge ISL Inference Engine"]
            MPWasm["MediaPipe Vision Tasks (Local WASM)"]
            LandmarkTracker["21-Joint Skeletal Kinematics Extractor"]
            TFJS["TensorFlow.js Landmark Classifier"]
            HeuristicEngine["Kinematic Rule & Geometry Classifier"]
        end

        subgraph AvatarEngine["3D Avatar Animation Studio"]
            ThreeStage["Three.js WebGL Renderer & Scene Graph"]
            RiggedModel["67-Bone Humanoid Avatar (character_clean.glb)"]
            Retargeter["Skeletal Retargeting Engine"]
            Fingerspell["Algorithmic 3D Fingerspelling Engine"]
            SignSync["Sign Synchronization Controller"]
        end

        subgraph AcademicCore["Curriculum & Knowledge Base"]
            DictMatcher["Sign Matcher & Dictionary Index"]
            AcademicAI["Deterministic Syllabus Knowledge Graph"]
            LearnerStore["Spaced Repetition & Mastery Store"]
        end
    end

    subgraph Backend["Optional Offline Backend Microservice (FastAPI)"]
        APIServer["FastAPI Gateway (api_server.py:8000)"]
        ASRPipe["Whisper Speech Recognition (asr.py)"]
        IndicTrans["IndicTrans2 Translation Pipeline (translator.py)"]
        IndicNLP["Indic NLP Script Normalizer"]
    end

    %% Connections
    VisionIn --> MPWasm
    MPWasm --> LandmarkTracker
    LandmarkTracker --> TFJS
    LandmarkTracker --> HeuristicEngine
    TFJS --> AppCoord
    HeuristicEngine --> AppCoord

    SpeechIn --> AppCoord
    SpeechIn -.->|Optional Base64 Audio| APIServer
    APIServer --> ASRPipe
    APIServer --> IndicTrans
    IndicTrans --> IndicNLP
    IndicTrans -.->|Normalized English Text| AppCoord

    AppCoord --> DictMatcher
    AppCoord --> AcademicAI
    DictMatcher --> SignSync
    SignSync --> Retargeter
    SignSync --> Fingerspell
    Retargeter --> ThreeStage
    Fingerspell --> ThreeStage
    ThreeStage --> RiggedModel
    ThreeStage --> UI
```

---

## 3. Component Responsibilities

### 3.1 Client-Side Application (`viewer/`)
* **Coordinator Layer (`main.js` & `eduApp.js`)**: Orchestrates user interactions, manages tab transitions between Real-Time Communication and Educational portals, and binds event streams.
* **Two-Way Communication Hub (`main.js`)**: Houses split studio views for Deaf and Hearing participants, live conversation timelines, and automatic speech-to-gesture and gesture-to-speech dispatchers.
* **3D Avatar Engine (`character_clean.glb`, `retarget.js`, `fingerspell.js`)**:
  * Loads a 67-bone articulated humanoid mesh.
  * Dynamically computes joint rotation quaternions for fingerspelling letters A–Z and digits 0–9 in real time.
  * Synchronizes subtitle queues and avatar handshapes with speech audio rates.
* **Kinematic Vision Pipeline (`islRecognitionService.js`)**:
  * Consumes raw video frames at 30 FPS.
  * Executes Google MediaPipe Hand Landmarker via SIMD/non-SIMD WebAssembly.
  * Calculates authentic 3D palm normal vectors, finger curl ratios, inter-digital angles, and temporal trajectories.
  * Classifies 40 verified ISL signs using combined deep learning (TF.js) and geometric heuristics.
* **Syllabus Knowledge Graph (`academicAIService.js`)**:
  * A 100% offline, deterministic educational graph providing grade-appropriate explanations, real-world examples, and key concept mappings for Secondary science, math, and digital literacy.

### 3.2 Offline Backend Microservice (`multilingual translation/`)
* **Gateway (`api_server.py`)**: Exposes asynchronous REST endpoints (`/translate`, `/process_speech`, `/asr`) with CORS headers.
* **Speech-to-Text (`asr.py`)**: Loads OpenAI Whisper (`whisper-tiny`) to convert incoming microphone audio into vernacular text.
* **Multilingual Translation (`translator.py`)**: Leverages AI4Bharat's `IndicTrans2` model to translate 22 scheduled Indian languages into standardized English text suitable for ISL syntax mapping.
* **Script Normalization (`indicnlp/`)**: Provides Brahmi-derived script normalization, tokenization, and transliteration.

---

## 4. End-to-End Data Flow

### 4.1 Hearing-to-Deaf Pipeline (Voice -> Indian Sign Language)
```mermaid
sequenceDiagram
    autonumber
    actor Hearing as Hearing Speaker
    participant WebApp as Client Web Studio
    participant Backend as FastAPI Microservice
    participant Normalizer as Meaning Normalizer
    participant Avatar as 3D Avatar Engine
    actor Deaf as Deaf User

    Hearing->>WebApp: Speaks Vernacular Speech (e.g., Hindi/Tamil)
    alt Offline Backend Active
        WebApp->>Backend: POST /process_speech (base64 audio)
        Backend->>Backend: Whisper ASR -> IndicTrans2 Translation
        Backend-->>WebApp: Translated English Sentence
    else Web Speech Fallback
        WebApp->>WebApp: Browser SpeechRecognition API
    end

    WebApp->>Normalizer: Normalize Sentence & Extract Semantic Tokens
    Normalizer->>Normalizer: Apply ISL SOV Grammatical Reordering
    Normalizer-->>WebApp: Array of Sign Tokens
    WebApp->>Avatar: Dispatch Tokens to SignSyncController
    Avatar->>Avatar: Lookup Sign in Dictionary or Compute 3D Fingerspelling
    Avatar->>Deaf: Render 3D Avatar Signing Motion on Screen
```

### 4.2 Deaf-to-Hearing Pipeline (ISL Gesture -> Voice Speech)
```mermaid
sequenceDiagram
    autonumber
    actor Deaf as Deaf Signer
    participant Cam as Local Webcam Feed
    participant WASM as MediaPipe WASM Kinematics
    participant Classifier as TF.js & Heuristic Engine
    participant TTS as Web Speech Synthesis
    actor Hearing as Hearing Listener

    Deaf->>Cam: Performs ISL Sign Gesture
    Cam->>WASM: Raw Video Frames (30 FPS)
    WASM->>Classifier: 21 3D Joint Coordinates & Normal Vectors
    Classifier->>Classifier: Sequence Temporal Analysis & Stabilization
    Classifier-->>WebApp: Emits Confident Sign Prediction (e.g. "THANK YOU")
    WebApp->>WebApp: Appends Token to Live Conversation Sequence
    Deaf->>WebApp: Triggers "Speak & Send"
    WebApp->>TTS: Speak Natural Utterance
    TTS->>Hearing: Audio Speech Broadcast ("Thank you very much.")
```

---

## 5. Security, Privacy, & Data Governance

1. **Zero Cloud Camera Transmission**: All computer vision algorithms run directly inside the user's browser using client-side WebAssembly (`viewer/public/wasm/`). Video frames are analyzed in transient canvas buffers and immediately discarded; zero frames are uploaded to external servers.
2. **Local Machine Isolation**: The multilingual translation microservice binds strictly to loopback (`127.0.0.1:8000`). No inbound public networking is required.
3. **Stateless Processing**: Speech audio sent to the local backend is processed in-memory and is not written to persistent disk storage.
4. **Secret Hygiene**: Zero API keys or cloud credentials exist in the codebase. All endpoints rely on open models and local services.

---

## 6. Current Technical Limitations & Future Roadmap

* **Sentence Animation Fallback**: Because the full 100+ GB raw motion capture dataset (`Train/`) is excluded for repository portability, sentence replay defaults to word-by-word 3D fingerspelling.
  * *Future Roadmap*: Compress representative motion capture clips into optimized binary WebAssembly motion streams (<500 KB each).
* **Initial CDN Requirement**: First-time web page launch loads TensorFlow.js from CDN before client caching takes over.
  * *Future Roadmap*: Vendor `tf.min.js` directly into `viewer/public/js/` for 100% air-gapped out-of-the-box initialization.
* **Two-Hand Facial Kinematics**: Current gesture detection focuses primarily on hand landmarks.
  * *Future Roadmap*: Integrate MediaPipe Holistic to track non-manual facial expressions and torso orientation essential for advanced ISL grammar.
