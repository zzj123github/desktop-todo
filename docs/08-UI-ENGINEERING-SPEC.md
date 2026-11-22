# 08 · UI 工程规范（Implementation Contract）

> 关系：02 是设计语言与视觉意图；08 是可编码、可测试、可验收的界面契约；../design/app/ 与截图是像素基准。
> 冲突优先级：08（组件、状态、令牌、可访问性） > 02（视觉意图） > 当前交互原型的 `app-*.png` 状态截图（像素对照）。
> 任何视觉偏离必须先改 08 并得到用户确认，不允许在实现时临时发挥。
>
> 本文替换旧提示词里“视觉按 dsh-claude-style”这一句：dsh-claude-style 只是设计血统，不是可执行规格；真正执行的是本文件 + ../design/ui/tokens.css。

## 0. 适用范围与硬规则

- 技术栈固定：Electron 32+ / React 18 / TypeScript / 手写 CSS；不使用 Tailwind、CSS-in-JS、组件库主题覆盖。
- 唯一令牌源：../design/ui/tokens.css 必须原样复制到 src/renderer/src/styles/tokens.css；组件 CSS 只能通过 var(--token) 取值。
- 禁止在组件 TSX/CSS 中写裸颜色值（hex、rgb、hsl）。例外仅：0、1px、100%、auto、transparent、currentColor、inherit。
- 禁止浏览器原生 date / datetime-local / time 控件；日期时间只能使用本规范 §3.9 的自绘组件。
- 禁止点击遮罩关闭模态；禁止系统级 Windows 通知；禁止任何网络请求。
- 每个组件必须实现 §3 的状态矩阵。少一个状态即视为未完成，不做“以后再补”。
- 先落 tokens + primitives + 空状态，再做页面。页面层不得自造颜色、圆角、阴影、动效时长。
- UI 验收以 07-G 和本文件 §5 为准；旧提示词中的“视觉按 dsh-claude-style”不再作为验收依据。

## 1. Token 契约

### 1.1 颜色

| Token | 值 | 用途 |
|---|---|---|
| --canvas | #F9F6EE | 页面/桌布外底色 |
| --paper | #FAF8F2 | 完整窗口主区底色 |
| --card | #FFFDFA | 挂件、卡片、弹窗、浮层 |
| --sidebar | #F0EDE3 | 左栏 |
| --ink | #1F1E1D | 主文字 |
| --ink-2 | #54514A | 次级文字 |
| --muted | #8B8474 | 弱文字、图标 |
| --faint | #A8A18F | 占位符、禁用、已完成 |
| --hairline | #E6E0D2 | 1px 边框 |
| --hairline-soft | #F0ECE2 | 分割线、弹窗 footer 边 |
| --accent | #D97757 | 唯一强调色：勾选、主按钮、进度弧 |
| --accent-deep | #C4553B | 逾期、危险、删除 |
| --accent-soft | #FBEAE2 | 选中 chip 浅底 |
| --link | #184F95 | 网页/文件夹链接 |
| --success | #7F9A6D | 完成、成功状态 |
| --hover | rgba(31,30,29,.045) | 行/按钮 hover wash |
| --selected | rgba(31,30,29,.065) | 左栏选中态 |
| --overlay | rgba(32,27,20,.30) | 模态遮罩 |
| --toast-bg | #2B271F | toast 深底 |
| --toast-ink | #F7F2E6 | toast 文字 |
| --toast-accent | #F0B69F | toast 撤销按钮 |

完整定义以 ../design/ui/tokens.css 为准；组件状态色也在同一文件定义，包括 --accent-hover、--border-hover、--border-focus、--focus-halo、--focus-soft、--selection、--overlay、--chip-bg、--chip-ink、--chip-tag-bg、--chip-selected-border、--danger-hover、--toast-hover、--field-bg、--check-border、--icon、--tab-bg、--warn-border、--priority-med、--priority-low、--ring-track、--ring-label、--on-accent、--toast-bg、--toast-ink、--toast-icon。组件只能引用变量名，不得复制数值。

禁止：纯黑 #000、纯白 #fff、冷灰 #888/#ccc、第二强调色、把 --accent 用作大面积背景。

### 1.2 字体与字级（精确值）

