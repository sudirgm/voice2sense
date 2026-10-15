import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { BONE_MAP } from './boneMap.js';
import { Retargeter } from './retarget.js';
import { SignMatcher } from './signMatcher.js';
import { SpeechRecognizer } from './speechRecognizer.js';
import { Fingerspeller } from './fingerspell.js';
import { signSyncController } from './signSyncController.js';
import { ScreenCaptureService } from './screenCaptureService.js';
import { VADProcessor } from './vadProcessor.js';
import { FloatingSignerManager } from './floatingSignerManager.js';
import { meaningNormalizer, LANGUAGE_BY_CODE } from './meaningNormalizer.js';
import { islRecognitionService, RECOGNITION_STATES, SUPPORTED_ISL_SIGNS_V1 } from './islRecognitionService.js';
import { TTSService } from './ttsService.js';

// --- STATE MANAGEMENT ---
let scene, camera, renderer, controls;
let characterModel = null;
let bvhSkeleton = null;
let bvhMixer = null;
let currentAction = null;
let retargeter = null;
let fingerspeller = null;
let lastFrameTime = performance.now();
const bvhLoader = new BVHLoader();
const bvhCache = new Map();

let signMatcher = null;
let speechRecognizer = null;
let mediaStream = null;

// Tab 1 Real-Time Communication Services
let screenCaptureService = null;
let vadProcessor = null;
let floatingSignerManager = null;
let isTranslationPaused = false;
let lastProcessedTime = 0;
let lastProcessedPhrase = '';

// Tab 1 Two-Way Communication Hub State
let currentRtcSubmode = 'screen'; // 'screen' | 'twoway'
let twoWayResizeObserver = null;
let rtcTtsService = new TTSService();
let isTwoWayMicActive = false;

let isPlaying = true;
let playbackSpeed = 1.0;
let isLooping = true;
let currentMode = 'home'; // 'home' by default, or 'screen', 'studio', etc.
let currentSignSample = null;

// Queue-based continuous sign playback & cancellation tracking
let signQueue = [];
let isQueueActive = false;
let currentSequenceId = 0;
let currentBvhFinishResolver = null;
let currentLetterTimer = null;
let lastRecognizedSpeechText = '';
let pipWindow = null;
let isCornerRight = false;

const DOM = {
  // Navigation & Mode
  btnNavHome: document.getElementById('btn-nav-home'),
  stageHome: document.getElementById('view-landing') || document.getElementById('landing-view') || document.getElementById('home-stage'),
  btnModeScreen: document.getElementById('btn-mode-screen'),
  btnModeStudio: document.getElementById('btn-mode-studio'),
  stageScreen: document.getElementById('screen-stage'),
  stageStudio: document.getElementById('studio-stage'),
  cornerContainer: document.getElementById('corner-canvas-container'),
  studioContainer: document.getElementById('studio-canvas-container'),

  // Real-Time Communication Tab 1 Controls
  btnRtcStartTranslation: document.getElementById('btn-rtc-start-translation'),
  btnRtcToggleCapture: document.getElementById('btn-rtc-toggle-capture'),
  btnRtcCaptureLabel: document.getElementById('btn-rtc-capture-label'),
  btnRtcPauseResume: document.getElementById('btn-rtc-pause-resume'),
  btnRtcPauseLabel: document.getElementById('btn-rtc-pause-label'),
  btnRtcRecenterSigner: document.getElementById('btn-rtc-recenter-signer'),
  rtcStatusIndicator: document.getElementById('rtc-status-indicator'),
  rtcStatusDot: document.getElementById('rtc-status-dot'),
  rtcSourceBadge: document.getElementById('rtc-source-badge'),
  rtcSourceLabel: document.getElementById('rtc-source-label'),
  rtcAudioStatusBadge: document.getElementById('rtc-audio-status-badge'),
  rtcAudioStatusText: document.getElementById('rtc-audio-status-text'),
  rtcActiveScreenContainer: document.getElementById('rtc-active-screen-container'),

  // Two-Way Communication Hub Sub-mode & Views
  btnRtcSubmodeScreen: document.getElementById('btn-rtc-submode-screen'),
  btnRtcSubmodeTwoway: document.getElementById('btn-rtc-submode-twoway'),
  btnQuickTwoway: document.getElementById('btn-quick-twoway'),
  rtcScreenMainView: document.getElementById('rtc-screen-main-view'),
  rtcTwowayMainView: document.getElementById('rtc-twoway-main-view'),

  // Two-Way Deaf Studio (Webcam & Pure ISL Gesture Recognition)
  rtcTwowayVideo: document.getElementById('rtc-twoway-video'),
  rtcTwowayCanvas: document.getElementById('rtc-twoway-canvas'),
  rtcTwowayCamPlaceholder: document.getElementById('rtc-twoway-camera-placeholder'),
  btnRtcTwowayStartCam: document.getElementById('btn-rtc-twoway-start-cam'),
  btnRtcTwowayToggleCam: document.getElementById('btn-rtc-twoway-toggle-cam'),
  btnRtcTwowayCommitSign: document.getElementById('btn-rtc-twoway-commit-sign'),
  btnRtcTwowayClearSeq: document.getElementById('btn-rtc-twoway-clear-seq'),
  btnRtcTwowaySendSpeech: document.getElementById('btn-rtc-twoway-send-speech'),
  rtcDeafCamStatusBadge: document.getElementById('rtc-deaf-cam-status-badge'),
  rtcTwowayPredLabel: document.getElementById('rtc-twoway-pred-label'),
  rtcTwowayConfText: document.getElementById('rtc-twoway-conf-text'),
  rtcTwowayConfBar: document.getElementById('rtc-twoway-conf-bar'),
  rtcTwowayStatusMsg: document.getElementById('rtc-twoway-status-msg'),
  rtcTwowaySeqCount: document.getElementById('rtc-twoway-seq-count'),
  rtcTwowaySeqChips: document.getElementById('rtc-twoway-seq-chips'),

  // Two-Way Hearing Studio (Speech Input & 3D ISL Avatar Stage)
  rtcTwowayAvatarMount: document.getElementById('rtc-twoway-avatar-mount'),
  rtcTwowayAvatarStage: document.getElementById('rtc-twoway-avatar-stage'),
  btnRtcTwowayRecenter: document.getElementById('btn-rtc-twoway-recenter'),
  btnRtcTwowayMic: document.getElementById('btn-rtc-twoway-mic'),
  rtcTwowayMicLabel: document.getElementById('rtc-twoway-mic-label'),
  rtcTwowaySpeechText: document.getElementById('rtc-twoway-speech-text'),
  rtcTwowayLangPill: document.getElementById('rtc-twoway-lang-pill'),
  rtcTwowayGlossText: document.getElementById('rtc-twoway-gloss-text'),
  rtcHearingStatusBadge: document.getElementById('rtc-hearing-status-badge'),

  // Two-Way Bidirectional Conversation Transcript
  rtcTwowayChatTimeline: document.getElementById('rtc-twoway-chat-timeline'),
  rtcChatEmptyMsg: document.getElementById('rtc-chat-empty-msg'),
  btnRtcTwowayClearChat: document.getElementById('btn-rtc-twoway-clear-chat'),

  // Audio & Capture Header Actions
  btnStartCapture: document.getElementById('btn-start-capture'),
  btnToggleMic: document.getElementById('btn-toggle-mic'),
  videoElem: document.getElementById('screen-video-elem'),
  screenPlaceholder: document.getElementById('screen-empty-placeholder'),
  btnDemoVideo: document.getElementById('btn-demo-video'),
  btnQuickMic: document.getElementById('btn-quick-mic'),
  vuMeter: document.getElementById('audio-vu-meter'),
  vuBars: document.querySelectorAll('.vu-bar'),

  // Subtitles HUD
  captionStatus: document.getElementById('caption-status'),
  captionSpeech: document.getElementById('caption-speech-text'),
  captionGloss: document.getElementById('caption-gloss-text'),
  captionConfidence: document.getElementById('caption-match-confidence'),
  captionLangBadge: document.getElementById('caption-lang-badge'),
  btnRtcReplay: document.getElementById('btn-rtc-replay'),

  // Test phrase strip
  testChips: document.querySelectorAll('.test-phrase-chip'),
  manualInput: document.getElementById('manual-text-input'),
  btnManualSign: document.getElementById('btn-manual-sign'),

  // Corner widget
  cornerWidget: document.getElementById('floating-avatar-widget'),
  widgetDrag: {
    isDragging: false,
    startX: 0,
    startY: 0,
    origLeft: 0,
    origTop: 0,
  },
  btnWidgetMinimize: document.getElementById('btn-widget-minimize'),
  btnTogglePos: document.getElementById('btn-toggle-pos'),
  btnSizeToggle: document.getElementById('btn-size-toggle'),
  btnTogglePip: document.getElementById('btn-toggle-pip'),
  btnWidgetPin: document.getElementById('btn-widget-pin'),
  widgetSignTag: document.getElementById('widget-sign-tag'),
  widgetPhraseText: document.getElementById('widget-phrase-text'),
  btnWidgetReplay: document.getElementById('btn-widget-replay'),
  btnWidgetPause: document.getElementById('btn-widget-pause'),
  btnWidgetClose: document.getElementById('btn-widget-close'),
  widgetMiniChips: document.querySelectorAll('.mini-chip'),
  spellingHud: document.getElementById('spelling-hud'),
  spellingChar: document.getElementById('spelling-char'),
  spellingWord: document.getElementById('spelling-word'),

  // Studio Elements
  sentenceList: document.getElementById('sentence-list'),
  sentenceSearch: document.getElementById('sentence-search'),
  sampleBadge: document.getElementById('sample-count-badge'),
  hudSentence: document.getElementById('hud-sentence-text'),
  hudGloss: document.getElementById('hud-gloss-text'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  playIcon: document.getElementById('play-icon'),
  pauseIcon: document.getElementById('pause-icon'),
  btnReset: document.getElementById('btn-reset'),
  timelineSlider: document.getElementById('timeline-slider'),
  currentTimeDisp: document.getElementById('current-time-display'),
  totalTimeDisp: document.getElementById('total-time-display'),
  btnExport: document.getElementById('btn-export-glb'),
  toast: document.getElementById('toast'),

  // YouTube Section
  ytPlayerContainer: document.getElementById('yt-player-container'),
  ytPlayerPlaceholder: document.getElementById('yt-player'),
  ytUrlInput: document.getElementById('yt-url-input'),
  btnLoadYt: document.getElementById('btn-load-yt'),
  ytChips: document.querySelectorAll('.yt-chip'),
  ytActiveBar: document.getElementById('yt-active-bar'),
  ytActiveTitle: document.getElementById('yt-active-title'),
  btnCloseYt: document.getElementById('btn-close-yt'),
  btnOpenYtModal: document.getElementById('btn-open-yt-modal'),
  btnQuickYt: document.getElementById('btn-quick-yt'),
  ytModal: document.getElementById('yt-modal'),
  btnCloseYtModal: document.getElementById('btn-close-yt-modal')
};

// --- INITIALIZE THREE.JS SCENE ---
function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);
  scene.fog = new THREE.FogExp2(0x0a0c10, 0.08);

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(0, 1.2, 1.8); // Pulled back to frame upper body + signing hands

  // Safe WebGL context creation with fallback
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false
    });
  } catch (e) {
    console.warn('[SignBridge] Falling back to non-antialiased WebGLRenderer:', e);
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  // Mount to appropriate container based on current mode
  if (currentMode === 'curriculum' && (curriculumContainer || document.getElementById('edu-curriculum-canvas'))) {
    const target = curriculumContainer || document.getElementById('edu-curriculum-canvas');
    target.innerHTML = '';
    target.appendChild(renderer.domElement);
    hideCornerWidget();
  } else if (DOM.cornerContainer) {
    DOM.cornerContainer.appendChild(renderer.domElement);
  }
  updateRendererSize();
  
  // Initialize draggable floating signer platform abstraction
  initFloatingSigner();
  window.showCornerWidget = showCornerWidget;
  window.hideCornerWidget = hideCornerWidget;

  // Orbit Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.1, 0);
  controls.maxPolarAngle = Math.PI / 2 + 0.05;
  controls.minDistance = 0.4;
  controls.maxDistance = 4.0;

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.0);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(2.5, 4.0, 3.0);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.4);
  rimLight.position.set(-3.0, 3.0, -3.0);
  scene.add(rimLight);

  // Circular floor
  const floorGeo = new THREE.CircleGeometry(3.5, 64);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.6, metalness: 0.2 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(7, 28, 0x3b82f6, 0x1e293b);
  grid.position.y = 0.001;
  scene.add(grid);

  // ResizeObserver on both containers with requestAnimationFrame batching
  let resizeRafId = null;
  const resizeObserver = new ResizeObserver(() => {
    if (!resizeRafId) {
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        updateRendererSize();
      });
    }
  });
  if (DOM.cornerContainer) resizeObserver.observe(DOM.cornerContainer);
  if (DOM.studioContainer) resizeObserver.observe(DOM.studioContainer);

  window.addEventListener('resize', onWindowResize);
}

