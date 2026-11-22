# 决策记录

> 只记有理由的持久决策。新增条目：日期 + 决策 + 理由/证据 + 影响。

## D1 · 2026-11-21 · Electron 固定 40.10.2（不是 33）

- 决策：`package.json` 依赖 `electron@40.10.2`；`electron-builder.yml` 配 `npmRebuild: false`。
- 理由：
  1. docs/04 要求 Electron 32+，40 合规。
  2. Electron 33.4.11 在本机（Windows 11 家庭版 build 26200）GUI 模式启动即崩溃：`electron.exe --version` 退出码 `0x80000003`（-2147483645），生成 `%LOCALAPPDATA%\CrashDumps\electron.exe.*.dmp`；`ELECTRON_RUN_AS_NODE` 模式却正常，说明是 GUI 进程兼容性问题，与本机 Windows build 有关。Electron 40.10.2 同一台机可正常开窗。
  3. 本机没有 MSVC/cl.exe，better-sqlite3 只能使用预编译二进制；`better-sqlite3@12.11.1` 的 GitHub release 提供 `electron-v143`（Electron 40 ABI）win32-x64 prebuild，而 13.x 没有预编译资产。
  4. GitHub release 直连在本机 ECONNRESET，预编译包从 npmmirror 镜像取；Electron 二进制优先用 `%LOCALAPPDATA%\electron\Cache` 本地缓存。
- 影响：`scripts/fetch-native-assets.py` 负责在 `pnpm install --ignore-scripts` 之后放置 Electron 二进制与 `better_sqlite3.node`（electron-v143）。

## D2 · 2026-11-21 · 测试用 Electron 自带 Node 跑 Vitest

- 决策：`pnpm test` → `node scripts/run-tests.cjs` → 从 workspace 外的 Electron 运行时副本以 `ELECTRON_RUN_AS_NODE=1` 启动 `vitest.mjs --run`；`vitest.config.ts` 在根目录登记。
- 理由：better-sqlite3 原生模块只能对一个 ABI，本项目放的是 electron ABI 143；系统 Node 22 是 ABI 127，直接 `vitest` 无法 `require('better-sqlite3')`。用 Electron 的 Node 模式实现"同 ABI 跑测试"，无需本地编译，也不需要维护两份原生二进制。
- 影响：测试脚本必须经 `scripts/run-tests.cjs`；在用户机器的 Node 与 Electron ABI 上与 CI 环境同样成立。

## D3 · 2026-11-21 · 新增 `src/renderer/src/lib/` 与 `docs/09 §6.1` 登记

- 决策：渲染层共享逻辑（日期/逾期文案、输入解析、筛选状态、格式化）放 `src/renderer/src/lib/`，按领域聚合模块；不设 `utils/` 单函数文件。
- 理由：docs/09 的 `hooks/` 只放 React hooks，`components/` 只放组件；共享纯函数需要一个登记过的目录，避免页面里重复实现；同时满足"公共代码按模块聚合、不碎片化"的全局约定。
- 影响：docs/09 §2.1 目录树与 §6.1 已同步登记；新增渲染层文件优先放 lib/components/hooks/app。

## D4 · 2026-11-21 · IPC 缺口：项目/标签管理补 `tags:create|rename|delete`

- 决策：在 docs/04 的 IPC 表之外补最小必要通道 `tags:create`、`tags:rename`、`tags:delete`（统一带 `kind: 'project' | 'tag'`），其中 delete 返回 `{ impact: { total, pending }, record, taskIds }`；删除撤销用「重建 + `tasks:update` 回填关联」实现，不新增 restore 通道。
- 理由：FR-2.6 / FR-6.5 要求项目与标签可新建、重命名、删除、撤销，但 docs/04 IPC 表没有对应通道；这是实现规格内功能所必需的最小补充，改动面只在 preload 白名单与 ipc 注册。
- 影响：TODO 最终答复与 `.agents` 中说明偏差；其余通道严格按 docs/04。

## D5 · 2026-11-21 · 开发/验收启动绕开 workspace GUI 限制