| 角色 | Token | 字体 | 字号/行高 | 字重 |
|---|---|---|---|---|
| 管理视图大标题 | --fs-display | --serif | 29px / 1.15 | 500 |
| 挂件标题 | --fs-widget-title | --serif | 20px / 1.2 | 500 |
| 弹窗标题 | --fs-modal-title | --serif | 18px / 1.3 | 600 |
| 左栏品牌 | --fs-brand | --serif | 15px / 1.2 | 600 |
| 日期选择器月份 | --fs-panel-title | --serif | 14.5px / 1.3 | 600 |
| 正文/输入 | --fs-body | --sans | 13px / 1.45 | 400 |
| 任务标题（主窗口） | --fs-task | --sans | 13px / 1.45 | 500 |
| 任务标题（挂件） | --fs-task-widget | --sans | 12.5px / 1.45 | 500 |
| 元信息 | --fs-meta | --sans | 10.5px / 1.4 | 400 |
| 字段标签/副标题 | --fs-label | --sans | 10.5px / 1.4 | 400 |
| 底部提示 | --fs-foot | --sans | 9.5px / 1.4 | 400 |
| chip | --fs-chip | --sans | 9.5px / 1 | 500 |
| 按钮 | --fs-button | --sans | 12px / 1.2 | 550 |
| 左栏导航 | --fs-nav | --sans | 12.5px / 1.35 | 400/550 |
| 分区标题 | --fs-side-sec | --sans | 10px / 1.4 | 400 |
| toast | --fs-toast | --sans | 12px / 1.4 | 400 |

字体文件：../design/fonts/InterVariable.woff2、NotoSerifVariable.woff2。正式包可随包分发；缺失时按 tokens.css 回退链，不把宋体当默认西文字体。

规则：
- 衬线只用于展示级标题（视图标题、挂件标题、弹窗标题、品牌、日期选择器月份、帮助块 h4），不用于任务标题/按钮/正文。
- 所有数字计数使用 font-variant-numeric: tabular-nums。
- 不得小于 9.5px；环形数字用 12px 基准 + transform scale 实现（见 §3.6）。

### 1.3 间距、圆角、边框

- 间距基准 4px，允许 2px 半格；组件精确值见 §3，不得引入新的随手值。
- 常用：4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 28 / 32。
- 圆角：
  - 4.5px：小 chip、键盘帽
  - 6px：行内小按钮、tag 图标底
  - 8px：主按钮、图标按钮、tab、输入
  - 9px：任务行、text input、modal x
  - 10px：日期字段、链接行、toast
  - 12px：筛选浮层、dropzone、挂件内 composer、帮助块
  - 14px：管理窗口、主 composer、日期选择器、编辑弹窗
  - 16px：挂件
  - 999px：胶囊、时间 chip、勾选圆
- 边框：默认 1px --hairline；焦点允许 1px --border-focus + 轻投影，不允许 2px 深色描边。
- 不使用除了 1px 之外的装饰性描边。

### 1.4 阴影

| Token | 用途 |
|---|---|
| --shadow-card | 静置卡片、composer |
| --shadow-pop | 筛选/下拉/日期选择器 |
| --shadow-modal | 编辑/管理/确认弹窗（应用窗口内） |
| --shadow-modal-window | 独立透明窗口内的弹窗（紧凑，适配 24px 内边距） |
| --shadow-pop-window | 独立透明窗口内的浮层/下拉/日期面板（紧凑） |
| --shadow-toast-window | 独立透明窗口内的 toast（紧凑） |
| --shadow-widget | 挂件（置顶，1px 内描边） |
| --shadow-widget-unpinned | 挂件（未置顶，1px 内描边） |
| --shadow-capsule | 胶囊静置（1px 内描边） |
| --shadow-capsule-hover | 胶囊 hover（1px 内描边，12% ink） |
| --shadow-manager | 完整窗口 |
| --shadow-toast | toast |

禁止用纯黑阴影；阴影颜色必须来自 tokens.css。

桌面形态（挂件/胶囊）的 4 个 token（--shadow-widget / --shadow-widget-unpinned / --shadow-capsule / --shadow-capsule-hover）是 **1px 内描边**，不是外投影：Electron 窗口边界＝卡片边界，外投影会被矩形窗口裁切、只在圆角缺口露灰边；原型与实现统一不使用任何外投影（2026-11-22 用户确认）。

独立透明窗口（挂件 / 胶囊 / 编辑 / 提示）的窗口尺寸≈内容尺寸：`--shadow-modal`/`--shadow-pop`/`--shadow-toast` 的 90px 级外投影会在窗口边界被裁切、只留下断开的灰底。由窗口根类 `.view-widget/.view-capsule/.view-quickadd/.view-editor/.view-notice`统一把这三个 token 覆盖为 `--shadow-modal-window`/`--shadow-pop-window`/`--shadow-toast-window`（紧凑，24px 内边距内可完整渲染）；完整窗口 `.view-manager`（不透明窗口）保留大阴影（2026-11-22 规范调整，按渲染场景区分）。

### 1.5 动效（数值即契约）

| Token | 时长 | 用途 |
|---|---|---|
| --dur-instant | 80ms | 按下 scale(.97) |
| --dur-feedback | 120ms | hover wash、颜色、chip 选中 |
| --dur-reveal | 120ms | 浮层关闭、收起 |
| --dur-surface | 150ms | 卡片阴影/透明度 |
| --dur-open | 250ms | 筛选浮层生长、抽屉 |
| --dur-enter | 320ms | 新任务行浮入 |
| --dur-exit | 120ms | 删除/完成淡出 |
| --dur-bounce | 350ms | 发送回弹、数字滚动 |

