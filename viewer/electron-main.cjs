// ============================================================
// Voice 2 Sense — Electron Native Main Process
// Native Windows Always-On-Top Avatar Signer Architecture
// ============================================================

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let avatarWindow = null;

// Authoritative Native State
const state = {
  isPinned: false,
  isOpen: false,
  position: { width: 380, height: 520, x: null, y: null },
  currentSign: null,
  status: 'READY'
};

function getAppUrl() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }
  // Default to running dev server or dist fallback
  return 'http://localhost:5173';
}

function broadcastState() {
  const payload = { ...state, isElectron: true };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('avatar:state-changed', payload);
  }
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    avatarWindow.webContents.send('avatar:state-changed', payload);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#06080d',
    title: 'Voice 2 Sense — Real-Time Communication & Learning',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const url = getAppUrl();
  mainWindow.loadURL(url).catch(() => {
    // If dev server is not running on 5173, load production build
    const distPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    }
  });

  mainWindow.on('close', (e) => {
    // If native avatar is pinned, keep it alive independently
    if (state.isPinned && avatarWindow && !avatarWindow.isDestroyed()) {
      mainWindow = null;
      // Do not quit app; avatar window remains active
    } else {
      mainWindow = null;
      if (avatarWindow && !avatarWindow.isDestroyed()) {
        avatarWindow.close();
      }
    }
  });
}

function createAvatarWindow() {
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    avatarWindow.show();
    if (state.isPinned) {
      avatarWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    state.isOpen = true;
    broadcastState();
    return avatarWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  const defaultW = state.position.width || 380;
  const defaultH = state.position.height || 520;
  const defaultX = state.position.x ?? (screenW - defaultW - 24);
  const defaultY = state.position.y ?? (screenH - defaultH - 24);

  avatarWindow = new BrowserWindow({
    width: defaultW,
    height: defaultH,
    x: defaultX,
    y: defaultY,
    minWidth: 280,
    minHeight: 360,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0c10',
    alwaysOnTop: state.isPinned,
    skipTaskbar: false,
    resizable: true,
    title: 'Voice 2 Sense — 3D Signer Interpreter',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (state.isPinned) {
    avatarWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  const base = getAppUrl();
  const pipUrl = `${base}/?pip=native`;
  avatarWindow.loadURL(pipUrl).catch(() => {
    const distPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(distPath)) {
      avatarWindow.loadFile(distPath, { query: { pip: 'native' } });
    }
  });

  avatarWindow.on('moved', () => {
    if (avatarWindow && !avatarWindow.isDestroyed()) {
      const bounds = avatarWindow.getBounds();
      state.position.x = bounds.x;
      state.position.y = bounds.y;
    }
  });

  avatarWindow.on('resized', () => {
    if (avatarWindow && !avatarWindow.isDestroyed()) {
      const bounds = avatarWindow.getBounds();
      state.position.width = bounds.width;
      state.position.height = bounds.height;
    }
  });

  avatarWindow.on('closed', () => {
    avatarWindow = null;
    state.isOpen = false;
    state.isPinned = false;
    broadcastState();

    // If main window was already closed, quit app
    if (!mainWindow || mainWindow.isDestroyed()) {
      app.quit();
    }
  });

  state.isOpen = true;
  broadcastState();
  return avatarWindow;
}

// IPC Channel Handlers
ipcMain.handle('avatar:getState', () => ({ ...state, isElectron: true }));

ipcMain.handle('avatar:setAlwaysOnTop', async (event, pin) => {
  state.isPinned = !!pin;

  if (state.isPinned) {
    if (!avatarWindow || avatarWindow.isDestroyed()) {
      createAvatarWindow();
    } else {
      avatarWindow.show();
      avatarWindow.setAlwaysOnTop(true, 'screen-saver');
      state.isOpen = true;
    }
  } else {
    // Turning PIN off: return to normal window / dock back
    if (avatarWindow && !avatarWindow.isDestroyed()) {
      avatarWindow.setAlwaysOnTop(false);
      avatarWindow.close();
    }
  }

  broadcastState();
  return { ...state, isElectron: true };
});

ipcMain.handle('avatar:create', () => {
  createAvatarWindow();
  return { ...state, isElectron: true };
});

ipcMain.handle('avatar:show', () => {
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    avatarWindow.show();
    state.isOpen = true;
    broadcastState();
  }
  return { ...state, isElectron: true };
});

ipcMain.handle('avatar:hide', () => {
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    avatarWindow.hide();
    state.isOpen = false;
    broadcastState();
  }
  return { ...state, isElectron: true };
});

ipcMain.handle('avatar:close', () => {
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    avatarWindow.close();
  }
  return { ...state, isElectron: true };
});

ipcMain.on('avatar:setContent', (event, content) => {
  state.currentSign = content;
  broadcastState();
});

ipcMain.on('avatar:sync-sign', (event, signData) => {
  state.currentSign = signData;
  if (avatarWindow && !avatarWindow.isDestroyed() && event.sender !== avatarWindow.webContents) {
    avatarWindow.webContents.send('avatar:sync-sign', signData);
  }
});

ipcMain.on('avatar:sync-control', (event, ctrlData) => {
  if (avatarWindow && !avatarWindow.isDestroyed() && event.sender !== avatarWindow.webContents) {
    avatarWindow.webContents.send('avatar:sync-control', ctrlData);
  }
  if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
    mainWindow.webContents.send('avatar:sync-control', ctrlData);
  }
});

// App Lifecycle
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
