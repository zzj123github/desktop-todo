/**
 * 演示数据种子 · 主进程
 *
 * 用法：`pnpm seed` → scripts/seed.cjs 从 workspace 外启动 Electron 并带 `--seed`；
 * src/main/index.ts 在 whenReady 后检测到 `--seed` 时调用 runSeed()，完成后退出。
 * 正式首启绝不自动导入（seed.json 的 note 也写明）。
 *
 * 数据来源：resources/seed.json（tags/tasks/savedViews/settings 的演示模板）
 * 额外补足到 11 条任务（要求 8-12 条），日期全部相对当前时间，
 * 并包含失效的本地/UNC 路径示例（用于验收 E 的 missing 提示）。
 */
import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FilterDTO } from '../shared/types'
import { importDatabase } from './db'
import type { ExportBundle, ExportLink, ExportTag, ExportTask, ExportView } from './db'
import { normalizeFilter } from './filterSql'
import { DEFAULT_SETTINGS } from './settings'

interface SeedLink {
  kind: string
  target: string
  display?: string
}

interface SeedTask {
  id: string
  title: string
  note?: string
  status?: number
  priority?: number
  dueAt?: string | number | null
  tags?: string[]
  links?: SeedLink[]
}

interface SeedTag {
  id: string
  name: string
  color: string
  kind: string
}

interface SeedView {
  name: string
  filter: FilterDTO
}

interface SeedFile {
  note?: string
  tags?: SeedTag[]
  tasks?: SeedTask[]
  savedViews?: SeedView[]
  settings?: Record<string, unknown>
}

export interface SeedResult {
  count: number
  tasks: number
  tags: number
  views: number
}

/** 补足演示任务的模板（日期字符串由 parseRelativeDue 转成绝对时间戳） */
const EXTRA_TASKS: SeedTask[] = [
  {
    id: 't7',
    title: '整理供应商年度审核材料',
    note: '对照附件清单核对营业执照与质量体系证书有效期。',
    priority: 2,
    dueAt: '本周五 14:00',
    tags: ['供应商'],
    links: [
      {
        kind: 'folder',
        target: '\\\\fileserver\\供应商\\年度审核',
        display: '审核材料'
      }
    ]
  },
  {
    id: 't8',
    title: '回复客户模具变更申请',
    note: '确认变更对模具寿命和交期的影响，再给出正式答复。',
    priority: 1,
    dueAt: '明天 16:00',
    tags: ['项目A', '模具'],
    links: [
      {
        kind: 'folder',
        target: '\\\\fileserver\\项目A\\已归档\\不存在目录',
        display: '失效路径示例'
      }
    ]
  },
  {
    id: 't9',
    title: '归档 Q2 采购合同',
    priority: 0,
    status: 1,
    tags: ['采购'],
    links: [
      {
        kind: 'url',
        target: 'https://supplier.company.com/contracts',
        display: '合同归档'
      }
    ]
  },
  {
    id: 't10',
    title: '盘点模具库位',
    note: '重点核对 A 区 3 号库位与报废待处理区。',
    priority: 2,
    dueAt: '逾期 2 天',
    tags: ['模具'],
    links: [
      {
        kind: 'file',
        target: 'C:\\Users\\lazasons\\Documents\\模具台账.xlsx',
        display: '模具台账'
      }
    ]
  },
  {
    id: 't11',
    title: '准备季度复盘会议',
    note: '汇总本季度交付、采购与模具维护三块数据。',
    priority: 3,
    dueAt: '今天 18:00',
    tags: ['项目A'],
    links: [
      {
        kind: 'url',
        target: 'https://wiki.company.com/dept/review',
        display: '复盘模板'
      }
    ]
  }
]

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 本周一 0 点（周一为一周第一天，与 filterSql 的 week 口径一致） */
function startOfWeek(now: number): number {
  const dayStart = startOfDay(now)
  const weekday = new Date(dayStart).getDay()
  const offset = weekday === 0 ? 6 : weekday - 1
  return dayStart - offset * DAY_MS
}

const WEEKDAY_INDEX: Record<string, number> = {
  一: 0,
  二: 1,
  三: 2,
  四: 3,
  五: 4,
  六: 5,
  日: 6,
  天: 6
}

function at(dayStart: number, hours: number, minutes: number): number {
  return dayStart + hours * 60 * 60 * 1000 + minutes * 60 * 1000
}

