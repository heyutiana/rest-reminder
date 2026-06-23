const { chatCompletion } = require('./providers');
const prompts = require('./prompts');
const schemas = require('./schemas');

const LOCAL_REST_SUGGESTIONS = [
  { suggestion: '看向6米外的地方20秒，然后慢慢眨眼10次。', reason: '缓解长时间盯屏导致的眼部疲劳。' },
  { suggestion: '站起来做5次肩颈环绕，再伸展手腕30秒。', reason: '放松久坐后的肩颈和前臂肌肉。' },
  { suggestion: '离开座位喝几口水，做3轮深呼吸。', reason: '让身体从专注状态平稳切换到恢复状态。' },
];

function createAiService(settingsStore) {
  async function runJson(messages, validator) {
    const settings = settingsStore.getSettings();
    const content = await chatCompletion(settings, messages, { json: true, maxTokens: 900 });
    return validator(content);
  }

  async function testConnection() {
    await chatCompletion(settingsStore.getSettings(), [
      { role: 'system', content: '只输出严格 json。' },
      { role: 'user', content: '输出这个 json 对象：{"ok":true}' },
    ], { json: true, maxTokens: 50 });
    return { ok: true };
  }

  async function testConnectionWith(settingsInput) {
    const saved = settingsStore.getSettings();
    const settings = {
      ...saved,
      enabled: !!settingsInput.enabled,
      baseUrl: typeof settingsInput.baseUrl === 'string' ? settingsInput.baseUrl.trim().replace(/\/+$/, '') : saved.baseUrl,
      model: typeof settingsInput.model === 'string' ? settingsInput.model.trim() : saved.model,
      apiKey: typeof settingsInput.apiKey === 'string' && settingsInput.apiKey.trim() ? settingsInput.apiKey.trim() : saved.apiKey,
    };
    await chatCompletion(settings, [
      { role: 'system', content: '只输出严格 json。' },
      { role: 'user', content: '输出这个 json 对象：{"ok":true}' },
    ], { json: true, maxTokens: 50 });
    return { ok: true };
  }

  function assertText(value, max, name) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(name + '_INVALID');
    return value.trim();
  }

  function normalizeTaskCount(value) {
    return Math.max(1, Math.min(12, Math.round(Number(value) || 6)));
  }

  async function breakdownGoal(input) {
    const payload = input && typeof input === 'object' ? input : { goal: input };
    const taskCount = normalizeTaskCount(payload.taskCount);
    const data = await runJson(prompts.breakdownGoal(assertText(payload.goal, 500, 'GOAL'), taskCount), schemas.validateTasks);
    data.tasks = data.tasks.slice(0, taskCount);
    return data;
  }

  function requireEnabled() {
    const settings = settingsStore.getSettings();
    if (!settings.enabled || !settings.apiKey) throw new Error('AI_NOT_ENABLED');
  }

  async function dailyPlan(context) {
    requireEnabled();
    return runJson(prompts.dailyPlan(context || {}), schemas.validatePlan);
  }

  async function dailyReview(context) {
    requireEnabled();
    return runJson(prompts.dailyReview(context || {}), schemas.validateReview);
  }

  async function restSuggestion(context) {
    const settings = settingsStore.getSettings();
    if (!settings.enabled || !settings.apiKey) return LOCAL_REST_SUGGESTIONS[Math.floor(Math.random() * LOCAL_REST_SUGGESTIONS.length)];
    return runJson(prompts.restSuggestion(context || {}), schemas.validateRestSuggestion);
  }

  async function weeklyReport(context) {
    requireEnabled();
    return runJson(prompts.weeklyReport(context || {}), schemas.validateWeeklyReport);
  }

  return { testConnection, testConnectionWith, breakdownGoal, dailyPlan, dailyReview, restSuggestion, weeklyReport };
}

module.exports = { createAiService };
