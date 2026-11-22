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

## 本机工具与分析

- 代码索引（CodeGraph）：本机已装 `@colbymchenry/codegraph` 1.6.0（`codegraph` 命令）；项目已执行 `codegraph init`，生成本地 `.codegraph/`（99 文件 / 1383 节点 / 5620 边，约 6.6MB；已在 `.gitignore` 忽略，换机器需各自重建）。
  - 查询优先：`codegraph explore "<英文问题>"`（符号源码 + 调用链 + blast radius）、`codegraph context "<任务>"`、`codegraph node <符号>`、`codegraph callers|callees|impact|affected`、`codegraph query <关键字>`、`codegraph files`。中英文都试过，英文 query 命中更好。
  - 索引自动同步默认开启（CodeGraph 进程运行时的文件监听）；脱离该进程改动代码后可用 `codegraph sync` 手动同步，`codegraph status` 查看状态；`codegraph daemon` 管理后台进程，`codegraph uninit` 移除项目索引。

## 长期纠正 / Standing corrections

（暂无）
