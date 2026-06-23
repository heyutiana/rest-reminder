window.RestReminder.floatingSync = (function () {
  var ns = window.RestReminder;
  var s = ns.state;
  var lastPublishedAt = 0;

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function getRemainingSeconds(now) {
    if (s.phaseEndsAt && isFiniteNumber(s.phaseEndsAt)) {
      return Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000));
    }
    return Math.max(0, Math.ceil(s.remainingSeconds || 0));
  }

  function getSnapshot() {
    var now = Date.now();
    return {
      timerState: s.timerState,
      remainingSeconds: getRemainingSeconds(now),
      totalSeconds: Math.max(0, Math.ceil(s.totalSeconds || 0)),
      phaseEndsAt: s.phaseEndsAt || 0,
      updatedAt: now,
    };
  }

  function publish(force) {
    if (!window.electronAPI || !window.electronAPI.sendFloatingUpdate) return;
    var now = Date.now();
    if (!force && now - lastPublishedAt < 500) return;
    lastPublishedAt = now;
    window.electronAPI.sendFloatingUpdate(getSnapshot());
  }

  return {
    getSnapshot: getSnapshot,
    publish: publish,
  };
})();