缓动：
- 标准：--ease-standard
- 弹窗：--ease-modal
- 浮层：--ease-pop
- 日期选择器：--ease-dp
- 回弹：--ease-spring
- 胶囊：--ease-capsule
- toast：--ease-toast

必须：
- 勾选 160ms 填充 → 白勾 120ms → 行 120ms 淡出 → 折叠 250ms。
- 列表新增 rowIn 320ms；删除 rowOut 120ms + 左移 8px。
- prefers-reduced-motion: reduce 时所有 animation/transition 降到 0.01ms；不做常驻循环动画。
- 不做无意义的持续呼吸/闪烁；逾期呼吸仅可选，不能干扰阅读。

### 1.6 层级（z-index）

| Token | 值 | 层 |
|---|---|---|
| --z-widget | 20 | 桌面挂件/胶囊 |
| --z-taskbar | 30 | 桌面任务栏 |
| --z-demo-bar | 90 | 仅原型体验条，正式应用删除 |
| --z-overlay | 120 | 模态遮罩 |
| --z-popover-layer | 130 | 浮层根 |
| --z-popover | 131 | 浮层本体 |
| --z-datepicker | 190 | 日期选择器（永远在弹窗之上） |
| --z-toast | 200 | toast |

规则：日期选择器从模态内打开时必须是 190，不能被 modal 的 overflow 裁切；toast 永远最上层。

### 1.7 滚动条

- 全应用自绘，不出现系统带箭头滚动条。
- 标准 9px，紧凑 6px；轨道透明，滑块 --sb-thumb，圆角 999，两端 2px 透明内缩。
- hover --sb-thumb-hover，active --sb-thumb-active；最短 32px。
- 隐藏 ::-webkit-scrollbar-button 与 corner 底色；Firefox 用 scrollbar-width: thin + scrollbar-color。
- 输入框到最大高度后在内部滚动，不为滚动条预留常驻槽位；禁止横向滚动条（长标题换行）。

## 2. 布局契约

### 2.1 窗口矩阵

| 界面 | 尺寸 | 可调整 | 外框 | 关键约束 |
|---|---|---|---|---|
| 桌面挂件 | 可见卡片 352 × auto（max-height 520）；窗口 356 ×（内容高 + 4） | 否 | 透明窗口四周各 2px 留白；卡片无边框、圆角 16、背景 --card | 主入口；默认今天；与胶囊共用位置（就近角基准，默认右上）；置顶可切 |
| 完整窗口 | 1100 × 720，min 900 × 600 | 是 | 无边框、圆角 14、顶部 8px 拖拽条 | 左栏 190；主区 padding 20 24 0；打开时隐藏桌面形态（三态互斥） |
| 胶囊 | 可见卡片 284 × 54；窗口 288 × 58 | 否 | 透明窗口四周各 2px 留白；卡片无边框、圆角 999 | 默认右上；与挂件共用位置（就近角基准）；单击展开挂件、双击打开完整窗口 |
| 快速添加 | 520 × auto | 否 | 同挂件 | MVP 可退化为唤起挂件并聚焦输入框 |
| 编辑任务（完整窗口内） | 460 宽；wide 502 | 否 | 模态 | 日期选择器 190 层 |
| 编辑任务（挂件内点击任务） | 550 × auto（502 弹窗 + 24×2 内边距） | 否 | 独立透明窗口、圆角 14、紧凑阴影（window token） | 居中挂件所在显示器；高度由内容上报；Esc / X / 取消 / 保存 / 删除后关闭；挂件保持原样 |
| 管理项目/标签 | 468 宽；单项 424 | 否 | 模态 | 底部完成；从设置进入时关闭返回设置 |
| 删除确认 | 424 宽 | 否 | 模态 | alertdialog；仅关联任务 > 0 时出现 |
| 应用内提示（快捷键冲突/数据库异常） | 472 × auto（424 弹窗 + 24×2 内边距） | 否 | 独立透明窗口、圆角 14、紧凑阴影（window token） | 居中挂件所在显示器；高度由内容上报；自建 NoticeModal（embedded，不画遮罩）；「知道了」右对齐；窗口加载失败 2.5s 才回退原生 dialog |

> **桌面形态的透明留白**（2026-11-22，用户 m06254）：挂件/胶囊窗口 = 可见卡片 + 四周各 2px 透明留白（挂件窗口 356 ×（内容高+4）、胶囊窗口 288×58）。原因：非整数 DPI（如 175%）下 Electron 报告的内容尺寸可能比 Win32 客户区大约 1~2 物理像素，卡片贴满窗口时右/下边缘会被裁切；渲染层根容器 `box-sizing:border-box;padding:2px`，卡片精确保持 352 / 284×54。窗口高度上限 = 520 + 4。

### 2.2 桌面挂件结构

从上到下：拖拽区 → 标题/日期/工具 → 待办分组 → 已完成折叠 → 输入框 → footer。

