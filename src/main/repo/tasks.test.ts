/**
 * repo/tasks 集成测试（真实 SQLite :memory:）
 * 覆盖：创建/读取、字段校验、更新（含 links 全量替换保留 id）、勾选/取消、
 *       删除级联、任务列表筛选与排序、内置视图 scope、已保存视图回落、托盘计数。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FilterDTO, TaskPriority } from '../../shared/types'
import { closeDatabase, getDb, openDatabase } from '../db'
import { createTag } from './tags'
import {
  countTodayPending,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  toggleTask,
  updateTask
} from './tasks'
import { saveView } from './views'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** 测试只关心部分筛选维度：repo 内部会 normalize 缺失字段 */
function filterOf(partial: Partial<FilterDTO>): FilterDTO {
  return partial as FilterDTO
}

let projectId = ''
let tagId = ''

function startOfToday(): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

beforeEach(() => {
  openDatabase({ dbPath: ':memory:' })
  projectId = createTag({ name: '项目A', kind: 'project', color: '#C7A98C' }).id
  tagId = createTag({ name: '模具', kind: 'tag' }).id
})

afterEach(() => {
  closeDatabase()
})

describe('createTask / getTask', () => {
  it('创建后返回完整 TaskDTO：默认值、项目与标签、链接显示名', () => {
    const now = Date.now()
    const task = createTask(
      {
        title: '  审核 IEOP 模具图纸 v3  ',
        note: '重点看 3.2 节',
        priority: 2,
        dueAt: now + 2 * HOUR,
        tagIds: [tagId, projectId],
        links: [
          { target: 'https://wiki.company.com/ieop/review' },
          { target: 'C:\\Users\\me\\Documents\\周报模板' }
        ]
      },
      now
    )

    expect(task.title).toBe('审核 IEOP 模具图纸 v3')
    expect(task.note).toBe('重点看 3.2 节')
    expect(task.status).toBe(0)
    expect(task.priority).toBe(2)
    expect(task.dueAt).toBe(now + 2 * HOUR)
    expect(task.createdAt).toBe(now)
    expect(task.updatedAt).toBe(now)
    expect(task.completedAt).toBeNull()
    expect(task.sortOrder).toBe(0)
    expect(task.projectId).toBe(projectId)
    expect(task.tagIds).toEqual([tagId])
    expect(task.links).toHaveLength(2)
    expect(task.links[0]).toMatchObject({
      kind: 'url',
      target: 'https://wiki.company.com/ieop/review',
      display: 'wiki.company.com',
      sortOrder: 0
    })
    expect(task.links[1]).toMatchObject({ kind: 'folder', display: '周报模板', sortOrder: 1 })

    expect(getTask(task.id)).toEqual(task)
  })

  it('标题必填、priority 夹到 0..3、无效链接抛结构化错误', () => {
    expect(() => createTask({ title: '   ' })).toThrow('任务标题不能为空')
    expect(createTask({ title: '低', priority: 0 }).priority).toBe(0)
    expect(createTask({ title: '超高', priority: 9 as unknown as TaskPriority }).priority).toBe(3)
    expect(() => createTask({ title: '危险', links: [{ target: 'javascript:alert(1)' }] })).toThrow(
      '不支持该链接类型'
    )
  })
})

