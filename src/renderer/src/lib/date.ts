/**
 * 渲染层共享时间工具（纯函数，不依赖 React / window / Node）
 *
 * 行为基准：design/app/js/core.js 的 `DT.*`（日期键、格式化、快捷时间、逾期判定与文案）。
 * 规格：docs/02-DESIGN-SPEC.md §5.2/5.6（逾期、默认时间、快捷时间）、docs/03-DATA-MODEL.md §今天/本周/逾期。
 *
 * 约定：
 * - 所有时间参数与返回值都是 epoch 毫秒（number），日期按**本地时区**计算。
 * - 「本周」= 周一 00:00 起算；`endOfWeek` 返回下周一 00:00（右开区间，便于 `due < end` 比较）。
 * - 组件只拿到文案；文案与 core.js 一致，避免各视图各写一套。
 */

export const MINUTE = 60_000
export const DAY = 86_400_000

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

function pad2(n: number): string {
  return (n < 10 ? '0' : '') + n
}

function dateOf(ts: number): Date {
  return new Date(ts)
}

/* ---------- 日期边界 ---------- */

/** 当天 00:00:00.000 的时间戳 */
export function dayStart(ts: number): number {
  const d = dateOf(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 在 ts 所在日期上加减 n 天（保留时分秒，按日历日推进，跨月/跨年安全） */
export function addDays(ts: number, n: number): number {
  const d = dateOf(ts)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** 是否同一天（本地时区） */
export function sameDay(a: number, b: number): boolean {
  return dayStart(a) === dayStart(b)
}

/** 本地日期键 YYYY-MM-DD（筛选 custom 区间、跨日检测用） */
export function dateKey(ts: number): string {
  const d = dateOf(ts)
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

/** 本周一 00:00:00.000（周一为一周起点；周日属于当周最后一天） */
export function startOfWeek(ts: number): number {
  const base = dayStart(ts)
  const dow = dateOf(base).getDay() // 0=周日
  return addDays(base, -(dow === 0 ? 6 : dow - 1))
}

/** 下周一 00:00:00.000（右开区间；本周 = [startOfWeek, endOfWeek)） */
export function endOfWeek(ts: number): number {
  return addDays(startOfWeek(ts), 7)
}

/** 两个时间所在日期相差的天数：a 晚于 b 为正（原型 `DT.daysBetween`） */
export function daysBetween(a: number, b: number): number {
  return Math.round((dayStart(a) - dayStart(b)) / DAY)
}

/* ---------- 文本格式 ---------- */

/** 'HH:mm' */
export function fmtHM(ts: number): string {
  const d = dateOf(ts)
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}

/** '周三' */
export function weekday(ts: number): string {
  return WEEKDAY_NAMES[dateOf(ts).getDay()]
}

/** '11月25日' */
export function monthDay(ts: number): string {
  const d = dateOf(ts)
  return d.getMonth() + 1 + '月' + d.getDate() + '日'
}

/** '11月21日 周六'（挂件/视图副标题） */
export function fmtDayTitle(ts: number): string {
  return monthDay(ts) + ' ' + weekday(ts)
}

/** 把某个日期上的 h:m 换成时间戳（本地时区，秒/毫秒清零） */
export function atTime(day: number, h: number, m: number): number {
  const d = dateOf(day)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/** 今天 h:m 的时间戳 */
export function atToday(now: number, h: number, m: number): number {
  return atTime(dayStart(now), h, m)
}

/* ---------- 默认时间 / 未来半点 ---------- */

/**
 * 今天下一个未来半点（严格晚于 now，秒与毫秒清零）。
 * 13:05 → 13:30；13:30 → 14:00；23:45 → 次日 00:00（跨日按真实时间顺延）。
 */
export function nextSlot(now: number): number {
  const d = dateOf(now)
  d.setSeconds(0, 0)
  if (d.getMinutes() < 30) d.setMinutes(30)
  else d.setHours(d.getHours() + 1, 0, 0, 0)
  return d.getTime()
}

/**
 * 默认到期时间：今天 18:00 若已过（严格早于 now）则顺延到现在之后的下一个半点。
 * 对应 docs/02 §5.2「新建/快速添加的默认到期时间不得早于当前时刻」。
 */
export function defaultDueAt(now: number): number {
  const today18 = atToday(now, 18, 0)
  return today18 > now ? today18 : nextSlot(now)
}

/**
 * dayOffset 天后的 h:m；若该时刻已过去，退化为 nextSlot(now)。
 * 原型 `DT.atFuture`：今天视图默认 18:00、即将到期视图默认明天 18:00。
 */
export function atFuture(now: number, dayOffset: number, h = 18, m = 0): number {
  const target = atTime(addDays(dayStart(now), dayOffset), h, m)
  return target > now ? target : nextSlot(now)
}

/* ---------- 快捷时间 ---------- */

/** 使用记录值：兼容 `Record<string, count>`（任务契约）与 docs/02 的 `{count,last}` 结构 */
export type TimeUsageValue = number | { count?: number; last?: number }
export type TimeUsageMap = Record<string, TimeUsageValue | undefined>

const DEFAULT_QUICK_TIMES = ['09:00', '12:00', '18:00'] as const
const MAX_QUICK_SLOTS = 16

interface UsageEntry {
  label: string
  count: number
  last: number
}

/** 把 HH:mm 文本解析成数字；非法返回 null（prototype 对非法 key 静默跳过） */
function parseHM(hm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(hm.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null
  }
  return { h, m }
}

/**
 * 归一化使用记录：count 来自数字或 {count}；last 优先取 {last}，
 * 纯数字形式只有次数、没有时间戳，用对象键的插入顺序代替「最近使用」（越靠后越新）。
 */
function usageEntries(usage: TimeUsageMap): UsageEntry[] {
  return Object.keys(usage).map((label, order) => {
    const raw = usage[label]
    const count =
      typeof raw === 'number'
        ? raw
        : raw && typeof raw === 'object' && typeof raw.count === 'number'
          ? raw.count
          : 0
    const last =
      raw && typeof raw === 'object' && typeof raw.last === 'number' && Number.isFinite(raw.last)
        ? raw.last
        : order
    return { label, count, last }
  })
}

/**
 * 指定日期上的 2 个快捷时间（返回时间戳，按展示顺序排列，不是时间升序）：
 * 1. ui.timeUsage 中次数 ≥ 2 的项：次数降序、同次数最近使用降序；
 * 2. 不足时用 09:00 / 12:00 / 18:00 补；
 * 3. 该日期是今天时过滤已过去的时间，不足 2 个再用今天的未来半点补齐（可跨到次日）。
 *
 * 供 DateTimePicker 选中非今天日期时使用（此时不过滤过去时间）；契约签名 `quickTimes` 是它的 today 特例。
 */
export function quickTimesForDay(
  day: number,
  now: number,
  usage: TimeUsageMap = {},
  limit = 2
): number[] {
  const base = dayStart(day)
  const isToday = sameDay(base, now)
  const nowMinute = Math.floor(now / MINUTE) * MINUTE
  const out: number[] = []

  const push = (ts: number): void => {
    if (out.length >= limit || out.includes(ts)) return
    if (isToday && ts < nowMinute) return
    out.push(ts)
  }

  usageEntries(usage)
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .forEach((entry) => {
      const hm = parseHM(entry.label)
      if (hm) push(atTime(base, hm.h, hm.m))
    })

  DEFAULT_QUICK_TIMES.forEach((label) => {
    const hm = parseHM(label)
    if (hm) push(atTime(base, hm.h, hm.m))
  })

  if (isToday) {
    let slot = nextSlot(now)
    for (let guard = 0; out.length < limit && guard < MAX_QUICK_SLOTS; guard++) {
      push(slot)
      slot += 30 * MINUTE
    }
  }

  return out.slice(0, limit)
}

/**
 * 今天可用的 2 个快捷时间（时间戳，按展示顺序）。
 * 契约签名：`quickTimes(now: number, usage: Record<string, number>): number[]`；
 * usage 兼容 `{count,last}`（docs/02 §5.6），见 {@link TimeUsageMap}。
 */
export function quickTimes(now: number, usage: TimeUsageMap = {}, limit = 2): number[] {
  return quickTimesForDay(now, now, usage, limit)
}

/**
 * 记录一次实际使用的到期时刻（原型 `DT.noteTimeUsage`）。
 * `dueAt` 可传时间戳，也可直接传 `'HH:mm'`（DateTimePicker 的 `onPickTime(hhmm)` 回调）。
 * 返回新对象（不修改入参）；最多保留 16 个键，按最近使用淘汰最旧的。
 */
export function noteTimeUsage(
  usage: TimeUsageMap,
  dueAt: number | string | null,
  now: number = Date.now()
): TimeUsageMap {
  let label: string | null = null
  if (typeof dueAt === 'string') {
    const hm = parseHM(dueAt)
    if (hm) label = pad2(hm.h) + ':' + pad2(hm.m)
  } else if (typeof dueAt === 'number' && dueAt && Number.isFinite(dueAt)) {
    label = fmtHM(dueAt)
  }
  if (label == null) return usage
  const previous = usage[label]
  const prevCount =
    typeof previous === 'number'
      ? previous
      : previous && typeof previous === 'object' && typeof previous.count === 'number'
        ? previous.count
        : 0
  const next: TimeUsageMap = { ...usage }
  // 先删除再写入：对象键顺序即「最近使用」顺序，末尾为最近（纯数字 usage 也据此排序）
  delete next[label]
  next[label] = { count: prevCount + 1, last: now }
  const keys = Object.keys(next)
  if (keys.length <= 16) return next

  const lastOf = (key: string): number => {
    const entry = next[key]
    return entry && typeof entry === 'object' && typeof entry.last === 'number' ? entry.last : 0
  }
  keys
    .sort((a, b) => lastOf(a) - lastOf(b))
    .slice(0, keys.length - 16)
    .forEach((key) => {
      delete next[key]
    })
  return next
}

/* ---------- 逾期 / 到期文案 ---------- */

/** 未完成且到期时间早于 now 即逾期；同一天内已过时间也算（docs/02 §5.2） */
export function isOverdue(dueAt: number | null, done: boolean, now: number = Date.now()): boolean {
  return dueAt != null && !done && dueAt < now
}

/** 逾期时长文案：「N 分钟」「N 小时」「N 天」（与 core.js `DT.fmtGap` 一致） */
export function fmtGap(ms: number): string {
  const mins = Math.max(1, Math.round(ms / MINUTE))
  if (mins < 60) return mins + ' 分钟'
  const hours = Math.round(mins / 60)
  if (hours < 24) return hours + ' 小时'
  return Math.round(hours / 24) + ' 天'
}

/** 任务到期信息的最小结构（TaskDTO 的结构子集） */
export interface DueTask {
  status: 0 | 1
  dueAt: number | null
  completedAt: number | null
}

/**
 * 到期文案（与 core.js `DT.fmtDue` 一致）：
 * - 无日期 → ''
 * - 已完成 → '完成于 HH:mm'
 * - 逾期（同日）→ '今天 HH:mm · 已逾期 N 分钟/小时'
 * - 逾期（跨日）→ '逾期 N 天'
 * - 今天 / 明天 → '今天 HH:mm' / '明天 HH:mm'
 * - 2–6 天 → '周X HH:mm'；其余 → 'M月D日 HH:mm'
 */
export function fmtDue(task: DueTask, now: number = Date.now()): string {
  const dueAt = task.dueAt
  if (dueAt == null) return ''
  const done = task.status === 1
  if (done) return '完成于 ' + fmtHM(task.completedAt ?? dueAt)
  if (isOverdue(dueAt, false, now)) {
    const diff = daysBetween(now, dueAt) // 已过去的天数；同日为 0
    if (diff === 0) {
      return '今天 ' + fmtHM(dueAt) + ' · 已逾期 ' + fmtGap(now - dueAt)
    }
    return '逾期 ' + Math.max(1, diff) + ' 天'
  }
  const diff = daysBetween(dueAt, now)
  if (diff === 0) return '今天 ' + fmtHM(dueAt)
  if (diff === 1) return '明天 ' + fmtHM(dueAt)
  if (diff > 1 && diff < 7) return weekday(dueAt) + ' ' + fmtHM(dueAt)
  return monthDay(dueAt) + ' ' + fmtHM(dueAt)
}

/**
 * TaskRow 元信息：`{text, overdue}` 直接喂给行内 span。
 * 已完成任务按原型显示「已完成」（render.js `R.metaHtml`），其余交给 {@link fmtDue}；
 * 无日期且未完成返回空文案。
 */
export function dueParts(task: DueTask, now: number = Date.now()): { text: string; overdue: boolean } {
  if (task.status === 1) return { text: '已完成', overdue: false }
  if (task.dueAt == null) return { text: '', overdue: false }
  return { text: fmtDue(task, now), overdue: isOverdue(task.dueAt, false, now) }
}
