/**
 * 1000 条任务性能测试（docs/07 H.87：滚动/筛选不低于验收指标，主进程列表目标 <300ms）
 * 用 :memory: 库，避免污染 %APPDATA%；只测数据层耗时，UI 滚动帧率需真机 GUI 冒烟。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FilterDTO, TaskPriority } from '../../shared/types'
import { closeDatabase, openDatabase } from '../db'
import { createTag } from './tags'
import { createTask, listTasks } from './tasks'

const TASK_COUNT = 1000
const HOUR = 60 * 60 * 1000

function filterOf(partial: Partial<FilterDTO>): FilterDTO {
  return partial as FilterDTO
}

let projectId = ''
let tagId = ''

beforeAll(() => {
  openDatabase({ dbPath: ':memory:' })
})

afterAll(() => {
  closeDatabase()
})

describe('1000 条任务性能', () => {
  it('全量列表与带筛选列表均 <300ms', () => {
    const base = Date.now()
    projectId = createTag({ name: '采购', kind: 'project' }).id
    tagId = createTag({ name: '模具', kind: 'tag' }).id

    const insertStart = performance.now()
    for (let index = 0; index < TASK_COUNT; index += 1) {
      createTask({
        title: `性能任务 ${index} ${index % 10 === 0 ? '采购 模具' : ''}`,
        note: index % 5 === 0 ? '含关键字：采购与模具' : `说明 ${index}`,
        priority: (index % 4) as TaskPriority,
        dueAt: index % 3 === 0 ? base + (index - TASK_COUNT / 2) * HOUR : null,
        tagIds: index % 2 === 0 ? [tagId] : [],
        projectId: index % 7 === 0 ? projectId : null
      })
    }
    const insertMs = performance.now() - insertStart

    const fullStart = performance.now()
    const all = listTasks({ filter: filterOf({ status: 'all' }) })
    const fullMs = performance.now() - fullStart
    expect(all.length).toBe(TASK_COUNT)

    const filteredStart = performance.now()
    const filtered = listTasks({
      filter: filterOf({ status: 'todo', keyword: '采购', tagIds: [tagId] })
    })
    const filteredMs = performance.now() - filteredStart
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.length).toBeLessThan(TASK_COUNT)

    const scopedStart = performance.now()
    const todayView = listTasks({ viewId: 'today', filter: filterOf({ status: 'todo' }) })
    const scopedMs = performance.now() - scopedStart

    // 实测值写入测试输出，供验收报告引用
    console.log(
      `[perf] 插入 ${TASK_COUNT} 条：${insertMs.toFixed(1)}ms；全量列表 ${fullMs.toFixed(2)}ms（${all.length} 行）；` +
        `筛选列表 ${filteredMs.toFixed(2)}ms（${filtered.length} 行）；today 视图 ${scopedMs.toFixed(2)}ms（${todayView.length} 行）`
    )

    expect(fullMs).toBeLessThan(300)
    expect(filteredMs).toBeLessThan(300)
    expect(scopedMs).toBeLessThan(300)
  }, 30000)
})
