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
