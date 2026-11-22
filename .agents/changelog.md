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
2026-11-22 14:56 | cleanup | .agents/tmp, release2/, release/win-unpacked*, nohup.out, .gitignore | 清理实施期临时产物（约 2.3GB）：tmp 验收脚本/截图/浏览器缓存 790MB、release2 14MB、旧 win-unpacked 1.5MB、工作区外测试构建副本 1.52GB；nohup.out 自版本库移除并加入 .gitignore；保留 electron 运行时缓存（331MB，dev/test 启动器复用） | 用户 m05519 要求清理
2026-11-22 15:07 | repackage | release/, Desktop 交付目录, README.md, docs/acceptance/M6-ACCEPTANCE.md, 使用说明.txt | 按当前 HEAD 重新打包（含 D18 独立透明窗口紧凑阴影、F12 开发快捷键为 dev-only）；portable 97,702,960 B / 2ce8aef5…，setup 106,245,569 B / 18d33310…；打包版复验编辑窗口 modal 为紧凑阴影；同步校验表与使用说明 | 重读规范后对齐交付物（docs/acceptance §10 记录的 14:15 包不含该修复）
2026-11-22 | update | docs/00-README.md, .agents/memory/decisions.md, .agents/changelog.md | 决策表补录第 20–25 条（共用位置/折叠输入/内描边/紧凑阴影/应用内提示/独立编辑窗口）；decisions 编号重排（第二个 D15→D16、原 D16→D17、原 D17→D18）并修正 D18 正文交叉引用与 changelog 引用 | 重读规范后对齐文档与决策编号（用户 m05661）
2026-11-22 | update | src/renderer/src/components/{Popover.tsx,anchoredPosition.ts,anchoredPosition.test.ts,EditorModal.tsx,LinkRow.tsx,TaskRow.tsx}, src/renderer/src/lib/{links.ts,links.test.ts}, src/renderer/src/app/{HelpModal.tsx,Manager.tsx}, src/renderer/src/i18n/zh.ts, src/renderer/src/styles/app.css | 交互四项修正：Popover 全局单开注册器（同一时刻只显示一个浮层）；链接标题内联编辑（autoLinkTitle、Enter/失焦保存、Esc 取消、清空回退、新链接自动进入编辑）；空链接提示拆分为「还没有链接」+ 独立 dropzone 主/副文案；完整窗口侧栏 footer 在设置之上新增「使用说明」与应用内 HelpModal（六节只读） | 用户 m05701 反馈四项交互问题
2026-11-22 | update | docs/01-PRD.md, docs/02-DESIGN-SPEC.md, docs/08-UI-ENGINEERING-SPEC.md, docs/09-PROJECT-STRUCTURE.md, README.md, docs/acceptance/M6-ACCEPTANCE.md, .agents/memory/decisions.md | 规范同步：PRD 增 FR-2.9/3.4/3.9/6.6；08 增 footer 两行、Popover 单开规则、使用说明 wide 弹窗、LinkRow 标题编辑；02 §4.2 footer；09 §6.1 登记 HelpModal/links.test；决定 D19；验收新增 §11（四项根因/实现/63 项审计/打包值） | 用户 m05701 要求同步规范与验收
2026-11-22 | update | design/app/js/{core,render,interactions}.js, design/app/css/app.css, design/static-prototype.html, design/app-*.png, design/app-fullpage.webp, design/README.md | 原型同步：侧栏使用说明入口 + HelpModal 六节、链接标题行内编辑、空链接提示与 dropzone 副文案；static-prototype 增第 06 节与截图（v2.3）；重导 11 张截图 + 新 app-help/app-editor-link-title + 整页长图（2914×16350）；修 core.js UNC 正则（4 反斜杠→2） | 用户 m05701 要求原型/静态图一并调整
2026-11-22 | repackage | release/, Desktop 交付目录, README.md, docs/acceptance/M6-ACCEPTANCE.md, 使用说明.txt | 按 m05701 修复重新打包（2026-11-22 15:47）：portable 97,693,981 B / 9d234231…，setup 106,247,407 B / da8ffc3b…；打包版审计 63/63 PASS；更新校验表、使用说明与验收 §11 | 四项交互修正进入交付物
2026-11-22 | update | src/main/windows.ts, src/renderer/src/styles/app.css | 桌面形态窗口四周各留 2px 透明留白（挂件 356×（内容高+4）、胶囊 288×58），新增 normalizeShapeBounds 落盘规范化，修复高 DPI 下挂件/胶囊右/下边缘裁切（用户 m06254）
2026-11-22 | update | src/main/windows.test.ts, scripts/audit-ui.mjs | 新增 normalizeShapeBounds 3 用例与「卡片完整位于窗口内」2 条审计断言；测试 188 项、dev 审计 64 项 ALL PASS
2026-11-22 | update | docs/02-DESIGN-SPEC.md, docs/04-TECH-PLAN.md, docs/08-UI-ENGINEERING-SPEC.md, docs/09-PROJECT-STRUCTURE.md | 同步窗口尺寸=可见卡片+四周 2px 留白、上限 524 的规范与配置示例
2026-11-22 | update | release/, README.md, docs/acceptance/M6-ACCEPTANCE.md | 16:29 重打包（portable 97,684,719 B / setup 106,247,506 B），更新校验值、修复清单与验收 §12
2026-11-22 | update | design/app/js/{core,render,interactions}.js, design/app/css/app.css, design/static-prototype.html, design/app-{editor,editor-link-title,editor-link-fields,dp-editor}.png, design/app-fullpage.webp, design/README.md | 原型同步（app v1.3 / static v2.4）：链接添加行拆成「地址 + 标题（可选）」两输入（任一 Enter 提交、成功清空并聚焦地址、无效地址 toast 拒绝）；链接行标题与路径均可点开同一行内双字段编辑（Enter/失焦保存、Esc 取消、无效地址保持编辑、空标题回退自动标题、保存后按新地址重识别图标、两输入切换不提前提交）；静态页新增第 08 图并顺延图注至 18；重导 editor / editor-link-title / dp-editor 并新增 app-editor-link-fields.png，整页长图改为 2725×16343（dsf 1.73）；41 条 CDP 交互断言 + 12 条静态页断言全 PASS | 用户 m06711 反馈链接添加/编辑缺口
2026-11-22 | update | src/renderer/src/lib/links.ts, src/renderer/src/lib/links.test.ts, src/renderer/src/i18n/zh.ts, src/renderer/src/components/EditorModal.tsx, src/renderer/src/styles/app.css | 链接添加/编辑改为「地址 + 标题」双字段：parseLinkInput 统一解析（地址必填/标题≤120/自定义标题优先）、添加行两输入、行内同一编辑态双输入（Enter/失焦保存、Esc 取消、relatedTarget 防误提交、无效地址保持编辑、空标题回退自动标题、改地址重识别类型并跟随自动标题）；新增 4 单测，192 项全通过 | 用户 m06711 反馈链接添加/编辑缺口
2026-11-22 | update | docs/01-PRD.md, docs/02-DESIGN-SPEC.md, docs/08-UI-ENGINEERING-SPEC.md, docs/acceptance/M6-ACCEPTANCE.md | 规范同步双字段链接交互（PRD FR-3.4、08 §3.12、02 编辑弹窗字段清单）并新增验收 §13（根因/实现/192 用例/70 项 dev 审计/70 项打包版审计/交付值） | 用户 m06711 要求规范一并调整
2026-11-22 | update | scripts/audit-ui.mjs | 审计扩到 70 项：编辑窗口等待 wide 模态就绪；新增双字段编辑、改地址重算名称、危险地址拒绝、添加行两输入、添加时直接填标题等断言 | 用户 m06711 回归
2026-11-22 | repackage | release/, Desktop 交付目录, README.md, 使用说明.txt, docs/acceptance/M6-ACCEPTANCE.md | 17:45 重打包：portable 97,700,017 B / 029e7cee…，setup 106,248,129 B / df45b7c4…；打包版审计 70/70 PASS；更新 README 校验表/修复清单、使用说明 v17:45 与验收 §13 | 链接双字段修复进入交付物
2026-11-22 | update | .agents/memory/decisions.md | 新增 D21（链接添加/编辑双字段模型与自动标题跟随规则） | 用户 m06711 决策记录
2026-11-22 | update | design/app/js/interactions.js, design/app/css/app.css, design/README.md | 时间列表（时/分）滚轮改为应用内平滑滚动：增量归一（像素×0.4/行×24/页×clientHeight，单次限幅 ±120）、rAF ease-out 160ms、连续滚动从当前位置重设目标、reduced-motion 直接定位、键盘与滚动条保持原生、pointerdown 让位；app v1.4，static v2.4 不变（视觉无变化，不重导截图）；CDP 断言 23/23 PASS | 用户 m06992 反馈滚轮跳变
2026-11-22 | update | src/renderer/src/lib/scroll.ts, src/renderer/src/lib/scroll.test.ts, src/renderer/src/components/DateTimePicker.tsx, src/renderer/src/styles/app.css | 时间列表（时/分）滚轮改为应用内平滑滚动：scroll.ts 纯函数（deltaMode 归一×0.4/×24/×clientHeight、限幅 ±120、160ms ease-out 进度）+ DateTimePicker wheel 接管（passive:false、命中 .dp-tl-scroll、连续滚动重设目标、reduced-motion 直接定位、pointerdown 让位）+ overscroll-behavior:contain；新增 9 单测，201 项全通过 | 用户 m06992 反馈滚轮跳变
2026-11-22 | update | scripts/audit-ui.mjs | 审计扩到 74 项：manager 模态内展开时间列表、CDP 滚轮采样断言出现中间帧、reduced-motion 直接定位到 48px、Esc 只关日期浮层不关模态 | 用户 m06992 回归
2026-11-22 | update | docs/08-UI-ENGINEERING-SPEC.md, docs/02-DESIGN-SPEC.md, docs/09-PROJECT-STRUCTURE.md, docs/acceptance/screens/m06992-dp-smooth-scroll.png | 同步平滑滚动规范（08 §3.9、02 日期选择器）、登记 lib/scroll.ts 与测试、存档审计截图 | 用户 m06992 要求规范一并调整
2026-11-22 | update | .agents/memory/decisions.md | 新增 D22（时间列表应用内平滑滚动及理由/验证） | 用户 m06992 决策记录
2026-11-22 | repackage | release/, Desktop 交付目录, README.md, 使用说明.txt, docs/acceptance/M6-ACCEPTANCE.md | 18:25 重打包：portable 97,697,084 B / b9483529…，setup 106,248,940 B / b0d3191e…；打包版审计 74/74 PASS；更新 README 校验表/修复清单、使用说明 v18:25 与验收 §14 | 时间列表平滑滚动修复进入交付物
2026-11-22 | update | design/app-widget-composer.png, design/app-fullpage.webp, design/static-prototype.html, design/README.md | 修正静态原型页的桌面挂件添加区截图：原图导出视口偏小（1280×696 内容被裁成 580 CSS 高再补底），挂件标题被裁、模拟桌面任务栏未贴底；按 1280×696@2x + 固定演示时间 2026-11-21 20:58 重导（实测 .taskbar bottom=696、像素底行为任务栏色），整页长图同步重导（2725×16359，整页高 9456 CSS、dsf 1.73），图注 05 改为「桌面挂件 · 添加任务输入区（点开后）」 | 用户 m07464 反馈图片中模拟桌面状态栏不在最底部
2026-11-22 19:22 | fix | .github/workflows/release.yml, .agents/memory/gotchas.md | 修复 GitHub Release 首次构建失败：electron-builder 在 tag 构建时隐式发布缺少 GH_TOKEN，打包步骤加 `--publish never`，由 softprops/action-gh-release 统一发布 | 用户要求 GitHub Actions 构建并在 Releases 下载两个包（m00804），run 45016248755 失败原因取证
2026-11-22 19:25 | release | .github/workflows/release.yml, release v1.0.0 | GitHub Actions run 45016749070 成功（17/17 步）：Releases v1.0.0 发布 DesktopTodo-1.0.0-portable.exe（97,699,190 B，sha256 347cd870…）与 DesktopTodo-1.0.0-setup.exe（106,248,931 B，sha256 5ebfe5f8…）；tag v1.0.0 指向 6743e9d | 用户 m00804 要求 GitHub 构建部署并在 Releases 下载两个包
2026-11-22 | update | src/main/{logger.ts,logger.test.ts,windows.ts,notices.ts,notices.test.ts,index.ts,ipc.ts} | 退出加固（用户 m07685）：退出顺序改为 before-quit 只置标志/清理，will-quit 再 checkpoint/关库/快捷键/托盘；加载与对话框 Promise、focus/blur 设置读取、位置防抖、广播、显示器事件在退出阶段静默；新增主进程异常日志 main.log（512KB 轮转）与 process guards
2026-11-22 | update | docs/acceptance/M6-ACCEPTANCE.md | 追加 §15：便携版退出偶发主进程异常弹窗的根因、修复、验证与交付物哈希
2026-11-22 | update | docs/04-TECH-PLAN.md, docs/09-PROJECT-STRUCTURE.md, README.md | 同步退出生命周期、logger 文件、构建产物表与修复清单（m07685）
2026-11-22 | update | release/, C:\\Users\\lazasons\\Desktop\\桌面待办-交付物\\ | 2026-11-22 20:37 重新打包并更新校验值（portable 97,708,366 B / setup 106,249,746 B）
2026-11-22 | update | .gitignore, .agents/memory/project-overview.md | 接入本机 CodeGraph 代码索引：`codegraph init` 生成 `.codegraph/`（已 gitignore，本机重建）；记录 agent 查询命令（explore/context/node/callers/impact）与自动同步说明 | 用户要求给项目添加 codegraph（m01396）
2026-11-22 | update | AGENTS.md, .agents/memory/project-overview.md | AGENTS.md 新增 §4.1：定位/理解/影响面默认先查 CodeGraph（explore/context/node/callers/impact），再用 grep/读文件复核；不可用时回退 grep，不阻塞任务 | 用户要求默认先查 codegraph（m01474）
2026-11-22 | update | AGENTS.md, .agents/memory/project-overview.md, .agents/memory/decisions.md, docs/06-IMPLEMENTATION-BRIEF.md | 新增项目规范：新功能/UI·UX 调整先做原型、不得直接改已定稿原型（从 design/app 复制到 design/proto-v<版本>/ 提案目录），经用户确认后再同步规格与实施；docs/06 增加指向 | 用户 2026-11-22 明确要求（m01500）
2026-11-23 | update | AGENTS.md, docs/06-IMPLEMENTATION-BRIEF.md, .agents/memory/project-overview.md, .agents/memory/decisions.md | 新增 §4.2.1 阶段门（原型确认前禁止实施、停点与确认定义、提案状态只由确认升级、误开工恢复、守卫建议）；docs/06 与长期纠正同步，决策 D26 | 用户 m01530：release/1.1.0 在未确认提案下直接开始实施
