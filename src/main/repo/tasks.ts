/**
 * repo/tasks · 任务列表（筛选/视图）、CRUD、勾选、今日未完成计数
 * Contract: docs/03-DATA-MODEL.md §1/§3/§4 · docs/04-TECH-PLAN.md §5.6–§5.7
 */
import { randomUUID } from 'node:crypto'
import type {
  FilterDTO,
  LinkDTO,
  TaskCreateInput,
  TaskDTO,
  TaskPriority,
  TaskUpdatePatch
} from '../../shared/types'
import { getDb, transaction, type SqliteDatabase } from '../db'
import {
  addDays,
  buildFilterWhere,
  buildScopeWhere,
  isBuiltinViewId,
  normalizeFilter,
  startOfDay,
  taskOrderBy
} from '../filterSql'
import { insertLink, listLinksForTasks, replaceTaskLinks } from './links'
import { getView } from './views'

export interface TaskRow {
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

export interface TagRelation {
  tagIds: string[]
  projectId: string | null
}

function normalizePriority(value: unknown): TaskPriority {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(3, Math.max(0, Math.trunc(value))) as TaskPriority
  }
  if (value === 1 || value === 2 || value === 3) return value
  return 0
}

function normalizeDueAt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  return null
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))
  )
}

function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key)
}

export function mapTaskRow(row: TaskRow, relation: TagRelation, links: LinkDTO[]): TaskDTO {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    status: row.status === 1 ? 1 : 0,
    priority: normalizePriority(row.priority),
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    projectId: relation.projectId,
    tagIds: relation.tagIds,
    links
  }
}

function tagRelationsForTasks(taskIds: readonly string[]): Map<string, TagRelation> {
  const result = new Map<string, TagRelation>()
  if (taskIds.length === 0) return result
  const placeholders = taskIds.map(() => '?').join(', ')
  const rows = getDb()
    .prepare(
      `SELECT tt.task_id AS task_id, tt.tag_id AS tag_id, g.kind AS kind
       FROM task_tags tt
       JOIN tags g ON g.id = tt.tag_id
       WHERE tt.task_id IN (${placeholders})
       ORDER BY tt.task_id ASC, tt.rowid ASC`
    )
    .all(...taskIds) as Array<{ task_id: string; tag_id: string; kind: string }>
  for (const row of rows) {
    const relation = result.get(row.task_id) ?? { tagIds: [], projectId: null }
    if (row.kind === 'project') {
      if (!relation.projectId) relation.projectId = row.tag_id
    } else {
      relation.tagIds.push(row.tag_id)
    }
    result.set(row.task_id, relation)
  }
  return result
}

function buildTaskDtos(rows: TaskRow[]): TaskDTO[] {
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.id)
  const linksByTask = listLinksForTasks(ids)
  const relations = tagRelationsForTasks(ids)
  return rows.map((row) =>
    mapTaskRow(
      row,
      relations.get(row.id) ?? { tagIds: [], projectId: null },
      linksByTask.get(row.id) ?? []
    )
  )
}

export interface ListTasksOptions {
  filter?: FilterDTO
  /** 内置视图 id 或已保存视图 id */
  viewId?: string
}

/**
 * tasks:list：
 * - 内置视图（inbox/today/overdue/upcoming/done）作为 scope WHERE 与 filter 叠加；
 * - 已保存视图 viewId 在未显式传 filter 时使用其 filter_json；
 * - 返回完整 TaskDTO（projectId/tagIds/links），排序见 docs/04 §5.7。
 */
export function listTasks(options: ListTasksOptions = {}): TaskDTO[] {
  const now = Date.now()
  let filter = options.filter
  let builtinView: string | null = null
  let scopeWhere = ''
  let scopeParams: unknown[] = []

  const viewId = options.viewId
  if (viewId) {
    if (isBuiltinViewId(viewId)) {
      builtinView = viewId
      const scope = buildScopeWhere(viewId, now)
      scopeWhere = scope.where
      scopeParams = scope.params
    } else {
      const saved = getView(viewId)
      if (saved && !filter) filter = saved.filter
    }
  }

  const normalized = normalizeFilter(filter)
  // done 视图的 scope 已固定 status=1；忽略 filter.status 避免「已完成 + 待办 tab」互斥成空列表
  if (builtinView === 'done') normalized.status = 'all'
  const filterSql = buildFilterWhere(normalized, now)

  const where = scopeWhere ? `${scopeWhere} AND (${filterSql.where})` : filterSql.where
  const params = [...scopeParams, ...filterSql.params]
  const orderStatus = builtinView === 'done' ? 'done' : normalized.status
  const orderBy = taskOrderBy(orderStatus)

  const rows = getDb()
    .prepare(`SELECT t.* FROM tasks t WHERE ${where} ORDER BY ${orderBy}`)
    .all(...params) as TaskRow[]
  return buildTaskDtos(rows)
}

// listTasks 里 scope 参数需要与 where 一起构造，单独保存

export function getTask(id: string): TaskDTO | null {
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  if (!row) return null
  return buildTaskDtos([row])[0] ?? null
}

function requireTask(id: string): TaskRow {
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  if (!row) throw new Error('任务不存在')
  return row
}

function nextTaskSortOrder(database: SqliteDatabase): number {
  const row = database
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM tasks')
    .get() as { next_order: number }
  return row.next_order
}

/**
 * 写任务与标签/项目关联：projectId 必须是项目；tagIds 里若混入项目 id，
 * 无 projectId 时提升为项目，否则忽略，保证每任务最多一个项目。
 */
