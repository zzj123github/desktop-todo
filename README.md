# 桌面待办

一个常驻桌面的轻量任务管理工具：桌面挂件、可收起的胶囊、完整管理窗口三种形态，纯本地 SQLite 存储，不联网、无账号。

- 挂件：352px 宽，默认停靠主屏右侧，默认展示「今天」，回车即添加。
- 胶囊：284×54，收起后停靠右下角，点击左侧陶土圆展开。
- 完整窗口：1100×720（最小 900×600），左侧导航 + 筛选 + 分组列表 + 任务编辑。

规格来源：`docs/`（PRD、数据模型、技术方案、UI 契约、验收清单）。设计与交互原型：`design/`。

## 安装

系统要求：Windows 10 1903+ / Windows 11（x64）。

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

## 数据与备份

- 数据目录：`%APPDATA%\DesktopTodo\`（设置 → 「数据目录」可直接打开）
- 数据库：`data.db`（SQLite，WAL 模式），另有 `data.db-wal` / `data.db-shm`
- 备份：
  - 设置 → 「导出为 JSON 备份文件」，得到可读的完整备份；
  - 或退出程序后直接复制整个 `DesktopTodo` 目录。
- 导入：设置 → 「导入」，会**覆盖当前全部数据**（导入前会二次确认）。
- 数据库损坏时会自动把原文件备份为 `data.db.bak`，并新建空库启动。

## 使用

- 挂件：输入框回车新增（Shift+Enter 换行）；输入里的「明天 10:00」「高」「#标签」「网址/路径」会被识别；双击标题展开完整窗口；Esc 收起为胶囊。
- 完整窗口：点击任务行编辑；勾选完成；「新建」或 Ctrl+N 新建；Ctrl+F 搜索；Esc 关闭窗口（回托盘）。
- 链接：任务可挂多个网页、文件夹、网络共享路径；支持把文件/文件夹/网址直接拖进编辑面板或主区。失效路径会提示「找不到该位置」，可重新选择或删除。
- 托盘：单击显示/隐藏挂件，双击打开完整窗口；右键菜单可快速添加、切换开机自启、退出。
- 筛选：状态、日期、标签、优先级、关键词五维筛选，可保存为「桌面视图」在挂件/完整窗口标题旁切换。

### 全局快捷键（设置中可关闭）

| 快捷键 | 作用 |
| --- | --- |
| Ctrl+Shift+Space | 快速添加（唤起挂件并聚焦输入框） |
| Alt+H | 显示/隐藏挂件 |
| Alt+1 ~ Alt+5 | 依次切换到 收件箱 / 今天 / 已逾期 / 即将到期 / 已完成 |

窗口内快捷键：Ctrl+N 新建、Ctrl+F 搜索、Esc 关闭/收起。

## 开发与构建

```bash
pnpm install                # 安装依赖
pnpm dev                    # 开发模式（构建后启动 Electron）
pnpm build                  # 编译主进程 / preload / 渲染层到 out/
pnpm typecheck              # TypeScript 检查
pnpm test                   # Vitest（在 Electron 运行时内执行，见 scripts/run-tests.cjs）
pnpm dist:win               # 打包 portable + NSIS 到 release/
pnpm dist:portable          # 只打便携版
pnpm dist:nsis              # 只打安装包
```

技术栈：Electron 40 + React 18 + TypeScript + better-sqlite3 + electron-vite + electron-builder + Vitest。

构建产物：

| 文件 | 说明 |
| --- | --- |
| `release/DesktopTodo-1.0.0-portable.exe` | 便携版，约 93.2 MiB（97,691,335 B），双击运行 |
| `release/DesktopTodo-1.0.0-setup.exe` | NSIS 安装包，约 101.3 MiB（106,240,687 B） |
| `release/win-unpacked/` | 解包目录（调试用） |

本机无 MSVC 环境时，better-sqlite3 使用与 Electron ABI 匹配的预编译产物：`python scripts/fetch-native-assets.py`（脚本从 npmmirror 镜像取 Electron 与预编译 `.node`）。打包配置已设 `npmRebuild: false`，直接用预编译产物。

打包时若 GitHub 直连不可用，需要通过镜像下载 Electron / NSIS 资源：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
pnpm dist:win
```

验收记录与截图：`docs/acceptance/M6-ACCEPTANCE.md`、`docs/acceptance/screens/`。

