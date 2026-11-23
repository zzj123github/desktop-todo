/**
 * db · SQLite 连接、WAL、schema 迁移、事务、损坏库恢复、导出/导入
 * Contract: docs/03-DATA-MODEL.md §1–§7 · docs/09-PROJECT-STRUCTURE.md §2.2
 *
 * 约定：
 * - 只有本文件与 repo/ 允许出现 SQL；
 * - 默认库位 %APPDATA%\DesktopTodo\data.db（macOS 为 ~/Library/Application Support/DesktopTodo/data.db）；
 *   env DESKTOP_TODO_DATA_DIR / DESKTOP_TODO_DB 覆盖；
 * - 打开失败时把损坏文件重命名 data.db.bak 后重建，并暴露 dbHealthy / dbError；
 * - 不依赖 electron，可在 Electron-as-node 下被单测直接使用。
 */
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizeFilter, type NormalizedFilter } from './filterSql'

export type SqliteDatabase = InstanceType<typeof Database>

export const DB_FILE_NAME = 'data.db'
export const SCHEMA_VERSION = 1

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  status       INTEGER NOT NULL DEFAULT 0,
  priority     INTEGER NOT NULL DEFAULT 0,
  due_at       INTEGER,
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
  kind  TEXT NOT NULL DEFAULT 'tag'
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
  kind            TEXT NOT NULL,
  target          TEXT NOT NULL,
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
  value TEXT NOT NULL
);
`

let connection: SqliteDatabase | null = null
let currentDbPath = ''
let currentDataDir = ''
let lastError: string | undefined
let healthy = false

export interface OpenDatabaseResult {
  db: SqliteDatabase | null
  healthy: boolean
  error?: string
  dbPath: string
  dataDir: string
}

export interface OpenDatabaseOptions {
  /** 完整 DB 路径；传 ':memory:' 用于单测 */
  dbPath?: string
  /** 数据目录；默认按平台约定（Windows %APPDATA%\DesktopTodo / macOS ~/Library/Application Support/DesktopTodo） */
  dataDir?: string
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isMemoryPath(dbPath: string): boolean {
  return dbPath === ':memory:'
}

/**
 * 数据目录：env DESKTOP_TODO_DATA_DIR 优先，否则按平台约定：
 * - Windows：%APPDATA%\DesktopTodo
 * - macOS：~/Library/Application Support/DesktopTodo
 * - 其他：~/.config/DesktopTodo
 */
export function resolveDataDir(): string {
  const override = process.env['DESKTOP_TODO_DATA_DIR']
  if (override && override.trim()) return path.resolve(override.trim())
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'DesktopTodo')
  }
  const appData =
    process.env['APPDATA'] ||
    (process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'))
  return path.join(appData, 'DesktopTodo')
}

/** DB 路径：env DESKTOP_TODO_DB 优先；支持 ':memory:' */
export function resolveDbPath(dataDir: string = resolveDataDir()): string {
  const override = process.env['DESKTOP_TODO_DB']
  if (override && override.trim()) {
    const value = override.trim()
    return isMemoryPath(value) ? value : path.resolve(value)
  }
  return path.join(dataDir, DB_FILE_NAME)
}

function configureDatabase(db: SqliteDatabase): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 5000')
}

function migrate(db: SqliteDatabase): void {
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);')
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined
  const version = row ? Number(row.value) : 0
  if (version > SCHEMA_VERSION) {
    throw new Error(`数据库版本 ${version} 高于当前应用支持的版本 ${SCHEMA_VERSION}`)
  }
  if (version < 1) {
    db.exec(BASE_SCHEMA)
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(
      String(SCHEMA_VERSION)
    )
  }
  // 后续迁移：在 version < 2 等分支内按版本顺序追加，并更新 meta.schema_version
}

function assertDatabaseReadable(db: SqliteDatabase): void {
  const result = db.pragma('quick_check', { simple: true })
  if (result !== 'ok') throw new Error(`数据库完整性检查失败：${String(result)}`)
}

function openFile(dbPath: string): SqliteDatabase {
  const db = new Database(dbPath)
  try {
    configureDatabase(db)
    migrate(db)
    assertDatabaseReadable(db)
    return db
  } catch (error) {
    try {
      db.close()
    } catch {
      /* ignore */
    }
    throw error
  }
}

function removeSidecarFiles(dbPath: string): void {
  for (const suffix of ['-wal', '-shm']) {
    try {
      fs.rmSync(`${dbPath}${suffix}`, { force: true })
    } catch {
      /* ignore */
    }
  }
}

function backupBrokenDatabase(dbPath: string): string {
  const backupPath = `${dbPath}.bak`
  try {
    fs.rmSync(backupPath, { force: true })
    fs.renameSync(dbPath, backupPath)
  } catch {
    // 重命名失败（被占用等）：退化为清空重建，仍记录错误
    fs.rmSync(dbPath, { force: true })
  }
  removeSidecarFiles(dbPath)
  return backupPath
}

/**
 * 打开（或重建）数据库；已是打开状态时先关闭旧连接。
 * 打开失败会尝试备份损坏文件后重建一次；两次都失败则返回 db: null + healthy: false。
 */
export function openDatabase(options: OpenDatabaseOptions = {}): OpenDatabaseResult {
  closeDatabase()

  const dbPath = options.dbPath ?? resolveDbPath(options.dataDir)
  const memory = isMemoryPath(dbPath)
  currentDbPath = dbPath
  currentDataDir = memory ? ':memory:' : (options.dataDir ?? path.dirname(dbPath))

  if (!memory) fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  try {
    connection = openFile(dbPath)
    healthy = true
    lastError = undefined
  } catch (firstError) {
    let errorText = messageOf(firstError)
    connection = null
    if (memory) {
      healthy = false
      lastError = errorText
    } else {
      const existed = fs.existsSync(dbPath)
      try {
        if (existed) backupBrokenDatabase(dbPath)
        connection = openFile(dbPath)
        healthy = true
        errorText = existed
          ? `原数据库损坏，已备份为 ${path.basename(dbPath)}.bak 并重建`
          : errorText
        // 恢复成功但有备份时保留提示；否则上次错误不应残留
        lastError = existed ? errorText : undefined
      } catch (secondError) {
        healthy = false
        lastError = `${errorText}; 重建失败：${messageOf(secondError)}`
      }
    }
  }

  return {
    db: connection,
    healthy,
    error: lastError,
    dbPath,
    dataDir: currentDataDir
  }
}

export function closeDatabase(): void {
  if (!connection) return
  try {
    if (!isMemoryPath(currentDbPath)) {
      connection.pragma('wal_checkpoint(TRUNCATE)')
    }
  } catch {
    /* ignore checkpoint errors on close */
  }
  try {
    connection.close()
  } catch {
    /* ignore */
  }
  connection = null
  healthy = false
}

export function getDb(): SqliteDatabase {
  if (!connection) {
    throw new Error(`数据库不可用${lastError ? `：${lastError}` : ''}`)
  }
  return connection
}

export function hasDatabase(): boolean {
  return connection !== null
}

export function isDbHealthy(): boolean {
  return healthy
}

export function getDbError(): string | undefined {
  return lastError
}

export function getDbPath(): string {
  return currentDbPath
}

export function getDataDir(): string {
  return currentDataDir || resolveDataDir()
}

/** 事务包装：所有写操作都应经此执行 */
export function transaction<T>(fn: (db: SqliteDatabase) => T): T {
  const db = getDb()
  const run = db.transaction(() => fn(db))
  return run()
}

/** 退出前 checkpoint（WAL → 主库），避免 -wal 残留 */
export function checkpoint(): void {
  if (!connection) return
  try {
    if (!isMemoryPath(currentDbPath)) connection.pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// 导出 / 导入
// ---------------------------------------------------------------------------

export interface ExportLink {
  id?: string
  kind: string
  target: string
  display: string
  sortOrder: number
  lastCheckedAt: number | null
}

export interface ExportTask {
  id: string
  title: string
  note: string
  status: number
  priority: number
  dueAt: number | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
  sortOrder: number
  projectId: string | null
  tagIds: string[]
  tags: string[]
  links: ExportLink[]
}

export interface ExportTag {
  id: string
  name: string
  color: string
  kind: string
}

export interface ExportView {
  id: string
  name: string
  filter: NormalizedFilter
  sortOrder: number
  createdAt: number
}

export interface ExportBundle {
  version: 1
  exportedAt: number
  tasks: ExportTask[]
  tags: ExportTag[]
  views: ExportView[]
  settings: Record<string, unknown>
}

interface RawTaskRow {
  id: string
  title: string
  note: string
  status: number
  priority: number
  due_at: number | null
  created_at: number
  updated_at: number
  completed_at: number | null
  sort_order: number
}

interface RawLinkRow {
  id: string
  task_id: string
  kind: string
  target: string
  display: string
  sort_order: number
  last_checked_at: number | null
}

interface RawTagRow {
  id: string
  name: string
  color: string
  kind: string
}

interface RawViewRow {
  id: string
  name: string
  filter_json: string
  sort_order: number
  created_at: number
}

interface RawSettingRow {
  key: string
  value: string
}

function parseJsonSafe<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

/** 导出当前库全部可迁移数据（tasks/tags/links/views/settings） */
export function exportDatabase(): ExportBundle {
  const db = getDb()
  const taskRows = db
    .prepare('SELECT * FROM tasks ORDER BY created_at ASC, rowid ASC')
    .all() as RawTaskRow[]
  const tagRows = db.prepare('SELECT * FROM tags ORDER BY rowid ASC').all() as RawTagRow[]
  const linkRows = db
    .prepare('SELECT * FROM links ORDER BY task_id ASC, sort_order ASC, rowid ASC')
    .all() as RawLinkRow[]
  const relationRows = db
    .prepare('SELECT task_id, tag_id FROM task_tags ORDER BY task_id ASC')
    .all() as Array<{ task_id: string; tag_id: string }>
  const viewRows = db
    .prepare('SELECT * FROM views ORDER BY sort_order ASC, rowid ASC')
    .all() as RawViewRow[]
  const settingRows = db.prepare('SELECT * FROM settings ORDER BY key ASC').all() as RawSettingRow[]

  const tagById = new Map(tagRows.map((tag) => [tag.id, tag]))
  const linksByTask = new Map<string, RawLinkRow[]>()
  for (const link of linkRows) {
    const list = linksByTask.get(link.task_id) ?? []
    list.push(link)
    linksByTask.set(link.task_id, list)
  }
  const tagIdsByTask = new Map<string, string[]>()
  for (const relation of relationRows) {
    const list = tagIdsByTask.get(relation.task_id) ?? []
    list.push(relation.tag_id)
    tagIdsByTask.set(relation.task_id, list)
  }

  const tasks: ExportTask[] = taskRows.map((row) => {
    const tagIds = tagIdsByTask.get(row.id) ?? []
    const project = tagIds.find((id) => tagById.get(id)?.kind === 'project') ?? null
    return {
      id: row.id,
      title: row.title,
      note: row.note,
      status: row.status,
      priority: row.priority,
      dueAt: row.due_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      sortOrder: row.sort_order,
      projectId: project,
      tagIds: tagIds.filter((id) => id !== project),
      tags: tagIds.map((id) => tagById.get(id)?.name).filter((name): name is string => Boolean(name)),
      links: (linksByTask.get(row.id) ?? []).map((link) => ({
        id: link.id,
        kind: link.kind,
        target: link.target,
        display: link.display,
        sortOrder: link.sort_order,
        lastCheckedAt: link.last_checked_at
      }))
    }
  })

  const settings: Record<string, unknown> = {}
  for (const row of settingRows) {
    settings[row.key] = parseJsonSafe<unknown>(row.value, row.value)
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    tasks,
    tags: tagRows.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      kind: tag.kind
    })),
    views: viewRows.map((view) => ({
      id: view.id,
      name: view.name,
      filter: normalizeFilter(parseJsonSafe<unknown>(view.filter_json, {})),
      sortOrder: view.sort_order,
      createdAt: view.created_at
    })),
    settings
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

/**
 * 导入导出格式（version 1）：事务内清空任务/标签/视图/设置后重建。
 * 兼容仅含 tasks[].tags（名称）的 docs/03 样例格式：名称缺失时按 kind='tag' 自动建标签。
 */
export function importDatabase(raw: unknown): { count: number } {
  const bundle = asRecord(raw)
  if (!bundle) throw new Error('导入文件格式不正确')
  const versionRaw = bundle['version']
  if (Number(versionRaw) !== 1) {
    throw new Error(`导入文件版本不受支持：${String(versionRaw ?? '未知')}`)
  }
  const rawTasks = Array.isArray(bundle['tasks']) ? bundle['tasks'] : null
  if (!rawTasks) throw new Error('导入文件缺少 tasks 数组')
  const rawTags = Array.isArray(bundle['tags']) ? bundle['tags'] : []
  const rawViews = Array.isArray(bundle['views']) ? bundle['views'] : []
  const rawSettings = asRecord(bundle['settings']) ?? {}

  const db = getDb()
  const now = Date.now()

  return transaction((database) => {
    database.prepare('DELETE FROM tasks').run()
    database.prepare('DELETE FROM tags').run()
    database.prepare('DELETE FROM views').run()
    database.prepare('DELETE FROM settings').run()

    const insertTag = database.prepare(
      'INSERT INTO tags (id, name, color, kind) VALUES (?, ?, ?, ?)'
    )
    const tagIdByName = new Map<string, string>()
    const tagKindById = new Map<string, string>()
    const insertTags: Array<{ id: string; name: string; color: string; kind: string }> = []
    for (const item of rawTags) {
      const record = asRecord(item)
      if (!record) continue
      const name = asString(record['name']).trim()
      if (!name) continue
      const kind = record['kind'] === 'project' ? 'project' : 'tag'
      const id = asString(record['id'], '') || randomUUID()
      insertTags.push({
        id,
        name,
        color: asString(record['color'], '#C7A98C') || '#C7A98C',
        kind
      })
    }

    const ensureTag = (name: string, kind: 'project' | 'tag'): string => {
      const trimmed = name.trim()
      const existing = tagIdByName.get(trimmed)
      if (existing) return existing
      const id = randomUUID()
      insertTag.run(id, trimmed, '#C7A98C', kind)
      tagIdByName.set(trimmed, id)
      tagKindById.set(id, kind)
      return id
    }

    // 先插入显式标签（含 id），建好 name → id 映射
    for (const tag of insertTags) {
      const nameTaken = tagIdByName.has(tag.name)
      const idTaken = tagKindById.has(tag.id)
      if (nameTaken || idTaken) continue
      insertTag.run(tag.id, tag.name, tag.color, tag.kind)
      tagIdByName.set(tag.name, tag.id)
      tagKindById.set(tag.id, tag.kind)
    }

    const insertTask = database.prepare(`
      INSERT INTO tasks (id, title, note, status, priority, due_at, created_at, updated_at, completed_at, sort_order)
      VALUES (@id, @title, @note, @status, @priority, @dueAt, @createdAt, @updatedAt, @completedAt, @sortOrder)
    `)
    const insertLink = database.prepare(`
      INSERT INTO links (id, task_id, kind, target, display, sort_order, last_checked_at)
      VALUES (@id, @taskId, @kind, @target, @display, @sortOrder, @lastCheckedAt)
    `)
    const insertRelation = database.prepare(
      'INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)'
    )

    let count = 0
    for (const item of rawTasks) {
      const record = asRecord(item)
      if (!record) continue
      const title = asString(record['title']).trim()
      if (!title) continue
      const taskId = asString(record['id'], '') || randomUUID()
      const createdAt = asNumber(record['createdAt'], now)
      insertTask.run({
        id: taskId,
        title,
        note: asString(record['note'], ''),
        status: record['status'] === 1 ? 1 : 0,
        priority: Math.trunc(Math.min(3, Math.max(0, asNumber(record['priority'], 0)))),
        dueAt: asNumberOrNull(record['dueAt']),
        createdAt,
        updatedAt: asNumber(record['updatedAt'], createdAt),
        completedAt: asNumberOrNull(record['completedAt']),
        sortOrder: asNumber(record['sortOrder'], count)
      })
      count += 1

      const relationTagIds = new Set<string>()
      const projectId = asString(record['projectId'], '')
      if (projectId) {
        const knownKind = tagKindById.get(projectId)
        if (knownKind === 'project') relationTagIds.add(projectId)
      }
      for (const id of asStringArray(record['tagIds'])) {
        if (tagKindById.has(id)) relationTagIds.add(id)
      }
      for (const name of asStringArray(record['tags'])) {
        const id = ensureTag(name, 'tag')
        if (tagKindById.get(id) === 'tag') relationTagIds.add(id)
      }
      if (projectId && !relationTagIds.has(projectId) && tagKindById.get(projectId) === 'project') {
        relationTagIds.add(projectId)
      }
      for (const tagId of relationTagIds) insertRelation.run(taskId, tagId)

      const links = Array.isArray(record['links']) ? record['links'] : []
      let linkIndex = 0
      for (const linkItem of links) {
        const link = asRecord(linkItem)
        if (!link) continue
        const target = asString(link['target']).trim()
        if (!target) continue
        const kindRaw = asString(link['kind'], '')
        const kind = kindRaw === 'url' || kindRaw === 'folder' || kindRaw === 'file' ? kindRaw : 'folder'
        insertLink.run({
          id: asString(link['id'], '') || randomUUID(),
          taskId,
          kind,
          target,
          display: asString(link['display'], ''),
          sortOrder: asNumber(link['sortOrder'], linkIndex),
          lastCheckedAt: asNumberOrNull(link['lastCheckedAt'])
        })
        linkIndex += 1
      }
    }

    const insertView = database.prepare(
      'INSERT INTO views (id, name, filter_json, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    let viewIndex = 0
    for (const item of rawViews) {
      const record = asRecord(item)
      if (!record) continue
      const name = asString(record['name']).trim()
      if (!name) continue
      insertView.run(
        asString(record['id'], '') || randomUUID(),
        name,
        JSON.stringify(normalizeFilter(record['filter'])),
        asNumber(record['sortOrder'], viewIndex),
        asNumber(record['createdAt'], now)
      )
      viewIndex += 1
    }

    const insertSetting = database.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
    )
    for (const [key, value] of Object.entries(rawSettings)) {
      insertSetting.run(key, JSON.stringify(value ?? null))
    }

    return { count }
  })
}
