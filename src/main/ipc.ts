/**
 * IPC 层 · 全部 main ⇄ renderer 通道
 *
 * Contract: docs/04-TECH-PLAN.md §IPC · src/preload/index.ts（通道名与入参/返回类型唯一来源）
 *
 * 约定：
 * - 每个 handler 内部 catch 后抛出「干净」的 Error：preload 的 invoke 会以 reject 传回
 *   message，渲染层 toast 直接展示，不暴露栈/内部路径。
 * - 所有写操作成功后广播 `tasks:changed`（任务、标签、链接、视图集合都会影响界面）；
 *   设置写入后广播 `settings:changed`。
 * - 这里只做参数校验、编排 repo / 窗口 / 系统能力，不写 SQL（SQL 只在 db.ts / repo/*）。
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type {
  FilterDTO,
  LinkKind,
  OpenResult,
  SettingsKey,
  TagKind,
  TaskCreateInput,
  TaskLinkInput,
  TaskUpdatePatch
} from '../shared/types'
import {
  exportDatabase,
  getDataDir,
  getDbError,
  getDbPath,
  importDatabase,
  isDbHealthy
} from './db'
import { openLink } from './opener'
import { addLink, getLink, openStoredLink, removeLink, replaceLinkTarget } from './repo/links'
import { createTag, deleteTag, listTags, renameTag } from './repo/tags'
import {
  createTask,
  deleteTask,
  listTasks,
  toggleTask,
  updateTask
} from './repo/tasks'
import { deleteView, listViews, saveView } from './repo/views'
import {
  SETTINGS_KEYS,
  getSetting,
  isSettingsKey,
  normalizeSettingValue,
  setSetting
} from './settings'
import {
  applySettingsChange,
  beginCapsuleDrag,
  broadcast,
  closeEditorWindow,
  endCapsuleDrag,
  getManagerWindow,
  getWidgetWindow,
  moveCapsuleDrag,
  openEditorWindow,
  resizeEditorWindow,
  saveCapsulePosition,
  setWidgetCollapsed,
  setWidgetContentHeight,
  showManager,
  showWidgetMode,
  toggleWidget
} from './windows'
import { applyLaunchAtLogin } from './login'
import { applyGlobalShortcutsSetting } from './shortcuts'

/** 与 src/preload/index.ts 的 channel 一一对应（改这里必须同步 preload，preload 冻结） */
export const IPC_CHANNELS = [
  'tasks:list',
  'tasks:create',
  'tasks:update',
  'tasks:toggle',
  'tasks:delete',
  'links:add',
  'links:remove',
  'links:open',
  'links:relocate',
  'tags:list',
  'tags:create',
  'tags:rename',
  'tags:delete',
  'views:list',
  'views:save',
  'views:delete',
  'settings:get',
  'settings:set',
  'app:showManager',
  'app:showWidget',
  'app:toggleWidget',
  'app:quit',
  'app:getInfo',
  'app:openDataDir',
  'app:exportData',
  'app:importData',
  'widget:setHeight',
  'widget:setCollapsed',
  'widget:saveCapsulePosition',
  'widget:beginDrag',
  'widget:dragMove',
  'widget:endDrag',
  'editor:open',
  'editor:close',
  'editor:ready'
] as const

