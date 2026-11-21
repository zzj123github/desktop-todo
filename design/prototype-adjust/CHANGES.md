# 临时调整原型 · 变更说明（A / B / C）

本目录是 `design/app/` 原型的**独立副本**（含 `design/ui/tokens.css` 与 `design/app/fonts/`），
只在本副本上叠加三项临时交互调整，供确认后再决定是否落到正式原型 / 规范。
`design/app/`、`design/ui/`、`src/`、`docs/` 均未改动。

- 打开方式：双击 `design/prototype-adjust/index.html`，或访问
  `file:///C:/Users/lazasons/Workspace/desktop-todo/design/prototype-adjust/index.html`
- 纯 HTML/CSS/JS，无第三方依赖；字体走本地 `fonts/`，离线可用
- 颜色全部使用 `ui/tokens.css` 变量，未引入裸 hex/rgb

## 目录与文件清单

复制自原型的文件（未改内容）：

```
index.html            ← design/app/index.html（仅改了 head 引用与 title/注释）
css/app.css           ← design/app/css/app.css（原样复制）
ui/tokens.css         ← design/ui/tokens.css（原样复制）
fonts/InterVariable.woff2
fonts/NotoSerifVariable.woff2
js/core.js            ← design/app/js/core.js（A 相关新增，见下）
js/render.js          ← design/app/js/render.js（A / B / C 相关新增，见下）
js/interactions.js    ← design/app/js/interactions.js（A / B / C 相关新增，见下）
```

新增文件：

```
css/adjust.css        ← 本次新增的类（.mhead-shapes / .w-add-btn），全部引用 tokens
CHANGES.md            ← 本文件
```

`index.html` 的改动：`<title>` 标注「临时调整」；head 增加 `ui/tokens.css` 与
`css/adjust.css?v=1` 两个 stylesheet；body、图标 sprite、脚本引用未动。

---

## A. 挂件 ↔ 胶囊 共用一套位置锚点（`ui.shapePos`）

### 改了什么

| 文件 | 改动 |
| --- | --- |
| `js/core.js` | `DT.seed().ui` 增加 `shapePos:{x:null,y:null}`；`DT.normalize` 增加旧数据迁移：`ui.shapePos` 缺失时优先取旧的 `ui.widget` 位置、其次 `ui.capsule`（老 localStorage 数据不丢位置）。`ui.widget` / `ui.capsule` 保留为兼容字段，随 `shapePos` 同步写入。 |
| `js/render.js` | 新增 `R.WIDGET_W`、`R.widgetHeight()`（读已渲染 `.widget` 真实 `offsetHeight`）、`R.widgetPos(x,y,h)`（挂件左上角 clamp）、`R.ensureShapePos(shape)`（读/初始化共用锚点，按目标形态 clamp 后写回）、`R.writeShapePos(x,y,silent)`（写 `ui.shapePos` 并同步 `ui.widget/ui.capsule`）、`R.fitVisibleShapePos()`（渲染后按真实尺寸二次收紧并对当前 wrap 定位）。`R.ensureWidgetPos` / `R.ensureCapsulePos` 改为二者的薄包装，`resize` 监听沿用原调用点。`R.renderWidgetLayer` 改为用共用锚点渲染 `.w-wrap` / `.cap-wrap`（胶囊也带上了 opacity），渲染完调用 `fitVisibleShapePos()`。 |
| `js/interactions.js` | 胶囊拖动 `onCapsuleDragMove`：写回 `R.writeShapePos(p.x, p.y, true)`（拖动中不落盘，松手原有 `DT.save()`）；挂件拖动 `onDragMove`：改用 `R.widgetPos()` 按真实高度 clamp，并 `R.writeShapePos(..., true)`；`endWidgetDrag` 原有 `DT.save()` 保留。 |

### 位置规则（clamp）

- 挂件：`x ∈ [16, vw-352-16]`，`y ∈ [56, vh-46-8-实际高度]`
  （不下探出 demo-bar 的 56px，也不压 46px 任务栏，底部完整可见）。
- 胶囊：`x ∈ [12, vw-284-12]`，`y ∈ [12, vh-54-12]`。
- 首次出现默认值沿用原型：挂件右上角 `(vw-352-56, 88)`；胶囊首次（仅在没有挂件位置时）`(vw-284-56, vh-54-70)`。
- 渲染后按真实 `offsetHeight` 再收紧一次：展开输入区变高时自动上移，保证不超视口；收起时不回弹（锚点保持不跳）。

### 怎么演示

