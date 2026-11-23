# 09 · 工程目录规范

> 状态：实施前目录接口。本文是项目目录与工程边界的**唯一规范**；04-TECH-PLAN §2 是技术摘要，冲突以本文为准。
> 原则：只保留实施所需目录；未实施可以先建空目录；生成目录不预建；新增目录先改本文。

## 1. 根目录接口

```text
desktop-todo/
├─ AGENTS.md                 # 工程纪律（已有）
├─ README.md                 # 交付说明，M6 创建
├─ package.json              # M0
├─ pnpm-lock.yaml            # M0
├─ electron.vite.config.ts   # M0
├─ tsconfig.json             # M0
├─ electron-builder.yml      # M0
├─ .gitignore                # M0
├─ docs/                     # 规格文档，唯一实施读取源
├─ design/                   # 视觉与交互参考，实施时只读
├─ src/                      # 应用源码
│  ├─ main/                  # Electron 主进程
│  │  └─ repo/               # SQLite 数据访问
│  ├─ preload/              # contextBridge 白名单
│  ├─ shared/
│  │  └─ types.ts            # 跨层 DTO / API 类型（main + preload + renderer 共用，纯类型）
│  └─ renderer/              # React 渲染层
│     └─ src/
│        ├─ app/             # Widget / Manager / Capsule / QuickAdd
│        ├─ components/      # 通用组件
│        ├─ hooks/           # useTasks / useFilter / useSettings
│        ├─ i18n/            # 中文文案
│        ├─ lib/             # 日期/解析/筛选/格式化等共享模块（按模块聚合）
│        └─ styles/          # tokens.css / app.css / 字体
├─ build/                    # 构建资产（icon.ico / icon.png / tray.ico / trayTemplate*.png），不是产物目录
├─ resources/                # 运行时静态资源（seed.json）
├─ scripts/                  # 维护脚本（seed.ts 等）
├─ release/                  # electron-builder 产物，生成，不提交
└─ out/                      # electron-vite 构建产物，生成，不提交
```

### 1.1 根目录职责

| 路径 | 入库 | 首次创建 | 职责 |
|------|------|----------|------|
| `AGENTS.md` | 是 | 已有 | 工程纪律与协作规则 |
| `README.md` | 是 | M6 | 安装（Windows SmartScreen / macOS Gatekeeper）、数据目录、构建命令（含 `dist:mac`） |
| `package.json` / `pnpm-lock.yaml` | 是 | M0 | 依赖与脚本 |
| `electron.vite.config.ts` / `tsconfig.json` | 是 | M0 | 构建与类型配置 |
| `electron-builder.yml` | 是 | M0 | 打包配置 |
| `.gitignore` | 是 | M0 | 忽略生成物与本地数据 |
| `docs/` | 是 | 已有 | 00–09 编号规格；06 是实施说明，09 是本文 |
| `design/` | 是 | 已有 | 原型与视觉基准；不参与运行时，不被 `src/` 导入 |
| `src/` | 是 | 已有空目录 | 应用源码，边界见第 2 节 |
| `build/` | 是 | 已有空目录 | 打包用图标等构建资产；**不是**打包输出 |
| `resources/` | 是 | 已有 | 打包进应用的静态资源；当前只有 `seed.json` |
| `scripts/` | 是 | 已有空目录 | 一次性维护/数据脚本，不进入运行时 |
| `release/` | 否 | M6 生成 | electron-builder 输出；不预建、不提交 |
| `out/` | 否 | M0 生成 | electron-vite 输出；不预建、不提交 |
| `node_modules/` | 否 | M0 安装生成 | 依赖目录，永远不提交 |

约束：
- 顶级目录只允许上表列出的项；新增顶级目录必须先改本文。
- `release/`、`out/` 不手工创建，由构建工具生成；目录中有产物时也不入库。
- `docs/` 编号连续（00–09），不跳号；新增文档用下一个编号并同步 `00-README.md`。
- `design/` 是只读参考，新增设计稿也只能放这里，不复制成 `prototype/`、`ui/` 之类的第二个根。

