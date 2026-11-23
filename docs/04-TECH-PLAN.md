# 04 · 技术方案与实现细节

## 1. 技术栈

| 层 | 选择 | 理由 |
|----|------|------|
| 壳 | **Electron 32+**（Windows x64 / macOS arm64，实际固定 `40.10.2`） | 三窗口、托盘/菜单栏、全局快捷键、登录时启动、shell 打开路径/浏览器都成熟 |
| 构建 | Vite 5 + TypeScript | 渲染层快；主进程用 esbuild/tsup 或 electron-vite |
| UI | React 18 + 手写 CSS（唯一 token 来源 ../design/ui/tokens.css） | 原型已是 HTML/CSS，直接迁移；禁止 Tailwind/CSS-in-JS，组件按 08 实现 |
| 数据 | better-sqlite3 | 本地单文件、事务简单、性能足够 |
| 打包 | electron-builder | Windows portable exe + NSIS 安装包；macOS dmg（仅 Apple 芯片 arm64）；均不签名 |
| 测试 | Vitest（单元）+ 手工冒烟 | repo/筛选/链接识别可单测 |

建议脚手架：`electron-vite`（main/preload/renderer 三端一体），或 `electron-forge + vite`。用 pnpm 管理。

## 2. 目录结构

> 目录与工程边界的完整规范见 [09-PROJECT-STRUCTURE.md](09-PROJECT-STRUCTURE.md)；本节是实施树摘要，冲突以 09 为准。

```
desktop-todo/
├─ package.json
├─ electron.vite.config.ts
├─ tsconfig.json
├─ electron-builder.yml
├─ build/
│  ├─ icon.ico
│  ├─ icon.png             # macOS 应用图标源（1024）
│  ├─ tray.ico
│  ├─ trayTemplate.png     # macOS 菜单栏模板图标 1x
│  └─ trayTemplate@2x.png
├─ src/
│  ├─ main/
│  │  ├─ index.ts           # app 生命周期、单实例锁、--silent 启动
│  │  ├─ windows.ts         # widget / manager / capsule / quickadd 窗口
│  │  ├─ app-menu.ts        # macOS 应用菜单（桌面待办/编辑/窗口），非 darwin no-op
│  │  ├─ macos.ts           # macOS Dock / 激活封装，非 darwin no-op
│  │  ├─ tray.ts            # 托盘 / 菜单栏图标
│  │  ├─ tray-menu.ts       # 托盘/菜单栏菜单模板（纯函数，平台文案）
│  │  ├─ shortcuts.ts       # globalShortcut 注册/注销
│  │  ├─ login.ts           # app.setLoginItemSettings
│  │  ├─ db.ts              # SQLite 连接、迁移、事务
│  │  ├─ repo/
│  │  │  ├─ tasks.ts        # list / create / update / toggle / delete
│  │  │  ├─ tags.ts
│  │  │  ├─ links.ts
│  │  │  └─ views.ts
│  │  ├─ opener.ts          # 安全打开网页/路径、存在性校验（win32 含 UNC 超时；darwin POSIX 路径）
│  │  ├─ settings.ts        # settings 表 + 窗口 bounds 记忆
│  │  ├─ ipc.ts             # 注册所有 ipcMain.handle
│  │  └─ filterSql.ts       # filter JSON → WHERE 子句
│  ├─ preload/
│  │  └─ index.ts           # contextBridge 白名单 API（含 platform）
│  └─ renderer/
│     ├─ index.html
│     ├─ quickadd.html
│     ├─ src/
│     │  ├─ main.tsx
│     │  ├─ app/Widget.tsx / Manager.tsx / Capsule.tsx / QuickAdd.tsx
│     │  ├─ components/ (Button, IconButton, TaskRow, Checkbox, Chip,
│     │  │               Composer, ProgressRing, Popover, Modal, DateTimePicker,
│     │  │               ManageModal, DeleteConfirm, Toast, LinkRow, EmptyState)
│     │  ├─ hooks/useTasks.ts useFilter.ts useSettings.ts
│     │  ├─ i18n/zh.ts      # 文案集中（先只有中文；macOS 文案按平台切换）
│     │  ├─ lib/platform.ts # 平台快照（macOS 文案/路径判定；非 Electron 回退 win32）
│     │  └─ styles/ tokens.css app.css
├─ resources/seed.json
└─ scripts/seed.ts
```

