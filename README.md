# 桌面待办

一个常驻桌面的轻量任务管理工具：桌面挂件、可收起的胶囊、完整管理窗口三种形态，纯本地 SQLite 存储，不联网、无账号。支持 Windows 10 1903+/11（x64）与 macOS 12+（Apple 芯片 arm64；Intel 芯片 Mac 不在支持范围）。

- 挂件：352px 宽，默认停靠主屏右侧，默认展示「今天」，回车即添加。
- 胶囊：284×54，收起后与挂件共用同一位置（按就近基准角保持不动），整块可单击展开、可拖动。
- 完整窗口：1100×720（最小 900×600），左侧导航 + 筛选 + 分组列表 + 任务编辑。
- 应用内提示：快捷键冲突、数据库异常等启动提示使用自建提示弹窗（独立 472 宽透明窗口 + `NoticeModal`，警示块 + 快捷键清单 + 「知道了」），不使用系统原生对话框；仅提示窗口加载失败时回退原生。

规格来源：`docs/`（PRD、数据模型、技术方案、UI 契约、验收清单）。设计与交互原型：`design/`。

## 在线预览

仓库公开并启用 GitHub Pages 后，以下页面可直接在线查看原型（无需安装）：

- 原型预览首页：https://kkk-kppi.github.io/desktop-todo/
- 可交互原型：https://kkk-kppi.github.io/desktop-todo/design/app/index.html
- 静态原型：https://kkk-kppi.github.io/desktop-todo/design/static-prototype.html

全部界面截图与整页长图在 `design/`。

## 下载

安装包发布在 GitHub Releases：

- 下载页：https://github.com/kkk-kppi/desktop-todo/releases
- 推送 `v*` tag 后，GitHub Actions 会自动构建并上传 Windows 与 macOS 两套包：
  - Windows（x64）：
    - `DesktopTodo-<version>-portable.exe`：便携版，双击即用
    - `DesktopTodo-<version>-setup.exe`：安装版，按向导安装
  - macOS（Apple 芯片 arm64）：
    - `DesktopTodo-<version>-arm64.dmg`：Apple 芯片（M1/M2/M3/M4…）；Intel 芯片 Mac 不在支持范围

本机自行构建：Windows 用 `pnpm install && pnpm dist:win`；macOS 用 `pnpm install && pnpm dist:mac`（只出 Apple 芯片 arm64 包），产物都输出到 `release/`。

## 安装

系统要求：

- **Windows**：Windows 10 1903+ / Windows 11（x64）。
- **macOS**：macOS 12+，仅 Apple 芯片（arm64）；Intel 芯片 Mac 不在支持范围（不提供 x64 包，也不需要 Rosetta 2）。

### Windows（x64）

- **便携版**：`DesktopTodo-1.0.0-portable.exe`，双击即可运行，无需安装、无需管理员权限。
- **安装版**：`DesktopTodo-1.0.0-setup.exe`，按向导安装（默认每用户安装，可选择安装目录）。

