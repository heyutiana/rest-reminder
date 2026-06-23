const assert = require('assert');
const path = require('path');

// Mock electron module before requiring modules that depend on it.
const electronMock = {
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s) => Buffer.from(s, 'utf8'),
    decryptString: (b) => b.toString('utf8'),
  },
  screen: {
    getAllDisplays: () => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
    getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }),
    getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
  },
  app: { getPath: () => '/tmp' },
  BrowserWindow: class {},
  Menu: { buildFromTemplate: (t) => t },
  Tray: class {},
  ipcMain: { on: () => {}, handle: () => {} },
  Notification: class {},
  globalShortcut: { register: () => true, unregister: () => {}, isRegistered: () => false },
};
require.cache[require.resolve('electron')] = { exports: electronMock };

const root = path.join(__dirname, '..');

let passed = 0;
function ok(name) { passed++; console.log('  ok - ' + name); }
function run(name, fn) {
  try { fn(); ok(name); } catch (err) { console.error('  FAIL - ' + name + ': ' + err.message); process.exitCode = 1; }
}

console.log('settings-store sanitize:');
const { sanitizeBaseUrl, isValidHttpUrl } = require(path.join(root, 'main', 'ai', 'settings-store.js'));
run('https URL is valid', () => { assert.strictEqual(sanitizeBaseUrl('https://api.deepseek.com'), 'https://api.deepseek.com'); });
run('http URL is rejected', () => { assert.strictEqual(sanitizeBaseUrl('http://api.deepseek.com'), ''); });
run('localhost is rejected (SSRF)', () => { assert.strictEqual(sanitizeBaseUrl('http://127.0.0.1:8080'), ''); });
run('metadata endpoint rejected (SSRF)', () => { assert.strictEqual(isValidHttpUrl('https://169.254.169.254'), false); });
run('private 10.x rejected (SSRF)', () => { assert.strictEqual(isValidHttpUrl('https://10.0.0.1'), false); });
run('private 192.168 rejected (SSRF)', () => { assert.strictEqual(isValidHttpUrl('https://192.168.1.1'), false); });
run('trailing slash trimmed', () => { assert.strictEqual(sanitizeBaseUrl('https://api.deepseek.com/'), 'https://api.deepseek.com'); });
run('invalid input returns empty', () => { assert.strictEqual(sanitizeBaseUrl('not a url'), ''); });
run('non-string returns empty', () => { assert.strictEqual(sanitizeBaseUrl(123), ''); });

console.log('schemas:');
const schemas = require(path.join(root, 'main', 'ai', 'schemas.js'));
run('validateTasks normal', () => {
  const r = schemas.validateTasks('{"projectTitle":"学英语","tasks":[{"title":"背单词","estimatePomodoros":2,"priority":"high"}]}');
  assert.strictEqual(r.projectTitle, '学英语');
  assert.strictEqual(r.tasks.length, 1);
  assert.strictEqual(r.tasks[0].title, '背单词');
  assert.strictEqual(r.tasks[0].priority, 'high');
});
run('validateTasks strips markdown fence', () => {
  const r = schemas.validateTasks('```json\n{"tasks":[{"title":"A"}]}\n```');
  assert.strictEqual(r.tasks.length, 1);
  assert.strictEqual(r.tasks[0].title, 'A');
});
run('validateTasks caps at 12', () => {
  const tasks = Array.from({ length: 20 }, (_, i) => ({ title: 't' + i }));
  const r = schemas.validateTasks(JSON.stringify({ tasks: tasks }));
  assert.strictEqual(r.tasks.length, 12);
});
run('validateTasks default priority medium', () => {
  const r = schemas.validateTasks('{"tasks":[{"title":"A"}]}');
  assert.strictEqual(r.tasks[0].priority, 'medium');
});
run('validateTasks empty tasks throws', () => {
  assert.throws(() => schemas.validateTasks('{"tasks":[]}'), /AI_SCHEMA_INVALID/);
});
run('validatePlan filters items without task', () => {
  const r = schemas.validatePlan('{"summary":"plan","plan":[{"task":"A"},{"note":"no task"}]}');
  assert.strictEqual(r.plan.length, 1);
  assert.strictEqual(r.plan[0].task, 'A');
});
run('validateReview arrays capped at 4', () => {
  const r = schemas.validateReview('{"summary":"r","strengths":["a","b","c","d","e"],"suggestions":["x"]}');
  assert.strictEqual(r.strengths.length, 4);
  assert.strictEqual(r.suggestions.length, 1);
});
run('validateRestSuggestion trims', () => {
  const r = schemas.validateRestSuggestion('{"suggestion":"  look away  ","reason":"eye"}');
  assert.strictEqual(r.suggestion, 'look away');
});
run('validateWeeklyReport caps projectProgress at 8', () => {
  const pp = Array.from({ length: 12 }, (_, i) => ({ project: 'p' + i, focusMinutes: 10 }));
  const r = schemas.validateWeeklyReport(JSON.stringify({ summary: 'w', projectProgress: pp, suggestions: [] }));
  assert.strictEqual(r.projectProgress.length, 8);
});
run('validateTasks truncates long title', () => {
  const long = 'x'.repeat(200);
  const r = schemas.validateTasks(JSON.stringify({ tasks: [{ title: long }] }));
  assert.ok(r.tasks[0].title.length <= 80);
});

console.log('positions:');
const positions = require(path.join(root, 'main', 'positions.js'));
run('clampWindowPosition keeps within work area', () => {
  const p = positions.clampWindowPosition(500, 500, 72, 72);
  assert.ok(p.x >= -72 + 24);
  assert.ok(p.y >= 0);
});
run('clampWindowPosition pulls back offscreen-right', () => {
  const p = positions.clampWindowPosition(5000, 500, 72, 72);
  assert.ok(p.x <= 1920 - 24);
});
run('loadPosition returns null for missing file', () => {
  const p = positions.loadPosition(path.join(__dirname, 'definitely-nonexistent-' + Date.now() + '.json'));
  assert.strictEqual(p, null);
});

console.log('\n' + passed + ' unit assertions passed.');
