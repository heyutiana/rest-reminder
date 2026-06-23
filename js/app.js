window.RestReminder.app = (function () {
  var ns = window.RestReminder;
  var s = ns.state;
  var storage = ns.storage;

  var timerMinutes, timerSeconds, timerProgress, statusBadge, statusText;
  var btnStart, btnPause, btnSkip, btnReset, cycleIndicator;
  var statFocus, statCycles, statBreaks;
  var pageTimer, pageTodo, pageStats, pageAi, pageSettings, pageBreak;

  function $ (sel) { return document.querySelector(sel); }
  function $$ (sel) { return document.querySelectorAll(sel); }

  function sendStateToFloating() {
    if (ns.floatingSync) ns.floatingSync.publish(true);
  }

  var darkQuery = null;
  function resolveTheme(theme) {
    if (theme === 'light' || theme === 'dark') return theme;
    try {
      darkQuery = darkQuery || window.matchMedia('(prefers-color-scheme: dark)');
      return darkQuery.matches ? 'dark' : 'light';
    } catch (e) {
      return 'dark';
    }
  }

  function applyTheme(theme) {
    var resolved = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', resolved);
  }

  function initThemeWatcher() {
    applyTheme(s.settings.theme || 'system');
    try {
      darkQuery = darkQuery || window.matchMedia('(prefers-color-scheme: dark)');
      darkQuery.addEventListener('change', function () {
        if (s.settings.theme === 'system' || !s.settings.theme) applyTheme('system');
      });
    } catch (e) {}
  }

  var lastDisplayedSeconds = -1;
  function updateDisplay(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    if (seconds === lastDisplayedSeconds) return;
    lastDisplayedSeconds = seconds;
    var m = Math.floor(seconds / 60);
    var sec = seconds % 60;
    timerMinutes.textContent = String(m).padStart(2, '0');
    timerSeconds.textContent = String(sec).padStart(2, '0');
  }

  function updateProgress() {
    if (s.totalSeconds === 0) return;
    var progress;
    if (s.phaseEndsAt && s.phaseDurationMs > 0 && (s.timerState === 'running' || s.timerState === 'break' || s.timerState === 'snoozed')) {
      var remainingMs = Math.max(0, s.phaseEndsAt - Date.now());
      progress = 1 - remainingMs / s.phaseDurationMs;
    } else {
      var remaining = Math.max(0, s.remainingSeconds);
      progress = 1 - remaining / s.totalSeconds;
    }
    progress = Math.min(1, Math.max(0, progress));
    var offset = ns.CIRCUMFERENCE * (1 - progress);
    timerProgress.style.strokeDasharray = ns.CIRCUMFERENCE;
    timerProgress.style.strokeDashoffset = offset;
  }

  function updateStats() {
    statFocus.textContent = Math.floor(s.stats.focusSeconds / 60);
    statCycles.textContent = s.stats.completedCycles;
    statBreaks.textContent = s.stats.breakCount;
    if (ns.stats && ns.stats.renderStatsPage) ns.stats.renderStatsPage();
  }

  function renderCycleDots() {
    var count = s.settings.longBreakInterval;
    cycleIndicator.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var dot = document.createElement('div');
      dot.className = 'cycle-dot';
      if (i < s.currentCycle) dot.classList.add('done');
      if (i === s.currentCycle && s.timerState === 'running') dot.classList.add('active');
      cycleIndicator.appendChild(dot);
    }
  }

  function setStatus(text, isBreak) {
    statusText.textContent = text;
    statusBadge.className = 'status-badge' + (isBreak ? ' break' : '');
    timerProgress.className.baseVal = 'timer-ring-progress' + (isBreak ? ' break' : '');
  }

  function showPage(name) {
    pageTimer.classList.toggle('active', name === 'timer');
    pageTodo.classList.toggle('active', name === 'todo');
    pageStats.classList.toggle('active', name === 'stats');
    pageAi.classList.toggle('active', name === 'ai');
    pageSettings.classList.toggle('active', name === 'settings');
    pageBreak.classList.toggle('active', name === 'break');
  }

  function showTimerControls(running) {
    if (running) {
      btnStart.classList.add('is-hidden');
      btnPause.classList.remove('is-hidden');
      btnPause.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="1" width="4" height="14" rx="1"/><rect x="10" y="1" width="4" height="14" rx="1"/></svg> 暂停';
    } else {
      btnStart.classList.remove('is-hidden');
      btnPause.classList.add('is-hidden');
    }
  }

  function setPauseButtonToPlay() {
    btnPause.querySelector('svg').outerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><polygon points="3,1 13,8 3,15"/></svg>';
    btnPause.lastChild.textContent = ' 继续';
  }

  function setPauseButtonToPause() {
    btnPause.querySelector('svg').outerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="1" width="4" height="14" rx="1"/><rect x="10" y="1" width="4" height="14" rx="1"/></svg>';
    btnPause.lastChild.textContent = ' 暂停';
  }

  var audioCtx = null;
  function getAudioContext() {
    if (audioCtx) return audioCtx;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function playSound() {
    if (!s.settings.soundEnabled) return;
    try {
      var ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      var notes = [523.25, 659.25, 783.99];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.4);
      });
    } catch (e) {}
  }

  function syncSettingsUI() {
    $('#input-work').value = s.settings.workMinutes;
    $('#input-break').value = s.settings.breakMinutes;
    $('#input-long-break').value = s.settings.longBreakMinutes;
    $('#input-long-interval').value = s.settings.longBreakInterval;
    $('#toggle-sound').checked = s.settings.soundEnabled;
    $('#input-daily-goal').value = s.settings.dailyGoalMinutes;
    var snoozeEl = $('#input-snooze');
    if (snoozeEl) snoozeEl.value = s.settings.snoozeMinutes || 5;
    var themeEl = $('#select-theme');
    if (themeEl) themeEl.value = s.settings.theme || 'system';
  }

  function readSettingsFromUI() {
    s.settings.workMinutes = ns.clamp(parseInt($('#input-work').value) || 25, 1, 120);
    s.settings.breakMinutes = ns.clamp(parseInt($('#input-break').value) || 5, 1, 30);
    s.settings.longBreakMinutes = ns.clamp(parseInt($('#input-long-break').value) || 15, 5, 60);
    s.settings.longBreakInterval = ns.clamp(parseInt($('#input-long-interval').value) || 4, 2, 10);
    s.settings.soundEnabled = $('#toggle-sound').checked;
    s.settings.dailyGoalMinutes = ns.clamp(parseInt($('#input-daily-goal').value) || 120, 10, 600);
    var snoozeEl = $('#input-snooze');
    if (snoozeEl) s.settings.snoozeMinutes = ns.clamp(parseInt(snoozeEl.value) || 5, 1, 30);
    var themeEl = $('#select-theme');
    if (themeEl) s.settings.theme = themeEl.value;
  }

  function applyPreset(preset) {
    s.settings.workMinutes = preset.work;
    s.settings.breakMinutes = preset.brk;
    s.settings.longBreakMinutes = preset.longBrk;
    s.settings.longBreakInterval = preset.interval;
    storage.saveSettings();
    syncSettingsUI();
    if (s.timerState === 'idle') {
      s.remainingSeconds = s.settings.workMinutes * 60;
      s.totalSeconds = s.remainingSeconds;
      updateDisplay(s.remainingSeconds);
      updateProgress();
    }
    renderCycleDots();
  }

  ns.checkDayReset = function () {
    var today = new Date().toDateString();
    if (s.stats.date !== today) {
      storage.archiveDay(s.stats.date, s.stats, s.todos);
      s.stats = { ...ns.DEFAULT_STATS, date: today };
      s.currentCycle = 0;
      s.todos = [];
      s.currentTodoId = null;
      storage.saveStats();
      storage.saveTodos();
      updateStats();
      renderCycleDots();
      if (ns.todos) {
        ns.todos.renderTodos();
        ns.todos.updateCurrentTodoDisplay();
      }
    }
  };

  function init() {
    timerMinutes = $('#timer-minutes');
    timerSeconds = $('#timer-seconds');
    timerProgress = $('#timer-progress');
    statusBadge = $('#status-badge');
    statusText = $('#status-text');
    btnStart = $('#btn-start');
    btnPause = $('#btn-pause');
    btnSkip = $('#btn-skip');
    btnReset = $('#btn-reset');
    cycleIndicator = $('#cycle-indicator');
    statFocus = $('#stat-focus');
    statCycles = $('#stat-cycles');
    statBreaks = $('#stat-breaks');
    pageTimer = $('#page-timer');
    pageTodo = $('#page-todo');
    pageStats = $('#page-stats');
    pageAi = $('#page-ai');
    pageSettings = $('#page-settings');
    pageBreak = $('#page-break');

    storage.loadSettings();
    storage.loadHistory();
    storage.archiveStaleSavedData();
    storage.loadStats();
    storage.loadTodos();
    syncSettingsUI();
    initThemeWatcher();
    updateStats();
    if (ns.todos) {
      ns.todos.renderTodos();
      ns.todos.updateCurrentTodoDisplay();
    }
    if (ns.stats) ns.stats.renderStatsPage();
    if (ns.aiAssistant) ns.aiAssistant.init();

    var timerRestored = ns.timer && ns.timer.restoreSavedTimer && ns.timer.restoreSavedTimer();
    if (!timerRestored) {
      s.remainingSeconds = s.settings.workMinutes * 60;
      s.totalSeconds = s.remainingSeconds;
      updateDisplay(s.remainingSeconds);
      timerProgress.style.strokeDasharray = ns.CIRCUMFERENCE;
      timerProgress.style.strokeDashoffset = ns.CIRCUMFERENCE;
      renderCycleDots();
    }

    $('#btn-minimize').addEventListener('click', function () { window.electronAPI.windowMinimize(); });
    $('#btn-mini-mode').addEventListener('click', function () {
      sendStateToFloating();
      window.electronAPI.toggleMiniMode(true);
    });
    $('#btn-tray').addEventListener('click', function () { window.electronAPI.minimizeToTray(); });
    $('#btn-close').addEventListener('click', function () { window.electronAPI.minimizeToTray(); });

    if (window.electronAPI.onRequestTimerState) {
      window.electronAPI.onRequestTimerState(function () {
        sendStateToFloating();
      });
    }

    btnStart.addEventListener('click', ns.timer.startWorkTimer);
    btnPause.addEventListener('click', ns.timer.pauseTimer);
    btnSkip.addEventListener('click', ns.timer.skipTimer);
    btnReset.addEventListener('click', ns.timer.resetTimer);

    $('#btn-start-break').addEventListener('click', function () {
      ns.timer.startBreakTimer();
    });
    $('#btn-snooze').addEventListener('click', ns.timer.snoozeBreak);
    $('#btn-skip-break').addEventListener('click', function () { ns.timer.finishBreak({ countBreak: false, notify: false }); });

    $$('.nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var page = btn.dataset.page;
        showPage(page);
        $$('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (page === 'settings') syncSettingsUI();
        if (page === 'todo' && ns.todos) ns.todos.renderTodos();
        if (page === 'stats' && ns.stats) ns.stats.renderStatsPage();
      });
    });

    $('#btn-add-todo').addEventListener('click', function () {
      var input = $('#todo-input');
      if (ns.todos) ns.todos.addTodo(input.value);
      input.value = '';
      input.focus();
    });

    $('#todo-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var input = $('#todo-input');
        if (ns.todos) ns.todos.addTodo(input.value);
        input.value = '';
      }
    });

    $('#btn-clear-done').addEventListener('click', function () { if (ns.todos) ns.todos.clearDoneTodos(); });
    $('#btn-clear-all').addEventListener('click', function () { if (ns.todos) ns.todos.clearAllTodos(); });
    $('#btn-clear-history').addEventListener('click', function () { if (ns.stats) ns.stats.clearHistory(); });

    $$('.step-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.dataset.target);
        var delta = parseInt(btn.dataset.delta);
        var newVal = ns.clamp((parseInt(input.value) || 0) + delta, parseInt(input.min), parseInt(input.max));
        input.value = newVal;
      });
    });

    var themeSelect = $('#select-theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', function () {
        applyTheme(themeSelect.value);
      });
    }

    $('#btn-save-settings').addEventListener('click', function () {
      readSettingsFromUI();
      storage.saveSettings();
      renderCycleDots();
      if (s.timerState === 'idle') {
        s.remainingSeconds = s.settings.workMinutes * 60;
        s.totalSeconds = s.remainingSeconds;
        updateDisplay(s.remainingSeconds);
        updateProgress();
      }
      showPage('timer');
      $$('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
      $('#nav-timer').classList.add('active');
    });

    $('#btn-reset-settings').addEventListener('click', function () {
      s.settings = { ...ns.DEFAULT_SETTINGS };
      storage.saveSettings();
      syncSettingsUI();
    });

    $('#btn-reset-stats').addEventListener('click', function () {
      var confirmFn = ns.todos && ns.todos.showConfirm;
      var doReset = function () {
        s.stats.focusSeconds = 0;
        s.stats.completedCycles = 0;
        s.stats.breakCount = 0;
        s.stats.taskFocus = {};
        s.currentCycle = 0;
        if (storage.flushStats) storage.flushStats(); else storage.saveStats();
        updateStats();
        renderCycleDots();
      };
      if (confirmFn) {
        confirmFn('确定要清空今天的统计数据吗？\n专注时间、完成周期、休息次数将全部归零。', '重置', function (ok) { if (ok) doReset(); });
      } else {
        doReset();
      }
    });

    $$('.preset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.preset);
        if (ns.PRESETS[idx]) applyPreset(ns.PRESETS[idx]);
      });
    });

    $('#btn-export-stats').addEventListener('click', function () { if (ns.stats) ns.stats.exportStats(); });

    $('#btn-export-backup').addEventListener('click', function () { if (ns.stats) ns.stats.exportBackup(); });
    var importFileInput = $('#import-backup-file');
    if (importFileInput) {
      importFileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var statusEl = $('#backup-status');
        if (ns.stats && ns.stats.importBackup) {
          ns.stats.importBackup(file, function (ok, msg) {
            if (statusEl) statusEl.textContent = msg;
            applyTheme(s.settings.theme || 'system');
          });
        }
        importFileInput.value = '';
      });
    }
    $('#btn-import-backup').addEventListener('click', function () {
      if (importFileInput) importFileInput.click();
    });

    $('#toggle-autostart').addEventListener('change', function (e) {
      window.electronAPI.setAutoStart(e.target.checked);
    });
    window.electronAPI.getAutoStart().then(function (enabled) {
      $('#toggle-autostart').checked = enabled;
    });

    $('#toggle-hotkeys').addEventListener('change', function (e) {
      if (e.target.checked) {
        window.electronAPI.hotkeyRegister().then(function (ok) {
          localStorage.setItem('rest-reminder-hotkeys', ok ? '1' : '0');
          if (!ok) {
            e.target.checked = false;
            if (window.electronAPI.showNotification) {
              window.electronAPI.showNotification('热键注册失败', '快捷键可能被其他软件占用，请检查后重试。');
            }
          }
        });
      } else {
        localStorage.setItem('rest-reminder-hotkeys', '0');
        window.electronAPI.hotkeyUnregister();
      }
    });
    var hotkeyEnabled = localStorage.getItem('rest-reminder-hotkeys') !== '0';
    $('#toggle-hotkeys').checked = hotkeyEnabled;
    if (hotkeyEnabled) {
      window.electronAPI.hotkeyRegister().then(function (ok) {
        if (!ok) {
          $('#toggle-hotkeys').checked = false;
          localStorage.setItem('rest-reminder-hotkeys', '0');
        }
      });
    }

    clearInterval(s.dayResetIntervalId);
    s.dayResetIntervalId = setInterval(ns.checkDayReset, 60 * 1000);

    window.electronAPI.onTrayAction(function (action) {
      if (action === 'pause') ns.timer.pauseTimer();
      if (action === 'resume' && (s.timerState === 'paused' || s.timerState === 'break-paused')) ns.timer.pauseTimer();
      if (action === 'skip') ns.timer.skipTimer();
    });

    if (window.electronAPI.onWindowVisible) {
      window.electronAPI.onWindowVisible(function () {
        ns.timer.syncNow();
      });
    }

    window.electronAPI.onHotkeyAction(function (action) {
      if (action === 'startPause') {
        if (s.timerState === 'running' || s.timerState === 'break') ns.timer.pauseTimer();
        else if (s.timerState === 'paused' || s.timerState === 'break-paused') ns.timer.pauseTimer();
        else if (s.timerState === 'idle') ns.timer.startWorkTimer();
        else if (s.timerState === 'break-ready') ns.timer.startBreakTimer();
      }
      if (action === 'skip') ns.timer.skipTimer();
    });
  }

  return {
    updateDisplay: updateDisplay,
    updateProgress: updateProgress,
    updateStats: updateStats,
    renderCycleDots: renderCycleDots,
    setStatus: setStatus,
    showPage: showPage,
    showTimerControls: showTimerControls,
    setPauseButtonToPlay: setPauseButtonToPlay,
    setPauseButtonToPause: setPauseButtonToPause,
    playSound: playSound,
    syncSettingsUI: syncSettingsUI,
    readSettingsFromUI: readSettingsFromUI,
    applyPreset: applyPreset,
    init: init,
  };
})();

document.addEventListener('DOMContentLoaded', window.RestReminder.app.init);
