import { describe, expect, it } from 'vitest'
import type { FilterDTO, TagDTO } from '../../../shared/types'
import {
  activeFilterChips,
  filterCounts,
  emptyFilter,
  isFilterActive,
  periodRange,
  removeChip,
  setDate
} from './filters'

/** 固定基准：2026-11-21（周六）13:05 本地时间 */
const NOW = new Date(2026, 10, 21, 13, 5, 0, 0).getTime()
const at = (y: number, mo: number, d: number, h = 0, mi = 0): number =>
  new Date(y, mo - 1, d, h, mi, 0, 0).getTime()

const tag = (id: string, name: string): TagDTO => ({
  id,
  name,
  color: '#888888',
  kind: 'tag'
})
const TAGS: TagDTO[] = [tag('t1', '工作'), tag('t2', '生活')]

function filter(patch: Partial<FilterDTO> = {}): FilterDTO {
  return { ...emptyFilter(), ...patch }
}

describe('emptyFilter / isFilterActive / filterCounts', () => {
  it('emptyFilter 返回默认筛选（待办 + 不限日期 + 空条件）', () => {
    expect(emptyFilter()).toEqual({
      status: 'todo',
      date: { mode: 'any' },
      tagIds: [],
      priorities: [],
      keyword: ''
    })
  })

  it('每次返回新对象，互不影响', () => {
    const a = emptyFilter()
    a.tagIds.push('t1')
    expect(emptyFilter().tagIds).toEqual([])
  })

  it('空筛选不激活', () => {
    expect(isFilterActive(emptyFilter())).toBe(false)
    expect(filterCounts(emptyFilter())).toEqual({ status: 0, date: 0, tags: 0, priority: 0, total: 0 })
  })

  it('各维度分别计数，total 累加', () => {
    expect(
      filterCounts({
        status: 'done',
        date: { mode: 'today' },
        tagIds: ['t1', 't2'],
        priorities: [3, 1],
        keyword: '  报告  '
      })
    ).toEqual({ status: 1, date: 1, tags: 2, priority: 2, total: 7 })
    expect(
      filterCounts({ status: 'all', date: { mode: 'custom', from: '2026-11-01' }, tagIds: [], priorities: [], keyword: '' })
    ).toEqual({ status: 1, date: 1, tags: 0, priority: 0, total: 2 })
  })

  it('空白关键词不算激活', () => {
    expect(isFilterActive(filter({ keyword: '   ' }))).toBe(false)
    expect(isFilterActive(filter({ keyword: '周报' }))).toBe(true)
  })
})

describe('activeFilterChips', () => {
  it('顺序：标签 → 日期 → 优先级 → 关键词，label 按契约文案', () => {
    const f: FilterDTO = {
      status: 'todo',
      date: { mode: 'today' },
      tagIds: ['t1', 't2'],
      priorities: [3, 1],
      keyword: '周报 '
    }
    expect(activeFilterChips(f, TAGS)).toEqual([
      { key: 'tag:t1', kind: 'tag', label: '工作' },
      { key: 'tag:t2', kind: 'tag', label: '生活' },
      { key: 'date', kind: 'date', label: '今天' },
      { key: 'priority:3', kind: 'priority', label: '高' },
      { key: 'priority:1', kind: 'priority', label: '低' },
      { key: 'keyword', kind: 'keyword', label: '关键词「周报」' }
    ])
  })

  it('日期各模式文案：明天/本周/已逾期', () => {
    const label = (mode: FilterDTO['date']['mode']): string =>
      activeFilterChips(filter({ date: { mode } }), TAGS)[0].label
    expect(label('tomorrow')).toBe('明天')
    expect(label('week')).toBe('本周')
    expect(label('overdue')).toBe('已逾期')
  })

  it('custom 区间显示 from ~ to（单边与缺省兜底）', () => {
    const chips = (from?: string, to?: string): string =>
      activeFilterChips(filter({ date: { mode: 'custom', from, to } }), TAGS)[0].label
    expect(chips('2026-11-01', '2026-11-30')).toBe('2026-11-01 ~ 2026-11-30')
    expect(chips('2026-11-01', undefined)).toBe('2026-11-01 ~')
    expect(chips(undefined, '2026-11-30')).toBe('~ 2026-11-30')
    expect(chips(undefined, undefined)).toBe('自定义日期')
  })

  it('找不到的标签 id 静默跳过；date=any 不产生 chip', () => {
    expect(activeFilterChips(filter({ tagIds: ['missing'] }), TAGS)).toEqual([])
    expect(activeFilterChips(emptyFilter(), TAGS)).toEqual([])
  })

  it('优先级 0 是「无优先级」占位，label 回退为「优先级」', () => {
    const chips = activeFilterChips(filter({ priorities: [0] }), TAGS)
    expect(chips).toEqual([{ key: 'priority:0', kind: 'priority', label: '优先级' }])
  })
})

