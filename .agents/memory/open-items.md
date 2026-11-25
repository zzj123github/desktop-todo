# 未解决 / 待跟进事项

> 只记开放项；关闭时补日期与证据。已完成项见 docs/acceptance/M6-ACCEPTANCE.md。

## 人工 GUI 冒烟（本机沙箱无法自动化，2026-11-21 记录）

| 项 | 原因 | 建议验证方式 |
| --- | --- | --- |
| 拖动挂件/胶囊后位置记忆（含多显示器 clamp） | 本机合成鼠标事件不到达应用窗口 | 真机拖动 → 重启 → 位置保持；拔插副屏后挂件仍在可见区域 |
| 托盘图标单击显隐 / 双击完整窗口 / 右键菜单项 | 托盘为系统 shell 元素，点击无法合成 | 真机点托盘逐项走一遍（显示/隐藏、快速添加、打开完整窗口、开机自启勾选、退出） |
| 非焦点透明度 90/80 视觉 | 只在设置里验证了写入与回读 | 让完整窗口获得焦点后观察挂件透明度变化 |
| 原生导出/导入 JSON 对话框 | 模态原生对话框按钮无法合成点击 | 真机导出到文件 → 修改数据 → 导入覆盖 → 校验 |
| 真实文件/文件夹拖放为链接 | 需要 OS 拖拽（webUtils.getPathForFile 分支） | 把文件夹/文件拖入编辑面板与主区 |
| DPI 100%/125%/150% 视觉 | 本机仅 175% 缩放 | 三档缩放下截图对照 `design/app-*.png` |
| 断电/WAL 恢复 | 未做真实断电模拟 | 写入中强杀进程后重启检查数据完整性 |
| UNC 成功打开 | 环境无可达 SMB 共享 | 在真实共享路径下点开链接 |

## 遗留风险

- 壁纸/桌面环境差异：挂件 `transparent: true` 依赖系统合成，个别旧显卡驱动/远程桌面下可能出现黑边；已保留不透明 manager 窗口，必要时可把 widget 改回不透明并在 08 视觉条款下重新验收。
- 未签名安装包：首启 SmartScreen 提示，README 已给出「更多信息 → 仍要运行」说明；如需消除需购买代码签名证书，本次不做。
- `git` 提交仅本地仓库；未推送任何远端（用户未要求）。