首次启动会在 `%APPDATA%\DesktopTodo\` 创建数据库；程序为单实例，重复双击只会唤起已有实例的挂件。首次启动直接展开挂件（今日视图、空列表），挂件高度随内容自适应（上限 520px）。

> **本机交付位置**：项目源码目录下 `release\` 里的 exe 不能在本机运行——本机环境会拦截从该工作区路径启动的界面程序，表现为双击无反应。可直接双击的副本放在 `C:\Users\lazasons\Desktop\桌面待办-交付物\`（含 使用说明.txt）。其他机器的用户从任意普通文件夹运行均正常。
>
> 首次运行若出现 SmartScreen「未知应用」提示，点「更多信息」→「仍要运行」即可（应用未签名）。

### SmartScreen 提示

安装包与便携版都**未做代码签名**。首次运行 Windows 可能显示「Windows 已保护你的电脑」：

1. 点击「更多信息」；
2. 点击「仍要运行」。

这是未签名应用的正常提示，程序不联网、不写入系统目录（安装版仅写入安装目录与当前用户数据目录）。

### macOS（12+）

1. 下载 Apple 芯片（arm64）的 dmg：`DesktopTodo-1.0.0-arm64.dmg`。
2. 打开 dmg，把「桌面待办.app」拖入「应用程序」文件夹（dmg 内右侧是 Applications 快捷方式）。
3. 首次启动会在 `~/Library/Application Support/DesktopTodo/` 创建数据库；程序为单实例，重复启动只会唤起已有实例的挂件（菜单栏图标 + 桌面挂件）。

**Gatekeeper 放行（未签名、未公证）**：应用未做代码签名与公证，首次打开会被 Gatekeeper 拦截，按以下任一方式放行：

- 在「应用程序」里**右键点「桌面待办」→「打开」→ 再点「打开」**；
- 或打开「系统设置 → 隐私与安全性」，在「安全性」区找到被拦截的应用提示，点「仍要打开」。

这是未签名应用的正常提示；程序不联网，数据只写入当前用户目录（见「数据与备份」）。macOS 12+ 只提供 Apple 芯片（arm64）包；Intel 芯片 Mac 不在支持范围，不提供 x64 包与 Rosetta 运行说明。

## 数据与备份

- 数据目录按平台：
  - Windows：`%APPDATA%\DesktopTodo\`（设置 → 「数据目录」可直接打开）
  - macOS：`~/Library/Application Support/DesktopTodo/`（设置 → 「数据目录」可直接打开）
- 数据库：`data.db`（SQLite，WAL 模式），另有 `data.db-wal` / `data.db-shm`
- 备份：
  - 设置 → 「导出为 JSON 备份文件」，得到可读的完整备份；
  - 或退出程序后直接复制整个 `DesktopTodo` 目录。
- 导入：设置 → 「导入」，会**覆盖当前全部数据**（导入前会二次确认）。
- 数据库损坏时会自动把原文件备份为 `data.db.bak`，并新建空库启动。

## 使用

- 挂件：底部常驻「+ 添加任务」按钮，点击展开输入框（回车保存、Shift+Enter 换行、Esc 或点外部收起）；输入里的「明天 10:00」「高」「#标签」「网址/路径」会被识别；双击标题展开完整窗口；Esc 收起为胶囊。
- 三种形态互斥：挂件、胶囊、完整窗口同一时刻只显示一种。完整窗口标题行的两个图标可「收起到挂件」「收起到胶囊」，关闭完整窗口后回到桌面形态。
- 位置基准：挂件与胶囊共用同一位置；切换形态或高度变化时，按窗口所在象限保持基准角不动（左上/右上/左下/右下，默认右上）。
- 完整窗口：点击任务行在窗口内编辑；勾选完成；「新建」或 Ctrl+N 新建；Ctrl+F 搜索；Esc 关闭窗口（回托盘）。
- 挂件：点击任务行会打开**独立的桌面级编辑窗口**（550 宽、按内容高度居中，与原型一致）；X / 取消 / 保存 / Esc / 删除后关闭，挂件位置不变。
- 链接：任务可挂多个网页、文件夹、网络共享路径；支持把文件/文件夹/网址直接拖进编辑面板或主区。Windows 支持盘符、UNC、网络共享路径；macOS 支持绝对 POSIX 路径（如 `/Users/...`）与 `file:///` 本机 URL（从 Finder 拖入文件可识别），无 UNC 概念。失效路径会提示「找不到该位置」，可重新选择或删除。
- 托盘（Windows）：单击显示/隐藏挂件，双击打开完整窗口；右键菜单可快速添加、切换开机自启、退出。
- 菜单栏（macOS）：左键单击菜单栏图标弹出菜单——显示/隐藏挂件、快速添加、打开完整窗口、登录时启动、退出桌面待办；Dock 默认隐藏，打开完整窗口时显示（可用 Cmd+Tab 切回），收起完整窗口后隐藏。
- 筛选：状态、日期、标签、优先级、关键词五维筛选，可保存为「桌面视图」在挂件/完整窗口标题旁切换。

### 全局快捷键（设置中可关闭）

| 快捷键 | 作用 |
| --- | --- |
| Ctrl+Shift+Space | 快速添加（唤起挂件并聚焦输入框） |
| Alt+H | 显示/隐藏挂件 |
| Alt+1 ~ Alt+5 | 依次切换到 收件箱 / 今天 / 已逾期 / 即将到期 / 已完成 |

窗口内快捷键：Ctrl+N 新建、Ctrl+F 搜索、Esc 关闭/收起。

macOS 上同一组快捷键注册不变（`CommandOrControl` 映射为 ⌘，`Alt` 映射为 ⌥），界面文案显示为 ⌘⇧Space（快速添加）、⌥H（显隐挂件）、⌥1–5（切换视图），窗口内为 ⌘N / ⌘F。