export type IpcChannel = (typeof IPC_CHANNELS)[number]

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function asRecord(input: unknown, label = '参数'): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label}格式不正确`)
  }
  return input as Record<string, unknown>
}

function requireString(input: unknown, field: string, label = '参数'): string {
  const value = asRecord(input, label)[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`缺少参数：${field}`)
  }
  return value
}

function optionalString(input: Record<string, unknown>, field: string): string | undefined {
  const value = input[field]
  return typeof value === 'string' ? value : undefined
}

/** 包装 handler：统一把内部异常转成用户可读的 message（不暴露栈） */
function handle(channel: IpcChannel, fn: (input: unknown) => unknown | Promise<unknown>): void {
  // 允许重复注册（开发期热重启 / 测试环境），避免 "second handler" 报错
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, async (_event, input: unknown) => {
    try {
      return await fn(input)
    } catch (err) {
      throw new Error(toMessage(err))
    }
  })
}

function broadcastTasksChanged(): void {
  broadcast('tasks:changed')
}

function broadcastSettingsChanged(key: SettingsKey, value: unknown): void {
  broadcast('settings:changed', { key, value })
}

/** 写设置后同步系统/窗口副作用（登录项、全局快捷键、挂件置顶/透明度等） */
function applySettingEffects(key: SettingsKey, value: unknown): void {
  switch (key) {
    case 'alwaysOnTop':
    case 'opacity':
      applySettingsChange(key, value)
      break
    case 'launchAtLogin':
      applyLaunchAtLogin(Boolean(value))
      break
    case 'globalShortcuts':
      applyGlobalShortcutsSetting(Boolean(value))
      break
    default:
      // lastViewId / 各 bounds / capsule / timeUsage 无需 main 侧副作用
      break
  }
}

function parentWindow(): BrowserWindow | undefined {
  return getWidgetWindow() ?? getManagerWindow() ?? undefined
}

function showSaveDialogForExport(): Promise<string | null> {
  const win = parentWindow()
  const options = {
    title: '导出备份',
    defaultPath: join(app.getPath('documents'), `desktop-todo-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'JSON 备份', extensions: ['json'] }]
  }
  // Electron 的 showSaveDialog 有 (window, options) 与 (options) 两种重载
  return new Promise((resolve) => {
    const done = (result: { canceled: boolean; filePath?: string }): void => {
      resolve(result.canceled || !result.filePath ? null : result.filePath)
    }
    if (win && !win.isDestroyed()) {
      void dialog.showSaveDialog(win, options).then(done)
    } else {
      void dialog.showSaveDialog(options).then(done)
    }
  })
}

function showOpenDialogForImport(): Promise<string | null> {
  const win = parentWindow()
  const options = {
    title: '导入备份',
    filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    properties: ['openFile' as const]
  }
  return new Promise((resolve) => {
    const done = (result: { canceled: boolean; filePaths: string[] }): void => {
      resolve(result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0])
    }
    if (win && !win.isDestroyed()) {
      void dialog.showOpenDialog(win, options).then(done)
    } else {
      void dialog.showOpenDialog(options).then(done)
    }
  })
}

/** 导入 / 恢复后让所有窗口重新拉一次数据（保留当前界面状态，不强制 reload） */
function notifyDataReplaced(): void {
  broadcastTasksChanged()
  for (const key of SETTINGS_KEYS) {
    let value: unknown
    try {
      value = getSetting(key)
    } catch {
      continue
    }
    broadcastSettingsChanged(key, value)
    applySettingEffects(key, value)
  }
}

// ---------------------------------------------------------------------------
// 注册
// ---------------------------------------------------------------------------

let registered = false

