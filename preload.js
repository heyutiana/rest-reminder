const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window control
  updateTrayStatus: (status) => ipcRenderer.send('update-tray-status', status),
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  onTrayAction: (callback) => ipcRenderer.on('tray-action', (_, action) => callback(action)),
  onWindowVisible: (callback) => ipcRenderer.on('window-visible', () => callback()),
  setAutoStart: (enabled) => ipcRenderer.send('set-autostart', enabled),
  getAutoStart: () => ipcRenderer.invoke('get-autostart'),

  // Mini mode / floating ball
  toggleMiniMode: (showFloating) => ipcRenderer.send('toggle-mini-mode', showFloating),
  sendFloatingUpdate: (data) => ipcRenderer.send('floating-update', data),
  onRequestTimerState: (callback) => ipcRenderer.on('request-timer-state', () => callback()),

  // Floating ball APIs (used by floating.html)
  onFloatingUpdate: (callback) => ipcRenderer.on('floating-update', (_, data) => callback(data)),
  floatingReady: () => ipcRenderer.send('floating-ready'),
  floatingRestore: () => ipcRenderer.send('floating-restore'),
  floatingPause: () => ipcRenderer.send('floating-pause'),
  floatingSkip: () => ipcRenderer.send('floating-skip'),
  floatingQuit: () => ipcRenderer.send('floating-quit'),
  floatingShowMenu: () => ipcRenderer.send('floating-show-menu'),
  floatingStartDrag: (screenX, screenY) => ipcRenderer.send('floating-start-drag', {
    screenX: Math.round(screenX),
    screenY: Math.round(screenY),
  }),
  floatingDragMove: (screenX, screenY) => ipcRenderer.send('floating-drag-move', {
    screenX: Math.round(screenX),
    screenY: Math.round(screenY),
  }),

  // Global hotkeys
  onHotkeyAction: (callback) => ipcRenderer.on('hotkey-action', (_, action) => callback(action)),
  hotkeyRegister: () => ipcRenderer.invoke('hotkey-register'),
  hotkeyUnregister: () => ipcRenderer.invoke('hotkey-unregister'),
  hotkeyIsRegistered: () => ipcRenderer.invoke('hotkey-is-registered'),

  // AI assistant
  aiGetSettings: () => ipcRenderer.invoke('ai-get-settings'),
  aiSaveSettings: (settings) => ipcRenderer.invoke('ai-save-settings', settings),
  aiTestConnection: () => ipcRenderer.invoke('ai-test-connection'),
  aiTestConnectionWith: (settings) => ipcRenderer.invoke('ai-test-connection-with', settings),
  aiBreakdownGoal: (goal) => ipcRenderer.invoke('ai-breakdown-goal', goal),
  aiDailyPlan: (context) => ipcRenderer.invoke('ai-daily-plan', context),
  aiDailyReview: (context) => ipcRenderer.invoke('ai-daily-review', context),
  aiRestSuggestion: (context) => ipcRenderer.invoke('ai-rest-suggestion', context),
  aiWeeklyReport: (context) => ipcRenderer.invoke('ai-weekly-report', context),
});