- 根：可见卡片宽 352（窗口宽 356，四周 2px 透明留白，根容器 padding 2），max-height 520，radius 16，background --card，1px 内描边 --shadow-widget（不使用外投影）；未置顶用 --shadow-widget-unpinned。
- 拖拽区：高 14，居中 6 个 2.5px 圆点；与头部合计顶部 36px 可拖动。
- 头部：padding 0 14px 8px；标题 20/1.2 500；日期行 10.5，逾期数字 --accent-deep；工具按钮 26×26，图标 15；进度环 34。
- 内容区：横向 padding 6，纵向滚动；任务行 padding 6 8，gap 8；任务标题 12.5，元信息 10。
- 输入区：padding 8 12 6；默认折叠为「+ 添加任务」小按钮（高 28，整行宽，radius 12，1px --hairline，背景 --field-bg，11.5px --muted），点击展开完整 composer 并聚焦输入框；composer radius 12，padding 8 9；发送 26；Esc / 点击外部 / 提交后收起。
- footer：padding 2 14 10，字号 9.5；左侧“双击空白处快速新增”。
- 空状态：padding 14 12 10，11px，--faint。
- 挂件最大化高度时必须内容区滚动，头部/输入/footer 固定。

### 2.3 完整窗口结构

左栏 190 + 主区。左栏品牌和 footer 固定，中间 sb-scroll 滚动。

- 根：1100×720 max；radius 14；shadow --shadow-manager；overflow hidden。
- 左栏：background --sidebar；右边 1px --hairline；padding 14 10 12。主视图固定为收件箱 / 今天 / 已逾期 / 即将到期 / 已完成；收件箱 = 未安排日期且未归属项目（B 口径），计数只算未完成。
  - 品牌：27×27 陶土方图标 + 桌面待办 15/600 + v1.0 9.5；padding 2 8 12。
  - 导航项：高 30，padding 0 8，radius 7，字号 12.5，gap 8，图标 15；选中 --selected + 550；计数 10.5 tabular。
  - 分区标题：10px，--faint，padding 13 8 3；最右侧 pencil 20×20，可 Tab/Enter。
  - footer：padding 10 8 2；两行固定可见——上「使用说明」、下「设置」，行 10.5（图标 15，与导航项同一视觉语言）。
- 主区：padding 20 24 0；flex column；background --paper。
  - 头部：标题 29/1.15；副行 11，逾期 --accent-deep；右侧进度环 40 + 收起到挂件 / 收起到胶囊两个 IconButton（30×30，图标 15，与「新建」之间以 1px --hairline-soft 分隔）+ 新建按钮 31。
  - tabs：高 28，padding 2，radius 9，背景 --tab-bg；选中 tab 背景 --card，阴影轻。
  - 筛选行：高 28，gap 5，底部 1px --hairline-soft；右侧搜索框 28，宽 130 输入。
  - 列表区 groups：flex 1，纵向滚动；任务行 padding 9 10，radius 9；group head 11.5。
  - 底部 composer：radius 14，padding 9 11 8；textarea 13/20，max-height 110。
  - footer：padding 0 6 12，9.5。
- 响应式：<=980px 左栏 168、主区 padding 16、标题 25；<=720px 原型隐藏左栏，但 Electron 最小 900，正式应用不出现该断点。禁止在正式应用中把左栏做成抽屉或图标栏。

### 2.4 胶囊

- 可见卡片 284×54（窗口 288×58，四周 2px 透明留白），radius 999，background --card，1px 内描边 --shadow-capsule（不使用外投影）；hover 加深内描边（12% ink，--shadow-capsule-hover），**不做位移**——窗口高度＝胶囊高度，`translateY` 会让圆角边缘被窗口边界裁切（2026-11-22 用户反馈「圆弧不连贯、被截断」）。
- 左侧 32 陶土圆 + 白勾；标题 12/550（今天 N 项，逾期用 --accent-deep）；副行 10 --muted；右侧进度环 26。
- 拖拽时取消 transform、内描边加深（--shadow-capsule-hover）；与挂件共用同一位置记忆，切换形态时保持「就近角」屏幕坐标不变（见 §2.8）。
- 单击展开挂件（约 250ms 判定窗口以区分双击）；双击打开完整窗口；Enter 展开。

### 2.8 三态互斥与位置基准

- 应用任一时刻只存在一种可见形态：桌面挂件 / 完整窗口 / 胶囊；打开完整窗口时隐藏桌面形态，关闭或销毁完整窗口后回到进入前的桌面形态。
- 挂件与胶囊共用同一位置记忆（settings.widgetBounds）。切换形态时按当前窗口中心相对工作区中心所在象限判定「就近角」（默认右上），该角屏幕坐标保持不变；拖动结束后重新判定并持久化。
- 切换入口：完整窗口标题行「收起到挂件 / 收起到胶囊」、挂件「收起为胶囊」、挂件双击标题→完整窗口、胶囊单击→挂件、胶囊双击→完整窗口、Esc 逐级关闭。
- 挂件高度变化（内容增减、输入框展开、浮层临时加高）同样以就近角为定点。

