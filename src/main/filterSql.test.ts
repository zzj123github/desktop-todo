/**
 * filterSql 单元测试（纯函数，不碰 DB）
 * 覆盖：筛选归一化（含 custom 的日期键/ms 双格式）、WHERE 参数化、内置视图 scope、排序。
 */
import { describe, expect, it } from 'vitest'
import type { FilterDTO } from '../shared/types'
import {
  addDays,
  buildFilterWhere,
  buildScopeWhere,
  dateKey,
  escapeLike,
  isBuiltinViewId,
  normalizeFilter,
  parseDateKey,
  startOfDay,
  startOfWeek,
  taskOrderBy
} from './filterSql'

/** 固定“当前时间”：2024-05-15（周三）10:00 本地时间 */
const NOW = new Date(2024, 4, 15, 10, 0, 0, 0).getTime()
const TODAY = startOfDay(NOW)

function todayKey(): string {
  return dateKey(NOW)
}

describe('日期工具', () => {
  it('startOfDay / addDays / startOfWeek 按本地时区计算', () => {
    expect(startOfDay(NOW)).toBe(TODAY)
    expect(addDays(TODAY, 1) - TODAY).toBe(24 * 60 * 60 * 1000)
    // 2024-05-15 是周三，周一为 05-13
    const monday = startOfWeek(NOW)
    expect(new Date(monday).getDay()).toBe(1)
    expect(monday).toBe(TODAY - 2 * 24 * 60 * 60 * 1000)
  })

  it('dateKey 与 parseDateKey 可互逆', () => {
    expect(todayKey()).toBe('2024-05-15')
    expect(parseDateKey('2024-05-15')).toBe(TODAY)
    expect(parseDateKey('not-a-date')).toBeNull()
    expect(parseDateKey('2024-13-01')).toBeNull()
  })
})

describe('normalizeFilter', () => {
  it('缺省/非法输入回落到 todo + any 的默认筛选', () => {
    expect(normalizeFilter(undefined)).toEqual({
      status: 'todo',
      date: { mode: 'any' },
      tagIds: [],
      priorities: [],
      keyword: ''
    })
    expect(normalizeFilter({ status: 'nope', date: { mode: 'nope' } })).toMatchObject({
      status: 'todo',
      date: { mode: 'any' }
    })
  })

  it('custom 日期支持 ms 时间戳与本地日期键两种来源', () => {
    const fromMs = normalizeFilter({
      date: { mode: 'custom', from: new Date(2024, 4, 1).getTime(), to: new Date(2024, 4, 31).getTime() }
    })
    expect(fromMs.date).toEqual({ mode: 'custom', from: '2024-05-01', to: '2024-05-31' })

    const fromKey = normalizeFilter({ date: { mode: 'custom', from: '2024-05-02', to: '2024-05-03' } })
    expect(fromKey.date).toEqual({ mode: 'custom', from: '2024-05-02', to: '2024-05-03' })
  })

  it('tagIds 去重、priorities 只留 0..3 的整数并排序、keyword 保留原文', () => {
    const filter: FilterDTO = normalizeFilter({
      tagIds: ['a', 'a', '', 1, 'b'],
      priorities: [2, 0, 2, 3, 9, -1],
      keyword: '  周报  '
    })
    expect(filter.tagIds).toEqual(['a', 'b'])
    expect(filter.priorities).toEqual([0, 2, 3])
    expect(filter.keyword).toBe('  周报  ')
  })
})

describe('buildFilterWhere', () => {
  it('status / date / tagIds / priorities / keyword 全部参数化拼接', () => {
    const filter: FilterDTO = {
      status: 'todo',
      date: { mode: 'today' },
      tagIds: ['tag-1'],
      priorities: [2, 3],
      keyword: '模具 100%'
    }
    const sql = buildFilterWhere(filter, NOW)
    expect(sql.where).toBe(
      "1=1 AND t.status = 0 AND t.due_at >= ? AND t.due_at < ? AND EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id IN (?)) AND t.priority IN (?, ?) AND (t.title LIKE ? ESCAPE '\\' OR t.note LIKE ? ESCAPE '\\')"
    )
    expect(sql.params).toEqual([
      TODAY,
      addDays(TODAY, 1),
      'tag-1',
      2,
      3,
      '%模具 100\\%%',
      '%模具 100\\%%'
    ])
  })

  it('status=all 不加状态条件；date=any 不加日期条件', () => {
    const sql = buildFilterWhere(
      { status: 'all', date: { mode: 'any' }, tagIds: [], priorities: [], keyword: '' },
      NOW
    )
    expect(sql.where).toBe('1=1')
    expect(sql.params).toEqual([])
  })

  it('status=done 只查已完成；custom 区间右开（to 当天含全天）', () => {
    const done = buildFilterWhere(
      { status: 'done', date: { mode: 'any' }, tagIds: [], priorities: [], keyword: '' },
      NOW
    )
    expect(done.where).toContain('t.status = 1')

    const custom = buildFilterWhere(
      {
        status: 'all',
        date: { mode: 'custom', from: dateKey(NOW), to: dateKey(NOW) },
        tagIds: [],
        priorities: [],
        keyword: ''
      },
      NOW
    )
    expect(custom.where).toContain('t.due_at >= ?')
    expect(custom.where).toContain('t.due_at < ?')
    expect(custom.params).toEqual([TODAY, addDays(TODAY, 1)])
  })

  it('keyword 中的 LIKE 通配符被转义', () => {
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d')
  })
})

describe('buildScopeWhere（内置视图）', () => {
  it('inbox = 无日期且无项目', () => {
    const sql = buildScopeWhere('inbox', NOW)
    expect(sql.where).toContain('t.due_at IS NULL')
    expect(sql.where).toContain("sg.kind = 'project'")
    expect(sql.params).toEqual([])
  })

  it('overdue = 未完成且 due_at < 当前时刻（同一天已过也算）', () => {
    const sql = buildScopeWhere('overdue', NOW)
    expect(sql.where).toContain('t.status = 0')
    expect(sql.params).toEqual([NOW])
  })

  it('today / upcoming 使用本地日边界', () => {
    expect(buildScopeWhere('today', NOW).params).toEqual([
      addDays(TODAY, 1),
      TODAY,
      TODAY,
      addDays(TODAY, 1)
    ])
    expect(buildScopeWhere('upcoming', NOW).params).toEqual([addDays(TODAY, 1), addDays(TODAY, 8)])
  })

  it('done = 已完成；isBuiltinViewId 只认五个内置 id', () => {
    expect(buildScopeWhere('done', NOW).where).toBe('1=1 AND t.status = 1')
    for (const id of ['inbox', 'today', 'overdue', 'upcoming', 'done']) {
      expect(isBuiltinViewId(id)).toBe(true)
    }
    expect(isBuiltinViewId('saved-view-1')).toBe(false)
    expect(isBuiltinViewId(null)).toBe(false)
  })
})

describe('taskOrderBy', () => {
  it('待办：无日期在后、due 升序、priority 降序、created 升序', () => {
    expect(taskOrderBy('todo')).toBe('(t.due_at IS NULL) ASC, t.due_at ASC, t.priority DESC, t.created_at ASC')
    expect(taskOrderBy('all')).toContain('(t.due_at IS NULL) ASC')
    expect(taskOrderBy('done')).toBe('t.completed_at DESC, t.created_at ASC')
  })
})
