function systemPrompt() {
  return '你是一个中文桌面番茄钟应用的AI专注助手。只输出严格 json，不要Markdown，不要解释。建议必须具体、短、可执行。';
}

function breakdownGoal(goal, taskCount) {
  taskCount = Math.max(1, Math.min(12, Math.round(Number(taskCount) || 6)));
  return [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: '把这个目标拆成1个父任务和' + taskCount + '个今日可执行子任务。父任务是目标名，子任务必须具体、可执行、适合用番茄钟推进；每项不超过30字，估算番茄钟数1-4，priority为high/medium/low。必须尽量输出正好' + taskCount + '个子任务。输出格式：{"projectTitle":"...","tasks":[{"title":"...","estimatePomodoros":1,"priority":"high"}]}。目标：' + goal },
  ];
}

function dailyPlan(context) {
  return [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: '根据Todo和今日目标生成今日专注计划。输出格式：{"summary":"...","plan":[{"timeBlock":"25分钟","task":"...","note":"..."}]}。上下文：' + JSON.stringify(context) },
  ];
}

function dailyReview(context) {
  return [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: '根据今日专注统计生成100-200字中文复盘，并给优点和建议。输出格式：{"summary":"...","strengths":["..."],"suggestions":["..."]}。数据：' + JSON.stringify(context) },
  ];
}

function restSuggestion(context) {
  return [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: '给一个适合当前工作后的休息建议，必须具体可执行。输出格式：{"suggestion":"...","reason":"..."}。上下文：' + JSON.stringify(context) },
  ];
}

function weeklyReport(context) {
  var days = typeof context.days === 'number' ? context.days : 7;
  return [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: '根据最近' + days + '天的专注统计数据生成一份中文周报，包含总览摘要（150字以内）、最强日期（哪天最专注）、各项目进展总结、2-3条下周改进建议。输出格式：{"summary":"...","bestDay":"...","projectProgress":[{"project":"...","focusMinutes":0,"description":"..."}],"suggestions":["..."]}。数据：' + JSON.stringify(context) },
  ];
}

module.exports = { breakdownGoal, dailyPlan, dailyReview, restSuggestion, weeklyReport };
