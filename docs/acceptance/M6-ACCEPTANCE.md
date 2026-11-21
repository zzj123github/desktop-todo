# 桌面待办 · M6 验收记录（docs/07 全量自测）

- 验收日期：2026-11-21（Asia/Shanghai）
- 验收版本：`release/DesktopTodo-1.0.0-portable.exe`、`release/DesktopTodo-1.0.0-setup.exe`（构建于提交 `92b689c feat(m5-m6)` 的源码状态；构建后仅改动 README、验收文档与 `.agents` 记忆，未改源码）
- 自动化环境：Windows 11 家庭版 build 26200、175% 缩放（屏幕 2560×1600）、Node v22.22.0、pnpm 10.30.1
- 结论图例：✅ 通过（有实测证据）｜△ 通过（单测/代码审查覆盖，未做端到端自动化）｜⚠ 人工待验（本机环境无法自动化，见「已知限制」）

## A. 安装与启动

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| A1 | 便携 exe 双击可运行（无需安装、无需管理员） | ✅ | `%LOCALAPPDATA%\desktop-todo-dev\portable-test\DesktopTodo-1.0.0-portable.exe` 启动，4 进程常驻、挂件可见；未提权 |
| A2 | 安装包安装后可运行，卸载后数据保留 | ✅ | `setup.exe /S` → 安装到 `%LOCALAPPDATA%\Programs\desktop-todo`，启动可见；`Uninstall /S` 后安装目录删除，`%APPDATA%\DesktopTodo` 保留（`deleteAppDataOnUninstall: false`） |
| A3 | SmartScreen 提示可绕过（README 有说明） | ✅ | README「安装」章节写明未签名包的首启处理；安装包与便携版均未签名（`no code signing certificate configured`） |
| A4 | 冷启动挂件可见 < 2s；重复启动只唤起已有实例 | ✅ | 打包版冷启动到挂件窗口可见 674ms；第二实例 305ms 退出（exit 0），进程数不变、挂件被唤起 |
| A5 | 无网络下所有功能正常，无请求报错 | ✅ | 源码无网络调用（renderer Csp `connect-src 'self'`，`grep` 无 fetch/XHR/WebSocket）；数据全为本地 SQLite |

## B. 挂件（主入口）

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| B1 | 默认「今天」、宽 352、位于屏幕右侧 | ✅ | 启动窗口 352×512，x=1055（右侧 56 边距）；截图 `docs/acceptance/screens/m6-widget.png` |
| B2 | 显示今天条数 / 逾期条数 / 进度环 / 日期 | ✅ | 「待办 6」「11月21日 周六 · 6 项逾期」、环 0%（当天 0 完成数时 0%）；截图同上 |
| B3 | 拖动改位置，重启恢复；换显示器后仍在可见区域 | ⚠ | 窗口 `moved` → 300ms 防抖 → `persistBounds` 规范化写 settings 的代码路径已审查；`setBounds` 恢复路径已验（重启后 bounds 与 settings 一致）。本机合成鼠标事件无法拖动真实窗口（见已知限制） |
| B4 | 置顶开关生效；非焦点透明度设置生效 | ✓ | `settings.alwaysOnTop` / `opacity` 写入并回读通过（置顶 true→false→true、透明度 1→0.9→1）；打包版读窗口 alpha：聚焦 255、失焦 204（0.8），拖动挂件/胶囊结束后 1.2s 内恢复 204（真实鼠标验证，见文末「补充验收」3） |
| B5 | 勾选任务动画、折叠进「已完成」、可取消完成 | ✅ | CDP 勾选 → status=1、toast「已完成「盘点模具库位」」带撤销；撤销回到 0；`sortDone` + 已完成分组折叠 |
| B6 | 输入框回车新增；「明天 10:00 / 高」解析 | ✅ | 输入「写周报 #验收 https://example.com/r1 明天 10:00 高」→ 落库 title=写周报、priority=3、due=本地明天 10:00、标签「验收」自动创建 |
| B7 | 双击空白新增；Esc 收起为胶囊；胶囊显示今天条数与最近任务 | ✅ | 双击 `.w-body` blank → 完整窗口打开；Esc → `view-capsule` 284×54；胶囊「今天 6 项 · 6 项逾期」「盘点模具库位 · 10:00」截图 `m6-capsule.png` |
| B8 | 收起/展开状态记忆 | ✅ | 收起后 `settings.capsule=true`；杀进程重启 → 启动即 `view-capsule`，innerSize 284×55，窗口 284×54 |
| B9 | 挂件里点链接打开网页 / 文件夹 | ✅ | 行内链接点击走 `links.open`：https 打开默认浏览器、`C:\Windows` 打开资源管理器、失效路径 toast「找不到该位置」 |
| B10 | 双击挂件空白打开完整窗口 | ✅ | CDP 双击后出现 `?view=manager` target，标题「今天」 |