function updateRendererSize() {
  if (!renderer || !camera) return;
  let targetContainer;
  if (currentMode === 'screen' || currentMode === 'view-realtime-comm') {
    if (currentRtcSubmode === 'twoway' && (DOM.rtcTwowayAvatarMount || document.getElementById('rtc-twoway-avatar-mount'))) {
      targetContainer = DOM.rtcTwowayAvatarMount || document.getElementById('rtc-twoway-avatar-mount');
    } else {
      targetContainer = DOM.cornerContainer;
    }
  } else if (currentMode === 'studio' || currentMode === 'view-isl-repository') {
    targetContainer = DOM.studioContainer;
  } else if (currentMode === 'curriculum') {
    targetContainer = curriculumContainer || DOM.studioContainer;
  } else {
    targetContainer = document.getElementById('edu-signlearn-canvas') || DOM.studioContainer;
  }
  if (!targetContainer) return;

  let w = targetContainer.clientWidth || targetContainer.offsetWidth;
  let h = targetContainer.clientHeight || targetContainer.offsetHeight;

  if (!w || w < 20) w = 380;
  if (!h || h < 20) h = 400;

  camera.aspect = w / h;

  // Keep avatar centered, properly proportioned, and upper-body / signing space never cropped
  if (currentMode === 'screen' || currentMode === 'view-realtime-comm') {
    if (currentRtcSubmode === 'twoway') {
      camera.position.set(0, 1.25, 1.8);
      if (controls) {
        controls.target.set(0, 1.1, 0);
        controls.update();
      }
    } else {
      if (camera.aspect < 0.85) {
        const dist = 1.8 + (0.85 - camera.aspect) * 0.85;
        camera.position.set(0, 1.2, dist);
      } else {
        camera.position.set(0, 1.2, 1.8);
      }
      if (controls) {
        controls.target.set(0, 1.1, 0);
        controls.update();
      }
    }
  }

  camera.updateProjectionMatrix();
  renderer.setSize(w, h, true);
  if (scene && renderer) {
    renderer.render(scene, camera);
  }
}

function onWindowResize() {
  updateRendererSize();
}

// --- FLOATING SIGNER MANAGER (PLATFORM ABSTRACTION) ---
function initFloatingSigner() {
  if (DOM.cornerWidget) {
    floatingSignerManager = new FloatingSignerManager({
      widgetElement: DOM.cornerWidget,
      canvasContainer: DOM.cornerContainer,
      onResize: () => updateRendererSize(),
      onSpeedChange: (speed) => {
        setGlobalPlaybackSpeed(speed);
        if (window.electronAPI && typeof window.electronAPI.syncControl === 'function') {
          window.electronAPI.syncControl({ action: 'speed', speed });
        }
      },
      onReplay: () => {
        replayCurrentSign();
        if (window.electronAPI && typeof window.electronAPI.syncControl === 'function') {
          window.electronAPI.syncControl({ action: 'replay' });
        }
      },
      onPauseToggle: () => {
        toggleTranslationPause();
        if (window.electronAPI && typeof window.electronAPI.syncControl === 'function') {
          window.electronAPI.syncControl({ action: 'pause' });
        }
      }
    });
    window.floatingSignerManager = floatingSignerManager;
  }
}

function hideCornerWidget() {
  // Never hide corner widget if running as a dedicated native PIP window
  if (typeof window !== 'undefined' && window.location.search.includes('pip=native')) {
    return;
  }
  if (floatingSignerManager) {
    floatingSignerManager.hide();
  } else if (DOM.cornerWidget) {
    DOM.cornerWidget.style.display = 'none';
  }
}

function showCornerWidget() {
  // Mini 3D Signer exists in SCREEN OVERLAY / REAL-TIME COMMUNICATION MODE
  if (currentMode !== 'screen' && currentMode !== 'view-realtime-comm') {
    hideCornerWidget();
    return;
  }
  if (floatingSignerManager) {
    if (!floatingSignerManager.isClosed) {
      floatingSignerManager.show();
    }
  } else if (DOM.cornerWidget) {
    DOM.cornerWidget.style.display = 'flex';
  }
}

// --- CURRICULUM INTEGRATED SIGNER BRIDGE ---
let curriculumContainer = null;
let curriculumResizeObserver = null;

function mountCurriculumSigner(container) {
  if (!container) {
    container = document.getElementById('edu-curriculum-canvas');
  }
  if (!container) return;
  curriculumContainer = container;
  currentMode = 'curriculum';

  // Ensure floating corner widget stays completely hidden
  hideCornerWidget();

  if (!renderer || !renderer.domElement) {
    // Renderer not yet initialized; start() will mount it once initScene completes
    return;
  }

  // Mount canvas into dedicated curriculum container
  if (renderer.domElement.parentElement !== container) {
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
  }

  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  // Ensure character model is added to the scene
  if (characterModel && !scene.children.includes(characterModel)) {
    scene.add(characterModel);
  }

  // Reframe camera & controls to properly view signing space
  if (camera) {
    camera.position.set(0, 1.25, 1.85);
  }
  if (controls) {
    controls.target.set(0, 1.1, 0);
    controls.update();
  }

  if (!curriculumResizeObserver) {
    curriculumResizeObserver = new ResizeObserver(() => {
      if (currentMode === 'curriculum') {
        updateRendererSize();
      }
    });
  }
  curriculumResizeObserver.disconnect();
  curriculumResizeObserver.observe(container);

  updateRendererSize();
  requestAnimationFrame(updateRendererSize);
  setTimeout(updateRendererSize, 50);
  setTimeout(updateRendererSize, 200);

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function unmountCurriculumSigner() {
  if (currentMode === 'curriculum') {
    if (curriculumResizeObserver) {
      curriculumResizeObserver.disconnect();
    }
    curriculumContainer = null;
    // Retain curriculum context; do not prematurely force mode to 'screen'
    if (DOM.cornerContainer && renderer && renderer.domElement) {
      DOM.cornerContainer.appendChild(renderer.domElement);
    }
    hideCornerWidget();
    updateRendererSize();
  }
}

function signCurriculumText(text, contextKeywords = []) {
  if (!text) return;

  if (!signMatcher || !signMatcher.isLoaded) {
    if (signMatcher) {
      signMatcher.init().then(() => {
        signSyncController.signMatcher = signMatcher;
        signSyncController.requestConceptSign(text, contextKeywords, true);
      });
    }
    return;
  }

  signSyncController.requestConceptSign(text, contextKeywords, true);
}

function stopCurriculumSigner() {
  signSyncController.stopActiveAnimation();
}

// --- TWO-WAY COMMUNICATION HUB INTEGRATED SIGNER BRIDGE ---
function mountTwoWaySigner() {
  const mount = DOM.rtcTwowayAvatarMount || document.getElementById('rtc-twoway-avatar-mount');
  if (!mount) return;

  // Ensure floating corner widget stays completely hidden
  hideCornerWidget();

  if (!renderer || !renderer.domElement) return;

  if (renderer.domElement.parentElement !== mount) {
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);
  }

  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  if (characterModel && !scene.children.includes(characterModel)) {
    scene.add(characterModel);
  }

  if (camera) {
    camera.position.set(0, 1.25, 1.8);
  }
  if (controls) {
    controls.target.set(0, 1.1, 0);
    controls.update();
  }

  if (!twoWayResizeObserver) {
    twoWayResizeObserver = new ResizeObserver(() => {
      if (currentRtcSubmode === 'twoway' && (currentMode === 'screen' || currentMode === 'view-realtime-comm')) {
        updateRendererSize();
      }
    });
  }
  twoWayResizeObserver.disconnect();
  twoWayResizeObserver.observe(mount);

  updateRendererSize();
  requestAnimationFrame(updateRendererSize);
  setTimeout(updateRendererSize, 50);
  setTimeout(updateRendererSize, 200);

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function unmountTwoWaySigner() {
  if (twoWayResizeObserver) {
    twoWayResizeObserver.disconnect();
  }
  if (DOM.cornerContainer && renderer && renderer.domElement) {
    if (renderer.domElement.parentElement !== DOM.cornerContainer) {
      DOM.cornerContainer.appendChild(renderer.domElement);
    }
  }
  if (currentMode === 'screen' || currentMode === 'view-realtime-comm') {
    showCornerWidget();
  }
  updateRendererSize();
}

function switchRtcSubmode(submode) {
  currentRtcSubmode = submode;

  if (submode === 'twoway') {
    DOM.btnRtcSubmodeTwoway?.classList.add('active');
    DOM.btnRtcSubmodeScreen?.classList.remove('active');
    DOM.rtcScreenMainView?.classList.add('hidden');
    DOM.rtcTwowayMainView?.classList.remove('hidden');

    mountTwoWaySigner();
    showToast('Switched to Two-Way Sign ↔ Speech Hub');
  } else {
    DOM.btnRtcSubmodeScreen?.classList.add('active');
    DOM.btnRtcSubmodeTwoway?.classList.remove('active');
    DOM.rtcScreenMainView?.classList.remove('hidden');
    DOM.rtcTwowayMainView?.classList.add('hidden');

    if (islRecognitionService.isRunning) {
      stopRtcTwoWayCam();
    }

    unmountTwoWaySigner();
    showToast('Switched to Screen Translation');
  }
}

window.mountCurriculumSigner = mountCurriculumSigner;
window.unmountCurriculumSigner = unmountCurriculumSigner;
window.signCurriculumText = signCurriculumText;
window.stopCurriculumSigner = stopCurriculumSigner;
window.mountTwoWaySigner = mountTwoWaySigner;
window.unmountTwoWaySigner = unmountTwoWaySigner;
window.switchRtcSubmode = switchRtcSubmode;
window.setMode = setMode;
window.showCornerWidget = showCornerWidget;
window.hideCornerWidget = hideCornerWidget;


// --- SWITCH MODES (SCREEN OVERLAY vs STUDIO vs EDU TABS) ---
function setMode(mode) {
  currentMode = mode;
  if (!renderer || !renderer.domElement) return;

  const persistentContainer = document.getElementById('canvas-container');
  const persistentCanvas = document.getElementById('edu-signlearn-canvas');

  if (mode === 'home' || mode === 'view-landing') {
    hideCornerWidget();
    if (persistentContainer) persistentContainer.classList.add('hidden-canvas');
    if (islRecognitionService.isRunning && currentRtcSubmode === 'twoway') {
      stopRtcTwoWayCam();
    }
  } else if (mode === 'screen' || mode === 'view-realtime-comm') {
    if (persistentContainer) {
      persistentContainer.classList.add('hidden-canvas');
      persistentContainer.setAttribute('data-active-view', 'view-realtime-comm');
    }

    if (currentRtcSubmode === 'twoway') {
      mountTwoWaySigner();
    } else {
      // Move renderer to corner container
      if (DOM.cornerContainer && renderer.domElement.parentElement !== DOM.cornerContainer) {
        DOM.cornerContainer.appendChild(renderer.domElement);
      }
      renderer.domElement.style.display = 'block';

      if (camera) camera.position.set(0, 1.2, 1.8);
      if (controls) {
        controls.target.set(0, 1.1, 0);
        controls.update();
      }

      // Mini 3D Signer is shown ONLY in Real-Time Communication
      showCornerWidget();
    }
  } else if (mode === 'studio' || mode === 'view-isl-repository') {
    hideCornerWidget();
    if (persistentContainer) persistentContainer.classList.add('hidden-canvas');
    if (islRecognitionService.isRunning && currentRtcSubmode === 'twoway') {
      stopRtcTwoWayCam();
    }

    // Move renderer to studio container
    if (DOM.studioContainer && renderer.domElement.parentElement !== DOM.studioContainer) {
      DOM.studioContainer.appendChild(renderer.domElement);
    }
    renderer.domElement.style.display = 'block';

    if (camera) camera.position.set(0, 1.2, 2.0);
    if (controls) {
      controls.target.set(0, 1.05, 0);
      controls.update();
    }
  } else {
    // Secondary tabs: Personalized Learning, Academic Assistance, ISL Skill Development
    hideCornerWidget();
    if (persistentContainer) persistentContainer.classList.remove('hidden-canvas');
    if (islRecognitionService.isRunning && currentRtcSubmode === 'twoway') {
      stopRtcTwoWayCam();
    }

    // Move renderer to persistent canvas container
    if (persistentCanvas && renderer.domElement.parentElement !== persistentCanvas) {
      persistentCanvas.innerHTML = '';
      persistentCanvas.appendChild(renderer.domElement);
    }
    renderer.domElement.style.display = 'block';

    if (camera) camera.position.set(0, 1.25, 1.85);
    if (controls) {
      controls.target.set(0, 1.1, 0);
      controls.update();
    }
  }

  requestAnimationFrame(updateRendererSize);
  setTimeout(updateRendererSize, 50);
  setTimeout(updateRendererSize, 200);
}

// --- LOAD CLEAN CHARACTER ---
async function loadCharacter() {
  const loader = new GLTFLoader();
  try {
    showToast('Loading 3D avatar...');
    let gltf;
    try {
      gltf = await loader.loadAsync('/character_clean.glb');
    } catch {
      gltf = await loader.loadAsync('/archive-data/character_clean.glb');
    }
    characterModel = gltf.scene;

    characterModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.roughness = 0.45;
          child.material.metalness = 0.15;
        }
      }
    });

    scene.add(characterModel);

    // Initialize Retargeter once with pristine rest pose
    retargeter = new Retargeter(characterModel, BONE_MAP);

    // Initialize Fingerspelling Alphabet Engine for manual spelling
    fingerspeller = new Fingerspeller(characterModel);

    // Register 3D engine with centralized signSyncController
    signSyncController.registerEngine({
      bvhMixer,
      retargeter,
      fingerspeller,
      signMatcher,
      playBvhFn: playBvhAnimation,
      resetAvatarFn: resetAvatarClean
    });

    retargeter.onPlayBVH = (bvhData, reqId) => playBvhAnimation({ bvh: bvhData, clip: bvhData.clip, skeleton: bvhData.skeleton }, reqId);

    showToast('3D Avatar ready! 67 bones rigged.');
    return true;
  } catch (err) {
    console.error('Character load error:', err);
    showToast('Failed to load character_clean.glb');
    return false;
  }
}

