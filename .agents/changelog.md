# Changelog

格式：`YYYY-MM-DD | <create|update|delete|merge> | <path/artifact> | <做了什么>`

2026-11-21 | create | .agents/ | bootstrap：建立项目记忆层，登记权威资料与实施目标（M0–M6 一次性交付）
2026-11-21 | create | .agents/memory/decisions.md | 记录 D1–D5：Electron 40.10.2、Electron-Node 跑 Vitest、renderer lib 目录、tags 管理 IPC 缺口、workspace GUI 限制绕行
2026-11-21 | create | .agents/memory/gotchas.md | 记录 workspace GUI/EPERM、ELECTRON_RUN_AS_NODE、高 DPI 截图、网络镜像、pnpm 构建脚本坑
2026-11-21 | update | docs/09-PROJECT-STRUCTURE.md | §2.1 增加 lib/ 目录、§6.1 登记样式/字体/脚本/vitest 配置/Electron 版本等实施补充
2026-11-21 | create | src/renderer/src/styles/tokens.css | 从 design/ui/tokens.css 原样复制（M0 token 契约）
2026-11-21 | create | build/icon.ico, icon.png, tray.ico, tray.png | scripts/make-icons.py 生成的打包/托盘图标（陶土方+白勾）
2026-11-21 | create | scripts/* | make-icons.py、fetch-native-assets.py、electron-runtime.cjs、dev-launch.cjs、run-tests.cjs、screenshot.ps1
2026-11-21 | create | .agents/reports/m6-main-acceptance.md | task-3 主进程 M6 验收证据：docs/07 A/F/H 逐条对照、测试/性能实测、遗留 GUI 冒烟项
2026-11-21 | update | electron-builder.yml, src/main/tray.ts, src/main/db.ts | 打包 tray.ico extraResources；托盘图标 packaged/dev 优先级；修复损坏库自动重建后 error 未暴露；新增 src/main/db.test.ts 与 src/main/repo/tasks.perf.test.ts
2026-11-21 | update | docs/acceptance/M6-ACCEPTANCE.md, docs/acceptance/screens/* | M6 全量验收记录（docs/07 A–J 逐条 + 证据 + 已知限制）与三形态/弹窗截图归档
2026-11-21 | update | src/main/windows.ts, src/main/shortcuts.ts, src/renderer/src/app/Manager.tsx | 完整窗口懒创建 + 销毁后重建；showManagerView 与 ?nav= 直达视图（修 window.close 后无法再打开、降内存 387.5→198.6MB）
2026-11-21 | update | src/main/tray-menu.ts(+test), src/main/tray.ts | 托盘菜单模板抽纯函数 + 6 用例覆盖顺序/勾选/tooltip
2026-11-21 | update | src/renderer/src/lib/links.ts, Manager/Widget/EditorModal | 链接不可用文案统一（missing/unreachable → 「找不到该位置」+ 重选/删除）
2026-11-21 | update | src/renderer/src/app/Manager.tsx | 从设置进入的管理弹窗关闭后返回设置；Esc 关闭完整窗口（隐藏至托盘）
2026-11-21 | update | README.md | 交付说明：安装/SmartScreen/数据目录与备份/快捷键/构建命令/目录结构/已知限制
2026-11-21 | update | .agents/memory/project-overview.md, decisions.md, gotchas.md, open-items.md | M0–M6 完成状态、D6–D8 决策、沙箱与 PowerShell 坑、人工冒烟清单

2026-11-21 23:40 | update | README.md / docs/acceptance/M6-ACCEPTANCE.md | 补充「本机 exe 必须从桌面交付文件夹运行（workspace 路径被沙箱禁止执行 GUI）」，追加用户反馈 portable 双击无反应的根因/处理/重打包校验记录
2026-11-21 23:40 | fix | src/renderer/src/app/Widget.tsx | 挂件高度上报改为累加列表子项自然高度（不再用 .w-body.scrollHeight，避免与窗口高度互相锁死停在 512px）；空态 353×231
2026-11-21 23:40 | create | C:\Users\lazasons\Desktop\桌面待办-交付物\使用说明.txt | 交付给用户的启动/路径/SmartScreen/数据备份/快捷键/卸载说明
2026-11-21 23:40 | update | release/*.exe + 桌面交付目录 | 用包含挂件高度修正的代码重新打包（portable 97,690,655B / setup 106,239,961B），复制到桌面交付目录
2026-11-21 23:40 | update | .agents/open-items.md | 记录 workspace GUI 限制为用户可见问题、已通过桌面交付目录规避
2026-11-22 00:45 | fix | src/renderer/src/styles/app.css, src/renderer/src/app/Capsule.tsx, src/main/windows.ts, src/main/ipc.ts, src/preload/index.ts, src/shared/types.ts, src/renderer/src/components/Popover.tsx, src/renderer/src/components/anchoredPosition.ts | 用户 m02712 的 4 项 BUG 修复：轻投影去灰色底板、胶囊整块单击展开/自绘拖动、日期浮层内嵌点击不关闭
2026-11-22 00:45 | test | src/renderer/src/components/anchoredPosition.test.ts | 新增 4 用例（isInsideFloatingLayer），全量 12 文件 165 用例通过
2026-11-22 00:45 | create | design/prototype-adjust/ | 临时调整原型 A/B/C（不改 design/app），含 CHANGES.md；供用户确认后再同步
2026-11-22 00:45 | update | .agents/memory/decisions.md (D9), open-items.md | 胶囊自绘拖动/内嵌浮层/轻投影决策；临时原型待确认项
2026-11-22 00:52 | update | release/*.exe, C:\\Users\\lazasons\\Desktop\\桌面待办-交付物\\* | 重新打包（portable 97,691,335B / setup 106,240,687B），覆盖桌面交付目录旧版并更新 使用说明.txt（胶囊整块点击/拖动、修复版说明与哈希前缀）
2026-11-22 00:52 | verify | 打包版（从桌面交付目录启动，CDP 9226） | view-widget 353×242、轻投影生效、任务数据保留；setCollapsed→view-capsule 284×55，点击胶囊中部→view-widget；app.quit 后进程 0
2026-11-22 00:52 | update | README.md, docs/acceptance/M6-ACCEPTANCE.md | 2026-11-22 重打包校验表（新哈希/大小）与 4 项 BUG 修复验收记录、待确认的 3 项交互调整
2026-11-22 01:06 | update | src/main/index.ts | 默认关闭硬件加速（DESKTOP_TODO_GPU=1 逃生口），注释记录内存测量与理由
2026-11-22 01:06 | update | src/main/windows.ts, src/renderer/src/app/Widget.tsx, src/renderer/src/styles/app.css | 拖动结束恢复失焦透明度（settleWidgetIdleOpacity，移除重复 inline opacity）；标题行 no-drag 修复双击标题打开完整窗口
2026-11-22 01:03 | update | release/*.exe, C:\\Users\\lazasons\\Desktop\\桌面待办-交付物\\* | 重打包（portable 97,666,895B / setup 106,240,887B），覆盖交付目录与 使用说明.txt（软件合成内存优化 + 两条交互修复）
2026-11-22 01:06 | verify | 打包版（桌面交付目录，CDP 9227） | 仅挂件 private 149.3MB；挂件+完整窗口+设置 198.8MB；双击标题→manager；opacity 0.8 拖动后失焦恢复
2026-11-22 01:08 | update | README.md, docs/acceptance/M6-ACCEPTANCE.md, .agents/memory/decisions.md (D10/D11), gotchas.md | 内存优化与两条交互修复的文档、验收证据与决策记录
2026-11-22 | update | docs/acceptance/M6-ACCEPTANCE.md | 透明度拖动修复补真机证据（真实鼠标拖动挂件/胶囊后窗口 alpha 255→204），B4 状态改 ✓ | 用户 m03355 反馈复核
2026-11-22 | update | .agents/tmp/verify-opacity.mjs + win-state.ps1 + drag-real.ps1 | 新增透明度端到端验证脚本（CDP 编排 + GetLayeredWindowAttributes + 真实鼠标拖动） | 说明见验收记录
2026-11-22 | update | src/main/{windows,ipc}.ts, src/preload/index.ts, src/shared/types.ts, src/renderer/src/app/Widget.tsx, src/renderer/src/components/Popover.tsx, src/renderer/src/styles/app.css, docs/acceptance/M6-ACCEPTANCE.md, .agents/memory/decisions.md(D12), gotchas.md | 修复挂件/胶囊四角灰底（inset 描边替代外投影）与挂件内日期面板被裁（浮层打开临时加高 520 + anchor bottom + scrollHeight 定位） | 用户 m03408 反馈
2026-11-22 | update | release/, C:\\Users\\lazasons\\Desktop\\桌面待办-交付物\\ | 重打包 portable+setup（输出目录改到工作区外规避 VS Code 文件锁），新哈希 e2997a3f…/2b771c3d…；README/验收记录/使用说明同步 | 四角透明与日期面板修复交付
2026-11-22 02:20 | update | src/main/windows.ts | 位置基准锚点化（WidgetAnchorPoint / captureWidgetAnchor / boundsFromWidgetAnchor），抑制程序化 setBounds 后的 moved 落盘与二次捕获，修复高 DPI 切换漂移 | 用户 m03793 位置基准要求；四角互切 Δ0
2026-11-22 02:10 | update | src/renderer/src/app/{Widget,Manager,Capsule}.tsx, src/renderer/src/styles/app.css, src/renderer/src/i18n/zh.ts, src/shared/types.ts, src/preload/index.ts, src/main/ipc.ts | 三态互斥入口（app:showWidget）、挂件折叠输入、胶囊单击/双击判定、完整窗口标题行两个收起按钮 | 用户 m03793 四项确认
2026-11-22 02:12 | update | design/app/{index.html,css/adjust.css,js/*.js} | 临时原型 v1.1 同步回正式原型；删除 design/prototype-adjust；docs/08 §2.8、docs/01、docs/02 同步确认后的交互规范 | 用户确认原型实施
2026-11-22 02:25 | verify | .agents/tmp/verify-shapes.mjs | 三态互斥 6 项 + 折叠输入 4 项 + 四角 8 项全部 PASS（修复漂移后 Δ0）；13 文件 171 用例通过 | m03793 验收
2026-11-22 | update | src/main/windows.ts, src/main/ipc.ts, src/preload/index.ts, src/shared/types.ts, src/renderer/src/app/{EditorWindowHost.tsx,App.tsx,Widget.tsx}, src/renderer/src/components/{Modal.tsx,EditorModal.tsx,anchoredPosition.ts}, src/renderer/src/styles/app.css | 挂件内点击任务改为独立桌面级编辑窗口（550 宽、内容高度居中、embedded 模态），修复日期面板在编辑窗口内被裁切
2026-11-22 | update | docs/01-PRD.md, docs/08-UI-ENGINEERING-SPEC.md, docs/acceptance/M6-ACCEPTANCE.md, README.md | 记录挂件内编辑窗口契约与验收（§2.1 窗口矩阵、§3.8 Modal、FR-1.11、补充验收第 5 节）
2026-11-22 11:37 | update | design/ui/tokens.css, src/renderer/src/styles/tokens.css, design/app/css/app.css, src/renderer/src/styles/app.css, docs/02-DESIGN-SPEC.md, docs/08-UI-ENGINEERING-SPEC.md, docs/acceptance/M6-ACCEPTANCE.md, README.md, design/README.md, design/app-desktop.png, design/app-capsule.png | 原型与实现统一去掉桌面形态外投影：4 个 shadow token 改 1px 内描边，原型挂件/胶囊改用 token，文档与参考截图同步 | 用户指示「不需要浮在桌面上带大外投影，原型及相关说明同步调整」（m00565）
2026-11-22 | update | scripts/audit-ui.mjs | 新增真实 UI 交互审计（54 项断言，pnpm audit），纳入交付前固定关卡
2026-11-22 | fix | src/renderer/src/components/ViewMenu.tsx | 移除 resize 关闭菜单逻辑，修复挂件内桌面视图下拉打开即关闭
2026-11-22 | update | docs/acceptance/M6-ACCEPTANCE.md | 追加 §8 全量交互审计记录
2026-11-22 | create | src/main/notices.ts, src/main/notices.test.ts, src/renderer/src/components/NoticeModal.tsx, src/renderer/src/app/NoticeWindowHost.tsx | 新增应用内提示体系：提示队列 + 独立 472 宽透明提示窗口 + 自建 NoticeModal（embedded），快捷键冲突/数据库异常不再用原生 dialog
2026-11-22 | update | src/main/{windows,shortcuts,index,ipc}.ts, src/preload/index.ts, src/shared/types.ts, src/renderer/src/app/{App.tsx}, i18n/zh.ts, styles/app.css | 接入 notice IPC/事件与提示窗口；修正提示/编辑窗口双内边距；页脚「知道了」右对齐
2026-11-22 | update | scripts/audit-ui.mjs | 审计脚本增加窗口高度稳定等待与 hover 重试，消除高度动画期间假 FAIL（53 项全 PASS）
2026-11-22 14:12 | update | design/static-prototype.html, design/README.md, design/app-fullpage.webp, design/app-*.png, design/app-shapes.png, design/app-widget-composer.png, docs/00-README.md, .agents/memory/gotchas.md | 静态原型同步可交互原型 v1.1 → v2.2：新增「形态切换与随手添加」章节（标题行形态按钮 + 挂件添加区收起），重导 13 张状态截图、新增 2 张截图与整页长图，更新 design/README 与 docs/00-README 版本/交互说明 | 用户指出 @design/static-prototype.html 未同步最新动态原型修改（m00001）
2026-11-22 | update | docs/acceptance/M6-ACCEPTANCE.md, docs/acceptance/screens/notice-window-packaged.png | 打包版应用内提示窗口与全量审计（53 项 ALL PASS）复验记录
2026-11-22 14:26 | update | design/index.html, design/static-prototype.html, design/README.md | 新增原型预览首页（可交互/静态/整页长图入口，可作为静态站根目录首页）；静态页字体路径由 ../design/fonts 改为 fonts/，使 design/ 目录可直接平移到站点根发布 | 用户询问如何在 GitHub 上展示动静态原型（私有仓库需发布方案）
2026-11-22 14:36 | update | index.html, .nojekyll, README.md, .agents/memory/gotchas.md | 准备 A 方案（主仓库转公开 + Pages master/(root)）：根 index.html 跳转 design/index.html、空 .nojekyll 跳过 Jekyll 处理、README 增加在线预览链接段 | 用户 m00549 选择A

2026-11-22 14:31 | update | design/ui/tokens.css, src/renderer/src/styles/tokens.css, src/renderer/src/styles/app.css, docs/02-DESIGN-SPEC.md, docs/08-UI-ENGINEERING-SPEC.md, docs/acceptance/M6-ACCEPTANCE.md, docs/acceptance/screens/editor-window-compact-shadow.png, .agents/memory/decisions.md | 独立透明窗口（挂件/胶囊/编辑/提示）内的 modal/pop/toast 改用紧凑阴影 token（--shadow-modal-window/--shadow-pop-window/--shadow-toast-window），由窗口根类覆盖；完整窗口保留大阴影 | 用户指出其余独立透明窗口的 toast/modal 仍会出现裁切灰底，要求按场景区分阴影（m01273）
2026-11-22 14:52 | update | design/index.html, design/app/index.html, design/app/js/render.js, design/static-prototype.html, design/app-*.png, design/app-shapes.png, design/app-fullpage.webp, .agents/memory/gotchas.md | 公开预览页去重复动态入口与版本号：预览页 hero 只保留 1 个可交互原型入口，showcase 与两张形态卡改为静态展示；移除原型 demo bar / 侧栏与静态原型页的版本标识，重导全部截图与整页长图 | 用户 m00661（页面有两个动态入口且暴露原型版本号）
2026-11-22 14:56 | cleanup | .agents/tmp, release2/, release/win-unpacked*, nohup.out, .gitignore | 清理实施期临时产物（约 2.3GB）：tmp 验收脚本/截图/浏览器缓存 790MB、release2 14MB、旧 win-unpacked 1.5MB、工作区外测试构建副本 1.52GB；nohup.out 自版本库移除并加入 .gitignore；保留 electron 运行时缓存（331MB，dev/test 启动器复用） | 用户 m05519 要求清理2026-11-22 15:07 | repackage | release/, Desktop 交付目录, README.md, docs/acceptance/M6-ACCEPTANCE.md, 使用说明.txt | 按当前 HEAD 重新打包（含 D17 独立透明窗口紧凑阴影、F12 开发快捷键为 dev-only）；portable 97,702,960 B / 2ce8aef5…，setup 106,245,569 B / 18d33310…；打包版复验编辑窗口 modal 为紧凑阴影；同步校验表与使用说明 | 重读规范后对齐交付物（docs/acceptance §10 记录的 14:15 包不含该修复）