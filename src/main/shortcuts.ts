/**
 * 全局快捷键 · 主进程
 *
 * Contract: docs/04-TECH-PLAN.md §快捷键 · docs/01-PRD.md FR-5
 *   CommandOrControl+Shift+Space → 快速添加（MVP：唤起挂件）
 *   Alt+H                        → 显示/隐藏挂件
 *   Alt+1..5                     → 切换到内置视图（收件箱/今天/已逾期/即将到期/已完成）
 *
 * 要求（验收 F）：注册失败不允许静默；可在设置中整体关闭。
 * - 关闭后 unregisterAll，不保留任何全局热键。
 * - 注册失败弹一次原生提示（--silent 静默启动时只写日志，避免破坏「开机静默进托盘」）。
 */
import { dialog, globalShortcut } from 'electron'
import { getBooleanSetting } from './settings'
import {
  broadcast,
  getManagerWindow,
  getWidgetWindow,
  showManager,
  showWidget,
  toggleWidget
} from './windows'

export type ShortcutViewId = 'inbox' | 'today' | 'overdue' | 'upcoming' | 'done'

export interface ShortcutFailure {
  accelerator: string
  label: string
}

interface ShortcutDefinition {
  id: string
  accelerator: string
  label: string
  run: () => void
}

/** Alt+1..5 与内置视图的固定映射（原型 design/app/js/interactions.js:1052） */
const VIEW_SHORTCUTS: ReadonlyArray<{
  accelerator: string
  viewId: ShortcutViewId
  label: string
}> = [
  { accelerator: 'Alt+1', viewId: 'inbox', label: '收件箱' },
  { accelerator: 'Alt+2', viewId: 'today', label: '今天' },
  { accelerator: 'Alt+3', viewId: 'overdue', label: '已逾期' },
  { accelerator: 'Alt+4', viewId: 'upcoming', label: '即将到期' },
  { accelerator: 'Alt+5', viewId: 'done', label: '已完成' }
]

let lastFailures: ShortcutFailure[] = []
let notifyTimer: NodeJS.Timeout | null = null

function openView(viewId: ShortcutViewId): void {
  showManager()
  broadcast('app:navigate', { viewId })
}

function definitions(): ShortcutDefinition[] {
  return [
    {
      id: 'quickAdd',
      accelerator: 'CommandOrControl+Shift+Space',
      label: '快速添加',
      run: showWidget
    },
    {
      id: 'toggleWidget',
      accelerator: 'Alt+H',
      label: '显示/隐藏挂件',
      run: toggleWidget
    },
    ...VIEW_SHORTCUTS.map((view) => ({
      id: `view:${view.viewId}`,
      accelerator: view.accelerator,
      label: `打开${view.label}`,
      run: () => openView(view.viewId)
    }))
  ]
}

export function getShortcutFailures(): ShortcutFailure[] {
  return lastFailures
}

export function unregisterShortcuts(): void {
  try {
    globalShortcut.unregisterAll()
  } catch {
    // app 未 ready / 平台不支持时忽略
  }
  lastFailures = []
}

/**
 * 按当前 settings 注册全部快捷键；返回注册失败的项（空数组=全部成功）。
 * 幂等：重复调用会先注销旧注册。
 */
export function registerShortcuts(): ShortcutFailure[] {
  unregisterShortcuts()
  if (!getBooleanSetting('globalShortcuts')) return []
  const failed: ShortcutFailure[] = []
  for (const definition of definitions()) {
    let ok = false
    try {
      ok = globalShortcut.register(definition.accelerator, () => {
        try {
          definition.run()
        } catch (error) {
          console.warn(
            `[shortcuts] 执行 ${definition.id} 失败：`,
            error instanceof Error ? error.message : error
          )
        }
      })
    } catch {
      ok = false
    }
    if (!ok) failed.push({ accelerator: definition.accelerator, label: definition.label })
  }
  lastFailures = failed
  return failed
}

async function notifyShortcutFailures(failed: ShortcutFailure[]): Promise<void> {
  const lines = failed.map((item) => `${item.accelerator}（${item.label}）`).join('\n')
  const options = {
    type: 'warning' as const,
    title: '快捷键冲突',
    message: '部分全局快捷键注册失败',
    detail: `以下快捷键可能被其他程序占用：\n${lines}\n\n可在设置中关闭全局快捷键，或关闭占用程序后重启应用。`,
    buttons: ['知道了'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  }
  try {
    const parent = getManagerWindow() ?? getWidgetWindow()
    if (parent && !parent.isDestroyed()) {
      await dialog.showMessageBox(parent, options)
    } else {
      await dialog.showMessageBox(options)
    }
  } catch (error) {
    console.warn(
      '[shortcuts] 无法弹出快捷键冲突提示：',
      error instanceof Error ? error.message : error
    )
  }
}

function scheduleFailureNotification(failed: ShortcutFailure[]): void {
  if (notifyTimer) {
    clearTimeout(notifyTimer)
    notifyTimer = null
  }
  if (failed.length === 0) return
  // 延后弹窗，让主窗口先完成首帧；--silent 时不弹（见 setupShortcuts）
  notifyTimer = setTimeout(() => {
    notifyTimer = null
    void notifyShortcutFailures(failed)
  }, 1200)
  // 测试/退出时不要因此挂住进程
  if (typeof notifyTimer.unref === 'function') notifyTimer.unref()
}

/** 启动时调用（createWindows 之后）：注册并（非静默启动时）提示冲突 */
export function setupShortcuts(options: { notify?: boolean } = {}): ShortcutFailure[] {
  const failed = registerShortcuts()
  if (options.notify !== false && failed.length > 0) scheduleFailureNotification(failed)
  return failed
}

/** settings:set('globalShortcuts', ...) 的副作用入口（由 ipc.ts 调用） */
export function applyGlobalShortcutsSetting(enabled: boolean): void {
  if (enabled) {
    const failed = registerShortcuts()
    if (failed.length > 0) scheduleFailureNotification(failed)
  } else {
    unregisterShortcuts()
  }
}

/** 退出前释放全局热键（app will-quit 调用） */
export function disposeShortcuts(): void {
  if (notifyTimer) {
    clearTimeout(notifyTimer)
    notifyTimer = null
  }
  unregisterShortcuts()
}

/** 供测试/诊断：判断当前是否真的注册上了某个快捷键 */
export function isShortcutRegistered(accelerator: string): boolean {
  try {
    return globalShortcut.isRegistered(accelerator)
  } catch {
    return false
  }
}