1. 桌面挂件在右上角；用鼠标拖动它到屏幕中间。
2. 点挂件右上工具行的「−」→ 收起到胶囊：胶囊左上角 = 刚才挂件左上角（clamp 后）。
3. 拖动胶囊到别处 → 单击胶囊展开回挂件：挂件左上角 = 胶囊左上角（再按挂件高度 clamp）。
4. 刷新页面（F5 / 重新打开）：位置仍保留（写入 `localStorage`）。

### 与原型的差异（重要）

- 原型是 `ui.widget` 与 `ui.capsule` **各自独立记忆**，胶囊默认在右下角；原规范
  `docs/08-UI-ENGINEERING-SPEC.md` §2.4 也写「胶囊位置独立于挂件记忆」。
  **本临时原型按任务要求刻意改为共用锚点**，属于对现有规范的偏离，确认后再决定是否回写规范。
- 挂件拖动 clamp 比原型更严格：原型允许底部露出约 140px 于视口外，现在要求整体可见（任务要求「clamp 在可视区」）。

---

## B. 主界面 / 挂件 / 胶囊 三者互切

### 改了什么

| 文件 | 改动 |
| --- | --- |
| `js/render.js` | `R.main()` 的 `.mhead-r` 中，在进度环与「新建」之间新增 `.mhead-shapes` 按钮组：`data-act="to-widget"`（`i-grid` 图标，`title`/`aria-label` = 「收起到挂件」）、`data-act="to-capsule"`（`i-minus` 图标，「收起到胶囊」），复用原 `.icon-btn` 30×30 样式。`R.capsuleHtml()` 的 `data-act` 由 `expand-widget` 改为 `cap-click`，`title` 改为「单击展开挂件，双击打开完整窗口」，并补 `aria-label`（读屏会念出今日任务数）。 |
| `css/adjust.css` | `.mhead-shapes`：flex 行内按钮组、`gap:2px`、左侧 `1px var(--hairline-soft)` 分隔（不用裸色值）。 |
| `js/interactions.js` | 新增 `expandWidgetFromCapsule()`、`collapseTo(shape)`；`setMode()` 记录 `lastModeSwitchAt`；switch 新增 `to-widget` / `to-capsule` / `cap-click` / `widget-composer-open` 分支。`cap-click` 用模块级 `capClickTimer`/`capLastClick`：首次点击起 250ms 定时器展开挂件；**250ms 内第二次点击**（阈值 260ms 判定）清除定时器并 `setMode('manager')`。双击会先派发两次原生 `click`，因此第一次的展开被 `clearTimeout` 取消。`dblclick` 监听开头加 400ms 防误触（刚切换形态后的双击不再触发「主界面空白处双击新建」）。胶囊聚焦时 `Enter`/`Space` 等同单击展开。 |

### 怎么演示

- **主界面 → 桌面形态**：在主界面标题行右侧（29% 进度环与「新建」之间）点网格图标 → 收起到挂件；
  点减号图标 → 收起到胶囊。
- **挂件 → 主界面**：双击挂件标题区（原逻辑保留）。
- **胶囊 → 挂件**：单击胶囊任意位置，约 250ms 后展开为挂件。
- **胶囊 → 主界面**：250ms 内双击胶囊（第一下不会先展开）。
- 切到主界面时桌面挂件/胶囊层整体隐藏（沿用原型 `setMode` / demo-bar 机制）；
  demo-bar 的「桌面 / 完整窗口」按钮照旧可用，从主界面回桌面时回到上次桌面形态（胶囊态回胶囊）。

### 与原型的差异

- 主界面标题行新增两个图标按钮（只使用现有 `icon-btn`、`i-grid`、`i-minus`，无新图标）。
- 胶囊点击语义：原型「单击即展开挂件」→ 现在「单击展开挂件 / 250ms 内双击打开主界面」，单击展开因此有约 250ms 延迟。
- 胶囊 `data-act`/`title` 调整，并补无障碍标签；`role="button"`、`tabindex="0"`、hover 上移等视觉不变。

---

## C. 挂件添加任务：常驻输入 → 默认一个紧凑按钮，点击展开

### 改了什么