开发环境注意：如果终端里存在 `ELECTRON_RUN_AS_NODE=1`（某些编辑器/终端会注入），需要清除后再启动，否则 Electron 会被当作 Node 运行。`scripts/dev-launch.cjs` 已处理。

## 目录

```
src/main/      主进程：窗口、托盘、快捷键、自启、SQLite、IPC、链接打开
src/preload/   contextBridge 白名单 API
src/renderer/  React 界面（挂件 / 胶囊 / 完整窗口 / 快速添加共用同一 bundle）
src/shared/    跨层类型（纯类型，无运行时代码）
scripts/       构建/启动/测试/截图/图标等辅助脚本
docs/          规格与验收文档
design/        UI 契约（tokens.css）与交互原型
```

## 性能与内存

应用默认**关闭硬件加速**（主进程 `app.disableHardwareAcceleration()`）：本机 Windows 11 + AMD 显卡 + 175% DPI 下，透明挂件窗口的 GPU 合成会让 GPU 进程常驻 110～240 MB 私有内存，含完整窗口时 6 个进程合计约 416 MB；改用软件合成后视觉一致（文字/圆角/阴影逐像素比对），空闲 CPU 10 秒仅 0.02 秒，内存明显下降：

| 场景 | 硬件合成（旧） | 软件合成（默认，本次交付） |
| --- | --- | --- |
| 仅挂件常驻 | 5 进程 private 243.6 MB / working set 404.5 MB | 5 进程 private **149.3 MB** / working set 339.3 MB |
| 挂件 + 完整窗口 | 6 进程 private 416.0 MB / working set 638.1 MB | 6 进程 private **198.8 MB** / working set 489.5 MB |

如某台机器上希望启用硬件加速（例如需要更顺滑的滚动/动画），设置环境变量 `DESKTOP_TODO_GPU=1` 后启动即可；此时内存占用会回到上表旧值。

## 已知限制

- 仅 Windows x64；未做代码签名，首次运行有 SmartScreen 提示。
- 纯本地，无云同步、无系统通知、无自动更新（与规格一致）。
- 网络共享路径（UNC）在打开前有 800ms 探测超时，断网或共享不可达时会提示失效。
- 未签名 + 部分杀软可能对便携版做启发式拦截，可加入白名单后使用。
- 高 DPI（125%/150%/175%）下窗口尺寸按 DIP 取整，个别窗口高度可能有 ±1px 差异。
- 默认使用软件合成（见「性能与内存」）：若显式设置 `DESKTOP_TODO_GPU=1`，内存会回升到表中原有水平。

## 交付物校验（2026-11-22 01:46 重新打包）

| 文件 | 大小 | SHA-256 |
| --- | --- | --- |
| `DesktopTodo-1.0.0-portable.exe` | 97,685,204 B（93.2 MiB） | `e2997a3f1889026c45408ad31089a292974a138d45f54f0052dae0d0f19e9122` |
| `DesktopTodo-1.0.0-setup.exe` | 106,241,253 B（101.3 MiB） | `2b771c3d4d4122a55c594064976a73a3a7331448e1dd0cea58925d7c972e7068` |

本次重打包包含桌面形态的以下缺陷修复：

- 挂件 / 胶囊四个角恢复透明：去掉被窗口边界裁切的外投影，改为 1px 内描边，四角不再出现灰黑色底板。
- 挂件内日期选择正常：打开日期/日历浮层时窗口临时加高（底边不动），关闭后恢复内容高度；面板不再错位或被裁切。
- 挂件 / 胶囊下方不再出现灰色矩形底板（透明窗口改用轻投影 + 1px 内描边，不再用原型大投影）。
- 胶囊整体可单击展开（此前只有左侧对勾圆可点）；整块可拖动，位移 ≥4px 才拖动、单击不会误拖。
- 完整窗口输入框的日期面板可正常选择日期/时间（此前点击面板内部会关闭父浮层）。
- 空列表时挂件高度按内容自适应（此前会停在 512px 留下大块空白）。
- 双击挂件标题可正常展开完整窗口（标题行改为非拖动区，拖动仍可用顶部拖拽条/头部空白）。
- 设置失焦透明度（90%/80%）后拖动挂件或胶囊，释放后立即恢复设定透明度（不再需要点一下别处）。

桌面交付目录 `C:\Users\lazasons\Desktop\桌面待办-交付物\` 内即为本次校验的两个文件与 `使用说明.txt`。
