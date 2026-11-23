/**
 * db 集成测试（真实 SQLite，mkdtemp 临时目录，不写 %APPDATA%）
 * 覆盖：schema v1 表/索引、WAL 等 PRAGMA、meta.schema_version、损坏库备份重建、
 *       被删库重建、关闭/重开、导出/导入往返、导入校验原子性、事务回滚、checkpoint、
 *       环境变量（DESKTOP_TODO_DB / DESKTOP_TODO_DATA_DIR）路径覆盖。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { FilterDTO } from '../shared/types'
import {
  DB_FILE_NAME,
  SCHEMA_VERSION,
  checkpoint,
  closeDatabase,
  exportDatabase,
  getDb,
  getDbError,
  getDbPath,
  hasDatabase,
  importDatabase,
  isDbHealthy,
  openDatabase,
  resolveDataDir,
  resolveDbPath,
  transaction
} from './db'
import { createTag } from './repo/tags'
import { createTask, listTasks } from './repo/tasks'
import { saveView } from './repo/views'
import { getBooleanSetting, setSetting } from './settings'

/**
 * 本地路径夹具：链接目标由 classifyTarget 按运行平台校验，
 * Windows 用盘符路径、macOS/Linux 用 POSIX 绝对路径，保证测试跨平台跑同一套断言。
 */
const LOCAL_FOLDER_LABELED =
  process.platform === 'win32' ? 'C:\\Users\\me\\Documents\\周报模板' : '/Users/me/Documents/周报模板'

const HOUR = 60 * 60 * 1000
const originalDbEnv = process.env['DESKTOP_TODO_DB']
const originalDataDirEnv = process.env['DESKTOP_TODO_DATA_DIR']

let tempDir = ''
let dbPath = ''

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'desktop-todo-db-'))
}

function rowNames(sql: string): string[] {
  const rows = getDb().prepare(sql).all() as Array<{ name: string }>
  return rows.map((row) => row.name)
}

function countTasks(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }
  return row.n
}

function filterOf(partial: Partial<FilterDTO>): FilterDTO {
  return partial as FilterDTO
}

beforeEach(() => {
  delete process.env['DESKTOP_TODO_DB']
  delete process.env['DESKTOP_TODO_DATA_DIR']
  tempDir = makeTempDir()
  dbPath = path.join(tempDir, DB_FILE_NAME)
})

afterEach(() => {
  closeDatabase()
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  tempDir = ''
  dbPath = ''
  if (originalDbEnv === undefined) delete process.env['DESKTOP_TODO_DB']
  else process.env['DESKTOP_TODO_DB'] = originalDbEnv
  if (originalDataDirEnv === undefined) delete process.env['DESKTOP_TODO_DATA_DIR']
  else process.env['DESKTOP_TODO_DATA_DIR'] = originalDataDirEnv
})

describe('schema v1', () => {
  it('建表/索引齐全，meta.schema_version = 1', () => {
    const result = openDatabase({ dbPath })
    expect(result.healthy).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.dbPath).toBe(dbPath)
    expect(result.dataDir).toBe(path.dirname(dbPath))
    expect(hasDatabase()).toBe(true)
    expect(isDbHealthy()).toBe(true)

    const tables = rowNames("SELECT name FROM sqlite_master WHERE type = 'table'")
    expect(tables).toEqual(
      expect.arrayContaining(['meta', 'tasks', 'tags', 'task_tags', 'links', 'views', 'settings'])
    )

    const indexes = rowNames("SELECT name FROM sqlite_master WHERE type = 'index'")
    expect(indexes).toEqual(
      expect.arrayContaining(['idx_tasks_status_due', 'idx_tasks_due', 'idx_task_tags_tag', 'idx_links_task'])
    )

    const version = getDb()
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(version.value).toBe(String(SCHEMA_VERSION))
    expect(SCHEMA_VERSION).toBe(1)
  })

  it('WAL / foreign_keys / synchronous / busy_timeout 生效', () => {
    openDatabase({ dbPath })
    const db = getDb()
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    // synchronous = NORMAL 对应 1
    expect(db.pragma('synchronous', { simple: true })).toBe(1)
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000)
  })
})

