window.RestReminder.storage = (function () {
  const ns = window.RestReminder;
  const s = ns.state;

  function safeParse(str, fallback) {
    try {
      const obj = JSON.parse(str, (key, val) => key === '__proto__' ? undefined : val);
      if (obj && typeof obj === 'object') return Object.assign(Object.create(null), obj);
      return fallback;
    } catch {
      return fallback;
    }
  }

  function getDateKey(date) {
    date = date || new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function getDateKeyFromDateString(dateString) {
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? getDateKey() : getDateKey(date);
  }

  function loadSettings() {
    const saved = localStorage.getItem('rest-reminder-settings');
    if (saved) {
      const parsed = safeParse(saved, {});
      const allowed = ns.DEFAULT_SETTINGS;
      const clean = {};
      for (var key in allowed) {
        if (!Object.prototype.hasOwnProperty.call(allowed, key)) continue;
        clean[key] = Object.prototype.hasOwnProperty.call(parsed, key) ? parsed[key] : allowed[key];
      }
      s.settings = { ...allowed, ...clean };
    }
  }

  function saveSettings() {
    localStorage.setItem('rest-reminder-settings', JSON.stringify(s.settings));
  }

  function loadStats() {
    const saved = localStorage.getItem('rest-reminder-stats');
    if (saved) {
      const parsed = safeParse(saved, null);
      if (parsed && parsed.date === new Date().toDateString()) {
        const allowed = ns.DEFAULT_STATS;
        const clean = {};
        for (var key in allowed) {
          if (!Object.prototype.hasOwnProperty.call(allowed, key)) continue;
          clean[key] = Object.prototype.hasOwnProperty.call(parsed, key) ? parsed[key] : allowed[key];
        }
        if (typeof clean.taskFocus !== 'object' || clean.taskFocus === null) clean.taskFocus = {};
        s.stats = { ...allowed, ...clean };
      }
    }
  }

  function saveStats() {
    localStorage.setItem('rest-reminder-stats', JSON.stringify(s.stats));
  }

  var statsFlushTimer = null;
  function saveStatsThrottled() {
    if (statsFlushTimer) return;
    statsFlushTimer = setTimeout(function () {
      statsFlushTimer = null;
      saveStats();
    }, 1500);
  }

  function flushStats() {
    if (statsFlushTimer) {
      clearTimeout(statsFlushTimer);
      statsFlushTimer = null;
    }
    saveStats();
  }

  function loadHistory() {
    const saved = localStorage.getItem('rest-reminder-history');
    s.dailyHistory = sanitizeHistory(safeParse(saved, {}));
  }

  function saveHistory() {
    localStorage.setItem('rest-reminder-history', JSON.stringify(s.dailyHistory));
  }

  function getTodoChildren(todo) {
    return Array.isArray(todo && todo.children) ? todo.children : [];
  }

  function isTodoDone(todo) {
    var children = getTodoChildren(todo);
    return children.length > 0 ? children.every(isTodoDone) : !!(todo && todo.done);
  }

  function getTodoFocus(todo) {
    var total = Number(todo && todo.focusCycles) || 0;
    var children = getTodoChildren(todo);
    for (var i = 0; i < children.length; i++) total += getTodoFocus(children[i]);
    return total;
  }

  function sanitizeSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    var taskFocus = {};
    if (snapshot.taskFocus && typeof snapshot.taskFocus === 'object') {
      Object.keys(snapshot.taskFocus).slice(0, 200).forEach(function (key) {
        var value = Number(snapshot.taskFocus[key]);
        if (typeof key === 'string' && key && Number.isFinite(value) && value > 0) taskFocus[key.slice(0, 180)] = value;
      });
    }
    return {
      focusSeconds: Math.max(0, Number(snapshot.focusSeconds) || 0),
      completedCycles: Math.max(0, Number(snapshot.completedCycles) || 0),
      breakCount: Math.max(0, Number(snapshot.breakCount) || 0),
      todoDone: Math.max(0, Number(snapshot.todoDone) || 0),
      todoTotal: Math.max(0, Number(snapshot.todoTotal) || 0),
      taskFocus: taskFocus,
    };
  }

  function sanitizeHistory(history) {
    var clean = {};
    if (!history || typeof history !== 'object') return clean;
    Object.keys(history).slice(-120).forEach(function (key) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      var snapshot = sanitizeSnapshot(history[key]);
      if (snapshot) clean[key] = snapshot;
    });
    return clean;
  }

  function visitExecutableTodos(todos, callback) {
    var safeTodos = Array.isArray(todos) ? todos : [];
    for (var i = 0; i < safeTodos.length; i++) {
      var todo = safeTodos[i];
      var children = getTodoChildren(todo);
      if (children.length === 0) {
        callback(todo, null);
      } else {
        for (var j = 0; j < children.length; j++) callback(children[j], todo);
      }
    }
  }

  function sanitizeTodo(todo) {
    if (!todo || typeof todo !== 'object') return null;
    var clean = {
      id: typeof todo.id === 'string' ? todo.id : '',
      text: typeof todo.text === 'string' ? todo.text : '',
      done: !!todo.done,
      focusCycles: Number.isFinite(todo.focusCycles) ? todo.focusCycles : 0,
      createdAt: Number.isFinite(todo.createdAt) ? todo.createdAt : 0,
    };
    if (!clean.id || !clean.text) return null;
    if (todo.children && Array.isArray(todo.children)) {
      clean.children = todo.children.map(sanitizeTodo).filter(Boolean);
      if (typeof todo.expanded === 'boolean') clean.expanded = todo.expanded;
      if (typeof todo.aiGenerated === 'boolean') clean.aiGenerated = todo.aiGenerated;
    }
    if (todo.priority && ['high', 'medium', 'low'].includes(todo.priority)) clean.priority = todo.priority;
    if (Number.isFinite(todo.estimatePomodoros)) clean.estimatePomodoros = todo.estimatePomodoros;
    return clean;
  }

  function loadTodos() {
    const saved = localStorage.getItem('rest-reminder-todos');
    if (saved) {
      const parsed = safeParse(saved, null);
      if (parsed && parsed.date === new Date().toDateString()) {
        var rawTodos = Array.isArray(parsed.todos) ? parsed.todos : [];
        s.todos = rawTodos.map(sanitizeTodo).filter(Boolean);
        s.currentTodoId = typeof parsed.currentTodoId === 'string' ? parsed.currentTodoId : null;
      }
    }
  }

  function sanitizeTimerState(timer) {
    if (!timer || typeof timer !== 'object') return null;
    var allowedStates = ['running', 'paused', 'break-ready', 'break', 'break-paused', 'snoozed'];
    if (!allowedStates.includes(timer.timerState)) return null;
    if (timer.date !== new Date().toDateString()) return null;
    return {
      date: timer.date,
      timerState: timer.timerState,
      totalSeconds: Math.max(0, Number(timer.totalSeconds) || 0),
      remainingSeconds: Math.max(0, Number(timer.remainingSeconds) || 0),
      phaseStartedAt: Math.max(0, Number(timer.phaseStartedAt) || 0),
      phaseEndsAt: Math.max(0, Number(timer.phaseEndsAt) || 0),
      phaseDurationMs: Math.max(0, Number(timer.phaseDurationMs) || 0),
      lastAccountedAt: Math.max(0, Number(timer.lastAccountedAt) || 0),
      focusRemainderMs: Math.max(0, Number(timer.focusRemainderMs) || 0),
      pausedAt: Math.max(0, Number(timer.pausedAt) || 0),
      currentCycle: ns.clamp(Number(timer.currentCycle) || 0, 0, 10),
      currentTodoId: typeof timer.currentTodoId === 'string' ? timer.currentTodoId : null,
    };
  }

  function saveTimerState() {
    if (s.timerState === 'idle') return clearTimerState();
    localStorage.setItem('rest-reminder-timer', JSON.stringify({
      date: new Date().toDateString(),
      timerState: s.timerState,
      totalSeconds: s.totalSeconds,
      remainingSeconds: s.remainingSeconds,
      phaseStartedAt: s.phaseStartedAt,
      phaseEndsAt: s.phaseEndsAt,
      phaseDurationMs: s.phaseDurationMs,
      lastAccountedAt: s.lastAccountedAt,
      focusRemainderMs: s.focusRemainderMs,
      pausedAt: s.pausedAt,
      currentCycle: s.currentCycle,
      currentTodoId: s.currentTodoId,
    }));
  }

  function loadTimerState() {
    return sanitizeTimerState(safeParse(localStorage.getItem('rest-reminder-timer'), null));
  }

  function clearTimerState() {
    localStorage.removeItem('rest-reminder-timer');
  }

  function saveTodos() {
    localStorage.setItem('rest-reminder-todos', JSON.stringify({
      date: new Date().toDateString(),
      todos: s.todos,
      currentTodoId: s.currentTodoId,
    }));
  }

  function buildDaySnapshot(statsSource, todosSource) {
    statsSource = statsSource || s.stats;
    todosSource = todosSource || s.todos;
    var safeTodos = Array.isArray(todosSource) ? todosSource : [];
    var savedTaskFocus = statsSource && typeof statsSource.taskFocus === 'object' && statsSource.taskFocus && Object.keys(statsSource.taskFocus).length > 0
      ? statsSource.taskFocus
      : null;
    var taskFocus = savedTaskFocus ? { ...savedTaskFocus } : {};
    if (!savedTaskFocus) {
      visitExecutableTodos(safeTodos, function (todo, parent) {
        if (!todo || !todo.text || !getTodoFocus(todo)) return;
        var key = parent && parent.text ? parent.text + ' / ' + todo.text : todo.text;
        taskFocus[key] = (taskFocus[key] || 0) + getTodoFocus(todo);
      });
    }
    var todoTotal = 0;
    var todoDone = 0;
    visitExecutableTodos(safeTodos, function (todo) {
      todoTotal++;
      if (isTodoDone(todo)) todoDone++;
    });
    return {
      focusSeconds: Number(statsSource.focusSeconds) || 0,
      completedCycles: Number(statsSource.completedCycles) || 0,
      breakCount: Number(statsSource.breakCount) || 0,
      todoDone: todoDone,
      todoTotal: todoTotal,
      taskFocus: taskFocus,
    };
  }

  function hasSnapshotData(snapshot) {
    return snapshot.focusSeconds > 0 || snapshot.completedCycles > 0 || snapshot.breakCount > 0 || snapshot.todoTotal > 0;
  }

  function archiveDay(dateString, statsSource, todosSource) {
    var snapshot = buildDaySnapshot(statsSource, todosSource);
    if (!hasSnapshotData(snapshot)) return;
    s.dailyHistory[getDateKeyFromDateString(dateString)] = snapshot;
    saveHistory();
  }

  function archiveStaleSavedData() {
    var today = new Date().toDateString();
    try {
      var savedStats = localStorage.getItem('rest-reminder-stats');
      var savedTodos = localStorage.getItem('rest-reminder-todos');
      var parsedStats = safeParse(savedStats, null);
      var parsedTodos = safeParse(savedTodos, null);
      var staleDate = (parsedStats && parsedStats.date) || (parsedTodos && parsedTodos.date);
      if (!staleDate || staleDate === today) return;
      var staleTodos = (parsedTodos && parsedTodos.date === staleDate) ? (parsedTodos.todos || []) : [];
      archiveDay(staleDate, { ...ns.DEFAULT_STATS, ...parsedStats }, staleTodos);
      localStorage.setItem('rest-reminder-stats', JSON.stringify({ ...ns.DEFAULT_STATS, date: today }));
      localStorage.setItem('rest-reminder-todos', JSON.stringify({ date: today, todos: [], currentTodoId: null }));
    } catch (e) {}
  }

  return {
    safeParse: safeParse,
    getDateKey: getDateKey,
    getDateKeyFromDateString: getDateKeyFromDateString,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadStats: loadStats,
    saveStats: saveStats,
    saveStatsThrottled: saveStatsThrottled,
    flushStats: flushStats,
    loadHistory: loadHistory,
    saveHistory: saveHistory,
    sanitizeSnapshot: sanitizeSnapshot,
    sanitizeHistory: sanitizeHistory,
    loadTodos: loadTodos,
    saveTodos: saveTodos,
    saveTimerState: saveTimerState,
    loadTimerState: loadTimerState,
    clearTimerState: clearTimerState,
    buildDaySnapshot: buildDaySnapshot,
    hasSnapshotData: hasSnapshotData,
    archiveDay: archiveDay,
    archiveStaleSavedData: archiveStaleSavedData,
  };
})();
