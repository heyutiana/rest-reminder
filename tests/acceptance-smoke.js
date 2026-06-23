const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const floatingHtml = fs.readFileSync(path.join(root, 'floating.html'), 'utf8');
const floatingJs = fs.readFileSync(path.join(root, 'js', 'floating.js'), 'utf8');
const jsFiles = ['config.js', 'utils.js', 'storage.js', 'stats.js', 'todos.js', 'timer.js', 'floating-sync.js', 'ai-assistant.js', 'app.js'].map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8'));

const dom = new JSDOM(html, {
  url: 'https://rest-reminder.test/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});

const { window } = dom;
const { document } = window;
const intervals = [];
const notifications = [];
const trayStatuses = [];
const floatingUpdates = [];
let windowVisibleCallback = null;

window.confirm = () => true;
window.electronAPI = {
  updateTrayStatus: (status) => trayStatuses.push(status),
  showNotification: (title, body) => notifications.push({ title, body }),
  minimizeToTray: () => {},
  windowMinimize: () => {},
  onTrayAction: () => {},
  onWindowVisible: (callback) => { windowVisibleCallback = callback; },
  sendFloatingUpdate: (data) => floatingUpdates.push(data),
  onRequestTimerState: () => {},
  aiGetSettings: () => Promise.resolve({ enabled: false, baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', timeoutMs: 20000, apiKeySet: false }),
  aiSaveSettings: () => Promise.resolve({ enabled: false, baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', timeoutMs: 20000, apiKeySet: false }),
  aiTestConnection: () => Promise.resolve({ ok: true }),
  aiTestConnectionWith: () => Promise.resolve({ ok: true }),
  aiBreakdownGoal: () => Promise.resolve({ projectTitle: 'AI 大目标', tasks: [{ title: 'AI 生成子任务', estimatePomodoros: 1, priority: 'medium' }] }),
  aiDailyPlan: () => Promise.resolve({ summary: '今日计划', plan: [] }),
  aiDailyReview: () => Promise.resolve({ summary: '今日复盘', strengths: [], suggestions: [] }),
  aiRestSuggestion: () => Promise.resolve({ suggestion: '看向远处20秒', reason: '护眼' }),
  aiWeeklyReport: () => Promise.resolve({ summary: '本周总览', bestDay: '周一', projectProgress: [{ project: '任务', focusMinutes: 120, description: '进展良好' }], suggestions: ['保持节奏'] }),
  setAutoStart: () => {},
  getAutoStart: () => Promise.resolve(false),
  onHotkeyAction: () => {},
  hotkeyRegister: () => Promise.resolve(true),
  hotkeyUnregister: () => Promise.resolve(),
  hotkeyIsRegistered: () => Promise.resolve(true),
};
window.AudioContext = class {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 0 },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    };
  }
};
window.webkitAudioContext = window.AudioContext;

const _origDateNow = Date.now;
let fakeNow = _origDateNow();
function mockDateNow(ms) { fakeNow += ms; }
Date.now = () => fakeNow;
window.Date.now = Date.now;
global.Date.now = Date.now;

window.setInterval = (callback, ms) => {
  intervals.push({ callback, ms, active: true });
  return intervals.length;
};
window.clearInterval = (id) => {
  if (intervals[id - 1]) intervals[id - 1].active = false;
};
global.setInterval = window.setInterval;
global.clearInterval = window.clearInterval;

function $(selector) {
  return document.querySelector(selector);
}

function click(selector) {
  const element = $(selector);
  assert(element, `Missing element: ${selector}`);
  element.click();
}

function confirmDialog() {
  const ok = document.querySelector('#todo-prompt-overlay .btn-danger');
  if (ok) ok.click();
}

function setInput(selector, value) {
  const input = $(selector);
  assert(input, `Missing input: ${selector}`);
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function runLatestInterval(times) {
  const item = intervals[intervals.length - 1];
  assert(item, 'No interval registered');
  for (let i = 0; i < times; i++) item.callback();
}

function assertText(selector, expected) {
  assert.strictEqual($(selector).textContent.trim(), expected);
}

function assertInputValue(selector, expected) {
  const el = $(selector);
  assert(el, `Missing input: ${selector}`);
  assert.strictEqual(String(el.value), String(expected), `Input ${selector} value mismatch`);
}

jsFiles.forEach(code => window.eval(code));
document.dispatchEvent(new window.Event('DOMContentLoaded'));

assert(floatingHtml.includes('<script src="js/floating.js"></script>'), 'Floating page should load external script');
assert(!/<script>\s*\(function/.test(floatingHtml), 'Floating page should not use inline script blocked by CSP');
assert(floatingHtml.includes('id="bottle"'), 'Floating page should render bottle container');
assert(floatingHtml.includes('id="fill"'), 'Floating page should render bottle fill layer');
assert(floatingJs.includes('function getProgress'), 'Floating script should compute bottle fill progress');
assert(floatingJs.includes('--fill'), 'Floating script should update CSS fill variable');
assert($('#page-ai'), 'AI assistant page should exist');
assert($('#ai-subtask-count'), 'AI subtask count input should exist');
assert($('#toggle-ai-enabled'), 'AI settings toggle should exist');
assert($('#input-ai-api-key'), 'AI API key input should exist');
assert($('#break-ai-suggestion'), 'Break page should include AI rest suggestion area');
assert($('#toggle-hotkeys'), 'Hotkey toggle should exist in settings');
assert($('#btn-ai-weekly-report'), 'Weekly report button should exist in AI page');

// Initial state
assertText('#status-text', '准备开始');
assertText('#timer-minutes', '25');
assertText('#timer-seconds', '00');

// Use a 1-minute work interval to keep the smoke test fast.
click('#nav-settings');
setInput('#input-work', '1');
click('#btn-save-settings');
assertText('#timer-minutes', '01');

// Todo add and current task selection
click('#nav-todo');
setInput('#todo-input', '写验收测试');
click('#btn-add-todo');
assertText('#todo-progress', '0 / 1');
assert($('.todo-item'), 'Todo item should render after adding');
click('.btn-todo-current');
assertText('#current-task-name', '写验收测试');

// Work completion should update stats and current Todo focus count.
click('#nav-timer');
const startWorkTimer = window.RestReminder && window.RestReminder.timer && window.RestReminder.timer.startWorkTimer;
const tick = window.RestReminder && window.RestReminder.timer && window.RestReminder.timer.tick;
if (typeof startWorkTimer === 'function') {
  startWorkTimer();
} else {
  click('#btn-start');
}
assert(floatingUpdates.some(item => item && item.timerState === 'running'), 'Starting timer should publish floating state');
if (typeof tick === 'function') {
  for (let i = 0; i < 60; i++) { mockDateNow(1000); tick(); }
} else {
  runLatestInterval(60);
}
assertText('#stat-cycles', '1');
assert($('.todo-cycles').textContent.includes('1 次'), 'Current Todo should gain one focus cycle');
assert($('#page-break').classList.contains('active'), 'Break page should be active after work completes');

// Skipping break should not increase break count.
click('#btn-skip-break');
assertText('#stat-breaks', '0');
assert(!notifications.some(item => item.title === '休息结束'), 'Skipping break should not emit break-finished notification');

// Clear all todos then add again.
click('#nav-todo');
click('#btn-clear-all');
confirmDialog();
assertText('#todo-progress', '0 / 0');
window.RestReminder.todos.addProject('AI 大目标', [{ title: 'AI 生成子任务', estimatePomodoros: 1, priority: 'medium' }]);
assertText('#todo-progress', '0 / 1');
assert($('.todo-parent'), 'Nested Todo should render a parent row');
assert($('.todo-child'), 'Nested Todo should render a child row');
assert.strictEqual($('.todo-parent .btn-todo-current').style.display, 'none', 'Parent with children should not be directly focusable');
click('.todo-child .btn-todo-current');
assertText('#current-task-name', 'AI 大目标 / AI 生成子任务');
// Edit todo text should work for flat todo
click('#btn-clear-all');
confirmDialog();
assertText('#todo-progress', '0 / 0');
setInput('#todo-input', '旧标题任务');
click('#btn-add-todo');
assertText('#todo-progress', '0 / 1');
click('.btn-todo-current');
assertText('#current-task-name', '旧标题任务');
assert($('.btn-todo-edit'), 'Edit button should render on todo items');
window.RestReminder.todos.editTodoText(window.RestReminder.state.todos[0].id, '新标题任务');
assertText('#current-task-name', '新标题任务');
assert($('.todo-text').textContent.includes('新标题任务'), 'Todo text should update after edit');
// Add child to parent should work
click('#btn-clear-all');
confirmDialog();
assertText('#todo-progress', '0 / 0');
window.RestReminder.todos.addProject('父任务', [{ title: '子任务1', estimatePomodoros: 1, priority: 'medium' }]);
assertText('#todo-progress', '0 / 1');
var parentId = window.RestReminder.state.todos[0].id;
window.RestReminder.todos.addChildTodo(parentId, '手动新增子任务');
assertText('#todo-progress', '0 / 2');
var childItems = document.querySelectorAll('.todo-child');
assert(childItems.length === 2, 'Should have 2 child items after adding one');
click('#btn-clear-all');
confirmDialog();
assertText('#todo-progress', '0 / 0');
setInput('#todo-input', '清空后再添加');
click('#btn-add-todo');
assertText('#todo-progress', '0 / 1');

// Stats page renders overview and charts.
click('#nav-stats');
assertText('#stats-cycles', '1');
assert($('#stats-week-chart').children.length === 7, 'Week chart should render seven bars');
assert($('#task-focus-list').textContent.includes('写验收测试'), 'Task focus distribution should persist after Todo clear');

// Reset today's stats clears cycles and focus task distribution.
click('#nav-settings');
click('#btn-reset-stats');
confirmDialog();
assertText('#stat-cycles', '0');
click('#nav-stats');
assertText('#stats-cycles', '0');

// Preset mode quick switch applies values.
click('#nav-settings');
click('.preset-btn[data-preset="1"]');
assertInputValue('#input-work', '50');
assertInputValue('#input-break', '10');

// Daily goal section renders on stats page.
click('#nav-stats');
assert($('#daily-goal-text'), 'Daily goal text should exist');
assert($('#daily-goal-fill'), 'Daily goal fill bar should exist');

// Export button exists.
assert($('#btn-export-stats'), 'Export button should exist on stats page');

// CSV export with history data should not crash.
window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:test');
window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});
const histData = { '2026-05-30': { focusSeconds: 3600, completedCycles: 2, breakCount: 2, todoDone: 1, todoTotal: 3, taskFocus: { '写代码': 2 } } };
window.RestReminder.state.dailyHistory = histData;
try {
  window.RestReminder.stats.exportStats();
  assert(true, 'CSV export with history should not throw');
} catch (e) {
  assert(false, 'CSV export threw: ' + e.message);
}
// Verify exportStats doesn't crash with null-prototype history (safeParse result).
window.RestReminder.state.dailyHistory = Object.assign(Object.create(null), histData);
try {
  window.RestReminder.stats.exportStats();
  assert(true, 'CSV export with null-prototype history should not throw');
} catch (e) {
  assert(false, 'CSV export with null-prototype threw: ' + e.message);
}
window.RestReminder.state.dailyHistory = {};

// Wall-clock timer: start work, simulate 5 minutes of real time in one tick.
// After preset "深度专注" (50 min work), start the timer.
click('#nav-timer');
click('#btn-start');
// Advance mock clock by 5 minutes, then call tick once.
mockDateNow(5 * 60 * 1000);
if (typeof tick === 'function') {
  tick();
} else {
  runLatestInterval(1);
}
// With 50-min work, after 5-min jump: remaining should be 45 min
const remainingMin = parseInt($('#timer-minutes').textContent.trim(), 10);
assert(remainingMin === 45, `Timer should show 45 minutes after 5min jump, got ${remainingMin}`);
// Focus seconds should have increased by 5*60=300.
const focusAfterJump = parseInt($('#stat-focus').textContent.trim(), 10);
assert(focusAfterJump >= 5, `Focus minutes should be >= 5 after 5min jump, got ${focusAfterJump}`);

// Window restore should immediately sync wall-clock time without waiting for setInterval.
assert(typeof windowVisibleCallback === 'function', 'Window-visible callback should be registered');
mockDateNow(5 * 60 * 1000);
windowVisibleCallback();
const remainingAfterVisible = parseInt($('#timer-minutes').textContent.trim(), 10);
assert(remainingAfterVisible === 40, `Timer should show 40 minutes after restore sync, got ${remainingAfterVisible}`);

// Restore original Date.now so subsequent tests aren't affected.
click('#btn-reset');
click('#nav-settings');
setInput('#input-work', '1');
setInput('#input-break', '1');
click('#btn-save-settings');
click('#nav-timer');

// Sub-second interval drift: repeated 999ms ticks should not lose fractional time.
click('#btn-start');
for (let i = 0; i < 60; i++) { mockDateNow(999); tick(); }
assertText('#timer-minutes', '00');
assertText('#timer-seconds', '01');
assert(!$('#page-break').classList.contains('active'), 'Timer should not complete before the full 60 seconds');
mockDateNow(60);
tick();
assert($('#page-break').classList.contains('active'), 'Timer should complete once accumulated time reaches 60 seconds');
click('#btn-skip-break');

// Pause should sync real elapsed time before stopping the timer.
const focusBeforePause = window.RestReminder.state.stats.focusSeconds;
click('#btn-start');
mockDateNow(1500);
click('#btn-pause');
assert.strictEqual(window.RestReminder.state.stats.focusSeconds, focusBeforePause + 1, 'Pause should account elapsed focus seconds before pausing');
const pausedRemaining = window.RestReminder.state.remainingSeconds;
mockDateNow(10 * 1000);
tick();
assert.strictEqual(window.RestReminder.state.remainingSeconds, pausedRemaining, 'Paused timer should not count down');
click('#btn-pause');
mockDateNow(500);
tick();
assert.strictEqual(window.RestReminder.state.stats.focusSeconds, focusBeforePause + 2, 'Focus remainder should survive pause/resume');
click('#btn-reset');

// Skip should also sync elapsed focus time before opening the break page.
const focusBeforeSkip = window.RestReminder.state.stats.focusSeconds;
const cyclesBeforeSkip = window.RestReminder.state.stats.completedCycles;
click('#btn-start');
mockDateNow(2500);
click('#btn-skip');
assert(window.RestReminder.state.stats.focusSeconds >= focusBeforeSkip + 2, 'Skip should account elapsed focus seconds before skipping');
assert.strictEqual(window.RestReminder.state.stats.completedCycles, cyclesBeforeSkip, 'Skipping work should not count as a completed cycle');
assert($('#page-break').classList.contains('active'), 'Skip from work should open break-ready page');

// Break countdown should also use absolute time, not tick count.
click('#btn-start-break');
mockDateNow(30 * 1000);
tick();
assertText('#break-minutes', '00');
assertText('#break-seconds', '30');
mockDateNow(30 * 1000);
tick();
assertText('#status-text', '准备开始');

Date.now = _origDateNow;
window.Date.now = _origDateNow;
global.Date.now = _origDateNow;

console.log('Acceptance smoke tests passed.');