/** 把 seed.json 里的相对日期描述转成 epoch ms（本地时区） */
export function parseRelativeDue(raw: string | number | null | undefined, now = Date.now()): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const text = raw.trim()
  if (!text) return null
  const dayStart = startOfDay(now)

  const today = /^今天(?:\s*(\d{1,2}):(\d{2}))?$/.exec(text)
  if (today) return at(dayStart, Number(today[1] ?? 9), Number(today[2] ?? 0))

  const tomorrow = /^明天(?:\s*(\d{1,2}):(\d{2}))?$/.exec(text)
  if (tomorrow) return at(dayStart + DAY_MS, Number(tomorrow[1] ?? 9), Number(tomorrow[2] ?? 0))

  const overdue = /^逾期\s*(\d+)\s*天$/.exec(text)
  if (overdue) return at(dayStart - Number(overdue[1]) * DAY_MS, 10, 0)

  const week = /^本周([一二三四五六日天])(?:\s*(\d{1,2}):(\d{2}))?$/.exec(text)
  if (week) {
    const index = WEEKDAY_INDEX[week[1]]
    return at(startOfWeek(now) + index * DAY_MS, Number(week[2] ?? 9), Number(week[3] ?? 0))
  }

  const daysLater = /^(\d+)\s*天后$/.exec(text)
  if (daysLater) return at(dayStart + Number(daysLater[1]) * DAY_MS, 9, 0)

  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? null : parsed
}

/** 默认种子文件路径：resources/seed.json（打包后位于 asar 内，仍可用 readFileSync） */
export function seedFilePath(): string {
  return join(app.getAppPath(), 'resources', 'seed.json')
}

export function loadSeedFile(filePath = seedFilePath()): SeedFile {
  let text: string
  try {
    text = readFileSync(filePath, 'utf8')
  } catch {
    throw new Error(`未找到种子数据文件：${filePath}`)
  }
  try {
    return JSON.parse(text) as SeedFile
  } catch {
    throw new Error(`种子数据文件不是合法 JSON：${filePath}`)
  }
}

function resolveTaskTagIds(
  names: string[],
  tagByName: Map<string, { id: string; kind: string }>
): { projectId: string | null; tagIds: string[] } {
  let projectId: string | null = null
  const tagIds: string[] = []
  for (const name of names) {
    const tag = tagByName.get(name.trim())
    if (!tag) continue
    if (tag.kind === 'project') {
      if (!projectId) projectId = tag.id
      continue
    }
    if (!tagIds.includes(tag.id)) tagIds.push(tag.id)
  }
  return { projectId, tagIds }
}

function toExportLinks(links: SeedLink[] | undefined): ExportLink[] {
  return (links ?? [])
    .filter((link) => typeof link.target === 'string' && link.target.trim().length > 0)
    .map((link, index) => ({
      kind: link.kind === 'url' || link.kind === 'folder' || link.kind === 'file' ? link.kind : 'folder',
      target: link.target,
      display: link.display ?? '',
      sortOrder: index,
      lastCheckedAt: null
    }))
}

/**
 * 组装可直接交给 importDatabase 的 v1 导出包。
 * 纯函数（无 Electron 依赖），便于单元测试；now 可注入。
 */
export function buildSeedBundle(seed: SeedFile, now = Date.now()): ExportBundle {
  const tags: ExportTag[] = (seed.tags ?? []).map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    kind: tag.kind === 'project' ? 'project' : 'tag'
  }))
  const tagByName = new Map(tags.map((tag) => [tag.name, { id: tag.id, kind: tag.kind }]))

  const rawTasks = [...(seed.tasks ?? []), ...EXTRA_TASKS]
  const tasks: ExportTask[] = rawTasks.map((task, index) => {
    const createdAt = now - (rawTasks.length - index) * 2 * 60 * 60 * 1000
    const status = task.status === 1 ? 1 : 0
    const dueAt = parseRelativeDue(task.dueAt, now)
    const tagNames = task.tags ?? []
    const { projectId, tagIds } = resolveTaskTagIds(tagNames, tagByName)
    return {
      id: task.id,
      title: task.title,
      note: task.note ?? '',
      status,
      priority: Math.min(3, Math.max(0, Math.trunc(task.priority ?? 0))),
      dueAt,
      createdAt,
      updatedAt: createdAt,
      completedAt: status === 1 ? now - (index + 1) * 3 * 60 * 60 * 1000 : null,
      sortOrder: index,
      projectId,
      tagIds,
      tags: tagNames,
      links: toExportLinks(task.links)
    }
  })

  const views: ExportView[] = (seed.savedViews ?? []).map((view, index) => ({
    id: `view-seed-${index + 1}`,
    name: view.name,
    filter: normalizeFilter(view.filter),
    sortOrder: index,
    createdAt: now
  }))

  return {
    version: 1,
    exportedAt: now,
    tasks,
    tags,
    views,
    settings: { ...DEFAULT_SETTINGS, ...(seed.settings ?? {}) }
  }
}

/** --seed 入口：导入演示数据；调用方负责在完成后退出 app */
export function runSeed(options: { now?: number; filePath?: string } = {}): SeedResult {
  const now = options.now ?? Date.now()
  const seed = loadSeedFile(options.filePath ?? seedFilePath())
  const bundle = buildSeedBundle(seed, now)
  const { count } = importDatabase(bundle)
  return { count, tasks: bundle.tasks.length, tags: bundle.tags.length, views: bundle.views.length }
}