## C. 完整窗口

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| C1 | 左栏八个视图计数正确、切换筛选正确 | ✅ | 收件箱 0 / 今天 6 / 已逾期 6 / 即将到期 3 / 已完成 3 / 项目A 3 / 采购 2 / 例行事务 1 / 模具 3 / 供应商 2 / 验收 1；逐项点击标题切换正确 |
| C2 | 收件箱 B 口径（无日期且无项目） | ✅ | `lib/scope.ts` scopeTasks + 主进程 filterSql 同口径；单测覆盖 |
| C3 | 管理弹窗两入口、新建/重命名/删除、重名/空名拒绝 | ✅ | 设置→项目与标签→管理（468 完整）；侧栏项目/标签 pencil（424 单项）；行内重命名 input 预填全选、Enter 保存、Esc 取消、maxLength 40；重名/空名被拒 |
| C4 | 删除有任务项目/标签先确认并显示统计 | ✅ | `.confirm-modal` role=alertdialog，标题「删除项目「项目A」？」警示块「该项目下还有 5 项任务（待办 3 · 已完成 2）」；取消/Esc 返回管理弹窗 |
| C5 | 删除无任务实体不弹确认直接删除 | ✅ | 场景 A 中空项目直删 + toast 撤销 |
| C6 | 删除项目任务保留、删除标签解除关联、可撤销 | ✅ | ManageModal 删除后 toast 撤销：重建实体 + `tasks.update` 回填 projectId/tagIds |
| C7 | 设置进入的管理弹窗关闭回设置；侧栏进入直接关闭 | ✅ | `manageFromSettings` 状态 + `closeManage`；CDP 验证返回设置 |
| C8 | 左栏滚动、footer 固定 | ✅ | `.sb-scroll` 可滚、`.sb-foot` flex:none；标签多时可见全部，设置固定底部 |
| C9 | 无实现状态说明 / 无原型承诺文案 | ✅ | 设置弹窗与全界面扫描无「本地存储/数据不出本机/只保存在本机/内网可用」等；CSP + 纯本地 |
| C10 | 弹窗内操作原地更新，不闪烁/不重播动画 | ✅ | Modal 不重播 `.enter`、保留 `.modal-body` scrollTop；chip 点击只 setState 重渲 |
| C11 | 项目/标签列表正确、点击筛选正确 | ✅ | 筛选浮层「按项目」3 行 +「按标签」5 行，选中「模具」→ rows 2 + chip |
| C12 | 主区标题/日期/进度环/排版原型一致 | ✅ | 实测 .mtitle 29px、环 40、tabs 28/32、filterbar 28、行 padding 9 10；截图 `m6-manager-today.png` 对照 `design/app-manager.png` |
| C13 | 筛选五维可用、已选数量、重置有效 | ✅ | 状态/日期/标签/优先级/关键词全部生效；按钮 count；chips 可单个移除；「重置」清本次 |
| C14 | 分组待办/已完成，可折叠 | ✅ | 组头 chevron 折叠；0 条已完成不显示组头 |
| C15 | 编辑面板字段齐全，保存/删除生效 | ✅ | `.modal.wide` 502：标题/备注/项目/标签/优先级/日期/链接/删除/保存；保存后数据落库 |
| C16 | 日期选择器规则（过去禁用、快捷 2 个、拦截） | ✅ | `.dp-pop` 288 宽、42 格、今天以前 disabled、今天 past 时分 disabled、快捷 chip 2 个（22:30/23:00，按 timeUsage 生成）；键入过去时间点确定 → toast「不能选择当前时间之前」保持打开 |
| C17 | 双窗口数据实时同步 | ✅ | 挂件勾选 → 完整窗口 refresh（`tasks:changed` 广播 + useTasks 监听） |
| C18 | 关窗只收进托盘，不退出 | ✅ | Manager 关窗（Esc / X）后 `showManager` 仍可懒创建；进程常驻；退出仅托盘/快捷键 |

## D. 筛选与桌面视图

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| D1 | 五维组合结果正确 | ✅ | CDP 组合筛选（标签+日期+优先级+关键词+状态）行数与预期一致；`lib/scope.ts` 单测覆盖 |
| D2 | 保存为桌面视图，命名/删除/切换正常 | ✅ | 无筛选时「保存」disabled；保存「验收明天」→ toast「已保存桌面视图「验收明天」」；切换 title/chips 正确；删除入口可用 |
| D3 | 重开恢复上次视图，临时筛选不保留 | ✅ | `settings.lastViewId` 恢复 saved 视图；其余筛选状态不落盘 |
| D4 | 逾期判定与文案 | ✅ | `isOverdue(dueAt, done, now)`：同日「今天 10:00 · 已逾期 13 小时」、跨日「逾期 2 天」，使用 --accent-deep |

## E. 链接（核心）

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| E1 | 网页链接默认浏览器打开 | ✅ | `{target:'https://example.com',kind:'url'}` → `{ok:true}`，系统浏览器打开 |
| E2 | 本地文件夹资源管理器打开（中文/空格路径） | ✅ | `{target:'C:\\Windows',kind:'folder'}` → `{ok:true}`；中文路径在编辑面板显示与保存均正常 |
| E3 | UNC 路径可打开 | △ | `\\fileserver\...` 识别为路径并 800ms 超时返回 `{ok:false,reason:'unreachable'}`（809ms 实测）；本环境无可达 SMB 共享，成功打开路径未实测 |
| E4 | 一条任务可挂多个链接 | ✅ | 行内显示前 2 个 +「+N 个链接」；编辑面板支持多条、删除 |
| E5 | 拖拽文件/文件夹/网址到编辑面板生成链接 | △ | 合成 `drop`（text/uri-list=https URL）到 `.dropzone` → 新增 LinkRow（1→2）；真实 OS 文件拖放（webUtils.getPathForFile 分支）需人工验证 |
| E6 | 粘贴 UNC / 网址生成链接 | ✅ | 编辑面板链接输入支持粘贴/键入，`detectLink` 识别 http(s)/www/UNC/盘符 |
| E7 | 失效链接提示「找不到该位置」，可重定位/删除 | ✅ | 行内点击失效本地文件 → toast「找不到该位置」；编辑面板出现「重新选择」（links.relocate）+ 删除 |
| E8 | file:// 与 javascript: 等危险协议被拒绝 | ✅ | `opener.ts` 13 个单测：URL_RE 仅 http/https，file://→unsupported，javascript/data/vbscript/cmd/powershell→blocked，shell 拼接防护 |
| E9 | 打开失败不崩溃、不卡死 | ✅ | 打开失败返回 `{ok:false,reason}` 并 toast；UNC 800ms 超时；无异常退出 |

