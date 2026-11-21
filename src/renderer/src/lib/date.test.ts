import { describe, expect, it } from 'vitest'
import {
  DAY,
  MINUTE,
  addDays,
  atFuture,
  atTime,
  atToday,
  dateKey,
  dayStart,
  daysBetween,
  defaultDueAt,
  dueParts,
  endOfWeek,
  fmtDayTitle,
  fmtDue,
  fmtGap,
  fmtHM,
  isOverdue,
  monthDay,
  nextSlot,
  noteTimeUsage,
  quickTimes,
  quickTimesForDay,
  sameDay,
  startOfWeek,
  weekday,
  type TimeUsageMap
} from './date'

/** 固定基准：2026-11-21（周六）13:05 本地时间，测试不依赖真实时钟 */
const NOW = new Date(2026, 10, 21, 13, 5, 0, 0).getTime()
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number =>
  new Date(y, mo - 1, d, h, mi, s, ms).getTime()

describe('日期边界', () => {
  it('dayStart 归零到当天 00:00:00.000', () => {
    expect(dayStart(NOW)).toBe(at(2026, 11, 21))
    expect(dayStart(at(2026, 11, 21, 23, 59, 59, 999))).toBe(at(2026, 11, 21))
  })

  it('addDays 按日历日推进，跨月/跨年/负值正确', () => {
    expect(addDays(NOW, 1)).toBe(at(2026, 11, 22, 13, 5))
    expect(addDays(NOW, -1)).toBe(at(2026, 11, 20, 13, 5))
    expect(addDays(at(2026, 11, 30, 8, 0), 1)).toBe(at(2026, 12, 1, 8, 0))
    expect(addDays(at(2026, 12, 31, 8, 0), 1)).toBe(at(2027, 1, 1, 8, 0))
    expect(addDays(at(2027, 1, 1, 8, 0), -1)).toBe(at(2026, 12, 31, 8, 0))
  })

  it('sameDay 只看本地日期', () => {
    expect(sameDay(NOW, at(2026, 11, 21, 0, 0))).toBe(true)
    expect(sameDay(NOW, at(2026, 11, 21, 23, 59, 59, 999))).toBe(true)
    expect(sameDay(NOW, at(2026, 11, 22, 0, 0))).toBe(false)
    expect(sameDay(at(2026, 11, 21, 0, 0), at(2026, 11, 21, 23, 59))).toBe(true)
  })

  it('dateKey 生成补零的本地 YYYY-MM-DD', () => {
    expect(dateKey(NOW)).toBe('2026-11-21')
    expect(dateKey(at(2026, 1, 5))).toBe('2026-01-05')
    expect(dateKey(at(2026, 12, 31, 23, 59))).toBe('2026-12-31')
  })

  it('startOfWeek 取周一 00:00（周日归上一周）', () => {
    expect(startOfWeek(NOW)).toBe(at(2026, 11, 16))
    expect(startOfWeek(at(2026, 11, 16, 0, 0))).toBe(at(2026, 11, 16))
    // 周日属于当周最后一天，周起点仍是本周一
    expect(startOfWeek(at(2026, 11, 22, 10, 0))).toBe(at(2026, 11, 16))
    expect(startOfWeek(at(2026, 11, 23, 10, 0))).toBe(at(2026, 11, 23))
  })

  it('endOfWeek 是下周一 00:00（右开，覆盖周日 24:00）', () => {
    expect(endOfWeek(NOW)).toBe(at(2026, 11, 23))
    expect(endOfWeek(at(2026, 11, 22, 23, 59, 59, 999))).toBe(at(2026, 11, 23))
    expect(endOfWeek(NOW) - startOfWeek(NOW)).toBe(7 * DAY)
  })

  it('daysBetween 按日期差取整，a 晚于 b 为正', () => {
    expect(daysBetween(at(2026, 11, 22), at(2026, 11, 21))).toBe(1)
    expect(daysBetween(at(2026, 11, 21), at(2026, 11, 22))).toBe(-1)
    expect(daysBetween(at(2026, 11, 21, 23, 59), at(2026, 11, 21, 0, 1))).toBe(0)
    expect(daysBetween(at(2026, 11, 23, 23, 59), at(2026, 11, 21, 0, 1))).toBe(2)
  })
})