function setTaskRelations(
  database: SqliteDatabase,
  taskId: string,
  tagIds: string[],
  projectId: string | null
): void {
  let project = projectId
  const tagIdsToInsert: string[] = []
  const lookup = database.prepare('SELECT id, kind FROM tags WHERE id = ?')

  for (const tagId of tagIds) {
    const tag = lookup.get(tagId) as { id: string; kind: string } | undefined
    if (!tag) throw new Error('标签不存在')
    if (tag.kind === 'project') {
      if (!project) project = tagId
      continue
    }
    tagIdsToInsert.push(tagId)
  }

  if (project) {
    const tag = lookup.get(project) as { id: string; kind: string } | undefined
    if (!tag) throw new Error('项目不存在')
    if (tag.kind !== 'project') throw new Error('项目不存在')
  }

  database.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId)
  const insert = database.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)')
  if (project) insert.run(taskId, project)
  for (const tagId of tagIdsToInsert) {
    if (tagId !== project) insert.run(taskId, tagId)
  }
}

function currentRelation(taskId: string): TagRelation {
  const relation = tagRelationsForTasks([taskId]).get(taskId)
  return relation ?? { tagIds: [], projectId: null }
}

export function createTask(input: TaskCreateInput, now: number = Date.now()): TaskDTO {
  if (!input || typeof input.title !== 'string' || !input.title.trim()) {
    throw new Error('任务标题不能为空')
  }
  const title = input.title.trim()
  const note = typeof input.note === 'string' ? input.note : ''
  const priority = normalizePriority(input.priority)
  const dueAt = normalizeDueAt(input.dueAt)
  const tagIds = normalizeIdList(input.tagIds)
  const projectId = input.projectId ? String(input.projectId) : null
  const links = Array.isArray(input.links) ? input.links : []

  return transaction((database) => {
    const id = randomUUID()
    database
      .prepare(
        `INSERT INTO tasks (id, title, note, status, priority, due_at, created_at, updated_at, completed_at, sort_order)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?, NULL, ?)`
      )
      .run(id, title, note, priority, dueAt, now, now, nextTaskSortOrder(database))
    setTaskRelations(database, id, tagIds, projectId)
    links.forEach((link, index) =>
      insertLink(database, id, { target: link.target, display: link.display }, index)
    )
    const created = getTask(id)
    if (!created) throw new Error('任务创建失败')
    return created
  })
}

export function updateTask(
  id: string,
  patch: TaskUpdatePatch,
  now: number = Date.now()
): TaskDTO {
  if (!patch || typeof patch !== 'object') throw new Error('无效的任务修改')
  return transaction((database) => {
    requireTask(id)
    const fields: string[] = []
    const params: unknown[] = []

    if (hasOwn(patch, 'title')) {
      const title = typeof patch.title === 'string' ? patch.title.trim() : ''
      if (!title) throw new Error('任务标题不能为空')
      fields.push('title = ?')
      params.push(title)
    }
    if (hasOwn(patch, 'note')) {
      fields.push('note = ?')
      params.push(typeof patch.note === 'string' ? patch.note : '')
    }
    if (hasOwn(patch, 'priority')) {
      fields.push('priority = ?')
      params.push(normalizePriority(patch.priority))
    }
    if (hasOwn(patch, 'dueAt')) {
      fields.push('due_at = ?')
      params.push(normalizeDueAt(patch.dueAt))
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?')
      params.push(now)
      database
        .prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`)
        .run(...params, id)
    }

    if (hasOwn(patch, 'tagIds') || hasOwn(patch, 'projectId')) {
      const current = currentRelation(id)
      const tagIds = hasOwn(patch, 'tagIds') ? normalizeIdList(patch.tagIds) : current.tagIds
      const projectId = hasOwn(patch, 'projectId')
        ? patch.projectId
          ? String(patch.projectId)
          : null
        : current.projectId
      setTaskRelations(database, id, tagIds, projectId)
    }

    if (hasOwn(patch, 'links')) {
      const links = Array.isArray(patch.links) ? patch.links : []
      replaceTaskLinks(database, id, links)
    }

    if (fields.length === 0) {
      database.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(now, id)
    }

    const updated = getTask(id)
    if (!updated) throw new Error('任务不存在')
    return updated
  })
}

/** 勾选/取消勾选：完成写 completed_at，取消清空 */
export function toggleTask(id: string, done: boolean, now: number = Date.now()): TaskDTO {
  return transaction((database) => {
    requireTask(id)
    if (done) {
      database
        .prepare('UPDATE tasks SET status = 1, completed_at = ?, updated_at = ? WHERE id = ?')
        .run(now, now, id)
    } else {
      database
        .prepare('UPDATE tasks SET status = 0, completed_at = NULL, updated_at = ? WHERE id = ?')
        .run(now, id)
    }
    const updated = getTask(id)
    if (!updated) throw new Error('任务不存在')
    return updated
  })
}

export function deleteTask(id: string): { ok: true } {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return { ok: true }
}

/** 托盘 tooltip / 快速添加用：今天应处理（未完成且 due ≤ 今天结束）任务数 */
export function countTodayPending(now: number = Date.now()): number {
  const tomorrow = addDays(startOfDay(now), 1)
  const row = getDb()
    .prepare(
      'SELECT COUNT(*) AS count FROM tasks t WHERE t.status = 0 AND t.due_at IS NOT NULL AND t.due_at < ?'
    )
    .get(tomorrow) as { count: number }
  return row.count
}
