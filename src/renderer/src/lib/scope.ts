/**
 * 视图作用域与列表分组（九视图 + 五维筛选 + 状态 Tab）
 *
 * 契约：
 * - docs/01-PRD.md FR-2.2（左栏九视图与计数口径）、FR-2.4（待办/已完成分组）、FR-4（五维筛选）
 * - docs/03-DATA-MODEL.md §4（筛选 JSON、今天/本周/逾期/收件箱口径）
 * - docs/04-TECH-DESIGN.md（排序：逾期优先 → 截止升序 → 优先级降序 → 创建升序；已完成按完成时间降序）
 *
 * 说明：IPC `tasks:list` 的 FilterDTO 无法表达「收件箱 / 即将到期 / 保存视图的九视图作用域」，
 * 因此渲染层一次性拉全部任务（tasks:list status=all），在本地按本模块计算作用域与筛选；
 * 即时生效、跨窗口一致，数据量级（1000 条）下开销可忽略。SQL 侧过滤仍由 main/filterSql.ts 提供并被其单测覆盖。
 */
import type { FilterDTO, SavedViewDTO, TagDTO, TaskDTO, TaskPriority } from '../../../shared/types'
import { addDays, dateKey, dayStart, endOfWeek, fmtHM, isOverdue, startOfWeek } from './date'

export type Nav =
  | { type: 'inbox' | 'today' | 'overdue' | 'upcoming' | 'done' }
  | { type: 'project'; id: string }
  | { type: 'tag'; id: string }
  | { type: 'saved'; id: string; name: string; filter: FilterDTO }

export type Tab = 'all' | 'todo' | 'done'

export type SavedView = SavedViewDTO

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { 0: 0, 1: 1, 2: 2, 3: 3 }

/** 视图作用域（九视图口径；不含筛选与状态 Tab） */
export function scopeTasks(tasks: TaskDTO[], nav: Nav, now: number): TaskDTO[] {
  const today = dayStart(now)
  switch (nav.type) {
    case 'inbox':
      /* 收件箱 B 口径：无日期且无项目；标签不影响归属 */
      return tasks.filter((task) => task.dueAt === null && task.projectId === null)
    case 'today':
      return tasks.filter((task) => {
        if (task.dueAt === null) return false
        const dueDay = dayStart(task.dueAt)
        if (task.status === 0) return dueDay <= today
        if (dueDay === today) return true
        return task.completedAt !== null && dayStart(task.completedAt) === today
      })
    case 'overdue':
      return tasks.filter((task) => isOverdue(task.dueAt, task.status === 1, now))
    case 'upcoming': {
      const weekEnd = addDays(today, 7)
      return tasks.filter(
        (task) => task.status === 0 && task.dueAt !== null && dayStart(task.dueAt) > today && dayStart(task.dueAt) <= weekEnd
      )
    }
    case 'done':
      return tasks.filter((task) => task.status === 1)
    case 'project':
      return tasks.filter((task) => task.projectId === nav.id)
    case 'tag':
      return tasks.filter((task) => task.tagIds.includes(nav.id))
    case 'saved':
      return tasks
  }
}

/** 日期筛选匹配（today/tomorrow/week 用本地日边界，overdue 用统一逾期判定，custom 用日期键区间） */
function matchesDate(task: TaskDTO, filter: FilterDTO, now: number): boolean {
  const date = filter.date
  if (date.mode === 'any') return true
  if (date.mode === 'overdue') return isOverdue(task.dueAt, task.status === 1, now)
  if (task.dueAt === null) return false
  const dueDay = dayStart(task.dueAt)
  const today = dayStart(now)
  if (date.mode === 'today') return dueDay === today
  if (date.mode === 'tomorrow') return dueDay === addDays(today, 1)
  if (date.mode === 'week') return dueDay >= startOfWeek(now) && dueDay < endOfWeek(now)
  /* custom：from/to 为本地日期键，闭区间 */
  const key = dateKey(dueDay)
  if (date.from && key < date.from) return false
  if (date.to && key > date.to) return false
  return true
}

/**
 * 五维筛选（状态维度由 applyTab 处理，这里只处理日期 / 标签 / 优先级 / 关键词）。
 * 标签维度对项目 id 与标签 id 一视同仁（OR），与原型 applyFilters 的 projectIds+tagIds 语义一致。
 */