describe('updateTask', () => {
  it('按字段修改 note/priority/dueAt，并刷新 updated_at', () => {
    const now = Date.now()
    const task = createTask({ title: '任务', priority: 1 }, now)
    const updated = updateTask(
      task.id,
      { note: '补充说明', priority: 0, dueAt: null },
      now + 5 * 60 * 1000
    )
    expect(updated).toMatchObject({
      title: '任务',
      note: '补充说明',
      priority: 0,
      dueAt: null,
      updatedAt: now + 5 * 60 * 1000
    })
  })

  it('links 为全量替换：带 id 保留原链接 id、缺失的删除、无 id 新增', () => {
    const task = createTask({
      title: '链接任务',
      links: [
        { target: 'https://a.example.com/one', display: '一' },
        { target: 'https://b.example.com/two', display: '二' }
      ]
    })
    const firstId = task.links[0].id
    const secondId = task.links[1].id

    const replaced = updateTask(task.id, {
      links: [
        { id: secondId, target: 'https://b.example.com/two-v2', display: '二·改' },
        { target: 'C:\\Users\\me\\Documents' }
      ]
    })

    expect(replaced.links).toHaveLength(2)
    expect(replaced.links.find((link) => link.id === firstId)).toBeUndefined()
    const kept = replaced.links.find((link) => link.id === secondId)
    expect(kept).toMatchObject({
      target: 'https://b.example.com/two-v2',
      display: '二·改',
      kind: 'url'
    })
    expect(replaced.links.some((link) => link.kind === 'folder')).toBe(true)
  })

  it('标签/项目整体替换；项目 id 混入 tagIds 时提升为项目；未知 id 报错', () => {
    const task = createTask({ title: '任务', tagIds: [tagId], projectId })
    const cleared = updateTask(task.id, { projectId: null })
    expect(cleared.projectId).toBeNull()
    expect(cleared.tagIds).toEqual([tagId])

    const promoted = updateTask(task.id, { tagIds: [projectId], projectId: null })
    expect(promoted.projectId).toBe(projectId)
    expect(promoted.tagIds).toEqual([])

    expect(() => updateTask(task.id, { tagIds: ['missing-tag'] })).toThrow('标签不存在')
    expect(() => updateTask(task.id, { projectId: tagId })).toThrow('项目不存在')
  })

  it('修改 title 为空或任务不存在时报错', () => {
    const task = createTask({ title: '任务' })
    expect(() => updateTask(task.id, { title: '  ' })).toThrow('任务标题不能为空')
    expect(() => updateTask('missing-task', { note: 'x' })).toThrow('任务不存在')
  })
})

describe('toggleTask / deleteTask', () => {
  it('勾选写 completed_at，取消勾选清空', () => {
    const now = Date.now()
    const task = createTask({ title: '任务' }, now)
    const done = toggleTask(task.id, true, now + HOUR)
    expect(done.status).toBe(1)
    expect(done.completedAt).toBe(now + HOUR)
    expect(done.updatedAt).toBe(now + HOUR)

    const undone = toggleTask(task.id, false, now + 2 * HOUR)
    expect(undone.status).toBe(0)
    expect(undone.completedAt).toBeNull()
    expect(undone.updatedAt).toBe(now + 2 * HOUR)
  })

  it('删除任务并级联删除链接/标签关联（幂等）', () => {
    const task = createTask({
      title: '待删',
      tagIds: [tagId],
      links: [{ target: 'https://example.com' }]
    })
    expect(deleteTask(task.id)).toEqual({ ok: true })
    expect(getTask(task.id)).toBeNull()
    expect(deleteTask(task.id)).toEqual({ ok: true })
    const linkCount = getDb()
      .prepare('SELECT COUNT(*) AS count FROM links WHERE task_id = ?')
      .get(task.id) as { count: number }
    expect(linkCount.count).toBe(0)
  })
})

describe('listTasks：筛选与排序', () => {
  function seedList(): { overdue: string; tomorrow: string; noDue: string; done: string } {
    const now = Date.now()
    const today = startOfToday()
    const overdue = createTask(
      { title: '逾期任务', priority: 0, dueAt: today - HOUR, projectId },
      now - 4 * HOUR
    )
    const tomorrow = createTask(
      { title: '明天任务', priority: 3, dueAt: today + DAY + HOUR, tagIds: [tagId] },
      now - 3 * HOUR
    )
    const noDue = createTask({ title: '无日期', priority: 2 }, now - 2 * HOUR)
    const done = createTask({ title: '已完成', priority: 3 }, now - HOUR)
    toggleTask(done.id, true, now)
    return { overdue: overdue.id, tomorrow: tomorrow.id, noDue: noDue.id, done: done.id }
  }

  it('待办排序：逾期在前、due 升序、无日期最后、priority 降序', () => {
    const { overdue, tomorrow, noDue } = seedList()
    const titles = listTasks({ filter: filterOf({ status: 'todo' }) }).map((task) => task.title)
    expect(titles).toEqual(['逾期任务', '明天任务', '无日期'])
    expect(listTasks().map((task) => task.id)).toEqual([overdue, tomorrow, noDue])
  })

  it('tagIds / priorities / keyword 过滤', () => {
    seedList()
    expect(
      listTasks({ filter: filterOf({ tagIds: [tagId] }) }).map((task) => task.title)
    ).toEqual(['明天任务'])
    expect(
      listTasks({ filter: filterOf({ priorities: [0, 2] }) }).map((task) => task.title)
    ).toEqual(['逾期任务', '无日期'])
    expect(
      listTasks({ filter: filterOf({ keyword: '明天' }) }).map((task) => task.title)
    ).toEqual(['明天任务'])
    expect(listTasks({ filter: filterOf({ keyword: '不存在' }) })).toEqual([])
  })

  it('status=done 只返回已完成，按 completed_at 倒序', () => {
    seedList()
    const doneTasks = listTasks({ filter: filterOf({ status: 'done' }) })
    expect(doneTasks.map((task) => task.title)).toEqual(['已完成'])
    expect(doneTasks[0].status).toBe(1)
  })
})