describe('损坏库与被删库', () => {
  it('损坏库：重命名为 data.db.bak 后重建，健康状态与错误说明正确', () => {
    const garbage = Buffer.alloc(4096, 0x42)
    writeFileSync(dbPath, garbage)

    const result = openDatabase({ dbPath })
    expect(result.healthy).toBe(true)
    expect(result.db).not.toBeNull()
    expect(result.error).toContain('原数据库损坏')
    expect(result.error).toContain(`${DB_FILE_NAME}.bak`)

    const backupPath = `${dbPath}.bak`
    expect(existsSync(backupPath)).toBe(true)
    expect(readFileSync(backupPath).equals(garbage)).toBe(true)

    expect(isDbHealthy()).toBe(true)
    expect(getDbError()).toBe(result.error)
    expect(getDbPath()).toBe(dbPath)
    // 重建后的库可直接写入
    createTask({ title: '重建后新建任务' })
    expect(countTasks()).toBe(1)
  })

  it('数据库文件被删：重新打开时静默重建，healthy 且无 error', () => {
    openDatabase({ dbPath })
    createTask({ title: '删除前的任务' })
    closeDatabase()

    rmSync(dbPath, { force: true })
    expect(existsSync(dbPath)).toBe(false)

    const result = openDatabase({ dbPath })
    expect(result.healthy).toBe(true)
    expect(result.error).toBeUndefined()
    expect(isDbHealthy()).toBe(true)
    expect(getDbError()).toBeUndefined()
    expect(countTasks()).toBe(0)
  })
})

describe('关闭 / 重开 / checkpoint', () => {
  it('close 后连接失效；重开保留数据；checkpoint 截断 WAL', () => {
    openDatabase({ dbPath })
    createTask({ title: '持久化任务' })
    expect(countTasks()).toBe(1)

    checkpoint()
    const walPath = `${dbPath}-wal`
    if (existsSync(walPath)) expect(statSync(walPath).size).toBe(0)

    closeDatabase()
    expect(hasDatabase()).toBe(false)
    expect(isDbHealthy()).toBe(false)
    expect(() => getDb()).toThrow(/数据库不可用/)

    const reopened = openDatabase({ dbPath })
    expect(reopened.healthy).toBe(true)
    expect(countTasks()).toBe(1)
  })
})

describe('导出 / 导入', () => {
  it('导出 → 改动库 → 导入导出 bundle：任务/标签/视图/设置往返一致', () => {
    openDatabase({ dbPath })
    const now = Date.now()
    const project = createTag({ name: '项目A', kind: 'project', color: '#C7A98C' })
    const tag = createTag({ name: '模具', kind: 'tag', color: '#D9C7A7' })
    const created = createTask({
      title: '审核 IEOP 模具图纸 v3',
      note: '重点看 3.2 节',
      priority: 2,
      dueAt: now + 2 * HOUR,
      tagIds: [tag.id, project.id],
      links: [
        { target: 'https://wiki.company.com/ieop/review' },
        { target: LOCAL_FOLDER_LABELED }
      ]
    })
    saveView({
      name: '采购本周',
      filter: {
        status: 'todo',
        date: { mode: 'week' },
        tagIds: [tag.id],
        priorities: [],
        keyword: ''
      }
    })
    setSetting('alwaysOnTop', false)

    const bundle = exportDatabase()
    expect(bundle.version).toBe(1)
    expect(bundle.tasks).toHaveLength(1)
    const exported = bundle.tasks[0]!
    expect(exported).toMatchObject({
      id: created.id,
      title: '审核 IEOP 模具图纸 v3',
      note: '重点看 3.2 节',
      priority: 2,
      projectId: project.id
    })
    expect([...exported.tagIds].sort()).toEqual([tag.id])
    expect([...exported.tags].sort()).toEqual(['模具', '项目A'].sort())
    expect(exported.links.map((link) => link.kind).sort()).toEqual(['folder', 'url'])
    expect(bundle.tags).toHaveLength(2)
    expect(bundle.views).toHaveLength(1)
    expect(bundle.settings).toMatchObject({ alwaysOnTop: false })

    // 导入前多留一条干扰数据，导入应整体覆盖
    createTask({ title: '导入前多出的一条' })
    const imported = importDatabase(bundle)
    expect(imported.count).toBe(1)

    const after = exportDatabase()
    expect(after.tasks).toHaveLength(1)
    const restored = after.tasks[0]!
    expect(restored).toMatchObject({
      id: exported.id,
      title: exported.title,
      note: exported.note,
      status: exported.status,
      priority: exported.priority,
      dueAt: exported.dueAt,
      createdAt: exported.createdAt,
      updatedAt: exported.updatedAt,
      completedAt: exported.completedAt,
      sortOrder: exported.sortOrder,
      projectId: exported.projectId
    })
    expect([...restored.tagIds].sort()).toEqual([...exported.tagIds].sort())
    expect([...restored.tags].sort()).toEqual([...exported.tags].sort())
    expect(restored.links.map((link) => ({ id: link.id, kind: link.kind, target: link.target }))).toEqual(
      exported.links.map((link) => ({ id: link.id, kind: link.kind, target: link.target }))
    )
    expect(after.tags).toHaveLength(2)
    expect(after.views).toHaveLength(1)
    expect(after.settings).toEqual(bundle.settings)
    expect(getBooleanSetting('alwaysOnTop')).toBe(false)
  })

  it('兼容 docs/03 样例：只有 tasks[].tags 名称与 links 时自动建标签', () => {
    openDatabase({ dbPath })
    const imported = importDatabase({
      version: 1,
      exportedAt: Date.now(),
      tasks: [
        {
          title: '样例任务',
          tags: ['临时标签'],
          links: [{ kind: 'url', target: 'https://example.com/doc', display: '示例' }]
        }
      ]
    })
    expect(imported.count).toBe(1)
    const tasks = listTasks({ filter: filterOf({ status: 'all' }) })
    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.title).toBe('样例任务')
    const exported = exportDatabase()
    expect(exported.tags.map((tag) => tag.name)).toContain('临时标签')
    expect(exported.tasks[0]!.links[0]).toMatchObject({
      kind: 'url',
      target: 'https://example.com/doc',
      display: '示例'
    })
  })

  it('导入校验：版本/结构不合法抛错且不破坏现有数据', () => {
    openDatabase({ dbPath })
    createTask({ title: '原有任务' })

    expect(() => importDatabase(null)).toThrow('导入文件格式不正确')
    expect(() => importDatabase('文本')).toThrow('导入文件格式不正确')
    expect(() => importDatabase({ version: 2, tasks: [] })).toThrow(/版本不受支持/)
    expect(() => importDatabase({ version: 1 })).toThrow(/缺少 tasks 数组/)

    expect(countTasks()).toBe(1)
  })
})

