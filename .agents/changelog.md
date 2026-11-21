# Changelog

格式：`YYYY-MM-DD | <create|update|delete|merge> | <path/artifact> | <做了什么>`

2026-11-21 | create | .agents/ | bootstrap：建立项目记忆层，登记权威资料与实施目标（M0–M6 一次性交付）
2026-11-21 | create | .agents/memory/decisions.md | 记录 D1–D5：Electron 40.10.2、Electron-Node 跑 Vitest、renderer lib 目录、tags 管理 IPC 缺口、workspace GUI 限制绕行
2026-11-21 | create | .agents/memory/gotchas.md | 记录 workspace GUI/EPERM、ELECTRON_RUN_AS_NODE、高 DPI 截图、网络镜像、pnpm 构建脚本坑
2026-11-21 | update | docs/09-PROJECT-STRUCTURE.md | §2.1 增加 lib/ 目录、§6.1 登记样式/字体/脚本/vitest 配置/Electron 版本等实施补充
2026-11-21 | create | src/renderer/src/styles/tokens.css | 从 design/ui/tokens.css 原样复制（M0 token 契约）
2026-11-21 | create | build/icon.ico, icon.png, tray.ico, tray.png | scripts/make-icons.py 生成的打包/托盘图标（陶土方+白勾）
2026-11-21 | create | scripts/* | make-icons.py、fetch-native-assets.py、electron-runtime.cjs、dev-launch.cjs、run-tests.cjs、screenshot.ps1
