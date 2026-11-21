# 坑与陷阱（实测）

> 每条：现象 + 原因 + 规避。按最近验证时间排序。

## 2026-11-21 · workspace 内 Electron GUI 进程崩溃 / 写 %TEMP% EPERM

- 现象：从 `node_modules/.pnpm/electron@.../dist/electron.exe` 启动，GUI 模式无窗口、退出码 `0x80000003`（-2147483645），`%LOCALAPPDATA%\CrashDumps` 生成 dmp；`--version` 同样崩。用 `ELECTRON_RUN_AS_NODE=1` 能跑，但 `fs.mkdirSync` 写 `%TEMP%`/`%APPDATA%` 返回 `EPERM`，写 workspace 正常。
- 对照：同一份 dist 复制到 `C:\Users\lazasons\etest`（workspace 外）后，GUI 正常显示窗口，写 `%APPDATA%` 正常。
- 原因：本机 DSH 会话对 workspace 路径下执行的进程施加了文件系统限制（与 exe 路径相关，非工作目录）。
- 规避：dev/test 用 `scripts/electron-runtime.cjs` 复制运行时到 `%LOCALAPPDATA%\desktop-todo-dev\` 再执行；验收打包产物时也从 workspace 外目录启动。用户正常双击安装/portable 不受影响。

## 2026-11-21 · shell 自带 `ELECTRON_RUN_AS_NODE=1`

- 现象：直接启动 electron.exe 时报 `TypeError: Cannot read properties of undefined (reading 'requestSingleInstanceLock')`，因为 Electron 被当成 Node 执行。
- 规避：启动 GUI 前 `env -u ELECTRON_RUN_AS_NODE`（`scripts/dev-launch.cjs` 已在 spawn 时清除）。

## 2026-11-21 · PowerShell 截图在高 DPI 下漏窗口

- 现象：`CopyFromScreen` 生成的截图只有 1463×914，屏幕实际 2560×1600，右下/右上窗口不在图里。
- 原因：非 DPI 感知进程拿到的是虚拟化逻辑坐标。
- 规避：`scripts/screenshot.ps1` 先 `SetProcessDpiAwareness(2)` 再截图；脚本内容保持纯 ASCII（Windows PowerShell 5.1 读取无 BOM 的 UTF-8 中文注释会解析失败）。

## 2026-11-21 · npm/GitHub 网络

- npm registry 可用；GitHub release 直连 ECONNRESET（不要从 GitHub 下二进制）；npmmirror binaries 镜像可用；Electron 官方缓存 `%LOCALAPPDATA%\electron\Cache` 里已有 40.10.2/43.3.0。
- `better-sqlite3@12.11.1` 的 npm dist 最高就是 12.11.1；`12.12.0` 不存在（pnpm 会报 ERR_PNPM_NO_MATCHING_VERSION）。

## 2026-11-21 · pnpm 10 默认拦截依赖构建脚本

- 现象：`electron` / `better-sqlite3` 安装后没有二进制。
- 规避：`package.json` 的 `pnpm.onlyBuiltDependencies` 放行；但本项目实际用 `pnpm install --ignore-scripts` + `scripts/fetch-native-assets.py` 放置预编译二进制（本机无编译器）。

## 2026-11-21 · 鼠标级 OS 自动化不可用（本机沙箱）

- 现象：`mouse_event`/`SendInput` 合成的鼠标点击、拖动都不到达本应用窗口（点挂件收起按钮/拖动挂件/点托盘溢出箭头均无反应）；但 `keybd_event` 能触发全局快捷键（RegisterHotKey 系统级）。
- 影响：拖动位置记忆、托盘菜单点击、原生对话框按钮、真实文件拖放无法自动验收，只能代码审查 + 单测 + 人工冒烟。
- 规避：键盘交互用 `keybd_event`（`.agents/tmp/keys.ps1`）；页面内交互用 CDP `Runtime.evaluate`/`Input.dispatchKeyEvent`；截图用 CDP `Page.captureScreenshot`（可指定 deviceMetrics）。

## 2026-11-21 · PowerShell 5.1 执行无 BOM UTF-8 脚本会误解码中文

- 现象：`powershell.exe -File xxx.ps1` 中含中文路径/进程名的脚本报「系统找不到指定的文件」，但同样代码用 `-Command` 传入却正常。
- 原因：PowerShell 5.1 对无 BOM 的 UTF-8 脚本按 ANSI 解码，中文字符串被破坏。
- 规避：自动化脚本保持纯 ASCII（用 `Get-ChildItem` 枚举 exe、用 `$_.Path` 过滤进程），或写带 BOM 的 UTF-8。生成脚本时可直接写 ASCII 版本。

## 2026-11-21 · settings.get/set 入参是对象

- 现象：`window.api.settings.get('capsule')` 报「参数格式不正确」。
- 规避：`settings.get({ key })`、`settings.set({ key, value })`（preload 契约按 docs/04 的对象入参）。

## 2026-11-21 · `node -e` 顶层 await 报 ERR_AMBIGUOUS_MODULE_SYNTAX

- 规避：用 `node --input-type=module -e '...'`；或把脚本写成 `.mjs`。

## 2026-11-21 · 打包下载需 npmmirror 镜像

- `pnpm dist:win` 默认从 GitHub 下 Electron/NSIS 资源会 ECONNRESET；必须设置
  `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 与
  `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`。
- 打包产物（win-unpacked/portable）在本机 workspace 内启动会崩，需复制到 `%LOCALAPPDATA%\desktop-todo-dev\` 下运行；启动时用 `Set-Location` 切到产物目录再 `Start-Process`，否则子进程继承 workspace cwd 同样受影响。