- 决策：`pnpm dev` / `pnpm start` 与测试通过 `scripts/electron-runtime.cjs` 把 Electron 运行时复制到 `%LOCALAPPDATA%\desktop-todo-dev\electron-<version>` 再执行；打包产物验收也从 workspace 外目录启动。
- 理由：本机 DSH 会话对 workspace 路径下执行的进程有沙箱限制：GUI 模式静默崩溃（0x80000003），`ELECTRON_RUN_AS_NODE` 下只能写 workspace（写 %TEMP% EPERM）。复制到 workspace 外即恢复正常；这是本机环境限制，不影响用户从任意目录运行打包后的 exe。
- 影响：dev/test/验收脚本共享 `scripts/electron-runtime.cjs`；README 记录该限制仅存在于本机开发会话。

## D6 · 2026-11-21 · 挂件窗口透明 + 同窗切换胶囊；bounds 规范化持久化

- 决策：挂件 BrowserWindow `transparent: true`、`backgroundColor: '#00000000'`、`hasShadow: false`、`roundedCorners: false`，窗口不重建；挂件/胶囊在同一 renderer 内切换视图，主进程只 `setBounds`（挂件 352×自适应高，胶囊 284×54）。渲染层通过 `widget:setHeight`/`widget:setCollapsed` 驱动。
- 理由：docs/08 视觉契约要求挂件圆角 16、胶囊圆角 999，非透明无边框窗口无法做到（Windows DWM 圆角达不到该半径）；docs/04 的 `transparent:false` 与 08 冲突时按 08 §7「08 > 04 示例」优先视觉契约。
- 影响：`persistBounds` 只存位置 + 规范化尺寸（widget 宽 352、高 clamp(96,520)，capsule 284×54，manager 原样），避免 `getBounds` 在 175% 缩放下回读中间态把窗口撑大；`bindBoundsPersistence` 300ms 防抖。

## D7 · 2026-11-21 · 完整窗口懒创建，Alt+1..5 用 `?nav=` 直达视图

- 决策：启动只创建挂件窗口；`showManager()` 按需创建；已销毁后再次调用重建；`showManagerView(viewId)` 对未创建窗口用 `?view=manager&nav=<viewId>` 直接加载目标视图，对加载中窗口等 `did-finish-load` 再广播 `app:navigate`。
- 理由：
  1. 渲染层 `window.close()` 会真销毁 BrowserWindow（`close` 事件 preventDefault 拦不住），原 `showManager` 在销毁后直接 return，导致完整窗口再也打不开。
  2. 内存指标 docs/07 H 要求挂件常驻 <300MB；原实现启动即建完整窗口，实测 private 387.5MB；懒创建后 198.6MB。
  3. 快捷键首次唤起时渲染层尚未挂载，广播会丢；URL 参数 + 二次广播双保险。
- 影响：`windows.ts` 导出 `ensureManagerWindow/revealManager/showManagerView`；`shortcuts.ts` 的 openView 改为 `showManagerView`；`Manager.tsx` 初始 nav 读 `?nav=` 并校验。

## D8 · 2026-11-21 · 链接不可用的 UI 文案统一（missing/unreachable）

- 决策：主进程保留 `reason: 'missing' | 'unreachable'` 区分（网络不可达更精确），渲染层统一按「找不到该位置」+ 重新选择/删除处理；判断集中在 `src/renderer/src/lib/links.ts` 的 `isLinkUnavailable(result)`。
- 理由：docs/03-DATA-MODEL.md:127 规定失效统一返回 missing 并提示「找不到该位置」，docs/04 的 opener 片段只列 missing；主进程实现额外区分了 unreachable。保留区分可让日志/诊断更准确，UI 仍符合规格文案。
- 影响：Manager/Widget/EditorModal 三处用同一 helper；docs/09 已登记 `lib/links.ts`。

## D9 · 2026-11-22 · 胶囊自绘拖动 + 日期浮层内嵌点击 + 桌面形态轻投影

