window.RestReminder.stats = (function () {
  const ns = window.RestReminder;
  const s = ns.state;
  const storage = ns.storage;

  function $ (sel) { return document.querySelector(sel); }

  function getRecentSevenDays() {
    var days = [];
    var today = new Date();
    for (var i = 6; i >= 0; i--) {
      var date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(date);
    }
    return days;
  }

  function getSnapshotForDate(date) {
    var key = storage.getDateKey(date);
    if (key === storage.getDateKey()) return storage.buildDaySnapshot(s.stats, s.todos);
    return storage.sanitizeSnapshot(s.dailyHistory[key]) || storage.buildDaySnapshot({ focusSeconds: 0, completedCycles: 0, breakCount: 0 }, []);
  }

  function formatWeekday(date) {
    return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  }

  function renderOverviewCards(snapshot) {
    var doneText = snapshot.todoDone + ' / ' + snapshot.todoTotal;
    $('#stats-focus-minutes').textContent = Math.floor(snapshot.focusSeconds / 60);
    $('#stats-cycles').textContent = snapshot.completedCycles;
    $('#stats-breaks').textContent = snapshot.breakCount;
    $('#stats-todos').textContent = doneText;
  }

  function renderSevenDayChart() {
    var chart = $('#stats-week-chart');
    if (!chart) return;
    var days = getRecentSevenDays();
    var snapshots = days.map(getSnapshotForDate);
    var minutes = snapshots.map(function (item) { return Math.floor(item.focusSeconds / 60); });
    var maxMinutes = Math.max.apply(null, [1].concat(minutes));
    chart.innerHTML = '';

    days.forEach(function (date, index) {
      var barWrap = document.createElement('div');
      barWrap.className = 'week-bar-item';

      var value = document.createElement('div');
      value.className = 'week-bar-value';
      value.textContent = minutes[index] > 0 ? minutes[index] + 'm' : '';

      var bar = document.createElement('div');
      bar.className = 'week-bar';
      bar.style.height = Math.max(8, (minutes[index] / maxMinutes) * 96) + 'px';

      var label = document.createElement('div');
      label.className = 'week-bar-label';
      label.textContent = formatWeekday(date);

      barWrap.appendChild(value);
      barWrap.appendChild(bar);
      barWrap.appendChild(label);
      chart.appendChild(barWrap);
    });
  }

  function renderTodoCompletion(snapshot) {
    var percent = snapshot.todoTotal === 0 ? 0 : Math.round((snapshot.todoDone / snapshot.todoTotal) * 100);
    $('#todo-completion-text').textContent = snapshot.todoDone + ' / ' + snapshot.todoTotal;
    $('#todo-completion-percent').textContent = percent + '%';
    $('#todo-completion-fill').style.width = percent + '%';
  }

  function renderTaskFocus(snapshot) {
    var list = $('#task-focus-list');
    if (!list) return;
    var entries = Object.entries(snapshot.taskFocus || {}).sort(function (a, b) { return b[1] - a[1]; });
    if (entries.length === 0) {
      list.innerHTML = '<div class="analytics-empty">今天还没有任务专注记录</div>';
      return;
    }

    var maxCount = Math.max.apply(null, [1].concat(entries.map(function (e) { return e[1]; })));
    list.innerHTML = '';
    for (var i = 0; i < entries.length; i++) {
      var task = entries[i][0];
      var count = entries[i][1];
      var row = document.createElement('div');
      row.className = 'task-focus-row';

      var top = document.createElement('div');
      top.className = 'task-focus-top';
      var taskName = document.createElement('span');
      taskName.textContent = task;
      taskName.title = task;
      var taskCount = document.createElement('strong');
      taskCount.textContent = count + ' 次';
      top.appendChild(taskName);
      top.appendChild(taskCount);

      var track = document.createElement('div');
      track.className = 'task-focus-track';
      var fill = document.createElement('div');
      fill.className = 'task-focus-fill';
      fill.style.width = Math.max(8, (count / maxCount) * 100) + '%';
      track.appendChild(fill);

      row.appendChild(top);
      row.appendChild(track);
      list.appendChild(row);
    }
  }

  function renderDailyGoal(snapshot) {
    var goal = s.settings.dailyGoalMinutes || 120;
    var done = Math.floor(snapshot.focusSeconds / 60);
    var percent = Math.min(100, Math.round((done / goal) * 100));
    $('#daily-goal-text').textContent = done + ' / ' + goal + ' 分钟';
    $('#daily-goal-percent').textContent = percent + '%';
    $('#daily-goal-fill').style.width = percent + '%';
  }

  function isStatsPageVisible() {
    var page = document.getElementById('page-stats');
    return !!(page && page.classList.contains('active'));
  }

  function renderStatsPage() {
    if (!$('#stats-focus-minutes')) return;
    if (!isStatsPageVisible()) return;
    var todaySnapshot = storage.buildDaySnapshot(s.stats, s.todos);
    renderOverviewCards(todaySnapshot);
    renderSevenDayChart();
    renderTodoCompletion(todaySnapshot);
    renderTaskFocus(todaySnapshot);
    renderDailyGoal(todaySnapshot);
  }

  function exportStats() {
    var rows = [['日期', '专注分钟', '完成周期', '休息次数', 'Todo完成', 'Todo总数', '任务专注']];
    for (var dateKey in s.dailyHistory) {
      if (!Object.prototype.hasOwnProperty.call(s.dailyHistory, dateKey)) continue;
      var snap = storage.sanitizeSnapshot(s.dailyHistory[dateKey]);
      if (!snap) continue;
      var focus = Math.floor(snap.focusSeconds / 60);
      var tf = Object.entries(snap.taskFocus || {}).map(function (e) { return e[0] + ':' + e[1]; }).join('; ');
      rows.push([dateKey, focus, snap.completedCycles, snap.breakCount, snap.todoDone, snap.todoTotal, tf]);
    }
    var todaySnap = storage.buildDaySnapshot(s.stats, s.todos);
    var todayKey = storage.getDateKey();
    var todayTf = Object.entries(todaySnap.taskFocus || {}).map(function (e) { return e[0] + ':' + e[1]; }).join('; ');
    rows.push([todayKey, Math.floor(todaySnap.focusSeconds / 60), todaySnap.completedCycles, todaySnap.breakCount, todaySnap.todoDone, todaySnap.todoTotal, todayTf]);
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '休息提醒统计_' + todayKey + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportBackup() {
    var payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: s.settings,
      stats: s.stats,
      todos: s.todos,
      currentTodoId: s.currentTodoId,
      dailyHistory: s.dailyHistory,
    };
    var json = JSON.stringify(payload, null, 2);
    var blob = new Blob(['\uFEFF' + json], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '休息提醒备份_' + storage.getDateKey() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importBackup(file, callback) {
    if (!file) { if (callback) callback(false, '未选择文件'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') throw new Error('格式无效');
        if (data.settings && typeof data.settings === 'object') {
          var allowed = ns.DEFAULT_SETTINGS;
          var clean = {};
          for (var key in allowed) {
            if (!Object.prototype.hasOwnProperty.call(allowed, key)) continue;
            clean[key] = Object.prototype.hasOwnProperty.call(data.settings, key) ? data.settings[key] : allowed[key];
          }
          s.settings = Object.assign({}, allowed, clean);
          storage.saveSettings();
        }
        if (data.dailyHistory && typeof data.dailyHistory === 'object') {
          s.dailyHistory = storage.sanitizeHistory(data.dailyHistory);
          storage.saveHistory();
        }
        if (data.stats && typeof data.stats === 'object') {
          var allowedStats = ns.DEFAULT_STATS;
          var cleanStats = {};
          for (var k in allowedStats) {
            if (!Object.prototype.hasOwnProperty.call(allowedStats, k)) continue;
            cleanStats[k] = Object.prototype.hasOwnProperty.call(data.stats, k) ? data.stats[k] : allowedStats[k];
          }
          if (typeof cleanStats.taskFocus !== 'object' || cleanStats.taskFocus === null) cleanStats.taskFocus = {};
          s.stats = Object.assign({}, allowedStats, cleanStats);
          storage.saveStats();
        }
        if (Array.isArray(data.todos)) {
          s.todos = data.todos.map(storage.sanitizeTodo || function (t) { return t; }).filter(Boolean);
          s.currentTodoId = typeof data.currentTodoId === 'string' ? data.currentTodoId : null;
          storage.saveTodos();
        }
        if (ns.app && ns.app.updateStats) ns.app.updateStats();
        if (ns.app && ns.app.syncSettingsUI) ns.app.syncSettingsUI();
        if (ns.todos && ns.todos.renderTodos) ns.todos.renderTodos();
        if (ns.todos && ns.todos.updateCurrentTodoDisplay) ns.todos.updateCurrentTodoDisplay();
        renderStatsPage();
        if (callback) callback(true, '导入成功');
      } catch (err) {
        if (callback) callback(false, '导入失败：' + (err.message || '文件格式错误'));
      }
    };
    reader.onerror = function () { if (callback) callback(false, '读取文件失败'); };
    reader.readAsText(file);
  }

  function clearHistory() {
    var confirmFn = ns.todos && ns.todos.showConfirm;
    var doClear = function () {
      s.dailyHistory = {};
      storage.saveHistory();
      renderStatsPage();
    };
    if (confirmFn) {
      confirmFn('确定要清空历史统计吗？今日数据不会被清空。', '清空历史', function (ok) { if (ok) doClear(); });
    } else {
      doClear();
    }
  }

  return {
    renderOverviewCards: renderOverviewCards,
    renderSevenDayChart: renderSevenDayChart,
    renderTodoCompletion: renderTodoCompletion,
    renderTaskFocus: renderTaskFocus,
    renderDailyGoal: renderDailyGoal,
    renderStatsPage: renderStatsPage,
    exportStats: exportStats,
    exportBackup: exportBackup,
    importBackup: importBackup,
    clearHistory: clearHistory,
  };
})();