UI 实现契约：所有组件、尺寸、状态矩阵、浮层层级以 [08-UI-ENGINEERING-SPEC.md](08-UI-ENGINEERING-SPEC.md) 为准；tokens 必须从 ../design/ui/tokens.css 原样复制到 src/renderer/src/styles/tokens.css，禁止在组件里写裸 hex/rgb。02 只保留设计意图。

## 3. 窗口

### 3.1 通用配置
```ts
new BrowserWindow({
  // 可见卡片 352×≤520；窗口四周各留 2px 透明边（高 = 内容高 + 4），避免高 DPI 下边缘被裁切
  width: 356, height: 424, frame: false, transparent: true,
  resizable: false, maximizable: false, minimizable: true,
  skipTaskbar: true, alwaysOnTop: true, hasShadow: false,
  roundedCorners: false, backgroundColor: '#00000000',
  webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true,
                    preload: join(__dirname, '../preload/index.js') },
})
```
- 完整窗口：`frame:false` + 自绘顶部拖拽条，`resizable:true`，`skipTaskbar:false`。
- 退出生命周期（2026-11-22，用户 m07685）：`before-quit` 只置退出标志、flush 窗口位置、清理提示队列与启动定时器；`will-quit` 在窗口全部关闭后再 checkpoint / closeDatabase、释放快捷键、销毁托盘。窗口加载 Promise、文件对话框 Promise、focus/blur 与 bounds 防抖在退出阶段一律静默；未捕获异常 / 未处理 Promise 拒绝写入 `userData/logs/main.log`，退出阶段只记录不弹原生错误框。
- 挂件：`skipTaskbar:true`、`alwaysOnTop:'floating'`（默认）、`setVisibleOnAllWorkspaces(false)`。
- 挂件置顶切换：`win.setAlwaysOnTop(on, 'floating')`。
- 透明度：非焦点时 `win.setOpacity(0.9)`（Windows 与 macOS 均支持；配合 blur/focus 事件）。
- macOS：挂件/胶囊/编辑/提示窗口同样是透明无边框 + `alwaysOnTop:'floating'`；完整窗口无边框、关闭即收起。`app.disableHardwareAcceleration()` 只在 `process.platform === 'win32'` 调用（`applyRenderingPolicy()`），macOS 保留 Electron 默认的硬件合成，Windows 的内存结论不迁移到 macOS。

### 3.2 拖动
- 挂件顶部 36px 区域：CSS `-webkit-app-region: drag`；按钮/交互元素设 `no-drag`。
- 位置保存：`move`/`resize` 事件防抖 300ms 后写 settings；用 `screen.getDisplayMatching(bounds)` 记录 displayId。
- 恢复/拔插：`screen.getAllDisplays()` 找到记录显示器；找不到则夹到主屏工作区 `workArea` 内。

### 3.3 三窗口协作
- 同一份数据：所有窗口 `webContents.send('tasks:changed')` 后各自重查；或主进程广播 `{type:'tasks:changed'}`。
- 挂件 → 完整窗口：双击挂件空白 / 点「展开」→ `manager.show()`。
- 挂件 ⇄ 胶囊：同一 BrowserWindow 内切换 React 路由（推荐，省一个窗口）或两个窗口切换显示。推荐**同一窗口切换视图**，高度动画 250ms。
- QuickAdd：全局快捷键弹出一个 520×? 的小窗（居中，无边框，输入回车后关闭）；也可复用挂件输入框聚焦。MVP 可先只实现「唤起挂件并聚焦输入框」，成本更低。

### 3.4 macOS 平台差异（应用菜单 / Dock / 激活）