### 2.5 模态与浮层

- overlay：`--overlay` + blur(2px)，z 120；点击不关闭。
- modal：背景 --card，radius 14，shadow --shadow-modal（应用窗口内；独立透明窗口内嵌用 --shadow-modal-window，见 §1.4）；max-height calc(100vh - 60px)；head 15 17 6；body overflow-y auto；footer 11 17 15，顶部 1px --hairline-soft。
- modal 默认不播放入场动画；首次打开加 .enter -> modalIn 240ms，animationend 移除；原地重绘不得重播。保留 .modal-body scrollTop。
- pop：320 宽，radius 12，padding 12，shadow --shadow-pop，z 131；从触发点生长 250ms，关闭 120ms。
- 日期选择器：288 宽，radius 14，padding 12 12 10，z 190，shadow --shadow-pop；下方空间不足翻上方，距视口 12px。

### 2.6 DPI 与缩放

- 全部用 CSS px；不按设备像素写死尺寸。
- 必须在 Windows 100% / 125% / 150% 缩放下截图验收，边框不糊、按钮文字不截断、弹窗不超出屏幕。
- 字体可随系统缩放；不允许用 transform 缩放整个界面来“适配”。

### 2.7 拖拽区

- 挂件顶部合计 36px 可拖动；完整窗口顶部 8px 拖拽条。
- 所有按钮、输入、滚动区、链接设 -webkit-app-region: no-drag。
- 拖动中不能触发点击；拖动结束写回位置（防抖 300ms）。

### 2.8 文案边界

- 界面不展示实现状态说明，包括「本地存储」「内网可用」「数据不出本机」「本地数据」「只保存在本机」「不会上传」等字样及其变体。
- 产品范围（纯本地、数据存本机、内网可用）只写在 README、PRD、设置说明等说明性文档里，不作为界面常驻文案或状态徽标。
- 进度、逾期、链接类型、保存结果等与任务直接相关的信息照常展示；不要为了去掉状态文案而删掉任务反馈。
- 设置弹窗不写「这是原型」「真实应用会……」类实施承诺；原型说明只留在仓库 README。

## 3. 组件契约

### 3.1 Button / IconButton

- 主按钮：高 31，padding 0 12，radius 8，背景 --accent，文字 --on-accent，12/550；hover --accent-hover；active scale(.97)；disabled opacity .45；focus --focus-halo。
- 次按钮/幽灵：高 32，透明，--muted；hover --hover + --ink-2。
- 小按钮：高 32，padding 0 11，radius 8，边框 --hairline，背景 --field-bg。
- 危险文字按钮：无底，--accent-deep，hover `--danger-hover`。
- 图标按钮：30×30，radius 8，图标 15，默认 --icon，hover --hover + --ink。
- 所有图标按钮必须有 aria-label；icon-only 不允许无标签。

### 3.2 TaskRow

- 结构：勾选框 → 内容（标题 + chips + 元信息 + links） → 行尾操作（悬停显示）。
- 主窗口：padding 9 10，radius 9，gap 9；挂件：padding 6 8，radius 9，gap 8。
- 标题 13/12.5，500；chips 9.5；元信息 10.5/10，--muted，gap 5/6，行高 1.4。
- 已完成：标题删除线 + --faint；chips/meta opacity .6；勾选框实心陶土 + 白勾。
- hover：背景 --hover；行尾操作 opacity 0→1，120ms。
- 整个任务行可点击打开编辑；点击勾选框只切换完成，必须 stopPropagation；点击链接只打开链接，必须 stopPropagation。
- 行内不允许折叠/隐藏链接；链接可见，网页/文件夹图标 11.5px。
- 键盘：Tab 到任务行，Enter 打开编辑，Space 切换完成；焦点环 --focus-halo。
- 逾期：未完成且到期时间早于当前时刻即逾期（同一天已过也算）；同日显示「今天 HH:mm · 已逾期 N 分钟/小时」，跨日显示「逾期 N 天」，颜色 --accent-deep；顶栏、左栏、挂件、胶囊与进度共用同一判定。

### 3.3 Checkbox

- 18×18（挂件同）；border 1.5px --check-border；圆；hover border --accent；checked 背景 --accent + 白勾；勾图标 10，stroke 2.6。
- 点击反馈：填充 160ms；勾出现 120ms；随后行淡出/折叠由 TaskRow 负责。
- 键盘 Space 切换；aria-checked 同步；disabled 时 opacity .4 且不可点。

### 3.4 Chip / 优先级

- chip 高 17，padding 0 5，radius 4.5，背景 --chip-bg，文字 --chip-ink，9.5/500；tag chip 用 --chip-tag-bg。
- 项目 chip 前置 5px 圆点；点颜色来自项目色，不能用 --accent 代替所有项目。
- 优先级：高 = --accent-deep；中 = --priority-med；低 = --priority-low；同时显示文字“高/中/低”，不允许只用颜色。
- 可点击 chip 高度 26–27，radius 7；选中 --accent-soft + --accent-deep + 1px --chip-selected-border。