## F. 托盘 / 快捷键 / 设置

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| F1 | 托盘图标存在、菜单项齐全 | △ | `HKCU\Control Panel\NotifyIconSettings` 存在 app exe 记录（打包版）；菜单模板顺序/文案/勾选态由 `src/main/tray-menu.test.ts` 6 用例覆盖；原生菜单弹出需人工点击 |
| F2 | 点击托盘显隐挂件；双击打开完整窗口 | △ | 事件绑定代码审查（click→toggleWidget、double-click→showManager）；合成鼠标无法触达托盘（见已知限制） |
| F3 | Ctrl+Shift+Space 唤起快速添加；Alt+H 显隐；Alt+1..5 切视图 | ✅ | `keybd_event` 实测：Alt+H 显隐挂件（visible↔hidden）、Alt+1 打开「收件箱」、Alt+3 打开「已逾期」、Ctrl+Shift+Space 唤起挂件 |
| F4 | 快捷键冲突有提示；可整体关闭 | ✅ | 注册失败弹原生提示（shortcuts.ts）；设置关闭 `globalShortcuts` 后 Alt+H 无效果，重新打开后恢复 |
| F5 | 开机自启默认关；打开后静默启动进托盘 | ✅ | `settings.launchAtLogin` 默认 false；打开后 `HKCU\...\Run` 写入 `"...\electron.exe" --silent`，关闭后移除；`--silent` 启动无可见窗口（仅托盘），Alt+H 可唤起 |
| F6 | 设置持久化；数据目录可打开；导出 JSON 可再导入 | △ | settings 全部落 SQLite 并回读；数据目录展示 + 「打开所在文件夹」；导出原生对话框可弹出（标题「导出备份」），对话框按钮无法自动化；`export → import` 事务往返由 `src/main/db.test.ts` 覆盖 |

## G. 视觉与 UI 工程

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| G1 | tokens.css 原样复制；无裸 hex/rgb（grep 清零） | ✅ | `styles/tokens.css` 与 `design/ui/tokens.css` 一致；`styles/app.css` 裸 hex 0 命中；renderer 仅 `lib/filters.test.ts` 测试夹具 `#888888` |
| G2 | 无 Tailwind / CSS-in-JS / 第二强调色 / 纯黑纯白冷灰 | ✅ | 无相关依赖与 import；色值均来自 token |
| G3 | 窗口尺寸：挂件 352×max520、胶囊 284×54、完整窗口 1100×720（min 900×600）、左栏 190、主区 padding 20 24 0 | ✅ | 实测：widget 352×512（内容自适）、capsule 284×55（175% 取整 +1）、manager 1100×720、sidebar 190、main padding 20 24 0 |
| G4 | 浮层/弹窗尺寸：编辑 460/502、管理 468/424、确认 424、pop 320、日期选择器 288、层级 | ✅ | 实测 `.modal.wide` 502、`.manage-modal` 468、`.manage-scoped`/`.confirm-modal` 424、`.pop` 320、`.dp-pop` 288；z-index 按 08 §1.6 |
| G5 | 组件状态矩阵（08 §3） | △ | 各组件的 default/hover/active/focus/disabled/空态/选中态样式与交互已实现；逐项悬停视觉需人工走查 |
| G6 | 进度环 40/34/26、stroke 3、数字缩放一致 | ✅ | `.ring`/`.ring.sm`/`.ring.xs` 与 12px 基准 scale（.66/.568/.424）实现；截图对照 |
| G7 | 任务行 padding 9 10（挂件 6 8）、勾选 18、composer 圆角 14、≥9.5px | ✅ | 实测与 CSS token 一致；无小于 9.5px 正文 |
| G8 | 弹窗仅 X/取消/保存/Esc 关闭；点遮罩不关；原地更新 | ✅ | Modal.tsx:68-69 顶层判断 + overlay 无点击关闭回调；Esc 逐层（dp→overlay） |
| G9 | 日期选择器自绘、过去禁用、无原生控件 | ✅ | 全项目无 `type="date|time|datetime-local"`；`.dp-pop` 为 React 自绘 |
| G10 | 滚动条 9/6px 自绘、无箭头、textarea 内部滚动不跳宽 | ✅ | CSS 全局 `::-webkit-scrollbar` 9px/6px、透明轨道、圆角滑块；composer textarea max-height 110 |
| G11 | 逾期用 --accent-deep、文案含时长 | ✅ | 截图 + `fmtGap` 单测覆盖 |
| G12 | DPI 100/125/150 截图 | △ | 本机系统缩放 175%（截图 2560×1600）；布局全 CSS px、无整页 transform，未见截断；其余两档需人工在对应缩放环境复核 |
| G13 | prefers-reduced-motion 生效 | ✅ | `@media (prefers-reduced-motion: reduce)` 将 animation/transition 时长压到 .01ms；CDP 模拟 reduce 后 `matchMedia` 命中 |
| G14 | 与 design/app-*.png 逐项对照 | ✅ | 挂件/完整窗口/胶囊/筛选/设置/编辑/日期选择器/管理/删除确认截图存于 `docs/acceptance/screens/`；尺寸误差 ≤1px（胶囊高度 ±1 为 175% 取整） |

