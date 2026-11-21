/**
 * repo/tags 集成测试（真实 SQLite :memory:）
 * 覆盖：创建默认值/校验、重名冲突、listTags 分组与未完成计数、
 *       重命名、删除影响面（供渲染层撤销）、ensureTag 幂等。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, openDatabase } from '../db'
import { createTask, toggleTask } from './tasks'
import { createTag, deleteTag, ensureTag, getTag, listTags, renameTag } from './tags'

beforeEach(() => {
  openDatabase({ dbPath: ':memory:' })
})

afterEach(() => {
  closeDatabase()
})

describe('createTag', () => {
  it('默认颜色/类型、名称 trim', () => {
    const tag = createTag({ name: '  模具  ', kind: 'tag' })
    expect(tag).toMatchObject({ name: '模具', color: '#C7A98C', kind: 'tag', pendingCount: 0 })

    const project = createTag({ name: '项目A', kind: 'project', color: '#A9B39A' })
    expect(project).toMatchObject({ name: '项目A', color: '#A9B39A', kind: 'project' })
  })

  it('非法颜色回落默认色；空名/超长名报错', () => {
    expect(createTag({ name: 'a', kind: 'tag', color: 'red' }).color).toBe('#C7A98C')
    expect(() => createTag({ name: '   ', kind: 'tag' })).toThrow('名称不能为空')
    expect(() => createTag({ name: 'x'.repeat(51), kind: 'tag' })).toThrow('不能超过 50')
  })

  it('跨项目/标签重名校验（name 全局唯一）', () => {
    createTag({ name: '同名', kind: 'tag' })
    expect(() => createTag({ name: '同名', kind: 'project' })).toThrow('已存在同名项目或标签：同名')
  })
})

describe('listTags / getTag', () => {
  it('按 tags/projects 分组，pendingCount 只算未完成任务', () => {
    const tag = createTag({ name: '模具', kind: 'tag' })
    const project = createTag({ name: '项目A', kind: 'project' })

    createTask({ title: '未完成 1', tagIds: [tag.id], projectId: project.id })
    createTask({ title: '未完成 2', tagIds: [tag.id] })
    const done = createTask({ title: '已完成', tagIds: [tag.id], projectId: project.id })
    toggleTask(done.id, true)

    const lists = listTags()
    expect(lists.tags.map((item) => item.name)).toEqual(['模具'])
    expect(lists.projects.map((item) => item.name)).toEqual(['项目A'])
    expect(lists.tags[0].pendingCount).toBe(2)
    expect(lists.projects[0].pendingCount).toBe(1)
    expect(getTag(tag.id)?.pendingCount).toBe(2)
    expect(getTag('missing')).toBeNull()
  })
})

describe('renameTag', () => {
  it('重命名成功并返回最新 DTO；重名与不存在的 id 报错', () => {
    const tag = createTag({ name: '模具', kind: 'tag' })
    const other = createTag({ name: '供应商', kind: 'tag' })

    expect(renameTag(tag.id, '  模具库  ')).toMatchObject({ id: tag.id, name: '模具库' })
    expect(() => renameTag(tag.id, other.name)).toThrow('已存在同名项目或标签：供应商')
    expect(() => renameTag('missing', 'x')).toThrow('项目或标签不存在')
  })
})

describe('deleteTag', () => {
  it('返回影响数与 taskIds，并移除任务关联（任务本身保留）', () => {
    const tag = createTag({ name: '模具', kind: 'tag' })
    const project = createTag({ name: '项目A', kind: 'project' })
    const pendingTask = createTask({ title: '未完成', tagIds: [tag.id] })
    const doneTask = createTask({ title: '已完成', tagIds: [tag.id], projectId: project.id })
    toggleTask(doneTask.id, true)

    const result = deleteTag(tag.id)
    expect(result.ok).toBe(true)
    expect(result.impact).toEqual({ total: 2, pending: 1 })
    expect(result.record).toMatchObject({ id: tag.id, name: '模具', kind: 'tag' })
    expect(result.taskIds.sort()).toEqual([pendingTask.id, doneTask.id].sort())

    expect(getTag(tag.id)).toBeNull()
    expect(listTags().tags).toEqual([])
    expect(() => deleteTag(tag.id)).toThrow('项目或标签不存在')

    const lists = listTags()
    expect(lists.projects).toHaveLength(1)
  })

  it('删除项目也会移除任务上的项目关联', () => {
    const project = createTag({ name: '项目A', kind: 'project' })
    const task = createTask({ title: '任务', projectId: project.id })
    deleteTag(project.id)
    expect(listTags().projects).toEqual([])
    expect(createTask({ title: '新任务' }).id).toBeTruthy()
    expect(task.id).toBeTruthy()
  })
})

describe('ensureTag（导入/种子用）', () => {
  it('按名称幂等，不重复创建；可指定未被占用的 id', () => {
    const first = ensureTag('模具', 'tag')
    const second = ensureTag('模具', 'project', '#000000')
    expect(second).toBe(first)
    expect(listTags().tags.map((item) => item.name)).toEqual(['模具'])

    const custom = ensureTag('采购', 'project', '#A9B39A', 'p-buy')
    expect(custom).toBe('p-buy')
    expect(getTag('p-buy')?.kind).toBe('project')
  })
})