## 2. src 内部接口

### 2.1 目录与文件

```text
src/
├─ main/
│  ├─ index.ts          # app 生命周期、单实例锁、--silent 启动
│  ├─ windows.ts        # widget / manager / capsule / quickadd 窗口（桌面形态含四周 2px 透明留白）
│  ├─ app-menu.ts       # macOS 应用菜单（桌面待办/编辑/窗口），非 darwin no-op
│  ├─ macos.ts          # macOS Dock / 激活封装，非 darwin no-op
│  ├─ tray.ts           # 托盘 / 菜单栏图标
│  ├─ tray-menu.ts      # 托盘菜单模板（纯函数，平台文案）
│  ├─ shortcuts.ts      # globalShortcut 注册/注销
│  ├─ login.ts          # app.setLoginItemSettings
│  ├─ db.ts             # SQLite 连接、迁移、事务
│  ├─ logger.ts         # 主进程异常日志（userData/logs/main.log，512KB 轮转）
│  ├─ opener.ts         # 安全打开网页/路径、存在性校验（win32 UNC 超时 / darwin POSIX 路径）
│  ├─ settings.ts       # settings 表 + 窗口 bounds 记忆
│  ├─ ipc.ts            # 注册所有 ipcMain.handle
│  ├─ filterSql.ts      # filter JSON → WHERE 子句
│  └─ repo/
│     ├─ tasks.ts       # list / create / update / toggle / delete
│     ├─ tags.ts
│     ├─ links.ts
│     └─ views.ts
├─ preload/
│  └─ index.ts          # contextBridge 白名单 API
├─ shared/
│  └─ types.ts          # 跨层 DTO / API 类型（纯类型，无运行时代码、无 Node 依赖）
└─ renderer/
   ├─ index.html        # 主窗口 HTML 入口
   ├─ quickadd.html     # 快速添加小窗 HTML 入口
   └─ src/
      ├─ main.tsx       # React 挂载与窗口路由
      ├─ app/
      ├─ components/
      ├─ hooks/
      ├─ i18n/
      ├─ lib/
      └─ styles/
```

### 2.2 依赖方向

```text
renderer (浏览器)  →  window.api (preload)  →  IPC  →  main (Node/Electron)
```

- `renderer/` **禁止**直接 import `main/` 或 `preload/` 源码，也禁止使用 Node API、`fs`、`path`、SQL；只能通过 `window.api` 访问能力。
- `src/shared/types.ts` 是唯一的跨层类型层：main / preload / renderer 都可用 `import type` 引用；它只允许出现类型与 `type` 别名，禁止运行时代码与 Node/Electron 导入。preload 对外 `export type { ... } from '../shared/types'` 保持引用兼容。
- `preload/` 只做 `contextBridge` 白名单和类型声明，不放业务逻辑、不发 SQL、不读文件。
- `main/` 不 import `renderer/`；窗口只加载构建后的 HTML/JS。
- `repo/` 只被 `main/` 调用；SQL 集中在 `repo/` 与 `db.ts`，不写进 `ipc.ts` 或组件。
- `resources/` 在运行时只读；数据库写入用户数据目录（Windows `%APPDATA%\DesktopTodo\data.db`、macOS `~/Library/Application Support/DesktopTodo/data.db`），不写入安装目录。
- 如果确实需要跨层类型，先在本文件增加 `src/shared/` 的说明并评审，不直接新增第三套类型目录。

### 2.3 入口与页面

- 主窗口加载 `src/renderer/index.html`；快速添加加载 `src/renderer/quickadd.html`。
- 三窗口（Widget / Manager / Capsule）是同一个 renderer bundle 的不同视图，不新建三套 HTML。
- 主题 token 只从 `design/ui/tokens.css` 复制到 `src/renderer/src/styles/tokens.css`；组件只消费 `var(--token)`。