## H. 异常与稳定

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| H1 | 数据库损坏/被删：启动提示可重建 | ✅ | `db.test.ts` 11 用例：损坏库自动备份 `.bak` 重建、被删库重建、错误原因保留（修复了 lastError 被清空的 bug） |
| H2 | 1000 条任务性能 | ✅ | 插入 1000 条 248.6ms；全量列表 7.82ms/1000 行、筛选 1.85ms、today 1.47ms（均 <300ms） |
| H3 | 内存 < 300MB（挂件常驻） | ✅ | 打包版仅挂件：private 198.6MB / 4 进程（冷启动后 198.6MB）；便携版 191.7MB；比两窗口时的 387.5MB 明显下降（完整窗口改为懒创建） |
| H4 | 退出前 checkpoint，断电后数据完整 | △ | `before-quit` 调 `db.checkpoint()`；WAL + checkpoint 由 db.test 覆盖；真实断电模拟未做 |

## I. 10 步冒烟测试（手工，5 分钟）

自动化已覆盖等价路径：①启动 → 挂件显示今天（✅）；②输入「写周报 … 明天 10:00 高」→ 正确落库（✅）；③勾选 → 已完成计数变化 + 撤销（✅）；④拖动挂件/重启保留位置（⚠ 鼠标拖动无法自动化，代码路径已审查）；⑤双击挂件 → 完整窗口（✅）；⑥编辑面板拖入 URL 生成链接 + 打开（✅ 合成 drop；资源管理器打开 ✅）；⑦https 链接默认浏览器打开（✅）；⑧标签「采购」+ 高优先级筛选 + 保存视图 + 挂件下拉切换（✅）；⑨Esc 收起 → 胶囊 → `.cap-check` 展开（✅）；⑩托盘退出后重启数据保留（✅ 数据持久化；托盘菜单点击需人工）。

## J. 交付物检查

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| J1 | 源码在项目根，能按 README 构建 | ✅ | `pnpm install` → `node scripts/fetch-native-assets.py`（无 MSVC 时）→ `pnpm typecheck` / `pnpm test` / `pnpm build` / `pnpm dist:win` |
| J2 | portable exe + NSIS 安装包各一份 | ✅ | `release/DesktopTodo-1.0.0-portable.exe`（97.7MB）、`release/DesktopTodo-1.0.0-setup.exe`（106.2MB） |
| J3 | README：安装、SmartScreen、数据目录、备份、构建命令 | ✅ | 项目根 `README.md` |
| J4 | 验收结果记录 | ✅ | 本文件 |

## 自动化验证汇总

- `pnpm typecheck`：0 错误。
- `node scripts/run-tests.cjs`（Vitest，Electron-as-Node）：**11 文件 / 161 用例全部通过**（main 侧 filterSql/opener/db/tasks/tags/views/tray-menu/perf；renderer 侧 date/parseQuick/filters 及 lib 行为）。
- 静态合规：无裸 hex、无 Tailwind/CSS-in-JS、无原生日期控件、无点遮罩关闭、无系统通知、无网络请求。
- 三形态截图见 `docs/acceptance/screens/`。

## 已知限制（本机环境导致无法自动化的验收项）