### 3.5 Composer

- 容器：背景 --card，1px --hairline，radius 14，padding 9 11 8，shadow --shadow-card；挂件内 radius 12，padding 8 9。
- 输入：textarea，13/20（挂件 12.5/19），min-height 22，max-height 110；自动换行；无横向滚动。
- 聚焦：border --border-focus + --focus-soft + 轻投影；禁止灰色粗光环；输入框自身 outline none。
- 工具行：高 26，gap 2，11.5；图标 13；选中工具 --accent-soft + --accent-deep。
- 发送：28 圆（挂件 26），背景 --accent，白箭头 14；hover --accent-hover；active scale(.94)。
- Enter 保存；Shift+Enter 换行；IME 组词中不提交；空内容不提交。
- 占位符“添加任务，回车保存…”，--faint。
- 输入框底部不预留给滚动条槽位，避免文字宽度跳动。

### 3.6 ProgressRing

- 尺寸：主视图 40、挂件 34、胶囊 26；圆环 stroke-width 3（三档一致，02 早期写的 2.5/2 作废，以原型实测和本节为准）。
- 底环 --ring-track，进度弧 --accent，从 12 点顺时针，端点圆角。
- 数字颜色 --ring-label，tabular-nums；数字与弧视觉间隙：40px 约 6px、34px 约 4.8px、26px 约 3.9px。
- 实现：文字基准 12px + transform scale（40：.66；34：.568；26：.424；100% 用 .52/.448/.334），保持 2 位数与 100% 四周留白一致。
- 数字变化 160ms；不做闪烁；100% 时保持留白，不贴环。

### 3.7 Popover（筛选/日期/标签下拉）

- 宽 320，radius 12，padding 12，背景 --card，shadow --shadow-pop，z 131。
- 从触发点生长 250ms（--ease-pop），关闭 120ms；点击外部关闭；Esc 关闭；不锁背景滚动。
- 行高 30，radius 7，hover --hover；选中行 --accent-soft + --accent-deep。
- 列表 max-height 220，滚动条用 9px 标准。
- footer 顶部 1px --hairline-soft；重置幽灵按钮 + 完成/应用主按钮。
- 日期浮层内的“指定”使用 §3.9 的 dp-field，不允许原生 input。
- 同一时刻只显示一个 Popover：新浮层打开时自动关闭上一个（同一组件内的日期选择器等嵌套浮层不触发该规则）；键盘/程序化打开也必须遵守，避免两个浮层叠压。

### 3.8 Modal

- 默认宽度 460；wide 502；管理 468；单项管理 424；确认 424；最大高度 calc(100vh - 60px)。
- 标题 18/1.3 600；副标题 10.5 --muted；X 28×28，图标 14。
- 关闭方式仅：X、取消、保存/完成、Esc；点击遮罩绝不关闭。
- 打开时焦点进入第一个可交互元素；关闭后焦点返回触发元素；背景滚动锁定。
- 弹窗内原地更新只换内容，不重播入场，不整体闪烁；保留 modal-body scrollTop。
- 所有表单字段有 label；错误用 --accent-deep 文字，不只用颜色。
- 挂件内点击任务时，编辑面板放在独立透明窗口（embedded 模式：不画遮罩、不锁背景滚动、原地渲染），窗口宽 550 = 502 + 24×2，高度由渲染层测量后上报主进程并居中到挂件所在显示器；浮层（日期选择器）在窗口内放不下时翻到字段上方（§3.9）。
- `NoticeModal`（应用内提示，可复用基础组件）：复用 Modal（size confirm / role alertdialog / embedded），标题 + 警示块（`.cf-warn`：警示图标 + 正文）+ 可选条目列表（`.notice-kbd` 快捷键 chip + `.notice-detail` 说明）+ 可选 hint；footer 仅「知道了」主按钮且右对齐；X 与 Esc 等价确认。宿主 `NoticeWindowHost` 订阅 `on.notice`、测量高度后调 `notice.ready({height})`、确认时 `notice.acknowledge()`；不得用原生 dialog（仅窗口加载失败兜底）。
- 「使用说明」弹窗：wide 502，只读；正文按节渲染——三种形态 / 添加与编辑任务 / 链接 / 筛选与桌面视图 / 快捷键 / 数据与设置，节标题 13.5 衬线 600，正文 12/1.6 --muted，列表行距 1.7；footer 仅右对齐「知道了」主按钮；X / Esc / 「知道了」关闭，点遮罩不关闭；内容来自 `i18n/zh.ts` 的 `help.sections`，不在组件内写文案。

### 3.9 DateTimePicker（自绘，禁止原生控件）

