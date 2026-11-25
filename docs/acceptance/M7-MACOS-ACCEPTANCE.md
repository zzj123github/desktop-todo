# 桌面待办 · M7 macOS 验收记录（macOS 版本）

- 验收日期：2026-11-23（Asia/Shanghai）
- 验收版本：`release/DesktopTodo-1.0.0-arm64.dmg`（由当前工作区源码构建；构建后仅补文档与 `.agents` 记忆，未改源码）
- 验收环境：macOS 26.5（25F71）arm64 / Apple M4；Node v24.16.0；Python 3.13.14；Electron 40.10.2（单测在 Electron 自带 Node 模式、ABI 143 下运行）
- 项目 checkout：`/Users/Admin1/Documents/测试项目/desktop-todo/desktop-todo`
- 结论图例：✅ 通过（有实测证据）｜△ 通过（单测/代码审查覆盖，未做端到端自动化）｜⚠ 未验证（见「未验证项与人工验证建议步骤」）｜— 不在支持范围（不适用，Intel/x64/Rosetta）
- 本记录整理说明：类型检查、单测、安装启动与 74 项 UI 审计为当次 macOS 验收会话（2026-11-23 09:4x–09:53）的记录；整理文档时只做了只读复核（产物 SHA-256、包内架构、Info.plist、签名状态、数据目录、审计 `report.json`），未重跑构建/测试/GUI。

## A. 范围与结论

**范围**：为「桌面待办」补齐 macOS 版本，功能与 Windows 版本对齐——桌面挂件/胶囊/完整窗口三形态、任务与链接、筛选/搜索/桌面视图、设置与管理、数据本地 SQLite；平台映射为：菜单栏图标（模板图 + 左键菜单）、Dock 默认隐藏、macOS 应用菜单、登录时启动、POSIX 本地链接（绝对路径 / `file:///` 本机 URL）、⌘/⌥ 快捷键文案。交付物为 Apple 芯片（arm64）dmg；**Intel 芯片 Mac 不在本次支持范围，未构建/未验证 x64**。

**结论：通过。**

- 构建、打包、产物校验、安装启动、arm64 功能验收全部通过：安装到 `/Applications` 后对**安装后的 arm64 app** 跑 CDP 全量 UI 审计 **74 项 ALL PASS**，真实数据目录正常写入。
- **Intel 芯片 Mac / x64 包 / Rosetta 2 不在本次支持范围**：未构建、未验证 x64（不再提供 x64 dmg 与 Rosetta 运行说明）。
- **平台类交互**（应用菜单原生点击、Dock 视觉、菜单栏图标点击/深浅色、登录项真实生效、下载后 Gatekeeper 放行）为人工待验，见 H 节。
- 未做代码签名与公证（与 Windows 交付一致）：首次打开会被 Gatekeeper 拦截，README 已给出右键「打开」/「系统设置 → 隐私与安全性 → 仍要打开」的放行步骤；「从下载到放行」的完整人工流程未验证。

## B. 验收环境

| 项 | 值 |
| --- | --- |
| 系统 | macOS 26.5（Build 25F71），arm64 |
| 硬件 | Apple M4（Apple Silicon） |
| Node / Python | Node v24.16.0；Python 3.13.14（`fetch-native-assets.py` 用 `python3`） |
| 应用运行时 | Electron 40.10.2；单测经 `scripts/run-tests.cjs` 用 Electron 自带 Node 运行（better-sqlite3 ABI 143） |
| 项目路径 | `/Users/Admin1/Documents/测试项目/desktop-todo/desktop-todo` |

**本机验收环境限制（只影响本次验收的操作方式，不影响用户从 dmg 安装运行）**：

1. 本机 DSH 会话沙箱下直接启动 Electron GUI 需要 `--no-sandbox --disable-gpu`，并把用户数据目录放到工作区内；正常用户双击安装后的 app 无此限制。
2. 制作/挂载 dmg 依赖系统 `hdiutil`，在受限会话里需要沙箱外权限；本次在沙箱外完成打包、`hdiutil verify` 与挂载检查。
3. `open --args` / `open --env` 在本环境不会把参数/环境变量透传给 Chromium。因此 CDP 端口改用环境变量 `DESKTOP_TODO_CDP_PORT` 注入（`src/main/index.ts` 已实现：仅显式设置时追加 `remote-debugging-port`，只监听本机回环），用于对已安装 app 做 UI 审计。
4. Electron / electron-builder 的下载缓存目录：受限会话把 `HOME`/缓存指到工作区外的可写目录（`.tools/`，不入库）后构建，避免默认缓存路径不可写。