describe('removeChip / setDate（不可变更新）', () => {
  it('移除日期 chip 回到 any，并清掉 custom 区间', () => {
    const f = filter({ date: { mode: 'custom', from: '2026-11-01', to: '2026-11-30' } })
    const next = removeChip(f, 'date')
    expect(next.date).toEqual({ mode: 'any' })
    expect(f.date.mode).toBe('custom')
    expect(next).not.toBe(f)
  })

  it('移除标签 / 优先级 / 关键词', () => {
    const f = filter({ tagIds: ['t1', 't2'], priorities: [3, 2], keyword: '报告' })
    expect(removeChip(f, 'tag:t1').tagIds).toEqual(['t2'])
    expect(removeChip(f, 'priority:2').priorities).toEqual([3])
    expect(removeChip(f, 'keyword').keyword).toBe('')
    expect(f).toMatchObject({ tagIds: ['t1', 't2'], priorities: [3, 2], keyword: '报告' })
  })

  it('未知 key 返回等值新对象', () => {
    const f = filter({ tagIds: ['t1'] })
    const next = removeChip(f, 'nope')
    expect(next).toEqual(f)
    expect(next).not.toBe(f)
  })

  it('setDate 非 custom 模式忽略并清空 range', () => {
    const f = filter({ date: { mode: 'custom', from: '2026-11-01', to: '2026-11-30' } })
    expect(setDate(f, 'week').date).toEqual({ mode: 'week' })
    expect(setDate(f, 'any').date).toEqual({ mode: 'any' })
    // 非 custom 即使传了 range 也不保留
    expect(setDate(f, 'today', { from: '2026-11-01' }).date).toEqual({ mode: 'today' })
    expect(f.date.from).toBe('2026-11-01')
  })

  it('setDate custom 带上本地日期键', () => {
    const f = emptyFilter()
    expect(setDate(f, 'custom', { from: '2026-11-01', to: '2026-11-30' }).date).toEqual({
      mode: 'custom',
      from: '2026-11-01',
      to: '2026-11-30'
    })
    expect(setDate(f, 'custom').date).toEqual({ mode: 'custom' })
  })
})

describe('periodRange（右开区间）', () => {
  it('today → [今天 00:00, 明天 00:00)', () => {
    expect(periodRange('today', NOW)).toEqual({ from: at(2026, 11, 21), to: at(2026, 11, 22) })
  })

  it('tomorrow → [明天 00:00, 后天 00:00)', () => {
    expect(periodRange('tomorrow', NOW)).toEqual({ from: at(2026, 11, 22), to: at(2026, 11, 23) })
  })

  it('week → [本周一 00:00, 下周一 00:00)，覆盖周日 24:00', () => {
    expect(periodRange('week', NOW)).toEqual({ from: at(2026, 11, 16), to: at(2026, 11, 23) })
    // 周日仍属当周
    expect(periodRange('week', at(2026, 11, 22, 10, 0))).toEqual({
      from: at(2026, 11, 16),
      to: at(2026, 11, 23)
    })
    // 周一进入下一周
    expect(periodRange('week', at(2026, 11, 23, 0, 0))).toEqual({
      from: at(2026, 11, 23),
      to: at(2026, 11, 30)
    })
  })

  it('区间时长正确（today/tomorrow 1 天，week 7 天）', () => {
    const day = 86400000
    expect(periodRange('today', NOW).to - periodRange('today', NOW).from).toBe(day)
    expect(periodRange('tomorrow', NOW).to - periodRange('tomorrow', NOW).from).toBe(day)
    expect(periodRange('week', NOW).to - periodRange('week', NOW).from).toBe(7 * day)
  })

  it('与日期键对齐：本周区间包含周一到周日的每一天', () => {
    const { from, to } = periodRange('week', NOW)
    for (let i = 0; i < 7; i += 1) {
      const day = at(2026, 11, 16) + i * 86400000
      expect(day >= from && day < to).toBe(true)
    }
  })
})