## 3. 命名规则

| 类型 | 规则 | 示例 |
|------|------|------|
| 目录 | 小写 kebab-case | `src/renderer/src/app/`、`src/main/repo/` |
| 源码文件 | 小写 kebab-case；React 组件用 PascalCase | `filterSql.ts`、`TaskRow.tsx` |
| 文档 | `NN-KEBAB-CASE.md`，编号连续 | `06-IMPLEMENTATION-BRIEF.md`、`09-PROJECT-STRUCTURE.md` |
| 设计截图 | `app-*.png` | `app-desktop.png` |
| 资源 | 小写 kebab-case | `resources/seed.json` |

- `src/` 内文件名只用 ASCII；中文只出现在用户可见文案与 `design/` 历史稿中。
- 不再使用 `handoff/`、`prototype/`、根级 `ui/`、`06-NEW-SESSION-PROMPT.md` 这些旧名字。
- 旧路径映射：`handoff/` → `docs/`；`prototype/` → `design/`；`docs/ui/` → `design/ui/`。

## 4. 生成物与忽略规则

以下路径/文件不提交，且不在实施前手工创建：

```text
node_modules/
out/
release/
dist/
*.log
*.db
*.db-wal
*.db-shm
.DS_Store
```

- `release/` 只在 M6 打包时由 electron-builder 创建；`out/` 在 M0 首次构建时创建。
- 数据文件在用户数据目录（Windows `%APPDATA%\DesktopTodo\`、macOS `~/Library/Application Support/DesktopTodo/`），不在项目目录。
- `resources/seed.json` 入库，仅供开发首屏对照；正式版首次启动不导入它。

## 5. 当前目录接口（实施前）

当前已按本规范建好以下目录；除 `resources/seed.json` 外为空，空目录是实施占位，不是无用目录：

```text
desktop-todo/
├─ AGENTS.md
├─ docs/
├─ design/
├─ build/
├─ resources/
│  └─ seed.json
├─ scripts/
└─ src/
   ├─ main/
   │  └─ repo/
   ├─ preload/
   └─ renderer/
      └─ src/
         ├─ app/
         ├─ components/
         ├─ hooks/
         ├─ i18n/
         └─ styles/