## 开发与构建

```bash
pnpm install                # 安装依赖
pnpm dev                    # 开发模式（构建后启动 Electron）
pnpm build                  # 编译主进程 / preload / 渲染层到 out/
pnpm typecheck              # TypeScript 检查
pnpm test                   # Vitest（在 Electron 运行时内执行，见 scripts/run-tests.cjs）
pnpm audit                  # 真实 UI 交互审计（需先用 CDP 端口启动应用，见下方说明）
pnpm dist:win               # 打包 portable + NSIS 到 release/
pnpm dist:portable          # 只打便携版
pnpm dist:nsis              # 只打安装包
pnpm dist:mac               # macOS：打包 Apple 芯片（arm64）dmg（仅 macOS 可执行）

# 真实 UI 交互审计（挂件/胶囊/完整窗口/弹层/键盘，74 项断言）：
# 1) 先带 CDP 端口启动：node scripts/dev-launch.cjs -- --remote-debugging-port=9241
# 2) 另一个终端执行：pnpm audit（可用 CDP_PORT=9242 指定端口）
#    审计会临时创建「审计*」任务/项目/标签并在结束时清理，同时恢复被切换的设置。
```

macOS 开发与构建：`pnpm dev` / `pnpm test` 在 macOS 直接可用（`scripts/electron-runtime.cjs` 在 macOS 直接使用 `node_modules` 内 `Electron.app`，不复制到工作区外）；`pnpm dist:mac` 打 Apple 芯片（arm64）dmg，`node scripts/dist-mac.cjs --dir` 只出解包目录 `release/mac-arm64/`、不生成 dmg（调试用）。`scripts/dist-mac.cjs` 会先取 arm64 的 better-sqlite3 预编译 `.node`（`npmRebuild: false`，一个 `.node` 只对应一个架构）再执行 `electron-builder --mac --arm64`；dmg 依赖 `hdiutil`，只能在 macOS 上构建。

开发调试：`pnpm dev` 启动后，在任一应用窗口（挂件 / 胶囊 / 完整窗口 / 编辑弹窗）按 **F12** 打开或关闭分离式 DevTools（DevTools 打开时不抢焦点，再按 F12 即可关闭；若焦点已切到 DevTools 窗口，点回应用窗口再按 F12）。该快捷键仅开发模式注册，打包版按 F12 无行为。主进程日志输出在 `pnpm dev` 终端；未捕获异常 / 未处理 Promise 拒绝会额外写入 `%APPDATA%\DesktopTodo\logs\main.log`（超过 512KB 轮转为 `main.old.log`，便于用户复现后取证）。

技术栈：Electron 40 + React 18 + TypeScript + better-sqlite3 + electron-vite + electron-builder + Vitest。

Windows 构建产物（`pnpm dist:win`）：

| 文件 | 说明 |
| --- | --- |
| `release/DesktopTodo-1.0.0-portable.exe` | 便携版，约 93.2 MiB（97,708,366 B），双击运行 |
| `release/DesktopTodo-1.0.0-setup.exe` | NSIS 安装包，约 101.3 MiB（106,249,746 B） |
| `release/win-unpacked/` | 解包目录（调试用） |

macOS 构建产物（`pnpm dist:mac`，尺寸为本次实测）：

| 文件 | 说明 |
| --- | --- |
| `release/DesktopTodo-1.0.0-arm64.dmg` | Apple 芯片（arm64）dmg，120,670,172 B（115.1 MiB），拖入「应用程序」安装 |
| `release/mac-arm64/` | 解包目录（调试用；`node scripts/dist-mac.cjs --dir` 只出该目录） |

本机无 MSVC 环境时，better-sqlite3 使用与 Electron ABI 匹配的预编译产物：`python scripts/fetch-native-assets.py`（脚本从 npmmirror 镜像取 Electron 与预编译 `.node`；macOS 上用 `python3` 并以 `--arch arm64` 指定 Apple 芯片架构）。打包配置已设 `npmRebuild: false`，直接用预编译产物。

