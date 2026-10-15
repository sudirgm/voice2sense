# Voice2Sense — Inclusive Communication & Indian Sign Language Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vite](https://img.shields.io/badge/Vite-8.2+-646CFF.svg)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r185+-black.svg)](https://threejs.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks--Vision-007FFF.svg)](https://developers.google.com/mediapipe)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com/)

---

## 1. Problem Statement & Intended Users

Over 18 million individuals in India are Deaf or Hard of Hearing (DHH). While Indian Sign Language (ISL) is their primary and natural medium of communication, the vast majority of hearing teachers, government personnel, medical professionals, and coworkers do not understand ISL syntax. Conversely, traditional assistive tools rely on verbatim English/Hindi text captions, which ignore the unique Subject-Object-Verb (SOV) grammatical structure of ISL.

### Intended Users
* **Deaf and Hard of Hearing (DHH) Individuals**: Independent access to classroom lectures, workplace conferences, and digital communications via visual 3D sign translation and webcam-to-speech interaction.
* **Special Educators & Schools**: Standardized, interactive curriculum tools for teaching ISL handshapes, numbers, and vocabulary with continuous kinematic feedback.
* **Hearing Peers & Professionals**: Direct bidirectional communication with DHH individuals without requiring third-party human interpreters.

---

## 2. Solution Overview & Core Capabilities

**Voice2Sense** provides a real-time, bidirectional accessibility platform:

1. **🤟 Real-Time Two-Way Communication Hub**:
   * **Voice-to-Sign**: Captures spoken English or vernacular speech, performs grammatical normalization, and translates words into smooth 3D avatar animations.
   * **Sign-to-Voice**: Employs real-time 21-joint computer vision to detect ISL handshapes from a standard webcam, compiling gestures into sentences and reading them aloud via natural speech synthesis.
2. **🎓 Adaptive ISL Educational Studio**:
   * Multi-tiered learning pathway covering foundational alphabets, numbers, common phrases, and secondary school science/math concepts.
   * Spaced repetition engine (`learnerStore.js`) tracking individual accuracy, review cycles, and mastery benchmarks.
3. **🔒 100% Client-Side Privacy**:
   * Computer vision kinematics are processed entirely within the browser using WebAssembly. No video frames or biometric camera data are ever transmitted across networks.