- 应用菜单：`installApplicationMenu()`（`src/main/app-menu.ts`）仅在 `process.platform === 'darwin'` 执行，设置「桌面待办 / 编辑 / 窗口」三个菜单。「编辑」菜单提供 undo/redo/cut/copy/paste/selectAll 的 role，这是输入框里 ⌘C/⌘V/⌘A/⌘Z 生效的前提；同时提供 ⌘Q/⌘W/⌘M 与「关于/隐藏」等标准项。Windows 不设置应用菜单，保持无边框自绘界面与 Ctrl 快捷键。
- Dock：默认 `app.dock.hide()`（只留桌面形态 + 菜单栏图标）；打开完整窗口时 `app.dock.show()` 并激活应用（可 ⌘+Tab 切回）；完整窗口隐藏/收起后再次隐藏 Dock。实现集中在 `src/main/macos.ts`，非 darwin 平台全是 no-op。
- 激活：从菜单栏图标、全局快捷键唤起窗口前调用 `app.focus({ steal: true })`，否则窗口会显示但收不到键盘输入。
- 窗口行为不变：挂件/胶囊/编辑/提示窗口仍为透明无边框 + `alwaysOnTop:'floating'`；完整窗口关闭仍走「隐藏」语义（拦截 `close`），应用不退出，退出只从菜单栏菜单或应用菜单。

## 4. IPC 契约（preload 白名单）

| 通道 | 入参 | 返回 |
|------|------|------|
| `tasks:list` | `{ filter: Filter, viewId?: string }` | `TaskDTO[]` |
| `tasks:create` | `{ title, note?, priority?, dueAt?, tagIds?, links? }` | `TaskDTO` |
| `tasks:update` | `{ id, patch }` | `TaskDTO` |
| `tasks:toggle` | `{ id, done: boolean }` | `TaskDTO` |
| `tasks:delete` | `{ id }` | `{ ok: true }` |
| `links:add` | `{ taskId, target, display? }` | `LinkDTO`（类型由主进程识别） |
| `links:remove` | `{ id }` | `{ ok: true }` |
| `links:open` | `{ id }` 或 `{ target, kind }` | `{ ok, error?, reason? }` |
| `links:relocate` | `{ id }` | 弹文件选择器 → 新 target |
| `tags:list` | — | `{ tags, projects }` |
| `views:list/save/delete` | — | `SavedView[]` |
| `settings:get` | `{ key }` | JSON 值 |
| `settings:set` | `{ key, value }` | `{ ok }` |
| `app:showManager` / `app:toggleWidget` / `app:quit` | — | — |
| `app:exportData` / `app:importData` | — | `{ ok, path? }` |

事件（主进程 → 渲染）：`tasks:changed`、`settings:changed`、`widget:collapsed`。

## 5. 关键实现片段

### 5.1 安全打开链接（opener.ts）
```ts
import { shell } from 'electron';
import fs from 'node:fs/promises';

const URL_RE = /^https?:\/\//i;

export async function openTarget(target: string): Promise<OpenResult> {
  const t = target.trim().replace(/^["']|["']$/g, '');
  if (URL_RE.test(t)) {
    await shell.openExternal(t);                       // 仅 http/https
    return { ok: true };
  }
  if (/^file:\/\//i.test(t)) return { ok: false, reason: 'unsupported' };
  if (/^(javascript|data|vbscript|cmd|powershell):/i.test(t)) return { ok: false, reason: 'blocked' };
  const p = t.replace(/\//g, '\\');
  try {
    await withTimeout(fs.access(p), 800);
  } catch {
    return { ok: false, reason: 'missing', target: p };
  }
  const err = await shell.openPath(p);                 // 文件夹→资源管理器，文件→默认程序
  return err ? { ok: false, reason: 'shell', error: err } : { ok: true };
}
```

平台口径（macOS）：以上为 Windows 识别/打开流程；macOS 走 POSIX 分支——绝对 `/...` 路径直接按 POSIX 规范化，本机 `file:///` URL 先 `decodeURIComponent` 成本地路径再判断，用 `path.posix.normalize` 保留正斜杠；Windows 盘符/UNC 在 macOS 判 unsupported，危险协议同样 blocked。完整规则见 [03-DATA-MODEL.md](03-DATA-MODEL.md) §5；实现 `opener.ts` 的识别函数支持注入平台，win32 / darwin 两个分支都有单测。

