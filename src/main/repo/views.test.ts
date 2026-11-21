/**
 * repo/views 集成测试（真实 SQLite :memory:）
 * 覆盖：新建/更新/列表顺序、筛选归一化持久化、
 *       filter_json 损坏时的安全回落、删除、导入重建。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, getDb, openDatabase } from '../db'
import { deleteView, getView, listViews, replaceAllViews, saveView } from './views'

const todoFilter = {
  status: 'todo' as const,
  date: { mode: 'any' as const },
  tagIds: [],
  priorities: [],
  keyword: ''
}

beforeEach(() => {
  openDatabase({ dbPath: ':memory:' })
})

afterEach(() => {
  closeDatabase()
})

describe('saveView / listViews', () => {
  it('新建视图：名称 trim、sort_order 递增、filter 归一化后持久化', () => {
    const first = saveView({
      name: '  采购本周  ',
      filter: {
        status: 'todo',
        date: { mode: 'week' },
        tagIds: ['p-buy'],
        priorities: [],
        keyword: ''
      }
    })
    expect(first.name).toBe('采购本周')
    expect(first.sortOrder).toBe(0)
    expect(first.filter.date).toEqual({ mode: 'week' })

    const second = saveView({ name: '全部', filter: todoFilter })
    expect(second.sortOrder).toBe(1)

    expect(listViews().map((view) => view.name)).toEqual(['采购本周', '全部'])
  })

  it('custom 日期兼容 ms 时间戳，统一存成 YYYY-MM-DD 日期键', () => {
    const from = new Date(2024, 4, 1).getTime()
    const to = new Date(2024, 4, 31).getTime()
    const view = saveView({
      name: '自定义区间',
      filter: { ...todoFilter, date: { mode: 'custom', from: String(from), to: String(to) } }
    })
    expect(view.filter.date).toEqual({ mode: 'custom', from: '2024-05-01', to: '2024-05-31' })
  })

  it('带 id 更新名称与筛选，不改 sortOrder/createdAt；不存在时报错', () => {
    const created = saveView({ name: '旧视图', filter: todoFilter })
    const updated = saveView({
      id: created.id,
      name: '新视图',
      filter: { ...todoFilter, status: 'done', keyword: '周报' }
    })
    expect(updated).toMatchObject({
      id: created.id,
      name: '新视图',
      sortOrder: created.sortOrder,
      createdAt: created.createdAt
    })
    expect(updated.filter.status).toBe('done')
    expect(updated.filter.keyword).toBe('周报')
    expect(getView(created.id)?.name).toBe('新视图')

    expect(() => saveView({ id: 'missing', name: 'x', filter: todoFilter })).toThrow('视图不存在')
    expect(() => saveView({ name: '  ', filter: todoFilter })).toThrow('视图名称不能为空')
  })
})

describe('getView / deleteView', () => {
  it('不存在返回 null；删除幂等且从列表移除', () => {
    const created = saveView({ name: '视图', filter: todoFilter })
    expect(getView(created.id)?.name).toBe('视图')
    expect(deleteView(created.id)).toEqual({ ok: true })
    expect(getView(created.id)).toBeNull()
    expect(deleteView(created.id)).toEqual({ ok: true })
    expect(listViews()).toEqual([])
  })
})

describe('损坏 filter_json 的安全回落', () => {
  it('无法解析时返回默认 FilterDTO，而不是抛错', () => {
    getDb()
      .prepare(
        'INSERT INTO views (id, name, filter_json, sort_order, created_at) VALUES (?, ?, ?, 0, ?)'
      )
      .run('broken-view', '损坏视图', '{not-json', Date.now())

    const views = listViews()
    expect(views).toHaveLength(1)
    expect(views[0].id).toBe('broken-view')
    expect(views[0].filter).toEqual({
      status: 'todo',
      date: { mode: 'any' },
      tagIds: [],
      priorities: [],
      keyword: ''
    })
  })
})

describe('replaceAllViews（导入用）', () => {
  it('清空后按传入顺序重建并归一化 filter', () => {
    saveView({ name: '旧视图', filter: todoFilter })
    replaceAllViews([
      { name: '采购本周', filter: { ...todoFilter, date: { mode: 'week' }, tagIds: ['p-buy'] } },
      { name: '已完成', filter: { ...todoFilter, status: 'done' } }
    ])
    const views = listViews()
    expect(views.map((view) => view.name)).toEqual(['采购本周', '已完成'])
    expect(views[0].sortOrder).toBe(0)
    expect(views[0].filter.tagIds).toEqual(['p-buy'])
    expect(views[1].filter.status).toBe('done')
  })
})