4. **📖 Offline Syllabus Knowledge Graph**:
   * Deterministic academic engine answering curriculum questions (e.g., Newton's laws of motion, cellular biology, digital literacy) with calibrated explanations and sign glosses.

---

## 3. Technology Stack

* **Frontend Web Studio (`viewer/`)**:
  * **Build Tool**: Vite (ES modules, fast hot reload)
  * **3D Graphics Engine**: Three.js (WebGL rendering, skinned skeletal retargeting)
  * **Edge Computer Vision**: Google MediaPipe Hand Landmarker via WebAssembly (SIMD & non-SIMD fallbacks)
  * **Neural Inference**: TensorFlow.js (isolated landmark gesture classifier)
  * **Desktop Packaging**: Electron Context Bridge (`electron-main.cjs`, `preload.cjs`)
* **Offline Translation Backend (`multilingual translation/`)**:
  * **Web Framework**: FastAPI & Uvicorn
  * **Speech Recognition**: OpenAI Whisper (`whisper-tiny`)
  * **Machine Translation**: AI4Bharat `IndicTrans2` (Indic-to-English translation across 22 scheduled languages)
  * **Script Processing**: Indic NLP Library

---

## 4. Prerequisites & Installation

### System Requirements
* **Node.js**: v18.0.0 or higher
* **Python**: v3.10 or higher (required only if running the optional translation microservice)
* **Webcam**: Standard 720p/1080p camera for ISL gesture detection
* **Web Browser**: Chrome, Edge, or Firefox with WebAssembly and WebGL support

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/sudirgm/voice2sense.git
cd voice2sense
```

---

### Step 2: Set Up & Launch Frontend Web Studio
```bash
cd viewer
npm install
npm run dev:frontend
```
The application will launch on `http://127.0.0.1:5173`. Open this URL in your web browser.

---

### Step 3: Set Up Optional Multilingual Backend (Optional)
If you wish to test offline Indic vernacular speech translation (Whisper + IndicTrans2):

1. **Configure Python Environment**:
   ```bash
   cd "multilingual translation"
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On Linux/macOS:
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Download Model Checkpoints (~964 MB)**:
   *To keep this repository lightweight, heavy neural network weights are excluded from Git.*
   ```bash
   python download_model.py     # Downloads IndicTrans2 (~700 MB)
   python download_whisper.py   # Downloads Whisper-tiny (~250 MB)
   ```

3. **Launch Microservice Gateway**:
   ```bash
   python api_server.py
   ```
   The backend service starts at `http://127.0.0.1:8000`. The frontend Vite dev server will automatically proxy requests from `/api/translate` and `/api/process_speech`.

---

## 5. Environment Configuration

Copy the sample environment file in `viewer/`:
```bash
cp viewer/.env.example viewer/.env
```
Default configuration:
```ini
# Default endpoint for the local IndicTrans2 & Whisper FastAPI service
OFFLINE_TRANSLATION_URL=http://127.0.0.1:8000
```

---

## 6. How to Run Automated Verification Tests

The repository includes standalone automated test suites verifying kinematic gestures, multilingual normalization, and communication hub protocols:

```bash
cd viewer

# 1. Verify 27 Kinematic ISL Gesture Rules (MediaPipe 21-joint logic)
node test_isl_recognition.mjs

# 2. Verify 25 Multilingual Intent & Grammatical Normalization Rules
node test_meaning_normalizer.js

# 3. Verify 22 Two-Way Communication Hub Protocols
node test_twoway_hub.mjs

# 4. Verify BVH Motion Parser Structure
node test_bvh.mjs
```

---

## 7. Sample Usage & Demonstration Walkthrough

1. **Two-Way Communication Hub**:
   * Navigate to the **Real-Time Communication** tab and select the **🤟 Two-Way Hub** pill.
   * **Deaf Participant (Left)**: Click **Start Camera**. Position your hand in the camera frame. Form signs such as `HELLO`, `GOOD`, `THANK YOU`, `WATER`, or `HELP`. The live skeletal wireframe turns green upon stabilization. Click **Speak & Send** to vocalize the sentence.
   * **Hearing Participant (Right)**: Click **Hold to Speak** or select sample quick-test phrases (e.g. *"Hello, welcome to our presentation"*). The 3D avatar animates the corresponding signs immediately.
2. **Adaptive Educational Portal**:
   * Switch to the **Foundational Skill Development** tab.
   * Click through the alphabet grid (A–Z) or numbers (0–9).
   * Observe the 3D avatar performing authentic fingerspelling handshapes, and engage with the 3-phase practice loop.

---

## 8. Technical Disclosures & Known Limitations

To provide complete clarity for evaluators, please note the following runtime constraints:

1. **Excluded 100+ GB Raw Mocap Dataset (`Train/`)**:
   * `viewer/public/dictionary.json` provides 40 core conversational and educational sign definitions authored specifically for this prototype.
   * The 100+ GB raw motion capture recording dataset (`Train/`) was excluded for repository portability. Complex phrases not matching existing glosses gracefully fall back to continuous fingerspelling on the 3D avatar.
2. **External CDN Script Dependency**:
   * `viewer/index.html` loads `tf.min.js` (TensorFlow.js) and the YouTube IFrame API from CDN on first launch.
   * An initial internet connection is required to allow your browser to cache these libraries. Once cached, the computer vision engine runs locally via WebAssembly.
3. **Backend Model Weights**:
   * Running `api_server.py` requires running `download_model.py` and `download_whisper.py` once. If the backend is not started, the frontend operates gracefully in standalone mode with clear offline status indications.
4. **2D Reference Graphics**:
   * Unattributed static 2D image cards were excluded. The interface displays an informative fallback notice while the 3D avatar continues to sign dynamically.

---

## 9. Third-Party Licenses & Acknowledgements

* **3D Humanoid Avatar (`character_clean.glb`)**: Created by **@Quaternius** under the [Creative Commons Zero (CC0 1.0) Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/).
* **MediaPipe Tasks Vision**: Copyright (c) Google LLC. Licensed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).
* **Indic NLP Library**: Copyright (c) 2013-present Anoop Kunchukuttan. Licensed under the [MIT License](multilingual translation/LICENSE.indicnlp).
* **Three.js**: Copyright (c) 2010-2026 Three.js Authors. Licensed under the [MIT License](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
* **INCLUDE Dataset & Gesture Model Weights (`viewer/public/tfjs_model/`)**: Created by **AI4Bharat / IIT Madras** (Advaith Sridhar et al., ACM Multimedia 2020, DOI: [10.1145/3394171.3413528](https://doi.org/10.1145/3394171.3413528)). Licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
* **Project-Authored ISL Dictionary (`viewer/public/dictionary.json`)**: 100% project-authored synthetic vocabulary designed for Voice2Sense prototype evaluation.

See [`LICENSE`](LICENSE) for complete legal texts.

---

## 10. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Failed to load character_clean.glb"** | Avatar GLB file missing or blocked | Ensure `viewer/public/character_clean.glb` exists and Vite dev server is running. |
| **"Webcam permission denied"** | Browser blocked camera access | Grant camera permissions in browser address bar (lock icon) and refresh. |
| **"Offline translation returned status 503"** | Local backend microservice not running | Run `python api_server.py` inside `multilingual translation/`, or rely on client-side speech input. |
| **"tf is not defined"** | CDN script blocked by ad-blocker or firewall | Ensure `jsdelivr.net` is accessible on initial page load to permit TensorFlow.js loading. |