- 入口三处：编辑任务日期时间；筛选指定日期（date 模式）；输入框“日期 → 指定”（datetime 模式）。
- 字段：高 30，1px --hairline，radius 10，背景 --card；左 calendar 13，右 chevron 12，chevron 用 margin-left:auto 贴右。
- 空值文案“选择日期时间 / 选择日期”，--faint；有值“11月25日 周三 09:00” / “11月25日 周三”。
- 弹层：288 宽，radius 14，padding 12 12 10，z 190，shadow --shadow-pop。
- 日历：周一开头 6×7；单元格 28，radius 8；非本月 --faint；今天陶土 1px 内描边；选中陶土实底 + 白字。
- 时间行：标签“时间” + 时/分输入 34×26 + 下拉选择按钮 + 2 个动态快捷 chip；全部同一行，chips 靠右。
- 快捷 chip 固定 2 个：按 ui.timeUsage 次数≥2、次数降序、最近使用降序取前 2；不足用 09:00/12:00/18:00；今天过滤已过去时间，再用未来半点补足。
- 过去时间不可选：今天以前日期 disabled；今天过去的小时/分钟 disabled 置灰；键入过去值点确定 → 拦截 + toast“不能选择当前时间之前”，选择器保持打开。
- 默认 datetime：今天 18:00；已过则下一个未来半点。
- 键盘：Esc 只关选择器，不关下层弹窗；Tab 在日历/时间/按钮间可达；Enter 确认。
- 筛选 date 模式不显示时间行和快捷 chips。

### 3.10 ManageModal / DeleteConfirm

- 两个入口：设置 →“项目与标签”→“管理”打开完整弹窗；左栏分区标题 pencil 打开单项弹窗。
- 完整 468，单项 424；标题根据入口变化；body 只渲染当前范围；底“完成”+ X；点击遮罩不关闭。
- 行：色点/标签图标 + 名称 + N 项待办 + 行尾重命名/删除；行悬停显示操作；行高 32，radius 7。
- 新建：段底虚线“+ 新建项目/标签”，就地展开输入 + 创建/取消；重名 toast 拒绝，空名拒绝。
- 重命名：行内输入预填原名全选；Enter 保存，Esc 取消；重名拒绝。
- 删除：关联任务数 > 0 → 确认弹窗（显示总数/待办/已完成，文案见 02 §5.3）；0 → 直接删除；均保留 toast 撤销。
- 确认弹窗：424，alertdialog；标题“删除项目/标签「名称」？”；警示块 --accent-soft 底 + --warn-border 边；取消/Esc/X 返回管理弹窗；确认后原地刷新。
- 从设置进入关闭后返回设置；从侧栏进入直接关闭。

### 3.11 Toast

- 位置固定底部居中，bottom 26，z 200，最大宽 90vw；深底 --toast-bg，文字 --toast-ink，padding 9 14，radius 10，shadow --shadow-toast（独立透明窗口内由窗口根类改为 --shadow-toast-window，见 §1.4）。
- 图标 15，--toast-icon；撤销按钮 --toast-accent，hover `--toast-hover`。
- 入场 200ms toastIn；停留 3.2s（撤销类 5s）；不阻挡点击。
- 文案必须包含动作对象；删除/完成保留撤销。

### 3.12 LinkRow

- 行：padding 7 9，1px --hairline-soft，radius 8，背景 --field-bg；图标底 22×22 radius 6 --sidebar。
- 名称 12 --ink-2；路径 10 --faint，单行省略；打开按钮 24×24；删除 24×24，hover 危险色。
- 添加区（仅编辑弹窗内）：一行两组输入 + 按钮——链接地址（占位「粘贴链接、文件夹路径或拖入文件」，必填）、标题（可选，占位「标题（可选）」，maxlength 120）+「添加」按钮；任一输入 Enter 提交；地址无法识别时 toast「不支持的链接格式…」且不清空输入；添加成功后清空并聚焦地址框。地址合法但标题为空时自动生成名称。
- 编辑态（仅编辑弹窗内）：标题与路径都是按钮（tooltip 分别为「点击编辑标题」「点击修改链接地址」），点击任一进入同一行内编辑态，同时显示「链接地址 + 标题」两个输入（地址在上、标题在下，高 22px）；地址预填当前 target、标题预填当前 display；Enter/失焦保存（两个输入之间切换焦点不提交）、Esc 取消；地址重新识别并更新左侧类型图标；地址无效时 toast 拒绝并保持编辑态；标题为空回退自动名称；仅改地址且原标题为自动名称时，标题按新地址重算，自定义标题保持不变。TaskRow 中的链接展示保持只读。
- 网页用 globe，文件夹用 folder，文件用 file；图标 12。
- 点击打开：网页默认浏览器，本地路径资源管理器；打开失败 toast“找不到该位置”，不崩溃。
- 编辑面板支持多链接、拖拽、粘贴；链接顺序可上移/下移（拖拽面板内）；链接保存为绝对路径。

### 3.13 EmptyState

- 主区空状态：padding 34 20，居中；标题衬线 16 --ink-2；正文 12 --faint；行高 1.8。
- 挂件空状态：padding 14 12 10，11px，--faint，1.6。
- 文案必须说明下一步动作（“在下面的输入框里加一条，回车就保存” / “今天没有待办”）。

