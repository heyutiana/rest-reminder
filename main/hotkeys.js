const { globalShortcut } = require('electron');

const ACCELERATORS = {
  startPause: 'CommandOrControl+Shift+P',
  skip: 'CommandOrControl+Shift+S',
};

function createHotkeysController(deps) {
  let registered = false;
  let registeredKeys = [];

  function register() {
    if (registered) return true;
    registeredKeys = [];
    try {
      const ok1 = globalShortcut.register(ACCELERATORS.startPause, () => deps.sendToMain('hotkey-action', 'startPause'));
      if (ok1) registeredKeys.push(ACCELERATORS.startPause);
      const ok2 = globalShortcut.register(ACCELERATORS.skip, () => deps.sendToMain('hotkey-action', 'skip'));
      if (ok2) registeredKeys.push(ACCELERATORS.skip);
      registered = registeredKeys.length > 0;
      return registered;
    } catch (e) {
      registeredKeys.forEach(key => { try { globalShortcut.unregister(key); } catch (e2) {} });
      registeredKeys = [];
      return false;
    }
  }

  function unregister() {
    if (!registered) return;
    registeredKeys.forEach(key => { try { globalShortcut.unregister(key); } catch (e) {} });
    registeredKeys = [];
    registered = false;
  }

  function isRegistered() {
    return registered;
  }

  return { register, unregister, isRegistered };
}

module.exports = { createHotkeysController };
