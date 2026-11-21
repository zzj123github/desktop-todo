/**
 * filterSql · Filter JSON → 参数化 WHERE 子句（纯函数，不访问 DB）
 * Contract: docs/03-DATA-MODEL.md §4 · docs/04-TECH-PLAN.md §5.7 · docs/08-UI-ENGINEERING-SPEC.md §4
 *
 * 约定：
 * - 日期一律按本地时区计算，「今天/明天/本周/逾期」与 docs/03 §3 一致；
 * - custom 的 from/to 兼容两种输入：本地日期键 'YYYY-MM-DD'（preload 契约）与 epoch ms（docs/03 旧写法），
 *   内部统一归一化为日期键（筛选按天粒度）；
 * - 返回的 where 以 `1=1` 开头，便于与 scope 子句安全拼接；SQL 使用别名 t（tasks）。
 */
import type { FilterDTO, FilterDate, FilterDateMode, TaskPriority } from '../shared/types'

/** FilterDTO.status 的取值集合 */
export type FilterStatus = FilterDTO['status']

export interface FilterSql {
  where: string
  params: unknown[]
}

/** 归一化后的筛选条件（与 preload FilterDTO 完全兼容，custom 日期键化） */
export type NormalizedFilter = FilterDTO

export type BuiltinViewId = 'inbox' | 'today' | 'overdue' | 'upcoming' | 'done'

export const BUILTIN_VIEW_IDS: readonly BuiltinViewId[] = [
  'inbox',
  'today',
  'overdue',
  'upcoming',
  'done'
]

const STATUS_VALUES: readonly FilterStatus[] = ['todo', 'done', 'all']
const DATE_MODES: readonly FilterDateMode[] = ['any', 'today', 'tomorrow', 'week', 'overdue', 'custom']

/** 本地当天 00:00:00.000 的 epoch ms */
export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 本地日历日加减（跨月/跨年/DST 安全） */
export function addDays(timestamp: number, days: number): number {
  const date = new Date(timestamp)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

/** 本地本周一 00:00（周日为本周第 7 天） */
export function startOfWeek(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  const weekday = (date.getDay() + 6) % 7 // 周一=0 … 周日=6
  date.setDate(date.getDate() - weekday)
  return date.getTime()
}

/** 本地日期键 'YYYY-MM-DD' */
export function dateKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 解析本地日期键 → 本地当天 00:00 的 epoch ms；非法返回 null */
export function parseDateKey(key: string): number | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date.getTime()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** 把 custom 的 from/to 归一化成日期键；连数字串也接受 */
function normalizeDateBound(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return dateKey(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = parseDateKey(trimmed)
    if (parsed !== null) return dateKey(parsed)
    const asNumber = Number(trimmed)
    if (Number.isFinite(asNumber)) return dateKey(asNumber)
  }
  return undefined
}

/** 任意来源（JSON / DB filter_json / IPC 入参）→ 合法 FilterDTO */
export function normalizeFilter(input: unknown): NormalizedFilter {
  const record = asRecord(input) ?? {}

  const statusRaw = record['status']
  const status: FilterStatus = STATUS_VALUES.includes(statusRaw as FilterStatus)
    ? (statusRaw as FilterStatus)
    : 'todo'

  const dateRecord = asRecord(record['date']) ?? {}
  const modeRaw = dateRecord['mode']
  const mode: FilterDateMode = DATE_MODES.includes(modeRaw as FilterDateMode)
    ? (modeRaw as FilterDateMode)
    : 'any'
  const date: FilterDate = { mode }
  if (mode === 'custom') {
    const from = normalizeDateBound(dateRecord['from'])
    const to = normalizeDateBound(dateRecord['to'])
    if (from) date.from = from
    if (to) date.to = to
  }

  const tagIds = Array.isArray(record['tagIds'])
    ? Array.from(
        new Set(
          record['tagIds'].filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0
          )
        )
      )
    : []

  const priorities = Array.isArray(record['priorities'])
    ? Array.from(
        new Set(
          record['priorities'].filter(
            (item): item is TaskPriority =>
              typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 3
          )
        )
      ).sort((a, b) => a - b)
    : []

  const keyword = typeof record['keyword'] === 'string' ? record['keyword'] : ''

  return { status, date, tagIds, priorities, keyword }
}

