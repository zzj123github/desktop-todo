# PROPOSAL v1.6 · 完整窗口的最小化 / 最大化 / 关闭按钮

> **状态：待确认**（2026-11-24 提交原型，等用户确认后才实施）
> 基线：`design/app/` v1.4（本提案**没有**改动基线目录与基线截图）
> 提案原型：`design/proto-v1.6/app/index.html`　截图：`design/proto-v1.6/screens/`
> 编号说明：`release/1.0.1` 分支上 v1.5 已被「悬浮球 / 固定到桌面」占用，本提案在 master 上直接取 v1.6，避免与远端提案重号。

## 1. 背景与问题

完整窗口是 `frame: false` 的自绘窗口（`src/main/windows.ts:927` `createManagerWindow`），系统标题栏被去掉后没有任何窗口按钮：

- 不能最小化：只能「收起到挂件 / 胶囊」或 Esc 收起，两者语义不同（收起是切形态，最小化是进任务栏）；
- 不能最大化：`resizable: true` 但窗口没有最大化入口，大屏上只能手动拖边缘；
- 没有关闭按钮：实际实现里标题行**没有** X（`design/app` 原型 v1.4 画了 `.mhead-close`，`src/renderer/src/app/Manager.tsx:584` 的标题行只有进度环、形态按钮、新建），关闭只剩 Esc。

用户要求在窗口顶部补上「最小化 / 最大化 / 关闭」，且**按系统区分位置与风格**（截图红框标的是左上角，即 macOS 红绿灯的位置）。

## 2. 方案：一个窗口，两套系统惯例

同一套 DOM，按平台切换位置、尺寸、悬停样式；**桌面形态（挂件 / 胶囊）与编辑弹窗不加窗口按钮**（它们没有任务栏位置，也不是「窗口」语义）。

### Windows（Win11 惯例）

- 位置：窗口**右上角贴边**，三个 46×32 直角按钮，顺序 `— □ ✕`；
- 悬停：最小化/最大化 浅灰底 `rgba(31,30,29,.07)`；关闭 **红底 `#C42B1C` + 白叉**（按下 `#B0271A`）；
- 图标 10×10、1px 细线；最大化后切「还原」双框图标；
- 窗口按钮独占顶部 32px 标题栏条，主区内容（标题行、tab、列表）整体落到其下方，按钮不压任何可点区域；
- 双击标题行空白处 = 最大化 / 还原（Windows 惯例）。

### macOS（红绿灯惯例）

- 位置：窗口**左上角**，3 个 12px 圆点、间距 8px、距左 20px / 距顶 18px；
- 颜色：`#FF5F57` / `#FEBC2E` / `#28C840`；**悬停才显示符号** `× − +`，窗口失焦时三点退成中性灰 `#D8D4CB`；
- 侧栏顶部让出 36px 标题栏高度，品牌行落在红绿灯下方（Big Sur 起的侧栏应用做法），标题行右侧保持 24px 内边距；
- 关闭 = 回桌面形态；最小化 = 进 Dock；绿色 = 全屏（⌥ 单击改为缩放）—— 见待确认问题 2。

### 两平台共用

- 关闭沿用现有语义：`close-window` → 回桌面形态（与 Esc 一致），不退出应用；
- 最大化 = 铺满工作区（让出任务栏），圆角与投影收起；还原恢复 1100×720 与圆角；
- 所有按钮是真 `<button>`，带 `title` 与 `aria-label`；最大化按钮带 `aria-pressed`。

## 3. 交互对照

| 动作 | Windows | macOS |
| --- | --- | --- |
| 最小化 | 点 `—` → 任务栏，任务栏出现应用按钮可点回 | 点黄灯 → Dock |
| 最大化 / 还原 | 点 `□` 或双击标题行；图标随状态切换 | 点绿灯 → 全屏；⌥+点绿灯 → 缩放 |
| 关闭 | 点 `✕`（红底悬停）→ 回桌面形态 | 点红灯 → 回桌面形态 |
| 键盘 | Esc 仍是关窗快捷方式；按钮可 Tab 聚焦 | 同左 |
| 悬停反馈 | 灰底 / 红底；图标加深 | 三个灯同时浮出 `× − +` |
| 失焦 | 无特殊态（系统行为一致） | 三点变灰 |

## 4. 视觉规格

| 项 | Windows | macOS |
| --- | --- | --- |
| 按钮尺寸 | 46×32，直角 | 12px 圆点，间距 8px |
| 锚点 | `top:0; right:0` | `top:18px; left:20px` |
| 图标 | 10×10，stroke 1px | 12×12，stroke 1.2px，悬停显示 |
| 前景色 | `#7B7466`，悬停 `--ink` | 深色 55% 透明 |
| 悬停底 | `rgba(31,30,29,.07)`，关闭 `#C42B1C` | 无底色（灯本身着色） |
| 让位 | 主区 `padding-top: 32px`（标题栏条） | 侧栏 `padding-top: 36px`（红绿灯条） |

## 5. 结构与状态（原型已实现）

```
.mgr[data-platform="win"|"mac"]
└── .wc
    ├── .wc-win  > .wcb / .wcb-close        （data-act: win-min / win-max / close-window）
    └── .wc-mac  > .tl-close / .tl-min / .tl-max
```