### 5.2 拖拽拿到真实路径（Electron 32+）
preload：
```ts
import { webUtils } from 'electron';
contextBridge.exposeInMainWorld('api', {
  getPathForFile: (f: File) => webUtils.getPathForFile(f),
  // ...
});
```
渲染层 drop：
```ts
for (const f of e.dataTransfer.files) {
  const p = window.api.getPathForFile(f);   // 绝对路径（含 UNC）
  addLink(p);
}
const uri = e.dataTransfer.getData('text/uri-list');
if (uri) addLink(uri);
```
（旧写法 `(f as any).path` 在 Electron 32 已移除，别用。）macOS 从 Finder 拖入文件/文件夹同样经 `webUtils.getPathForFile` 得到绝对 POSIX 路径（真实 Finder 拖拽未人工验证）。

### 5.3 开机自启 / 登录时启动

两平台都走 `app.setLoginItemSettings`，但 macOS 登录项不能传启动参数（`path`/`args` 仅 Windows 生效），静默启动的判定不同：

**Windows**：登录项带 `--silent`，启动后只进托盘、不弹挂件。
```ts
app.setLoginItemSettings({
  openAtLogin: enabled,
  path: process.execPath,
  args: ['--silent'],        // 开机启动时不弹窗口，只进托盘
});
```

**macOS**：只设 `openAtLogin`（`openAsHidden` 仅 macOS 12 及更早可用，13+ 由系统 SMAppService 管理、字段被忽略）；启动时读 `wasOpenedAtLogin` 判断是否由登录项拉起，是则只显示菜单栏图标、不弹挂件。
```ts
app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: enabled }); // macOS
const launchedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin;
const silent = process.argv.includes('--silent') || launchedAtLogin;       // 两种静默启动合并判断
```

读取 `app.getLoginItemSettings().openAtLogin` 作为勾选态；默认 false；设置项变化时系统项 + `settings.launchAtLogin` 双写并广播。macOS 登录项在未签名应用或不在 `/Applications` 运行时可能注册失败，见 §7 风险表（可引导用户在「系统设置 → 通用 → 登录项」手动添加）。

### 5.4 单实例 + 开机静默
```ts
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWidget());
const silent = process.argv.includes('--silent') || wasLaunchedAtLogin(); // 后者为 macOS 登录项拉起
app.whenReady().then(() => { createWindows(silent); });
```

### 5.5 托盘
```ts
new Tray(join(__dirname, '../../build/tray.ico'));
tray.setToolTip('桌面待办 · 今天 4 项');
tray.setContextMenu(Menu.buildFromTemplate([
  { label: '显示 / 隐藏挂件', click: toggleWidget },
  { label: '快速添加', click: quickAdd },
  { label: '打开完整窗口', click: showManager },
  { type: 'separator' },
  { label: '开机自启', type: 'checkbox', checked: loginEnabled, click: toggleLogin },
  { type: 'separator' },
  { label: '退出', click: () => app.quit() },
]));
```
关闭窗口拦截：`win.on('close', e => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } })`。

**macOS（菜单栏）**：
- 图标用菜单栏模板图 `build/trayTemplate.png`（+ `trayTemplate@2x.png`），黑 + alpha，`nativeImage.setTemplateImage(true)` 后由系统按菜单栏深浅色自动着色；打包时经 `extraResources` 复制到 `process.resourcesPath`，dev 态读仓库 `build/`。
- 左键单击直接弹出菜单（macOS 菜单栏应用惯用交互，没有双击语义，`setIgnoreDoubleClickEvents(true)`）：显示/隐藏挂件、快速添加、打开完整窗口、登录时启动（勾选项）、退出桌面待办；菜单内容在任务写操作与每分钟定时器里用 `setContextMenu` 刷新勾选态/显隐文案。
- 菜单模板是纯函数 `src/main/tray-menu.ts`（可注入 platform），Windows/macOS 文案差异（「开机自启」↔「登录时启动」、「退出」↔「退出桌面待办」）都集中在这里，便于单测。