describe('listTasks：内置视图 scope', () => {
  let ids: Record<string, string>
  beforeEach(() => {
    const now = Date.now()
    const today = startOfToday()
    ids = {
      inbox: createTask({ title: '收件箱任务' }, now - 8 * HOUR).id,
      taggedNoDue: createTask({ title: '无日期但有标签', tagIds: [tagId] }, now - 7 * HOUR).id,
      // 今天早些时候（跨日也不会变：now-1h 一定早于当前时刻，属于「今天已过」）
      datedNoProject: createTask({ title: '有日期无项目', dueAt: now - HOUR }, now - 6 * HOUR).id,
      projectNoDue: createTask({ title: '有项目无日期', projectId }, now - 5 * HOUR).id,
      overdue: createTask({ title: '逾期', dueAt: today - DAY }, now - 4 * HOUR).id,
      upcoming: createTask({ title: '后天', dueAt: today + 2 * DAY }).id,
      donePast: createTask({ title: '昨日已完成', dueAt: today - DAY }).id
    }
    toggleTask(ids.donePast, true, now)
  })

  it('inbox = 无日期且无项目（标签不影响）', () => {
    const titles = listTasks({ viewId: 'inbox' }).map((task) => task.title).sort()
    expect(titles).toEqual(['收件箱任务', '无日期但有标签'])
  })

  it('overdue / upcoming / today 按时间戳与本地日边界', () => {
    // 逾期 = 未完成且 due_at < now（同一天已过也算），按 due 升序
    expect(listTasks({ viewId: 'overdue' }).map((task) => task.title)).toEqual([
      '逾期',
      '有日期无项目'
    ])
    expect(listTasks({ viewId: 'upcoming' }).map((task) => task.title)).toEqual(['后天'])
    // today 对未完成任务是「due_at < 明天 0 点」（含已逾期项），已完成任务不在此视图
    const todayTitles = listTasks({ viewId: 'today' }).map((task) => task.title).sort()
    expect(todayTitles).toEqual(['有日期无项目', '逾期'])
  })

  it('done 视图忽略 filter.status 的待办 tab（不会互斥成空）', () => {
    const tasks = listTasks({ viewId: 'done', filter: filterOf({ status: 'todo' }) })
    expect(tasks.map((task) => task.title)).toEqual(['昨日已完成'])
  })

  it('已保存视图：未显式传 filter 时使用 filter_json；显式 filter 优先', () => {
    const saved = saveView({
      name: '模具任务',
      filter: { status: 'todo', date: { mode: 'any' }, tagIds: [tagId], priorities: [], keyword: '' }
    })
    expect(
      listTasks({ viewId: saved.id }).map((task) => task.title)
    ).toEqual(['无日期但有标签'])

    const overridden = listTasks({
      viewId: saved.id,
      filter: { status: 'todo', date: { mode: 'any' }, tagIds: [], priorities: [], keyword: '逾期' }
    })
    expect(overridden.map((task) => task.title)).toEqual(['逾期'])
    expect(listTasks({ viewId: 'not-exist' })).toHaveLength(6)
  })
})

describe('countTodayPending（托盘 tooltip）', () => {
  it('统计未完成且 due_at < 明天 0 点，排除无日期与已完成', () => {
    const now = Date.now()
    const today = startOfToday()
    createTask({ title: '今天到期', dueAt: today + 2 * HOUR }, now)
    createTask({ title: '已逾期', dueAt: today - HOUR }, now)
    createTask({ title: '无日期' }, now)
    const done = createTask({ title: '已完成', dueAt: today + HOUR }, now)
    toggleTask(done.id, true, now)
    createTask({ title: '明天', dueAt: today + DAY + HOUR }, now)

    expect(countTodayPending()).toBe(2)
    expect(countTodayPending(today)).toBe(2)
  })
})
