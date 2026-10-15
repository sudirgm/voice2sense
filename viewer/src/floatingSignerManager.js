// ============================================================
// Floating Signer Manager & Window Platform Abstraction
// Voice 2 Sense | Tab 1: Real-Time Communication
// ============================================================

export class FloatingSignerManager {
  constructor(options = {}) {
    this.options = Object.assign({
      widgetElement: null,
      canvasContainer: null,
      onResize: null,
      onSpeedChange: null,
      onReplay: null,
      onPauseToggle: null
    }, options);

    this.widget = this.options.widgetElement || (typeof document !== 'undefined' ? document.getElementById('floating-avatar-widget') : null);
    this.canvasContainer = this.options.canvasContainer || (typeof document !== 'undefined' ? document.getElementById('corner-canvas-container') : null);

    this.isMinimized = false;
    this.isExpanded = false;
    this.isAlwaysOnTop = false; // Authoritative Always On Top pin state
    this.isClosed = false;
    this.isPipActive = false;
    this.pipWindow = null;

    // Runtime platform detection
    this.isElectron = !!(typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron);
    this.isNativePipMode = typeof window !== 'undefined' && window.location.search.includes('pip=native');

    // Dimensions & Positioning
    this.currentWidth = 380;
    this.currentHeight = 500;
    this.normalWidth = 380;
    this.normalHeight = 500;
    this.preMinimWidth = 380;
    this.preMinimHeight = 500;
    this.currentLeft = null;
    this.currentTop = null;

    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      origLeft: 0,
      origTop: 0
    };

    this.resizeState = {
      isResizing: false,
      startX: 0,
      startY: 0,
      origWidth: 0,
      origHeight: 0
    };

