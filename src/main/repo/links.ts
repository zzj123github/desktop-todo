/**
 * repo/links · 任务链接的增删查、重新定位、打开并记录 last_checked_at
 * Contract: docs/03-DATA-MODEL.md §5 · docs/04-TECH-PLAN.md §5.1
 */
import { randomUUID } from 'node:crypto'
import type { LinkDTO, LinkKind, OpenResult } from '../../shared/types'
import { getDb, type SqliteDatabase } from '../db'
import {
  classifyTarget,
  defaultDisplayName,
  normalizeLocalPath,
  openLink
} from '../opener'

export interface LinkRow {
  id: string
  task_id: string
  kind: string
  target: string
  display: string
  sort_order: number
  last_checked_at: number | null
}

export interface LinkInput {
  id?: string
  target: string
  display?: string
}

function normalizeKind(value: unknown): LinkKind {
  return value === 'url' || value === 'folder' || value === 'file' ? value : 'folder'
}

export function mapLinkRow(row: LinkRow): LinkDTO {
  return {
    id: row.id,
    taskId: row.task_id,
    kind: normalizeKind(row.kind),
    target: row.target,
    display: row.display,
    sortOrder: row.sort_order,
    lastCheckedAt: row.last_checked_at
  }
}

/** 批量取任务链接，避免 N+1 */
export function listLinksForTasks(taskIds: readonly string[]): Map<string, LinkDTO[]> {
  const result = new Map<string, LinkDTO[]>()
  if (taskIds.length === 0) return result
  const placeholders = taskIds.map(() => '?').join(', ')
  const rows = getDb()
    .prepare(
      `SELECT * FROM links WHERE task_id IN (${placeholders}) ORDER BY task_id ASC, sort_order ASC, rowid ASC`
    )
    .all(...taskIds) as LinkRow[]
  for (const row of rows) {
    const list = result.get(row.task_id) ?? []
    list.push(mapLinkRow(row))
    result.set(row.task_id, list)
  }
  return result
}

export function listLinks(taskId: string): LinkDTO[] {
  return listLinksForTasks([taskId]).get(taskId) ?? []
}

export function getLink(id: string): LinkDTO | null {
  const row = getDb().prepare('SELECT * FROM links WHERE id = ?').get(id) as LinkRow | undefined
  return row ? mapLinkRow(row) : null
}

function requireTask(taskId: string): void {
  const row = getDb().prepare('SELECT id FROM tasks WHERE id = ?').get(taskId)
  if (!row) throw new Error('任务不存在')
}

function nextSortOrder(database: SqliteDatabase, taskId: string): number {
  const row = database
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM links WHERE task_id = ?')
    .get(taskId) as { max_order: number }
  return row.max_order + 1
}

/**
 * 校验并插入一条链接（供 create/update 在事务内复用）。
 * target 非空且可识别，否则抛错由 IPC 转成结构化错误。
 */
export function insertLink(
  database: SqliteDatabase,
  taskId: string,
  input: LinkInput,
  sortOrder: number
): LinkDTO {
  const rawTarget = typeof input.target === 'string' ? input.target : ''
  const classification = classifyTarget(rawTarget)
  if (!classification.kind) {
    throw new Error(
      classification.reason === 'blocked' ? '不支持该链接类型' : '无法识别的链接或路径'
    )
  }
  const display =
    typeof input.display === 'string' && input.display.trim()
      ? input.display.trim()
      : defaultDisplayName(classification.target, classification.kind)
  const id = typeof input.id === 'string' && input.id ? input.id : randomUUID()
  database
    .prepare(
      `INSERT INTO links (id, task_id, kind, target, display, sort_order, last_checked_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`
    )
    .run(id, taskId, classification.kind, classification.target, display, sortOrder)
  return {
    id,
    taskId,
    kind: classification.kind,
    target: classification.target,
    display,
    sortOrder,
    lastCheckedAt: null
  }
}

export function addLink(taskId: string, target: string, display?: string): LinkDTO {
  requireTask(taskId)
  const db = getDb()
  return insertLink(db, taskId, { target, display }, nextSortOrder(db, taskId))
}

export function removeLink(id: string): { ok: true } {
  getDb().prepare('DELETE FROM links WHERE id = ?').run(id)
  return { ok: true }
}

