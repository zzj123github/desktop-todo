# 04 · 技术方案与实现细节

## 1. 技术栈

| 层 | 选择 | 理由 |
|----|------|------|
| 壳 | **Electron 32+**（Windows x64） | 三窗口、托盘、全局快捷键、开机自启、shell 打开路径/浏览器都成熟 |
| 构建 | Vite 5 + TypeScript | 渲染层快；主进程用 esbuild/tsup 或 electron-vite |
| UI | React 18 + 手写 CSS（唯一 token 来源 ../design/ui/tokens.css） | 原型已是 HTML/CSS，直接迁移；禁止 Tailwind/CSS-in-JS，组件按 08 实现 |
| 数据 | better-sqlite3 | 本地单文件、事务简单、性能足够 |
| 打包 | electron-builder | portable exe + NSIS 安装包；无需签名 |
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
│  └─ tray.ico
├─ src/
│  ├─ main/
│  │  ├─ index.ts           # app 生命周期、单实例锁、--silent 启动
│  │  ├─ windows.ts         # widget / manager / capsule / quickadd 窗口
│  │  ├─ tray.ts            # 托盘菜单
│  │  ├─ shortcuts.ts       # globalShortcut 注册/注销
│  │  ├─ login.ts           # app.setLoginItemSettings
│  │  ├─ db.ts              # SQLite 连接、迁移、事务
│  │  ├─ repo/
│  │  │  ├─ tasks.ts        # list / create / update / toggle / delete
│  │  │  ├─ tags.ts
│  │  │  ├─ links.ts
│  │  │  └─ views.ts
│  │  ├─ opener.ts          # 安全打开网页/路径、存在性校验（含 UNC 超时）
│  │  ├─ settings.ts        # settings 表 + 窗口 bounds 记忆
│  │  ├─ ipc.ts             # 注册所有 ipcMain.handle
│  │  └─ filterSql.ts       # filter JSON → WHERE 子句
│  ├─ preload/
│  │  └─ index.ts           # contextBridge 白名单 API
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
│     │  ├─ i18n/zh.ts      # 文案集中（先只有中文）
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
- 挂件：`skipTaskbar:true`、`alwaysOnTop:'floating'`（默认）、`setVisibleOnAllWorkspaces(false)`。
- 挂件置顶切换：`win.setAlwaysOnTop(on, 'floating')`。
- 透明度：非焦点时 `win.setOpacity(0.9)`（仅 Windows；配合 blur/focus 事件）。

### 3.2 拖动
- 挂件顶部 36px 区域：CSS `-webkit-app-region: drag`；按钮/交互元素设 `no-drag`。
- 位置保存：`move`/`resize` 事件防抖 300ms 后写 settings；用 `screen.getDisplayMatching(bounds)` 记录 displayId。
- 恢复/拔插：`screen.getAllDisplays()` 找到记录显示器；找不到则夹到主屏工作区 `workArea` 内。

### 3.3 三窗口协作
- 同一份数据：所有窗口 `webContents.send('tasks:changed')` 后各自重查；或主进程广播 `{type:'tasks:changed'}`。
- 挂件 → 完整窗口：双击挂件空白 / 点「展开」→ `manager.show()`。
- 挂件 ⇄ 胶囊：同一 BrowserWindow 内切换 React 路由（推荐，省一个窗口）或两个窗口切换显示。推荐**同一窗口切换视图**，高度动画 250ms。
- QuickAdd：全局快捷键弹出一个 520×? 的小窗（居中，无边框，输入回车后关闭）；也可复用挂件输入框聚焦。MVP 可先只实现「唤起挂件并聚焦输入框」，成本更低。

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
（旧写法 `(f as any).path` 在 Electron 32 已移除，别用。）

### 5.3 开机自启
```ts
app.setLoginItemSettings({
  openAtLogin: enabled,
  path: process.execPath,
  args: ['--silent'],        // 开机启动时不弹窗口，只进托盘
});
```
读取：`app.getLoginItemSettings().openAtLogin`。默认 false；设置项变化时同步。

### 5.4 单实例 + 开机静默
```ts
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWidget());
const silent = process.argv.includes('--silent');
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

### 5.6 全局快捷键
```ts
globalShortcut.register('CommandOrControl+Shift+Space', quickAdd);
globalShortcut.register('Alt+H', toggleWidget);
for (let i = 0; i < 5; i++) globalShortcut.register(`Alt+${i + 1}`, () => setView(i));
```
注册失败（被占用）时提示用户，不静默。

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