- 决策：胶囊拖动不再用 `-webkit-app-region: drag`（它会吞掉点击、只剩窄条可拖），改为 renderer pointer 事件 + 主进程 `setBounds`：新增 IPC `widget:beginDrag` / `widget:dragMove` / `widget:endDrag`（shared/preload/ipc 同步），位移≥4px 才开始拖动并抑制展开，松手写回 `capsuleBounds`；胶囊整体可点击展开。
- 决策：`Popover` 的 document mousedown 外部点击判断把 portal 出来的 `.pop/.dp-pop/.overlay` 视为内部（`FLOATING_LAYER_SELECTOR` + `isInsideFloatingLayer`，见 `src/renderer/src/components/anchoredPosition.ts`），修复完整窗口 composer 日期面板一点就关闭的问题。
- 决策：桌面形态（widget/capsule）不使用 tokens 里的 08 原型大投影 `--shadow-widget/--shadow-capsule`，改为基于 tokens 的轻投影 + 1px 内描边。理由：widget 窗口 `transparent: true`，大投影在浅色桌面上会渲染成一块灰色矩形（用户测试反馈 #1）；tokens.css 保持原样，仅在 app.css 窗口形态规则覆盖。
- 理由与证据：用户 m02712 的 7 项反馈；CDP 验证 boxShadow 变化、胶囊单击/拖动、`.dp-pop` 内点击不再关闭父 Popover；截图 `.agents/reports/screens/m6-fix-datepicker.png`。
- 影响：新增 3 个 IPC 通道与 4 个单测；`docs/04` IPC 表为最小补充（与 D4 同类偏差），最终答复说明。

## D10 · 2026-11-22 · 默认关闭硬件加速以降低常驻内存

- 背景：用户反馈任务管理器里「桌面待办 (5)」合计约 592.5 MB、单个进程 437.4 MB。
- 测量（打包版，Win11 26200 + AMD + 175% DPI，`Win32_Process` 按 CPU 时间差 10 秒取值）：仅挂件 5 进程 private 243.6 MB（GPU 进程 113.8 MB）；挂件+完整窗口 6 进程 private 416.0 MB（GPU 244.5 MB）。
- 决策：`src/main/index.ts` 在 `app ready` 前调用 `app.disableHardwareAcceleration()`（环境变量 `DESKTOP_TODO_GPU=1` 可恢复硬件加速）。软件合成后：仅挂件 5 进程 private 149.3 MB（GPU 18.2 MB）；挂件+完整窗口+设置 198.8 MB（GPU 26.9 MB），均低于 docs/07 §H 的 300 MB；空闲 10s CPU 0.02s，CDP 截图与硬件合成逐项一致。
- 理由：内存大头是透明挂件窗口在本机 AMD/ANGLE D3D11 合成路径上的固定 GPU 开销，不是渲染层泄漏（renderer 稳定 36–44 MB）；桌面待办的动画/滚动负载低，软件合成代价可忽略，收益是常驻内存减半。
- 影响：README 增加「性能与内存」对照表与逃生口说明；`docs/acceptance/M6-ACCEPTANCE.md` 增加测量证据；未来若做重 GPU 功能需重新评估。

## D11 · 2026-11-22 · 拖动结束恢复失焦透明度、标题行让出双击

- 决策：`src/main/windows.ts` 新增 `settleWidgetIdleOpacity()`，在窗口 moved/resized 的 300ms 落盘回调与 `endCapsuleDrag()` 里调用：若透明度设置 <100% 且窗口仍聚焦，则 `blur()` 让设定值立即生效；同时移除 Widget 渲染层重复的 inline opacity（此前与主进程会双重叠加）。
- 决策：`.widget .w-title-row` 设 `-webkit-app-region: no-drag`。原因：app-region: drag 区域内的 DOM 鼠标事件不会送达渲染层，`onDoubleClick` 无法触发，「双击标题展开完整窗口」失效；拖动仍可用顶部六点拖拽条与头部其余空白。
- 证据：打包版 CDP 双击 `.w-title` → 出现 `?view=manager`；设置 opacity=0.8 后 beginDrag/dragMove/endDrag → `document.hasFocus()=false`（立即恢复 80%）。

## D12 · 2026-11-22 · 桌面形态去掉外投影、浮层打开时窗口临时加高

