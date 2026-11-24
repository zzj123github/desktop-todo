# 交接：v1.6 完整窗口按钮（最小化 / 最大化 / 关闭）

> 2026-11-24 17:58 续完。原型基线已提升、记录已写；**git 提交由本轮收尾**。剩余开放项仅 Windows 实机点击与可选的安装后 CDP。

## 1. 当前状态

| 项 | 状态 |
| --- | --- |
| 提案确认 | ✅ 用户 2026-11-24 17:21「确认提案 / 按提案实施」 |
| 代码实施 | ✅ 完成 |
| 规格文档 docs/02 §4.2 + docs/08 §3.14 | ✅ |
| `tsc --noEmit` / 单测 247 | ✅ |
| 真机 CDP（macOS 开发版） | ✅ 16/16 |
| 原型基线提升 / 静态原型 / 截图 | ✅ app v1.6、static v2.5；`app-manager.png` / `app-shapes.png` / `app-fullpage.webp`（2708×16383） |
| 安装包 dmg | ✅ `release/DesktopTodo-1.0.0-arm64.dmg`，120,645,659 B，SHA-256 `372e3aa1139b6bc79c5b4c9e9695d1b5e78ad6bd95d2834dd29ae76f6b938e68` |
| `.agents` 记录 | ✅ changelog + decisions D28 + PROPOSAL 已确认 + open-items 更新 |
| git 提交 | ⏳ 本轮执行 |
| Windows 实机点击 | ❌ 缺口保留 |

## 2–3. 实现要点与验证证据

见上一版交接（实现文件列表与 CDP 证据不变）。决策沉淀见 `.agents/memory/decisions.md` **D28**。

## 4. 下一步（若仍暂停）

1. 提交：`feat(ui): 完整窗口最小化/最大化/关闭按钮（Windows 右上角 / macOS 红绿灯）`
2. （可选）安装 dmg 后对 `.app` 再跑 `.agents/tmp/check-app-v1.6.mjs`
3. Windows 实机补点最小化 / 最大化 / 关闭

## 5. 环境坑

- Electron / Chrome 截图与启动需完整文件访问（勿用过严沙箱）。
- 整页长图单次 `captureBeyondViewport` 易挂起；改用分块截图再 Pillow 拼接 + 1.73 倍缩放出 webp。
- 构建镜像：`ELECTRON_MIRROR` / `ELECTRON_BUILDER_BINARIES_MIRROR` → npmmirror。
