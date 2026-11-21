/**
 * repo/views · 保存的筛选视图（桌面视图）
 * Contract: docs/03-DATA-MODEL.md §4.2 · docs/04-TECH-PLAN.md §5.7
 */
import { randomUUID } from 'node:crypto'
import type { FilterDTO, SavedViewDTO } from '../../shared/types'
import { getDb, transaction } from '../db'
import { normalizeFilter } from '../filterSql'

export interface SavedViewRow {
  id: string
  name: string
  filter_json: string
  sort_order: number
  created_at: number
}

function parseFilterJson(text: string): FilterDTO {
  try {
    return normalizeFilter(JSON.parse(text) as unknown)
  } catch {
    return normalizeFilter(undefined)
  }
}

export function mapViewRow(row: SavedViewRow): SavedViewDTO {
  return {
    id: row.id,
    name: row.name,
    filter: parseFilterJson(row.filter_json),
    sortOrder: row.sort_order,
    createdAt: row.created_at
  }
}

export function listViews(): SavedViewDTO[] {
  const rows = getDb()
    .prepare('SELECT * FROM views ORDER BY sort_order ASC, created_at ASC, rowid ASC')
    .all() as SavedViewRow[]
  return rows.map(mapViewRow)
}

export function getView(id: string): SavedViewDTO | null {
  const row = getDb().prepare('SELECT * FROM views WHERE id = ?').get(id) as SavedViewRow | undefined
  return row ? mapViewRow(row) : null
}

export interface SaveViewInput {
  id?: string
  name: string
  filter: FilterDTO
}

/** 新建或更新已保存视图（id 存在即更新） */
export function saveView(input: SaveViewInput): SavedViewDTO {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) throw new Error('视图名称不能为空')
  const filterJson = JSON.stringify(normalizeFilter(input.filter))
  const db = getDb()
  if (input.id) {
    const existing = db.prepare('SELECT id FROM views WHERE id = ?').get(input.id)
    if (!existing) throw new Error('视图不存在')
    db.prepare('UPDATE views SET name = ?, filter_json = ? WHERE id = ?').run(
      name,
      filterJson,
      input.id
    )
    const updated = getView(input.id)
    if (!updated) throw new Error('视图不存在')
    return updated
  }
  const id = randomUUID()
  const row = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM views')
    .get() as { max_order: number }
  const createdAt = Date.now()
  db.prepare(
    'INSERT INTO views (id, name, filter_json, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, filterJson, row.max_order + 1, createdAt)
  const created = getView(id)
  if (!created) throw new Error('视图创建失败')
  return created
}

export function deleteView(id: string): { ok: true } {
  getDb().prepare('DELETE FROM views WHERE id = ?').run(id)
  return { ok: true }
}

/** 清空并重建视图（导入用；保持插入顺序） */
export function replaceAllViews(views: ReadonlyArray<{ name: string; filter: FilterDTO }>): void {
  transaction((db) => {
    db.prepare('DELETE FROM views').run()
    const insert = db.prepare(
      'INSERT INTO views (id, name, filter_json, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    const now = Date.now()
    views.forEach((view, index) => {
      insert.run(randomUUID(), view.name, JSON.stringify(normalizeFilter(view.filter)), index, now)
    })
  })
}
