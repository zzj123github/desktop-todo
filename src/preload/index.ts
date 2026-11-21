/**
 * preload · contextBridge 白名单
 * Contract: docs/04-TECH-PLAN.md §IPC · docs/09-PROJECT-STRUCTURE.md §2.2
 * 只做白名单桥接与类型声明，不写业务逻辑、不读写数据库、不做文件 IO。
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'

export type LinkKind = 'url' | 'folder' | 'file'

export interface LinkDTO {
  id: string
  taskId: string
  kind: LinkKind
  target: string
  display: string
  sortOrder: number
  lastCheckedAt: number | null
}

export type TaskStatus = 0 | 1
export type TaskPriority = 0 | 1 | 2 | 3

export interface TaskDTO {
  id: string
  title: string
  note: string
  status: TaskStatus
  priority: TaskPriority
  dueAt: number | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
  sortOrder: number
  projectId: string | null
  tagIds: string[]
  links: LinkDTO[]
}

export type TagKind = 'project' | 'tag'

export interface TagDTO {
  id: string
  name: string
  color: string
  kind: TagKind
  /** 未完成任务数（管理弹窗 / 左栏计数） */
  pendingCount?: number
}

export interface TagListsDTO {
  tags: TagDTO[]
  projects: TagDTO[]
}

export type FilterDateMode = 'any' | 'today' | 'tomorrow' | 'week' | 'overdue' | 'custom'

export interface FilterDate {
  mode: FilterDateMode
  /** custom 模式的本地日期键 YYYY-MM-DD */
  from?: string
  to?: string
}

export interface FilterDTO {
  status: 'todo' | 'done' | 'all'
  date: FilterDate
  tagIds: string[]
  priorities: TaskPriority[]
  keyword: string
}

export interface SavedViewDTO {
  id: string
  name: string
  filter: FilterDTO
  sortOrder: number
  createdAt: number
}

export type WidgetBounds = { x: number; y: number; width: number; height: number } | null

export type SettingsKey =
  | 'alwaysOnTop'
  | 'opacity'
  | 'launchAtLogin'
  | 'globalShortcuts'
  | 'lastViewId'
  | 'widgetBounds'
  | 'capsuleBounds'
  | 'managerBounds'
  | 'capsule'

export type OpenReason = 'missing' | 'unreachable' | 'blocked' | 'unsupported' | 'shell'

export interface OpenResult {
  ok: boolean
  error?: string
  reason?: OpenReason
  target?: string
}

export interface TagDeleteResult {
  ok: true
  impact: { total: number; pending: number }
  record: TagDTO
  taskIds: string[]
}

export interface TaskLinkInput {
  id?: string
  target: string
  display?: string
}

export interface TaskCreateInput {
  title: string
  note?: string
  priority?: TaskPriority
  dueAt?: number | null
  tagIds?: string[]
  projectId?: string | null
  links?: TaskLinkInput[]
}

export interface TaskUpdatePatch {
  title?: string
  note?: string
  priority?: TaskPriority
  dueAt?: number | null
  tagIds?: string[]
  projectId?: string | null
  links?: TaskLinkInput[]
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  dataDir: string
  dbPath: string
  dbHealthy: boolean
  dbError?: string
}

