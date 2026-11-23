# 项目概览

- 名称：桌面待办（DesktopTodo）
- 类型：纯本地 Electron 桌面应用；Electron 40 / React 18 / TypeScript / Vite 5 / better-sqlite3 / electron-builder；手写 CSS + design token
- 目标：一次性完成 M0–M6，交付可运行 Windows exe（portable + NSIS 安装包）
- 权威规格：`docs/00`–`docs/09`（唯一实施规格源）、`design/ui/tokens.css`、`design/app/` 原型、`design/app-*.png` 截图
- 桌面副本 `C:\Users\lazasons\Desktop\桌面待办-交付包\` 只读，不作为实施读取源
- 当前状态（2026-11-21）：**M0–M6 全部完成**。
  - 源码：项目根 `src/`（main / preload / renderer / shared）；三窗口（挂件、胶囊同窗口切换、完整窗口懒创建）+ 快速添加入口。
  - 数据：SQLite WAL 于 `%APPDATA%\DesktopTodo\data.db`；仓库层 `src/main/repo/*`；筛选 SQL 与渲染层口径双实现，均有单测。
  - 交付物：`npm run dist:win` → `release/DesktopTodo-1.0.0-portable.exe`（约 97.7MB）、`release/DesktopTodo-1.0.0-setup.exe`（约 106.2MB）；构建需 `ELECTRON_MIRROR` + `ELECTRON_BUILDER_BINARIES_MIRROR` 指向 npmmirror。
  - 验证：`pnpm typecheck` 0 错误；`node scripts/run-tests.cjs` 11 文件 161 用例全过；验收记录 `docs/acceptance/M6-ACCEPTANCE.md`（含截图 `docs/acceptance/screens/`）。
  - 已知限制：本机 DSH 会话无法做鼠标级 GUI 自动化（拖动、托盘菜单、原生对话框按钮、真实文件拖放），这几项为人工待验；打包产物需从 workspace 外目录启动验证。

## 当前状态（2026-11-23 更新）：macOS 版本完成并验收（通过，仅 Apple 芯片 arm64）

- 交付物：`release/DesktopTodo-1.0.0-arm64.dmg`（120,670,172 B / 115.1 MiB，SHA-256 `ea668f6de62d6603066a0cdb0a6559579d0059bbd09487d53ab6097475bcf616`）；`hdiutil verify` VALID，挂载后为「桌面待办.app + Applications 快捷方式」，Info.plist `com.lazasons.desktoptodo` / 1.0.0 / 最低 macOS 12.0 / productivity；包内主程序与 `better_sqlite3.node` 均为 arm64。未签名未公证。**仅支持 Apple 芯片（arm64）：Intel 芯片 Mac / x64 包 / Rosetta 2 不在支持范围（未构建、未验证 x64；原 x64 dmg 已删除）。**
- 构建：`pnpm dist:mac` 只出 Apple 芯片（arm64）dmg，`node scripts/dist-mac.cjs --dir` 只出解包目录 `release/mac-arm64/`（调试用）→ `scripts/dist-mac.cjs` 打包前 `fetch-native-assets.py --skip-electron --arch arm64` 取 better-sqlite3 预编译 `.node`，再 `electron-builder --mac --arm64`（`npmRebuild: false`，一个 `.node` 只能对一个架构）。CI `.github/workflows/release.yml` 的 `build-mac` 只打/上传 arm64 dmg，`release-notes` 汇总两个平台说明（配置就绪，未实跑）。
- 验证（macOS 26.5 arm64 / Apple M4）：`tsc --noEmit` 0 错误；`node scripts/run-tests.cjs run` **18 文件 / 247 用例全部通过**；安装到 `/Applications/桌面待办.app` 后 `open` 启动（launchd 拉起）、真实数据目录 `~/Library/Application Support/DesktopTodo/data.db` 写入；对**安装后 arm64 app** 跑 CDP 全量 UI 审计 **74 项 ALL PASS**。
- 平台映射：菜单栏模板图标（`trayTemplate.png`/`@2x`，系统适配深浅色）+ 左键单击弹菜单；Dock 默认隐藏、打开完整窗口时显示；macOS 应用菜单（桌面待办/编辑/窗口）；登录项（`openAtLogin` + `wasOpenedAtLogin` 静默启动）；POSIX 本地链接（绝对 `/...` 与 `file:///` 本机 URL）；数据目录 `~/Library/Application Support/DesktopTodo/`；保留 Electron 默认硬件合成（Windows 的软件合成省内存结论不迁移）。
- 验收记录：`docs/acceptance/M7-MACOS-ACCEPTANCE.md`（Windows 仍为 `docs/acceptance/M6-ACCEPTANCE.md`）。
- 已知限制（macOS，未验证项）：未签名未公证（Gatekeeper 首次拦截，下载后放行流程未人工验证）；登录项真实安装+重启未验证（受限环境实测 `Operation not permitted`）；菜单栏图标视觉/深浅色/多显示器/Spaces、应用菜单原生交互、Dock 视觉、真实 Finder 拖拽未人工验证；GitHub Actions `build-mac` 未实跑；卸载后数据保留未实测；macOS 内存/性能未测量；深色模式未人工验证；本地链接只支持绝对 POSIX 路径与 `file:///` 本机 URL。Intel 芯片 Mac / x64 包 / Rosetta 2 不在支持范围（不是待验证项）。

## 本机工具与分析

- 代码索引（CodeGraph）：本机已装 `@colbymchenry/codegraph` 1.6.0（`codegraph` 命令）；项目已执行 `codegraph init`，生成本地 `.codegraph/`（99 文件 / 1383 节点 / 5620 边，约 6.6MB；已在 `.gitignore` 忽略，换机器需各自重建）。
  - 查询优先：`codegraph explore "<英文问题>"`（符号源码 + 调用链 + blast radius）、`codegraph context "<任务>"`、`codegraph node <符号>`、`codegraph callers|callees|impact|affected`、`codegraph query <关键字>`、`codegraph files`。中英文都试过，英文 query 命中更好。
  - 索引自动同步默认开启（CodeGraph 进程运行时的文件监听）；脱离该进程改动代码后可用 `codegraph sync` 手动同步，`codegraph status` 查看状态；`codegraph daemon` 管理后台进程，`codegraph uninit` 移除项目索引。 AGENTS.md §4.1 已约定：定位/理解/影响面默认先查 CodeGraph，再用 grep/读文件复核；规格与文档仍按 `docs/` 与 `.agents/` 读取。
## 长期纠正 / Standing corrections

- 新功能开发（含 UI 交互调整、UI 调整、UX 调整；**Bug 修复除外**）必须先做原型、再开发；原型不得直接修改已定稿原型：从 `design/app/`（版本见 `design/README.md`）完整复制到独立提案目录 `design/proto-v<版本>/`，写 `PROPOSAL-v<版本>.md`，经用户确认后才同步 `docs/` 规格与实施代码（用户 2026-11-22 明确要求，规范见 AGENTS.md §4.2）。
- 阶段门：原型/提案交付后必须停 turn 等用户明确确认（AGENTS.md §4.2.1）；「原型设计、开发、讨论」「做一下」「继续」等说法不构成确认；Agent 不得自行把 `PROPOSAL` 状态改为「已确认」（用户 2026-11-23 纠正，见 decisions D26）。
- 原型基线：`design/app/` 当前 v1.4；提案 `design/proto-v1.5/`（悬浮球 + 固定到桌面）为「待确认」状态，确认后才提升为新基线并同步静态原型/截图与规格。