export function applyFilter(tasks: TaskDTO[], filter: FilterDTO, now: number): TaskDTO[] {
  const keyword = filter.keyword.trim().toLowerCase()
  return tasks.filter((task) => {
    if (keyword) {
      const hay = (task.title + ' ' + (task.note ?? '')).toLowerCase()
      if (!hay.includes(keyword)) return false
    }
    if (filter.tagIds.length > 0) {
      const projectHit = task.projectId !== null && filter.tagIds.includes(task.projectId)
      const tagHit = task.tagIds.some((id) => filter.tagIds.includes(id))
      if (!projectHit && !tagHit) return false
    }
    if (!matchesDate(task, filter, now)) return false
    if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) return false
    return true
  })
}

/** 状态 Tab */
export function applyTab(tasks: TaskDTO[], tab: Tab): TaskDTO[] {
  if (tab === 'todo') return tasks.filter((task) => task.status === 0)
  if (tab === 'done') return tasks.filter((task) => task.status === 1)
  return tasks
}

/** 待办排序：逾期优先 → 截止时间升序 → 优先级降序 → 创建时间升序 */
export function sortPending(tasks: TaskDTO[], now: number): TaskDTO[] {
  return tasks
    .filter((task) => task.status === 0)
    .slice()
    .sort((a, b) => {
      const ao = isOverdue(a.dueAt, a.status === 1, now) ? 0 : 1
      const bo = isOverdue(b.dueAt, b.status === 1, now) ? 0 : 1
      if (ao !== bo) return ao - bo
      const ad = a.dueAt ?? Number.POSITIVE_INFINITY
      const bd = b.dueAt ?? Number.POSITIVE_INFINITY
      if (ad !== bd) return ad - bd
      const ap = PRIORITY_WEIGHT[a.priority] ?? 0
      const bp = PRIORITY_WEIGHT[b.priority] ?? 0
      if (ap !== bp) return bp - ap
      return a.createdAt - b.createdAt || a.id.localeCompare(b.id)
    })
}

/** 已完成排序：完成时间降序 */
export function sortDone(tasks: TaskDTO[]): TaskDTO[] {
  return tasks
    .filter((task) => task.status === 1)
    .slice()
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt) || a.id.localeCompare(b.id))
}

export interface GroupedTasks {
  pending: TaskDTO[]
  done: TaskDTO[]
}

/** 分组：待办（排序）与已完成（排序），已完成可折叠 */
export function groupTasks(tasks: TaskDTO[], now: number): GroupedTasks {
  return { pending: sortPending(tasks, now), done: sortDone(tasks) }
}

export interface Progress {
  done: number
  total: number
  percent: number
}

/** 进度环：作用域内（未筛选）完成比例 */
export function progressOf(tasks: TaskDTO[]): Progress {
  const total = tasks.length
  const done = tasks.filter((task) => task.status === 1).length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export interface TabCounts {
  all: number
  todo: number
  done: number
}

export function tabCounts(tasks: TaskDTO[]): TabCounts {
  let done = 0
  for (const task of tasks) if (task.status === 1) done += 1
  return { all: tasks.length, todo: tasks.length - done, done }
}

export interface NavCounts {
  inbox: number
  today: number
  overdue: number
  upcoming: number
  done: number
  projects: Record<string, number>
  tags: Record<string, number>
}

/** 左栏九视图计数（口径：前五项只算未完成；已完成算全部已完成；项目/标签算未完成） */
export function navCounts(tasks: TaskDTO[], now: number): NavCounts {
  const today = dayStart(now)
  const weekEnd = addDays(today, 7)
  const counts: NavCounts = {
    inbox: 0,
    today: 0,
    overdue: 0,
    upcoming: 0,
    done: 0,
    projects: {},
    tags: {}
  }
  for (const task of tasks) {
    if (task.status === 1) {
      counts.done += 1
      continue
    }
    if (task.dueAt === null) {
      if (task.projectId === null) counts.inbox += 1
    } else {
      const dueDay = dayStart(task.dueAt)
      if (dueDay <= today) counts.today += 1
      if (isOverdue(task.dueAt, false, now)) counts.overdue += 1
      if (dueDay > today && dueDay <= weekEnd) counts.upcoming += 1
    }
    if (task.projectId !== null) {
      counts.projects[task.projectId] = (counts.projects[task.projectId] ?? 0) + 1
    }
    for (const tagId of task.tagIds) {
      counts.tags[tagId] = (counts.tags[tagId] ?? 0) + 1
    }
  }
  return counts
}

/** 胶囊/挂件副标题用：最近一条待办（逾期优先 → 时间升序） */
export function nextPending(tasks: TaskDTO[], now: number): TaskDTO | null {
  const pending = sortPending(tasks, now)
  return pending.length > 0 ? pending[0] : null
}

/** 时间文案（HH:mm），给胶囊副标题用 */
export function pendingTime(task: TaskDTO): string {
  return task.dueAt === null ? '' : fmtHM(task.dueAt)
}
