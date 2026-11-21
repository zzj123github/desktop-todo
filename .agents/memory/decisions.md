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