| 文件 | 改动 |
| --- | --- |
| `js/render.js` | `R.ctx` 增加 `widgetComposerOpen:false`。新增 `R.widgetComposerBtnHtml()`：`<button class="w-add-btn" data-act="widget-composer-open" title="展开输入框（Enter 保存）" aria-label="添加任务">` + `i-plus` + 「添加任务」。`R.widgetHtml()` 的 `.w-add` 改为：`widgetComposerOpen ? R.composerHtml('widget') : R.widgetComposerBtnHtml()`。 |
| `css/adjust.css` | `.w-add .w-add-btn`：整行宽、高 28px、`1px var(--hairline)` 边框、圆角 12、底色 `--field-bg`、字色 `--muted`，hover 用 `--border-hover`/`--card`/`--ink-2`，`:focus-visible` 用 `--border-focus` + `--focus-halo`。输入展开时仍复用原型 `.composer` 全套样式（`app.css`），未另写一套。 |
| `js/interactions.js` | `openWidgetComposer()`：置 flag → `R.renderWidgetLayer()` → `focusSoon(#widgetCInput)`；`closeWidgetComposer()` 反向。`handleClick` 开头调用 `maybeCollapseWidgetComposer(e.target)`：flag 为真且桌面形态、无遮罩时，点击 `.w-add` / `#popLayer` / `#dpPop` / 胶囊内部以外区域即收起。`handleKeydown` 的 `Escape`（在日期选择器、浮层、删除确认之后、遮罩之前）收起输入区。`addFromComposer` 里 widget 提交成功后清 flag。`collapse-widget` / `expand-widget` / `to-widget` / `to-capsule` / `setMode` / 重置演示数据时都会连同收起输入区。 |

### 怎么演示

1. 挂件底部默认只有一条浅色「＋ 添加任务」按钮（不再是常驻 textarea）。
2. 点它 → 展开原型完整输入形态（textarea + 日期/标签/优先级/链接工具行 + 发送按钮），textarea 自动 focus。
3. 输入内容后：
   - `Enter` 保存（沿用原型规则：挂件添加默认今天 18:00）并收起回小按钮；
   - `Shift+Enter` 换行、不提交（IME 组词不提交沿用原逻辑）；
   - `Esc`、点击挂件外部、点发送按钮，均收起回小按钮。
4. 展开时挂件高度自适应：由原型 `.widget` 的 `max-height:520px` 限制，`fitVisibleShapePos()` 再保证挂件整体不出视口（必要时上移）。
   收起后挂件变矮，锚点不跳。

### 与原型的差异

- 输入区从「常驻 composer」改为「默认小按钮 + 按需展开」；composer DOM 只在展开时存在，`R.draft.widget` 草稿仍保留，展开时会恢复。
- 新增 `.w-add-btn` 一个 class（在 `adjust.css`）；其余输入、工具行、发送按钮、自动高度全部复用原实现，无重复组件。

---

## 验证

用 Edge 158 无头模式 + CDP（`--remote-debugging-port`，Node 22 内置 `WebSocket`）驱动真实点击/键盘/拖动，
对 A/B/C 共 45 项断言全部通过，包含：

- 初始态：桌面挂件、默认小按钮、无 composer、`shapePos` = 挂件左上角
- A：挂件→胶囊位置沿用同一锚点；胶囊拖动/挂件拖动后 `shapePos` 同步；clamp 在可视区；刷新后位置恢复
- B：主界面两个按钮存在且 `title`/`aria-label` 正确；主界面→挂件/胶囊、挂件双击→主界面、胶囊单击→挂件、双击→主界面（且不会误开新建编辑框、第一次单击展开被取消）
- C：点按钮展开、textarea 自动 focus、高度 ≤520、整体在视口内；Shift+Enter 不提交、Enter 提交并收起并新增任务、Esc 收起、点击外部收起
- 全程无未捕获 JS 异常、无 `console.error`

同时用无头截图人工核对了桌面挂件收起态、胶囊、主界面（标题行按钮）、挂件输入展开态 4 个关键状态。
自测脚本与截图放在 `.verify/`，验证后已删除，不在交付物内。

## 已知差异 / 假设 / 未实现

1. **A 与现有规范冲突**：`docs/08-UI-ENGINEERING-SPEC.md` §2.4 写「胶囊位置独立于挂件记忆」，本原型按本任务要求改成共用 `ui.shapePos`；确认后再决定是否改正式原型/规范。
2. **单击/双击阈值**：250ms（第二次点击 <260ms 视为双击）。比阈值慢的两次单击会先展开挂件，第二次点到的将是挂件内容（原生双击语义），没有再做额外防护。
3. **收起不回弹**：展开输入区导致上移后收起，锚点保持在新位置，不回跳到展开前位置（避免视觉跳动）。
4. **点击外部收起的例外**：有遮罩/日期选择器/浮层打开时不因外部点击收起，交给它们自己的关闭逻辑，避免误关。
5. **挂件拖动 clamp 更严格**：要求整体留在可视区（原原型允许底部露出 140px）。
6. **兼容字段**：`ui.widget` / `ui.capsule` 仍随 `shapePos` 同步写入，便于旧数据迁移与对照；正式实施时可清理。
7. 未改 `docs/`、`src/`、`design/app/`、`package.json`；临时原型与原原型共用同一个 `localStorage` key，但 `file://` 的 origin 不同，不会污染原原型数据。
