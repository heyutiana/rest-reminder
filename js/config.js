window.RestReminder = window.RestReminder || {};

window.RestReminder.DEFAULT_SETTINGS = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  dailyGoalMinutes: 120,
  theme: 'system',
  snoozeMinutes: 5,
};

window.RestReminder.DEFAULT_STATS = {
  focusSeconds: 0,
  completedCycles: 0,
  breakCount: 0,
  taskFocus: {},
  date: new Date().toDateString(),
};

window.RestReminder.PRESETS = [
  { name: '番茄钟', work: 25, brk: 5, longBrk: 15, interval: 4 },
  { name: '深度专注', work: 50, brk: 10, longBrk: 20, interval: 3 },
  { name: '学习模式', work: 45, brk: 15, longBrk: 30, interval: 3 },
  { name: '短冲刺', work: 15, brk: 3, longBrk: 10, interval: 4 },
];

window.RestReminder.state = {
  settings: { ...window.RestReminder.DEFAULT_SETTINGS },
  stats: { ...window.RestReminder.DEFAULT_STATS },
  timerState: 'idle',
  totalSeconds: 0,
  remainingSeconds: 0,
  lastTickAt: 0,
  phaseStartedAt: 0,
  phaseEndsAt: 0,
  phaseDurationMs: 0,
  lastAccountedAt: 0,
  focusRemainderMs: 0,
  pausedAt: 0,
  visualFrameId: null,
  intervalId: null,
  dayResetIntervalId: null,
  currentCycle: 0,
  todos: [],
  currentTodoId: null,
  dailyHistory: {},
};

window.RestReminder.CIRCUMFERENCE = 2 * Math.PI * 88;

window.RestReminder.clamp = function (val, min, max) {
  return Math.max(min, Math.min(max, val));
};