describe('文本格式', () => {
  it('fmtHM 输出补零 HH:mm', () => {
    expect(fmtHM(at(2026, 11, 21, 13, 5))).toBe('13:05')
    expect(fmtHM(at(2026, 11, 21, 0, 0))).toBe('00:00')
    expect(fmtHM(at(2026, 11, 21, 9, 7))).toBe('09:07')
    expect(fmtHM(at(2026, 11, 21, 23, 59))).toBe('23:59')
  })

  it('weekday 输出中文星期', () => {
    expect(weekday(NOW)).toBe('周六')
    expect(weekday(at(2026, 11, 22))).toBe('周日')
    expect(weekday(at(2026, 11, 23))).toBe('周一')
    expect(weekday(at(2026, 11, 27))).toBe('周五')
  })

  it('monthDay 输出 M月D日（不补零）', () => {
    expect(monthDay(NOW)).toBe('11月21日')
    expect(monthDay(at(2026, 1, 5))).toBe('1月5日')
    expect(monthDay(at(2026, 12, 31))).toBe('12月31日')
  })

  it('fmtDayTitle 输出「M月D日 周X」', () => {
    expect(fmtDayTitle(NOW)).toBe('11月21日 周六')
    expect(fmtDayTitle(at(2026, 11, 25))).toBe('11月25日 周三')
  })

  it('atTime / atToday 把时分写进指定日期', () => {
    expect(atTime(at(2026, 11, 25), 9, 30)).toBe(at(2026, 11, 25, 9, 30))
    expect(atToday(NOW, 18, 0)).toBe(at(2026, 11, 21, 18, 0))
  })
})

describe('nextSlot / defaultDueAt / atFuture', () => {
  it('nextSlot 取严格晚于 now 的下一个半点且秒清零', () => {
    expect(nextSlot(NOW)).toBe(at(2026, 11, 21, 13, 30))
    expect(nextSlot(at(2026, 11, 21, 13, 30))).toBe(at(2026, 11, 21, 14, 0))
    expect(nextSlot(at(2026, 11, 21, 13, 59))).toBe(at(2026, 11, 21, 14, 0))
    expect(nextSlot(at(2026, 11, 21, 13, 5, 42, 500))).toBe(at(2026, 11, 21, 13, 30))
    const slot = nextSlot(at(2026, 11, 21, 13, 5, 42, 500))
    expect(new Date(slot).getSeconds()).toBe(0)
    expect(new Date(slot).getMilliseconds()).toBe(0)
  })

  it('nextSlot 在深夜跨到次日（原型 23:45 返回空列表的修复依据）', () => {
    expect(nextSlot(at(2026, 11, 21, 23, 45))).toBe(at(2026, 11, 22, 0, 0))
    expect(nextSlot(at(2026, 11, 21, 23, 15))).toBe(at(2026, 11, 21, 23, 30))
  })

  it('defaultDueAt 默认今天 18:00，已过则下一个未来半点', () => {
    expect(defaultDueAt(NOW)).toBe(at(2026, 11, 21, 18, 0))
    expect(defaultDueAt(at(2026, 11, 21, 17, 59))).toBe(at(2026, 11, 21, 18, 0))
    expect(defaultDueAt(at(2026, 11, 21, 18, 0))).toBe(at(2026, 11, 21, 18, 30))
    expect(defaultDueAt(at(2026, 11, 21, 18, 0, 30))).toBe(at(2026, 11, 21, 18, 30))
    expect(defaultDueAt(at(2026, 11, 21, 23, 45))).toBe(at(2026, 11, 22, 0, 0))
    // 永不早于当前时刻（docs/02 §5.2）
    expect(defaultDueAt(at(2026, 11, 21, 18, 0, 30))).toBeGreaterThan(
      at(2026, 11, 21, 18, 0, 30)
    )
  })

  it('atFuture：今天 18:00，已过则退化为 nextSlot；明天 18:00 永远在未来', () => {
    expect(atFuture(NOW, 0, 18, 0)).toBe(at(2026, 11, 21, 18, 0))
    expect(atFuture(at(2026, 11, 21, 19, 0), 0, 18, 0)).toBe(at(2026, 11, 21, 19, 30))
    expect(atFuture(NOW, 1, 18, 0)).toBe(at(2026, 11, 22, 18, 0))
    expect(atFuture(NOW, 0, 9, 0)).toBe(at(2026, 11, 21, 13, 30))
  })
})