// --- CLEAN AVATAR REST POSE & PREEMPTION HELPERS ---
function resetAvatarClean() {
  if (bvhMixer) {
    bvhMixer.stopAllAction();
  }
  if (retargeter) {
    retargeter.resetCharacterPose();
    retargeter.enabled = true;
  }
  if (fingerspeller && typeof fingerspeller.resetToRestPose === 'function') {
    fingerspeller.resetToRestPose();
  }
  if (bvhSkeleton && bvhSkeleton.bones[0] && bvhSkeleton.bones[0].parent) {
    scene.remove(bvhSkeleton.bones[0]);
  }
  if (DOM.spellingHud) {
    DOM.spellingHud.classList.add('hidden');
  }
  if (characterModel) {
    characterModel.updateWorldMatrix(true, true);
  }
}

function stopAllAnimation() {
  signSyncController.stopActiveAnimation();
}

function setGlobalPlaybackSpeed(speed) {
  signSyncController.setPlaybackRate(speed);
}

window.setGlobalPlaybackSpeed = setGlobalPlaybackSpeed;
window.getGlobalPlaybackSpeed = () => signSyncController.getPlaybackRate();
window.resetAvatarClean = resetAvatarClean;
window.stopAllAnimation = stopAllAnimation;

// Centralized Sign HUD & Subtitle update subscriber
window.addEventListener('signbridge-sign-update', (e) => {
  const item = e.detail;
  if (!item) return;

  if (item.type === 'phrase' || item.type === 'word') {
    if (DOM.spellingHud) DOM.spellingHud.classList.add('hidden');
    if (DOM.captionSpeech) DOM.captionSpeech.textContent = `"${item.label}"`;
    if (DOM.captionGloss) DOM.captionGloss.textContent = item.gloss;
    if (DOM.captionStatus) DOM.captionStatus.textContent = item.status || (item.type === 'word' ? 'WORD SIGN' : 'SIGNING');
    if (DOM.widgetSignTag) DOM.widgetSignTag.textContent = item.gloss;
    if (DOM.hudSentence) DOM.hudSentence.textContent = item.label;
    if (DOM.hudGloss) DOM.hudGloss.textContent = item.gloss;
  } else if (item.type === 'letter') {
    if (DOM.spellingHud) {
      DOM.spellingHud.classList.remove('hidden');
      if (DOM.spellingChar) DOM.spellingChar.textContent = item.letter;
      if (DOM.spellingWord) DOM.spellingWord.textContent = item.label || '';
    }
    if (DOM.captionSpeech) DOM.captionSpeech.textContent = `Spelling: "${item.label}" [${item.letter}]`;
    if (DOM.captionGloss) DOM.captionGloss.textContent = item.gloss;
    if (DOM.captionStatus) DOM.captionStatus.textContent = 'FINGERSPELLING';
    if (DOM.widgetSignTag) DOM.widgetSignTag.textContent = item.gloss;
    if (DOM.hudSentence) DOM.hudSentence.textContent = `Spelling: ${item.label}`;
    if (DOM.hudGloss) DOM.hudGloss.textContent = item.gloss;
  } else if (item.type === 'pause') {
    if (DOM.captionStatus) DOM.captionStatus.textContent = 'PAUSED';
    if (DOM.widgetSignTag) DOM.widgetSignTag.textContent = 'Paused';
  } else if (item.type === 'buffer') {
    if (DOM.captionStatus) DOM.captionStatus.textContent = 'BUFFERING...';
    if (DOM.widgetSignTag) DOM.widgetSignTag.textContent = 'Buffering...';
  } else if (item.type === 'idle') {
    if (DOM.spellingHud) DOM.spellingHud.classList.add('hidden');
    if (DOM.captionStatus) DOM.captionStatus.textContent = 'READY';
    if (DOM.widgetSignTag) DOM.widgetSignTag.textContent = 'Ready';
  }
});

// --- BVH CACHED ASSET LOADER ---
async function loadBvhAsset(bvhRelPath) {
  if (bvhCache.has(bvhRelPath)) {
    return bvhCache.get(bvhRelPath);
  }
  let result;
  try {
    result = await bvhLoader.loadAsync(`/${bvhRelPath}`);
  } catch {
    result = await bvhLoader.loadAsync(`/archive-data/${bvhRelPath}`);
  }
  bvhCache.set(bvhRelPath, result);
  return result;
}

// --- PLAY SINGLE BVH ANIMATION (PROMISE BASED WITH GENERATION CHECK) ---
function playBvhAnimation(sample, sequenceId) {
  return new Promise(async (resolve) => {
    if (!sample) return resolve();
    if (sequenceId !== undefined && sequenceId !== signSyncController.requestId) return resolve();
    currentSignSample = sample;

    try {
      const result = await loadBvhAsset(sample.bvh);

      // Check if preempted while BVH was loading
      if (sequenceId !== undefined && sequenceId !== signSyncController.requestId) {
        return resolve();
      }

      if (bvhSkeleton && bvhSkeleton.bones[0] && bvhSkeleton.bones[0].parent) {
        scene.remove(bvhSkeleton.bones[0]);
      }
      if (bvhMixer) {
        bvhMixer.stopAllAction();
      }

      bvhSkeleton = result.skeleton;
      const clip = result.clip;

      const bvhRoot = bvhSkeleton.bones[0];
      bvhRoot.visible = false;
      scene.add(bvhRoot);

      if (retargeter) {
        retargeter.enabled = true;
        retargeter.setBvhSkeleton(bvhSkeleton);
      }

      bvhMixer = new THREE.AnimationMixer(bvhRoot);
      signSyncController.bvhMixer = bvhMixer;

      currentAction = bvhMixer.clipAction(clip);
      signSyncController.currentAction = currentAction;

      const rate = signSyncController.getPlaybackRate();
      currentAction.setEffectiveTimeScale(rate);
      currentAction.setLoop(THREE.LoopOnce, 1);
      currentAction.clampWhenFinished = true;
      currentAction.play();

      if (DOM.timelineSlider) {
        DOM.timelineSlider.max = clip.duration;
        DOM.timelineSlider.value = 0;
      }
      if (DOM.totalTimeDisp) {
        DOM.totalTimeDisp.textContent = formatTime(clip.duration);
      }

      let isResolved = false;
      let safetyTimer = null;

      const finish = () => {
        if (!isResolved) {
          isResolved = true;
          currentBvhFinishResolver = null;
          if (safetyTimer) clearTimeout(safetyTimer);
          bvhMixer?.removeEventListener('finished', finish);
          resolve();
        }
      };

      currentBvhFinishResolver = finish;
      bvhMixer.addEventListener('finished', finish);

      // Check completion dynamically respecting real-time playbackSpeed
      const checkCompletion = () => {
        if (sequenceId !== undefined && sequenceId !== signSyncController.requestId) {
          finish();
          return;
        }
        if (currentAction && (currentAction.time >= clip.duration - 0.05 || !currentAction.isRunning())) {
          finish();
        } else {
          const currentRate = signSyncController.getPlaybackRate();
          const remainingSec = Math.max(0.04, (clip.duration - (currentAction ? currentAction.time : 0)) / currentRate);
          safetyTimer = setTimeout(checkCompletion, Math.max(40, remainingSec * 1000 + 40));
        }
      };

      const initialRate = signSyncController.getPlaybackRate();
      const initialWaitMs = Math.max(50, ((clip.duration * 1000) / initialRate) + 80);
      safetyTimer = setTimeout(checkCompletion, initialWaitMs);

    } catch (err) {
      console.error('BVH load error:', err);
      resolve();
    }
  });
}

// --- CONTINUOUS WORD-BY-WORD & FINGERSPELLING SEQUENCE PLAYER (WITH PREEMPTION) ---
function playSequence(sequence, phraseLabel = '') {
  if (!sequence || sequence.length === 0) return;
  signSyncController.requestSign(sequence, { isManual: true });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
}

// --- REAL-TIME COMMUNICATION STATUS & TRANSLATION PIPELINE ---
function updateRtcStatus(status, errorMsg = '') {
  const normStatus = (status || 'READY').toUpperCase();
  if (DOM.captionStatus) DOM.captionStatus.textContent = normStatus;

  if (DOM.rtcStatusDot) {
    DOM.rtcStatusDot.className = 'rtc-status-dot';
    if (normStatus === 'LISTENING') DOM.rtcStatusDot.classList.add('listening');
    else if (normStatus === 'TRANSLATING' || normStatus === 'SIGNING' || normStatus === 'FINGERSPELLING') DOM.rtcStatusDot.classList.add('translating');
    else if (normStatus === 'ERROR') DOM.rtcStatusDot.classList.add('error');
    else if (normStatus === 'PAUSED') DOM.rtcStatusDot.classList.add('paused');
  }

  if (floatingSignerManager) {
    floatingSignerManager.updateSignStatus(undefined, undefined, normStatus);
  }

  if (normStatus === 'ERROR' && errorMsg) {
    showToast(errorMsg);
  }
}

