window.RestReminder.aiAssistant = (function () {
  var ns = window.RestReminder;
  var s = ns.state;
  var requestSeq = 0;

  function $ (sel) { return document.querySelector(sel); }

  function setResult(html) {
    var el = $('#ai-result');
    if (el) el.innerHTML = html;
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch];
    });
  }

  function setLoading(text) {
    setResult('<div class="analytics-empty">' + escapeHtml(text || 'AI 正在生成...') + '</div>');
  }

  function setAiBusy(busy) {
    document.querySelectorAll('#page-ai .ai-card button').forEach(function (btn) {
      btn.disabled = !!busy;
    });
  }

  async function runAiTask(loadingText, task, render) {
    var seq = ++requestSeq;
    setAiBusy(true);
    setLoading(loadingText);
    try {
      var data = await task();
      if (seq === requestSeq) render(data);
    } catch (err) {
      if (seq === requestSeq) setError(err);
    } finally {
      if (seq === requestSeq) setAiBusy(false);
    }
  }

  function setError(err) {
    var msg = err && err.message ? err.message : String(err || 'AI 请求失败');
    var code = getAiErrorCode(msg);
    var hints = {
      AI_NOT_ENABLED: '请先在设置页启用 AI。',
      AI_KEY_MISSING: '请先在设置页填写 API Key。',
      AI_SETTINGS_INVALID: 'AI 设置不完整，请检查 Base URL 和 Model。',
      AI_SCHEMA_INVALID: '模型返回格式异常，请重试。',
    };
    setResult('<div class="analytics-empty">' + escapeHtml(hints[code] || getAiErrorMessage(err)) + '</div>');
  }

  function getAiErrorCode(message) {
    var match = String(message || '').match(/AI_[A-Z0-9_]+/);
    return match ? match[0] : String(message || '');
  }

  function getAiErrorDetail(message) {
    var text = String(message || '');
    var idx = text.indexOf(':');
    while (idx !== -1 && text.slice(idx + 1).trim().startsWith('Error')) {
      idx = text.indexOf(':', idx + 1);
    }
    var codeMatch = text.match(/AI_[A-Z0-9_]+:\s*(.+)$/);
    return codeMatch ? codeMatch[1].trim() : '';
  }

  function getAiErrorMessage(err) {
    var msg = err && err.message ? err.message : String(err || 'AI 请求失败');
    var code = getAiErrorCode(msg);
    var detail = getAiErrorDetail(msg);
    var hints = {
      AI_NOT_ENABLED: '请打开“启用 AI”开关。',
      AI_KEY_MISSING: '请填写 API Key，或确认之前已经保存过 API Key。',
      AI_SETTINGS_INVALID: 'AI 设置不完整，请检查 Base URL 和 Model。',
      AI_EMPTY_RESPONSE: '模型没有返回内容。',
      AI_SCHEMA_INVALID: '模型返回格式异常，请重试。',
      AI_HTTP_400: '请求格式错误，请检查模型参数。',
      AI_HTTP_401: '认证失败，请检查 API Key。',
      AI_HTTP_402: '账号余额不足，请到 DeepSeek 平台充值或确认余额。',
      AI_HTTP_403: '权限不足，请检查 API Key 或模型权限。',
      AI_HTTP_404: '接口或模型不存在，请检查 Base URL 和 Model。',
      AI_HTTP_422: '参数错误，请检查 Base URL、Model 和请求参数。',
      AI_HTTP_429: '请求过于频繁或额度不足，请稍后重试。',
      AI_HTTP_500: 'DeepSeek 服务端错误，请稍后重试。',
      AI_HTTP_503: 'DeepSeek 服务繁忙，请稍后重试。',
    };
    if (msg === 'AbortError' || msg.includes('aborted')) return '请求超时，请检查网络或稍后重试。';
    return (hints[code] || msg) + (detail ? '（' + detail + '）' : '');
  }

  function getContext() {
    return {
      todos: ns.todos && ns.todos.getTodosForContext ? ns.todos.getTodosForContext() : [],
      stats: {
        focusMinutes: Math.floor((s.stats.focusSeconds || 0) / 60),
        completedCycles: s.stats.completedCycles || 0,
        breakCount: s.stats.breakCount || 0,
      },
      settings: {
        workMinutes: s.settings.workMinutes,
        breakMinutes: s.settings.breakMinutes,
        dailyGoalMinutes: s.settings.dailyGoalMinutes,
      },
      currentTask: ns.todos ? ns.todos.getCurrentTodoText() : null,
    };
  }

  function getSubtaskCount() {
    var input = $('#ai-subtask-count');
    var count = input ? parseInt(input.value, 10) : 6;
    if (!Number.isFinite(count)) count = 6;
    count = Math.max(1, Math.min(12, count));
    if (input) input.value = String(count);
    return count;
  }

  function renderTasks(data) {
    var tasks = data && data.tasks ? data.tasks : [];
    if (tasks.length === 0) return setResult('<div class="analytics-empty">没有生成可用任务。</div>');
    var projectTitle = data.projectTitle || ($('#ai-goal-input') ? $('#ai-goal-input').value.trim() : '') || 'AI 拆解任务';
    var html = '<div class="ai-result-title">AI 建议创建</div>';
    html += '<div class="ai-project-preview"><strong>' + escapeHtml(projectTitle) + '</strong></div><div class="ai-result-list">';
    tasks.forEach(function (task, idx) {
      html += '<div class="ai-result-item ai-subtask-preview"><strong>' + (idx + 1) + '. ' + escapeHtml(task.title) + '</strong>';
      html += '<div class="ai-result-meta">' + escapeHtml(task.priority) + ' · 预计 ' + escapeHtml(task.estimatePomodoros) + ' 个番茄钟</div></div>';
    });
    html += '</div><div class="ai-preview-actions"><button id="btn-ai-add-tasks" class="btn btn-primary btn-full">确认加入 Todo</button><button id="btn-ai-cancel-tasks" class="btn btn-ghost btn-full">取消</button></div>';
    setResult(html);
    $('#btn-ai-add-tasks').addEventListener('click', function () {
      if (ns.todos && ns.todos.addProject) {
        ns.todos.addProject(projectTitle, tasks.map(function (task) { return { ...task, aiGenerated: true }; }));
        setResult('<div class="analytics-empty">已加入 1 个父任务和 ' + tasks.length + ' 个子任务。</div>');
      }
    });
    $('#btn-ai-cancel-tasks').addEventListener('click', function () {
      setResult('<div class="analytics-empty">已取消，AI 结果没有加入 Todo。</div>');
    });
  }

  function renderPlan(data) {
    var html = '<div class="ai-result-title">今日计划</div>';
    if (data.summary) html += '<div class="ai-result-item">' + escapeHtml(data.summary) + '</div>';
    html += '<div class="ai-result-list">';
    (data.plan || []).forEach(function (item) {
      html += '<div class="ai-result-item"><strong>' + escapeHtml(item.timeBlock || '专注块') + '</strong>：' + escapeHtml(item.task);
      if (item.note) html += '<div class="ai-result-meta">' + escapeHtml(item.note) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    setResult(html);
  }

  function renderReview(data) {
    var html = '<div class="ai-result-title">今日复盘</div>';
    html += '<div class="ai-result-item">' + escapeHtml(data.summary || '暂无总结') + '</div>';
    if (data.strengths && data.strengths.length) {
      html += '<div class="ai-result-title">做得好的地方</div><div class="ai-result-list">';
      data.strengths.forEach(function (item) { html += '<div class="ai-result-item">' + escapeHtml(item) + '</div>'; });
      html += '</div>';
    }
    if (data.suggestions && data.suggestions.length) {
      html += '<div class="ai-result-title">明日建议</div><div class="ai-result-list">';
      data.suggestions.forEach(function (item) { html += '<div class="ai-result-item">' + escapeHtml(item) + '</div>'; });
      html += '</div>';
    }
    setResult(html);
  }

  function renderRest(data) {
    setResult('<div class="ai-result-title">休息建议</div><div class="ai-result-item"><strong>' + escapeHtml(data.suggestion || '') + '</strong><div class="ai-result-meta">' + escapeHtml(data.reason || '') + '</div></div>');
  }

  function getWeekContext() {
    var history = s.dailyHistory || {};
    var todayKey = ns.storage && ns.storage.getDateKey ? ns.storage.getDateKey() : '';
    var dayKeys = [];
    for (var i = 6; i >= 0; i--) {
      var date = new Date();
      date.setDate(date.getDate() - i);
      dayKeys.push(ns.storage.getDateKey(date));
    }
    var totalFocus = 0;
    var totalCycles = 0;
    var totalBreaks = 0;
    var totalTodoDone = 0;
    var totalTodoTotal = 0;
    var bestDay = '';
    var bestDayMinutes = 0;
    var projectMap = {};

    dayKeys.forEach(function (key) {
      var snap = key === todayKey && ns.storage && ns.storage.buildDaySnapshot
        ? ns.storage.buildDaySnapshot(s.stats, s.todos)
        : history[key];
      if (!snap || typeof snap !== 'object') return;
      var focusMin = Math.floor((snap.focusSeconds || 0) / 60);
      totalFocus += focusMin;
      totalCycles += snap.completedCycles || 0;
      totalBreaks += snap.breakCount || 0;
      totalTodoDone += snap.todoDone || 0;
      totalTodoTotal += snap.todoTotal || 0;
      if (focusMin > bestDayMinutes) {
        bestDayMinutes = focusMin;
        bestDay = key;
      }
      var tf = snap.taskFocus || {};
      Object.keys(tf).forEach(function (taskName) {
        projectMap[taskName] = (projectMap[taskName] || 0) + tf[taskName];
      });
    });

    var projectSummary = Object.keys(projectMap).map(function (name) {
      return { project: name, focusCycles: projectMap[name] };
    }).slice(0, 10);

    return {
      days: dayKeys.length,
      period: dayKeys[0] + ' ~ ' + dayKeys[dayKeys.length - 1],
      totalFocusMinutes: totalFocus,
      totalCycles: totalCycles,
      totalBreaks: totalBreaks,
      todoDone: totalTodoDone,
      todoTotal: totalTodoTotal,
      bestDay: bestDay,
      bestDayMinutes: bestDayMinutes,
      projects: projectSummary,
    };
  }

  function renderWeeklyReport(data) {
    var html = '<div class="ai-result-title">本周总结</div>';
    html += '<div class="ai-result-item">' + escapeHtml(data.summary || '暂无') + '</div>';
    if (data.bestDay) {
      html += '<div class="ai-result-title">最高效的一天</div><div class="ai-result-item">' + escapeHtml(data.bestDay) + '</div>';
    }
    if (data.projectProgress && data.projectProgress.length) {
      html += '<div class="ai-result-title">项目进展</div><div class="ai-result-list">';
      data.projectProgress.forEach(function (p) {
        html += '<div class="ai-result-item"><strong>' + escapeHtml(p.project) + '</strong> · ' + escapeHtml(String(p.focusMinutes || 0)) + ' 分钟';
        if (p.description) html += '<div class="ai-result-meta">' + escapeHtml(p.description) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    if (data.suggestions && data.suggestions.length) {
      html += '<div class="ai-result-title">下周建议</div><div class="ai-result-list">';
      data.suggestions.forEach(function (item, idx) { html += '<div class="ai-result-item">' + (idx + 1) + '. ' + escapeHtml(item) + '</div>'; });
      html += '</div>';
    }
    setResult(html);
  }

  async function suggestRestForBreak() {
    var el = $('#break-ai-suggestion');
    if (!el || !window.electronAPI.aiRestSuggestion) return;
    el.textContent = '正在生成休息建议...';
    try {
      var data = await window.electronAPI.aiRestSuggestion(getContext());
      el.textContent = data.suggestion || '起来活动一下，看看远处。';
    } catch {
      el.textContent = '看向远处20秒，做几次肩颈伸展。';
    }
  }

  function bindAiPage() {
    $('#btn-ai-breakdown').addEventListener('click', async function () {
      var goal = $('#ai-goal-input').value.trim();
      if (!goal) return setResult('<div class="analytics-empty">请先输入目标。</div>');
      var taskCount = getSubtaskCount();
      runAiTask('AI 正在拆解 ' + taskCount + ' 个子任务...', function () {
        return window.electronAPI.aiBreakdownGoal({ goal: goal, taskCount: taskCount });
      }, renderTasks);
    });
    $('#btn-ai-plan').addEventListener('click', async function () {
      runAiTask('AI 正在生成今日计划...', function () { return window.electronAPI.aiDailyPlan(getContext()); }, renderPlan);
    });
    $('#btn-ai-review').addEventListener('click', async function () {
      runAiTask('AI 正在生成今日复盘...', function () { return window.electronAPI.aiDailyReview(getContext()); }, renderReview);
    });
    $('#btn-ai-rest').addEventListener('click', async function () {
      runAiTask('AI 正在生成休息建议...', function () { return window.electronAPI.aiRestSuggestion(getContext()); }, renderRest);
    });
    $('#btn-ai-weekly-report').addEventListener('click', async function () {
      runAiTask('AI 正在生成本周回顾...', function () { return window.electronAPI.aiWeeklyReport(getWeekContext()); }, renderWeeklyReport);
    });
  }

  async function loadAiSettings() {
    if (!window.electronAPI.aiGetSettings) return;
    var settings = await window.electronAPI.aiGetSettings();
    $('#toggle-ai-enabled').checked = !!settings.enabled;
    $('#input-ai-base-url').value = settings.baseUrl || '';
    $('#input-ai-model').value = settings.model || '';
    $('#input-ai-api-key').placeholder = settings.apiKeySet ? '已保存，留空不修改' : '输入 API Key';
  }

  function setSettingsStatus(text, cls) {
    var el = $('#ai-settings-status');
    el.textContent = text || '';
    el.className = 'ai-settings-status' + (cls ? ' ' + cls : '');
  }

  function bindAiSettings() {
    $('#btn-save-ai-settings').addEventListener('click', async function () {
      setSettingsStatus('正在保存...');
      try {
        await window.electronAPI.aiSaveSettings({
          enabled: $('#toggle-ai-enabled').checked,
          baseUrl: $('#input-ai-base-url').value,
          model: $('#input-ai-model').value,
          apiKey: $('#input-ai-api-key').value,
        });
        $('#input-ai-api-key').value = '';
        await loadAiSettings();
        setSettingsStatus('AI 设置已保存。', 'ok');
      } catch (err) {
        setSettingsStatus('保存失败：' + (err.message || err), 'error');
      }
    });
    $('#btn-test-ai').addEventListener('click', async function () {
      setSettingsStatus('正在测试连接...');
      try {
        await window.electronAPI.aiTestConnectionWith({
          enabled: $('#toggle-ai-enabled').checked,
          baseUrl: $('#input-ai-base-url').value,
          model: $('#input-ai-model').value,
          apiKey: $('#input-ai-api-key').value,
        });
        setSettingsStatus('连接成功。', 'ok');
      } catch (err) {
        setSettingsStatus('连接失败：' + getAiErrorMessage(err), 'error');
      }
    });
  }

  function init() {
    if (!$('#page-ai')) return;
    bindAiPage();
    bindAiSettings();
    loadAiSettings().catch(function () { setSettingsStatus('AI 设置读取失败。', 'error'); });
  }

  return { init: init, getContext: getContext, suggestRestForBreak: suggestRestForBreak };
})();