打包时若 GitHub 直连不可用，需要通过镜像下载 Electron / NSIS 资源：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
pnpm dist:win
```

macOS 打包同样适用这两个镜像变量（把命令换成 `pnpm dist:mac`）；预编译原生模块也可单独执行 `python3 scripts/fetch-native-assets.py --arch arm64`（支持 curl 回退与 `--local` 离线安装）。图标重生成：`python3 scripts/make-icons.py`（产出 Windows ico、macOS 1024 应用图标与菜单栏模板图）。

验收记录与截图：Windows `docs/acceptance/M6-ACCEPTANCE.md`、macOS `docs/acceptance/M7-MACOS-ACCEPTANCE.md`；截图目录 `docs/acceptance/screens/`。

开发环境注意：如果终端里存在 `ELECTRON_RUN_AS_NODE=1`（某些编辑器/终端会注入），需要清除后再启动，否则 Electron 会被当作 Node 运行。`scripts/dev-launch.cjs` 已处理。

## 目录

```
src/main/      主进程：窗口、托盘/菜单栏、应用菜单、快捷键、自启、SQLite、IPC、链接打开
src/preload/   contextBridge 白名单 API
src/renderer/  React 界面（挂件 / 胶囊 / 完整窗口 / 快速添加共用同一 bundle）
src/shared/    跨层类型（纯类型，无运行时代码）
scripts/       构建/启动/测试/截图/图标/打包等辅助脚本
docs/          规格与验收文档
design/        UI 契约（tokens.css）与交互原型
```

## 性能与内存

应用在 **Windows 上默认关闭硬件加速**（主进程 `applyRenderingPolicy()` 只在 `process.platform === 'win32'` 时调用 `app.disableHardwareAcceleration()`；macOS 保留 Electron 默认的硬件合成）：本机 Windows 11 + AMD 显卡 + 175% DPI 下，透明挂件窗口的 GPU 合成会让 GPU 进程常驻 110～240 MB 私有内存，含完整窗口时 6 个进程合计约 416 MB；改用软件合成后视觉一致（文字/圆角/阴影逐像素比对），空闲 CPU 10 秒仅 0.02 秒，内存明显下降：

| 场景（Windows 实测） | 硬件合成（旧） | 软件合成（默认，本次交付） |
| --- | --- | --- |
| 仅挂件常驻 | 5 进程 private 243.6 MB / working set 404.5 MB | 5 进程 private **149.3 MB** / working set 339.3 MB |
| 挂件 + 完整窗口 | 6 进程 private 416.0 MB / working set 638.1 MB | 6 进程 private **198.8 MB** / working set 489.5 MB |

如某台 Windows 机器上希望启用硬件加速（例如需要更顺滑的滚动/动画），设置环境变量 `DESKTOP_TODO_GPU=1` 后启动即可；此时内存占用会回到上表旧值。macOS 默认即为硬件合成，上表内存数据仅来自 Windows 实测，macOS 未单独测量内存指标。

## 已知限制

- 支持 Windows 10 1903+/11 x64 与 macOS 12+ Apple 芯片 arm64（Intel 芯片 Mac 不在支持范围）；两平台均未做代码签名：Windows 首次运行有 SmartScreen 提示，macOS 首次打开有 Gatekeeper 拦截（放行步骤见「安装」）。
- 纯本地，无云同步、无系统通知、无自动更新（与规格一致）。
- macOS：未签名、未公证，首次打开被 Gatekeeper 拦截；安装后启动已验证，但下载后的 Gatekeeper 放行流程未做人工验证。
- macOS 仅支持 Apple 芯片（arm64）：Intel 芯片 Mac 不在支持范围，不提供 x64 包、不再验证 Rosetta 2 运行。
- macOS 登录项未在真实安装场景验证：未签名应用或不在 `/Applications` 时可能注册失败；macOS 13+ 可在「系统设置 → 通用 → 登录项」手动添加。
- macOS 菜单栏图标的视觉细节、多显示器 / Spaces 行为、真实 Finder 拖拽未做人工验证。
- GitHub Actions 的 macOS 构建作业（`build-mac`）本次未实际运行，配置已就绪，首次 tag 发布时需验证 dmg 产物与上传。
- macOS 本地链接只支持绝对 POSIX 路径与 `file:///` 本机 URL；Windows 盘符/UNC 路径会被判不支持；Composer 行内混排的 POSIX 路径不自动识别（需单独粘贴或走编辑弹窗）。
- Windows 网络共享路径（UNC）在打开前有 800ms 探测超时，断网或共享不可达时会提示失效；macOS 无 UNC 概念。
- 未签名 + 部分杀软可能对便携版做启发式拦截，可加入白名单后使用。
- 高 DPI（125%/150%/175%）下窗口尺寸按 DIP 取整，个别窗口高度可能有 ±1px 差异；形态切换时基准角坐标在 175% DPI 下可能有 ≤1 DIP 的物理取整偏差（相对位置不变）。
- 挂件 / 胶囊窗口比可见卡片四周各多 2px 透明像素（高 DPI 裁切补偿）：鼠标落在最外侧 2px 内时仍会命中应用窗口，属预期行为；可见卡片尺寸始终为 352 / 284×54。
- 胶囊单击需 250ms 判定窗口（用于区分双击打开完整窗口），属交互设计而非延迟缺陷。
- Windows 默认使用软件合成（见「性能与内存」）：若显式设置 `DESKTOP_TODO_GPU=1`，内存会回升到表中原有水平；macOS 保留硬件合成。