let lastSpokenPayload = null;
let lastActiveSequence = null;

async function processRecognizedSpeech(inputData, durationSec = null, source = 'speech') {
  let rawText = '';
  let internalEnglish = '';
  let detectedLang = null;

  if (typeof inputData === 'string') {
    rawText = inputData.trim();
  } else if (inputData && typeof inputData === 'object') {
    rawText = (inputData.spokenText || inputData.text || inputData.final || '').trim();
    internalEnglish = (inputData.englishText || '').trim();
    detectedLang = inputData.detectedLanguage || null;
  }

  if (!rawText && !internalEnglish) return;
  if (isTranslationPaused) return;

  const now = Date.now();
  // Phrase stabilization & deduplication: prevent identical rapid partials within 1.5 seconds
  if (rawText.toLowerCase() === lastProcessedPhrase.toLowerCase() && (now - lastProcessedTime < 1500)) {
    return;
  }
  lastProcessedPhrase = rawText;
  lastProcessedTime = now;

  updateRtcStatus('TRANSLATING');

  // Semantic Meaning Normalization (Rules 3, 4, 5, 8, 9, 17)
  // Maps multilingual intent variants (Tamil, Hindi, Telugu, etc.) to canonical ISL concepts
  // Strictly quarantines intermediate English away from user-facing UI
  let normResult;
  try {
    normResult = meaningNormalizer.normalizeMeaning({
      spokenText: rawText,
      internalEnglish: internalEnglish,
      detectedLang: detectedLang
    });
  } catch (e) {
    console.warn('[MeaningNormalizer] normalization error:', e);
    normResult = {
      success: false,
      errorType: 'UNCLEAR_AUDIO',
      userMessage: "⚠️ I couldn't clearly understand that. Please repeat."
    };
  }

  // Rule 8: If speech is unclear or unrecognized, ask user to repeat without pretending or guessing
  if (!normResult || !normResult.success) {
    const userMsg = normResult?.userMessage || "⚠️ I couldn't clearly understand that. Please repeat.";
    if (DOM.captionSpeech) DOM.captionSpeech.textContent = userMsg;
    if (DOM.widgetPhraseText) DOM.widgetPhraseText.textContent = userMsg;
    if (DOM.captionGloss) DOM.captionGloss.textContent = 'UNCLEAR';
    if (DOM.captionConfidence) DOM.captionConfidence.textContent = 'Please Repeat';
    updateRtcStatus('READY', userMsg);
    showToast(userMsg);
    return;
  }

  const nativeDisplayWords = normResult.nativeText || rawText;
  const langName = normResult.languageName || 'Indian Language';
  const langFlag = normResult.languageFlag || '🇮🇳';

  // Rule 3: Display user's actual spoken words in their native script (NEVER intermediate English)
  if (DOM.captionSpeech) {
    DOM.captionSpeech.textContent = `"${nativeDisplayWords}"`;
  }
  if (DOM.widgetPhraseText) {
    DOM.widgetPhraseText.textContent = `"${nativeDisplayWords}"`;
  }

  // Display Language Detection Badge: e.g. "🇮🇳 Tamil detected"
  if (DOM.captionLangBadge) {
    DOM.captionLangBadge.textContent = `${langFlag} ${langName} detected`;
    DOM.captionLangBadge.classList.remove('hidden');
  }

  // Rule 5 & Rule 17: If speech is understood but verified ISL sign is unavailable, communicate limitation honestly
  if (!normResult.isFullyAvailable && (!normResult.sequence || normResult.sequence.length === 0)) {
    const limitMsg = normResult.limitationMessage || 'We understood your request, but an ISL representation for part of this phrase is currently unavailable.';
    if (DOM.captionGloss) DOM.captionGloss.textContent = 'UNAVAILABLE';
    if (DOM.captionConfidence) DOM.captionConfidence.textContent = 'Sign Unavailable';
    if (floatingSignerManager) {
      floatingSignerManager.updateSignStatus(nativeDisplayWords, 'UNAVAILABLE', 'LIMITATION', langName, langFlag);
    }
    updateRtcStatus('READY', limitMsg);
    showToast(limitMsg);
    return;
  }

  // If partially supported, honestly inform user
  if (normResult.limitationMessage) {
    showToast(normResult.limitationMessage);
  }

  const sequence = normResult.sequence;
  if (!sequence || sequence.length === 0) {
    updateRtcStatus('READY');
    return;
  }

  lastSpokenPayload = normResult;
  lastActiveSequence = sequence;

  const firstSign = sequence[0];
  const matchType = firstSign.type === 'BVH' ? (firstSign.matchType || 'exact') : 'word';
  const matchedGloss = normResult.primaryGloss || firstSign.gloss || 'ISL SIGN';

  // Internal development logging (Rule 3: debug only)
  console.log(`[MULTILINGUAL PIPELINE] [${langName.toUpperCase()}] "${nativeDisplayWords}" → MEANING: "${normResult.canonicalMeaning}" → ISL GLOSS: "${matchedGloss}" → SEQUENCE (${sequence.length} signs)`);

  // Update HUD Subtitles
  if (DOM.captionGloss) {
    DOM.captionGloss.textContent = matchedGloss;
  }
  if (DOM.captionConfidence) {
    DOM.captionConfidence.textContent = normResult.canonicalMeaning || (matchType === 'exact' ? 'Exact Match' : 'Intent Match');
  }

  updateRtcStatus('SIGNING');
  if (floatingSignerManager) {
    floatingSignerManager.updateSignStatus(nativeDisplayWords, matchedGloss, 'SIGNING', langName, langFlag);
  }

  // Rule 6: Immediate preemption — new confirmed speech interrupts previous signing immediately
  signSyncController.requestSign(sequence, { isManual: true });

  // Forward sign event to native floating avatar window via Electron IPC
  if (source !== 'electron_sync' && window.electronAPI && typeof window.electronAPI.syncSign === 'function') {
    window.electronAPI.syncSign({
      text: nativeDisplayWords,
      gloss: matchedGloss,
      matchType,
      sequence
    });
  }
}

// Handler for speech audio chunk from VADProcessor
async function onVadSpeechChunk({ audioBlob, durationSec }) {
  if (!audioBlob || isTranslationPaused) return;

  updateRtcStatus('TRANSLATING');

  try {
    const reqId = ++signSyncController.requestId;

    // Send speech segment to local offline ASR pipeline (Whisper / IndicTrans2)
    const result = await signSyncController.translationService.processMultilingualInput({
      text: null,
      audioBlob: audioBlob,
      requestId: reqId
    });

    if (reqId !== signSyncController.requestId || result.aborted) {
      return;
    }

    const nativeSpoken = (result.transcription || '').trim();
    const internalEnglish = (result.englishText || nativeSpoken).trim();
    const detectedLang = result.detectedLanguage || 'auto';

    if (!nativeSpoken && !internalEnglish) {
      if (screenCaptureService?.isCapturing) updateRtcStatus('LISTENING');
      return;
    }

    processRecognizedSpeech({
      spokenText: nativeSpoken,
      englishText: internalEnglish,
      detectedLanguage: detectedLang
    }, durationSec, 'vad_audio');
  } catch (err) {
    console.warn('[VAD ASR Pipeline] Transcription error:', err.message);
    if (screenCaptureService?.isCapturing) updateRtcStatus('LISTENING');
  }
}

// Fallback SpeechRecognizer handler (Web Speech API / browser offline stream)
let speechStabilizeTimer = null;

function onSpeechResult(data) {
  const text = (typeof data === 'string' ? data : (data.final || data.interim || '')).trim();
  const audioBlob = typeof data === 'object' && data.audioBlob ? data.audioBlob : null;
  const detectedLang = typeof data === 'object' ? data.detectedLanguage : null;

  if (audioBlob) {
    onVadSpeechChunk({ audioBlob, durationSec: null });
    return;
  }

  if (!text) return;

  // In Two-Way Communication Hub mode, route hearing voice input directly to Two-Way pipeline
  if (currentRtcSubmode === 'twoway') {
    if (data.final || typeof data === 'string') {
      handleHearingSpeechInput(text);
      if (isTwoWayMicActive) {
        isTwoWayMicActive = false;
        DOM.btnRtcTwowayMic?.classList.remove('listening');
        if (DOM.rtcTwowayMicLabel) DOM.rtcTwowayMicLabel.textContent = '🎤 Push to Speak (Voice Input)';
      }
    } else {
      if (DOM.rtcTwowaySpeechText) DOM.rtcTwowaySpeechText.textContent = `"${text}..."`;
      if (data.languageName && DOM.rtcTwowayLangPill) {
        DOM.rtcTwowayLangPill.textContent = `${data.languageFlag || '🇮🇳'} ${data.languageName} detected`;
        DOM.rtcTwowayLangPill.classList.remove('hidden');
      }
    }
    return;
  }

  // Rule 2: Only trigger on stabilized / final speech to avoid prematurely animating incomplete thoughts
  if (data.final || typeof data === 'string') {
    if (speechStabilizeTimer) {
      clearTimeout(speechStabilizeTimer);
      speechStabilizeTimer = null;
    }
    processRecognizedSpeech({
      spokenText: text,
      englishText: '',
      detectedLanguage: detectedLang
    }, null, 'speech_api');
  } else {
    // Interim transcript: update text preview without interrupting or triggering animations prematurely
    if (DOM.captionSpeech) DOM.captionSpeech.textContent = `"${text}..."`;
    if (DOM.widgetPhraseText) DOM.widgetPhraseText.textContent = `"${text}..."`;
    if (data.languageName && DOM.captionLangBadge) {
      DOM.captionLangBadge.textContent = `${data.languageFlag || '🇮🇳'} ${data.languageName} detected`;
      DOM.captionLangBadge.classList.remove('hidden');
    }
    updateRtcStatus('LISTENING');

    // Speech stabilization: wait for user to finish phrase before triggering animation
    if (speechStabilizeTimer) clearTimeout(speechStabilizeTimer);
    speechStabilizeTimer = setTimeout(() => {
      speechStabilizeTimer = null;
      if (text && text.length > 2) {
        processRecognizedSpeech({
          spokenText: text,
          englishText: '',
          detectedLanguage: detectedLang
        }, null, 'speech_stabilized');
      }
    }, 1100);
  }
}

let isVuMeterActive = false;
function onAudioLevelUpdate(level) {
  if (!DOM.vuMeter) return;
  if (level > 0.05) {
    isVuMeterActive = true;
    DOM.vuMeter.classList.add('active');
    const nowTime = Date.now() * 0.01;
    DOM.vuBars.forEach((bar, i) => {
      const h = Math.max(4, Math.min(20, Math.sin(nowTime + i) * 8 + level * 20));
      bar.style.height = `${h}px`;
    });
  } else if (isVuMeterActive) {
    isVuMeterActive = false;
    DOM.vuMeter.classList.remove('active');
    DOM.vuBars.forEach((bar) => {
      bar.style.height = '4px';
    });
  }
}

