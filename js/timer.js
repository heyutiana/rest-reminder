window.RestReminder.timer = (function () {
  var ns = window.RestReminder;
  var s = ns.state;
  var storage = ns.storage;

  function app() { return ns.app; }
  function todos() { return ns.todos; }

  function clearTimerInterval() {
    clearInterval(s.intervalId);
    s.intervalId = null;
  }

  function requestFrame(callback) {
    if (window.requestAnimationFrame) return window.requestAnimationFrame(callback);
    return setTimeout(function () { callback(Date.now()); }, 16);
  }

  function cancelFrame(id) {
    if (!id) return;
    if (window.cancelAnimationFrame) window.cancelAnimationFrame(id);
    else clearTimeout(id);
  }

  function stopVisualLoop() {
    cancelFrame(s.visualFrameId);
    s.visualFrameId = null;
  }

  function isActivePhase() {
    return s.timerState === 'running' || s.timerState === 'break' || s.timerState === 'snoozed';
  }

  function deriveRemainingSeconds(now) {
    if (!s.phaseEndsAt) return Math.max(0, s.remainingSeconds);
    return Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000));
  }

  function updateBreakDisplay(seconds) {
    var bm = document.getElementById('break-minutes');
    var bs = document.getElementById('break-seconds');
    if (bm) bm.textContent = String(Math.floor(seconds / 60)).padStart(2, '0');
    if (bs) bs.textContent = String(seconds % 60).padStart(2, '0');
  }

  function updateTimerView(now) {
    s.remainingSeconds = deriveRemainingSeconds(now || Date.now());
    if (s.timerState === 'break' || s.timerState === 'break-paused' || s.timerState === 'break-ready') {
      updateBreakDisplay(s.remainingSeconds);
    }
    app().updateDisplay(s.remainingSeconds);
    app().updateProgress();
  }

  function sendStateToFloating(force) {
    if (ns.floatingSync) ns.floatingSync.publish(force);
  }

  function persistTimerState() {
    if (storage.saveTimerState) storage.saveTimerState();
  }

  function startVisualLoop() {
    stopVisualLoop();
    function frame() {
      if (!isActivePhase()) {
        s.visualFrameId = null;
        return;
      }
      updateTimerView(Date.now());
      s.visualFrameId = requestFrame(frame);
    }
    s.visualFrameId = requestFrame(frame);
  }

  function syncFocusAccounting(now) {
    if (s.timerState !== 'running' || !s.lastAccountedAt) return false;
    var accountTo = Math.min(now, s.phaseEndsAt || now);
    var elapsedMs = Math.max(0, accountTo - s.lastAccountedAt);
    if (elapsedMs <= 0) return false;

    var totalMs = s.focusRemainderMs + elapsedMs;
    var wholeSeconds = Math.floor(totalMs / 1000);
    s.focusRemainderMs = totalMs % 1000;
    s.lastAccountedAt = accountTo;

    if (wholeSeconds > 0) {
      s.stats.focusSeconds += wholeSeconds;
      if (storage.saveStatsThrottled) storage.saveStatsThrottled(); else storage.saveStats();
      app().updateStats();
      return true;
    }
    return false;
  }

  function beginPhase(state, durationSeconds) {
    var now = Date.now();
    clearTimerInterval();
    s.timerState = state;
    s.totalSeconds = durationSeconds;
    s.remainingSeconds = durationSeconds;
    s.phaseStartedAt = now;
    s.phaseDurationMs = durationSeconds * 1000;
    s.phaseEndsAt = now + s.phaseDurationMs;
    s.lastAccountedAt = state === 'running' ? now : 0;
    s.focusRemainderMs = 0;
    s.pausedAt = 0;
    s.lastTickAt = now;
    updateTimerView(now);
    s.intervalId = setInterval(tick, 250);
    startVisualLoop();
    persistTimerState();
    sendStateToFloating(true);
  }

  function clearPhaseTiming() {
    s.phaseStartedAt = 0;
    s.phaseEndsAt = 0;
    s.phaseDurationMs = 0;
    s.lastAccountedAt = 0;
    s.focusRemainderMs = 0;
    s.pausedAt = 0;
    s.lastTickAt = 0;
  }

  function getStatusForState(state) {
    return {
      running: ['工作中', false, '工作中'],
      paused: ['已暂停', false, '已暂停'],
      'break-ready': ['等待休息', true, '等待休息'],
      break: ['休息中', true, '休息中'],
      'break-paused': ['休息暂停', true, '休息暂停'],
      snoozed: ['已推迟', false, '已推迟'],
    }[state] || ['准备开始', false, '准备开始'];
  }

  function restoreSavedTimer() {
    if (!storage.loadTimerState) return false;
    var saved = storage.loadTimerState();
    if (!saved) return false;
    Object.keys(saved).forEach(function (key) {
      if (key !== 'date') s[key] = saved[key];
    });

    var status = getStatusForState(s.timerState);
    app().setStatus(status[0], status[1]);
    window.electronAPI.updateTrayStatus(status[2]);
    if (s.timerState === 'break-ready' || s.timerState === 'break' || s.timerState === 'break-paused') {
      app().showPage('break');
      updateBreakDisplay(s.remainingSeconds);
    } else {
      app().showPage('timer');
    }
    app().showTimerControls(s.timerState === 'running' || s.timerState === 'paused');
    if (s.timerState === 'paused') app().setPauseButtonToPlay();
    if (s.timerState === 'running') app().setPauseButtonToPause();
    updateTimerView(Date.now());
    app().renderCycleDots();
    if (todos()) todos().updateCurrentTodoDisplay();
    if (isActivePhase()) {
      clearTimerInterval();
      s.intervalId = setInterval(tick, 250);
      startVisualLoop();
      syncActivePhase();
    }
    sendStateToFloating(true);
    return true;
  }

  function completeActivePhase() {
    clearTimerInterval();
    stopVisualLoop();
    sendStateToFloating(true);
    if (s.timerState === 'running') {
      onWorkComplete();
    } else if (s.timerState === 'break') {
      finishBreak({ countBreak: true, notify: true });
    } else if (s.timerState === 'snoozed') {
      triggerBreakReminder();
    }
  }

  function syncActivePhase() {
    if (!isActivePhase()) {
      ns.checkDayReset();
      return false;
    }
    var now = Date.now();
    syncFocusAccounting(now);
    s.remainingSeconds = deriveRemainingSeconds(now);
    ns.checkDayReset();
    if (now >= s.phaseEndsAt) {
      s.remainingSeconds = 0;
      updateTimerView(now);
      completeActivePhase();
      return true;
    }
    updateTimerView(now);
    sendStateToFloating(false);
    return false;
  }

  function startWorkTimer() {
    beginPhase('running', s.settings.workMinutes * 60);
    s.currentCycle = s.currentCycle % s.settings.longBreakInterval;
    app().renderCycleDots();
    app().setStatus('工作中', false);
    app().showTimerControls(true);

    window.electronAPI.updateTrayStatus('工作中');
    sendStateToFloating(true);
  }

  function tick() {
    syncActivePhase();
  }

  function syncNow() {
    syncActivePhase();
  }

  function onWorkComplete() {
    s.currentCycle++;
    s.stats.completedCycles++;
    todos().incrementCurrentTodoFocus();
    storage.saveStats();
    app().updateStats();
    app().renderCycleDots();

    app().playSound();
    window.electronAPI.showNotification('休息提醒', '工作时间结束，该休息一下了！');

    var isLongBreak = s.currentCycle >= s.settings.longBreakInterval;
    showBreakPage(isLongBreak);
  }

  function showBreakPage(isLong) {
    s.timerState = 'break-ready';
    var breakTime = isLong ? s.settings.longBreakMinutes : s.settings.breakMinutes;
    s.totalSeconds = breakTime * 60;
    s.remainingSeconds = s.totalSeconds;
    clearPhaseTiming();

    var breakTitle = document.getElementById('break-title');
    var breakSubtitle = document.getElementById('break-subtitle');
    var breakMinEl = document.getElementById('break-minutes');
    var breakSecEl = document.getElementById('break-seconds');
    if (breakTitle) breakTitle.textContent = isLong ? '长休息时间！' : '该休息了！';
    if (breakSubtitle) breakSubtitle.textContent = isLong ? '好好放松一下，起来走走' : '起来活动一下，看看远处';
    if (breakMinEl) breakMinEl.textContent = String(Math.floor(s.remainingSeconds / 60)).padStart(2, '0');
    if (breakSecEl) breakSecEl.textContent = String(s.remainingSeconds % 60).padStart(2, '0');
    var snoozeBtn = document.getElementById('btn-snooze');
    if (snoozeBtn) {
      var snoozeMin = ns.clamp(Number(s.settings.snoozeMinutes) || 5, 1, 30);
      snoozeBtn.textContent = '稍后提醒 (' + snoozeMin + '分钟)';
    }

    app().showPage('break');
    app().setStatus('等待休息', true);
    if (ns.aiAssistant && ns.aiAssistant.suggestRestForBreak) ns.aiAssistant.suggestRestForBreak();
    window.electronAPI.updateTrayStatus('等待休息');

    clearTimerInterval();
    stopVisualLoop();
    persistTimerState();
    sendStateToFloating(true);
  }

  function startBreakTimer() {
    if (s.timerState !== 'break-ready') return;
    beginPhase('break', s.remainingSeconds || s.totalSeconds);
    app().setStatus('休息中', true);
    window.electronAPI.updateTrayStatus('休息中');
  }

  function finishBreak(opts) {
    var countBreak = opts && opts.countBreak;
    var notify = opts && opts.notify;
    if (countBreak) s.stats.breakCount++;
    if (s.currentCycle >= s.settings.longBreakInterval) s.currentCycle = 0;
    storage.saveStats();
    app().updateStats();

    if (notify) {
      app().playSound();
      window.electronAPI.showNotification('休息结束', '休息结束，准备开始新的工作周期！');
    }

    app().showPage('timer');
    app().setStatus('准备开始', false);
    app().showTimerControls(false);
    app().updateDisplay(s.settings.workMinutes * 60);
    s.totalSeconds = s.settings.workMinutes * 60;
    s.remainingSeconds = s.totalSeconds;
    clearPhaseTiming();
    if (storage.clearTimerState) storage.clearTimerState();
    app().updateProgress();
    app().renderCycleDots();
    s.timerState = 'idle';

    window.electronAPI.updateTrayStatus('准备开始');
    sendStateToFloating(true);
  }

  function triggerBreakReminder() {
    app().playSound();
    window.electronAPI.showNotification('休息提醒', '稍后提醒时间到了，该休息了！');
    showBreakPage(s.currentCycle >= s.settings.longBreakInterval);
  }

  function flushPendingWrites() {
    if (storage.flushStats) storage.flushStats();
  }

  function pauseTimer() {
    if (s.timerState === 'running') {
      if (syncActivePhase()) return;
      flushPendingWrites();
      s.timerState = 'paused';
      s.pausedAt = Date.now();
      clearTimerInterval();
      stopVisualLoop();
      sendStateToFloating(true);
      app().setStatus('已暂停', false);
      app().setPauseButtonToPlay();
      persistTimerState();
      window.electronAPI.updateTrayStatus('已暂停');
    } else if (s.timerState === 'paused') {
      var now = Date.now();
      var pausedMs = Math.max(0, now - s.pausedAt);
      s.phaseStartedAt += pausedMs;
      s.phaseEndsAt += pausedMs;
      s.lastAccountedAt = now;
      s.pausedAt = 0;
      s.timerState = 'running';
      s.lastTickAt = now;
      clearTimerInterval();
      s.intervalId = setInterval(tick, 250);
      startVisualLoop();
      sendStateToFloating(true);
      app().setStatus('工作中', false);
      app().setPauseButtonToPause();
      persistTimerState();
      window.electronAPI.updateTrayStatus('工作中');
    } else if (s.timerState === 'break') {
      if (syncActivePhase()) return;
      flushPendingWrites();
      s.timerState = 'break-paused';
      s.pausedAt = Date.now();
      clearTimerInterval();
      stopVisualLoop();
      sendStateToFloating(true);
      app().setStatus('休息暂停', true);
      persistTimerState();
      window.electronAPI.updateTrayStatus('休息暂停');
    } else if (s.timerState === 'break-paused') {
      var nowBreak = Date.now();
      var breakPausedMs = Math.max(0, nowBreak - s.pausedAt);
      s.phaseStartedAt += breakPausedMs;
      s.phaseEndsAt += breakPausedMs;
      s.pausedAt = 0;
      s.timerState = 'break';
      s.lastTickAt = nowBreak;
      clearTimerInterval();
      s.intervalId = setInterval(tick, 250);
      startVisualLoop();
      sendStateToFloating(true);
      app().setStatus('休息中', true);
      persistTimerState();
      window.electronAPI.updateTrayStatus('休息中');
    }
  }

  function skipTimer() {
    if (isActivePhase() && syncActivePhase()) return;
    flushPendingWrites();
    clearTimerInterval();
    stopVisualLoop();
    if (s.timerState === 'running' || s.timerState === 'paused') {
      showBreakPage(false);
    } else if (s.timerState === 'break' || s.timerState === 'break-paused' || s.timerState === 'break-ready') {
      finishBreak({ countBreak: false, notify: false });
    }
  }

  function resetTimer() {
    clearTimerInterval();
    stopVisualLoop();
    s.timerState = 'idle';
    s.remainingSeconds = s.settings.workMinutes * 60;
    s.totalSeconds = s.remainingSeconds;
    clearPhaseTiming();
    if (storage.clearTimerState) storage.clearTimerState();
    app().updateDisplay(s.remainingSeconds);
    app().updateProgress();
    app().showTimerControls(false);
    app().setStatus('准备开始', false);
    app().renderCycleDots();
    sendStateToFloating(true);
    window.electronAPI.updateTrayStatus('准备开始');
  }

  function snoozeBreak() {
    if (s.timerState !== 'break-ready' && s.timerState !== 'break') return;
    var snoozeMin = ns.clamp(Number(s.settings.snoozeMinutes) || 5, 1, 30);
    beginPhase('snoozed', snoozeMin * 60);
    app().showPage('timer');
    app().setStatus('已推迟', false);
    window.electronAPI.updateTrayStatus('已推迟');
  }

  return {
    startWorkTimer: startWorkTimer,
    tick: tick,
    syncNow: syncNow,
    onWorkComplete: onWorkComplete,
    showBreakPage: showBreakPage,
    startBreakTimer: startBreakTimer,
    finishBreak: finishBreak,
    triggerBreakReminder: triggerBreakReminder,
    restoreSavedTimer: restoreSavedTimer,
    pauseTimer: pauseTimer,
    skipTimer: skipTimer,
    resetTimer: resetTimer,
    snoozeBreak: snoozeBreak,
  };
})();