## 用户反馈：portable 双击无反应（2026-11-21，已定位并规避）
- 根因：本机 DSH 会话禁止从项目 workspace 路径执行 GUI 程序（explorer 双击对照：workspace 0 进程 / 桌面交付目录 4 进程）。交付物本身正常。
- 规避：交付物复制到 `C:\Users\lazasons\Desktop\桌面待办-交付物\`（portable + setup + 使用说明.txt），README 与验收记录已注明。
- 残留数据：`%APPDATA%\DesktopTodo` 验收数据改名为 `%APPDATA%\DesktopTodo.m6-acceptance-20261121-233847`，首次启动干净空库。
- 待用户确认：是否需要让项目内 `release/` 的副本也可双击（受本机环境限制，应用侧无法绕过；需要换非受限目录或调整环境策略）。

## 待用户确认：临时调整原型 A/B/C（2026-11-22）
- 临时原型：`design/prototype-adjust/index.html`（双击打开，离线可用；说明见同目录 `CHANGES.md`）。未改 `design/app/`、`src/`、`docs/`。
- 待确认项：A 挂件/胶囊共用位置锚点（与 `docs/08` §2.4「胶囊位置独立记忆」冲突，确认后再回写规范/正式原型）；B 三态互切（主界面标题行新增「收起到挂件」「收起到胶囊」图标按钮；挂件双击标题→主界面；胶囊单击→挂件、双击→主界面）；C 挂件添加任务默认折叠为小按钮。
- 需用户拍板的细节：胶囊单击是否需要 250ms 双击判定延迟（或改用其它单击/双击分离方案）；展开输入区收起后是否回到原锚点；挂件拖动是否严格整体可见。
- 确认前不实施到 `src/`；确认后同步正式原型并删除临时目录。

## 已闭环（2026-11-22 01:10）

- 用户反馈「任务管理器单个进程内存过大」：定位为 GPU 进程硬件合成开销，已默认关闭硬件加速并重打包（挂件 149.3 MB / 含完整窗口 198.8 MB，均 <300 MB）。证据见 `docs/acceptance/M6-ACCEPTANCE.md` 2026-11-22 01:10 节。
- 用户排队反馈「双击标题无法打开完整窗口」「拖动后 80% 透明度变 100%」：均已修复（标题行 no-drag；拖动结束主动失焦恢复设定透明度），打包版 CDP 验证通过。

## 仍待用户确认（2026-11-22）

- 临时原型 A/B/C（`design/prototype-adjust/index.html`）：位置共用锚点、三态互切、挂件输入折叠。确认后才实施到 `src/`、回写 `docs/08`，并删除临时原型目录。

## 已闭环（2026-11-22 01:50）

- 用户反馈「挂件/胶囊四角灰黑底」「挂件内日期面板错乱/被裁」：已修复（inset 内描边替代外投影；浮层打开时窗口临时加高 520 + bottom 锚点 + scrollHeight 定位），打包版真机验证四角像素与背景一致、日历完整可见、关闭后高度恢复。证据见 `docs/acceptance/M6-ACCEPTANCE.md` 2026-11-22 01:45 节与 `docs/acceptance/screens/m6-fix-*`。

## 已闭环（2026-11-22 02:30）

- 用户 m03793 四项确认已实施并验收：单桌面原型（已同步回 design/app 并删除临时目录）、位置基准自适应（就近角、默认右上，四角互切 Δ0）、三态互斥（主进程保证 + 标题行两个收起按钮）、挂件折叠输入（默认「+ 添加任务」按钮，展开/收起/提交验证通过）。证据见 `docs/acceptance/M6-ACCEPTANCE.md` 第 4 节与 `docs/acceptance/screens/m6-widget-folded.png` 等。`docs/08 §2.8`、`docs/01`、`docs/02` 已同步。
- 已无待确认交互项。

## macOS 版本（2026-11-23 验收完成·通过（仅 Apple 芯片 arm64）；下方保留 09:54 暂停快照与历史记录，关闭记录见本节末尾）

### 已完成（有证据）
- 代码：`src/main/app-menu.ts`（macOS 应用菜单）、`src/main/macos.ts`（Dock 显隐/应用激活）、`index.ts`（菜单安装、登录启动静默判断、macOS 保留 GPU）、`windows.ts`（唤起时激活应用、完整窗口显示 Dock）、`tray.ts`/`tray-menu.ts`（菜单栏模板图标、左键弹菜单、mac 文案）、`login.ts`（mac 登录项 + wasOpenedAtLogin 静默）、`db.ts`（mac 数据目录 `~/Library/Application Support/DesktopTodo`）、`opener.ts`（POSIX 路径）、`preload`/`shared/types`/`i18n`/`EditorModal`/`lib/parseQuick`/`lib/links`（⌘/⌥ 文案 + macOS 链接识别）；`electron-builder.yml` mac/dmg、`package.json` dist:mac、`scripts/{dist-mac.cjs,fetch-native-assets.py,electron-runtime.cjs,make-icons.py}`、`.github/workflows/release.yml`（build-mac + release-notes）、`build/{icon.png,trayTemplate*.png}`。
- 测试/类型：`pnpm typecheck` 0 错误；`node scripts/run-tests.cjs run` **18 文件 247 用例全过**（macOS arm64）。
- 安装包：`release/DesktopTodo-1.0.0-arm64.dmg`（120,670,172 B，sha256 ea668f6de62d6603066a0cdb0a6559579d0059bbd09487d53ab6097475bcf616）；`hdiutil verify` VALID；dmg 内 app + Applications 符号链接；包内主程序与 better_sqlite3.node 均为 arm64。**2026-11-23 更新：按用户要求 macOS 仅支持 Apple 芯片（arm64），原 x64 dmg 与 x64 解包目录已删除。**
- 运行时：dmg 内 arm64 app 已复制安装到 `/Applications/桌面待办.app`，经 `open` 启动正常（launcher 拉起，写真实数据目录、渲染进程在跑）；CDP 审计脚本对**安装后 app** 74 项断言 **ALL PASS**（含挂件/胶囊/编辑窗口/完整窗口/日期选择器/设置/使用说明/链接编辑）。
- 审计脚本加固（本次改动，已跑通）：CDP 连接 `close` 事件结束挂起 send、单条命令 15s 超时、链接行内编辑重试，修复窗口关闭时审计偶发卡死。

### 待办（恢复后按序做）
1. x64 运行时冒烟：`arch -x86_64 "release/mac/桌面待办.app/Contents/MacOS/桌面待办"`（本机 Rosetta 可用）+ `--no-sandbox --disable-gpu --user-data-dir=<workspace> --remote-debugging-port=9246`，`DESKTOP_TODO_DATA_DIR=<workspace>`，查 CDP target 或跑一遍审计。
2. 卸载验证：删除 `/Applications/桌面待办.app` → 确认 `~/Library/Application Support/DesktopTodo` 数据保留（卸载不丢数据）。
3. 清理：`hdiutil detach` 两个测试挂载点（`.tools/mnt-arm64`、`.tools/mnt-x64`，需 full-access）；`.tools/` 为本次构建缓存/工具目录，可整体删除。
4. 文档同步（未动）：README（下载/安装/Gatekeeper/构建/已知限制/产物表）、docs/00、docs/03 §5（双平台路径规则）、docs/04 §3/§5.3/§5.5/§5.6/§6/§7、docs/07（macOS 验收条目）、docs/09 §6.1（新增文件登记）、新验收记录 `docs/acceptance/M7-MACOS-ACCEPTANCE.md`。
5. `.agents/memory`：decisions（macOS 方案决策）、gotchas（未签名/adhoc、extract-zip 在受限环境损坏 .app、electron-builder 缓存/HOME、多架构 native 不能同批打、`open --args` 不透传、沙箱 hdiutil/GUI 限制）、changelog 条目。
6. 未验证项：GitHub Actions mac job 未实际运行；下载后 Gatekeeper 拦截（未签名/未公证）未真机验证；登录项注册在受限环境报 `Operation not permitted`，真实安装场景待人工验证；菜单栏图标视觉/系统深浅色适配、Spaces/多显示器、真实 Finder 拖拽均未人工验证。

### 2026-11-23 16:xx 验收后更新（关闭 / 部分 / 保留）

**已关闭（有证据）**

1. **x64 启动冒烟**（原待办 1）：✅ 完成（历史记录；2026-11-23 起 macOS 仅 arm64、x64 不在支持范围，该项不再适用）。`arch -x86_64 .../release/mac/桌面待办.app/Contents/MacOS/桌面待办 --no-sandbox --disable-gpu --user-data-dir=<workspace> --remote-debugging-port=9246` + `DESKTOP_TODO_DATA_DIR=<workspace>`：约 5s 后 CDP 出现 `view=widget` 页面，`data.db` + WAL 正常创建，说明 x64 `better_sqlite3.node` 可加载。证据：`release/mac` 包内主程序与 `.node` 均 x86_64（`file` 只读复核）。
2. **审计脚本加固**：✅ CDP `close` 事件结束挂起中的 send + 单条命令 15s 超时已跑通（安装后 app 74 项审计未再卡死，`report.json` failures=0）。
3. **清理**（原待办 3）：✅ `hdiutil detach` 已完成，`.tools/mnt-arm64`、`.tools/mnt-x64` 为空目录；`.tools/` 为本次验收的构建缓存/日志目录（工作区外层、不入库），是否整体删除待用户决定（其中含可复用的 Electron 缓存）。
4. **文档同步**（原待办 4）：✅ 完成。macOS 验收记录 `docs/acceptance/M7-MACOS-ACCEPTANCE.md`（新建）、`docs/07-ACCEPTANCE.md` §M（追加）；README 的 macOS 安装/Gatekeeper/构建/产物表/已知限制与 `docs/00/01/03/04/09` 的 macOS 内容由并行代理更新（本轮只读核对存在性与一致性）。
5. **`.agents` 记忆**（原待办 5）：✅ 完成。`decisions.md` D27（原 D24，合并远端后重编号）、`gotchas.md`「macOS 版本构建/运行坑」、`project-overview.md` 2026-11-23 状态、本文件与 `changelog.md`。

**部分完成 / 仍未完成**

- **x64 全量 74 项 UI 审计**（原待办 6 内新增关注项）：**不适用（Intel 芯片 Mac 不在支持范围）**，不再作为待办项。历史：两次尝试分别 36/74、18/74 中断（Rosetta 慢速环境时序不足），未形成产品结论；macOS 仅 arm64 后无需复验。
- **卸载后数据保留**（原待办 2）：⚠ 未实测。macOS 无 NSIS，删除 `/Applications/桌面待办.app` 后 `~/Library/Application Support/DesktopTodo/` 是否保留需实测（M7 §H7）。

**仍未验证（保留，人工待办）**

| 项 | 原因 | 建议验证方式 |
| --- | --- | --- |
| 登录项真实安装 + 重启 | 受限环境注册报 `Operation not permitted`，真实登录场景未验证 | 装到 `/Applications` → 开启「登录时启动」→ 系统设置登录项确认出现 → 重启后只留菜单栏、不弹挂件（M7 §H2） |
| 下载后 Gatekeeper 放行 | 未从真实下载流程人工走一遍 | Release 下载 dmg → 拖入「应用程序」→ 首次双击被拦 → 右键「打开」放行（M7 §H3） |
| 菜单栏图标视觉 / 深浅色 / 多屏 / Spaces | 需真实桌面观察 | 切深浅色外观、拖到副屏、切 Spaces / 全屏 app 观察图标与左键菜单（M7 §H4） |
| 应用菜单原生交互 / Dock 视觉 | 原生菜单与 Dock 无法用 CDP 验证 | 完整窗口下观察 Dock、⌘W/⌘Q/⌘M、输入框 ⌘C/⌘V/⌘A/⌘Z（M7 §H8） |
| 真实 Finder 拖拽 | 需 OS 拖拽（`webUtils.getPathForFile` 分支） | 从 Finder 拖文件/文件夹/网址到编辑面板与主区（M7 §H5） |
| GitHub Actions `build-mac` 实跑 | 配置就绪，未运行 | 推 `v*` tag（与 `package.json` 版本一致）→ 校验 build-mac 产物与 Release 上传（M7 §H6） |
| 卸载后数据保留 | 未实测 | 删除 `/Applications/桌面待办.app` → 重装 → 数据仍在（M7 §H7） |
| macOS 内存 / 性能 | 未测量（Windows 软件合成结论不迁移） | Activity Monitor 三场景基线与 docs/07 §H 300 MB 指标对照（M7 §H9） |
| 深色模式视觉 | 未人工验证 | 系统外观切深色，检查三形态与独立编辑/提示窗口（M7 §H10） |
| 本地链接限制（记录，非缺陷） | Composer 行内混排 POSIX 路径不自动识别；旧 Windows 数据里的 `C:\` 链接在 macOS 提示不支持 | 按 `docs/03` §5 口径使用（整行粘贴或走编辑弹窗） |

## v1.6 完整窗口按钮（2026-11-24 17:58 续完）

已完成：规格 docs/02§4.2 + docs/08§3.14；代码实施与 macOS CDP 16/16；dmg `release/DesktopTodo-1.0.0-arm64.dmg`（120,645,659 B，SHA-256 `372e3aa1139b6bc79c5b4c9e9695d1b5e78ad6bd95d2834dd29ae76f6b938e68`）；原型基线提升为 app v1.6 / static v2.5 并重导截图；记录 D28 + changelog；提案状态已确认。

仍开放：

| 项 | 状态 | 建议验证 |
| --- | --- | --- |
| Windows 实机点击窗口按钮 | 未在 Windows 上点过（仅 CSS/结构 + 原型截图 + macOS 真机） | 在 Windows 安装包上点最小化/最大化/关闭，核对任务栏还原与关闭回桌面 |
| 安装后 .app 再跑 CDP（可选） | dmg 已生成；安装后全量复跑未做 | `DESKTOP_TODO_CDP_PORT=9241` + 安装后 `open`，跑 `.agents/tmp/check-app-v1.6.mjs` |