// --- SCREEN & SYSTEM AUDIO CAPTURE WORKFLOW ---
async function startRealTimeTranslation() {
  if (screenCaptureService && screenCaptureService.isCapturing) {
    stopRealTimeTranslation();
    return;
  }

  updateRtcStatus('SELECTING SCREEN');

  try {
    const { stream, hasAudio, sourceLabel } = await screenCaptureService.startCapture();

    // Display screen preview
    if (DOM.videoElem) {
      DOM.videoElem.srcObject = stream;
    }
    DOM.rtcActiveScreenContainer?.classList.remove('hidden');
    DOM.screenPlaceholder?.classList.add('hidden');

    // Update input source badge
    if (DOM.rtcSourceLabel) {
      DOM.rtcSourceLabel.textContent = sourceLabel || 'Windows Display';
    }

    // Update capture buttons
    if (DOM.btnRtcCaptureLabel) {
      DOM.btnRtcCaptureLabel.textContent = 'Stop Translation';
    }
    DOM.btnRtcToggleCapture?.classList.add('stopping');
    DOM.btnStartCapture?.classList.add('active');

    // Show and restore floating signer panel
    showCornerWidget();
    if (floatingSignerManager) {
      floatingSignerManager.restore();
    }

    // Audio stream & VAD handling
    if (hasAudio) {
      if (DOM.rtcAudioStatusBadge) {
        DOM.rtcAudioStatusBadge.classList.remove('unavailable');
      }
      if (DOM.rtcAudioStatusText) {
        DOM.rtcAudioStatusText.textContent = 'System Audio: Active';
      }

      const audioStream = screenCaptureService.getAudioStream();
      vadProcessor.start(audioStream);

      // Start offline speech recognition listening
      if (speechRecognizer) {
        speechRecognizer.start(audioStream);
      }

      updateRtcStatus('LISTENING');
      showToast('Capturing screen & system audio. Speech is translated into ISL.');
    } else {
      if (DOM.rtcAudioStatusBadge) {
        DOM.rtcAudioStatusBadge.classList.add('unavailable');
      }
      if (DOM.rtcAudioStatusText) {
        DOM.rtcAudioStatusText.textContent = 'System audio unavailable';
      }

      updateRtcStatus('CAPTURING (NO AUDIO)');
      showToast('System audio unavailable for this selection. Check "Share audio" or use Voice Input.');
    }

  } catch (err) {
    console.warn('[RTC] Start capture error:', err.message);
    stopRealTimeTranslation();
    if (err.name === 'NotAllowedError') {
      updateRtcStatus('READY', 'Screen selection was cancelled.');
    } else {
      updateRtcStatus('ERROR', err.message || 'Screen capture error.');
    }
  }
}

function stopRealTimeTranslation() {
  if (screenCaptureService) {
    screenCaptureService.stopCapture();
  }

  if (vadProcessor) {
    vadProcessor.stop();
  }

  if (speechRecognizer) {
    speechRecognizer.stop();
  }

  if (speechStabilizeTimer) {
    clearTimeout(speechStabilizeTimer);
    speechStabilizeTimer = null;
  }

  // Authoritative animation stop & queue clear
  stopAllAnimation();
  resetAvatarClean();

  // Reset screen video elements
  if (DOM.videoElem) {
    DOM.videoElem.srcObject = null;
  }
  DOM.rtcActiveScreenContainer?.classList.add('hidden');
  DOM.screenPlaceholder?.classList.remove('hidden');

  // Reset buttons
  if (DOM.btnRtcCaptureLabel) {
    DOM.btnRtcCaptureLabel.textContent = 'Start Translation';
  }
  DOM.btnRtcToggleCapture?.classList.remove('stopping');
  DOM.btnStartCapture?.classList.remove('active');

  if (DOM.btnRtcPauseLabel) {
    DOM.btnRtcPauseLabel.textContent = 'Pause';
  }
  isTranslationPaused = false;

  if (DOM.rtcSourceLabel) {
    DOM.rtcSourceLabel.textContent = 'No display selected';
  }
  if (DOM.rtcAudioStatusBadge) {
    DOM.rtcAudioStatusBadge.classList.remove('unavailable');
  }
  if (DOM.rtcAudioStatusText) {
    DOM.rtcAudioStatusText.textContent = 'Audio: Standby';
  }

  updateRtcStatus('READY');
  if (floatingSignerManager) {
    floatingSignerManager.updateSignStatus('Standing by...', 'READY', 'READY');
  }
}

function toggleTranslationPause() {
  isTranslationPaused = !isTranslationPaused;
  if (currentAction) {
    currentAction.paused = isTranslationPaused;
  }
  updateRtcStatus(isTranslationPaused ? 'PAUSED' : (screenCaptureService?.isCapturing ? 'LISTENING' : 'READY'));
  if (DOM.btnRtcPauseLabel) {
    DOM.btnRtcPauseLabel.textContent = isTranslationPaused ? 'Resume' : 'Pause';
  }
  const widgetPauseBtn = DOM.btnWidgetPause?.querySelector('span');
  if (widgetPauseBtn) {
    widgetPauseBtn.textContent = isTranslationPaused ? 'Resume' : 'Pause';
  }
}

function replayCurrentSign() {
  if (lastActiveSequence && lastActiveSequence.length > 0) {
    signSyncController.requestSign(lastActiveSequence, { isManual: true });
  } else if (currentSignSample) {
    playSequence([{
      type: 'phrase',
      label: currentSignSample.sentence || currentSignSample.label,
      gloss: currentSignSample.gloss,
      sample: currentSignSample
    }]);
  } else if (signMatcher && signMatcher.sentences && signMatcher.sentences.length > 0) {
    const s = signMatcher.sentences[0];
    playSequence([{ type: 'phrase', label: s.sentence, gloss: s.gloss, sample: s }]);
  }
}

DOM.btnRtcReplay?.addEventListener('click', replayCurrentSign);

// Bind primary Tab 1 RTC actions
DOM.btnRtcStartTranslation?.addEventListener('click', startRealTimeTranslation);
DOM.btnRtcToggleCapture?.addEventListener('click', startRealTimeTranslation);
DOM.btnStartCapture?.addEventListener('click', startRealTimeTranslation);

DOM.btnRtcPauseResume?.addEventListener('click', toggleTranslationPause);
DOM.btnRtcRecenterSigner?.addEventListener('click', () => {
  showCornerWidget();
  if (floatingSignerManager) {
    floatingSignerManager.restore();
  }
});

// --- MICROPHONE INPUT TOGGLE (OPTIONAL FALLBACK) ---
// --- MICROPHONE INPUT TOGGLE (OPTIONAL FALLBACK) ---
let isMicActive = false;

function onSpeechError(err) {
  console.warn('[SpeechRecognizer] Error event:', err);
  if (err.code === 'permission-denied') {
    if (vadProcessor && !screenCaptureService?.isCapturing) {
      vadProcessor.stop();
    }
    isMicActive = false;
    DOM.btnToggleMic?.classList.remove('active');
    DOM.btnQuickMic?.classList.remove('active');
    if (DOM.rtcAudioStatusText) {
      DOM.rtcAudioStatusText.textContent = 'Microphone: Permission Denied';
    }
    if (DOM.rtcAudioStatusBadge) {
      DOM.rtcAudioStatusBadge.classList.add('unavailable');
    }
    updateRtcStatus('READY', 'Microphone permission denied.');
    showToast('Microphone access denied. Voice recognition requires microphone access.');
  } else if (err.code === 'no-speech') {
    if (DOM.captionStatus) DOM.captionStatus.textContent = 'NO SPEECH DETECTED';
  }
}

DOM.btnToggleMic?.addEventListener('click', async () => {
  if (!isMicActive) {
    if (window.eduApp && window.eduApp.currentViewId !== 'view-realtime-comm') {
      window.eduApp.switchView('view-realtime-comm');
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone media devices API not supported in this browser.');
      }
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (vadProcessor) {
        vadProcessor.start(micStream);
      }
      if (speechRecognizer) {
        speechRecognizer.start(micStream);
      }
      isMicActive = true;
      DOM.btnToggleMic?.classList.add('active');
      DOM.btnQuickMic?.classList.add('active');
      updateRtcStatus('VOICE INPUT');
      if (DOM.rtcAudioStatusBadge) {
        DOM.rtcAudioStatusBadge.classList.remove('unavailable');
      }
      if (DOM.rtcAudioStatusText) DOM.rtcAudioStatusText.textContent = 'Microphone Active';
      showToast('Voice Input active! Speak into microphone to translate speech into ISL.');
    } catch (err) {
      console.warn('Mic permission error:', err);
      isMicActive = false;
      DOM.btnToggleMic?.classList.remove('active');
      DOM.btnQuickMic?.classList.remove('active');
      if (DOM.rtcAudioStatusBadge) {
        DOM.rtcAudioStatusBadge.classList.add('unavailable');
      }
      if (DOM.rtcAudioStatusText) {
        DOM.rtcAudioStatusText.textContent = 'Microphone: Access Denied';
      }
      updateRtcStatus('READY', 'Microphone permission denied.');
      showToast('Microphone access denied. Please allow microphone permissions in browser settings.');
    }
  } else {
    if (vadProcessor && !screenCaptureService?.isCapturing) {
      vadProcessor.stop();
    }
    if (speechRecognizer) {
      speechRecognizer.stop();
    }
    isMicActive = false;
    DOM.btnToggleMic?.classList.remove('active');
    DOM.btnQuickMic?.classList.remove('active');
    updateRtcStatus('READY');
    if (DOM.rtcAudioStatusText) DOM.rtcAudioStatusText.textContent = 'Audio: Standby';
    showToast('Microphone stopped.');
  }
});

DOM.btnQuickMic?.addEventListener('click', () => {
  DOM.btnToggleMic?.click();
});

// --- YOUTUBE VIDEO LOADER & SIGN SYNCHRONIZER ---
let ytSyncTimer = null;

function extractYouTubeId(url) {
  if (!url) return null;
  const clean = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;

  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = clean.match(regExp);
  return match ? match[1] : null;
}

function loadYouTubeVideo(url, videoTitle = 'YouTube Video') {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    showToast('Please enter a valid YouTube video link (e.g. youtube.com/watch?v=...)');
    return;
  }

  showToast('Starting YouTube video & translating signs in real time...');

  // Show YouTube background player container
  DOM.ytPlayerContainer?.classList.remove('hidden');
  DOM.screenPlaceholder?.classList.add('hidden');
  DOM.ytActiveBar?.classList.remove('hidden');
  if (DOM.ytActiveTitle) DOM.ytActiveTitle.textContent = videoTitle;

  // Position 3D avatar in the bottom-right corner over the video
  DOM.cornerWidget?.classList.add('pos-right');
  isCornerRight = true;
  requestAnimationFrame(updateRendererSize);

  // Embed YouTube player iframe with proper origin and autoplay permissions
  if (DOM.ytPlayerPlaceholder) {
    DOM.ytPlayerPlaceholder.innerHTML = `
      <iframe
        id="yt-embed-iframe"
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}"
        title="${videoTitle}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        style="width: 100%; height: 100%; border: none;"
      ></iframe>
    `;
  }

  // Attach YouTube player to centralized signSyncController
  signSyncController.attachPlayer('yt-embed-iframe');
}

function closeYouTubeVideo() {
  signSyncController.detachPlayer();
  signSyncController.stopActiveAnimation();
  if (DOM.ytPlayerPlaceholder) DOM.ytPlayerPlaceholder.innerHTML = '';
  DOM.ytPlayerContainer?.classList.add('hidden');
  DOM.ytActiveBar?.classList.add('hidden');
  DOM.screenPlaceholder?.classList.remove('hidden');
  if (ytSyncTimer) {
    clearInterval(ytSyncTimer);
    ytSyncTimer = null;
  }
  showToast('YouTube video closed.');
}

// YouTube Modal Open / Close Handlers
function openYouTubeModal() {
  DOM.ytModal?.classList.remove('hidden');
  DOM.ytUrlInput?.focus();
}

function closeYouTubeModal() {
  DOM.ytModal?.classList.add('hidden');
}

DOM.btnOpenYtModal?.addEventListener('click', openYouTubeModal);
DOM.btnQuickYt?.addEventListener('click', openYouTubeModal);
DOM.btnCloseYtModal?.addEventListener('click', closeYouTubeModal);

DOM.ytModal?.addEventListener('click', (e) => {
  if (e.target === DOM.ytModal) {
    closeYouTubeModal();
  }
});