- 决策：桌面形态（挂件/胶囊）不再使用 tokens 里的外投影，改为 `inset 0 0 0 1px` 内描边（`--ink` 8%；unpinned 6%；capsule hover 12%）。原因：Electron 窗口边界＝卡片边界，外投影被矩形窗口裁掉，只在四个圆角缺口里露出灰黑色阴影，用户明确反馈「四角有灰黑底」。
- 决策：挂件浮层（`.pop` / `.dp-pop`）打开期间窗口临时加高到 520、`anchor:'bottom'` 保持底边不动；关闭后按内容自然高度以同样锚点收回。原因：挂件窗口按内容高度（约 243px）时，320×241 的浮层与 288×351 的日历无法容纳，会被窗口裁切。
- 决策：`Popover.computePosition` 用 `scrollHeight` 计算内容自然高度（含翻转判断），否则被上一次 maxHeight 压住后窗口变高也不再长高。内容高度上报加 1px 余量，避免小数取整导致 1px 溢出滚动条。
- 证据：真机 OS 截图四角像素与背景一致（挂件 `(247,249,255)`、胶囊 `(251,252,255)`，仅 1px 描边）；CDP 窗口高度 243→520→243，`.pop` 320×241 无内滚，`.dp-pop` 288×351 完整可见；`node scripts/run-tests.cjs` 165 用例通过。

## D13 · 2026-11-22 · 位置基准改为就近角锚点、三态互斥、挂件折叠输入

- 决策：挂件与胶囊共用 `settings.widgetBounds`，主进程保存「基准角 + 角屏幕坐标」（`WidgetAnchorPoint`，`anchorForBounds` 按矩形中心象限判定、默认右上），切换形态或内容高度变化时角坐标不动并换算目标尺寸（`boundsFromWidgetAnchor`）。旧 `capsuleBounds` 仅作迁移回落，不再单独写。
- 决策：程序化 `setBounds` 后 500ms 内抑制 `moved` 事件的 bounds 落盘（`suppressBoundsPersistUntil`）；由锚点换算出的矩形不再反向捕获锚点（`saveShapeBounds(bounds, capture=false)`）。原因：175% DPI 下 Electron 物理像素对齐 + `getBounds` 取整会让「读取→重捕获→写回」循环累积 ±1~2 DIP，四角验收出现 bottom-right Δ3；抑制后四角互切全部 Δ0。
- 决策：三态互斥由主进程保证——打开完整窗口先隐藏挂件；完整窗口 close/closed（渲染层 `window.close()` 会销毁窗口）后恢复桌面形态；完整窗口标题行新增「收起到挂件/收起到胶囊」（`app:showWidget({collapsed})`）。
- 决策：挂件底部默认折叠按钮（`.w-add-btn`，高 28），点击展开 Composer 并聚焦；Esc/点外部/提交后收起。胶囊单击改为 250ms 延迟展开以区分双击打开完整窗口（`scheduleExpand` + `onDoubleClick`）。
- 决策：临时原型 v1.1 经用户确认后同步回 `design/app/`（新增 `css/adjust.css`，覆盖 `js/{core,render,interactions}.js` 与 `index.html`），删除 `design/prototype-adjust/`；规范同步到 docs/08 §2.8、docs/01 FR-2.7/2.8 等。
- 证据：`.agents/tmp/verify-shapes.mjs` 全部 PASS（三态互斥 6 项、折叠输入 4 项、四角各 Δ0）；`node scripts/run-tests.cjs` 13 文件 171 用例通过；`npx tsc --noEmit` 0 错误。

## D14 · 挂件内编辑任务改为独立桌面级窗口（2026-11-22，m04418）