export interface DesktopTodoApi {
  tasks: {
    list(input?: { filter?: FilterDTO; viewId?: string }): Promise<TaskDTO[]>
    create(input: TaskCreateInput): Promise<TaskDTO>
    update(input: { id: string; patch: TaskUpdatePatch }): Promise<TaskDTO>
    toggle(input: { id: string; done: boolean }): Promise<TaskDTO>
    delete(input: { id: string }): Promise<{ ok: true }>
  }
  links: {
    add(input: { taskId: string; target: string; display?: string }): Promise<LinkDTO>
    remove(input: { id: string }): Promise<{ ok: true }>
    open(input: { id?: string; target?: string; kind?: LinkKind }): Promise<OpenResult>
    relocate(input: { id: string }): Promise<{ ok: boolean; link?: LinkDTO }>
  }
  tags: {
    list(): Promise<TagListsDTO>
    create(input: { name: string; kind: TagKind; color?: string }): Promise<TagDTO>
    rename(input: { id: string; name: string }): Promise<TagDTO>
    delete(input: { id: string }): Promise<TagDeleteResult>
  }
  views: {
    list(): Promise<SavedViewDTO[]>
    save(input: { id?: string; name: string; filter: FilterDTO }): Promise<SavedViewDTO>
    delete(input: { id: string }): Promise<{ ok: true }>
  }
  settings: {
    get(input: { key: SettingsKey }): Promise<unknown>
    set(input: { key: SettingsKey; value: unknown }): Promise<{ ok: true }>
  }
  app: {
    showManager(): Promise<void>
    toggleWidget(): Promise<void>
    quit(): Promise<void>
    getInfo(): Promise<AppInfo>
    openDataDir(): Promise<OpenResult>
    exportData(): Promise<{ ok: boolean; path?: string; canceled?: boolean }>
    importData(): Promise<{ ok: boolean; count?: number; canceled?: boolean }>
  }
  widget: {
    /** 挂件内容高度变化时上报，主进程按内容收缩窗口（max 520） */
    setHeight(input: { height: number }): Promise<{ ok: true }>
    /** 挂件收起为胶囊 / 从胶囊展开 */
    setCollapsed(input: { collapsed: boolean }): Promise<{ ok: true }>
    /** 胶囊独立位置拖拽结束写回 */
    saveCapsulePosition(input: { x: number; y: number }): Promise<{ ok: true }>
    /** 打开任务编辑面板（同一窗口内由渲染层处理，保留占位） */
  }
  drop: {
    getPathForFile(file: File): string
  }
  on: {
    tasksChanged(cb: () => void): () => void
    settingsChanged(cb: (payload: { key: SettingsKey; value: unknown }) => void): () => void
    widgetCollapsed(cb: (payload: { collapsed: boolean }) => void): () => void
    navigate(cb: (payload: { viewId: string }) => void): () => void
  }
}

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: DesktopTodoApi = {
  tasks: {
    list: (input) => ipcRenderer.invoke('tasks:list', input ?? {}),
    create: (input) => ipcRenderer.invoke('tasks:create', input),
    update: (input) => ipcRenderer.invoke('tasks:update', input),
    toggle: (input) => ipcRenderer.invoke('tasks:toggle', input),
    delete: (input) => ipcRenderer.invoke('tasks:delete', input)
  },
  links: {
    add: (input) => ipcRenderer.invoke('links:add', input),
    remove: (input) => ipcRenderer.invoke('links:remove', input),
    open: (input) => ipcRenderer.invoke('links:open', input),
    relocate: (input) => ipcRenderer.invoke('links:relocate', input)
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    create: (input) => ipcRenderer.invoke('tags:create', input),
    rename: (input) => ipcRenderer.invoke('tags:rename', input),
    delete: (input) => ipcRenderer.invoke('tags:delete', input)
  },
  views: {
    list: () => ipcRenderer.invoke('views:list'),
    save: (input) => ipcRenderer.invoke('views:save', input),
    delete: (input) => ipcRenderer.invoke('views:delete', input)
  },
  settings: {
    get: (input) => ipcRenderer.invoke('settings:get', input),
    set: (input) => ipcRenderer.invoke('settings:set', input)
  },
  app: {
    showManager: () => ipcRenderer.invoke('app:showManager'),
    toggleWidget: () => ipcRenderer.invoke('app:toggleWidget'),
    quit: () => ipcRenderer.invoke('app:quit'),
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
    openDataDir: () => ipcRenderer.invoke('app:openDataDir'),
    exportData: () => ipcRenderer.invoke('app:exportData'),
    importData: () => ipcRenderer.invoke('app:importData')
  },
  widget: {
    setHeight: (input) => ipcRenderer.invoke('widget:setHeight', input),
    setCollapsed: (input) => ipcRenderer.invoke('widget:setCollapsed', input),
    saveCapsulePosition: (input) => ipcRenderer.invoke('widget:saveCapsulePosition', input)
  },
  drop: {
    getPathForFile: (file) => webUtils.getPathForFile(file)
  },
  on: {
    tasksChanged: (cb) => subscribe('tasks:changed', cb),
    settingsChanged: (cb) => subscribe('settings:changed', cb),
    widgetCollapsed: (cb) => subscribe('widget:collapsed', cb),
    navigate: (cb) => subscribe('app:navigate', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: DesktopTodoApi
  }
}
