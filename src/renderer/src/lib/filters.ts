/**
 * 筛选模型工具：默认筛选、激活判断、计数、激活项 chips、不可变更新的编辑操作。
 *
 * 契约：src/shared/types.ts 的 FilterDTO / FilterDate / TagDTO（preload 冻结）；
 * 语义：docs/03-DATA-MODEL.md §4（筛选）、docs/02-DESIGN-SPEC.md §3（筛选行 = 全部/标签/日期/优先级 + 关键词）。
 * 逾期判定统一走 `lib/date.ts` 的 `isOverdue`（同日已过也算，docs/02 §5.2）。
 */
import type { FilterDTO, FilterDateMode, TagDTO, TaskPriority } from '../../../shared/types'
import { zh } from '../i18n/zh'
import { addDays, dayStart, endOfWeek, startOfWeek, DAY } from './date'

/** 优先级短标签（与原型 prioLabel 一致；0=无优先级不显示），文案来自 i18n */
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  0: '',
  1: zh.priority.low,
  2: zh.priority.medium,
  3: zh.priority.high
}

/** 日期模式短标签（custom 单独拼区间），文案来自 i18n */
export const DATE_MODE_LABELS: Record<Exclude<FilterDateMode, 'custom'>, string> = {
  any: zh.filter.anyDate,
  today: zh.filter.today,
  tomorrow: zh.filter.tomorrow,
  week: zh.filter.week,
  overdue: zh.filter.overdue
}

/** 空筛选：与默认视图一致（待办 / 不限日期 / 不限标签 / 不限优先级 / 无关键词） */
export function emptyFilter(): FilterDTO {
  return { status: 'todo', date: { mode: 'any' }, tagIds: [], priorities: [], keyword: '' }
}

export interface FilterCounts {
  status: number
  date: number
  tags: number
  priority: number
  total: number
}

/**
 * 各维度激活数量：status 非 todo 记 1；date 非 any 记 1；tags/priority 记条目数；
 * keyword 去空白后非空记 1；`total` 是四维之和（用于「筛选」按钮角标）。
 */
export function filterCounts(f: FilterDTO): FilterCounts {
  const status = f.status !== 'todo' ? 1 : 0
  const date = f.date.mode !== 'any' ? 1 : 0
  const tags = f.tagIds.length
  const priority = f.priorities.length
  const keyword = f.keyword.trim() ? 1 : 0
  return { status, date, tags, priority, total: status + date + tags + priority + keyword }
}

/** 是否有任一维度激活 */
export function isFilterActive(f: FilterDTO): boolean {
  return filterCounts(f).total > 0
}

export interface ActiveChip {
  /** 稳定 key，交给 removeChip：`tag:<id>` / `date` / `priority:<n>` / `keyword` */
  key: string
  kind: 'tag' | 'date' | 'priority' | 'keyword'
  label: string
}

/** custom 区间显示文案：`from ~ to`（只有一端时用 `from ~` / `~ to`，都没有回退 i18n 的「自定义日期」） */
function customRangeLabel(from?: string, to?: string): string {
  if (from && to) return from + ' ~ ' + to
  if (from) return from + ' ~'
  if (to) return '~ ' + to
  return zh.filter.custom
}

/** 日期筛选的 chip 文案（契约：今天/明天/本周/已逾期；custom 显示区间） */
function dateChipLabel(f: FilterDTO): string | null {
  const date = f.date
  if (date.mode === 'any') return null
  if (date.mode === 'custom') return customRangeLabel(date.from, date.to)
  return DATE_MODE_LABELS[date.mode]
}

/**
 * 筛选行尾巴上的激活项 chips（顺序：标签 → 日期 → 优先级 → 关键词）。
 * 标签按传入 `tags` 查名；找不到的 id 静默跳过（标签被删后筛选里的残留 id）。
 */
export function activeFilterChips(f: FilterDTO, tags: TagDTO[]): ActiveChip[] {
  const chips: ActiveChip[] = []
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  f.tagIds.forEach((id) => {
    const tag = byId.get(id)
    if (tag) chips.push({ key: 'tag:' + id, kind: 'tag', label: tag.name })
  })
  const dateLabel = dateChipLabel(f)
  if (dateLabel) chips.push({ key: 'date', kind: 'date', label: dateLabel })
  f.priorities.forEach((priority) => {
    chips.push({
      key: 'priority:' + priority,
      kind: 'priority',
      label: PRIORITY_LABELS[priority] || zh.filter.priority
    })
  })
  const keyword = f.keyword.trim()
  if (keyword) chips.push({ key: 'keyword', kind: 'keyword', label: zh.filter.keywordChip(keyword) })
  return chips
}

/** 移除一个 chip（按 key）；未知 key 原样返回一个新对象 */
export function removeChip(f: FilterDTO, key: string): FilterDTO {
  if (key === 'date') {
    return { ...f, date: { mode: 'any' } }
  }
  if (key === 'keyword') {
    return { ...f, keyword: '' }
  }
  if (key.indexOf('tag:') === 0) {
    const id = key.slice(4)
    return { ...f, tagIds: f.tagIds.filter((tagId) => tagId !== id) }
  }
  if (key.indexOf('priority:') === 0) {
    const priority = Number(key.slice(9)) as TaskPriority
    return { ...f, priorities: f.priorities.filter((item) => item !== priority) }
  }
  return { ...f }
}

/**
 * 设置日期筛选（不可变）：非 custom 模式忽略/清掉 from、to；
 * custom 时把区间（本地日期键 YYYY-MM-DD）带上。
 */
export function setDate(
  f: FilterDTO,
  mode: FilterDateMode,
  range?: { from?: string; to?: string }
): FilterDTO {
  if (mode === 'custom') {
    const next: FilterDTO['date'] = { mode }
    if (range && range.from) next.from = range.from
    if (range && range.to) next.to = range.to
    return { ...f, date: next }
  }
  return { ...f, date: { mode } }
}

/* ---------- 区间 ---------- */

export interface PeriodRange {
  /** 起始（含） */
  from: number
  /** 结束（不含）：日期边界都是右开，便于 `due < to` 比较 */
  to: number
}

/**
 * 今天 / 明天 / 本周的本地时间区间（右开）：
 * - today → [今天 00:00, 明天 00:00)
 * - tomorrow → [明天 00:00, 后天 00:00)
 * - week → [本周一 00:00, 下周一 00:00)（即周日 24:00 结束，docs/03 §4）
 * 逾期不在区间模式里：判定是 `due < now && !done`（含同日已过），用 `lib/date.ts` 的 isOverdue。
 */
export function periodRange(mode: 'today' | 'tomorrow' | 'week', now: number): PeriodRange {
  if (mode === 'today') {
    const from = dayStart(now)
    return { from, to: from + DAY }
  }
  if (mode === 'tomorrow') {
    const from = addDays(dayStart(now), 1)
    return { from, to: from + DAY }
  }
  return { from: startOfWeek(now), to: endOfWeek(now) }
}
