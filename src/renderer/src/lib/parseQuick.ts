/**
 * 快速输入解析（Composer 用）：从一行文本里摘出链接 / 路径、#标签、优先级、日期时间，剩余文本作标题。
 *
 * 行为基准：design/app/js/core.js 的 `DT.parseQuick` 与 `DT.detectLink`（文案、顺序、边界一致）。
 * 按规格修正的原型缺陷（docs/03-DATA-MODEL.md §5 路径输入）：
 * - 盘符路径同时接受 `C:\...` 与 `C:/...`（原型 pathRe 只匹配反斜杠）；
 * - `\\server\share\...` 双反斜杠 UNC 视为合法路径（原型 detectLink 的 UNC 正则多转义，漏判）；
 * - `file:///C:/...` 先转成本地盘符路径再按扩展名判断（原型不识别，docs/03 §5 明确要求）。
 * 纯函数：不改入参、不依赖 window / React / Node；时间由调用方传入 `now`。
 */
import type { LinkKind, TaskPriority } from '../../../shared/types'
import {
  addDays,
  atTime,
  dayStart,
  defaultDueAt,
  fmtHM,
  monthDay,
  nextSlot,
  sameDay,
  weekday
} from './date'

/**
 * 识别出的链接/路径。
 * `kind` 与 shared 的 `LinkKind` 相同；`target` 是要落库、要打开的位置（URL 原样或绝对路径）；
 * `display` 是展示名（网页去 scheme，文件/文件夹取 basename，均截断）。
 */
export interface DetectedLink {
  kind: LinkKind
  target: string
  display: string
}

/** parseQuick 的结果；`dueText` 是给 Composer 草稿显示用的短日期标签（今天/明天/M月D日，不含时刻） */
export interface ParsedQuick {
  title: string
  dueAt: number | null
  dueText: string | null
  priority: TaskPriority
  tagNames: string[]
  links: DetectedLink[]
}

export interface ParseQuickOptions {
  /**
   * 未输入日期词时的兜底到期时间。
   * - 不传该字段：用 `defaultDueAt(now)`（今天 18:00，已过则下一个未来半点，docs/02 §5.2）；
   * - 传 `null`：不设到期（收件箱等不预填日期的入口）。
   */
  defaultDue?: number | null
}

const URL_RE = /https?:\/\/[^\s，。；、]+/i
// 路径：UNC（\\server\share…）或盘符（C:\… / C:/…）；docs/03 §5 明确三种写法都合法
const PATH_RE = /(\\\\[^\s，。；]+|[A-Za-z]:[\\/][^\s，。；]+)/
const TAG_RE = /#([^\s#，。；]+)/g
const PRIORITY_RE = /(?:^|\s)(高|中|低)(?:优先级)?\s*$/
const DATE_RE =
  /(今天|明天|后天|大后天|本周[一二三四五六日天]|周[一二三四五六日天]|星期[一二三四五六日天])(?:\s*(\d{1,2})[:：](\d{2}))?/
const FILE_EXT_RE = /\.[A-Za-z0-9]{1,5}$/

const DOW_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0
}

const PRIORITY_MAP: Record<string, TaskPriority> = { 高: 3, 中: 2, 低: 1 }

/** 路径最后一段（去扩展名与否都原样取文件名，与原型一致） */
function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

function linkKindOfPath(path: string): LinkKind {
  return FILE_EXT_RE.test(path) ? 'file' : 'folder'
}

/**
 * `file:///C:/Users/a.txt` → `C:/Users/a.txt`（docs/03 §5：file URL 先转本地路径再判断类型）。
 * 只处理本地盘符形式；`file://server/share` 之类的网络 file URL 返回 null（不猜 UNC 主机映射）。
 */