export function updateLinkCheck(id: string, checkedAt: number = Date.now()): void {
  getDb().prepare('UPDATE links SET last_checked_at = ? WHERE id = ?').run(checkedAt, id)
}

/**
 * 替换链接目标（重新选择位置后由 IPC 调用）。
 * - 保留原 id；
 * - kind 按新路径重新判定（有扩展名→file，否则→folder）；
 * - display 若原本是自动生成的则跟随新路径重算，自定义 display 保留。
 */
export function replaceLinkTarget(
  id: string,
  target: string
): { ok: boolean; link?: LinkDTO; error?: string } {
  const db = getDb()
  const row = db.prepare('SELECT * FROM links WHERE id = ?').get(id) as LinkRow | undefined
  if (!row) return { ok: false, error: '链接不存在' }
  const classification = classifyTarget(target)
  if (!classification.kind) {
    return {
      ok: false,
      error: classification.reason === 'blocked' ? '不支持该链接类型' : '无法识别的链接或路径'
    }
  }
  const oldKind = normalizeKind(row.kind)
  const oldDefault = defaultDisplayName(row.target, oldKind)
  const autoDisplay = !row.display.trim() || row.display === oldDefault
  const display = autoDisplay
    ? defaultDisplayName(classification.target, classification.kind)
    : row.display
  db.prepare('UPDATE links SET kind = ?, target = ?, display = ? WHERE id = ?').run(
    classification.kind,
    classification.target,
    display,
    id
  )
  return { ok: true, link: getLink(id) ?? undefined }
}

/**
 * 全量替换某任务的链接集合（tasks:update 语义）：
 * - 带 id 且属于该任务 → 更新 target/display/kind/sort_order，保留 id 与 last_checked_at；
 * - 无 id / id 不属于该任务 → 新增（重新分配 id，避免主键/跨任务冲突）；
 * - 原任务有但本次未提交的 → 删除。
 */
export function replaceTaskLinks(
  database: SqliteDatabase,
  taskId: string,
  inputs: readonly LinkInput[]
): void {
  const existing = database
    .prepare('SELECT id FROM links WHERE task_id = ?')
    .all(taskId) as Array<{ id: string }>
  const existingIds = new Set(existing.map((row) => row.id))
  const kept = new Set<string>()

  inputs.forEach((input, index) => {
    const rawTarget = typeof input.target === 'string' ? input.target : ''
    const classification = classifyTarget(rawTarget)
    if (!classification.kind) {
      throw new Error(
        classification.reason === 'blocked' ? '不支持该链接类型' : '无法识别的链接或路径'
      )
    }
    const requestedId =
      typeof input.id === 'string' && input.id && existingIds.has(input.id) ? input.id : null
    if (requestedId && !kept.has(requestedId)) {
      kept.add(requestedId)
      const current = database
        .prepare('SELECT display FROM links WHERE id = ?')
        .get(requestedId) as { display: string } | undefined
      const display =
        typeof input.display === 'string' && input.display.trim()
          ? input.display.trim()
          : current?.display || defaultDisplayName(classification.target, classification.kind)
      database
        .prepare(
          'UPDATE links SET kind = ?, target = ?, display = ?, sort_order = ? WHERE id = ?'
        )
        .run(classification.kind, classification.target, display, index, requestedId)
    } else {
      // 不信任外部传入的 id：新增时一律重新生成
      insertLink(database, taskId, { target: classification.target, display: input.display }, index)
    }
  })

  const removed = existing.filter((row) => !kept.has(row.id)).map((row) => row.id)
  const del = database.prepare('DELETE FROM links WHERE id = ?')
  for (const id of removed) del.run(id)
}

/** 打开链接：成功时更新 last_checked_at；失败返回结构化原因 */
export async function openStoredLink(id: string): Promise<OpenResult> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM links WHERE id = ?').get(id) as LinkRow | undefined
  if (!row) return { ok: false, reason: 'missing', error: '链接不存在' }
  const result = await openLink(row.target, normalizeKind(row.kind))
  if (result.ok) {
    try {
      updateLinkCheck(id)
    } catch {
      // 打开成功但时间戳写失败不影响结果
    }
  }
  return result
}

/** 规范化后再比较，便于「重新选择位置」识别同一路径 */
export function sameTarget(a: string, b: string): boolean {
  return normalizeLocalPath(a).toLowerCase() === normalizeLocalPath(b).toLowerCase()
}
