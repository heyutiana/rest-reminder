const { BrowserWindow } = require('electron');
const { loadPosition, isPositionOnScreen, savePositionDebounced } = require('./positions');

function createMainWindowController(deps) {
  let mainWindow = null;
  let positionSaveTimer = null;

  function notifyWindowVisible() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('window-visible');
  }

  function createMainWindow() {
    const saved = loadPosition(deps.positionFile);
    const options = {
      width: 420,
      height: 580,
      minWidth: 360,
      minHeight: 480,
      resizable: true,
      frame: false,
      transparent: false,
      backgroundColor: '#0f0f1a',
      icon: deps.iconPath,
      webPreferences: {
        preload: deps.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        spellcheck: false,
      },
    };

    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number' && isPositionOnScreen(saved.x, saved.y)) {
      options.x = saved.x;
      options.y = saved.y;
    }

    mainWindow = new BrowserWindow(options);
    mainWindow.loadFile(deps.indexFile);

    mainWindow.on('close', (event) => {
      if (!deps.shouldQuit()) {
        event.preventDefault();
        mainWindow.hide();
      }
    });

    mainWindow.on('closed', () => { mainWindow = null; });
    mainWindow.on('move', () => {
      positionSaveTimer = savePositionDebounced(mainWindow, deps.positionFile, positionSaveTimer);
    });
    mainWindow.on('show', notifyWindowVisible);
    mainWindow.on('focus', notifyWindowVisible);
    mainWindow.on('restore', notifyWindowVisible);

    return mainWindow;
  }

  function getMainWindow() {
    return mainWindow;
  }

  function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
    notifyWindowVisible();
  }

  function hideMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  }

  function minimizeMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  }

  function sendToMain(channel, payload) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  }

  return {
    createMainWindow,
    getMainWindow,
    showMainWindow,
    hideMainWindow,
    minimizeMainWindow,
    notifyWindowVisible,
    sendToMain,
  };
}

module.exports = { createMainWindowController };