// YouTube Button Event Listeners
DOM.btnLoadYt?.addEventListener('click', () => {
  const url = DOM.ytUrlInput?.value?.trim();
  if (url) {
    closeYouTubeModal();
    loadYouTubeVideo(url);
  }
});

DOM.ytUrlInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') DOM.btnLoadYt?.click();
});

DOM.ytChips?.forEach((chip) => {
  chip.addEventListener('click', () => {
    const url = chip.dataset.url;
    if (DOM.ytUrlInput) DOM.ytUrlInput.value = url;
    closeYouTubeModal();
    loadYouTubeVideo(url, chip.textContent);
  });
});

DOM.btnCloseYt?.addEventListener('click', closeYouTubeVideo);

// Test phrases chips
DOM.testChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const phrase = chip.dataset.phrase;
    if (DOM.manualInput) DOM.manualInput.value = phrase;
    onSpeechResult({ final: phrase });
  });
});

DOM.btnManualSign?.addEventListener('click', () => {
  const text = DOM.manualInput?.value?.trim();
  if (text) {
    onSpeechResult({ final: text });
  }
});

DOM.manualInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    DOM.btnManualSign?.click();
  }
});

// --- REOPEN / RECENTER FLOATING SIGNER CONTROLS ---
DOM.btnRtcRecenterSigner?.addEventListener('click', () => {
  if (floatingSignerManager) {
    floatingSignerManager.reopenAndRecenter();
    showToast('Signer panel re-centered');
  }
});

const btnExport = document.getElementById('btn-export-bvh');
btnExport?.addEventListener('click', () => {
  if (window.eduApp && window.eduApp.currentViewId !== 'view-realtime-comm') {
    window.eduApp.switchView('view-realtime-comm');
  }
  if (floatingSignerManager) {
    floatingSignerManager.reopenAndRecenter();
    showToast('Signer panel opened');
  }
});

// Universal Speed Chips Listener (.mini-chip in widget and .speed-chip in studio)
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.mini-chip, .speed-chip');
  if (chip && chip.dataset.speed) {
    setGlobalPlaybackSpeed(parseFloat(chip.dataset.speed));
  }
});

// Studio Play / Pause Toggle
DOM.btnPlayPause?.addEventListener('click', () => {
  isPlaying = !isPlaying;
  if (currentAction) {
    currentAction.paused = !isPlaying;
  }
  if (DOM.playIcon && DOM.pauseIcon) {
    DOM.playIcon.classList.toggle('hidden', isPlaying);
    DOM.pauseIcon.classList.toggle('hidden', !isPlaying);
  }
});

// Studio Animation Reset
DOM.btnReset?.addEventListener('click', () => {
  stopAllAnimation();
  if (currentSignSample) {
    playSequence([{
      type: 'phrase',
      label: currentSignSample.sentence,
      gloss: currentSignSample.gloss,
      sample: currentSignSample
    }]);
  } else {
    resetAvatarClean();
  }
});

// Studio Timeline Scrubber
DOM.timelineSlider?.addEventListener('input', (e) => {
  if (currentAction) {
    currentAction.time = parseFloat(e.target.value);
    if (bvhMixer) bvhMixer.update(0);
    if (retargeter) retargeter.update();
  }
});

// --- SIGN LIBRARY POPULATION ---
function renderLibrary(sentences) {
  if (!DOM.sentenceList) return;
  DOM.sentenceList.innerHTML = '';
  if (DOM.sampleBadge) DOM.sampleBadge.textContent = `${sentences.length} Signs`;

  sentences.slice(0, 100).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'sentence-card';
    const words = item.sentence.trim().split(/\s+/).filter(Boolean);
    const level = words.length <= 4 ? 'Beginner' : words.length <= 8 ? 'Intermediate' : 'Advanced';
    card.innerHTML = `
      <div class="card-header-row">
        <span class="sample-id-tag">#${item.id}</span>
        <span class="repo-level-tag ${level.toLowerCase()}">${level}</span>
      </div>
      <div class="card-sentence">${item.sentence}</div>
      <div class="card-gloss-tag">${item.gloss}</div>
    `;
    card.addEventListener('click', () => {
      playSequence([{ type: 'phrase', label: item.sentence, gloss: item.gloss, sample: item }]);
    });
    DOM.sentenceList.appendChild(card);
  });
}

DOM.sentenceSearch?.addEventListener('input', (e) => {
  if (!signMatcher) return;
  const q = e.target.value.toLowerCase().trim();
  const filtered = signMatcher.sentences.filter(
    (s) => s.sentence.toLowerCase().includes(q) || s.gloss.toLowerCase().includes(q) || s.id.includes(q)
  );
  renderLibrary(filtered);
});

// --- EXPORT GLB ---
DOM.btnExport?.addEventListener('click', () => {
  if (!characterModel || !currentAction) {
    showToast('Please wait for model and animation to load.');
    return;
  }
  showToast('Baking sign animation into 3D character...');
  const duration = currentAction.getClip().duration;
  const fps = 24;
  const numFrames = Math.floor(duration * fps);
  const times = [];
  const tracks = [];

  const boneTracks = {};
  for (const pair of retargeter.pairs) {
    boneTracks[pair.dstBone.name] = { rotations: [] };
  }

  const origTime = currentAction.time;
  for (let f = 0; f < numFrames; f++) {
    const t = f / fps;
    times.push(t);
    currentAction.time = t;
    bvhMixer.update(0);
    retargeter.update();

    for (const pair of retargeter.pairs) {
      const q = pair.dstBone.quaternion;
      boneTracks[pair.dstBone.name].rotations.push(q.x, q.y, q.z, q.w);
    }
  }
  currentAction.time = origTime;

  for (const [boneName, data] of Object.entries(boneTracks)) {
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${boneName}.quaternion`,
        new Float32Array(times),
        new Float32Array(data.rotations)
      )
    );
  }

  const signClip = new THREE.AnimationClip(`Sign_${currentSignSample?.id || 'live'}`, duration, tracks);
  const exporter = new GLTFExporter();
  exporter.parse(
    characterModel,
    (glbArrayBuffer) => {
      const blob = new Blob([glbArrayBuffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SignBridge_${currentSignSample?.id || 'export'}.glb`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported animated GLB successfully!');
    },
    { binary: true, animations: [signClip] }
  );
});

function showToast(msg) {
  if (!DOM.toast) return;
  DOM.toast.textContent = msg;
  DOM.toast.classList.remove('hidden');
  setTimeout(() => DOM.toast?.classList.add('hidden'), 3500);
}

// ============================================================================
// TWO-WAY COMMUNICATION HUB (PURE ISL SIGN ↔ SPEECH PIPELINE)
// ============================================================================

async function startRtcTwoWayCam() {
  if (islRecognitionService.isRunning) return;
  const video = DOM.rtcTwowayVideo || document.getElementById('rtc-twoway-video');
  const canvas = DOM.rtcTwowayCanvas || document.getElementById('rtc-twoway-canvas');
  const placeholder = DOM.rtcTwowayCamPlaceholder || document.getElementById('rtc-twoway-camera-placeholder');
  const statusBadge = DOM.rtcDeafCamStatusBadge || document.getElementById('rtc-deaf-cam-status-badge');
  const toggleBtn = DOM.btnRtcTwowayToggleCam || document.getElementById('btn-rtc-twoway-toggle-cam');
  const statusMsg = DOM.rtcTwowayStatusMsg || document.getElementById('rtc-twoway-status-msg');

  if (placeholder) placeholder.classList.add('hidden');
  if (statusBadge) {
    statusBadge.textContent = 'INITIALIZING...';
    statusBadge.className = 'rtc-cam-status-badge active';
  }
  if (statusMsg) statusMsg.textContent = 'Loading offline MediaPipe Hand Landmarker WASM...';

  try {
    const ok = await islRecognitionService.start({
      videoElement: video,
      canvasElement: canvas
    });
    if (ok) {
      if (statusBadge) {
        statusBadge.textContent = 'DETECTING';
        statusBadge.className = 'rtc-cam-status-badge active';
      }
      if (toggleBtn) toggleBtn.textContent = 'Stop Camera';
      if (statusMsg) statusMsg.textContent = 'Tracking 21 3D hand landmarks in real time. Form any ISL sign.';
      showToast('ISL Camera active! 21-point skeletal tracking running offline.');
    } else {
      throw new Error('Camera failed to initialize.');
    }
  } catch (err) {
    console.warn('Failed to start ISL camera:', err);
    if (placeholder) placeholder.classList.remove('hidden');
    if (statusBadge) {
      statusBadge.textContent = 'CAMERA ERROR';
      statusBadge.className = 'rtc-cam-status-badge';
    }
    if (statusMsg) statusMsg.textContent = 'Could not access webcam. Please verify camera permissions.';
    showToast('Could not access webcam: ' + (err.message || 'Permission denied'));
  }
}

function stopRtcTwoWayCam() {
  islRecognitionService.stop();
  const placeholder = DOM.rtcTwowayCamPlaceholder || document.getElementById('rtc-twoway-camera-placeholder');
  const statusBadge = DOM.rtcDeafCamStatusBadge || document.getElementById('rtc-deaf-cam-status-badge');
  const toggleBtn = DOM.btnRtcTwowayToggleCam || document.getElementById('btn-rtc-twoway-toggle-cam');
  const statusMsg = DOM.rtcTwowayStatusMsg || document.getElementById('rtc-twoway-status-msg');

  if (placeholder) placeholder.classList.remove('hidden');
  if (statusBadge) {
    statusBadge.textContent = 'STANDBY';
    statusBadge.className = 'rtc-cam-status-badge';
  }
  if (toggleBtn) toggleBtn.textContent = 'Start Camera';
  if (statusMsg) statusMsg.textContent = 'Webcam standby. Click Start to resume gesture tracking.';
}

function renderTwoWaySequenceChips(seq) {
  const chipsBox = DOM.rtcTwowaySeqChips || document.getElementById('rtc-twoway-seq-chips');
  const countEl = DOM.rtcTwowaySeqCount || document.getElementById('rtc-twoway-seq-count');
  const btnSend = DOM.btnRtcTwowaySendSpeech || document.getElementById('btn-rtc-twoway-send-speech');

  const count = seq ? seq.length : 0;
  if (countEl) countEl.textContent = `${count} Sign${count === 1 ? '' : 's'}`;
  if (btnSend) btnSend.disabled = (count === 0);

  if (!chipsBox) return;

  if (count === 0) {
    chipsBox.innerHTML = '<span class="rtc-empty-seq-hint">No signs committed yet. Sign and hold to add.</span>';
    return;
  }

  chipsBox.innerHTML = '';
  seq.forEach((item, index) => {
    const chip = document.createElement('div');
    chip.className = 'rtc-seq-chip';
    const label = typeof item === 'string' ? item : (item.label || item.display || 'SIGN');
    chip.innerHTML = `
      <span class="chip-idx">${index + 1}</span>
      <span class="chip-label">${label}</span>
      <button class="chip-remove" data-index="${index}" title="Remove sign">✕</button>
    `;
    chip.querySelector('.chip-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      removeSignFromTwoWaySequence(index);
    });
    chipsBox.appendChild(chip);
  });
}

function removeSignFromTwoWaySequence(index) {
  const seq = islRecognitionService.getStatus().committedSequence;
  seq.splice(index, 1);
  renderTwoWaySequenceChips(seq);
}

function composeSentenceFromISLSigns(signs) {
  if (!signs || signs.length === 0) return '';
  const labels = signs.map(s => (typeof s === 'string' ? s : (s.label || '')).toUpperCase());

  // Conversational combination rules
  if (labels.includes('HELLO') && labels.includes('GOOD')) {
    return 'Hello! I am doing good, thank you.';
  }
  if (labels.includes('WATER') && labels.includes('HELP')) {
    return 'I need water urgently, please help me.';
  }
  if (labels.includes('THANK YOU') && labels.includes('GOOD')) {
    return 'I am doing good. Thank you very much!';
  }
  if (labels.includes('CELL') && labels.includes('PLANT')) {
    return 'Can you explain the structure of a plant cell?';
  }

  // Lookup sign definitions
  const signPhrases = labels.map(lbl => {
    const found = SUPPORTED_ISL_SIGNS_V1.find(s => s.label === lbl);
    return found ? (found.phrase || found.display) : lbl;
  });

  return signPhrases.join(' ');
}