describe('quickTimes 快捷时间（固定 now = 2026-11-21 13:05）', () => {
  it('空使用记录：18:00 优先，再用最近未来半点补齐到 2 个', () => {
    // 09:00 / 12:00 已过被过滤，展示顺序是「默认候选 → 未来半点」，不是时间升序
    expect(quickTimes(NOW, {})).toEqual([at(2026, 11, 21, 18, 0), at(2026, 11, 21, 13, 30)])
    expect(quickTimes(NOW)).toEqual([at(2026, 11, 21, 18, 0), at(2026, 11, 21, 13, 30)])
  })

  it('常用时间（count≥2）按次数降序优先', () => {
    expect(quickTimes(NOW, { '20:00': 3 })).toEqual([
      at(2026, 11, 21, 20, 0),
      at(2026, 11, 21, 18, 0)
    ])
    expect(quickTimes(NOW, { '13:40': 5, '20:00': 2 })).toEqual([
      at(2026, 11, 21, 13, 40),
      at(2026, 11, 21, 20, 0)
    ])
  })

  it('次数 < 2 的不用；已过去的常用时间在今天被过滤', () => {
    expect(quickTimes(NOW, { '20:00': 1 })).toEqual([
      at(2026, 11, 21, 18, 0),
      at(2026, 11, 21, 13, 30)
    ])
    expect(quickTimes(NOW, { '09:00': 3, '12:00': 5 })).toEqual([
      at(2026, 11, 21, 18, 0),
      at(2026, 11, 21, 13, 30)
    ])
  })

  it('支持 {count,last} 结构：同次数按最近使用降序', () => {
    const usage: TimeUsageMap = {
      '15:00': { count: 2, last: 100 },
      '16:00': { count: 2, last: 200 }
    }
    expect(quickTimes(NOW, usage)).toEqual([at(2026, 11, 21, 16, 0), at(2026, 11, 21, 15, 0)])
  })

  it('纯数字形式没有 last 时用键插入顺序代替最近使用（越靠后越新）', () => {
    expect(quickTimes(NOW, { '20:00': 3, '18:30': 3 })).toEqual([
      at(2026, 11, 21, 18, 30),
      at(2026, 11, 21, 20, 0)
    ])
  })

  it('limit 可调（默认 2，DateTimePicker 固定 2）', () => {
    expect(quickTimes(NOW, {}, 3)).toEqual([
      at(2026, 11, 21, 18, 0),
      at(2026, 11, 21, 13, 30),
      at(2026, 11, 21, 14, 0)
    ])
  })

  it('深夜时未来半点跨到次日，不再返回空列表', () => {
    const late = at(2026, 11, 21, 23, 45)
    expect(quickTimes(late, {})).toEqual([at(2026, 11, 22, 0, 0), at(2026, 11, 22, 0, 30)])
    expect(quickTimes(late, { '23:50': 4 })).toEqual([
      at(2026, 11, 21, 23, 50),
      at(2026, 11, 22, 0, 0)
    ])
  })

  it('quickTimesForDay 为非今天日期不过滤过去、不补未来半点', () => {
    expect(quickTimesForDay(at(2026, 11, 22), NOW, {})).toEqual([
      at(2026, 11, 22, 9, 0),
      at(2026, 11, 22, 12, 0)
    ])
    // 仅 1 个默认候选时不会继续补（非今天无「未来半点」概念）
    expect(quickTimesForDay(at(2026, 11, 22), NOW, { '20:00': 3 })).toEqual([
      at(2026, 11, 22, 20, 0),
      at(2026, 11, 22, 9, 0)
    ])
  })

  it('非法 usage 键被静默跳过', () => {
    expect(quickTimes(NOW, { '99:99': 5, 'abc': 3 })).toEqual([
      at(2026, 11, 21, 18, 0),
      at(2026, 11, 21, 13, 30)
    ])
  })
})

