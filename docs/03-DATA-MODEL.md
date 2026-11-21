# 03 · 数据模型与存储

## 1. 技术选择

- **SQLite**（better-sqlite3，同步 API 简单、事务快）；WAL 模式；单文件。
- 位置：`%APPDATA%\DesktopTodo\data.db`；同目录 `data.db-wal`、`data.db-shm`。
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
  target          TEXT NOT NULL,              -- https://... 或 C:\... 或 \\server\share\...
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

### 类型识别
| 输入 | kind | 打开方式 |
|------|------|----------|
| `http://` / `https://` | url | `shell.openExternal` |
| `file:///C:/...` | 先转本地路径，再按下面判断 | — |
| `C:\...`、`C:/...`、`\\server\share\...`、`/cygdrive/...`（可选） | folder/file（按 fs.stat 判断） | `shell.openPath`（资源管理器） |
| 裸域名 `wiki.company.com/...` | 自动补 `https://` → url | `shell.openExternal` |
| 其他（如 `mailto:`） | 拒绝，提示不支持 | — |

### 路径规范
- 保存前 `path.normalize`，统一反斜杠；去首尾引号/空白；保留 UNC；不展开环境变量（`%USERPROFILE%` 不识别，提示用户给绝对路径）。
- 显示名默认：文件夹/文件的 basename（去扩展名），网页取 hostname。
- 不做相对路径（工作目录不固定）。

### 失效处理
1. 点击链接 → 主进程异步 `fs.promises.access`（UNC 加 800ms 超时）。
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
- 导入：校验 version → 事务内清空并重建（导入前 UI 明确提示覆盖）；导入后刷新所有窗口。
- 备份建议：程序退出前 `PRAGMA wal_checkpoint(TRUNCATE)`；设置里提供「打开数据目录」让用户自行复制 db。

## 8. 演示 seed（与原型一致）

见 `resources/seed.json`：6 条任务（4 待办 + 2 已完成）、3 个项目、2 个标签、每条任务 1–2 个链接。仅用于开发时首屏对照原型截图，**不要**打进正式版首次启动。
