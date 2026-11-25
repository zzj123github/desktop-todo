# 03 · 数据模型与存储

## 1. 技术选择

- **SQLite**（better-sqlite3，同步 API 简单、事务快）；WAL 模式；单文件。
- 位置按平台：Windows `%APPDATA%\DesktopTodo\data.db`；macOS `~/Library/Application Support/DesktopTodo/data.db`（由 `src/main/db.ts` 的 `resolveDataDir()` 按 `process.platform` 选择）。同目录 `data.db-wal`、`data.db-shm`。
- 首次启动自动建库 + 迁移；不自动写入演示数据（seed 仅开发脚本用）。
- 所有写操作包事务；删除任务级联删除链接与标签关联。

## 2. 表结构（DDL）

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,              -- crypto.randomUUID()
  title        TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  status       INTEGER NOT NULL DEFAULT 0,    -- 0=待办 1=已完成
  priority     INTEGER NOT NULL DEFAULT 0,    -- 0=无 1=低 2=中 3=高
  due_at       INTEGER,                       -- epoch ms；NULL 且无项目关联 = 收件箱（见 §3）
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER,
  sort_order   REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due        ON tasks(due_at);

CREATE TABLE IF NOT EXISTS tags (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#C7A98C',
  kind  TEXT NOT NULL DEFAULT 'tag'           -- 'project' | 'tag'
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);

