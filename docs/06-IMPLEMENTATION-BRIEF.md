# 桌面待办 · 实施说明（Agent Brief）

> 本文件是实施阶段的启动说明：把本文件的绝对路径交给实施 Agent，让它直接读取并开工。不要再复制粘贴旧「新会话提示词」，也不要重新做产品设计。

## 0. 先确认这几个位置

- 项目根目录：C:/Users/lazasons/Workspace/desktop-todo
- 规格主版本：项目根下的 docs/（**唯一实施读取源**）
- 设计与交互基准：项目根下的 design/
- 桌面副本：C:/Users/lazasons/Desktop/桌面待办-交付包/ 只用于查看/分享，可能滞后，**不作为实施读取源**
- 实施源码也放在项目根下；目录与工程边界按 `docs/09-PROJECT-STRUCTURE.md` 执行。`src/main/`、`src/preload/`、`src/renderer/src/`、`build/`、`resources/`、`scripts/` 已建好；`release/`、`out/` 由构建工具生成，不要另起目录。

## 1. 按顺序读这些文件

1. docs/00-README.md —— 项目总览、已确认决策、文件索引
2. docs/01-PRD.md —— 功能需求（FR-1…FR-10）、范围与边界
3. docs/02-DESIGN-SPEC.md —— 设计意图（色板、字体、三窗口、组件叙事）
4. docs/08-UI-ENGINEERING-SPEC.md —— **UI 实施契约：token、精确尺寸、状态矩阵、验收**
5. design/ui/tokens.css —— **唯一 token 源，原样复制到 src/renderer/src/styles/tokens.css**
6. docs/03-DATA-MODEL.md —— SQLite 表结构、路径/链接规则、迁移与导出
7. docs/04-TECH-PLAN.md —— Electron 架构、IPC 契约、关键实现
8. docs/09-PROJECT-STRUCTURE.md —— **工程目录规范：根目录、src 边界、命名、生成物、实施顺序**
9. docs/05-BACKLOG.md —— M0–M6 任务拆解（内部执行清单）
10. docs/07-ACCEPTANCE.md —— 功能/视觉/异常/打包/冒烟验收
11. design/app/ + design/app-*.png —— 当前可交互原型与状态截图，是视觉和交互基准；design/static-prototype.html + design/app-fullpage.webp 是同步后的静态原型与唯一整页长图，用于视觉验收对照
12. AGENTS.md —— 工程纪律；其中的 10 分钟超时决断规则同样适用

docs 里的相对链接写成 ../design/... 是相对 docs/ 目录；从项目根读取时对应 design/...。

## 2. 硬性约束（不可改）

- **纯本地单机**：无账号、无云同步、无网络请求、无遥测；SQLite 落在 %APPDATA%/DesktopTodo/data.db，内网可用。
- **主入口是桌面挂件**：352px 宽，默认「今天」，无边框、可拖动、置顶可切、位置记忆、多显示器；可收起为右下角胶囊；收起/展开状态也记忆。
- **完整窗口保留左栏**：收件箱 / 今天 / 已逾期 / 即将到期 / 已完成 + 项目 + 标签；项目/标签多时导航区滚动、底部设置固定。
- **筛选五维**：状态、日期、标签、优先级、关键词；组合可保存为「桌面视图」，挂件标题下拉切换。
- **每条任务可挂多个链接**：网页 → 默认浏览器；文件夹/文件 → 资源管理器；支持 UNC 共享盘、拖拽文件/文件夹、粘贴路径；禁止 file://、javascript: 和 shell 拼接。
- **不做系统级提醒**：不弹 Windows 通知；逾期只在界面标红（危险色 #C4553B）。
- **开机自启是设置项**（默认关）；托盘常驻；关窗只收进托盘；单实例。
- **UI 必须实现 08 + tokens.css**：暖纸底、陶土橙 #D97757 唯一强调、衬线标题、输入框三态、动效 80–350ms；dsh-claude-style 只是设计血统，不是可执行规格。禁止裸 hex/rgb、Tailwind/CSS-in-JS、原生 date/datetime-local/time 控件、点击遮罩关闭弹窗。
- Windows 10/11 x64；portable exe 优先，同时产出安装包；不要求管理员权限。

## 3. 实施要求

1. 按 docs/05-BACKLOG.md 建任务板，按 M0→M6 连续执行。这些里程碑只是内部检查点，**不是分批交付节点；必须一次做到 M6，不要每完成一个里程碑就停下等确认或汇报**。
2. 技术栈按 docs/04-TECH-PLAN.md：Electron 32+ / React 18 / TypeScript / better-sqlite3 / electron-builder；UI 按 08 + tokens.css 实现。
3. 每个里程碑完成后运行、截图，与 design/app/ 和 design/app-*.png 逐项对照，并检查 08 §5；通过后继续，不中断整体交付。
4. 不做规格外功能。遇到规格冲突、缺关键信息或不可恢复阻塞时按 AGENTS.md §6.1 处理：提问后最多等 10 分钟（真实时间，用户回复重置），超时自主选最合理、可撤回、与规格最一致的方案继续；不可逆/破坏性/生产数据/发布/外联/安装网络代码/扩权操作不得因超时自我批准，跳过并写入 memory/open-items.md，最终答复开头写「超时自主决断」。
5. 全部里程碑完成后按 08 §5 + 07 全量自测；打包 portable exe + 安装包，并写项目根 README.md（安装、SmartScreen、数据目录、备份、构建命令）。

**新功能 / UI·UX 调整（排除 Bug 修复）**：先在 `design/` 基于已定稿原型（`design/app/`，版本见 `design/README.md`）完整复制新建提案原型（`design/proto-v<版本>/` + `PROPOSAL-v<版本>.md`），经用户确认后再同步 `docs/` 规格与实施代码；不得直接修改已定稿原型。详见 AGENTS.md §4.2。

## 4. 完成定义

- [ ] 三种形态可用：桌面挂件 / 完整窗口 / 收起胶囊，数据实时同步
- [ ] 九视图、状态 Tab、五维筛选、桌面视图保存与切换可用
- [ ] 每条任务多链接，网页/文件夹/UNC/拖拽均能真实打开
- [ ] 项目/标签管理、删除二次确认、撤销、收件箱 B 口径、逾期判定均按规格
- [ ] 数据落本地 SQLite；重启、托盘、开机自启、单实例、位置/收起状态记忆正常
- [ ] 视觉按 08 与 design/app-*.png 验收，无裸 hex/原生日期控件/遮罩关闭
- [ ] 打包产物可运行；README 完整；最终答复给出源码位置、exe 位置、构建方式、验收结果、已知限制

## 5. 直接开始

读完上述文件后直接开始 M0，不需要先向用户确认计划。连续实施到整个工具完成、打包并验收后，再给最终答复。