    this._initDOM();
    this._setupDrag();
    this._setupResize();
    this._bindControls();
    this._setupWindowResize();
    this._setupElectronSync();
  }

  _initDOM() {
    if (this.isNativePipMode) {
      document.documentElement.classList.add('native-pip-mode');
      document.body.classList.add('native-pip-mode');
      this.isAlwaysOnTop = true;
    }

    if (!this.widget) return;

    const rect = this.widget.getBoundingClientRect();
    this.currentWidth = rect.width || 380;
    this.currentHeight = rect.height || 500;
    this.normalWidth = this.currentWidth;
    this.normalHeight = this.currentHeight;
  }

  /**
   * Pointer-based dragging anchored to the browser viewport.
   * Clamps the panel so it can NEVER be dragged completely off-screen.
   */
  _setupDrag() {
    if (this.isNativePipMode) return; // Handled natively by Windows OS via -webkit-app-region: drag
    const handle = this.widget?.querySelector('.widget-header');
    if (!handle || !this.widget) return;

    const onPointerDown = (e) => {
      // Don't drag if clicking interactive header controls or buttons
      if (e.target.closest('.widget-controls') || e.target.closest('button') || e.target.closest('input')) {
        return;
      }
      
      // If currently minimized, clicking the header bar restores the panel
      if (this.isMinimized) {
        this.restore();
        return;
      }

      e.preventDefault();
      const rect = this.widget.getBoundingClientRect();

      this.dragState.isDragging = true;
      this.dragState.startX = e.clientX;
      this.dragState.startY = e.clientY;
      this.dragState.origLeft = rect.left;
      this.dragState.origTop = rect.top;

      this.widget.classList.add('is-dragging');

      try {
        handle.setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback
      }

      const onPointerMove = (moveEvt) => {
        if (!this.dragState.isDragging) return;
        const dx = moveEvt.clientX - this.dragState.startX;
        const dy = moveEvt.clientY - this.dragState.startY;
        this._applyMove(dx, dy);
      };

      const onPointerUp = (upEvt) => {
        if (!this.dragState.isDragging) return;
        this.dragState.isDragging = false;
        this.widget.classList.remove('is-dragging');

        try {
          handle.releasePointerCapture(upEvt.pointerId);
        } catch (err) {
          // Fallback
        }

        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);

        this._notifyResize();
      };

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
    };

    handle.addEventListener('pointerdown', onPointerDown);
  }

  _applyMove(dx, dy) {
    if (!this.widget) return;

    const minMargin = 8;
    const maxLeft = Math.max(minMargin, window.innerWidth - this.widget.offsetWidth - minMargin);
    const maxTop = Math.max(minMargin, window.innerHeight - this.widget.offsetHeight - minMargin);

    let newLeft = Math.max(minMargin, Math.min(this.dragState.origLeft + dx, maxLeft));
    let newTop = Math.max(minMargin, Math.min(this.dragState.origTop + dy, maxTop));

    this.currentLeft = newLeft;
    this.currentTop = newTop;

    this.widget.style.left = `${newLeft}px`;
    this.widget.style.top = `${newTop}px`;
    this.widget.style.right = 'auto';
    this.widget.style.bottom = 'auto';
  }

  /**
   * Controlled interactive corner resizing.
   */
  _setupResize() {
    if (!this.widget) return;

    let resizeHandle = this.widget.querySelector('.widget-resize-grip');
    if (!resizeHandle) {
      resizeHandle = document.createElement('div');
      resizeHandle.className = 'widget-resize-grip';
      resizeHandle.title = 'Drag to resize signer window';
      resizeHandle.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <circle cx="8" cy="8" r="1.2"/>
          <circle cx="8" cy="4" r="1.2"/>
          <circle cx="4" cy="8" r="1.2"/>
        </svg>
      `;
      this.widget.appendChild(resizeHandle);
    }

    const onPointerDown = (e) => {
      if (this.isMinimized) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = this.widget.getBoundingClientRect();
      this.resizeState.isResizing = true;
      this.resizeState.startX = e.clientX;
      this.resizeState.startY = e.clientY;
      this.resizeState.origWidth = rect.width;
      this.resizeState.origHeight = rect.height;

      // If user resizes while expanded, gracefully exit expanded mode
      if (this.isExpanded) {
        this.isExpanded = false;
        this.widget.classList.remove('is-expanded');
        this._updateExpandIcon();
      }

      this.widget.classList.add('is-resizing');

      try {
        resizeHandle.setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback
      }

      const onPointerMove = (moveEvt) => {
        if (!this.resizeState.isResizing) return;
        const dw = moveEvt.clientX - this.resizeState.startX;
        const dh = moveEvt.clientY - this.resizeState.startY;
        this._applyResize(dw, dh);
      };

      const onPointerUp = (upEvt) => {
        if (!this.resizeState.isResizing) return;
        this.resizeState.isResizing = false;
        this.widget.classList.remove('is-resizing');

        try {
          resizeHandle.releasePointerCapture(upEvt.pointerId);
        } catch (err) {
          // Fallback
        }

        resizeHandle.removeEventListener('pointermove', onPointerMove);
        resizeHandle.removeEventListener('pointerup', onPointerUp);
        resizeHandle.removeEventListener('pointercancel', onPointerUp);

        this.normalWidth = this.currentWidth;
        this.normalHeight = this.currentHeight;
        this._notifyResize();
      };

      resizeHandle.addEventListener('pointermove', onPointerMove);
      resizeHandle.addEventListener('pointerup', onPointerUp);
      resizeHandle.addEventListener('pointercancel', onPointerUp);
    };

    resizeHandle.addEventListener('pointerdown', onPointerDown);
  }

  _applyResize(dw, dh) {
    if (!this.widget || this.isMinimized) return;

    const minW = 280;
    const maxW = Math.min(720, window.innerWidth - 32);
    const minH = 360;
    const maxH = Math.min(840, window.innerHeight - 32);

    const newW = Math.max(minW, Math.min(this.resizeState.origWidth + dw, maxW));
    const newH = Math.max(minH, Math.min(this.resizeState.origHeight + dh, maxH));

    this.currentWidth = newW;
    this.currentHeight = newH;

    this.widget.style.width = `${newW}px`;
    this.widget.style.height = `${newH}px`;

    this._notifyResize();
  }

  _setupWindowResize() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.clampToViewport();
        if (this.options.onResize) {
          this.options.onResize(this.currentWidth, this.currentHeight);
        }
      });
    }
  }

  /**
   * Ensures the panel never falls outside the visible viewport when window shrinks.
   */
  clampToViewport() {
    if (!this.widget || this.currentLeft === null || this.currentTop === null) return;

    const minMargin = 8;
    const maxLeft = Math.max(minMargin, window.innerWidth - this.widget.offsetWidth - minMargin);
    const maxTop = Math.max(minMargin, window.innerHeight - this.widget.offsetHeight - minMargin);

    const clampedLeft = Math.max(minMargin, Math.min(this.currentLeft, maxLeft));
    const clampedTop = Math.max(minMargin, Math.min(this.currentTop, maxTop));

    if (clampedLeft !== this.currentLeft || clampedTop !== this.currentTop) {
      this.currentLeft = clampedLeft;
      this.currentTop = clampedTop;
      this.widget.style.left = `${clampedLeft}px`;
      this.widget.style.top = `${clampedTop}px`;
      this.widget.style.right = 'auto';
      this.widget.style.bottom = 'auto';
    }
  }

  _bindControls() {
    if (!this.widget) return;

    // Expand / Contract button
    const btnExpand = this.widget.querySelector('#btn-size-toggle');
    btnExpand?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleExpand();
    });

    // Minimize / Restore button
    const btnMin = this.widget.querySelector('#btn-widget-minimize');
    btnMin?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });

    // Close button (Hides panel without destroying state)
    const btnClose = this.widget.querySelector('#btn-widget-close');
    btnClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Always On Top Pin button
    const btnPin = this.widget.querySelector('#btn-widget-pin') || this.widget.querySelector('#btn-toggle-pin');
    btnPin?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAlwaysOnTop();
    });

    // Picture-in-Picture Popout button (if present)
    const btnPip = this.widget.querySelector('#btn-toggle-pip');
    btnPip?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.requestDocumentPiP();
    });

    // Replay button
    const btnReplay = this.widget.querySelector('#btn-widget-replay');
    btnReplay?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onReplay) this.options.onReplay();
    });

    // Pause / Resume button
    const btnPause = this.widget.querySelector('#btn-widget-pause');
    btnPause?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onPauseToggle) this.options.onPauseToggle();
    });
  }

  show() {
    if (this.widget) {
      this.isClosed = false;
      this.widget.style.display = 'flex';
      this.clampToViewport();
      this._notifyResize();
    }
  }

  hide() {
    if (this.widget) {
      this.widget.style.display = 'none';
    }
  }

  close() {
    this.isClosed = true;
    if (this.isNativePipMode) {
      if (window.electronAPI && window.electronAPI.closeAvatar) {
        window.electronAPI.closeAvatar();
      } else {
        window.close();
      }
      return;
    }
    this.hide();
  }

  /**
   * Reopens panel and resets to default sensible bottom-right position.
   */
  reopenAndRecenter() {
    if (!this.widget) return;
    this.isClosed = false;
    this.widget.style.display = 'flex';

    if (this.isMinimized) {
      this.restore();
    }
    if (this.isExpanded) {
      this.contract();
    }

    // Restore sensible bottom-right floating default
    this.widget.style.left = 'auto';
    this.widget.style.top = 'auto';
    this.widget.style.right = '24px';
    this.widget.style.bottom = '24px';
    this.currentLeft = null;
    this.currentTop = null;

    this._notifyResize();
  }

  toggle() {
    if (!this.widget) return;
    if (this.widget.style.display === 'none' || this.isClosed) {
      this.show();
    } else {
      this.close();
    }
  }

  /**
   * Minimize the panel to a compact floating bar.
   * State (3D avatar, current sign animation, translation queue) is strictly preserved.
   */
  minimize() {
    if (!this.widget || this.isMinimized) return;
    this.preMinimWidth = this.currentWidth || 380;
    this.preMinimHeight = this.currentHeight || 500;
    this.isMinimized = true;
    this.widget.classList.add('minimized');

    const minBtn = this.widget.querySelector('#btn-widget-minimize');
    const minIcon = this.widget.querySelector('#widget-min-icon');
    if (minIcon) {
      minIcon.innerHTML = '<polyline points="4 14 12 6 20 14"/>'; // Restore chevron
    }
    if (minBtn) {
      minBtn.setAttribute('title', 'Restore Interpreter Window');
      minBtn.setAttribute('aria-label', 'Restore Window');
    }
  }

  /**
   * Restore the minimized panel back to its full view.
   */
  restore() {
    if (!this.widget || !this.isMinimized) return;
    this.isMinimized = false;
    this.widget.classList.remove('minimized');

    const minBtn = this.widget.querySelector('#btn-widget-minimize');
    const minIcon = this.widget.querySelector('#widget-min-icon');
    if (minIcon) {
      minIcon.innerHTML = '<line x1="5" y1="12" x2="19" y2="12"/>'; // Minimize minus
    }
    if (minBtn) {
      minBtn.setAttribute('title', 'Minimize Interpreter Window');
      minBtn.setAttribute('aria-label', 'Minimize Window');
    }

    if (!this.isExpanded) {
      this.widget.style.width = `${this.preMinimWidth || this.normalWidth || 380}px`;
      this.widget.style.height = `${this.preMinimHeight || this.normalHeight || 500}px`;
    }

    this.clampToViewport();
    this._notifyResize();
  }

  toggleMinimize() {
    if (this.isMinimized) {
      this.restore();
    } else {
      this.minimize();
    }
  }

  /**
   * Expands the panel to large viewing mode without stretching the 3D avatar.
   */
  expand() {
    if (!this.widget || this.isExpanded) return;
    if (this.isMinimized) this.restore();

    this.normalWidth = this.currentWidth || 380;
    this.normalHeight = this.currentHeight || 500;
    this.isExpanded = true;
    this.widget.classList.add('is-expanded');

    const expW = Math.min(560, window.innerWidth - 32);
    const expH = Math.min(680, window.innerHeight - 32);
    this.currentWidth = expW;
    this.currentHeight = expH;
    this.widget.style.width = `${expW}px`;
    this.widget.style.height = `${expH}px`;

    this._updateExpandIcon();
    this.clampToViewport();
    this._notifyResize();
  }

  /**
   * Contracts the panel from expanded mode back to normal size.
   */
  contract() {
    if (!this.widget || !this.isExpanded) return;
    this.isExpanded = false;
    this.widget.classList.remove('is-expanded');

    const normW = this.normalWidth || 380;
    const normH = this.normalHeight || 500;
    this.currentWidth = normW;
    this.currentHeight = normH;
    this.widget.style.width = `${normW}px`;
    this.widget.style.height = `${normH}px`;

    this._updateExpandIcon();
    this.clampToViewport();
    this._notifyResize();
  }

  toggleExpand() {
    if (this.isExpanded) {
      this.contract();
    } else {
      this.expand();
    }
  }

  _updateExpandIcon() {
    const sizeBtn = this.widget.querySelector('#btn-size-toggle');
    const sizeIcon = this.widget.querySelector('#widget-size-icon');
    if (!sizeBtn || !sizeIcon) return;

    if (this.isExpanded) {
      sizeIcon.innerHTML = `
        <polyline points="4 14 10 14 10 20"/>
        <polyline points="20 10 14 10 14 4"/>
        <line x1="14" y1="10" x2="21" y2="3"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
      `;
      sizeBtn.setAttribute('title', 'Contract to Normal Size');
      sizeBtn.setAttribute('aria-label', 'Contract Window');
    } else {
      sizeIcon.innerHTML = `
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
      `;
      sizeBtn.setAttribute('title', 'Expand Interpreter Window');
      sizeBtn.setAttribute('aria-label', 'Expand Window');
    }
  }

  /**
   * Authoritative Native Always On Top Pin Implementation.
   * In Electron: Toggles native Windows always-on-top floating window above all desktop apps.
   * In Web Browser: Displays clear notification that desktop app is required.
   */
  setAlwaysOnTop(enabled, notifyIpc = false) {
    this.isAlwaysOnTop = !!enabled;
    if (!this.widget) return;

    const btnPin = this.widget.querySelector('#btn-widget-pin') || this.widget.querySelector('#btn-toggle-pin');

    if (this.isAlwaysOnTop) {
      this.widget.classList.add('pinned-top');
      btnPin?.classList.add('active');
      btnPin?.classList.add('pinned-active');
      btnPin?.setAttribute('title', 'Always on Top: Pinned (Native Windows Floating Window). Click to Unpin.');
      btnPin?.setAttribute('aria-label', 'Always on Top: Pinned');

      const pinSvg = btnPin?.querySelector('svg');
      if (pinSvg) {
        pinSvg.style.color = '#38bdf8';
        pinSvg.style.filter = 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))';
      }
    } else {
      this.widget.classList.remove('pinned-top');
      btnPin?.classList.remove('active');
      btnPin?.classList.remove('pinned-active');
      if (this.isElectron) {
        btnPin?.setAttribute('title', 'Always on Top: Pin above all Windows applications (Native Floating Window)');
      } else {
        btnPin?.setAttribute('title', 'Native Always-On-Top (Requires Desktop App: run npm run electron)');
      }
      btnPin?.setAttribute('aria-label', 'Always on Top: Unpinned');

      const pinSvg = btnPin?.querySelector('svg');
      if (pinSvg) {
        pinSvg.style.color = '';
        pinSvg.style.filter = '';
      }
    }

    // Persist pin preference in localStorage
    try {
      localStorage.setItem('voice2sense_pin_state', this.isAlwaysOnTop ? '1' : '0');
    } catch (e) {}

    // Dispatch state update to Electron main process if requested
    if (notifyIpc && this.isElectron && window.electronAPI && typeof window.electronAPI.setAlwaysOnTop === 'function') {
      window.electronAPI.setAlwaysOnTop(this.isAlwaysOnTop).catch((err) => {
        console.error('[FloatingSignerManager] IPC setAlwaysOnTop error:', err);
      });
    }
  }

  async toggleAlwaysOnTop() {
    if (this.isElectron) {
      const nextPin = !this.isAlwaysOnTop;
      this.setAlwaysOnTop(nextPin, true);
    } else {
      // In web app: Picture-in-Picture mode provides the OS-level Always-on-Top floating signer window!
      await this.togglePictureInPicture();
    }
  }

  async togglePictureInPicture() {
    if (this.isPipActive) {
      this.exitPictureInPicture();
    } else {
      await this.requestPictureInPicture();
    }
  }

  exitPictureInPicture() {
    if (this.pipWindow) {
      try {
        this.pipWindow.close();
      } catch {}
      this.pipWindow = null;
    }
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      try {
        document.exitPictureInPicture();
      } catch {}
    }
    this._exitDocumentPiP();
  }

  async requestPictureInPicture() {
    // 1. Try Document Picture-in-Picture API (Chrome 116+, Edge 116+)
    if ('documentPictureInPicture' in window) {
      try {
        await this.requestDocumentPiP();
        return;
      } catch (err) {
        console.warn('[FloatingSignerManager] Document PiP attempt failed, falling back to Video Canvas PiP:', err);
      }
    }

    // 2. Fallback to HTML5 Canvas Video Stream Picture-in-Picture (works across modern browsers)
    await this.requestCanvasVideoPiP();
  }

  _exitDocumentPiP() {
    this.isPipActive = false;
    this.pipWindow = null;

    if (this.widget) {
      this.widget.classList.remove('in-pip-window');
      this.widget.style.position = 'fixed';
      this.widget.style.width = `${this.currentWidth}px`;
      this.widget.style.height = `${this.currentHeight}px`;
      this.widget.style.maxWidth = '';
      this.widget.style.maxHeight = '';
      this.widget.style.border = '';
      this.widget.style.borderRadius = '';

      if (this.currentLeft !== null && this.currentTop !== null) {
        this.widget.style.left = `${this.currentLeft}px`;
        this.widget.style.top = `${this.currentTop}px`;
        this.widget.style.right = 'auto';
        this.widget.style.bottom = 'auto';
      } else {
        this.widget.style.left = '';
        this.widget.style.top = '';
        this.widget.style.right = '24px';
        this.widget.style.bottom = '84px';
      }

      if (this.originalParent) {
        if (this.originalNextSibling && this.originalNextSibling.parentElement === this.originalParent) {
          this.originalParent.insertBefore(this.widget, this.originalNextSibling);
        } else {
          this.originalParent.appendChild(this.widget);
        }
      } else {
        const parent = document.getElementById('screen-stage') || document.getElementById('view-realtime-comm') || document.body;
        parent.appendChild(this.widget);
      }
    }

    this.setAlwaysOnTop(false, false);
    this._notifyResize();
  }

  /**
   * Browser development mode notice if neither PiP nor Electron is supported.
   */
  showDesktopAppRequiredNotice() {
    const message = "Picture-in-Picture / Always-on-Top requires browser permission or the Voice2Sense Desktop App ('npm run electron').";
    if (typeof window.showToast === 'function') {
      window.showToast(message, 'info', 6000);
    } else {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = message;
        toast.className = 'toast show';
        setTimeout(() => { toast.className = 'toast'; }, 6000);
      } else {
        alert(message);
      }
    }
  }

  /**
   * IPC synchronization with Electron main process.
   */
  _setupElectronSync() {
    if (!this.isElectron) {
      // Normal browser mode: explain PiP always-on-top ability
      const btnPin = this.widget?.querySelector('#btn-widget-pin') || this.widget?.querySelector('#btn-toggle-pin');
      if (btnPin) {
        btnPin.setAttribute('title', 'Always on Top: Pin Signer in Picture-in-Picture mode above Windows');
        btnPin.setAttribute('aria-label', 'Always on Top (Picture-in-Picture)');
      }
      return;
    }

    // 1. Fetch initial authoritative state from Electron main process
    if (window.electronAPI.getState) {
      window.electronAPI.getState().then((nativeState) => {
        if (nativeState && typeof nativeState.isPinned === 'boolean') {
          this.setAlwaysOnTop(nativeState.isPinned, false);
        }
      }).catch((err) => {
        console.warn('[FloatingSignerManager] getState error:', err);
      });
    }

    // 2. Listen for state change broadcasts from Electron (pinned/unpinned/closed)
    if (window.electronAPI.onStateChanged) {
      window.electronAPI.onStateChanged((nativeState) => {
        if (nativeState && typeof nativeState.isPinned === 'boolean') {
          this.setAlwaysOnTop(nativeState.isPinned, false);
        }
      });
    }
  }

  /**
   * Document Picture-in-Picture API (Chrome 116+, Edge 116+)
   * Opens OS-level Always-On-Top window with full HTML layout, Three.js 3D avatar & subtitle controls.
   */
  async requestDocumentPiP() {
    if (!('documentPictureInPicture' in window)) {
      throw new Error('documentPictureInPicture not supported');
    }

    if (this.isPipActive && this.pipWindow) {
      this.exitPictureInPicture();
      return;
    }

    if (window.documentPictureInPicture.window) {
      try {
        window.documentPictureInPicture.window.close();
      } catch {}
    }

    const pipWidth = Math.max(340, Math.min(640, Math.round(this.currentWidth || 380)));
    const pipHeight = Math.max(440, Math.min(840, Math.round(this.currentHeight || 500)));

    this.pipWindow = await window.documentPictureInPicture.requestWindow({
      width: pipWidth,
      height: pipHeight
    });

    // Copy fonts and stylesheets to the PiP window
    document.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]').forEach(link => {
      this.pipWindow.document.head.appendChild(link.cloneNode(true));
    });

    [...document.styleSheets].forEach((styleSheet) => {
      try {
        const cssRules = [...styleSheet.cssRules].map((r) => r.cssText).join('');
        const style = document.createElement('style');
        style.textContent = cssRules;
        this.pipWindow.document.head.appendChild(style);
      } catch {
        if (styleSheet.href) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = styleSheet.href;
          this.pipWindow.document.head.appendChild(link);
        }
      }
    });

    // PiP body styling
    this.pipWindow.document.body.style.margin = '0';
    this.pipWindow.document.body.style.padding = '0';
    this.pipWindow.document.body.style.background = '#0a0c10';
    this.pipWindow.document.body.style.color = '#f1f5f9';
    this.pipWindow.document.body.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    this.pipWindow.document.body.style.overflow = 'hidden';
    this.pipWindow.document.body.style.display = 'flex';
    this.pipWindow.document.body.style.flexDirection = 'column';
    this.pipWindow.document.body.style.width = '100vw';
    this.pipWindow.document.body.style.height = '100vh';

    // Retain original DOM position
    this.originalParent = this.widget.parentElement;
    this.originalNextSibling = this.widget.nextSibling;

    // Reposition widget into PiP
    this.widget.classList.add('in-pip-window');
    this.widget.style.position = 'relative';
    this.widget.style.left = '0';
    this.widget.style.top = '0';
    this.widget.style.right = 'auto';
    this.widget.style.bottom = 'auto';
    this.widget.style.width = '100%';
    this.widget.style.height = '100%';
    this.widget.style.maxWidth = '100%';
    this.widget.style.maxHeight = '100%';
    this.widget.style.border = 'none';
    this.widget.style.borderRadius = '0';

    this.pipWindow.document.body.appendChild(this.widget);
    this.isPipActive = true;
    this.setAlwaysOnTop(true, false);

    this.pipWindow.addEventListener('pagehide', () => {
      this._exitDocumentPiP();
    });

    this.pipWindow.addEventListener('resize', () => {
      this._notifyResize();
    });

    this._notifyResize();
    if (typeof window.showToast === 'function') {
      window.showToast('Picture-in-Picture active! Signer is floating Always-on-Top on Windows.');
    }
  }

  /**
   * HTML5 Canvas Video Stream Picture-in-Picture Fallback
   * Streams Three.js canvas to native OS Video PiP window floating Always-on-Top.
   */
  async requestCanvasVideoPiP() {
    const canvas = this.canvasContainer?.querySelector('canvas') || document.querySelector('#corner-canvas-container canvas');
    if (!canvas || typeof canvas.captureStream !== 'function') {
      this.showDesktopAppRequiredNotice();
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        this.isPipActive = false;
        this.setAlwaysOnTop(false, false);
        return;
      }

      let pipVideo = document.getElementById('signer-pip-video-stream');
      if (!pipVideo) {
        pipVideo = document.createElement('video');
        pipVideo.id = 'signer-pip-video-stream';
        pipVideo.muted = true;
        pipVideo.autoplay = true;
        pipVideo.playsInline = true;
        pipVideo.style.position = 'fixed';
        pipVideo.style.pointerEvents = 'none';
        pipVideo.style.opacity = '0.0001';
        pipVideo.style.width = '1px';
        pipVideo.style.height = '1px';
        pipVideo.style.bottom = '0';
        pipVideo.style.right = '0';
        document.body.appendChild(pipVideo);
      }

      const stream = canvas.captureStream(30);
      pipVideo.srcObject = stream;
      await pipVideo.play();
      await pipVideo.requestPictureInPicture();

      this.isPipActive = true;
      this.setAlwaysOnTop(true, false);

      pipVideo.addEventListener('leavepictureinpicture', () => {
        this.isPipActive = false;
        this.setAlwaysOnTop(false, false);
        try {
          pipVideo.srcObject = null;
        } catch {}
      }, { once: true });

      if (typeof window.showToast === 'function') {
        window.showToast('Picture-in-Picture active! Signer is floating Always-on-Top on Windows.');
      }
    } catch (err) {
      console.warn('[FloatingSignerManager] Canvas Video PiP error:', err);
      this.showDesktopAppRequiredNotice();
    }
  }

  updateSignStatus(phrase, gloss, status = 'SIGNING', languageName = null, languageFlag = null) {
    if (!this.widget) return;

    const phraseElem = this.widget.querySelector('#widget-phrase-text');
    const glossElem = this.widget.querySelector('#widget-sign-tag');
    const statusDot = this.widget.querySelector('#widget-status-dot');
    let langBadge = this.widget.querySelector('#widget-lang-badge');

    if (phraseElem && phrase !== undefined) {
      phraseElem.textContent = phrase ? `"${phrase}"` : 'Standing by for speech...';
    }
    if (glossElem && gloss !== undefined) {
      glossElem.textContent = gloss || 'READY';
    }

    // Multilingual Language Detection Badge (Point 23 & Rule 3)
    if (languageName) {
      if (!langBadge) {
        langBadge = document.createElement('span');
        langBadge.id = 'widget-lang-badge';
        langBadge.className = 'widget-lang-pill';
        const phraseStrip = this.widget.querySelector('.widget-phrase-strip');
        if (phraseStrip) {
          phraseStrip.insertBefore(langBadge, phraseStrip.firstChild);
        }
      }
      if (langBadge) {
        langBadge.textContent = `${languageFlag || '🇮🇳'} ${languageName} detected`;
        langBadge.classList.remove('hidden');
      }
    }

    if (statusDot) {
      statusDot.className = 'pulse-mini';
      if (status === 'TRANSLATING' || status === 'SIGNING') {
        statusDot.classList.add('live');
      } else if (status === 'LISTENING') {
        statusDot.classList.add('listening');
      } else if (status === 'PAUSED') {
        statusDot.classList.add('paused');
      } else if (status === 'LIMITATION') {
        statusDot.classList.add('paused');
      }
    }
  }

  _notifyResize() {
    if (this.options.onResize) {
      this.options.onResize(this.currentWidth, this.currentHeight);
    }
    if (!this._isDispatchingResize) {
      this._isDispatchingResize = true;
      try {
        window.dispatchEvent(new Event('resize'));
      } finally {
        this._isDispatchingResize = false;
      }
    }
  }
}
