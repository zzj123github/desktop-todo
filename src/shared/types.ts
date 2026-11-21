/**
 * shared · 跨层类型
 * Contract: docs/09-PROJECT-STRUCTURE.md §2.2 / §6.1 · docs/04-TECH-PLAN.md §IPC
 * 纯类型模块：main / preload / renderer 共用。禁止运行时代码、禁止 import electron / node / 任何实现模块。
 */

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

export interface WidgetBounds {
  x: number
  y: number
  width: number
  height: number
  /** 位置所属显示器；多显示器恢复位置时使用 */
  displayId?: number
}

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
  /** 日期选择器快捷时间使用统计：Record<'HH:mm', number> */
  | 'timeUsage'

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
    /** 胶囊拖动开始：主进程记录起始窗口位置（renderer 自绘拖动，见 Capsule.tsx） */
    beginDrag(): Promise<{ ok: true }>
    /** 胶囊拖动中：相对起点的位移（CSS px） */
    dragMove(input: { dx: number; dy: number }): Promise<{ ok: true }>
    /** 胶囊拖动结束：落盘位置 */
    endDrag(): Promise<{ ok: true }>
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