function sendDeafISLMessage() {
  const seq = [...islRecognitionService.getStatus().committedSequence];
  const activePred = islRecognitionService.getPrediction();

  // If sequence is empty but active prediction is valid, commit it
  if (seq.length === 0 && activePred) {
    seq.push(activePred);
  }

  if (seq.length === 0) {
    showToast('No signs in sequence to send. Sign in front of camera or click verified palette chips.');
    return;
  }

  const composedSentence = composeSentenceFromISLSigns(seq);
  const glosses = seq.map(s => (typeof s === 'string' ? s : (s.label || '')).toUpperCase()).join(' • ');

  // Add message to chat timeline
  addTwoWayChatMessage({
    sender: 'deaf',
    senderName: 'Deaf Participant (ISL Signer)',
    text: composedSentence,
    gloss: glosses,
    signs: seq
  });

  // Speak aloud for Hearing Participant via Text-to-Speech
  rtcTtsService.speak(composedSentence);

  // Clear sequence
  islRecognitionService.clearSequence();
  renderTwoWaySequenceChips([]);

  showToast(`Sent & Spoken: "${composedSentence}"`);
}

async function handleHearingSpeechInput(inputPhrase) {
  if (!inputPhrase || !inputPhrase.trim()) return;
  const rawText = inputPhrase.trim();

  const speechEl = DOM.rtcTwowaySpeechText || document.getElementById('rtc-twoway-speech-text');
  const langPill = DOM.rtcTwowayLangPill || document.getElementById('rtc-twoway-lang-pill');
  const glossEl = DOM.rtcTwowayGlossText || document.getElementById('rtc-twoway-gloss-text');
  const hearingBadge = DOM.rtcHearingStatusBadge || document.getElementById('rtc-hearing-status-badge');

  if (speechEl) speechEl.textContent = `"${rawText}"`;
  if (hearingBadge) {
    hearingBadge.textContent = 'TRANSLATING';
    hearingBadge.className = 'rtc-cam-status-badge active';
  }

  let normResult = null;
  try {
    normResult = meaningNormalizer.normalizeMeaning({ spokenText: rawText });
  } catch (err) {
    console.warn('[TwoWay] normalization error:', err);
  }

  if (!normResult || !normResult.success) {
    const fallbackMsg = "⚠️ Speech unclear, please speak again.";
    if (speechEl) speechEl.textContent = fallbackMsg;
    if (glossEl) glossEl.textContent = 'UNCLEAR';
    if (hearingBadge) {
      hearingBadge.textContent = 'AVATAR READY';
      hearingBadge.className = 'rtc-cam-status-badge active';
    }
    showToast(fallbackMsg);
    return;
  }

  const nativeText = normResult.nativeText || rawText;
  const langName = normResult.languageName || 'Indian Language';
  const langFlag = normResult.languageFlag || '🇮🇳';
  const primaryGloss = normResult.primaryGloss || 'ISL SIGN';

  if (langPill) {
    langPill.textContent = `${langFlag} ${langName} detected`;
    langPill.classList.remove('hidden');
  }
  if (glossEl) {
    glossEl.textContent = primaryGloss;
  }

  // Animate 3D avatar in real time
  if (normResult.sequence && normResult.sequence.length > 0) {
    if (hearingBadge) {
      hearingBadge.textContent = 'SIGNING ISL';
      hearingBadge.className = 'rtc-cam-status-badge stable';
    }
    signSyncController.requestSign(normResult.sequence, { isManual: true });
  }

  // Append to conversation transcript
  addTwoWayChatMessage({
    sender: 'hearing',
    senderName: 'Hearing Participant (Voice)',
    text: nativeText,
    gloss: primaryGloss,
    sequence: normResult.sequence
  });

  setTimeout(() => {
    if (hearingBadge) {
      hearingBadge.textContent = 'AVATAR READY';
      hearingBadge.className = 'rtc-cam-status-badge active';
    }
  }, 2500);
}

function addTwoWayChatMessage({ sender, senderName, text, gloss, signs = [], sequence = null }) {
  const timeline = DOM.rtcTwowayChatTimeline || document.getElementById('rtc-twoway-chat-timeline');
  const emptyMsg = DOM.rtcChatEmptyMsg || document.getElementById('rtc-chat-empty-msg');
  if (!timeline) return;

  if (emptyMsg) emptyMsg.classList.add('hidden');

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubble = document.createElement('div');
  bubble.className = `rtc-chat-bubble ${sender}`;

  const avatarIcon = sender === 'deaf' ? '🤟' : '🎤';
  const roleClass = sender === 'deaf' ? 'role-deaf' : 'role-hearing';

  bubble.innerHTML = `
    <div class="rtc-bubble-avatar ${roleClass}">${avatarIcon}</div>
    <div class="rtc-bubble-body">
      <div class="rtc-bubble-header">
        <span class="rtc-bubble-author">${senderName}</span>
        <span class="rtc-bubble-time">${timeStr}</span>
      </div>
      <div class="rtc-bubble-content">
        <p class="rtc-bubble-text">"${text}"</p>
        ${gloss ? `
          <div class="rtc-bubble-gloss-tag">
            <span class="rtc-gloss-label">ISL GLOSS:</span>
            <span class="rtc-gloss-val">${gloss}</span>
          </div>
        ` : ''}
      </div>
      <div class="rtc-bubble-actions">
        <button class="rtc-bubble-btn btn-tts-listen" title="Listen to spoken audio">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          <span>Listen</span>
        </button>
        <button class="rtc-bubble-btn btn-avatar-replay" title="Replay 3D ISL avatar signing">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          <span>Replay Sign</span>
        </button>
      </div>
    </div>
  `;

  // Attach button actions
  bubble.querySelector('.btn-tts-listen')?.addEventListener('click', () => {
    rtcTtsService.speak(text);
    showToast(`Speaking: "${text}"`);
  });

  bubble.querySelector('.btn-avatar-replay')?.addEventListener('click', () => {
    if (sequence && sequence.length > 0) {
      signSyncController.requestSign(sequence, { isManual: true });
    } else if (gloss) {
      const match = signMatcher?.matchSign?.(gloss);
      if (match) {
        signSyncController.requestSign([match], { isManual: true });
      } else {
        signCurriculumText(text);
      }
    } else {
      signCurriculumText(text);
    }
    showToast(`Replaying avatar sign for: "${gloss || text}"`);
  });

  timeline.appendChild(bubble);
  timeline.scrollTop = timeline.scrollHeight;
}

function initRtcTwoWayCommunication() {
  // 1. Sub-mode switcher
  DOM.btnRtcSubmodeScreen?.addEventListener('click', () => switchRtcSubmode('screen'));
  DOM.btnRtcSubmodeTwoway?.addEventListener('click', () => switchRtcSubmode('twoway'));
  DOM.btnQuickTwoway?.addEventListener('click', () => {
    if (window.eduApp && window.eduApp.currentViewId !== 'view-realtime-comm') {
      window.eduApp.switchView('view-realtime-comm');
    }
    switchRtcSubmode('twoway');
  });

  // 2. Deaf Participant Camera Controls
  DOM.btnRtcTwowayStartCam?.addEventListener('click', () => startRtcTwoWayCam());
  DOM.btnRtcTwowayToggleCam?.addEventListener('click', () => {
    if (islRecognitionService.isRunning) {
      stopRtcTwoWayCam();
    } else {
      startRtcTwoWayCam();
    }
  });

  DOM.btnRtcTwowayCommitSign?.addEventListener('click', () => {
    const token = islRecognitionService.commitActivePrediction();
    if (token) {
      showToast(`Committed sign: ${token}`);
    } else {
      showToast('No active high-confidence sign to commit.');
    }
  });

  DOM.btnRtcTwowayClearSeq?.addEventListener('click', () => {
    islRecognitionService.clearSequence();
    renderTwoWaySequenceChips([]);
    showToast('ISL sequence cleared.');
  });

  DOM.btnRtcTwowaySendSpeech?.addEventListener('click', () => {
    sendDeafISLMessage();
  });

  // 3. Quick Sign Verification Palette
  document.querySelectorAll('.rtc-pal-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sign = chip.dataset.sign;
      if (!sign) return;
      islRecognitionService.addManualToken(sign);
      const seq = islRecognitionService.getStatus().committedSequence;
      renderTwoWaySequenceChips(seq);
      showToast(`Added "${sign}" to ISL sequence`);
    });
  });

  // 4. Hearing Participant Voice & Controls
  DOM.btnRtcTwowayRecenter?.addEventListener('click', () => {
    if (camera) camera.position.set(0, 1.25, 1.8);
    if (controls) {
      controls.target.set(0, 1.1, 0);
      controls.update();
    }
    updateRendererSize();
    showToast('Avatar camera re-centered');
  });

  DOM.btnRtcTwowayMic?.addEventListener('click', async () => {
    if (!isTwoWayMicActive) {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Microphone media devices API not supported in this browser.');
        }
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (speechRecognizer) {
          speechRecognizer.start(micStream);
        }
        isTwoWayMicActive = true;
        DOM.btnRtcTwowayMic?.classList.add('listening');
        if (DOM.rtcTwowayMicLabel) DOM.rtcTwowayMicLabel.textContent = 'Listening... Speak now';
        showToast('Listening to Hearing Participant... Speak in any Indian language.');
      } catch (err) {
        console.warn('Two-Way mic access error:', err);
        isTwoWayMicActive = false;
        DOM.btnRtcTwowayMic?.classList.remove('listening');
        if (DOM.rtcTwowayMicLabel) DOM.rtcTwowayMicLabel.textContent = '🎤 Push to Speak (Voice Input)';
        showToast('Microphone access denied: ' + (err.message || 'Permission denied'));
      }
    } else {
      if (speechRecognizer) {
        speechRecognizer.stop();
      }
      isTwoWayMicActive = false;
      DOM.btnRtcTwowayMic?.classList.remove('listening');
      if (DOM.rtcTwowayMicLabel) DOM.rtcTwowayMicLabel.textContent = '🎤 Push to Speak (Voice Input)';
      showToast('Voice input stopped.');
    }
  });

  // Quick Speech Phrase Chips
  document.querySelectorAll('.rtc-sp-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const phrase = chip.dataset.phrase;
      if (phrase) {
        handleHearingSpeechInput(phrase);
      }
    });
  });

  // 5. Conversation Transcript History Controls
  DOM.btnRtcTwowayClearChat?.addEventListener('click', () => {
    const timeline = DOM.rtcTwowayChatTimeline || document.getElementById('rtc-twoway-chat-timeline');
    const emptyMsg = DOM.rtcChatEmptyMsg || document.getElementById('rtc-chat-empty-msg');
    if (timeline) {
      timeline.innerHTML = '';
      if (emptyMsg) {
        emptyMsg.classList.remove('hidden');
        timeline.appendChild(emptyMsg);
      }
    }
    showToast('Conversation transcript cleared.');
  });

  // 6. Register ISL Recognition Service Listeners
  islRecognitionService.onPrediction((pred) => {
    if (currentRtcSubmode !== 'twoway') return;

    const predLabel = DOM.rtcTwowayPredLabel || document.getElementById('rtc-twoway-pred-label');
    const confText = DOM.rtcTwowayConfText || document.getElementById('rtc-twoway-conf-text');
    const confBar = DOM.rtcTwowayConfBar || document.getElementById('rtc-twoway-conf-bar');
    const statusBadge = DOM.rtcDeafCamStatusBadge || document.getElementById('rtc-deaf-cam-status-badge');
    const statusMsg = DOM.rtcTwowayStatusMsg || document.getElementById('rtc-twoway-status-msg');

    if (pred && pred.rawLabel) {
      const pct = Math.round(pred.confidence);
      const label = pred.display || pred.rawLabel;
      if (predLabel) predLabel.textContent = label;
      if (confText) confText.textContent = `${pct}%`;
      if (confBar) confBar.style.width = `${pct}%`;

      if (pred.isStable || pred.isCommitted) {
        if (statusBadge) {
          statusBadge.textContent = 'STABLE SIGN';
          statusBadge.className = 'rtc-cam-status-badge stable';
        }
        if (statusMsg) statusMsg.textContent = `✨ Recognized gesture: ${label} (${pct}% confidence). Hold or click Commit Sign.`;
      } else if (pct >= 60) {
        if (statusBadge) {
          statusBadge.textContent = 'DETECTING';
          statusBadge.className = 'rtc-cam-status-badge active';
        }
        if (statusMsg) statusMsg.textContent = `Analyzing hand kinematics: ${label} (${pct}% confidence)...`;
      } else {
        if (statusBadge) {
          statusBadge.textContent = 'UNCERTAIN';
          statusBadge.className = 'rtc-cam-status-badge warning';
        }
        if (statusMsg) statusMsg.textContent = `Low confidence (${pct}%). Try a verified sign (HELLO, GOOD, WATER) or use Fallback below.`;
      }
    } else {
      if (predLabel) predLabel.textContent = '—';
      if (confText) confText.textContent = '0%';
      if (confBar) confBar.style.width = '0%';
      if (statusBadge && islRecognitionService.isRunning) {
        statusBadge.textContent = 'SEARCHING';
        statusBadge.className = 'rtc-cam-status-badge active';
      }
      if (statusMsg && islRecognitionService.isRunning) {
        statusMsg.textContent = 'Calibrated for verified common signs (HELLO, GOOD, WATER, etc.). For complex doubts, use Fallback below.';
      }
    }
  });

  islRecognitionService.onSequenceUpdate((seq) => {
    if (currentRtcSubmode !== 'twoway') return;
    renderTwoWaySequenceChips(seq);
  });

  // 7. Register Two-Way Accessible Fallback Input Listeners
  const fallbackInput = document.getElementById('rtc-twoway-fallback-input');
  const btnFallbackAdd = document.getElementById('btn-rtc-fallback-add');
  const btnFallbackSpeak = document.getElementById('btn-rtc-fallback-speak');

  const handleFallbackAdd = () => {
    if (!fallbackInput) return;
    const text = fallbackInput.value.trim();
    if (!text) return;
    islRecognitionService.addManualToken(text);
    fallbackInput.value = '';
    showToast(`Added "${text}" to sign sequence via fallback.`);
  };

  const handleFallbackSpeak = () => {
    if (!fallbackInput) return;
    const text = fallbackInput.value.trim();
    if (text) {
      islRecognitionService.addManualToken(text);
      fallbackInput.value = '';
    }
    sendDeafISLMessage();
  };

  btnFallbackAdd?.addEventListener('click', handleFallbackAdd);
  btnFallbackSpeak?.addEventListener('click', handleFallbackSpeak);
  fallbackInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFallbackAdd();
    }
  });

  // 8. Register Hearing Participant Text Fallback (Triggers Avatar ISL)
  const hearingInput = document.getElementById('rtc-hearing-manual-input');
  const btnHearingSign = document.getElementById('btn-rtc-hearing-manual-sign');

  const handleHearingSign = () => {
    if (!hearingInput) return;
    const text = hearingInput.value.trim();
    if (text && window.eduApp) {
      // 1. Update text display so the deaf person can read it too
      const speechBox = document.getElementById('rtc-twoway-speech-text');
      if (speechBox) speechBox.textContent = `"${text}"`;
      
      const glossBox = document.getElementById('rtc-twoway-gloss-text');
      if (glossBox) glossBox.textContent = 'TRANSLATING...';
      
      // 2. Trigger ISL Avatar playback
      window.eduApp.processInputToISL(text);
      
      hearingInput.value = '';
    }
  };

  btnHearingSign?.addEventListener('click', handleHearingSign);
  hearingInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleHearingSign();
    }
  });
}