describe('事务', () => {
  it('异常回滚；正常提交', () => {
    openDatabase({ dbPath })
    createTask({ title: '保留任务' })
    const before = countTasks()
    expect(before).toBe(1)

    expect(() =>
      transaction(() => {
        createTask({ title: '将被回滚' })
        expect(countTasks()).toBe(before + 1)
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(countTasks()).toBe(before)

    transaction(() => {
      createTask({ title: '正常提交' })
      return null
    })
    expect(countTasks()).toBe(before + 1)
  })
})

describe('路径解析与环境变量', () => {
  it('默认路径 = dataDir/data.db；DESKTOP_TODO_DB 覆盖（含 :memory:）', () => {
    expect(resolveDbPath(tempDir)).toBe(path.join(tempDir, DB_FILE_NAME))

    process.env['DESKTOP_TODO_DB'] = ':memory:'
    expect(resolveDbPath()).toBe(':memory:')

    const custom = path.join(tempDir, 'custom.db')
    process.env['DESKTOP_TODO_DB'] = custom
    expect(resolveDbPath()).toBe(path.resolve(custom))
    delete process.env['DESKTOP_TODO_DB']

    expect(resolveDataDir()).not.toBe('')
    process.env['DESKTOP_TODO_DATA_DIR'] = tempDir
    expect(resolveDataDir()).toBe(path.resolve(tempDir))
    expect(resolveDbPath()).toBe(path.join(path.resolve(tempDir), DB_FILE_NAME))
  })

  it('未设环境变量时数据目录按平台约定解析（Windows %APPDATA%、macOS Application Support）', () => {
    delete process.env['DESKTOP_TODO_DATA_DIR']
    const dir = resolveDataDir()
    expect(path.basename(dir)).toBe('DesktopTodo')
    if (process.platform === 'darwin') {
      expect(dir).toBe(path.join(os.homedir(), 'Library', 'Application Support', 'DesktopTodo'))
    } else if (process.platform === 'win32') {
      expect(dir.toLowerCase()).toContain('appdata')
    } else {
      expect(dir).toBe(path.join(os.homedir(), '.config', 'DesktopTodo'))
    }
  })

  it('openDatabase 支持 :memory:，且 close 不影响后续文件库', () => {
    const memory = openDatabase({ dbPath: ':memory:' })
    expect(memory.healthy).toBe(true)
    expect(memory.dbPath).toBe(':memory:')
    expect(memory.dataDir).toBe(':memory:')
    createTask({ title: '内存库任务' })
    expect(countTasks()).toBe(1)

    closeDatabase()
    const file = openDatabase({ dbPath })
    expect(file.healthy).toBe(true)
    expect(file.dbPath).toBe(dbPath)
    expect(countTasks()).toBe(0)
  })
})