## C. 构建与打包

入口命令：

```bash
pnpm dist:mac                     # = node scripts/dist-mac.cjs，打 Apple 芯片（arm64）dmg，仅 macOS 可执行
node scripts/dist-mac.cjs --dir   # 只出解包目录 release/mac-arm64/，不生成 dmg（调试用）
```

`scripts/dist-mac.cjs` 的流程：

| # | 步骤 | 说明 |
| --- | --- | --- |
| 1 | `electron-vite build` | 产出 `out/main`、`out/preload`、`out/renderer`（`--skip-build` 可跳过） |
| 2 | `python3 scripts/fetch-native-assets.py --skip-electron --arch arm64` | 从 npmmirror 镜像取与 Electron ABI 匹配的 better-sqlite3 预编译 `better_sqlite3.node`，解到 `node_modules/.pnpm/better-sqlite3@12.11.1/.../build/Release/`（`--skip-electron` 表示 Electron 用本机已有的） |
| 3 | `electron-builder --mac --arm64 --publish never` | 产出 `release/DesktopTodo-1.0.0-arm64.dmg`；解包目录 `release/mac-arm64/` |

**为什么必须显式放入预编译 `.node`**：`electron-builder.yml` 设了 `npmRebuild: false`（不做原生重建，直接用预编译 `.node`），而一个 `better_sqlite3.node` 只能对应一个 CPU 架构。因此 `dist-mac.cjs` 在打包前按 arm64 覆盖 `.node`。macOS 仅支持 Apple 芯片（arm64），不构建 x64 包、不提供 Rosetta 运行说明。

打包配置要点（`electron-builder.yml`）：`appId: com.lazasons.desktoptodo`、`productName: 桌面待办`、`mac.target: dmg（arch: [arm64]）`、`artifactName: DesktopTodo-${version}-${arch}.dmg`、`dmg.sign: false`、`hardenedRuntime: false`、dmg 内容为 app + `/Applications` 快捷方式、`extraResources` 带 `trayTemplate.png` / `trayTemplate@2x.png`、`asarUnpack: '**/*.node'`。

## D. 产物校验

### D1. arm64 dmg

| 产物 | 大小 | 换算 | SHA-256 | `hdiutil verify` |
| --- | --- | --- | --- | --- |
| `release/DesktopTodo-1.0.0-arm64.dmg` | 120,670,172 B | 115.1 MiB | `ea668f6de62d6603066a0cdb0a6559579d0059bbd09487d53ab6097475bcf616` | VALID |

### D2. 挂载内容

dmg 挂载后内容为 `桌面待办.app` + `Applications` 符号链接（指向 `/Applications`），与 `electron-builder.yml` 的 `dmg.contents` 一致，可直接拖入「应用程序」安装。

### D3. Info.plist 关键字段（arm64 包）

| 字段 | 值 |
| --- | --- |
| `CFBundleIdentifier` | `com.lazasons.desktoptodo` |
| `CFBundleShortVersionString` | `1.0.0` |
| `CFBundleIconFile` | `icon.icns` |
| `LSMinimumSystemVersion` | `12.0` |
| `LSApplicationCategoryType` | `public.app-category.productivity` |
| `NSHighResolutionCapable` | `true`（`extendInfo`） |

`Contents/Resources/` 内含 `icon.icns`、`trayTemplate.png`、`trayTemplate@2x.png`（菜单栏模板图标）。

### D4. 包内主程序与原生模块架构（`file` 复核）

| 包 | 主程序 `Contents/MacOS/桌面待办` | `app.asar.unpacked/.../better_sqlite3.node` |
| --- | --- | --- |
| arm64 dmg / `release/mac-arm64/` | Mach-O 64-bit executable **arm64** | Mach-O 64-bit bundle **arm64** |

说明：`asarUnpack: '**/*.node'` 使原生模块以真实文件形式落在 `app.asar.unpacked` 下，才能按架构区分与加载。

### D5. 签名状态

- 未做代码签名与公证（没有 Developer ID 证书；`electron-builder` 未签名，dmg 配置 `sign: false`）。
- 对安装后的 arm64 app 复核：`codesign -dv --verbose=2` → `Signature=adhoc`、`flags=0x20002(adhoc,linker-signed)`、`TeamIdentifier=not set`、`Sealed Resources=none`；`spctl -a -vv` 拒绝（`code has no resources but signature indicates they must be present`）。
- 影响：首次打开被 Gatekeeper 拦截，需右键「打开」或「系统设置 → 隐私与安全性 → 仍要打开」；同时未签名也是登录项在部分场景注册失败的可能原因之一（见 F 节）。