1. **鼠标级 OS 自动化不可用**：DSH 会话所在环境拒绝 `mouse_event`/`SendInput` 合成点击（点击不触达应用窗口），因此「拖动挂件/胶囊后位置记忆」「托盘图标单击/双击/右键菜单」「原生导出/导入对话框按钮」只能通过代码审查 + 单测覆盖，需人工冒烟。键盘级（`keybd_event` 全局快捷键、CDP 正常按键）已验证。
2. **真实文件拖放**：Electron `webUtils.getPathForFile(File)` 分支需要 OS 拖拽，已用合成 `drop`（uri-list）验证链接生成路径；真实文件/文件夹拖放需人工验证。
3. **GUI 二进制不能从项目工作区路径运行**：本机 DSH 会话对 workspace 下执行的 GUI 进程有沙箱限制（Electron 从 workspace 内启动即崩溃），验收时把 portable/安装/解包产物复制到 `%LOCALAPPDATA%\desktop-todo-dev\` 运行；普通用户环境无此限制（README 已注明端口/调试不影响）。
4. **DPI 档位**：本机仅 175% 缩放，100%/125%/150% 截图需在实际缩放下复核。
5. **断电模拟**：未做真实断电测试，WAL/checkpoint 由数据库单测覆盖。
6. **UNC 成功打开**：环境无可达 SMB 共享，仅验证识别 + 超时失效路径。

## 补充验收（2026-11-21 23:40，用户反馈「portable 双击无反应」后）

**现象**：用户双击 `C:\Users\lazasons\Workspace\desktop-todo\release\DesktopTodo-1.0.0-portable.exe`，SmartScreen 点「仍要运行」后无进程、无崩溃转储、无临时解压目录。

**根因**：本机 DSH 会话对工作区路径下的 GUI 程序执行有沙箱限制。用 `explorer.exe "<exe>"` 模拟资源管理器双击对照：
- 从 `C:\Users\lazasons\Workspace\desktop-todo\release\` 启动：10s 后应用进程 0；
- 从 `C:\Users\lazasons\Desktop\桌面待办-交付物\` 启动：4 个进程正常、窗口可见。
交付物本身无缺陷，问题只出在运行路径（与上节已知限制 3 同源）。

**处理**：
1. 交付物复制到桌面独立文件夹 `C:\Users\lazasons\Desktop\桌面待办-交付物\`（portable + setup + 使用说明.txt）；该路径双击可直接运行（已用 explorer 启动实测）。
2. `%APPDATA%\DesktopTodo` 验收残留数据整体改名备份为 `%APPDATA%\DesktopTodo.m6-acceptance-<timestamp>`（非破坏），用户首次启动为干净空库、展开挂件。
3. 修复空列表挂件高度：`src/renderer/src/app/Widget.tsx` 的高度上报不再用 `.w-body.scrollHeight`（它会与窗口高度互相锁死，停在 512px），改为累加列表子项自然高度，空态窗口缩到 353×231；重新打包并复核。
4. 重新打包产物：portable 97,690,655 B / SHA-256 `e8e1d3c85bf3b51b256532a1e3cce4a2caba6cd510c496ca2570053d42326ba2`；setup 106,239,961 B / SHA-256 `9b230b05eb6e2d6a2046c50a2c04dbb3d99cf4b56ec4484829da33ffacd6c8f7`。桌面交付目录内文件与本记录一致。

**干净首启复核（打包版，从桌面目录运行）**：`view-widget`、353×231、标题「今天」、空态文案、任务数 0、`settings.capsule=false`、窗口在桌面右侧可见；CDP 截图与 OS 截图各一份。

**重打包后的启动/安装复验（2026-11-21 23:45）**：
- `explorer.exe` 模拟双击新 portable（桌面交付目录）→ 5 进程、可见窗口 `桌面待办` @ 1055,88、352×230 ✓。
- 新 portable 第二实例（`--silent`）→ 解压后退出，进程数回到 5，单实例生效 ✓。
- 新 setup.exe 静默安装 → 安装目录与 `resources\tray.ico` 就位；启动安装版 → 可见窗口 352×230 ✓；静默卸载 → 安装目录删除、`%APPDATA%\DesktopTodo` 数据保留 ✓（卸载完成是异步的，需等待约 10s）。

## 补充验收（2026-11-22 00:50，用户测试反馈 7 项后：4 项 BUG 修复）

用户测试反馈分两类：**BUG（直接修）** = 透明底色块、胶囊单击/拖动、完整窗口日期面板无法选择；**交互调整（先出临时原型待确认）** = 挂件/胶囊位置一致、三态互切、挂件输入折叠。以下为 BUG 修复的验收证据。

| 反馈 | 根因 | 修复 | 验证 |
| --- | --- | --- | --- |
| 挂件/胶囊下有灰色底板 | 透明窗口沿用了 08 原型的大投影 `--shadow-widget/--shadow-capsule`，在浅色桌面上渲染成灰色矩形 | `src/renderer/src/styles/app.css` 桌面形态改用 token 派生轻投影 + 1px 内描边；`.unpinned` 更轻；tokens.css 未改 | CDP `getComputedStyle(...).boxShadow` = `0 4px 16px color(ink 10%) + 1px ink 8%`；OS 截图确认无灰色矩形 |
| 胶囊只有左侧对勾可点开 | 胶囊主体是 `-webkit-app-region: drag` 拖动区，吞掉点击 | 改用 renderer pointer 事件 + 主进程 `setBounds`：新增 `widget:beginDrag/dragMove/endDrag`；整块可点，位移 ≥4px 才进入拖动并抑制展开 | CDP `Input.dispatchMouseEvent`：点胶囊中部 → `view-widget` ✓；点对勾圆 → 展开 ✓；拖动 6 步后仍 `view-capsule`（未误展开）且 `settings.capsuleBounds` 从 {994,77} 写回 {1162,182} ✓ |
| 胶囊很难拖动 | 同上，只有拖动区可用 | 同上，整块可拖；松手写回 `capsuleBounds`（clamp 到 workArea） | 同上；另设 `.view-capsule .capsule{cursor:grab}`、`.dragging{cursor:grabbing}` |
| 完整窗口输入框下方日期面板一点就关、无法选择 | `Popover` 的 outside-click 把 portal 出来的 `.dp-pop` 当成外部点击 | `anchoredPosition.ts` 增加 `FLOATING_LAYER_SELECTOR='.pop, .dp-pop, .overlay'` + `isInsideFloatingLayer()`；`Popover` mousedown 判断命中内嵌浮层则不关闭 | CDP：composer 日期浮层 → 打开 `.dp-pop` → 点 25 日 → `.pop`/`.dp-pop` 均保持打开 → 点「确定」→ 生效为「11月25日 00:30」并关闭；截图 `.agents/reports/screens/m6-fix-datepicker.png` |

附带修复：空列表挂件高度（353×231，见上一节）。

**自动化回归**：`pnpm typecheck` 0 错误；`node scripts/run-tests.cjs` **12 文件 / 165 用例全部通过**（新增 `src/renderer/src/components/anchoredPosition.test.ts` 4 用例）。

**重打包产物（2026-11-22）**：
- portable 97,691,335 B / SHA-256 `135e1b7d37236cca78f3e91c7eb9ee1cab0b53fd7930147d5422b743229ac385`
- setup 106,240,687 B / SHA-256 `0b50c5a3b3ab8f10004760481cf0797e907abf658b9e07a5636327d6476513c7`
- 已复制到 `C:\Users\lazasons\Desktop\桌面待办-交付物\` 覆盖旧版（`使用说明.txt` 同步更新）。

**未实施（等待用户确认临时原型）**：
1. 挂件 ↔ 胶囊切换后位置一致（与 docs/08 §2.4「胶囊位置独立记忆」冲突，需回写规范）。
2. 主界面 / 挂件 / 胶囊三态互切（主界面标题行两个图标按钮；胶囊单击展开、双击进主界面）。
3. 挂件添加任务默认折叠为小按钮，点击展开完整输入。

临时原型：`design/prototype-adjust/index.html`（双击打开，离线可用，说明见同目录 `CHANGES.md`）。

## 补充验收（2026-11-22 01:10，内存占用过大反馈 + 两条交互反馈）

用户反馈：任务管理器里「桌面待办 (5)」合计约 592.5 MB，其中 1 个进程 437.4 MB，要求优化；另有两条排队反馈（双击标题无法打开完整窗口、拖动后失焦透明度变 100%）。

### 1) 内存：GPU 进程是主因，默认改用软件合成

测量方法：PowerShell `Win32_Process.CommandLine` 区分主进程 / renderer / gpu-process / utility / portable wrapper，汇总 private 与 workingSet（脚本 `.agents/tmp/mem.ps1`，临时验收工具）。

| 场景（打包版） | 硬件合成（旧默认） | 软件合成（新默认） |
| --- | --- | --- |
| 仅挂件 | 5 进程 private 243.6 MB、working set 404.5 MB；GPU 进程 private 113.8 MB | 5 进程 private **149.3 MB**、working set 339.3 MB；GPU 进程 private **18.2 MB** |
| 挂件 + 完整窗口 + 设置弹窗 | 6 进程 private 416.0 MB、working set 638.1 MB；GPU 进程 private 244.5 MB | 6 进程 private **198.8 MB**、working set 489.5 MB；GPU 进程 private **26.9 MB** |

- 根因：AMD 显卡 + ANGLE/D3D11 + `directComposition:true` + 175% DPI 下，透明挂件窗口的 GPU 合成固定开销很高（仅开挂件就 114 MB），不是渲染层泄漏（renderer 稳定 36–44 MB）。
- 修复：`src/main/index.ts` 增加 `applyRenderingPolicy()`，在 `app ready` 前调用 `app.disableHardwareAcceleration()`；环境变量 `DESKTOP_TODO_GPU=1` 可恢复硬件加速（逃生口，便于对比/特殊设备）。
- 视觉与 CPU 验证：软件合成下 CDP 截图（`.agents/tmp/shot-sw-manager.png`、`shot-sw-widget.png`）与硬件合成逐项一致（文字、卡片、圆角、轻投影）；空闲 10 秒 CPU 合计 0.02 秒；`--disable-gpu` 下 `SystemInfo` 正常、无渲染异常。
- 结论：两场景均低于 docs/07 §H「挂件常驻 < 300 MB」，较旧版下降约 40%–50%。

### 2) 双击挂件标题无法打开完整窗口

- 根因：`.w-head` 为 `-webkit-app-region: drag` 拖动区，该区域内的 DOM 鼠标事件不会送达渲染层，`onDoubleClick` 永远不触发。
- 修复：`app.css` 增加 `.widget .w-title-row{-webkit-app-region:no-drag}`，标题行恢复接收事件；拖动仍可用顶部六点拖拽条与头部其余空白。
- 验证（打包版 CDP）：向 `.w-title` 派发 `dblclick` → 完整窗口 target 出现（`?view=manager`）✓。

### 3) 透明度 80% 拖动后变 100%

- 根因：拖动会使窗口获得焦点，主进程按「非焦点才应用设定透明度」的规则把窗口设为 100%，必须再点别处才失焦恢复。
- 修复：`src/main/windows.ts` 新增 `settleWidgetIdleOpacity()`；`bindBoundsPersistence` 的 300ms 保存防抖回调与 `endCapsuleDrag()` 结束时调用：若设置了 <100% 透明度且窗口仍聚焦，则 `blur()` 让设定值立即生效。同时移除 Widget 渲染层重复的 inline opacity（此前与主进程双重叠加）。
- 验证（打包版 CDP）：设置 opacity=0.8 → 点击挂件聚焦（`document.hasFocus()=true`）→ `beginDrag/dragMove/endDrag` 后 `document.hasFocus()=false`（立即恢复 80%）✓。
- 复核（2026-11-22 01:15，真实系统鼠标 + 读窗口 alpha）：从桌面交付目录启动打包版（`--remote-debugging-port=9229`），`GetLayeredWindowAttributes` 读窗口 alpha：
  - 设置 opacity=0.8、窗口聚焦时 alpha=255（符合「聚焦满不透明」）；
  - **真实鼠标拖动挂件顶部拖拽条**（`SetCursorPos` + `mouse_event` 按下/移动 12 步/抬起）→ 1.2s 后 alpha=**204**（0.8×255，修复前为 255）✓；
  - 切胶囊后**真实鼠标拖动胶囊本体**（位移 +40,+30）→ 1.2s 后 alpha=**204** ✓。
  - 脚本：`.agents/tmp/verify-opacity.mjs`（CDP 编排）、`.agents/tmp/win-state.ps1`（客户端原点 + layered alpha）、`.agents/tmp/drag-real.ps1`（真实鼠标拖动）。

### 4) 自动化回归与产物

- `pnpm typecheck` 0 错误；`node scripts/run-tests.cjs` **12 文件 / 165 用例全部通过**。
- 重打包（2026-11-22 01:03）：
  - portable 97,666,895 B / SHA-256 `8aa2bf1df8bbddf605677403f5dc5c400b52669e97e88ec79afa49940b94ee0a`
  - setup 106,240,887 B / SHA-256 `6eabdc1f564c088778814e7596a0952b36281be0d7af7dd895783170930356d2`
  - 已覆盖 `C:\Users\lazasons\Desktop\桌面待办-交付物\`，`使用说明.txt` 同步更新。

---

## 补充验收（2026-11-22 01:45）：四角灰底 + 挂件内日期面板

用户反馈（原文）：「1. 挂件和胶囊的4个角仍不是透明底，仍是存在一层灰黑色的底；2. 挂件点开日期选择时，布局错乱，不是正常的日期时间选择区」。

### 1) 挂件/胶囊四角灰底

- 根因：Electron 窗口边界＝卡片边界（`transparent:true` 但尺寸与卡片一致）。卡片外侧的 CSS 投影被矩形窗口裁掉，只会在四个圆角的缺口里露出一圈深色阴影，看起来像「四角灰黑色底板」。像素证据：背景 `(247,249,255)` → 阴影带 `(224,226,231)` → 卡片 `(255,253,250)`。
- 修复：桌面形态不再使用外投影，改为 `inset 0 0 0 1px` 内描边（`--ink` 8%，unpinned 6%），四角完全透明。见 `src/renderer/src/styles/app.css` 的 `.view-widget .widget` / `.view-capsule .capsule`。
- 验证（打包版 CDP + 真机 OS 截图，175% DPI）：窗口四角像素与背景一致（挂件角落 `(247,249,255)`、胶囊角落 `(251,252,255)`），沿卡片边缘只有 1px 描边，无灰色矩形；挂件与胶囊实际窗口仍为 352×N / 284×54。

### 2) 挂件内日期面板布局错乱/被裁切

- 根因：挂件窗口只有内容高度（实测 353×241），而日期 chip 的 Popover 内容自然高度 241（被压到 155 出现内部滚动），「指定日期…」打开的日历 `.dp-pop` 为 288×351，超出窗口高度直接被裁切。原 Popover 定位用「当前被压后的高度」计算，窗口变高后不会重新长高。
- 修复：
  1. 浮层（`.pop` / `.dp-pop`）打开期间，挂件窗口临时加高到 520 且**底边不动**（`widget.setHeight` 新增可选 `anchor:'top'|'bottom'`，主进程 `setWidgetContentHeight(height, anchor)` 按底部锚点生长）；关闭后按缓存的内容自然高度、同样以 bottom 锚点收回原位。
  2. `Popover.computePosition` 改用 `scrollHeight` 取内容自然高度，避免被上一次 `maxHeight` 压住后不再长高。
  3. 内容高度上报加 1px 安全余量，消除小数高度取整造成的 1px 溢出滚动条。
- 验证（dev + 打包版 CDP，窗口坐标来自主进程）：
  - 关闭状态 innerHeight 243；打开日期浮层 → **520**，`.pop` = 320×241、`scrollHeight = clientHeight = 241`（无裁切/无内滚）；点「指定日期…」→ `.dp-pop` = 288×351 @ (34,15)，完整位于窗口内；关闭后 innerHeight 回到 **243**（窗口 client 352×242）。
  - 选择日期 25 日 →「确定」→ 浮层关闭、composer 日期按钮变为「11月25日 02:00」（默认下一半点）；点「无日期」清除后恢复「日期」，窗口高度回落 243。
  - 证据截图：`.agents/reports/screens/m6-fix-widget-datepop.png`、`m6-fix-widget-calendar.png`、`m6-fix-capsule.png`。
- 回归：`npx tsc --noEmit` 0 错误；`node scripts/run-tests.cjs` **12 文件 / 165 用例全部通过**。

### 3) 自动化回归与产物（2026-11-22 01:46 重打包）

- `npx tsc --noEmit` 0 错误；`node scripts/run-tests.cjs` **12 文件 / 165 用例全部通过**。
- 因 VS Code 占用工作区内构建暂存文件（Restart Manager 查询确认），本次改在**工作区外输出**打包：
  `pnpm exec electron-builder --win -c.directories.output=C:/Users/lazasons/AppData/Local/desktop-todo-dev/release-build`（带 `ELECTRON_MIRROR` / `ELECTRON_BUILDER_BINARIES_MIRROR` 镜像变量）。
- 产物：
  - portable 97,685,204 B / SHA-256 `e2997a3f1889026c45408ad31089a292974a138d45f54f0052dae0d0f19e9122`
  - setup 106,241,253 B / SHA-256 `2b771c3d4d4122a55c594064976a73a3a7331448e1dd0cea58925d7c972e7068`
  - 已覆盖 `release/` 与桌面交付目录 `C:\Users\lazasons\Desktop\桌面待办-交付物\`，`使用说明.txt` 同步更新。
- 证据截图（`docs/acceptance/screens/`）：`m6-fix-widget-corners-os.png`（真机 OS 截图，四角透明）、`m6-fix-capsule-corners-os.png`、`m6-fix-widget-datepop.png`（320×241 浮层无裁切）、`m6-fix-widget-calendar.png`（日历完整位于 520 高窗口内）、`m6-fix-widget-calendar-os.png`（真机 OS 截图）。

### 4) 2026-11-22 02:2x 交互确认项（m03793）实施与验收

用户确认四项：单桌面原型、位置基准自适应（就近角、默认右上）、三态互斥、挂件折叠输入。原型先在临时目录实现并经确认后同步回 `design/app/`，再实施到正式应用。

**A. 位置基准自适应（挂件 ↔ 胶囊 ↔ 完整窗口）**

- 实现：桌面形态共用 `settings.widgetBounds`；主进程保存「基准角 + 角屏幕坐标」（`WidgetAnchorPoint`），切换形态/内容高度变化时保持该角不动并换算目标尺寸（`anchorForBounds` / `boundsForShape`，默认右上）。程序化 `setBounds` 后 500ms 内抑制 `moved` 事件回写，避免高 DPI 像素对齐误差反复累积（`suppressBoundsPersistUntil`）。
- 验证（`.agents/tmp/verify-shapes.mjs`，真实鼠标拖动 + `settings.widgetBounds` 数学比对）：
  - top-left：Δ0 / Δ0；top-right：Δ0 / Δ0；bottom-left：Δ0 / Δ0；bottom-right：Δ0 / Δ0（修复前 bottom-right 回切 Δ3）。
  - 拖动挂件到四角 → 切胶囊 → 切回挂件 → 打开/关闭完整窗口，基准角坐标保持（≤1 DIP，175% DPI 物理取整）。
  - 证据：`.agents/tmp/verify-shapes.log`。

**B. 三态互斥（挂件 / 胶囊 / 完整窗口）**

- 任一时刻只有一个桌面形态可见：打开完整窗口自动隐藏挂件；关闭（X / Esc / 渲染层 `window.close()`）或收起到挂件/胶囊后回到桌面形态；挂件与完整窗口不会同时显示。
- 验证：`verify-shapes.mjs` 6 项互斥检查全部 PASS（启动单窗口、showManager 后仅 manager、收起到胶囊 284×54、胶囊单击展开 352、收起到挂件、关闭完整窗口回桌面形态）。
- 入口：完整窗口标题行新增「收起到挂件」「收起到胶囊」两个 30×30 IconButton；挂件双击标题打开完整窗口；胶囊单击 250ms 后展开为挂件、双击打开完整窗口。

**C. 挂件折叠输入**

- 默认显示 28 高「+ 添加任务」按钮（整行宽、圆角 12、`--field-bg` + 1px `--hairline`）；点击展开 composer 并自动聚焦；Enter 保存、Shift+Enter 换行、Esc / 点击外部 / 提交后收起并回到按钮。
- 验证：默认折叠按钮可见、点击后 textarea 聚焦、Esc 收起、提交后收起且任务落库（4 项 PASS）。

**D. 原型同步**

- `design/prototype-adjust/` 的 v1.1（单桌面单标签、就近角基准、三态互斥、折叠输入；77 项无头 Edge 断言 PASS）已同步回 `design/app/`：新增 `css/adjust.css`，更新 `js/{core,render,interactions}.js` 与 `index.html`，`design/prototype-adjust/` 已删除，原始原型文件保留且行为更新为确认版。
- 规范同步：`docs/08-UI-ENGINEERING-SPEC.md` §2.1/§2.2/§2.3/§2.4 + 新增 §2.8；`docs/01-PRD.md` FR-1.3/1.7/1.9/2.3/2.7/2.8/5.5；`docs/02-DESIGN-SPEC.md` 桌面阴影与折叠输入说明。

**E. 自动化回归**

- `npx tsc --noEmit` 0 错误；`node scripts/run-tests.cjs` **13 文件 / 171 用例全部通过**（新增 `src/main/windows.test.ts` 6 例：四角基准与 clamp）。
- 证据截图（`docs/acceptance/screens/`）：`m6-widget-folded.png`（折叠按钮）、`m6-widget-composer.png`（展开输入）、`m6-widget-datepicker.png`（挂件内日历完整）、`m6-manager-shapes.png`（标题行两个收起按钮）、`m6-capsule-final.png`。

**F. 交付物（2026-11-22 02:32 重打包）**

- 打包命令（工作区外输出规避 VS Code 文件锁）：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ pnpm exec electron-builder --win -c.directories.output=C:/Users/lazasons/AppData/Local/desktop-todo-dev/release-build`
- 产物并已复制到 `release/` 与桌面交付目录 `C:\Users\lazasons\Desktop\桌面待办-交付物\`：
  - `DesktopTodo-1.0.0-portable.exe` 97,692,520 B / SHA-256 `f771ca46de0c4c351773760034f02f37a6bb8780ca32c3e80a19bb44f9ec8644`
  - `DesktopTodo-1.0.0-setup.exe` 106,242,726 B / SHA-256 `8052112795253791822318043737c2e162b0d0bc85dbd6ab496c7a88fa6ed57d`
- `使用说明.txt` 与 README 校验表、修复清单已同步更新。
