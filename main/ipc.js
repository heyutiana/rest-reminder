function registerIpc(deps) {
  const { ipcMain, app, windows, floating, tray, notifications, hotkeys, ai, aiSettings, setQuitting } = deps;

  ipcMain.on('update-tray-status', (_, status) => {
    if (typeof status !== 'string' || status.length > 50) return;
    tray.updateTrayMenu(status);
  });

  ipcMain.on('show-notification', (_, data) => {
    if (!data || typeof data.title !== 'string' || typeof data.body !== 'string') return;
    if (data.title.length > 100 || data.body.length > 500) return;
    notifications.showNotification(data.title, data.body);
  });

  ipcMain.on('minimize-to-tray', windows.hideMainWindow);
  ipcMain.on('window-minimize', windows.minimizeMainWindow);

  ipcMain.handle('get-autostart', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.on('set-autostart', (_, enabled) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath });
  });

  ipcMain.on('toggle-mini-mode', (_, showFloating) => {
    if (typeof showFloating !== 'boolean') return;
    if (showFloating) {
      floating.createFloatingWindow();
      windows.hideMainWindow();
    } else {
      floating.destroyFloatingWindow();
      windows.showMainWindow();
    }
  });

  ipcMain.on('floating-update', (_, data) => {
    if (!data || typeof data !== 'object') return;
    if (typeof data.timerState !== 'string' || data.timerState.length > 20) return;
    floating.sendToFloating(data);
  });
  ipcMain.on('floating-ready', floating.requestStateFromMain);
  ipcMain.on('floating-restore', () => {
    floating.destroyFloatingWindow();
    windows.showMainWindow();
  });
  ipcMain.on('floating-pause', () => windows.sendToMain('tray-action', 'pause'));
  ipcMain.on('floating-skip', () => windows.sendToMain('tray-action', 'skip'));
  ipcMain.on('floating-quit', () => {
    setQuitting(true);
    app.quit();
  });
  ipcMain.on('floating-show-menu', floating.showMenu);

  ipcMain.handle('hotkey-register', () => hotkeys.register());
  ipcMain.handle('hotkey-unregister', () => { hotkeys.unregister(); });
  ipcMain.handle('hotkey-is-registered', () => hotkeys.isRegistered());
  ipcMain.on('floating-start-drag', (_, point) => {
    if (!point || typeof point.screenX !== 'number' || typeof point.screenY !== 'number') return;
    if (!Number.isFinite(point.screenX) || !Number.isFinite(point.screenY)) return;
    floating.startDrag(point);
  });
  ipcMain.on('floating-drag-move', (_, point) => {
    if (!point || typeof point.screenX !== 'number' || typeof point.screenY !== 'number') return;
    if (!Number.isFinite(point.screenX) || !Number.isFinite(point.screenY)) return;
    floating.dragMove(point);
  });

  ipcMain.handle('ai-get-settings', () => aiSettings.getPublicSettings());
  ipcMain.handle('ai-save-settings', (_, settings) => {
    if (!settings || typeof settings !== 'object') return aiSettings.getPublicSettings();
    return aiSettings.saveSettings(settings);
  });
  ipcMain.handle('ai-test-connection', () => ai.testConnection());
  ipcMain.handle('ai-test-connection-with', (_, settings) => {
    if (!settings || typeof settings !== 'object') throw new Error('AI_SETTINGS_INVALID');
    if (typeof settings.baseUrl === 'string' && settings.baseUrl.length > 500) throw new Error('AI_SETTINGS_INVALID');
    if (typeof settings.model === 'string' && settings.model.length > 100) throw new Error('AI_SETTINGS_INVALID');
    if (typeof settings.apiKey === 'string' && settings.apiKey.length > 1000) throw new Error('AI_SETTINGS_INVALID');
    return ai.testConnectionWith(settings);
  });
  ipcMain.handle('ai-breakdown-goal', (_, goal) => {
    if (typeof goal === 'string' && goal.length > 500) throw new Error('GOAL_INVALID');
    if (goal && typeof goal === 'object' && typeof goal.goal === 'string' && goal.goal.length > 500) throw new Error('GOAL_INVALID');
    return ai.breakdownGoal(goal);
  });
  ipcMain.handle('ai-daily-plan', (_, context) => {
    if (context && typeof context === 'object' && JSON.stringify(context).length > 5000) throw new Error('CONTEXT_TOO_LARGE');
    return ai.dailyPlan(context);
  });
  ipcMain.handle('ai-daily-review', (_, context) => {
    if (context && typeof context === 'object' && JSON.stringify(context).length > 5000) throw new Error('CONTEXT_TOO_LARGE');
    return ai.dailyReview(context);
  });
  ipcMain.handle('ai-rest-suggestion', (_, context) => {
    if (context && typeof context === 'object' && JSON.stringify(context).length > 5000) throw new Error('CONTEXT_TOO_LARGE');
    return ai.restSuggestion(context);
  });
  ipcMain.handle('ai-weekly-report', (_, context) => {
    if (context && typeof context === 'object' && JSON.stringify(context).length > 10000) throw new Error('CONTEXT_TOO_LARGE');
    return ai.weeklyReport(context);
  });
}

module.exports = { registerIpc };