// --- SIGNER VISIBILITY DETECTION ---
function isSignerVisible() {
  // If Picture-in-Picture is active, the signer window is externally visible on Windows desktop even if main document is hidden!
  if (floatingSignerManager && (floatingSignerManager.isPipActive || floatingSignerManager.pipWindow)) {
    return true;
  }
  if (typeof document !== 'undefined' && document.pictureInPictureElement) {
    return true;
  }
  if (document.hidden) return false;
  if (currentMode === 'screen' || currentMode === 'view-realtime-comm') {
    if (currentRtcSubmode === 'twoway') {
      const mount = DOM.rtcTwowayAvatarMount || document.getElementById('rtc-twoway-avatar-mount');
      return !!(mount && (mount.clientWidth > 0 || mount.offsetWidth > 0));
    }
    return !!(DOM.cornerWidget && DOM.cornerWidget.style.display !== 'none' && !DOM.cornerWidget.classList.contains('minimized'));
  }
  if (currentMode === 'studio' || currentMode === 'view-isl-repository') {
    const target = DOM.studioContainer;
    return !!(target && (target.clientWidth > 0 || target.offsetWidth > 0));
  }
  if (renderer && renderer.domElement && renderer.domElement.parentElement) {
    const parent = renderer.domElement.parentElement;
    return (parent.clientWidth > 0 || parent.offsetWidth > 0) && (parent.clientHeight > 0 || parent.offsetHeight > 0);
  }
  return false;
}

// --- ANIMATION RENDER LOOP ---
function animate() {
  // Drive render loop from PiP window if active so animation never halts when main browser is minimized
  if (floatingSignerManager && floatingSignerManager.pipWindow && !floatingSignerManager.pipWindow.closed) {
    floatingSignerManager.pipWindow.requestAnimationFrame(animate);
  } else {
    requestAnimationFrame(animate);
  }
  const now = performance.now();
  const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  // Tick the centralized sign sync controller for video time & seek sync
  signSyncController.tick(delta);

  const visible = isSignerVisible();

  const shouldAdvanceMixer = signSyncController.activePlayer
    ? (signSyncController.isPlaying && !signSyncController.isBuffering)
    : isPlaying;

  if (visible && bvhMixer && shouldAdvanceMixer && retargeter && retargeter.enabled) {
    bvhMixer.update(delta);
    retargeter.update();
    if (currentAction && currentMode === 'studio') {
      if (DOM.timelineSlider) DOM.timelineSlider.value = currentAction.time;
      if (DOM.currentTimeDisp) DOM.currentTimeDisp.textContent = formatTime(currentAction.time);
    }
  }

  if (visible) {
    if (controls) controls.update();
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }
}

// --- STARTUP (Guaranteed Non-Blocking Order) ---
async function start() {
  const isNativePip = typeof window !== 'undefined' && window.location.search.includes('pip=native');
  if (isNativePip) {
    document.documentElement.classList.add('native-pip-mode');
    document.body.classList.add('native-pip-mode');
    currentMode = 'view-realtime-comm';
  }

  // 1. Initialize 3D Scene immediately so renderer, camera, lighting, and animation loop are ready
  try {
    initScene();
    animate();
    if (isNativePip) {
      setMode('view-realtime-comm');
    }
  } catch (err) {
    console.error('WebGL init error:', err);
  }

  // Connect native Electron IPC synchronization listeners
  if (window.electronAPI && typeof window.electronAPI.onSyncSign === 'function') {
    window.electronAPI.onSyncSign((signData) => {
      if (!signData) return;
      if (signData.sequence) {
        signSyncController.requestSign(signData.sequence, { isManual: true });
        if (floatingSignerManager) {
          floatingSignerManager.updateSignStatus(signData.text, signData.gloss || 'ISL SIGN', 'TRANSLATING');
        }
      } else if (signData.text) {
        processRecognizedSpeech(signData.text, null, 'electron_sync');
      }
    });
  }

  if (window.electronAPI && typeof window.electronAPI.onSyncControl === 'function') {
    window.electronAPI.onSyncControl((ctrl) => {
      if (!ctrl) return;
      if (ctrl.action === 'pause') {
        toggleTranslationPause();
      } else if (ctrl.action === 'speed' && ctrl.speed) {
        setGlobalPlaybackSpeed(ctrl.speed);
      } else if (ctrl.action === 'replay') {
        replayCurrentSign();
      }
    });
  }

  // 2. Initialize Speech Recognizer, VAD Processor, and Screen Capture Service
  try {
    screenCaptureService = new ScreenCaptureService({
      onTrackEnded: (trackType) => {
        console.log(`[RTC] ${trackType} capture track ended by user.`);
        stopRealTimeTranslation();
      },
      onAudioStatusChange: (status) => {
        if (DOM.rtcAudioStatusBadge) {
          DOM.rtcAudioStatusBadge.classList.toggle('unavailable', !status.hasAudio);
        }
        if (DOM.rtcAudioStatusText) {
          DOM.rtcAudioStatusText.textContent = status.hasAudio ? 'System Audio: Active' : status.label;
        }
      },
      onError: (err) => {
        console.warn('[ScreenCaptureService] Notice:', err.message);
        updateRtcStatus('ERROR', err.message);
      }
    });

    vadProcessor = new VADProcessor({
      onSpeechStart: () => {
        if (!isTranslationPaused && screenCaptureService?.isCapturing) {
          updateRtcStatus('LISTENING');
        }
      },
      onSpeechEnd: (data) => {
        onVadSpeechChunk(data);
      },
      onAudioLevel: (level) => {
        onAudioLevelUpdate(level);
      }
    });

    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      import('./speechInputService.js').then(({ speechInputService }) => {
        // Tie UI into the new backend-powered service
        speechInputService.onInterimTranscript = (text) => {
          if (DOM.captionSpeech) DOM.captionSpeech.textContent = text;
        };
        speechInputService.onFinalResult = (res) => {
          if (res.english_text && DOM.captionGloss) {
            DOM.captionGloss.textContent = res.english_text;
            signCurriculumText(res.english_text);
          }
        };
        speechInputService.onAudioLevel = onAudioLevelUpdate;
        
        // Override global for UI toggle
        window.speechRecognizer = speechInputService;
      });
    }
  } catch (err) {
    console.warn('Speech/Audio processors init warning:', err);
  }

  // 3. Concurrently load character model and initialize NLP sign matcher dictionary
  try {
    signMatcher = new SignMatcher();
    signSyncController.signMatcher = signMatcher;
    meaningNormalizer.setSignMatcher(signMatcher);
    await Promise.all([
      loadCharacter(),
      signMatcher.init().then(() => {
        signSyncController.signMatcher = signMatcher;
        meaningNormalizer.setSignMatcher(signMatcher);
        if (signMatcher.sentences) {
          renderLibrary(signMatcher.sentences);
        }
      })
    ]);
  } catch (err) {
    console.error('Startup asset loading error:', err);
  }

  // 4. If curriculum signer container is already active or mounted, ensure rendering
  if (currentMode === 'curriculum' && curriculumContainer) {
    mountCurriculumSigner(curriculumContainer);
  }

  // 5. Trigger first sign automatically only in screen mode
  if (currentMode === 'screen' && signMatcher && signMatcher.sentences && signMatcher.sentences.length > 0) {
    playSequence([{
      type: 'phrase',
      label: signMatcher.sentences[0].sentence,
      gloss: signMatcher.sentences[0].gloss,
      sample: signMatcher.sentences[0]
    }]);
  }

  // 6. Initialize Two-Way Sign ↔ Speech Communication Hub
  try {
    initRtcTwoWayCommunication();
  } catch (err) {
    console.warn('Failed to initialize Two-Way Communication Hub:', err);
  }
}

// Proper disposal during Vite HMR to prevent WebGL context exhaustion
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  });
}

start();