```

- `docs/` 当前为 `00`–`09` 连续编号；`06-IMPLEMENTATION-BRIEF.md` 是实施入口，`09` 是本文。
- `resources/seed.json` 已从旧的 `docs/assets/seed.json` 迁移过来，`docs/assets/` 已删除。
- `release/`、`out/` 尚未创建，由构建工具在对应阶段生成。
- 不在当前阶段创建根级 `package.json` 等空文件；它们由 M0 按 04 技术方案创建。

## 6. 实施阶段目录创建顺序

| 阶段 | 新增内容 |
|------|----------|
| M0 | 根级 4 个配置文件 + `src/main/index.ts`、`windows.ts`、`preload/index.ts`、`renderer/index.html`、`renderer/src/main.tsx`；构建生成 `out/` |
| M1 | `src/main/db.ts`、`repo/*`、`filterSql.ts`、`resources/seed.json` 读取；测试与源码同目录 |
| M2 | `renderer/src/app/Widget.tsx`、`components/`、`hooks/`、`styles/` |
| M3 | `renderer/src/app/Manager.tsx`、`components/` 的筛选/编辑/管理组件 |
| M4 | `src/main/opener.ts`、`links` repo 与编辑面板链接区 |
| M5 | `src/main/tray.ts`、`shortcuts.ts`、`login.ts`、`settings.ts`、`renderer/quickadd.html`、`app/QuickAdd.tsx` |
| M6 | 根级 `README.md`；electron-builder 生成 `release/`；不新增源码目录 |

单元测试不建独立 `tests/` 根：测试放在被测试源码同目录，命名 `*.test.ts`；如需 Vitest 根配置，在 M1 增加 `vitest.config.ts` 并在本文登记。

### 6.1 实施补充（M0 登记）

以下内容在实施中新增，先登记于此再使用：

- `src/renderer/src/lib/`：渲染层共享模块目录，按领域聚合（`date.ts` 时间与逾期文案、`parseQuick.ts` 输入解析、`filters.ts` 筛选状态与 chips、`format.ts` 文本/链接格式化、`links.ts` 链接打开结果判定）。不为单个函数拆文件。
- `src/renderer/src/styles/`：`tokens.css`（从 `design/ui/tokens.css` 原样复制）、`app.css`（全局基础样式、`@font-face`、滚动条）、`inter-variable.woff2`、`noto-serif-variable.woff2`（从 `design/fonts/` 复制，随渲染层打包）。
- `scripts/`：`make-icons.py`（生成 Windows `build/icon.ico` / `tray.ico`，以及 macOS `build/icon.png`（1024 应用图标源）与 `build/trayTemplate.png` / `trayTemplate@2x.png` 菜单栏模板图）、`fetch-native-assets.py`（离线放置 Electron 与 better-sqlite3 预编译二进制；macOS 使用 `--arch arm64`（仅 Apple 芯片；Intel/x64 不在支持范围）、`Electron.app` 符号链接解包、curl 回退与 `--local` 离线安装）、`electron-runtime.cjs`（dev/测试/打包脚本共用的 Electron 运行时定位：Windows 复制到工作区外执行以规避本机 GUI 限制，macOS 直接使用 `node_modules` 内 `Electron.app`）、`dist-mac.cjs`（macOS 安装包入口：取 arm64 原生模块再打 dmg，`--dir` 只出解包目录不生成 dmg，见 §6.1 末）、`screenshot.ps1`（DPI 感知验收截图）、`run-tests.cjs`（用 Electron 自带 Node 运行 Vitest，解决 better-sqlite3 ABI 与浏览器同版本）、`dev-launch.cjs`（从工作区外副本启动 Electron，规避本机 workspace 路径下 GUI 进程限制）、`audit-ui.mjs`（真实 UI 交互审计：经 CDP 驱动挂件/胶囊/完整窗口/弹层/键盘全链路，74 项断言，`pnpm audit`）。
- `vitest.config.ts`：M1 增加的 Vitest 根配置（node 环境、`src/**/*.test.ts`）。
- `src/shared/types.ts`（M2 登记）：跨层 DTO / API 类型（`TaskDTO`、`FilterDTO`、`DesktopTodoApi` 等），只放类型；preload 从这里 `import type` 并 `export type { ... } from '../shared/types'` 对外转出，renderer 用 `import type` 引用，避免 renderer 直接 import preload 源码。
- `src/renderer/src/app/`（M2/M3 登记）：页面与页面级组合，M0 只有 `main.tsx`，现按视图拆为 `App.tsx`（按 `?view=` 路由 + ToastProvider + 挂件/胶囊形态切换）、`Widget.tsx`、`Manager.tsx`、`Capsule.tsx`、`QuickAdd.tsx`、`FilterBar.tsx`（筛选行与四个浮层）、`SettingsModal.tsx`、`ViewMenu.tsx`（桌面视图下拉）。页面层只做组合与数据接线，不复制组件样式。
- `src/renderer/src/components/`（M2 登记）：`Icons.tsx`、`anchoredPosition.ts`、`Button.tsx`、`IconButton.tsx`、`Checkbox.tsx`、`Chip.tsx`、`ProgressRing.tsx`、`EmptyState.tsx`、`Modal.tsx`、`Popover.tsx`、`Toast.tsx`、`LinkRow.tsx`、`TaskRow.tsx`、`DateTimePicker.tsx`、`Composer.tsx`、`EditorModal.tsx`、`ManageModal.tsx`、`DeleteConfirm.tsx`、`NoticeModal.tsx`（M6 后追加：应用内提示弹窗，复用 Modal embedded），与 docs/08 §6 落点一致。
- `src/main/logger.ts`、`src/main/logger.test.ts`（2026-11-22 登记）：主进程异常日志——错误详情格式化、`userData/logs/main.log` 追加写入、超过 512KB 轮转为 `main.old.log`；由 `index.ts` 注册 `uncaughtException` / `unhandledRejection` 收口（退出阶段只写日志、不弹原生错误框，用户 m07685）。
- `src/main/notices.ts`、`src/main/notices.test.ts`、`src/renderer/src/app/NoticeWindowHost.tsx`（2026-11-22 登记）：应用内提示体系——主进程提示队列（注入 presenter，独立 472 宽透明提示窗口，加载失败 2.5s 回退原生 dialog）+ 渲染层宿主（订阅 `on.notice`、测量高度上报、确认回执）。
- `src/renderer/src/lib/links.ts`（M4 登记）：`isLinkUnavailable(result)` 统一「找不到该位置」判定（missing + 网络位置 unreachable，docs/03 第 127 行）；`autoLinkTitle(target)` 生成/回退链接自动标题（编辑弹窗内联标题留空时使用，规则同原型：URL 去协议截断 44 字、本地路径取最后一段）。
- `src/renderer/src/lib/links.test.ts`（2026-11-22 登记）：链接自动标题与识别规则的单元测试（URL/www/UNC/盘符/危险协议/空白）。
- `src/renderer/src/app/HelpModal.tsx`（2026-11-22 登记）：应用内「使用说明」弹窗，复用 `Modal` wide，只读渲染 `i18n/zh.ts` 的 `help.sections`；入口在完整窗口侧栏 footer「设置」之上。
- `src/renderer/src/lib/scroll.ts`（2026-11-22 登记）：日期选择器时/分列表的滚轮平滑滚动纯函数——滚轮增量按 deltaMode 归一（像素 ×0.4 / 行 ×24 / 页 ×clientHeight，单次限幅 ±120）、目标值 clamp、160ms ease-out 进度；`DateTimePicker.tsx` 用它接管 `.dp-tl-scroll` 的 wheel，reduced-motion 直接定位。
- `src/renderer/src/lib/scroll.test.ts`（2026-11-22 登记）：滚轮归一、目标 clamp 与缓动进度的单元测试（3 describe / 9 用例）。
- `src/renderer/src/lib/scope.ts`（M2 登记）：九视图作用域、五维筛选、Tab、排序、分组、计数、进度环、胶囊摘要等纯函数；渲染层一次性拉全量任务后本地计算（IPC `FilterDTO` 无法表达收件箱/即将到期/保存视图的作用域语义）。
- `src/renderer/src/hooks/useFilter.ts`、`useTimeUsage.ts`（M2 登记）：筛选状态与快捷时间使用统计（读 settings `timeUsage`，写入用 `settings.set`）。
- `src/renderer/quickadd.html`（M5 登记）：快速添加独立窗口入口，与 `index.html` 共用同一 renderer bundle（`main.tsx?view=quickadd`）。
- `docs/acceptance/`（M6）：验收截图与记录，只读证据，不参与运行时。
- `src/main/app-menu.ts`、`src/main/app-menu.test.ts`、`src/main/macos.ts`（2026-11-23 macOS 版本登记）：`app-menu.ts` 构建/安装 macOS 应用菜单（桌面待办 / 编辑 / 窗口；「编辑」菜单的 role 是 ⌘C/⌘V/⌘A/⌘Z 生效的前提），`installApplicationMenu` 非 darwin 平台直接 return，Windows 行为不变；`app-menu.test.ts` 覆盖菜单结构（顶层菜单、编辑 role、窗口入口与点击回调）；`macos.ts` 封装 `app.dock.show/hide` 与 `app.focus({ steal: true })`，非 darwin 平台全部 no-op。
- `src/main/tray-menu.ts`（既有文件，2026-11-23 补充）：托盘/菜单栏菜单模板保持纯函数，新增 `platform` 注入与 macOS 文案（「登录时启动」「退出桌面待办」）；`tray.ts` 在 darwin 使用模板图标并改为左键单击弹菜单。
- `src/renderer/src/lib/platform.ts`（2026-11-23 macOS 版本登记）：渲染层平台快照 `platform` / `isMacOS()`，由 preload 注入的 `window.api.platform` 读取；无 Electron 环境回退 `'win32'`，保证 Windows 文案与既有单测行为不变。
- `build/trayTemplate.png` / `build/trayTemplate@2x.png`、`build/icon.png`（2026-11-23 登记）：`icon.png` 由 `make-icons.py` 重新生成为 1024 macOS 应用图标源（四周留白 + 大圆角，`electron-builder.yml` 的 `mac.icon` 使用）；`trayTemplate*.png` 为菜单栏模板图标（18 / 36，黑 + alpha，系统自动适配深浅色），打包经 `extraResources` 放到 `process.resourcesPath`。
- `.github/workflows/release.yml` 的 `build-mac`、`release-notes`（2026-11-23 登记）：`build-mac` 在 `macos-latest` 上跑类型检查 + 单测 + `node scripts/dist-mac.cjs` 打 arm64 dmg 并上传 Release，Release 说明只提 Apple 芯片；`release-notes` 汇总两个平台后统一写 Release 说明，避免两个发布作业互相覆盖 body。原 `build-win` 作业保持不变。
- macOS 打包链路（2026-11-23 登记）：`electron-builder.yml` 的 `mac` / `dmg` 段（`icon: build/icon.png`、`target: dmg`、`artifactName: DesktopTodo-${version}-${arch}.dmg`、`dmg.sign: false`、Applications 快捷方式）配合 `scripts/dist-mac.cjs`：打包前先 `fetch-native-assets.py --skip-electron --arch arm64` 覆盖 better-sqlite3 预编译 `.node`，再 `electron-builder --mac --arm64 --publish never`；入口脚本为 `pnpm dist:mac`（只出 Apple 芯片 arm64 包）。
- 依赖版本补充：`electron` 固定 `40.10.2`（满足 docs/04「Electron 32+」；33.x 在本机 Windows 11 build 26200 的 GUI 进程启动即崩溃，且 better-sqlite3 `12.11.1` 有对应 `electron-v143` 预编译包）。`electron-builder.yml` 的 `npmRebuild: false` 与此配套。


## 7. 执行与校验

1. 实施前先读本文，再读 `06-IMPLEMENTATION-BRIEF.md` 的读取顺序。
2. 新增或改名目录/文件前，先改本文，再改代码；不先改本文视为不符合工程规范。
3. 每次里程碑结束检查：`git status` 中无 `out/`、`release/`、`node_modules/`、`*.db`；`docs/` 编号连续；`src/` 无越界 import。
4. 结构核对命令：

```bash
cd "$(git rev-parse --show-toplevel)"   # 进入项目根（Windows Git Bash / macOS / Linux 通用）
find . -maxdepth 4 -type d | sort
find docs -maxdepth 1 -type f | sort
```

5. 根目录出现本文未列出的目录时，要么补本文，要么删除；不允许临时的 `new/`、`tmp/`、`backup/` 长期留在项目内。

## 8. 与旧目录的对应关系

| 旧路径 | 新路径 | 处理 |
|--------|--------|------|
| `handoff/` | `docs/` | 已迁移 |
| `prototype/` | `design/` | 已迁移 |
| `docs/prototype/` | 删除 | 已删，避免重复副本 |
| `docs/ui/` | `design/ui/` | 已迁移 |
| `docs/06-NEW-SESSION-PROMPT.md` | `docs/06-IMPLEMENTATION-BRIEF.md` | 已改名，编号补回 06 |
| `docs/assets/seed.json` | `resources/seed.json` | 已迁移 |

以上旧路径不再创建；引用统一使用新路径。