- 现象：挂件内点击任务，编辑面板被 352 宽挂件窗口裁切；原型的编辑面板是桌面级 502 wide 弹窗。
- 决策：主进程新建独立透明窗口（`openEditorWindow` / `closeEditorWindow` / `resizeEditorWindow`），窗口宽 550（502 + 24×2 内边距），高度由渲染层 `editor:ready` 上报后居中到挂件所在显示器；渲染层用同一 `EditorModal` + `Modal embedded` 模式（不画遮罩、不锁滚动）。挂件/完整窗口的既有编辑路径不变。
- 理由：同一 bundle 多视图（docs/09）、不复制表单实现；窗口级隔离避免 352/1100 两种窗口尺寸的裁切问题；三态互斥不受影响（编辑窗口是瞬态覆盖层，挂件保持可见）。
- 配套修正：`anchoredPosition` 的翻转阈值 `needed` 从 `min(popHeight,320)` 改为 `popHeight`——351 高的日期面板在 829 高窗口里「差一点」不翻转会被裁 11px。
## D15 · 原型与实现统一去掉桌面形态外投影（2026-11-22，用户 m00565 指示）

- 背景：用户确认不需要「浮在桌面上、四周带大外投影」的效果，要求原型与相关说明一起调整。此前 D9/D12 只改了 Electron 实现，原型 `design/app` 仍保留大外投影——这正是「原型能力 vs 窗口能力」的错位。
- 决策：`design/ui/tokens.css` 与 `src/renderer/src/styles/tokens.css` 的 4 个桌面形态 shadow token 改为 `inset 0 0 0 1px` 内描边（8% / 未置顶 6% / hover 12% ink）；`design/app/css/app.css` 的 `.widget` / `.widget.unpinned` / `.capsule` / `.capsule:hover` / `.cap-wrap.dragging .capsule` 改用这些 token，原型不再画外投影；`docs/02` §3、`docs/08` §1.4/§2.2/§2.4、`README.md`、`design/README.md` 同步。
- 理由：Electron 透明窗口边界＝卡片边界，任何绘制在卡片外的效果（外投影/外发光/位移）都会被矩形窗口裁切，只在圆角缺口露灰边；原型作为像素基准必须表达「窗口内可落地」的形态，否则实现只能二次偏离。
- 验证：更新后的原型用无头 Chrome 重新导出 `design/app-desktop.png` / `design/app-capsule.png`；卡片四周无外投影、只剩 1px 内描边；`node scripts/run-tests.cjs` 全绿。


## D16 · 交付前固定执行全量交互审计（2026-11-22）

- 背景：胶囊 hover 位移/亚像素裁切、挂件桌面视图下拉打不开等问题由用户逐条发现，用户要求「交付前自己测一遍」。
- 决策：仓库内置 `scripts/audit-ui.mjs`（`pnpm audit`），通过 CDP 驱动真实窗口跑 50+ 项交互断言（挂件/胶囊/完整窗口/弹层/键盘/设置/管理/编辑窗口/三态互斥/数据清理），结果写 `.agents/reports/audit/`。每次改 UI 或打包前必须全 PASS；同时跑 `pnpm typecheck` + `pnpm test`。
- 发现并修复：`ViewMenu` 监听 window resize 关闭菜单，而挂件打开浮层会临时加高窗口触发 resize，导致挂件内桌面视图下拉打开即关闭。规则：浮层定位/关闭交给 `Popover`（其自身处理 resize 重定位），不要在业务组件里用 resize 关闭浮层。
- 证据：`.agents/reports/audit/report.json`；`docs/acceptance/M6-ACCEPTANCE.md` §8。

## D17 · 原生启动提示改为应用内提示体系（2026-11-22）

- 背景：用户反馈启动时快捷键注册失败弹的是 Windows 原生 dialog（`dialog.showMessageBox`），与应用风格不统一；希望沉淀类似 Element/AntV 的自建基础组件。
- 决策：新增通用「应用内提示」体系——`src/main/notices.ts` 负责提示队列（注入 presenter，不直接 import electron），窗口为独立透明 472 宽 BrowserWindow（`?view=notice`，424 弹窗 + 24×2 内边距，居中挂件所在显示器，高度由渲染层上报）；渲染层 `NoticeModal` 复用 `Modal`（size confirm / role alertdialog / embedded），`NoticeWindowHost` 订阅 `on.notice`、`notice.ready({height})`、`notice.acknowledge()`；快捷键冲突与数据库异常均走该体系，仅提示窗口加载失败 2.5s 才回退原生 dialog。
- 理由：胶囊/挂件窗口只有 284/352 宽，424 的应用内模态放不下会被裁切，提示必须与挂件形态解耦；独立窗口也保证应用最小化到托盘时提示可见。
- 可复用：后续启动/后台类提示统一 `postNotice({kind,title,message,items,hint,acknowledgeLabel})`，不再新增原生 dialog 调用点（文件选择器除外）。