## E. 验证矩阵

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| E1 | 类型检查 0 错误 | ✅ | `node_modules/.bin/tsc --noEmit` → 0 错误 |
| E2 | 单元测试全通过 | ✅ | `node scripts/run-tests.cjs run` → **18 个测试文件 / 247 用例全部通过**（macOS arm64，Electron 40.10.2 运行时） |
| E3 | dmg 完整性 | ✅ | arm64 dmg `hdiutil verify` VALID；挂载内容见 D2 |
| E4 | 原生模块架构 | ✅ | 见 D4：主程序与 `.node` 均 arm64 |
| E5 | 安装到「应用程序」 | ✅ | 从 arm64 dmg 复制为 `/Applications/桌面待办.app`（1.0.0），可被系统识别 |
| E6 | 安装后 `open` 启动 | ✅ | `open` 经 launchd 拉起：主进程 / GPU / 网络 / 渲染进程均启动，窗口正常 |
| E7 | 真实数据目录写入 | ✅ | `~/Library/Application Support/DesktopTodo/data.db` 生成并写入（WAL 模式） |
| E8 | 安装后 app 全量 UI 审计 | ✅ | 对安装后的 arm64 app 跑 `node scripts/audit-ui.mjs`（`DESKTOP_TODO_CDP_PORT` 注入）→ **74 项断言 ALL PASS**；`report.json` 记录 2026-11-23T01:53:52Z、`failures=0`、74 条 |
| E9 | Intel 芯片 Mac / x64 包 / Rosetta 2 | — | 不在本次支持范围：未构建、未验证 x64（不再提供 x64 dmg 与 Rosetta 运行说明） |

**E8 审计覆盖范围**（74 项断言，按 `report.json` 名称）：挂件折叠输入与高度/裁切、行 hover、勾选与撤销 toast、独立编辑窗口与链接标题/地址编辑、图钉置顶、胶囊 hover/单击/窗口留白、桌面视图下拉与外部点击关闭、双击标题打开完整窗口、三态互斥、九个导航视图、已完成 tab、标签/优先级筛选与清除、Popover 单开、保存视图表单、搜索、分组折叠、完整窗口内编辑模态、日期时间列表滚轮平滑与 reduced-motion、Esc 层级、设置（行数/置顶/透明度三档）、管理弹窗（新建/删除/撤销/返回设置）、使用说明弹窗、新建任务、空链接文案、添加链接双输入、数据清理与设置恢复。