describe('noteTimeUsage 使用记录', () => {
  it('不修改入参，返回新对象并累加次数', () => {
    const before: TimeUsageMap = { '09:00': { count: 1, last: 1 } }
    const after = noteTimeUsage(before, at(2026, 11, 21, 9, 0), at(2026, 11, 21, 13, 5))
    expect(after).not.toBe(before)
    expect(before).toEqual({ '09:00': { count: 1, last: 1 } })
    expect(after['09:00']).toEqual({ count: 2, last: at(2026, 11, 21, 13, 5) })
  })

  it('无到期时间时不记录', () => {
    const usage: TimeUsageMap = {}
    expect(noteTimeUsage(usage, null, NOW)).toBe(usage)
    expect(noteTimeUsage(usage, 0, NOW)).toBe(usage)
    expect(noteTimeUsage(usage, Number.NaN, NOW)).toBe(usage)
  })

  it('支持直接传 HH:mm 字符串（DateTimePicker onPickTime 回调）', () => {
    const usage: TimeUsageMap = {}
    const after = noteTimeUsage(usage, '14:30', NOW)
    expect(after['14:30']).toEqual({ count: 1, last: NOW })
    const padded = noteTimeUsage(after, '9:05', NOW + 1000)
    expect(padded['09:05']).toEqual({ count: 1, last: NOW + 1000 })
    expect(noteTimeUsage(padded, 'not-a-time', NOW)).toBe(padded)
    expect(noteTimeUsage(padded, '', NOW)).toBe(padded)
  })

  it('再次使用已有时间时移到末尾（键顺序即最近使用顺序）', () => {
    let usage: TimeUsageMap = {}
    usage = noteTimeUsage(usage, '09:00', 1)
    usage = noteTimeUsage(usage, '18:00', 2)
    expect(Object.keys(usage)).toEqual(['09:00', '18:00'])
    usage = noteTimeUsage(usage, '09:00', 3)
    expect(Object.keys(usage)).toEqual(['18:00', '09:00'])
    expect(usage['09:00']).toEqual({ count: 2, last: 3 })
  })

  it('最多保留 16 个键，淘汰最久未使用的', () => {
    let usage: TimeUsageMap = {}
    for (let i = 0; i < 16; i += 1) {
      usage = noteTimeUsage(usage, at(2026, 11, 21, 8, i * 2), i)
    }
    expect(Object.keys(usage).length).toBe(16)
    usage = noteTimeUsage(usage, at(2026, 11, 21, 23, 0), 999)
    const keys = Object.keys(usage)
    expect(keys.length).toBe(16)
    expect(keys).toContain('23:00')
    expect(keys).not.toContain('08:00')
  })
})