- `data-platform`：平台开关，写在 `.mgr`；
- `.manager-scene.wc-maxed`：最大化态（铺满工作区、去圆角投影、切还原图标、隐藏原型体验条）；
- `.mgr.wc-minimizing` / `.wc-restoring`：最小化 / 还原过渡（原型模拟）；
- `.wc-mac.is-blur`：窗口失焦（红绿灯变灰）；
- 平台选择存 `localStorage: desktopTodo.proto.platform`（仅原型体验用，真实应用由 `window.api.platform` 决定）。

## 6. 落地映射（确认后才执行，本提案未改 src/）

| 层 | 文件 | 改动 |
| --- | --- | --- |
| 主进程 | `src/main/windows.ts` | manager 窗口新增 `window:control` 处理：`minimize` / `toggle-maximize` / `toggle-fullscreen`（mac）；广播 `maximize`/`unmaximize`/`enter-full-screen` 状态 |
| 主进程 | `src/main/ipc.ts` | 注册上述 IPC 通道 |
| preload | `src/preload/index.ts` | 暴露 `window.api.window.{minimize,toggleMaximize,isMaximized,onStateChange}` |
| 渲染层 | `src/renderer/src/components/WindowControls.tsx` | 新组件，按 `platform` 渲染两套按钮 |
| 渲染层 | `src/renderer/src/app/Manager.tsx` | 标题行挂载组件；Windows 下 `.mhead-r` 让位 |
| 样式 | `src/renderer/src/styles/app.css` | 追加窗口按钮样式（沿用 tokens，不新增色板） |
| 文案 | `src/renderer/src/i18n/zh.ts` | 最小化 / 最大化 / 还原 / 关闭 / 全屏 |
| 规格 | `docs/02-DESIGN-SPEC.md`、`docs/08-UI-ENGINEERING-SPEC.md` | 确认后登记窗口按钮规范与尺寸 |

## 7. 平台差异与风险

1. **Windows 11 贴靠布局（Snap Layouts）**：自绘最大化按钮**不会**触发 Win11 悬停四宫格，除非用原生 `titleBarOverlay`（会破坏自绘标题行）。建议不做，作为已知限制记录。
2. **macOS 全屏**：`enterFullScreen` 会进入独立 Space，绿点语义要明确「全屏」还是「缩放」（待确认问题 2）；当前 `createManagerWindow` 未显式设 `fullscreenable`，需确认允许。
3. **窗口拖动区**：现有 `.mgr-drag` 是顶部 8px 细条；macOS 红绿灯在 y=18..30，不与拖动条冲突；Windows 右上角按钮区必须 `-webkit-app-region: no-drag`。
4. **缩放边界**：最大化后 `bindBoundsPersistence` 会把最大化尺寸当作用户窗口尺寸存进 `managerBounds`，落地时要跳过最大化态的位置保存。
5. **多显示器**：最大化只作用于当前显示器工作区（Electron `maximize()` 天然如此）。

## 8. 待确认问题（请逐条回「同意 / 改成…」）

1. **macOS 绿色按钮单击 = 全屏还是缩放？** 推荐：单击全屏（macOS 默认语义），⌥ 单击缩放。
2. **Windows 最大化的贴靠布局**：接受「没有 Win11 四宫格」这个限制？推荐：接受，自绘按钮换取统一的视觉。
3. **挂件 / 胶囊要不要窗口按钮？** 推荐：不加（无任务栏位置，点「收起」已有形态切换）。
4. **关闭完整窗口后回桌面形态（现状），不退出应用** —— 确认保持现状？

## 9. 验收要点（确认后落地时执行）

- 两平台截图与 `design/proto-v1.6/screens/` 逐项对齐（位置、尺寸、悬停色、图标状态）；
- 最小化后任务栏 / Dock 可恢复，且 `managerBounds` 不被最大化尺寸污染；
- 最大化 ↔ 还原图标与 `aria-pressed` 同步；Esc 关窗不回退行为；
- 挂件 / 胶囊 / 编辑弹窗保持无窗口按钮；
- 打包版（Windows portable/NSIS、macOS arm64 dmg）各自实机点击验证——原型阶段无法代替。

## 10. 原型入口与截图

```bash
cd design && node server.mjs      # 或双击 启动原型.bat
# 打开 http://127.0.0.1:8765/proto-v1.6/app/index.html
```

体验条右侧的 **Windows / macOS** 分段控件切换两套按钮；打开完整窗口后可点按钮、双击标题行、最小化到任务栏再点回。

截图（1280×696 @2x，演示时间 2026-11-21 20:58）：

| 文件 | 内容 |
| --- | --- |
| `screens/win-1-normal.png` | Windows 平台，完整窗口默认态 |
| `screens/win-2-close-hover.png` | Windows，关闭按钮悬停（红底白叉） |
| `screens/win-3-maximized.png` | Windows，最大化态（还原图标） |
| `screens/mac-1-normal.png` | macOS 平台，红绿灯默认态 |
| `screens/mac-2-close-hover.png` | macOS，悬停浮出 `× − +` |
| `screens/mac-3-maximized.png` | macOS，全屏态 |
| `screens/mac-4-minimized.png` | 最小化后桌面 + 任务栏入口 |
| `screens/mac-5-restored.png` | 从任务栏入口还原 |

原型自检（本机脚本，不提交）：`.agents/tmp/check-proto-v1.6.mjs`，13 项断言全过（双击最大化/还原、两平台关闭回桌面、平台切换与持久化、悬停符号默认隐藏、最小化与还原、无控制台错误）。