## F. 平台行为验收

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| F1 | macOS 应用菜单（桌面待办 / 编辑 / 窗口） | △ | `src/main/app-menu.ts` 仅在 darwin 安装菜单；「编辑」菜单的标准 role 是输入框 ⌘C/⌘V/⌘A/⌘Z 生效的前提，同时提供 ⌘Q/⌘W/⌘M、关于/隐藏/显示全部，以及「显示挂件」「打开完整窗口」两个入口；`app-menu.test.ts` 5 用例覆盖顶层结构/role/窗口入口回调；安装后 app 正常运行未崩溃。原生菜单展开与快捷键实际按下未人工验证 |
| F2 | Dock 默认隐藏 / 完整窗口显示 | △ | `src/main/macos.ts` 提供 `hideDock()` / `showDock()`（非 darwin 全部 no-op）；`windows.ts` 只显示桌面形态时隐藏 Dock，`revealManager()` 显示 Dock 并激活应用，完整窗口收起/关闭后再次隐藏；安装后 app 的三态互斥审计通过（完整窗口打开时挂件隐藏、关闭后回到桌面形态）。Dock 图标实际显隐视觉未人工观察 |
| F3 | 菜单栏模板图标 + 左键弹菜单 | △ | `build/trayTemplate.png` / `@2x` 经 `extraResources` 进包（D3 已确认在 `Resources/` 内）；`tray.ts` 在 macOS 用 `nativeImage.setTemplateImage(true)`（黑 + alpha，系统按深浅色着色），并 `tray.setContextMenu()` 让左键单击直接弹菜单（macOS 菜单栏应用惯用交互，无单击切挂件/双击语义）；`tray-menu.test.ts` 9 用例覆盖菜单顺序/文案/勾选态与 macOS 文案（「登录时启动」「退出桌面待办」）。实际点击、图标视觉与深浅色适配未人工验证 |
| F4 | ⌘/⌥ 快捷键文案 | ✅ | 安装后 app 的审计截图（`.agents/reports/audit/12-manager-help.png`）显示「⌘⇧Space：快速添加」「⌥H：显示 / 隐藏挂件」「⌥1…5：切换视图」「⌘N：新建任务；⌘F：搜索」；`src/renderer/src/i18n/zh.ts` 按 `isMacOS()` 切换（搜索标题 118 行、状态栏 214 行、使用说明 279–285 行）。全局快捷键本机映射为 `CommandOrControl` → ⌘、`Alt` → ⌥（`src/main/shortcuts.ts`），实际按键注册未在安装版人工验证 |
| F5 | 登录时启动（登录项） | ⚠ | 代码：`src/main/login.ts` 在 macOS 只传 `openAtLogin` / `openAsHidden`（`path`/`args` 仅 Windows 生效），启动时用 `getLoginItemSettings().wasOpenedAtLogin` 判断由登录项拉起 → 静默启动（只留菜单栏、不弹挂件）；设置项变化时系统项 + `settings.launchAtLogin` 双写并广播。本机受限环境实测注册失败：日志 `Unable to set login item: 未能完成该操作。Operation not permitted`；真实安装 + 重启场景未验证 |
| F6 | POSIX 本地链接 | △ | `src/main/opener.ts` darwin 分支：只接受以单个 `/` 开头的绝对 POSIX 路径与本机 `file:///` URL（先 `decodeURIComponent` 再按 POSIX 规范化）；Windows 盘符 / UNC / `/cygdrive/` 在 macOS 判 unsupported；危险协议仍 blocked；`path.posix.normalize` 保留正斜杠。`opener.test.ts` 26 用例覆盖两平台（darwin 分支含识别/规范化/类型/missing/危险协议），`parseQuick.test.ts`（39 用例）与 `links.test.ts` 支持注入平台同跑两平台。安装后审计只覆盖网页链接编辑；真实点击本地 POSIX 路径用 Finder/默认程序打开未人工验证 |
| F7 | 数据目录（macOS） | ✅ | `src/main/db.ts` 按平台选目录：macOS 为 `~/Library/Application Support/DesktopTodo/`（Windows 为 `%APPDATA%\DesktopTodo`）；安装后已实测写入 `data.db` |
| F8 | 登录启动静默（不弹挂件） | ⚠ | `src/main/index.ts`：`hasFlag('--silent')`（Windows）或 `wasLaunchedAtLogin()`（macOS）→ 静默启动，只显示菜单栏、不弹挂件。真实登录启动未验证（依赖登录项，见 F5） |

## G. 已知限制与残余风险