/** LIKE 转义（配合 ESCAPE '\'） */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function dateClause(filter: NormalizedFilter, now: number): FilterSql {
  const today = startOfDay(now)
  switch (filter.date.mode) {
    case 'today':
      return { where: 't.due_at >= ? AND t.due_at < ?', params: [today, addDays(today, 1)] }
    case 'tomorrow':
      return {
        where: 't.due_at >= ? AND t.due_at < ?',
        params: [addDays(today, 1), addDays(today, 2)]
      }
    case 'week': {
      const weekStart = startOfWeek(today)
      return { where: 't.due_at >= ? AND t.due_at < ?', params: [weekStart, addDays(weekStart, 7)] }
    }
    case 'overdue':
      return {
        where: 't.status = 0 AND t.due_at IS NOT NULL AND t.due_at < ?',
        params: [now]
      }
    case 'custom': {
      const clauses: string[] = []
      const params: unknown[] = []
      if (filter.date.from) {
        const from = parseDateKey(filter.date.from)
        if (from !== null) {
          clauses.push('t.due_at >= ?')
          params.push(from)
        }
      }
      if (filter.date.to) {
        const to = parseDateKey(filter.date.to)
        if (to !== null) {
          clauses.push('t.due_at < ?')
          params.push(addDays(to, 1))
        }
      }
      return { where: clauses.length > 0 ? clauses.join(' AND ') : '1=1', params }
    }
    case 'any':
    default:
      return { where: '1=1', params: [] }
  }
}

/** Filter → WHERE（含 status / date / tagIds / priorities / keyword），参数化 */
export function buildFilterWhere(
  filter: FilterDTO | null | undefined,
  now: number = Date.now()
): FilterSql {
  const normalized = normalizeFilter(filter)
  const clauses: string[] = ['1=1']
  const params: unknown[] = []

  if (normalized.status === 'todo') clauses.push('t.status = 0')
  if (normalized.status === 'done') clauses.push('t.status = 1')

  const dateSql = dateClause(normalized, now)
  if (dateSql.where !== '1=1') {
    clauses.push(dateSql.where)
    params.push(...dateSql.params)
  }

  if (normalized.tagIds.length > 0) {
    const placeholders = normalized.tagIds.map(() => '?').join(', ')
    clauses.push(
      `EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id IN (${placeholders}))`
    )
    params.push(...normalized.tagIds)
  }

  if (normalized.priorities.length > 0) {
    const placeholders = normalized.priorities.map(() => '?').join(', ')
    clauses.push(`t.priority IN (${placeholders})`)
    params.push(...normalized.priorities)
  }

  const keyword = normalized.keyword.trim()
  if (keyword) {
    const like = `%${escapeLike(keyword)}%`
    clauses.push("(t.title LIKE ? ESCAPE '\\' OR t.note LIKE ? ESCAPE '\\')")
    params.push(like, like)
  }

  return { where: clauses.join(' AND '), params }
}

/**
 * 内置视图 scope（docs/01 FR-2 + design/app/js/core.js DT.scope）：
 * - inbox：无日期且无项目关联（B 口径，标签不影响）
 * - today：有日期且（未完成时日期 ≤ 今天；已完成时日期在今天或完成于今天）
 * - overdue：未完成且 due_at < 当前时刻（同一天已过也算）
 * - upcoming：未完成且日期在明天 … 今天+7 天内
 * - done：已完成
 */
export function buildScopeWhere(viewId: BuiltinViewId, now: number = Date.now()): FilterSql {
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  switch (viewId) {
    case 'inbox':
      return {
        where:
          "1=1 AND t.due_at IS NULL AND NOT EXISTS (SELECT 1 FROM task_tags st JOIN tags sg ON sg.id = st.tag_id WHERE st.task_id = t.id AND sg.kind = 'project')",
        params: []
      }
    case 'today':
      return {
        where:
          '1=1 AND t.due_at IS NOT NULL AND t.due_at < ? AND (t.status = 0 OR t.due_at >= ? OR (t.completed_at IS NOT NULL AND t.completed_at >= ? AND t.completed_at < ?))',
        params: [tomorrow, today, today, tomorrow]
      }
    case 'overdue':
      return {
        where: '1=1 AND t.status = 0 AND t.due_at IS NOT NULL AND t.due_at < ?',
        params: [now]
      }
    case 'upcoming':
      return {
        where: '1=1 AND t.status = 0 AND t.due_at >= ? AND t.due_at < ?',
        params: [tomorrow, addDays(today, 8)]
      }
    case 'done':
      return { where: '1=1 AND t.status = 1', params: [] }
    default:
      return { where: '1=1', params: [] }
  }
}

export function isBuiltinViewId(value: string | null | undefined): value is BuiltinViewId {
  return typeof value === 'string' && (BUILTIN_VIEW_IDS as readonly string[]).includes(value)
}

/**
 * 排序（docs/04 §5.7）：
 * - 待办：无日期在后；due_at 升序；priority 降序；created_at 升序（逾期天然排最前）
 * - 已完成：completed_at 降序
 */
export function taskOrderBy(status: FilterStatus = 'todo'): string {
  if (status === 'done') return 't.completed_at DESC, t.created_at ASC'
  return '(t.due_at IS NULL) ASC, t.due_at ASC, t.priority DESC, t.created_at ASC'
}