CREATE TABLE IF NOT EXISTS links (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,              -- 'url' | 'folder' | 'file'
  target          TEXT NOT NULL,              -- https://... / C:\... 或 \\server\share\...（win32）/ /Users/...（darwin）
  display         TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  last_checked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_links_task ON links(task_id);

CREATE TABLE IF NOT EXISTS views (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  filter_json TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                         -- JSON 值
);
```

初始 `meta.schema_version = 1`；后续迁移在 `db.ts` 内按版本顺序执行。

## 3. 枚举与字段约定

- `tasks.status`：0 待办 / 1 已完成。
- `tasks.priority`：0 无 / 1 低 / 2 中 / 3 高。
- `tasks.due_at`：一律存 UTC 毫秒；界面按本地时区渲染。
  - 「今天」= 本地当天 00:00–24:00；「明天」类似；「本周」= 本周一 00:00 到周日 24:00；「逾期」= due_at < 当前时刻且未完成（同一天已过也算）。
  - 收件箱 = `due_at IS NULL` **且**没有 `kind='project'` 的 `task_tags` 关联。只有日期无项目、或有项目无日期，都不算收件箱。删除项目后，其下无日期任务因关联被清空而自动回到收件箱。
  - 快速输入「明天 10:00」解析成明天 10:00 的本地时间再转 UTC。
- `tags.kind`：project（左栏「项目」）/ tag（左栏「标签」）；两者同一张表，避免两套结构。
- 任务归属：项目通过 `task_tags` 关联一条 `kind='project'` 的记录（应用层限制每个任务最多一个项目）；标签通过 `task_tags` 关联任意多条 `kind='tag'` 的记录。
- `sort_order`：手动排序时用（默认按 due_at、priority、created_at 排序；先实现默认排序即可，手动拖排可后置）。

## 4. 筛选条件 JSON（views.filter_json）

```json
{
  "status": "todo",
  "date": { "mode": "today" },
  "tagIds": ["uuid1", "uuid2"],
  "priorities": [3, 2],
  "keyword": "图纸"
}
```

- `status`: `"todo" | "done" | "all"`（默认 todo）。
- `date.mode`: `"any" | "today" | "tomorrow" | "week" | "overdue" | "custom"`；custom 时为 `{"mode":"custom","from":<ms>,"to":<ms>}`。
- `tagIds`：多选 OR（任务命中任一标签即匹配）。
- `priorities`：多选，空数组=不限。
- `keyword`：对 title + note 做 LIKE '%kw%'（数据量小，MVP 不用 FTS5；超过 5000 条再考虑）。

列表查询建议：一个 `listTasks(filter)` 在 SQL 层拼 WHERE（参数化），返回 tasks + 汇总 links + tags，避免 N+1。

## 5. 链接（links）

`links.target` 存平台原生字符串，数据库结构不变；**识别、规范化、默认显示名与打开方式按运行平台切换**（主进程 `src/main/opener.ts` 负责识别与打开，渲染层 `src/renderer/src/lib/parseQuick.ts` / `links.ts` 做输入预判；两处识别函数都可注入平台，单测同跑 win32 / darwin）。Windows 与 macOS 各自只接受本平台可用的目标；另一平台的路径会被判不支持并提示，不崩溃。

### 类型识别（Windows / win32）
| 输入 | kind | 打开方式 |
|------|------|----------|
| `http://` / `https://` | url | `shell.openExternal` |
| `file:///C:/...` | 先转本地路径，再按下面判断 | — |
| `C:\...`、`C:/...`、`\\server\share\...`、`/cygdrive/...`（可选） | folder/file（按 fs.stat 判断） | `shell.openPath`（资源管理器） |
| 裸域名 `wiki.company.com/...` | 自动补 `https://` → url | `shell.openExternal` |
| 其他（如 `mailto:`） | 拒绝，提示不支持 | — |

### 类型识别（macOS / darwin）
| 输入 | kind | 打开方式 |
|------|------|----------|
| `http://` / `https://` | url | `shell.openExternal` |
| 本机 `file:///...` URL（如 `file:///Users/...`、`file:///Volumes/...`；host 为空或 `localhost`） | 先 `decodeURIComponent` 转本地 POSIX 路径，再按下面判断 | `shell.openPath` |
| 绝对 POSIX 路径：以单个 `/` 开头（如 `/Users/...`、`/Volumes/...`，可含中文/空格） | folder/file（结尾分隔符优先，否则按扩展名判断） | `shell.openPath`（访达 / 默认程序） |
| 裸域名 `wiki.company.com/...` | 自动补 `https://` → url | `shell.openExternal` |
| Windows 盘符 `C:\...`、UNC `\\server\share\...`、`/cygdrive/...`、`file:///C:/...` | 拒绝（unsupported；界面提示不支持的链接格式） | — |
| 相对路径、`%ENV%`、`mailto:` 等非 http(s) 协议、非本机 file URL（`file://server/share/...`） | 拒绝（unsupported） | — |
| `javascript:` / `data:` / `vbscript:` / `cmd:` / `powershell:` 等危险协议 | 拒绝（blocked） | — |

两平台共有：只允许 http/https 与当前平台的绝对本地路径；危险协议一律 blocked；相对路径、环境变量与非 http(s) 协议一律 unsupported。

### 路径规范
- 两平台共有：保存前去首尾空白与成对引号（中英文引号）；不做相对路径（工作目录不固定）；不展开环境变量（`%USERPROFILE%` 不识别，提示用户给绝对路径）；默认显示名：文件夹/文件的 basename（去扩展名），网页取 hostname。
- Windows：`path.win32.normalize` 统一反斜杠；保留 UNC；`/cygdrive/...` 可转为盘符路径（可选）。
- macOS：`path.posix.normalize` 保留正斜杠；绝对路径必须以单个 `/` 开头（`//server/share`、`/cygdrive/...` 按 Windows 语义判不支持）；本机 `file:///...` 先 `decodeURIComponent` 为本地路径再按上述规则处理；macOS 无 UNC 概念，相关界面文案按平台切换。
- 拖拽：Windows 资源管理器 / macOS Finder 拖入文件或文件夹 → 自动生成当前平台的绝对路径链接；拖入网址 → 网页链接。macOS 真实 Finder 拖拽未人工验证（见 README 已知限制）。
- 快速输入（Composer）：macOS 下「整行只有一个本地路径」会识别为链接；行内混排文本里的 POSIX 路径不会自动拆出，需单独粘贴或走编辑弹窗。

### 失效处理
1. 点击链接 → 主进程异步 `fs.promises.access`（本地路径统一 800ms 超时；Windows 的 UNC 同样适用）。
2. 不存在 → 返回 `{ok:false, reason:'missing', target}`；渲染层 toast：「找不到该位置」+「重新选择」（文件/文件夹选择器，回填 target）+「删除链接」。
3. `shell.openPath` 返回非空错误字符串（如没有关联程序）→ toast 原文，不崩溃。
4. 每次成功打开更新 `last_checked_at`。

## 6. 设置键（settings）

| key | 默认 | 说明 |
|-----|------|------|
| `alwaysOnTop` | true | 挂件置顶 |
| `opacity` | 1 | 挂件非焦点透明度：1 / 0.9 / 0.8 |
| `launchAtLogin` | false | 开机自启（对应系统登录项） |
| `globalShortcuts` | true | 全局快捷键开关 |
| `lastViewId` | null | 上次视图（内置视图 id 或 saved view id） |
| `widgetBounds` | null | `{x,y,width,height,displayId}` |
| `managerBounds` | null | 同上 |
| `capsule` | false | 是否收起为胶囊 |

## 7. 备份 / 导出

- 导出 JSON（设置里触发）：
```json
{ "version": 1, "exportedAt": 1760000000000,
  "tasks": [ { "id": "...", "title": "...", "note": "", "status": 0, "priority": 2,
               "dueAt": 1760000000000, "createdAt": 0, "updatedAt": 0,
               "tags": ["项目A"], "links": [{"kind":"folder","target":"C:\\...","display":"..."}] } ],
  "views": [ { "name": "采购本周", "filter": { } } ],
  "settings": { } }
```
- 示例中的 `target` 为 Windows 形式；macOS 导出为 `/Users/...` 这类 POSIX 路径字符串，字段结构与 JSON 结构完全相同（见 §5）。
- 导入：校验 version → 事务内清空并重建（导入前 UI 明确提示覆盖）；导入后刷新所有窗口。
- 备份建议：程序退出前 `PRAGMA wal_checkpoint(TRUNCATE)`；设置里提供「打开数据目录」让用户自行复制 db。

## 8. 演示 seed（与原型一致）

见 `resources/seed.json`：6 条任务（4 待办 + 2 已完成）、3 个项目、2 个标签、每条任务 1–2 个链接。仅用于开发时首屏对照原型截图，**不要**打进正式版首次启动。