1. **未签名、未公证**：首次打开被 Gatekeeper 拦截；README 已给放行步骤，但「从 GitHub Release 下载 → 首次打开 → 放行」的完整人工流程未验证。未签名也可能是登录项注册失败的原因之一。
2. **Intel 芯片 Mac 不在支持范围**：不提供 x64 包，未构建/未验证 x64 与 Rosetta 2 运行；如需支持 Intel，需重新立项做 x64 构建与全量验收。
3. **登录项语义**：macOS 13+ 由系统 SMAppService 管理，`openAsHidden` 字段被忽略（仅 macOS 12 及更早可用）；未签名或不在 `/Applications` 运行时可能注册失败，本机受限环境已复现 `Operation not permitted`。
4. **菜单栏图标**：使用黑 + alpha 的模板图由系统着色，深浅色适配、菜单栏占位、多显示器与 Spaces 行为均未人工验证。
5. **真实 Finder 拖拽未验证**：`webUtils.getPathForFile` 分支需 OS 拖拽；单测/合成事件覆盖的是链接识别与编辑路径。
6. **本地链接口径限制**：macOS 只支持绝对 POSIX 路径与 `file:///` 本机 URL；Composer 行内混排文本里的 POSIX 路径不会自动拆出（需整行粘贴或走编辑弹窗，见 `docs/03` §5）；旧 Windows 数据里的 `C:\` 链接在 macOS 打开会提示不支持。
7. **CI 的 `build-mac` 作业未实跑**：`.github/workflows/release.yml` 已配置 `macos-latest` 上 typecheck + test + `dist-mac.cjs` 打 arm64 dmg 并上传/发布，Release 说明只提 Apple 芯片，并由 `release-notes` 汇总两个平台的说明；首次 `v*` tag 发布时需验证实际产物与上传。
8. **macOS 内存/性能未测量**：Windows 的「默认软件合成以省内存」结论只适用于 Windows；macOS 保留 Electron 默认硬件合成（`applyRenderingPolicy()` 仅 win32 调用），未做 macOS 内存基线。
9. **本机验收环境限制（只影响验收方式，不影响用户）**：GUI 直启需 `--no-sandbox --disable-gpu` 且 `--user-data-dir` 在工作区；dmg 制作/挂载需 `hdiutil`（受限会话需沙箱外权限）；`open --args/--env` 不透传 → 用 `DESKTOP_TODO_CDP_PORT` 注入调试端口。
10. **卸载后数据保留未实测**：macOS 无 NSIS，卸载即把 app 拖出「应用程序」；数据位于 `~/Library/Application Support/DesktopTodo/` 通常保留，但未做删除安装目录后重装的实测。

## H. 未验证项与人工验证建议步骤

> Intel 芯片 Mac / x64 包 / Rosetta 2 不在本次支持范围，未构建/未验证 x64；下表不列该项。

| # | 未验证项 | 现状 | 人工验证建议步骤 |
| --- | --- | --- | --- |
| H2 | 登录项真实安装 + 重启 | 本机受限环境注册报 `Operation not permitted` | 把 app 装到 `/Applications` → 设置开启「登录时启动」→「系统设置 → 通用 → 登录项」确认出现「桌面待办」→ 退出登录/重启 → 期望不弹挂件、菜单栏图标存在、勾选态保持 |
| H3 | 下载后 Gatekeeper 放行 | 未在真实下载流程验证 | 从 GitHub Release 下载 `DesktopTodo-1.0.0-arm64.dmg` → 打开并拖入「应用程序」→ 首次双击（应被拦截）→ 右键「打开」→「打开」确认启动；另用「系统设置 → 隐私与安全性 → 仍要打开」路径复核一次 |
| H4 | 菜单栏图标视觉 / 深浅色 / 多屏 / Spaces | 未人工验证 | 分别切浅色/深色外观看图标着色；把菜单栏拖到副屏、切换 Spaces、进入全屏 app，确认图标可见且左键菜单各项可用（显示/隐藏挂件、快速添加、打开完整窗口、登录时启动、退出） |
| H5 | 真实 Finder 拖拽 | 未人工验证 | 从 Finder 拖文件/文件夹到编辑面板与主区，确认生成 POSIX 路径链接、标题自动命名、点击用默认程序打开；再拖入一个网址确认生成网页链接 |
| H6 | GitHub Actions `build-mac` 实跑 | 配置就绪，未运行 | 推送与 `package.json` 版本一致的 `v*` tag → 检查 `build-mac` 作业通过、上传 arm64 dmg、`release-notes` 写入双平台说明；从 Release 下载 dmg 与本地产物比对 SHA-256 |
| H7 | 卸载后数据保留 | 未实测 | 记录现有任务 → 退出 app → 删除 `/Applications/桌面待办.app` → 重新安装并启动 → 确认任务仍在（数据目录 `~/Library/Application Support/DesktopTodo/` 保留） |
| H8 | 应用菜单原生交互 / Dock 视觉 | 未人工验证 | 打开完整窗口：确认 Dock 出现且 Cmd+Tab 可见；按 ⌘W/⌘Q/⌘M 与输入框内 ⌘C/⌘V/⌘A/⌘Z；收起完整窗口后 Dock 消失、menubar 图标仍在 |
| H9 | macOS 内存 / 性能 | 未测量 | Activity Monitor 观察仅挂件常驻、打开完整窗口、编辑弹窗三种场景的内存与空闲 CPU；对照 docs/07 §H 的 300 MB 指标记录 macOS 基线 |
| H10 | 深色模式视觉 | 未人工验证 | 系统外观切深色，检查挂件/胶囊/完整窗口与菜单栏模板图、独立编辑/提示窗口的可读性与内描边；`darkModeSupport: true` 已配置 |

## 附. 证据与产物位置

- arm64 dmg 与解包目录：`release/`（不入库，`.gitignore` 已忽略 `release/`）。
- UI 审计结果与截图：`.agents/reports/audit/`（**该目录被 `.gitignore` 忽略，不入库**）。其中 `report.json`（2026-11-23T01:53:52Z，`failures=0`，74 条）是安装后 arm64 app 的权威结果（`12-manager-help.png` 为安装后 app 的 macOS 文案证据）。
- 当次验收的命令日志与临时数据目录位于工作区外层的 `.tools/`（如 `audit-run4.log`、`audit-data*/data.db`），该目录不在仓库内、不入库。
- 安装位置：`/Applications/桌面待办.app`（1.0.0）；数据目录：`~/Library/Application Support/DesktopTodo/`。