### 5.6 全局快捷键
```ts
globalShortcut.register('CommandOrControl+Shift+Space', quickAdd);
globalShortcut.register('Alt+H', toggleWidget);
for (let i = 0; i < 5; i++) globalShortcut.register(`Alt+${i + 1}`, () => setView(i));
```
注册键名两平台一致（`CommandOrControl` 在 macOS 映射为 ⌘，`Alt` 映射为 ⌥）；macOS 界面文案显示 `⌘⇧Space`、`⌥H`、`⌥1–5`，Windows 显示 `Ctrl+Shift+Space`、`Alt+H`、`Alt+1–5`。注册失败（被占用）时提示用户，不静默。

### 5.7 查询与筛选（filterSql.ts）
```ts
function buildWhere(f: Filter): { sql: string; params: any[] } {
  const w = ['1=1']; const p: any[] = [];
  if (f.status === 'todo') w.push('t.status = 0');
  if (f.status === 'done') w.push('t.status = 1');
  if (f.date?.mode === 'today')   { w.push('t.due_at >= ? AND t.due_at < ?'); p.push(startOfToday(), startOfTomorrow()); }
  if (f.date?.mode === 'overdue') { w.push('t.status = 0 AND t.due_at < ?'); p.push(startOfToday()); }
  if (f.tagIds?.length) {
    w.push(`EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id IN (${f.tagIds.map(() => '?').join(',')}))`);
    p.push(...f.tagIds);
  }
  if (f.priorities?.length) {
    w.push(`t.priority IN (${f.priorities.map(() => '?').join(',')})`); p.push(...f.priorities);
  }
  if (f.keyword) { w.push('(t.title LIKE ? OR t.note LIKE ?)'); p.push(`%${f.keyword}%`, `%${f.keyword}%`); }
  return { sql: w.join(' AND '), params: p };
}
```
排序：`ORDER BY (t.due_at IS NULL), t.due_at ASC, t.priority DESC, t.created_at ASC`。

### 5.8 渲染层数据流
- 建议一个 `useTasks(filter)` hook：`useEffect` 调 `tasks:list`，监听 `tasks:changed` 重新拉取。
- 挂件与完整窗口独立进程/组件，靠广播同步；不要各自维护长期缓存。
- 动效用 CSS transition/animation + 少量 Web Animations API；列表增删用 `framer-motion` 可选，但手写也够。

## 6. 打包

```yaml
# electron-builder.yml
appId: com.lazasons.desktop-todo
productName: 桌面待办
directories: { output: release }
files: [ "out/**", "package.json" ]
asar: true
asarUnpack: [ "**/node_modules/better-sqlite3/**" ]
win:
  target: [ { target: portable, arch: [x64] }, { target: nsis, arch: [x64] } ]
  icon: build/icon.ico
portable:
  artifactName: 桌面待办-${version}-portable.exe
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  artifactName: 桌面待办-${version}-setup.exe
```
注意：
- better-sqlite3 是原生模块，必须 `@electron/rebuild` 或 electron-builder 自动 rebuild；打包时 asarUnpack。
- 未签名 exe 首次运行会触发 SmartScreen「Windows 已保护你的电脑」→ README 写明「更多信息 → 仍要运行」。
- 体积约 90–120MB（Electron 成本）。

### macOS 打包（dmg）

```yaml
# electron-builder.yml（macOS 段节选，实际以仓库文件为准）
mac:
  icon: build/icon.png                 # 1024 macOS 图标源（scripts/make-icons.py 生成）
  category: public.app-category.productivity
  darkModeSupport: true
  hardenedRuntime: false
  gatekeeperAssess: false
  extendInfo:
    NSHighResolutionCapable: true
  target:
    - target: dmg
      arch:
        - arm64
  artifactName: DesktopTodo-${version}-${arch}.dmg
dmg:
  sign: false
  window: { width: 540, height: 380 }
  contents:
    - { x: 140, y: 190 }               # 桌面待办.app
    - { x: 400, y: 190, type: link, path: /Applications }
```