function fileUrlToPath(raw: string): string | null {
  if (!/^file:\/\/\/[A-Za-z]:[\\/]/i.test(raw)) return null
  const rest = raw.replace(/^file:\/\/\//i, '')
  let decoded = rest
  try {
    decoded = decodeURIComponent(rest)
  } catch {
    decoded = rest
  }
  return /^[A-Za-z]:[\\/]/.test(decoded) ? decoded : null
}

/** 把文本里的本地 file URL 就地转成盘符路径，供后续 PATH_RE 识别 */
function normalizeFileUrls(text: string): string {
  return text.replace(/file:\/\/\/[^\s，。；]+/gi, (raw) => fileUrlToPath(raw) ?? raw)
}

/**
 * 按扩展名区分文件/文件夹；网页自动补 https://。
 * 支持 http(s)、`www.`、UNC（`\\` 或 `//`）、盘符路径，以及 `file:///C:/...`（先转本地路径，docs/03 §5）；
 * `javascript:` / `ftp:` / `mailto:` 等一律返回 null。
 */
export function detectLink(raw: string): DetectedLink | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const localPath = fileUrlToPath(s)
  if (localPath) {
    return { kind: linkKindOfPath(localPath), target: localPath, display: basename(localPath) }
  }
  if (/^https?:\/\//i.test(s)) {
    return { kind: 'url', target: s, display: s.replace(/^https?:\/\//i, '').slice(0, 44) }
  }
  if (/^www\./i.test(s)) {
    return { kind: 'url', target: 'https://' + s, display: s.slice(0, 44) }
  }
  if (/^(\\\\|\/\/)/.test(s)) {
    return { kind: linkKindOfPath(s), target: s, display: basename(s) }
  }
  if (/^[A-Za-z]:[\\/]/.test(s)) {
    return { kind: linkKindOfPath(s), target: s, display: basename(s) }
  }
  return null
}

/** 是否只有一个链接/路径的输入（Composer「只贴链接」场景，Lead 组件可直接用） */
export function isLinkOnly(raw: string): boolean {
  const s = String(raw ?? '').trim()
  if (!s) return false
  return detectLink(s) !== null
}

/** 到期时间的短日期标签（原型 `R.draftDueLabel`：今天 / 明天 / M月D日，不含时刻） */
export function draftDueLabel(dueAt: number | null, now: number): string {
  if (dueAt == null) return ''
  if (sameDay(dueAt, now)) return '今天'
  if (sameDay(dueAt, addDays(now, 1))) return '明天'
  return monthDay(dueAt)
}

/**
 * 解析一行快速输入（顺序与原型一致：URL → 路径 → #标签 → 优先级 → 日期时间 → 剩余文本作标题）。
 *
 * - 链接/路径/标签/优先级/日期词都会从标题中移除；标题空白折叠；
 * - 日期词可带 HH:mm（半角/全角冒号均可），显式时刻即使已过去也保留（原型行为）；
 * - 无日期词时到期时间取 `opts.defaultDue`；不给则 `defaultDueAt(now)`（今天 18:00 / 下一未来半点）；
 * - 标题为空时返回 `'新任务'`（契约；原型留空由 Composer 兜底）。
 */
export function parseQuick(
  input: string,
  now: number,
  opts: ParseQuickOptions = {}
): ParsedQuick {
  let s = String(input ?? '').trim()
  s = normalizeFileUrls(s)

  const links: DetectedLink[] = []
  const tagNames: string[] = []
  let priority: TaskPriority = 0
  let dueAt: number | null = null

  if (s) {
    const urlMatch = s.match(URL_RE)
    if (urlMatch) {
      const target = urlMatch[0]
      links.push({
        kind: 'url',
        target,
        display: target.replace(/^https?:\/\//i, '').slice(0, 38)
      })
      s = s.replace(URL_RE, ' ')
    }

    const pathMatch = s.match(PATH_RE)
    if (pathMatch) {
      const target = pathMatch[0]
      links.push({ kind: linkKindOfPath(target), target, display: basename(target) })
      s = s.replace(PATH_RE, ' ')
    }

    TAG_RE.lastIndex = 0
    let tagMatch: RegExpExecArray | null
    while ((tagMatch = TAG_RE.exec(s)) !== null) tagNames.push(tagMatch[1])
    s = s.replace(TAG_RE, ' ')

    const priorityMatch = s.match(PRIORITY_RE)
    if (priorityMatch) {
      priority = PRIORITY_MAP[priorityMatch[1]] ?? 0
      s = s.replace(PRIORITY_RE, ' ')
    }

    const dateMatch = s.match(DATE_RE)
    if (dateMatch) {
      const token = dateMatch[1]
      const base = dayStart(now)
      let targetDay: number | null = null
      if (token === '今天') targetDay = addDays(base, 0)
      else if (token === '明天') targetDay = addDays(base, 1)
      else if (token === '后天') targetDay = addDays(base, 2)
      else if (token === '大后天') targetDay = addDays(base, 3)
      else {
        const dow = DOW_MAP[token.slice(-1)]
        if (token.indexOf('本周') === 0) {
          const nowDow = new Date(base).getDay()
          const monday = addDays(base, -(nowDow === 0 ? 6 : nowDow - 1))
          targetDay = addDays(monday, (dow === 0 ? 7 : dow) - 1)
        } else {
          targetDay = addDays(base, (dow - new Date(base).getDay() + 7) % 7)
        }
      }
      if (targetDay != null) {
        if (dateMatch[2]) {
          targetDay = atTime(targetDay, parseInt(dateMatch[2], 10), parseInt(dateMatch[3], 10))
        } else if (sameDay(targetDay, now) && atTime(dayStart(now), 18, 0) < now) {
          targetDay = nextSlot(now)
        } else {
          targetDay = atTime(targetDay, 18, 0)
        }
        dueAt = targetDay
        s = s.replace(DATE_RE, ' ')
      }
    }
  }

  if (dueAt == null) {
    dueAt = opts.defaultDue === undefined ? defaultDueAt(now) : opts.defaultDue
  }

  const title = s.replace(/\s+/g, ' ').trim() || '新任务'

  return {
    title,
    dueAt,
    dueText: dueAt == null ? null : draftDueLabel(dueAt, now),
    priority,
    tagNames,
    links
  }
}

/**
 * 供 DateTimePicker / 行内日期展示复用：完整日期文案「11月25日 周三 09:00」（docs/02 §5.1），
 * `withTime=false` 时只到日（筛选日期、date 模式）。
 */
export function fmtDateTime(ts: number, withTime = true): string {
  const head = monthDay(ts) + ' ' + weekday(ts)
  return withTime ? head + ' ' + fmtHM(ts) : head
}
