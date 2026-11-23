/**
 * preload · contextBridge 白名单
 * Contract: docs/04-TECH-PLAN.md §IPC · docs/09-PROJECT-STRUCTURE.md §2.2
 * 只做白名单桥接与类型声明，不写业务逻辑、不读写数据库、不做文件 IO。
 * 类型统一在 src/shared/types.ts，此处仅 import type 并转出，保持引用兼容。
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AppInfo,
  DesktopTodoApi,
  FilterDTO,
  LinkDTO,
  LinkKind,
  OpenResult,
  SavedViewDTO,
  SettingsKey,
  TagDTO,
  TagDeleteResult,
  TagKind,
  TagListsDTO,
  TaskCreateInput,
  TaskDTO,
  TaskUpdatePatch
} from '../shared/types'

export type {
  AppInfo,
  DesktopTodoApi,
  FilterDTO,
  FilterDate,
  FilterDateMode,
  LinkDTO,
  LinkKind,
  OpenReason,
  OpenResult,
  SavedViewDTO,
  SettingsKey,
  TagDTO,
  TagDeleteResult,
  TagKind,
  TagListsDTO,
  TaskCreateInput,
  TaskDTO,
  TaskLinkInput,
  TaskPriority,
  TaskStatus,
  TaskUpdatePatch,
  WidgetBounds
} from '../shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: DesktopTodoApi = {
  /* 同步暴露进程平台供渲染层适配文案；sandbox: true 的 preload 中 process.platform 可用 */
  platform: process.platform,
  tasks: {
    list: (input) => ipcRenderer.invoke('tasks:list', input ?? {}),
    create: (input: TaskCreateInput) => ipcRenderer.invoke('tasks:create', input),
    update: (input: { id: string; patch: TaskUpdatePatch }) =>
      ipcRenderer.invoke('tasks:update', input),
    toggle: (input: { id: string; done: boolean }) => ipcRenderer.invoke('tasks:toggle', input),
    delete: (input: { id: string }) => ipcRenderer.invoke('tasks:delete', input)
  },
  links: {
    add: (input: { taskId: string; target: string; display?: string }) =>
      ipcRenderer.invoke('links:add', input),
    remove: (input: { id: string }) => ipcRenderer.invoke('links:remove', input),
    open: (input: { id?: string; target?: string; kind?: LinkKind }) =>
      ipcRenderer.invoke('links:open', input),
    relocate: (input: { id: string }): Promise<{
      ok: boolean
      /** 用户取消文件选择器 */
      canceled?: boolean
      /** 成功时返回更新后的链接（target/display/kind 已改写） */
      link?: LinkDTO
      error?: string
    }> => ipcRenderer.invoke('links:relocate', input)
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    create: (input: { name: string; kind: TagKind; color?: string }) =>
      ipcRenderer.invoke('tags:create', input),
    rename: (input: { id: string; name: string }) => ipcRenderer.invoke('tags:rename', input),
    delete: (input: { id: string }): Promise<TagDeleteResult> =>
      ipcRenderer.invoke('tags:delete', input)
  },
  views: {
    list: (): Promise<SavedViewDTO[]> => ipcRenderer.invoke('views:list'),
    save: (input: { id?: string; name: string; filter: FilterDTO }) =>
      ipcRenderer.invoke('views:save', input),
    delete: (input: { id: string }) => ipcRenderer.invoke('views:delete', input)
  },
  settings: {
    get: (input: { key: SettingsKey }) => ipcRenderer.invoke('settings:get', input),
    set: (input: { key: SettingsKey; value: unknown }) => ipcRenderer.invoke('settings:set', input)
  },
  app: {
    showManager: () => ipcRenderer.invoke('app:showManager'),
    showWidget: (input?: { collapsed?: boolean }) =>
      ipcRenderer.invoke('app:showWidget', input ?? {}),
    toggleWidget: () => ipcRenderer.invoke('app:toggleWidget'),
    quit: () => ipcRenderer.invoke('app:quit'),
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:getInfo'),
    openDataDir: (): Promise<OpenResult> => ipcRenderer.invoke('app:openDataDir'),
    exportData: () => ipcRenderer.invoke('app:exportData'),
    importData: () => ipcRenderer.invoke('app:importData')
  },
  widget: {
    setHeight: (input: { height: number }) => ipcRenderer.invoke('widget:setHeight', input),
    setCollapsed: (input: { collapsed: boolean }) => ipcRenderer.invoke('widget:setCollapsed', input),
    saveCapsulePosition: (input: { x: number; y: number }) =>
      ipcRenderer.invoke('widget:saveCapsulePosition', input),
    beginDrag: () => ipcRenderer.invoke('widget:beginDrag'),
    dragMove: (input: { dx: number; dy: number }) => ipcRenderer.invoke('widget:dragMove', input),
    endDrag: () => ipcRenderer.invoke('widget:endDrag')
  },
  editor: {
    open: (input?: { taskId?: string | null }) => ipcRenderer.invoke('editor:open', input ?? {}),
    close: () => ipcRenderer.invoke('editor:close'),
    ready: (input: { height: number }) => ipcRenderer.invoke('editor:ready', input)
  },
  notice: {
    acknowledge: () => ipcRenderer.invoke('notice:acknowledge'),
    ready: (input: { height: number }) => ipcRenderer.invoke('notice:ready', input)
  },
  drop: {
    getPathForFile: (file) => webUtils.getPathForFile(file)
  },
  on: {
    tasksChanged: (cb) => subscribe('tasks:changed', cb),
    settingsChanged: (cb) => subscribe('settings:changed', cb),
    widgetCollapsed: (cb) => subscribe('widget:collapsed', cb),
    navigate: (cb) => subscribe('app:navigate', cb),
    notice: (cb) => subscribe('app:notice', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: DesktopTodoApi
  }
}