## D18 · 独立透明窗口内浮层一律用紧凑阴影（2026-11-22，用户 m01200/m01273）

- 背景：D14 的编辑窗口（550×auto，24px 内边距）与 D17 的提示窗口（472×auto）沿用 `--shadow-modal`（0 34px 90px），用户发现弹窗仍有一层阴影、并指出「是灰色底」；进一步要求 toast/modal 等任何可能出现在独立透明窗口里的组件都不能用大阴影，而纯 Web（应用窗口内）可以保留。
- 决策：按渲染场景区分，而不是按组件区分。新增 `--shadow-modal-window`/`--shadow-pop-window`/`--shadow-toast-window`（最大外扩 21px，适配 24px 窗口内边距）；在 `.view-widget/.view-capsule/.view-quickadd/.view-editor/.view-notice` 根类上把 `--shadow-modal/--shadow-pop/--shadow-toast` 覆盖为紧凑版本；`.view-manager`（不透明完整窗口）保留原大阴影。后续新增组件只要引用这三个 token 即自动获得正确场景阴影，不需要在组件里判断窗口类型。
- 理由：透明窗口的窗口边界会裁切任何绘制在内容外的效果（与 D12 挂件/胶囊同一机理）；`--shadow-modal` 水平需 ≈90px、下侧 ≈124px，24px 内边距必然裁出「断边灰晕」。根类覆盖让「场景」成为唯一事实来源，避免逐组件重复实现。
- 验证：178 用例、tsc 0 错、build 通过；CDP 实测编辑窗口 `.modal`/`.dp-pop` 为紧凑值且完整落在窗口内、四边 alpha=0（旧值 26/255）；完整窗口 token 保持大阴影。

## D19 · 同一时刻只显示一个 Popover（2026-11-22，用户 m05701 问题 1）

- 背景：筛选行的标签/日期/优先级三个浮层与标题旁的视图菜单各自持有 open state、各自监听 document mousedown；真实鼠标点击第二个浮层时 body mousedown 会先关掉前一个，但键盘或程序化打开不会触发外部点击，于是两个 `.pop` 同时存在，保存视图表单叠在筛选浮层上，看起来「布局混乱」。
- 决策：把「浮层互斥」收敛为浮层层的不变量，加在共享模块 `src/renderer/src/components/anchoredPosition.ts`：`PopoverCloser` 类型 + `activatePopover(close)` / `closeActivePopover()` / `hasActivePopover()`；`Popover.tsx` 挂载时激活（返回释放函数，仅当仍是当前 token 才清空），卸载时释放；新浮层打开先关闭上一个。嵌套的日期选择器 `.dp-pop` 属于 Popover 内部层级，不参与注册、保持独立。
- 理由：每个调用方自己管理互斥会继续漏（本问题正是真实鼠标路径掩盖了键盘/程序化路径）；Popover 全部 portal 到 body、互不嵌套，注册器不依赖 DOM 层级与调用方配合。
- 验证：`anchoredPosition.test.ts` 新增 3 用例（新开关旧、旧释放不误清新、close 单次且幂等重挂载）；`scripts/audit-ui.mjs` 新增断言「打开优先级浮层后点视图菜单仍只有 1 个 `.pop`，且 `.view-form` 在浮层内」；dev 与打包版审计均 63/63 PASS。
## D20 桌面形态窗口四周保留 2px 透明留白（2026-11-22，用户 m06254）