describe('逾期判定与文案', () => {
  it('isOverdue：未完成且 due < now（同日已过也算）', () => {
    expect(isOverdue(at(2026, 11, 21, 9, 0), false, NOW)).toBe(true)
    expect(isOverdue(at(2026, 11, 21, 13, 5), false, NOW)).toBe(false)
    expect(isOverdue(at(2026, 11, 21, 18, 0), false, NOW)).toBe(false)
    expect(isOverdue(at(2026, 11, 21, 9, 0), true, NOW)).toBe(false)
    expect(isOverdue(null, false, NOW)).toBe(false)
  })

  it('fmtGap：分钟/小时/天，最小 1 分钟', () => {
    expect(fmtGap(20 * 1000)).toBe('1 分钟')
    expect(fmtGap(5 * MINUTE)).toBe('5 分钟')
    expect(fmtGap(90 * 1000)).toBe('2 分钟')
    expect(fmtGap(59 * MINUTE)).toBe('59 分钟')
    expect(fmtGap(7 * 60 * MINUTE)).toBe('7 小时')
    expect(fmtGap(90 * MINUTE)).toBe('2 小时')
    expect(fmtGap(23 * 60 * MINUTE)).toBe('23 小时')
    expect(fmtGap(24 * 60 * MINUTE)).toBe('1 天')
    expect(fmtGap(26 * 60 * MINUTE)).toBe('1 天')
    expect(fmtGap(2 * DAY)).toBe('2 天')
  })

  it('fmtDue：无日期 → 空字符串', () => {
    expect(fmtDue({ status: 0, dueAt: null, completedAt: null }, NOW)).toBe('')
  })

  it('fmtDue：已完成显示「完成于 HH:mm」', () => {
    expect(
      fmtDue({ status: 1, dueAt: at(2026, 11, 21, 9, 0), completedAt: at(2026, 11, 21, 13, 0) }, NOW)
    ).toBe('完成于 13:00')
    // completedAt 缺失时退回 dueAt
    expect(
      fmtDue({ status: 1, dueAt: at(2026, 11, 21, 9, 30), completedAt: null }, NOW)
    ).toBe('完成于 09:30')
  })

  it('fmtDue：同日逾期带「今天 HH:mm · 已逾期 X」', () => {
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 21, 9, 0), completedAt: null }, NOW)
    ).toBe('今天 09:00 · 已逾期 4 小时')
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 21, 12, 55), completedAt: null }, NOW)
    ).toBe('今天 12:55 · 已逾期 10 分钟')
  })

  it('fmtDue：跨日逾期显示「逾期 N 天」（至少 1 天）', () => {
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 20, 9, 0), completedAt: null }, NOW)
    ).toBe('逾期 1 天')
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 18, 9, 0), completedAt: null }, NOW)
    ).toBe('逾期 3 天')
    // 跨日但不足 24h 也按 1 天
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 20, 23, 59), completedAt: null }, NOW)
    ).toBe('逾期 1 天')
  })

  it('fmtDue：未逾期按今天/明天/周X/月日显示', () => {
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 21, 15, 0), completedAt: null }, NOW)
    ).toBe('今天 15:00')
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 22, 9, 0), completedAt: null }, NOW)
    ).toBe('明天 09:00')
    // 2–6 天：周几
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 23, 9, 0), completedAt: null }, NOW)
    ).toBe('周一 09:00')
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 27, 9, 0), completedAt: null }, NOW)
    ).toBe('周五 09:00')
    // 7 天及以上：月日
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 11, 28, 9, 0), completedAt: null }, NOW)
    ).toBe('11月28日 09:00')
    expect(
      fmtDue({ status: 0, dueAt: at(2026, 12, 4, 9, 0), completedAt: null }, NOW)
    ).toBe('12月4日 09:00')
  })

  it('dueParts 供 TaskRow：已完成 → 已完成，无日期 → 空，逾期带标记', () => {
    expect(
      dueParts({ status: 1, dueAt: at(2026, 11, 21, 9, 0), completedAt: at(2026, 11, 21, 13, 0) }, NOW)
    ).toEqual({ text: '已完成', overdue: false })
    expect(dueParts({ status: 0, dueAt: null, completedAt: null }, NOW)).toEqual({
      text: '',
      overdue: false
    })
    expect(
      dueParts({ status: 0, dueAt: at(2026, 11, 21, 9, 0), completedAt: null }, NOW)
    ).toEqual({ text: '今天 09:00 · 已逾期 4 小时', overdue: true })
    expect(
      dueParts({ status: 0, dueAt: at(2026, 11, 22, 9, 0), completedAt: null }, NOW)
    ).toEqual({ text: '明天 09:00', overdue: false })
  })
})