## 4. 文案与图标

- 文案集中放在 src/renderer/src/i18n/zh.ts，不在组件里散落字符串。
- 图标统一 Lucide 风格 16×16，1.5px stroke，圆角端点，currentColor；组件内可 11.5–15 缩放。
- 需要的图标：inbox、sun、alert-triangle、calendar、check-circle、tag、flag、clock、folder、globe、search、sliders、plus、pin、minus、chevron-down、more-horizontal、trash、file、arrow-up、x、pencil、settings、help-circle、refresh、link、notes。
- 图标不得用 emoji 代替；不得混用两套图标线宽。

## 5. 视觉验收

### 5.1 必测尺寸

- 挂件可见卡片 352 宽、max-height 520；胶囊可见卡片 284×54；管理窗口 1100×720（min 900×600）；左栏 190；主区 padding 20 24 0。
- 桌面形态窗口 = 可见卡片 + 四周各 2px 透明留白（挂件 356 ×（内容高+4）、胶囊 288×58）。
- 编辑 460、wide 502、管理 468/424、确认 424、pop 320、日期选择器 288。
- 进度环 40/34/26；勾选框 18；composer 14 圆角；任务行主窗口 9 10 / 挂件 6 8。

### 5.2 必测状态

- 每个按钮：default / hover / active / focus / disabled。
- 任务行：default / hover / done / focus；链接 hover 下划线。
- 输入：default / focus / 多行到 110 后内部滚动 / placeholder / IME。
- 弹窗：打开/关闭/Esc/点遮罩不关/内部重绘不闪。
- 日期选择器：过去置灰/拦截/2 个快捷/键盘/Esc 只关选择器。
- 逾期：同日已过显示已逾期 N 分钟/小时；跨日显示逾期 N 天；收件箱 B 口径空状态；项目/标签删除有/无关联两条路径。
- 空状态/加载/错误 toast/撤销。
- 100% / 125% / 150% DPI 截图；reduced-motion 截图/录屏。

### 5.3 对照方式

- 当前基准：`../design/app/` 可交互页面 + 分状态截图 `../design/app-*.png`（app-manager、app-desktop、app-capsule、app-editor、app-dp-editor、app-filter、app-inbox、app-settings-manage、app-sidebar-manage-entry、app-manage、app-manage-project、app-delete-confirm、app-sidebar-overflow）；以当前页面与最新截图为准。
- 静态原型：`../design/static-prototype.html`，与当前可交互原型同步；整页长图：`../design/app-fullpage.webp`。静态页与长图用于视觉对照，不替代交互验收。
- 实现完成后在 100% 缩放、相同窗口尺寸下截图，逐项对照：
  - 颜色：与 tokens.css 一致，无纯黑/纯白/冷灰；强调色面积 < 10%。
  - 字体：标题衬线、任务 13/12.5、元信息 10.5/10；无小于 9.5px 的可读文字。
  - 间距：±1px 内；圆角/阴影与 §3 一致。
  - 状态：§5.2 每项都能在现场复现。
- 偏差 > 1px 或颜色 ΔE > 2 必须修，不得以“差不多”通过。

### 5.4 禁止清单

- 禁止原生 date/datetime-local/time 控件。
- 禁止点击遮罩关闭模态。
- 禁止系统通知。
- 禁止第二强调色、渐变装饰、玻璃拟态、彩色大背景。
- 禁止用 emoji 当图标。
- 禁止在组件里写裸 hex/rgb。
- 禁止为了“好看”加规格外动画/阴影/圆角。
- 禁止把挂件做成可缩放窗口；禁止隐藏左栏。

## 6. 实现落点

- tokens：src/renderer/src/styles/tokens.css（从 ../design/ui/tokens.css 原样复制）。
- 基础样式：src/renderer/src/styles/app.css（reset、滚动条、字体、通用工具类）。
- 组件：src/renderer/src/components/ 下按 §3 命名：Button.tsx、IconButton.tsx、TaskRow.tsx、Checkbox.tsx、Chip.tsx、Composer.tsx、ProgressRing.tsx、Popover.tsx、Modal.tsx、DateTimePicker.tsx、ManageModal.tsx、DeleteConfirm.tsx、Toast.tsx、LinkRow.tsx、EmptyState.tsx。
- 页面：Widget.tsx、Manager.tsx、Capsule.tsx、QuickAdd.tsx。
- 每个组件文件顶部注释对应的 08 章节与原型截图名；PR/提交说明必须写“UI: 08 §x 实现/验收”。
- 不允许在页面层复制组件样式；共享样式进组件或 tokens。

## 7. 变更控制

- 任何与本文冲突的实现都算缺陷，不算“设计优化”。
- 需要新增 token/组件状态时，先改 08 + tokens.css，再改实现；改完重新跑 §5。
- 用户确认过的决策（00-README 决策表）优先级高于本文；若冲突，先向用户确认，不自行改视觉。
