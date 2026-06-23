const { BrowserWindow, Menu, screen } = require('electron');
const { loadPosition, isPositionOnScreen, clampWindowPosition, savePositionDebounced } = require('./positions');

const FLOATING_SIZE = 72;
const ALLOWED_STATES = new Set(['idle', 'running', 'paused', 'break-ready', 'break', 'break-paused', 'snoozed']);

function createFloatingController(deps) {
  let floatingWindow = null;
  let positionSaveTimer = null;
  let dragStart = null;
  let lastState = { timerState: 'idle', remainingSeconds: 0, totalSeconds: 0, phaseEndsAt: 0, updatedAt: 0 };

  function normalizeState(data) {
    if (!data || typeof data !== 'object') return lastState;
    return {
      timerState: ALLOWED_STATES.has(data.timerState) ? data.timerState : lastState.timerState,
      remainingSeconds: Number.isFinite(data.remainingSeconds) && data.remainingSeconds >= 0 ? data.remainingSeconds : lastState.remainingSeconds,
      totalSeconds: Number.isFinite(data.totalSeconds) && data.totalSeconds >= 0 ? data.totalSeconds : lastState.totalSeconds,
      phaseEndsAt: Number.isFinite(data.phaseEndsAt) && data.phaseEndsAt >= 0 ? data.phaseEndsAt : lastState.phaseEndsAt,
      updatedAt: Number.isFinite(data.updatedAt) && data.updatedAt >= 0 ? data.updatedAt : Date.now(),
    };
  }

  function getDisplayForMainWindow() {
    try {
      var main = deps.getMainWindow && deps.getMainWindow();
      if (main && !main.isDestroyed()) {
        var pos = main.getPosition();
        var display = screen.getDisplayNearestPoint({ x: pos[0], y: pos[1] });
        if (display) return display.workArea;
      }
    } catch (e) {}
    return screen.getPrimaryDisplay().workArea;
  }

  function createFloatingWindow() {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.show();
      sendToFloating(lastState);
      return floatingWindow;
    }

    const saved = loadPosition(deps.positionFile);
    const area = getDisplayForMainWindow();
    const options = {
      width: FLOATING_SIZE,
      height: FLOATING_SIZE,
      x: area.x + area.width - FLOATING_SIZE - 24,
      y: area.y + area.height - FLOATING_SIZE - 24,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      icon: deps.iconPath,
      webPreferences: {
        preload: deps.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    };

    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number' && isPositionOnScreen(saved.x, saved.y)) {
      options.x = saved.x;
      options.y = saved.y;
    }

    floatingWindow = new BrowserWindow(options);
    floatingWindow.loadFile(deps.floatingFile);
    floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    floatingWindow.on('closed', () => { floatingWindow = null; });
    floatingWindow.on('move', () => {
      positionSaveTimer = savePositionDebounced(floatingWindow, deps.positionFile, positionSaveTimer);
    });
    return floatingWindow;
  }

  function destroyFloatingWindow() {
    if (floatingWindow && !floatingWindow.isDestroyed()) floatingWindow.close();
  }

  function sendToFloating(data) {
    lastState = normalizeState(data);
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('floating-update', lastState);
    }
  }

  function requestStateFromMain() {
    sendToFloating(lastState);
    deps.requestTimerState();
  }

  function showMenu() {
    if (!floatingWindow || floatingWindow.isDestroyed()) return;
    const isPaused = lastState.timerState === 'paused' || lastState.timerState === 'break-paused';
    Menu.buildFromTemplate([
      { label: '打开主窗口', click: () => { destroyFloatingWindow(); deps.restoreMainWindow(); } },
      { label: isPaused ? '继续' : '暂停', click: () => deps.sendTimerAction('pause') },
      { label: '跳过当前', click: () => deps.sendTimerAction('skip') },
      { type: 'separator' },
      { label: '退出', click: deps.quitApp },
    ]).popup({ window: floatingWindow });
  }

  function startDrag(point) {
    if (!floatingWindow || floatingWindow.isDestroyed()) return;
    if (!point || typeof point.screenX !== 'number' || typeof point.screenY !== 'number') return;
    const [x, y] = floatingWindow.getPosition();
    dragStart = { x, y, screenX: point.screenX, screenY: point.screenY };
  }

  function dragMove(point) {
    if (!floatingWindow || floatingWindow.isDestroyed() || !dragStart) return;
    if (!point || typeof point.screenX !== 'number' || typeof point.screenY !== 'number') return;
    const dx = point.screenX - dragStart.screenX;
    const dy = point.screenY - dragStart.screenY;
    if (Math.abs(dx) <= 3 && Math.abs(dy) <= 3) return;
    const pos = clampWindowPosition(dragStart.x + dx, dragStart.y + dy, FLOATING_SIZE, FLOATING_SIZE);
    floatingWindow.setPosition(pos.x, pos.y);
  }

  return {
    createFloatingWindow,
    destroyFloatingWindow,
    sendToFloating,
    requestStateFromMain,
    showMenu,
    startDrag,
    dragMove,
  };
}

module.exports = { createFloatingController };
