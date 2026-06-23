function parseJson(content) {
  const text = String(content || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(text);
}

function trimText(value, max) {
  return String(value || '').trim().slice(0, max);
}

function validateTasks(content) {
  const json = parseJson(content);
  const items = Array.isArray(json.tasks) ? json.tasks : [];
  const projectTitle = trimText(json.projectTitle || json.title || json.goal, 80);
  const tasks = items.slice(0, 12).map((item) => ({
    title: trimText(item.title, 80),
    estimatePomodoros: Number.isFinite(item.estimatePomodoros) ? Math.max(1, Math.min(8, Math.round(item.estimatePomodoros))) : 1,
    priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
  })).filter((item) => item.title);
  if (tasks.length === 0) throw new Error('AI_SCHEMA_INVALID');
  return { projectTitle, tasks };
}

function validatePlan(content) {
  const json = parseJson(content);
  const items = Array.isArray(json.plan) ? json.plan : [];
  const plan = items.slice(0, 12).map((item) => ({
    timeBlock: trimText(item.timeBlock, 40),
    task: trimText(item.task, 80),
    note: trimText(item.note, 120),
  })).filter((item) => item.task);
  return { summary: trimText(json.summary, 220), plan };
}

function validateReview(content) {
  const json = parseJson(content);
  return {
    summary: trimText(json.summary, 500),
    strengths: (Array.isArray(json.strengths) ? json.strengths : []).slice(0, 4).map((x) => trimText(x, 80)).filter(Boolean),
    suggestions: (Array.isArray(json.suggestions) ? json.suggestions : []).slice(0, 4).map((x) => trimText(x, 80)).filter(Boolean),
  };
}

function validateRestSuggestion(content) {
  const json = parseJson(content);
  return {
    suggestion: trimText(json.suggestion, 120),
    reason: trimText(json.reason, 160),
  };
}

function validateWeeklyReport(content) {
  const json = parseJson(content);
  const projectProgress = (Array.isArray(json.projectProgress) ? json.projectProgress : []).slice(0, 8)
    .map((p) => ({
      project: trimText(p.project, 60),
      focusMinutes: Number.isFinite(p.focusMinutes) ? Math.round(p.focusMinutes) : 0,
      description: trimText(p.description, 120),
    })).filter((p) => p.project);
  const suggestions = (Array.isArray(json.suggestions) ? json.suggestions : []).slice(0, 4)
    .map((x) => trimText(x, 80)).filter(Boolean);
  return {
    summary: trimText(json.summary, 500),
    bestDay: trimText(json.bestDay, 30),
    projectProgress,
    suggestions,
  };
}

module.exports = { validateTasks, validatePlan, validateReview, validateRestSuggestion, validateWeeklyReport };
