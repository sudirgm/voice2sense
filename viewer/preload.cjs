const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getState: () => ipcRenderer.invoke('avatar:getState'),
  setAlwaysOnTop: (pin) => ipcRenderer.invoke('avatar:setAlwaysOnTop', pin),
  createAvatar: () => ipcRenderer.invoke('avatar:create'),
  showAvatar: () => ipcRenderer.invoke('avatar:show'),
  hideAvatar: () => ipcRenderer.invoke('avatar:hide'),
  closeAvatar: () => ipcRenderer.invoke('avatar:close'),
  setContent: (data) => ipcRenderer.send('avatar:setContent', data),
  syncSign: (signData) => ipcRenderer.send('avatar:sync-sign', signData),
  syncControl: (ctrlData) => ipcRenderer.send('avatar:sync-control', ctrlData),
  onStateChanged: (callback) => {
    const handler = (event, state) => callback(state);
    ipcRenderer.on('avatar:state-changed', handler);
    return () => ipcRenderer.removeListener('avatar:state-changed', handler);
  },
  onContentUpdated: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('avatar:content-updated', handler);
    return () => ipcRenderer.removeListener('avatar:content-updated', handler);
  },
  onSyncSign: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('avatar:sync-sign', handler);
    return () => ipcRenderer.removeListener('avatar:sync-sign', handler);
  },
  onSyncControl: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('avatar:sync-control', handler);
    return () => ipcRenderer.removeListener('avatar:sync-control', handler);
  }
});
