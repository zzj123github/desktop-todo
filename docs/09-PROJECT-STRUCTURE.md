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
│  ├─ preload/               # contextBridge 白名单
│  └─ renderer/              # React 渲染层
│     └─ src/
│        ├─ app/             # Widget / Manager / Capsule / QuickAdd
│        ├─ components/      # 通用组件
│        ├─ hooks/           # useTasks / useFilter / useSettings
│        ├─ i18n/            # 中文文案
│        ├─ lib/             # 日期/解析/筛选/格式化等共享模块（按模块聚合）
│        └─ styles/          # tokens.css / app.css / 字体
├─ build/                    # 构建资产（icon.ico / tray.ico），不是产物目录
├─ resources/                # 运行时静态资源（seed.json）
├─ scripts/                  # 维护脚本（seed.ts 等）
├─ release/                  # electron-builder 产物，生成，不提交
└─ out/                      # electron-vite 构建产物，生成，不提交
```

### 1.1 根目录职责

| 路径 | 入库 | 首次创建 | 职责 |
|------|------|----------|------|
| `AGENTS.md` | 是 | 已有 | 工程纪律与协作规则 |
| `README.md` | 是 | M6 | 安装、SmartScreen、数据目录、构建命令 |
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
│  ├─ windows.ts        # widget / manager / capsule / quickadd 窗口
│  ├─ tray.ts           # 托盘菜单
│  ├─ shortcuts.ts      # globalShortcut 注册/注销
│  ├─ login.ts          # app.setLoginItemSettings
│  ├─ db.ts             # SQLite 连接、迁移、事务
│  ├─ opener.ts         # 安全打开网页/路径、存在性校验（UNC 超时）
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
- `preload/` 只做 `contextBridge` 白名单和类型声明，不放业务逻辑、不发 SQL、不读文件。
- `main/` 不 import `renderer/`；窗口只加载构建后的 HTML/JS。
- `repo/` 只被 `main/` 调用；SQL 集中在 `repo/` 与 `db.ts`，不写进 `ipc.ts` 或组件。
- `resources/` 在运行时只读；数据库写入 `%APPDATA%\DesktopTodo\data.db`，不写入安装目录。
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
- 数据文件在 `%APPDATA%\DesktopTodo\`，不在项目目录。
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

- `src/renderer/src/lib/`：渲染层共享模块目录，按领域聚合（`date.ts` 时间与逾期文案、`parseQuick.ts` 输入解析、`filters.ts` 筛选状态与 chips、`format.ts` 文本/链接格式化）。不为单个函数拆文件。
- `src/renderer/src/styles/`：`tokens.css`（从 `design/ui/tokens.css` 原样复制）、`app.css`（全局基础样式、`@font-face`、滚动条）、`inter-variable.woff2`、`noto-serif-variable.woff2`（从 `design/fonts/` 复制，随渲染层打包）。
- `scripts/`：`make-icons.py`（生成 `build/icon.ico` / `tray.ico`）、`fetch-native-assets.py`（离线放置 Electron 与 better-sqlite3 预编译二进制）、`screenshot.ps1`（DPI 感知验收截图）、`run-tests.cjs`（用 Electron 自带 Node 运行 Vitest，解决 better-sqlite3 ABI 与浏览器同版本）、`dev-launch.cjs`（从工作区外副本启动 Electron，规避本机 workspace 路径下 GUI 进程限制）。
- `vitest.config.ts`：M1 增加的 Vitest 根配置（node 环境、`src/**/*.test.ts`）。
- `docs/acceptance/`（M6）：验收截图与记录，只读证据，不参与运行时。
- 依赖版本补充：`electron` 固定 `40.10.2`（满足 docs/04「Electron 32+」；33.x 在本机 Windows 11 build 26200 的 GUI 进程启动即崩溃，且 better-sqlite3 `12.11.1` 有对应 `electron-v143` 预编译包）。`electron-builder.yml` 的 `npmRebuild: false` 与此配套。


## 7. 执行与校验

1. 实施前先读本文，再读 `06-IMPLEMENTATION-BRIEF.md` 的读取顺序。
2. 新增或改名目录/文件前，先改本文，再改代码；不先改本文视为不符合工程规范。
3. 每次里程碑结束检查：`git status` 中无 `out/`、`release/`、`node_modules/`、`*.db`；`docs/` 编号连续；`src/` 无越界 import。
4. 结构核对命令：

```bash
cd C:/Users/lazasons/Workspace/desktop-todo
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