- 现象：175% 等高 DPI 下挂件/胶囊右/下边缘被裁切。根因：Electron 报告的窗口内容尺寸比 Win32 实际客户区大约 2 物理像素（请求 352 CSS → 客户区 352 CSS，`getContentSize()` 回读 353），卡片铺满视口即被裁。
- 决策：窗口尺寸 = 可见卡片 + 四周各 2px —— 挂件 356 ×（内容高+4）、胶囊 288×58；卡片仍精确 352 / 284×54。渲染层根容器 `box-sizing:border-box;padding:2px`，卡片固定尺寸。窗口高度上限 520+4=524。
- 同时规范化落盘尺寸（`normalizeShapeBounds` 在创建/保存/persist 时统一为当前形态窗口尺寸），消除 DPI 取整造成的 ±1 DIP 漂移（曾出现 353 宽）。默认位置边距减 2，保持可见卡片与屏幕边缘的视觉间距不变。
- 验证：`windows.test.ts` 3 用例、15 文件/188 用例通过；audit 新增「挂件/胶囊卡片完整位于窗口内」2 条断言，dev 与打包版均 64 项 ALL PASS。

## D21 链接添加/编辑统一为「地址 + 标题」双字段（2026-11-22，用户 m06711）

- 背景：上一版链接标题只能在添加后单独点击改名；添加阶段没有标题输入，行内编辑也只能改标题、不能改地址，用户指出「这些小的 UI 交互为什么不补齐」。
- 决策：链接的输入模型统一为 `{target, title}` 双字段，新增 `parseLinkInput(target,title)` 作为唯一解析入口（地址必填 + detectLink 识别类型；标题 trim 后 ≤120；`display = 自定义标题 || 自动标题`）。添加行与行内编辑共用该模型：添加行两输入（地址 + 标题可选，任一 Enter 提交）；行内编辑同一编辑态显示两输入（点击标题或路径都进入、按点击定位焦点）；Enter/失焦保存、Esc 取消、`relatedTarget` 防切换焦点误提交；地址变更后按新地址重识别类型/图标，无效地址 toast 拒绝并保持编辑；标题留空回退自动标题；仅地址变化且原标题为自动名称时标题跟随重算，自定义标题保留。
- 理由：地址与标题是同一实体的两个字段，分散成「先添加再改名」只是把一次交互拆成两次；把联动规则收敛到 `parseLinkInput` + `commitLinkEdit` 可避免各处重复判断，原型 `DT.parseLinkInput` 与 `startLinkEdit/commitLinkEdit` 与之逐字对齐。
- 验证：`links.test.ts` 4 用例（192 项总）、dev/打包版审计各 70 项 ALL PASS（含添加行两输入、添加时填标题、改地址重算名称、危险地址拒绝）；原型静态页 41 + 12 项断言 PASS。

## D22 日期选择器时间列表用应用内平滑滚动（2026-11-22，用户 m06992）

- 现象：用户在高刷新率（300Hz）机器上仍感觉时间列表滚轮「卡顿」。实测排除了渲染/合成因素：空闲 rAF 301–302 帧/秒（vsync 300Hz），JS 驱动滚动帧间隔 p50 3.30ms、无 >20ms 丢帧，开/关硬件加速与 `--enable-smooth-scrolling` 表现一致。
- 根因：Electron/Chromium 原生滚轮按固定像素步进（一格 120px = 5 行）一次性跳变，时间列表可视区只有 132px（约 5.5 行），一格几乎换掉整屏内容且没有插值帧，视觉上就是跳变。
- 决策：在 `.dp-tl-scroll` 上接管 wheel（passive:false，命中才 preventDefault），自己按 deltaMode 归一增量（像素 ×0.4 / 行 ×24 / 页 ×clientHeight，单次限幅 ±120），以 160ms ease-out 用 rAF 把 scrollTop 插值到目标；连续滚动从当前 scrollTop 重设目标并取消上一段动画；`prefers-reduced-motion: reduce` 直接定位；pointerdown、键盘方向键与滚动条保持原生；列表加 `overscroll-behavior: contain`。
- 理由：不能依赖 Chromium 原生平滑滚动（不同平台/开关表现不一致，CDP 与真实滚轮均观察到无插值）；自己接管可精确控制步长与时长，并用纯函数（`scroll.ts`）覆盖归一/缓动逻辑，避免把行为散落在组件里。
- 验证：`scroll.test.ts` 9 用例（201 项总）；CDP 采样器在一次滚轮内采到 70 个不同 scrollTop（修复前仅 1 个）；audit 新增 4 条断言（展开、平滑中间帧、reduced-motion 直接定位、Esc 只关日期浮层），dev 74 项 ALL PASS；原型 `interactions.js` 同步实现，23/23 断言 PASS；app v1.4，static v2.4 不变。