/** 打开数据库后调用一次；重复调用等价于重新注册（不会抛错） */
export function registerIpcHandlers(): void {
  if (registered) {
    // removeHandler 已保证可重入，这里仅作幂等说明
  }
  registered = true

  // --- 任务 ---------------------------------------------------------------
  handle('tasks:list', (input) => {
    const payload = input === undefined || input === null ? {} : asRecord(input)
    return listTasks({
      filter: payload.filter as FilterDTO | undefined,
      viewId: optionalString(payload, 'viewId')
    })
  })

  handle('tasks:create', (input) => {
    const dto = createTask(input as TaskCreateInput)
    broadcastTasksChanged()
    return dto
  })

  handle('tasks:update', (input) => {
    const payload = asRecord(input)
    const id = requireString(payload, 'id')
    const patch = asRecord(payload.patch, '任务更新参数') as unknown as TaskUpdatePatch
    const dto = updateTask(id, patch)
    broadcastTasksChanged()
    return dto
  })

  handle('tasks:toggle', (input) => {
    const payload = asRecord(input)
    const id = requireString(payload, 'id')
    const done = payload.done
    if (typeof done !== 'boolean') throw new Error('缺少参数：done')
    const dto = toggleTask(id, done)
    broadcastTasksChanged()
    return dto
  })

  handle('tasks:delete', (input) => {
    const payload = asRecord(input)
    const result = deleteTask(requireString(payload, 'id'))
    broadcastTasksChanged()
    return result
  })

  // --- 链接 ---------------------------------------------------------------
  handle('links:add', (input) => {
    const payload = asRecord(input)
    const taskId = requireString(payload, 'taskId')
    const target = requireString(payload, 'target')
    const link = addLink(taskId, target, optionalString(payload, 'display'))
    broadcastTasksChanged()
    return link
  })

  handle('links:remove', (input) => {
    const payload = asRecord(input)
    const result = removeLink(requireString(payload, 'id'))
    broadcastTasksChanged()
    return result
  })

  handle('links:open', async (input): Promise<OpenResult> => {
    const payload = typeof input === 'string' ? {} : asRecord(input)
    const id = optionalString(payload, 'id')
    const target = optionalString(payload, 'target')
    const kind = optionalString(payload, 'kind') as LinkKind | undefined
    if (id) {
      const result = await openStoredLink(id)
      if (result.ok) broadcastTasksChanged()
      return result
    }
    if (target) return openLink(target, kind)
    return { ok: false, error: '没有可打开的链接', reason: 'unsupported' }
  })

  handle('links:relocate', async (input) => {
    const payload = asRecord(input)
    const id = requireString(payload, 'id')
    const existing = getLink(id)
    if (!existing) return { ok: false, error: '链接不存在' }
    const win = parentWindow()
    const options = {
      title: '选择新位置',
      defaultPath: existing.kind === 'url' ? undefined : existing.target,
      properties: ['openFile' as const, 'openDirectory' as const]
    }
    const result =
      win && !win.isDestroyed()
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }
    try {
      const relocated = replaceLinkTarget(id, result.filePaths[0])
      if (!relocated.ok || !relocated.link) {
        return { ok: false, error: relocated.error ?? '无法识别的链接或路径' }
      }
      broadcastTasksChanged()
      return { ok: true, link: relocated.link }
    } catch (err) {
      return { ok: false, error: toMessage(err) }
    }
  })

  // --- 项目 / 标签 --------------------------------------------------------
  handle('tags:list', () => listTags())

  handle('tags:create', (input) => {
    const payload = asRecord(input)
    const name = requireString(payload, 'name')
    const kind = payload.kind
    if (kind !== 'project' && kind !== 'tag') throw new Error('缺少参数：kind')
    const tag = createTag({
      name,
      kind: kind as TagKind,
      color: optionalString(payload, 'color')
    })
    broadcastTasksChanged()
    return tag
  })

  handle('tags:rename', (input) => {
    const payload = asRecord(input)
    const id = requireString(payload, 'id')
    const name = requireString(payload, 'name')
    const tag = renameTag(id, name)
    broadcastTasksChanged()
    return tag
  })

  handle('tags:delete', (input) => {
    const payload = asRecord(input)
    const result = deleteTag(requireString(payload, 'id'))
    broadcastTasksChanged()
    return result
  })

  // --- 视图 ---------------------------------------------------------------
  handle('views:list', () => listViews())

  handle('views:save', (input) => {
    const payload = asRecord(input)
    const name = requireString(payload, 'name')
    const filter = payload.filter as FilterDTO
    if (!filter || typeof filter !== 'object') throw new Error('缺少参数：filter')
    const view = saveView({
      id: optionalString(payload, 'id'),
      name,
      filter
    })
    broadcastTasksChanged()
    return view
  })

  handle('views:delete', (input) => {
    const payload = asRecord(input)
    const result = deleteView(requireString(payload, 'id'))
    broadcastTasksChanged()
    return result
  })

  // --- 设置 ---------------------------------------------------------------
  handle('settings:get', (input) => {
    const payload = asRecord(input)
    const key = payload.key
    if (!isSettingsKey(key)) throw new Error(`未知设置项：${String(key)}`)
    return getSetting(key)
  })

  handle('settings:set', (input) => {
    const payload = asRecord(input)
    const key = payload.key
    if (!isSettingsKey(key)) throw new Error(`未知设置项：${String(key)}`)
    const value = normalizeSettingValue(key, payload.value)
    setSetting(key, value)
    applySettingEffects(key, value)
    broadcastSettingsChanged(key, value)
    return { ok: true as const }
  })

  // --- 应用 / 窗口 --------------------------------------------------------
  handle('app:showManager', () => {
    showManager()
  })

  handle('app:showWidget', (input) => {
    const payload = input === undefined ? {} : asRecord(input)
    const collapsed = payload.collapsed
    if (collapsed !== undefined && typeof collapsed !== 'boolean') {
      throw new Error('参数格式不正确：collapsed')
    }
    showWidgetMode(collapsed === true)
  })

  handle('app:toggleWidget', () => {
    toggleWidget()
  })

  handle('app:quit', () => {
    app.quit()
  })

  handle('app:getInfo', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    dataDir: getDataDir(),
    dbPath: getDbPath(),
    dbHealthy: isDbHealthy(),
    ...(getDbError() ? { dbError: getDbError() } : {})
  }))

  handle('app:openDataDir', async (): Promise<OpenResult> => {
    const dataDir = getDataDir()
    mkdirSync(dataDir, { recursive: true })
    const error = await shell.openPath(dataDir)
    if (error) return { ok: false, error, reason: 'shell', target: dataDir }
    return { ok: true, target: dataDir }
  })

  handle('app:exportData', async () => {
    const filePath = await showSaveDialogForExport()
    if (!filePath) return { ok: false, canceled: true }
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, `${JSON.stringify(exportDatabase(), null, 2)}\n`, 'utf8')
    return { ok: true, path: filePath }
  })

  handle('app:importData', async () => {
    const filePath = await showOpenDialogForImport()
    if (!filePath) return { ok: false, canceled: true }
    const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
    const { count } = importDatabase(raw)
    notifyDataReplaced()
    return { ok: true, count }
  })

  // --- 挂件形态 -----------------------------------------------------------
  handle('widget:setHeight', (input) => {
    const payload = asRecord(input)
    const height = payload.height
    if (typeof height !== 'number' || !Number.isFinite(height)) {
      throw new Error('缺少参数：height')
    }
    setWidgetContentHeight(height)
    return { ok: true as const }
  })

  handle('widget:setCollapsed', (input) => {
    const payload = asRecord(input)
    const collapsed = payload.collapsed
    if (typeof collapsed !== 'boolean') throw new Error('缺少参数：collapsed')
    setWidgetCollapsed(collapsed)
    return { ok: true as const }
  })

  handle('widget:saveCapsulePosition', (input) => {
    const payload = asRecord(input)
    const x = payload.x
    const y = payload.y
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('缺少参数：x/y')
    }
    saveCapsulePosition(x, y)
    return { ok: true as const }
  })

  // 胶囊自绘拖动（renderer pointer 事件驱动；见 src/renderer/src/app/Capsule.tsx）
  handle('widget:beginDrag', () => {
    beginCapsuleDrag()
    return { ok: true as const }
  })

  handle('widget:dragMove', (input) => {
    const payload = asRecord(input)
    const dx = payload.dx
    const dy = payload.dy
    if (typeof dx !== 'number' || typeof dy !== 'number' || !Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new Error('缺少参数：dx/dy')
    }
    moveCapsuleDrag(dx, dy)
    return { ok: true as const }
  })

  handle('widget:endDrag', () => {
    endCapsuleDrag()
    return { ok: true as const }
  })

  // --- 任务编辑弹窗（挂件内点击任务 → 桌面级独立弹窗） -------------------
  handle('editor:open', (input) => {
    const payload = input === undefined ? {} : asRecord(input)
    const taskId = payload.taskId
    if (taskId !== undefined && taskId !== null && typeof taskId !== 'string') {
      throw new Error('参数格式不正确：taskId')
    }
    openEditorWindow(typeof taskId === 'string' && taskId !== '' ? taskId : null)
  })

  handle('editor:close', () => {
    closeEditorWindow()
  })

  handle('editor:ready', (input) => {
    const payload = asRecord(input)
    const height = payload.height
    if (typeof height !== 'number' || !Number.isFinite(height)) {
      throw new Error('缺少参数：height')
    }
    resizeEditorWindow(height)
    return { ok: true as const }
  })
}

/** 测试 / 热重启用：移除全部 handler */
export function unregisterIpcHandlers(): void {
  for (const channel of IPC_CHANNELS) ipcMain.removeHandler(channel)
  registered = false
}

export { parentWindow as getIpcParentWindow }
