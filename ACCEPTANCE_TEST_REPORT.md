# 休息提醒助手 - 验收测试报告

## 测试时间

2026-05-31（初版） · 2026-06-23（全面升级后复测）

## 自动化测试

```bash
npm test                # 全部测试
npm run test:acceptance # 渲染层验收
npm run test:unit       # 主进程 + AI 单元测试
```

结果：通过。

### 渲染层验收（acceptance-smoke.js）覆盖

- 启动初始状态显示"准备开始"。
- 设置工作时长并保存。
- Todo 添加、设为当前任务、计时页显示当前任务。
- 完整工作周期后完成周期 +1、当前 Todo 专注次数 +1。
- 工作结束后进入休息页。
- 跳过休息不增加休息次数、不触发"休息结束"通知。
- 清空全部 Todo 后可继续添加（自绘确认弹窗）。
- 统计页渲染今日周期和 7 天图表。
- 删除/清空 Todo 后任务专注分布仍保留。
- 重置今日统计后归零（自绘确认弹窗）。
- 预设切换、每日目标、CSV 导出、挂钟跳跃、亚秒漂移、暂停/恢复余数、跳过同步、休息倒计时。

### 主进程 + AI 单元测试（unit-main.js）覆盖

- settings-store：HTTPS only、HTTP 拒绝、SSRF 拦截（localhost/元数据/10.x/192.168）、URL 清洗。
- schemas：validateTasks（markdown 剥离、12 上限、默认优先级、空任务抛错、长标题截断）、validatePlan、validateReview（4 上限）、validateRestSuggestion、validateWeeklyReport（8 上限）。
- positions：clampWindowPosition 可见性钳制、loadPosition 缺失文件容错。

## 语法检查

以下文件通过 `node --check`：

- `main.js`、`preload.js`、`main/**/*.js`、`js/**/*.js`、`tests/*.js`

## 需要人工验证的项目

- 系统托盘图标、双击恢复、托盘菜单。
- Windows 桌面通知。
- 安装包安装 / 卸载。
- 主题切换（深色/浅色/跟随系统）实际显示效果。
- 数据备份导出/导入。
- 悬浮球多显示器跟随。

## 本次全面升级内容（2026-06-23）

### Bug 修复
- AI 默认模型名 `deepseek-v4-flash` → `deepseek-chat`（修复首次调用 404）。
- 修复 `styles.css` 损坏的 `.todo-actions` 规则（Todo 底部按钮恢复并排布局）。
- AudioContext 单例复用，避免频繁触发提示音导致上下文泄漏。
- AI enabled 检查策略统一（dailyPlan/dailyReview/weeklyReport 一致）。

### 安全加固
- AI API Key 改用 `safeStorage` 加密存储（明文不再落盘）。
- baseUrl 仅允许 HTTPS，移除 HTTP。
- SSRF 防护：拦截 localhost、127.0.0.1、169.254.*（元数据）、10.x、192.168、172.16-31、fd 前缀 ULA。
- 收紧 CSP：移除 `style-src 'unsafe-inline'`，floating.html 内联样式外置为 floating.css。

### 性能优化
- `saveStats` 节流（专注秒累加 1.5s 合并写入），关键节点 flush 立即写入。
- `renderStatsPage` 统计页不可见时短路。
- 计时显示秒级去重，避免高频 DOM 写。

### UX 改进
- 删除父任务、清空全部、重置统计、清空历史统一改用自绘确认弹窗。
- 主窗口可调整大小（min 360×480）。
- `spellcheck:false` 关闭拼写检查。
- 标题栏按钮 aria-label 无障碍标注。

### 功能增强
- 主题切换：深色 / 浅色 / 跟随系统。
- 稍后提醒时长可自定义（1-30 分钟）。
- 数据备份导出 / 导入（JSON）。
- 悬浮球首次定位跟随主窗口所在显示器。

### 代码与测试
- 新增公共 `js/utils.js`（clamp/$/$$/escapeHtml/throttle）。
- ESLint flat config + lint 脚本。
- 新增主进程 + AI 单元测试 22 项。
- 初始化 git 仓库（此前无版本控制）。

## 结论

核心业务逻辑自动化验收通过（渲染层 + 主进程 + AI）。真实系统级交互仍需手动验证。