## D23 退出阶段异常静默并落主进程日志（2026-11-22，用户 m07685）

- 背景：便携版偶尔在「托盘 → 退出」时弹出系统级「A JavaScript error occurred in the main process」框。应用未注册 `process.on('uncaughtException')`/`unhandledRejection`，Electron 默认弹框；退出期间存在多类未保护的异步回调：窗口加载 Promise 被 `void` 丢弃、文件对话框 `.then` 无 catch、`before-quit` 关闭数据库后窗口 focus/blur/位置防抖仍读 settings、提示队列与启动提示定时器未清、`broadcast` 未判断 webContents 存活。
- 决策：退出顺序只依赖「退出标志」——`before-quit` 置 `setQuitting(true)`、flush 窗口位置、清提示队列与启动定时器；窗口全部关闭后的 `will-quit` 再 checkpoint、关库、注销快捷键、销毁托盘。退出期间所有窗口/浮层/对话框/定时器/广播入口提前返回或静默失败。未捕获异常与未处理拒绝统一走 `installProcessGuards()`：写 `userData/logs/main.log`（512KB 轮转 `main.old.log`）；退出阶段只记录不弹框，非退出阶段保留错误框，避免静默吞错。
- 理由：退出问题的根因是生命周期竞态而非单一调用点；把「退出中不做副作用、异常有落点」变成全局不变量，比逐个补 `if (quitting)` 更可维护；日志同时为后续用户复现提供取证。
- 验证：17 文件 208 用例（logger 5 例、notices.dispose 2 例）；dev 退出矩阵（启动即退/完整窗口/编辑窗口）940–957ms clean、提示窗待确认 595ms clean；打包版 518–6237ms clean 且无异常日志；dev 与打包版 74 项审计 ALL PASS。

## D24 新功能/UI·UX 调整必须先做提案原型且不改定稿基线（2026-11-22，用户 m01500）

- 背景：项目已有可交互原型与静态原型作为像素/交互基准，但此前缺少「新功能先提案、确认后再实施」的固定闸门；容易出现直接在定稿原型或实现上试探 UI/UX 改动，使基准漂移、验收失去对照。
- 决策：新增项目规范 AGENTS.md §4.2：新功能开发（含 UI 交互调整、UI 调整、UX 调整，Bug 修复除外）先做原型；原型必须从定稿原型 `design/app/` 完整复制到独立提案目录 `design/proto-v<版本>/` 后独立修改，定稿原型与配套产物（`static-prototype.html`、`app-fullpage.webp`、`app-*.png`）保持不动；在 `design/` 写 `PROPOSAL-v<版本>.md` 记录方案与待确认问题；经用户确认后才同步 `docs/02`、`docs/08`、tokens 等规格并实施代码。判断不准是否属于 Bug 修复时按「先原型」执行并说明依据。
- 理由：定稿原型是可对比、可回滚的基准；把提案与基线物理隔离，确认前不污染实现与规格，避免「改着改着基线变了」导致验收与文档失真。该规范也把 2026-11-22 proto-v1.5 的既有实践（用户 m00393「新原型不要改已定型原型」）固化为默认流程。
- 现状对照：`design/app/` v1.4 为当前定稿基线；`design/proto-v1.5/` + `PROPOSAL-v1.5.md` + `static-new-features.html` 是现行提案（待确认），符合本规范。
- 验证：规范为流程约束、无代码行为变化；AGENTS.md §4.2、`docs/06-IMPLEMENTATION-BRIEF.md` §3、`project-overview.md` 长期纠正与 `design/README.md` 的提案状态表述一致。
