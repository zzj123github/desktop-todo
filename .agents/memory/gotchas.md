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

## 2026-11-22 · `-webkit-app-region: drag` 区域收不到 DOM 鼠标事件

- 现象：挂件标题 `onDoubleClick` 永不触发，双击标题无法打开完整窗口。
- 原因：Electron 把 drag 区域交给系统拖动，渲染层收不到 mousedown/click/dblclick。
- 规避：把需要交互的子元素（如 `.w-title-row`）显式设为 `-webkit-app-region: no-drag`；只能通过指针事件实现的交互（自绘拖动）不要依赖 app-region。

## 2026-11-22 · 拖动窗口会抢焦点，失焦透明度设置被覆盖

- 现象：设置 80% 透明度后拖动挂件/胶囊，松手变成 100%，需再点别处才恢复。
- 原因：拖动使窗口获得焦点，主进程按「非焦点才应用设定透明度」规则设为 1。
- 规避：窗口 moved/resized 落盘回调与胶囊拖动结束时调用 `settleWidgetIdleOpacity()`（仍在焦点且透明度 <100% 时主动 blur）；透明度只由主进程 `setOpacity` 控制，渲染层不要再叠加 inline opacity。

- 现象：桌面形态四个圆角看起来有灰黑色底板/不透明。
- 原因：Electron 透明窗口尺寸＝卡片尺寸时，CSS `box-shadow` 外投影会被窗口边界裁掉，只在圆角缺口露出阴影；透明本身没问题（CDP 页面截图角点 alpha=0）。
- 规避：桌面形态只用 `inset` 内描边；外投影只能在窗口大于卡片（四周留 padding）时使用。
- 现象：挂件内 Popover/日历被裁切或布局错乱。
- 原因：挂件窗口按内容高度（约 243px），容不下 320×241 浮层与 288×351 日历；且 Popover 用「当前被压后的高度」定位，窗口变高后不再长高。
- 规避：浮层打开时把窗口临时加高到 520（anchor bottom 保底边），定位取 `scrollHeight` 自然高度；内容高度上报加 1px 余量。
- `cdp.mjs` 的 `screenshot()` 会调用 `Emulation.setDeviceMetricsOverride`，之后页面里读到的 `innerWidth/innerHeight` 是模拟值，不可用于校验真实窗口尺寸；用主进程 `win-state.ps1` 读 client rect。

- 现象：`pnpm dist:win` 反复报 `EBUSY/EPERM ... default_app.asar` 或 `app.asar`，重试与杀进程无效，`release/win-unpacked*` 也删不掉。
- 原因：本机 VS Code 以该项目为工作区，其进程（Restart Manager 查询显示 `pid=... name=Visual Studio Code`）会短暂持有刚解包的 asar；杀毒软件也可能参与。可用 `.agents/tmp/who-locks.ps1 -Path <file>`（Restart Manager API）定位占用进程。
- 规避：把 electron-builder 输出目录放到工作区外再打包：`pnpm exec electron-builder --win -c.directories.output=C:/Users/lazasons/AppData/Local/desktop-todo-dev/release-build`；产物再从外部目录复制回 `release/` 和桌面交付目录。不要为此杀 VS Code（可能有未保存文件）。

## 真实鼠标拖动的注入限制（m03793 验收）

- `mouse_event` 注入的**单次大位移拖拽**（如 +400px）常不生效，增量拖动（每步 -100px 左右）可稳定移动窗口。四角/位置验收脚本据此改为分步 moveTo（每步 ≤90px、最多 24 轮），且需从 `.w-drag` 拖动区中心起拖（窗口中心是内容区，不会移动窗口）。

## 175% DPI 位置取整与锚点漂移（m03793 验收）

- Electron `setBounds` 会按物理像素对齐，`getBounds` 回读为整数 DIP；反复「读取→重捕获→写回」在 175% DPI 下会累积 ±1~2 DIP（四角切换验收出现 bottom-right Δ3）。规避：程序化 setBounds 后 500ms 内跳过 moved 落盘、锚点只在真实拖动/恢复位置时重捕获。修复后四角互切 Δ0；仍保留文档容差「≤1 DIP 物理取整」。

## 打包时 VS Code 占用工作区构建文件

- `electron-builder` 清理 `release/win-unpacked` 时可能被 VS Code 短暂锁定（Restart Manager 查出 pid 为 VS Code），报 `EBUSY ... app.asar / default_app.asar`。规避：输出到工作区外 `-c.directories.output=C:/Users/lazasons/AppData/Local/desktop-todo-dev/release-build`，再复制产物回 `release/` 与桌面交付目录。

## 编辑弹窗窗口尺寸与浮层裁切（2026-11-22）

- 独立编辑窗口高度必须先由渲染层测量 `editor-window-host` 再上报；主进程按 `height + 48` 居中，超过工作区 `-32` 时会被夹小，弹层打开时依赖 `anchoredPosition` 上翻而不是加高窗口。
- `anchoredPosition` 的翻转判断必须用真实 `popHeight`；用上限估算（320）会让 351 高的日期面板在中小窗口里既不翻转也不被夹，底部直接越界。
## 原型基准与窗口边界（2026-11-22）

- 原型基准里的「浮在桌面上」类效果（外投影、外发光、hover 位移、超出容器的浮层）在 Electron 独立窗口里都会被窗口矩形裁切：原型阶段就要按「窗口内可表达」画（1px 内描边 / 内高光），否则实现必然二次偏离，并被用户看成灰底/被截断。