- 入口与命令：`pnpm dist:mac` 只打 Apple 芯片（arm64）dmg；`node scripts/dist-mac.cjs --dir` 只出解包目录 `release/mac-arm64/`、不生成 dmg（调试用）；只能在 macOS 上执行（dmg 依赖 `hdiutil`）；产物 `release/DesktopTodo-<version>-arm64.dmg`。
- 按架构预编译原生模块：配置为 `npmRebuild: false`，一个 better-sqlite3 `.node` 只对应一个架构；`scripts/dist-mac.cjs` 打包前先跑 `python3 scripts/fetch-native-assets.py --skip-electron --arch arm64` 覆盖 `.node`，再 `electron-builder --mac --arm64 --publish never`。macOS 仅支持 Apple 芯片（arm64），不构建 x64 包、不提供 Rosetta 运行说明。
- 未签名、未公证（与 Windows 交付一致）：首次打开会被 Gatekeeper 拦截，README 写明「右键 → 打开」或「系统设置 → 隐私与安全性 → 仍要打开」；不配置公证。
- 体积（本次实测）：arm64 dmg 120,670,172 B（115.1 MiB）。
- 托盘/菜单栏图标经 `extraResources` 复制 `build/tray.ico`、`build/trayTemplate.png`、`build/trayTemplate@2x.png` 到 `process.resourcesPath`；原生模块 `asarUnpack: '**/*.node'`。
- CI：`.github/workflows/release.yml` 的 `build-mac` 在 `macos-latest` 上跑类型检查 + 单测 + `node scripts/dist-mac.cjs` 打 arm64 dmg 并上传 Release，Release 说明只提 Apple 芯片；`release-notes` 汇总两个平台后统一写 Release 说明（`build-win` 保持不变）。该 macOS 作业本次未实际运行验证。

## 7. 风险与规避

| 风险 | 规避 |
|------|------|
| better-sqlite3 ABI 不匹配 | 用 electron-builder 自动 rebuild；CI/本机固定 Electron 版本 |
| Electron 32 拖拽 path 移除 | 用 `webUtils.getPathForFile`（见 5.2） |
| UNC 打开卡顿 | access 加 800ms 超时，异步；不阻塞 UI |
| 杀软误报 | 便携版 + 不写启动项（自启走登录项，非注册表 Run 由用户开）；文档说明 |
| 窗口拖出屏幕消失 | 启动/显示器变化时 clamp 到 workArea |
| 挂件遮挡操作 | 支持透明度 90/80%、可拖走、可收起胶囊、置顶可关 |
| 数据丢失 | WAL + 退出前 checkpoint；提供导出备份；异常时自动 .bak |
| 中文衬线字体缺失 | 字体回退链：Noto Serif SC → Source Han Serif SC → SimSun；不强制打包大字体 |
| macOS 未签名/未公证被 Gatekeeper 拦截 | README 写明右键「打开」/「系统设置 → 隐私与安全性 → 仍要打开」；与 Windows 一致不做签名与公证 |
| 一个 better-sqlite3 `.node` 只对应一个架构 | `scripts/dist-mac.cjs` 打包前按 arm64 取预编译 `.node` 再打包；当前 macOS 只出 arm64，禁止一次打包塞入其它架构的 `.node` |
| macOS 登录项在未签名应用或非 `/Applications` 位置注册失败 | 系统项 + settings 双写、启动时对账；托盘/设置文案用「登录时启动」，失败时可引导「系统设置 → 通用 → 登录项」手动添加；真实安装场景未验证 |
| Intel 芯片 Mac 不在支持范围 | README / PRD 明示 macOS 只支持 Apple 芯片（arm64），不提供 x64 包、不再验证 Rosetta 2 运行 |
| macOS 菜单栏图标视觉、多显示器/Spaces、真实 Finder 拖拽未人工验证 | 标为待人工验收；自动化覆盖安装后 CDP 全量 UI 审计 74 项（arm64） |
| macOS 保留硬件合成，Windows 内存结论不迁移 | 关闭硬件加速只在 win32 生效；macOS 不套用 Windows 内存指标（`DESKTOP_TODO_GPU` 在 macOS 无额外效果，默认已是硬件合成） |
