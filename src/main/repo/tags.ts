/**
 * repo/tags · 项目/标签的增删改查与未完成计数
 * Contract: docs/03-DATA-MODEL.md §2 · docs/04-TECH-PLAN.md §5.5 · docs/00 §项目与标签
 */
import { randomUUID } from 'node:crypto'
import type { TagDTO, TagDeleteResult, TagKind, TagListsDTO } from '../../shared/types'
import { getDb, transaction } from '../db'

export const DEFAULT_TAG_COLOR = '#C7A98C'
const MAX_NAME_LENGTH = 50

export interface TagRow {
  id: string
  name: string
  color: string
  kind: string
}

function normalizeKind(value: unknown): TagKind {
  return value === 'project' ? 'project' : 'tag'
}

function normalizeName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) throw new Error('名称不能为空')
  if (name.length > MAX_NAME_LENGTH) throw new Error(`名称不能超过 ${MAX_NAME_LENGTH} 个字符`)
  return name
}

function normalizeColor(value: unknown): string {
  const color = typeof value === 'string' ? value.trim() : ''
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_TAG_COLOR
}

function pendingCounts(): Map<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT tt.tag_id AS tag_id, COUNT(*) AS count
       FROM task_tags tt
       JOIN tasks t ON t.id = tt.task_id
       WHERE t.status = 0
       GROUP BY tt.tag_id`
    )
    .all() as Array<{ tag_id: string; count: number }>
  return new Map(rows.map((row) => [row.tag_id, row.count]))
}

export function mapTagRow(row: TagRow, pendingCount?: number): TagDTO {
  const dto: TagDTO = {
    id: row.id,
    name: row.name,
    color: row.color,
    kind: normalizeKind(row.kind)
  }
  if (pendingCount !== undefined) dto.pendingCount = pendingCount
  return dto
}

function countPending(taskId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM tasks WHERE id = ? AND status = 0')
    .get(taskId) as { count: number }
  return row.count
}

export function listTags(): TagListsDTO {
  const rows = getDb().prepare('SELECT * FROM tags ORDER BY rowid ASC').all() as TagRow[]
  const counts = pendingCounts()
  const tags: TagDTO[] = []
  const projects: TagDTO[] = []
  for (const row of rows) {
    const dto = mapTagRow(row, counts.get(row.id) ?? 0)
    if (dto.kind === 'project') projects.push(dto)
    else tags.push(dto)
  }
  return { tags, projects }
}

export function getTag(id: string): TagDTO | null {
  const row = getDb().prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow | undefined
  return row ? mapTagRow(row, pendingCounts().get(id) ?? 0) : null
}

export interface CreateTagInput {
  name: string
  kind: TagKind
  color?: string
}

export function createTag(input: CreateTagInput): TagDTO {
  const name = normalizeName(input?.name)
  const kind = normalizeKind(input?.kind)
  const color = normalizeColor(input?.color)
  const db = getDb()
  const duplicated = db.prepare('SELECT id FROM tags WHERE name = ?').get(name)
  if (duplicated) throw new Error(`已存在同名项目或标签：${name}`)
  const id = randomUUID()
  db.prepare('INSERT INTO tags (id, name, color, kind) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    color,
    kind
  )
  const created = getTag(id)
  if (!created) throw new Error('项目或标签创建失败')
  return created
}

export function renameTag(id: string, nameInput: string): TagDTO {
  const name = normalizeName(nameInput)
  const db = getDb()
  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow | undefined
  if (!existing) throw new Error('项目或标签不存在')
  const duplicated = db.prepare('SELECT id FROM tags WHERE name = ? AND id <> ?').get(name, id)
  if (duplicated) throw new Error(`已存在同名项目或标签：${name}`)
  db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(name, id)
  const renamed = getTag(id)
  if (!renamed) throw new Error('项目或标签不存在')
  return renamed
}

/**
 * 删除项目/标签：返回被移除关联的任务 id 与影响数，供渲染层提供撤销。
 * 撤销策略（.agents D4）：渲染层用返回的 record 重建 tag，再对 taskIds 调 tasks:update 回填 tagIds。
 */
export function deleteTag(id: string): TagDeleteResult {
  return transaction((db) => {
    const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow | undefined
    if (!row) throw new Error('项目或标签不存在')
    const taskRows = db
      .prepare('SELECT task_id FROM task_tags WHERE tag_id = ? ORDER BY rowid ASC')
      .all(id) as Array<{ task_id: string }>
    const taskIds = taskRows.map((item) => item.task_id)
    let pending = 0
    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => '?').join(', ')
      const pendingRow = db
        .prepare(
          `SELECT COUNT(*) AS count FROM tasks WHERE status = 0 AND id IN (${placeholders})`
        )
        .get(...taskIds) as { count: number }
      pending = pendingRow.count
    }
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    return {
      ok: true,
      impact: { total: taskIds.length, pending },
      record: mapTagRow(row, pending),
      taskIds
    }
  })
}

/** 供导入/种子数据在事务内复用：按名称 upsert 标签并返回 id */
export function ensureTag(
  name: string,
  kind: TagKind,
  color?: string,
  id?: string
): string {
  const db = getDb()
  const normalizedName = normalizeName(name)
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(normalizedName) as
    | { id: string }
    | undefined
  if (existing) return existing.id
  const tagId = id && !db.prepare('SELECT id FROM tags WHERE id = ?').get(id) ? id : randomUUID()
  db.prepare('INSERT INTO tags (id, name, color, kind) VALUES (?, ?, ?, ?)').run(
    tagId,
    normalizedName,
    normalizeColor(color),
    normalizeKind(kind)
  )
  return tagId
}