## 交付物校验

### Windows（2026-11-22 20:37 重新打包）

| 文件 | 大小 | SHA-256 |
| --- | --- | --- |
| `DesktopTodo-1.0.0-portable.exe` | 97,708,366 B（93.2 MiB） | `a0a92dbbe6465f340501946e0f2d65a753c5ace836eae465757b754b9a38281b` |
| `DesktopTodo-1.0.0-setup.exe` | 106,249,746 B（101.3 MiB） | `c8bef06aaa7a3e4a3c210920bfa80e3a4af36b4345bd182dc3fabe74379ff5e0` |

本次重打包包含以下缺陷修复：

- 退出时偶发主进程异常弹窗（托盘右键 →「退出」）：退出链路改为先置退出标志、清理提示队列与启动定时器，窗口全部关闭后再 checkpoint/关闭数据库；窗口加载 Promise、文件对话框 Promise、挂件 focus/blur 透明度读设置、窗口位置防抖、广播与显示器事件在退出阶段一律静默；新增主进程异常日志 `%APPDATA%\DesktopTodo\logs\main.log`（退出阶段只记录不弹框）。验证：17 个测试文件 / 208 用例、dev 与打包版各 74 项审计、退出压力矩阵（启动即退出 / 打开完整窗口退出 / 提示窗待确认退出）均退出干净且无异常日志。
- 日期选择器的时间列表滚动更顺滑：滚轮改为应用内平滑滚动（一格约 2 行、160ms ease-out，连续滚动不叠加），并尊重「减少动态效果」；不再出现一格滚轮整屏跳变（原型 app v1.4、验证见验收 §14）。
- 链接添加/编辑支持「地址 + 标题」双字段：添加链接行同时提供地址与标题（可选）两个输入；编辑弹窗内点击链接标题或路径进入同一行内编辑态，可同时改地址与标题；地址无效拒绝并保持编辑，Esc 取消，空标题回退自动标题，仅改地址且原标题为自动名称时跟随重算（原型 app v1.3 / static v2.4、截图同步）。
- 高 DPI（如 175%）下挂件 / 胶囊右/下边缘被裁切：桌面形态窗口改为「可见卡片四周各 2px 透明留白」（挂件窗口 356 ×（内容高+4）、胶囊窗口 288×58，卡片仍精确为 352 / 284×54），并规范化落盘尺寸，消除 DPI 取整导致的 ±1px 漂移；审计新增挂件/胶囊卡片完整位于窗口内的断言。
- 视图菜单保存区不再与筛选浮层叠压：同一时刻只保留一个浮层，新浮层打开会自动关闭上一个（嵌套的日期选择器除外），键盘或程序化打开也遵守。
- 链接标题支持手动填写：编辑窗口内点击链接标题即可改名，Enter/失焦保存、Esc 取消、清空回退自动生成标题；新添加的链接会自动进入标题编辑；完整窗口任务行与挂件链接文案同步使用回退后的标题。
- 编辑弹窗空链接提示更清晰：无链接时显示「还没有链接」；拖拽区独立为「把文件 / 文件夹拖到这里，或粘贴路径」+「拖入后自动识别为文件、文件夹或网址」，不再出现两处重复提示。
- 完整窗口侧栏 footer 在「设置」之上新增「使用说明」，打开只读使用说明弹窗（三种形态 / 添加与编辑任务 / 链接 / 筛选与桌面视图 / 快捷键 / 数据与设置）；原型、静态原型与截图同步更新到 app v1.2 / static v2.3。
- 独立透明窗口（挂件/胶囊/编辑/提示）内的 modal / pop / toast 改用紧凑阴影 token（`--shadow-modal-window` / `--shadow-pop-window` / `--shadow-toast-window`，按渲染场景区分），不再出现被窗口边界裁切的断边灰晕；完整窗口保留大阴影。
- 原生 dialog 全部替换为应用内提示弹窗：新增通用提示体系与可复用 `NoticeModal`（独立 472 宽提示窗口、警示块 + 快捷键清单 + 右对齐「知道了」，仅窗口加载失败 2.5s 回退原生）。
- 挂件 / 胶囊四个角恢复透明：去掉被窗口边界裁切的外投影，改为 1px 内描边，四角不再出现灰黑色底板。
- 挂件内日期选择正常：打开日期/日历浮层时窗口临时加高（底边不动），关闭后恢复内容高度；面板不再错位或被裁切。
- 挂件 / 胶囊不使用外投影（含轻投影）：原型与实现统一为 1px 内描边（8%，未置顶 6%，hover 12%），不再出现灰色矩形底板。
- 胶囊整体可单击展开（此前只有左侧对勾圆可点）；整块可拖动，位移 ≥4px 才拖动、单击不会误拖（为区分双击，单击有约 250ms 判定延迟）。
- 完整窗口输入框的日期面板可正常选择日期/时间（此前点击面板内部会关闭父浮层）。
- 空列表时挂件高度按内容自适应（此前会停在 512px 留下大块空白）。
- 挂件内点击任务改为独立的桌面级编辑窗口（550 宽、按内容高度居中）：不再被 352 宽挂件窗口裁切；X / 取消 / 保存 / Esc / 删除后关闭，挂件位置不变。
- 胶囊悬停不再上下位移：hover 只加深内描边（窗口高度＝胶囊高度，位移会让圆弧被窗口裁切）。
- 双击挂件标题可正常展开完整窗口（标题行改为非拖动区，拖动仍可用顶部拖拽条/头部空白）。
- 挂件/胶囊/完整窗口三态互斥：完整窗口打开时隐藏桌面形态，关闭后回到桌面形态；完整窗口标题行新增「收起到挂件」「收起到胶囊」。
- 挂件与胶囊共用同一位置：切换形态/高度变化时按就近角保持基准角不动（默认右上，高 DPI 下 ≤1 DIP 物理取整误差）。
- 挂件底部默认显示「+ 添加任务」折叠按钮，点击才展开输入框。
- 挂件标题旁「桌面视图」下拉现在可正常打开（修复打开即被窗口 resize 关闭的问题）。
- 新增交付前全量交互审计 `pnpm audit`（74 项真实 UI 断言），详见 `docs/acceptance/M6-ACCEPTANCE.md` §8。
- 原生 dialog 全部改为应用内提示弹窗：快捷键注册失败/数据库异常用自建 `NoticeModal`（独立 472 宽窗口、警示块 + 快捷键清单 + 右对齐「知道了」），系统风格统一。
- 设置失焦透明度（90%/80%）后拖动挂件或胶囊，释放后立即恢复设定透明度（不再需要点一下别处）。

桌面交付目录 `C:\Users\lazasons\Desktop\桌面待办-交付物\` 内即为本次校验的两个文件与 `使用说明.txt`。

### macOS（2026-11-23 构建）

| 文件 | 大小 | SHA-256 |
| --- | --- | --- |
| `DesktopTodo-1.0.0-arm64.dmg` | 120,670,172 B（115.1 MiB） | `ea668f6de62d6603066a0cdb0a6559579d0059bbd09487d53ab6097475bcf616` |

- 构建环境：macOS 26.5 arm64；打包命令 `pnpm dist:mac`（`scripts/dist-mac.cjs`，仅 arm64）。
- 校验：`tsc --noEmit` 0 错误；单测 18 文件 / 247 用例全过（macOS arm64）；安装后应用 CDP 全量 UI 审计 74 项 ALL PASS；Intel 芯片 Mac / x64 包 / Rosetta 2 不在支持范围（未构建、未验证 x64）。菜单栏图标视觉、多显示器/Spaces、真实 Finder 拖拽、下载后 Gatekeeper 放行等人工项见「已知限制」与 `docs/acceptance/M7-MACOS-ACCEPTANCE.md`。
- Windows exe 本次未重打，Windows 校验值保持上表不变。
