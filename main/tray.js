const { Tray, Menu, nativeImage } = require('electron');

function createTrayController(deps) {
  let tray = null;

  function updateTrayMenu(status) {
    if (!tray) return;
    const contextMenu = Menu.buildFromTemplate([
      { label: `状态: ${status}`, enabled: false },
      { type: 'separator' },
      { label: '显示窗口', click: deps.restoreMainWindow },
      { label: '暂停', click: () => deps.sendTimerAction('pause') },
      { label: '继续', click: () => deps.sendTimerAction('resume') },
      { label: '跳过当前', click: () => deps.sendTimerAction('skip') },
      { type: 'separator' },
      { label: '退出', click: deps.quitApp },
    ]);
    tray.setToolTip(`休息提醒助手 - ${status}`);
    tray.setContextMenu(contextMenu);
  }

  function createTray() {
    tray = new Tray(nativeImage.createFromPath(deps.iconPath));
    updateTrayMenu('准备开始');
    tray.on('double-click', deps.restoreMainWindow);
    return tray;
  }

  return { createTray, updateTrayMenu };
}

module.exports = { createTrayController };
