const { app, ipcMain } = require('electron');
const path = require('path');
const { createMainWindowController } = require('./main/windows');
const { createFloatingController } = require('./main/floating');
const { createTrayController } = require('./main/tray');
const { createHotkeysController } = require('./main/hotkeys');
const notifications = require('./main/notifications');
const { registerIpc } = require('./main/ipc');
const { createAiSettingsStore } = require('./main/ai/settings-store');
const { createAiService } = require('./main/ai/ai-service');

let isQuitting = false;

app.setAppUserModelId('com.vibecode.rest-reminder');

const iconPath = path.join(__dirname, 'assets', 'icon.ico');
const preloadPath = path.join(__dirname, 'preload.js');

const windows = createMainWindowController({
  positionFile: path.join(app.getPath('userData'), 'window-position.json'),
  iconPath,
  preloadPath,
  indexFile: path.join(__dirname, 'index.html'),
  shouldQuit: () => isQuitting,
});

function quitApp() {
  isQuitting = true;
  app.quit();
}

function sendTimerAction(action) {
  windows.sendToMain('tray-action', action);
}

const floating = createFloatingController({
  positionFile: path.join(app.getPath('userData'), 'floating-position.json'),
  iconPath,
  preloadPath,
  floatingFile: path.join(__dirname, 'floating.html'),
  restoreMainWindow: windows.showMainWindow,
  getMainWindow: windows.getMainWindow,
  requestTimerState: () => windows.sendToMain('request-timer-state'),
  sendTimerAction,
  quitApp,
});

const tray = createTrayController({
  iconPath,
  restoreMainWindow: windows.showMainWindow,
  sendTimerAction,
  quitApp,
});

const aiSettings = createAiSettingsStore(path.join(app.getPath('userData'), 'ai-settings.json'));
const ai = createAiService(aiSettings);

const hotkeys = createHotkeysController({
  sendToMain: windows.sendToMain,
});

registerIpc({
  ipcMain,
  app,
  windows,
  floating,
  tray,
  notifications,
  hotkeys,
  ai,
  aiSettings,
  setQuitting: (value) => { isQuitting = value; },
});

app.whenReady().then(() => {
  windows.createMainWindow();
  tray.createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!windows.getMainWindow()) windows.createMainWindow();
});
