/**
 * windows · widget / capsule / manager 窗口
 * Contract: docs/04-TECH-PLAN.md §窗口 · docs/08-UI-ENGINEERING-SPEC.md §2 · Lead m00124/m00232
 *
 * 挂件与胶囊是同一个 BrowserWindow 的两个形态（只 setBounds，不重建窗口）：
 * - 挂件：352 宽，高度由 renderer 上报（widget:setHeight，夹 96..min(520, workArea.height)）；
 * - 胶囊：284×54，位置由 renderer 拖动后上报（widget:saveCapsulePosition）。
 * 透明窗口（CSS 画圆角/阴影），完整窗口保持不透明。
 * bounds 持久化到 settings 的 widgetBounds / capsuleBounds / managerBounds，
 * 结构 { x, y, width, height, displayId }，防抖 300ms。
 */
import { BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'node:path'
import type { SettingsKey } from '../shared/types'
import {
  getBooleanSetting,
  getNumberSetting,
  readBounds,
  writeBounds,
  writeSetting,
  type WindowBoundsKey,
  type WindowBoundsRecord
} from './settings'

export const WIDGET_WIDTH = 352
export const WIDGET_MAX_HEIGHT = 520
export const WIDGET_MIN_HEIGHT = 96
export const CAPSULE_WIDTH = 284
export const CAPSULE_HEIGHT = 54
export const MANAGER_WIDTH = 1100
export const MANAGER_HEIGHT = 720
export const MANAGER_MIN_WIDTH = 900
export const MANAGER_MIN_HEIGHT = 600

const WIDGET_DEFAULT_MARGIN_RIGHT = 56
const WIDGET_DEFAULT_MARGIN_TOP = 88
const CAPSULE_DEFAULT_MARGIN_RIGHT = 56
const CAPSULE_DEFAULT_MARGIN_BOTTOM = 70

/** bounds 写库防抖（docs/04 §窗口：move/resize 300ms 防抖） */
const BOUNDS_SAVE_DEBOUNCE_MS = 300

export type WidgetMode = 'widget' | 'capsule'

let widgetWindow: BrowserWindow | null = null
let managerWindow: BrowserWindow | null = null
let widgetMode: WidgetMode = 'widget'
let quitting = false
const boundsTimers = new Map<'widget' | 'capsule' | 'manager', NodeJS.Timeout>()
let displayListenersBound = false

export function setQuitting(value: boolean): void {
  quitting = value
}

export function isQuitting(): boolean {
  return quitting
}

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function loadView(
  win: BrowserWindow,
  view: 'widget' | 'manager' | 'quickadd',
  params: Record<string, string> = {}
): void {
  const file = view === 'quickadd' ? 'quickadd.html' : 'index.html'
  const search = new URLSearchParams({ view, ...params }).toString()
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(`${devUrl}/${file}?${search}`)
  } else {
    void win.loadFile(join(__dirname, `../renderer/${file}`), { search: `?${search}` })
  }
}

// ---------------------------------------------------------------------------
// 位置计算 / clamp（多显示器、负坐标副屏）
// ---------------------------------------------------------------------------

function clampBoundsToWorkArea(bounds: Rectangle, workArea: Rectangle): Rectangle {
  const width = Math.max(1, Math.min(Math.round(bounds.width), workArea.width))
  const height = Math.max(1, Math.min(Math.round(bounds.height), workArea.height))
  const x = Math.min(Math.max(Math.round(bounds.x), workArea.x), workArea.x + workArea.width - width)
  const y = Math.min(
    Math.max(Math.round(bounds.y), workArea.y),
    workArea.y + workArea.height - height
  )
  return { x, y, width, height }
}

/** 把矩形夹进某个显示器工作区，避免多显示器拔插后窗口消失 */
export function clampToWorkArea(bounds: Rectangle): Rectangle {
  return clampBoundsToWorkArea(bounds, screen.getDisplayMatching(bounds).workArea)
}

function findDisplayById(displayId: number | undefined): Electron.Display | undefined {
  if (displayId === undefined || displayId === null) return undefined
  return screen.getAllDisplays().find((display) => display.id === displayId)
}

/** 恢复持久化位置：优先 displayId 对应显示器，找不到则夹到主屏工作区 */
function resolveSavedBounds(saved: WindowBoundsRecord | null, fallback: Rectangle): Rectangle {
  if (!saved) return clampToWorkArea(fallback)
  const display = findDisplayById(saved.displayId)
  const workArea = display ? display.workArea : screen.getPrimaryDisplay().workArea
  return clampBoundsToWorkArea(
    { x: saved.x, y: saved.y, width: saved.width, height: saved.height },
    workArea
  )
}

export function defaultWidgetBounds(): Rectangle {
  const wa = screen.getPrimaryDisplay().workArea
  return {
    x: wa.x + wa.width - WIDGET_WIDTH - WIDGET_DEFAULT_MARGIN_RIGHT,
    y: wa.y + WIDGET_DEFAULT_MARGIN_TOP,
    width: WIDGET_WIDTH,
    height: Math.min(420, WIDGET_MAX_HEIGHT)
  }
}

export function defaultCapsuleBounds(): Rectangle {
  const wa = screen.getPrimaryDisplay().workArea
  return {
    x: wa.x + wa.width - CAPSULE_WIDTH - CAPSULE_DEFAULT_MARGIN_RIGHT,
    y: wa.y + wa.height - CAPSULE_HEIGHT - CAPSULE_DEFAULT_MARGIN_BOTTOM,
    width: CAPSULE_WIDTH,
    height: CAPSULE_HEIGHT
  }
}

function widgetBoundsForMode(mode: WidgetMode): Rectangle {
  if (mode === 'capsule') {
    return resolveSavedBounds(readBounds('capsuleBounds'), defaultCapsuleBounds())
  }
  return resolveSavedBounds(readBounds('widgetBounds'), defaultWidgetBounds())
}

function displayIdFor(bounds: Rectangle): number {
  return screen.getDisplayMatching(bounds).id
}

// ---------------------------------------------------------------------------
// bounds 持久化（防抖）
// ---------------------------------------------------------------------------

function boundsKeyFor(kind: 'widget' | 'capsule' | 'manager'): WindowBoundsKey {
  if (kind === 'manager') return 'managerBounds'
  return kind === 'capsule' ? 'capsuleBounds' : 'widgetBounds'
}

function persistBounds(kind: 'widget' | 'capsule' | 'manager'): void {
  const win = kind === 'manager' ? managerWindow : widgetWindow
  if (!win || win.isDestroyed()) return
  const bounds = win.getBounds()
  // 形态尺寸是固定契约（08 §2.1：挂件宽 352、胶囊 284×54）。高 DPI 下 Windows
  // 会把 setBounds 的 DIP 尺寸四舍五入到物理像素，getBounds 可能回读 ±1px 甚至
  // 中间态尺寸；这里只持久化位置 + 规范化后的尺寸，避免下次启动把窗口撑大。
  const width = kind === 'capsule' ? CAPSULE_WIDTH : kind === 'widget' ? WIDGET_WIDTH : bounds.width
  const height =
    kind === 'capsule'
      ? CAPSULE_HEIGHT
      : kind === 'widget'
        ? Math.round(Math.max(WIDGET_MIN_HEIGHT, Math.min(bounds.height, WIDGET_MAX_HEIGHT)))
        : bounds.height
  writeBounds(boundsKeyFor(kind), {
    x: bounds.x,
    y: bounds.y,
    width,
    height,
    displayId: displayIdFor(bounds)
  })
}

function scheduleBoundsSave(kind: 'widget' | 'capsule' | 'manager'): void {
  const existing = boundsTimers.get(kind)
  if (existing) clearTimeout(existing)
  boundsTimers.set(
    kind,
    setTimeout(() => {
      boundsTimers.delete(kind)
      try {
        persistBounds(kind)
      } catch {
        // 退出过程中设置表可能已关闭：忽略，避免崩溃
      }
      settleWidgetIdleOpacity()
    }, BOUNDS_SAVE_DEBOUNCE_MS)
  )
}

function flushBoundsSaves(): void {
  for (const [kind, timer] of boundsTimers) {
    clearTimeout(timer)
    boundsTimers.delete(kind)
    try {
      persistBounds(kind)
    } catch {
      // 同上
    }
  }
}

function bindBoundsPersistence(win: BrowserWindow, kind: 'manager'): void
function bindBoundsPersistence(win: BrowserWindow, kind: 'widget'): void
function bindBoundsPersistence(win: BrowserWindow, kind: 'manager' | 'widget'): void {
  const handler = (): void => {
    scheduleBoundsSave(kind === 'widget' && widgetMode === 'capsule' ? 'capsule' : kind)
  }
  win.on('moved', handler)
  win.on('resized', handler)
}

// ---------------------------------------------------------------------------
// 透明度 / 置顶
// ---------------------------------------------------------------------------

/** 非焦点时按设置降低不透明度（仅挂件；Windows 支持 setOpacity） */
export function applyWidgetOpacity(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  const configured = getNumberSetting('opacity')
  const focused = widgetWindow.isFocused()
  const target = focused ? 1 : Math.min(1, Math.max(0.2, configured))
  try {
    widgetWindow.setOpacity(target)
  } catch {
    // 某些平台/环境不支持 setOpacity
  }
}

/**
 * 拖动/移动窗口结束时恢复「失焦透明度」。
 *
 * 用户反馈：设置透明度 80% 后拖动挂件/胶囊，窗口因拖动获得焦点而变成 100%，
 * 必须再点一下别处才恢复 80%。拖动不是文本输入，结束后主动失焦即可立即恢复设定值。
 */
function settleWidgetIdleOpacity(): void {
  if (!widgetWindow || widgetWindow.isDestroyed() || quitting) return
  const configured = getNumberSetting('opacity')
  if (configured >= 1) return
  if (!widgetWindow.isFocused()) return
  widgetWindow.blur()
}

export function applyAlwaysOnTop(enabled: boolean): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  if (enabled) widgetWindow.setAlwaysOnTop(true, 'floating')
  else widgetWindow.setAlwaysOnTop(false)
}

/** settings:set 后由 ipc 调用：把与窗口相关的设置立即生效 */
export function applySettingsChange(key: SettingsKey, value: unknown): void {
  switch (key) {
    case 'alwaysOnTop':
      applyAlwaysOnTop(Boolean(value))
      break
    case 'opacity':
      applyWidgetOpacity()
      break
    case 'capsule':
      setWidgetCollapsed(Boolean(value))
      break
    default:
      break
  }
}

// ---------------------------------------------------------------------------
// 挂件 / 胶囊形态
// ---------------------------------------------------------------------------

export function getWidgetMode(): WidgetMode {
  return widgetMode
}

export function isWidgetCollapsed(): boolean {
  return widgetMode === 'capsule'
}

/**
 * renderer 上报内容高度：夹 96..min(520, workArea.height)，不超出工作区。
 *
 * anchor='bottom'：保持窗口底边不动、向上生长（用于挂件内打开浮层/日期选择时
 * 临时加高窗口，让浮层有空间显示；浮层关闭后同样以 bottom 收起，回到原位）。
 */
export function setWidgetContentHeight(height: number, anchor: 'top' | 'bottom' = 'top'): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  if (widgetMode === 'capsule') return
  const bounds = widgetWindow.getBounds()
  const wa = screen.getDisplayMatching(bounds).workArea
  const maxHeight = Math.min(WIDGET_MAX_HEIGHT, wa.height)
  const nextHeight = Math.round(Math.max(WIDGET_MIN_HEIGHT, Math.min(height, maxHeight)))
  const maxY = Math.max(wa.y, wa.y + wa.height - nextHeight)
  const desiredY = anchor === 'bottom' ? bounds.y + bounds.height - nextHeight : bounds.y
  const y = Math.min(Math.max(desiredY, wa.y), maxY)
  if (bounds.height === nextHeight && bounds.y === y && bounds.width === WIDGET_WIDTH) return
  widgetWindow.setBounds({
    x: Math.min(Math.max(bounds.x, wa.x), wa.x + wa.width - WIDGET_WIDTH),
    y,
    width: WIDGET_WIDTH,
    height: nextHeight
  })
}

// ---------------------------------------------------------------------------
// 胶囊自绘拖动（renderer pointer 事件 → IPC，见 Capsule.tsx）
// 胶囊不能用 -webkit-app-region:drag（拖动区会吞掉点击，无法区分单击展开与拖动），
// 改为 renderer 记录 pointer 位移，主进程按起点偏移 setBounds。
// ---------------------------------------------------------------------------

let capsuleDragOrigin: { x: number; y: number } | null = null
let capsuleDragLast: { x: number; y: number } | null = null

export function beginCapsuleDrag(): void {
  if (!widgetWindow || widgetWindow.isDestroyed() || widgetMode !== 'capsule') return
  const bounds = widgetWindow.getBounds()
  capsuleDragOrigin = { x: bounds.x, y: bounds.y }
  capsuleDragLast = { ...capsuleDragOrigin }
}

export function moveCapsuleDrag(dx: number, dy: number): void {
  if (!capsuleDragOrigin || !widgetWindow || widgetWindow.isDestroyed()) return
  if (widgetMode !== 'capsule') return
  const x = Math.round(capsuleDragOrigin.x + dx)
  const y = Math.round(capsuleDragOrigin.y + dy)
  const wa = screen.getDisplayMatching({ x, y, width: CAPSULE_WIDTH, height: CAPSULE_HEIGHT }).workArea
  const bounds = clampBoundsToWorkArea({ x, y, width: CAPSULE_WIDTH, height: CAPSULE_HEIGHT }, wa)
  capsuleDragLast = { x: bounds.x, y: bounds.y }
  widgetWindow.setBounds(bounds)
}

export function endCapsuleDrag(): void {
  if (capsuleDragLast) saveCapsulePosition(capsuleDragLast.x, capsuleDragLast.y)
  capsuleDragOrigin = null
  capsuleDragLast = null
  settleWidgetIdleOpacity()
}

/** 兼容旧调用：等同 setWidgetContentHeight */
export function resizeWidgetHeight(height: number): void {
  setWidgetContentHeight(height)
}

/** 切换挂件/胶囊形态：同一窗口 setBounds，不重建窗口 */
export function setWidgetCollapsed(collapsed: boolean): void {
  const nextMode: WidgetMode = collapsed ? 'capsule' : 'widget'
  if (widgetMode === nextMode && widgetWindow && !widgetWindow.isDestroyed()) {
    writeSetting('capsule', collapsed)
    return
  }
  // 先落盘旧形态位置，再切换
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    persistBounds(widgetMode === 'capsule' ? 'capsule' : 'widget')
  }
  widgetMode = nextMode
  // 形态切换时丢弃未完成的拖动起点，避免下一次拖动按旧坐标计算
  capsuleDragOrigin = null
  capsuleDragLast = null
  writeSetting('capsule', collapsed)
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    const bounds = widgetBoundsForMode(nextMode)
    widgetWindow.setBounds(bounds)
    if (nextMode === 'widget') applyWidgetOpacity()
  }
  broadcast('widget:collapsed', { collapsed })
}

/** 胶囊拖动结束后上报位置：clamp 写入 capsuleBounds，胶囊形态下立即 setBounds */
export function saveCapsulePosition(x: number, y: number): void {
  const wa = screen.getDisplayMatching({
    x: Math.round(x),
    y: Math.round(y),
    width: CAPSULE_WIDTH,
    height: CAPSULE_HEIGHT
  }).workArea
  const bounds = clampBoundsToWorkArea(
    { x, y, width: CAPSULE_WIDTH, height: CAPSULE_HEIGHT },
    wa
  )
  writeBounds('capsuleBounds', {
    x: bounds.x,
    y: bounds.y,
    width: CAPSULE_WIDTH,
    height: CAPSULE_HEIGHT,
    displayId: displayIdFor(bounds)
  })
  if (widgetWindow && !widgetWindow.isDestroyed() && widgetMode === 'capsule') {
    widgetWindow.setBounds(bounds)
  }
}

// ---------------------------------------------------------------------------
// 窗口创建
// ---------------------------------------------------------------------------

function createWidgetWindow(initialMode: WidgetMode): BrowserWindow {
  const bounds = widgetBoundsForMode(initialMode)
  const win = new BrowserWindow({
    ...bounds,
    title: '桌面待办',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    roundedCorners: false,
    show: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  applyAlwaysOnTop(getBooleanSetting('alwaysOnTop'))
  win.setVisibleOnAllWorkspaces(false)
  win.on('focus', () => applyWidgetOpacity())
  win.on('blur', () => applyWidgetOpacity())
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win.hide()
  })
  win.on('closed', () => {
    widgetWindow = null
  })
  bindBoundsPersistence(win, 'widget')
  return win
}

function createManagerWindow(): BrowserWindow {
  const saved = readBounds('managerBounds')
  const bounds = saved
    ? resolveSavedBounds(saved, {
        x: 0,
        y: 0,
        width: MANAGER_WIDTH,
        height: MANAGER_HEIGHT
      })
    : { width: MANAGER_WIDTH, height: MANAGER_HEIGHT }
  const win = new BrowserWindow({
    ...bounds,
    minWidth: MANAGER_MIN_WIDTH,
    minHeight: MANAGER_MIN_HEIGHT,
    title: '桌面待办',
    frame: false,
    transparent: false,
    backgroundColor: '#FAF8F2',
    roundedCorners: true,
    hasShadow: true,
    show: false,
    resizable: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win.hide()
  })
  win.on('closed', () => {
    managerWindow = null
  })
  bindBoundsPersistence(win, 'manager')
  return win
}

/** 显示器增删/分辨率变化后把已存在窗口重新夹进可见工作区 */
function reclampWindows(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    const bounds = widgetWindow.getBounds()
    const target =
      widgetMode === 'capsule'
        ? clampBoundsToWorkArea(bounds, screen.getDisplayMatching(bounds).workArea)
        : clampBoundsToWorkArea(bounds, screen.getDisplayMatching(bounds).workArea)
    widgetWindow.setBounds(target)
    scheduleBoundsSave(widgetMode === 'capsule' ? 'capsule' : 'widget')
  }
  if (managerWindow && !managerWindow.isDestroyed()) {
    const bounds = managerWindow.getBounds()
    managerWindow.setBounds(
      clampBoundsToWorkArea(bounds, screen.getDisplayMatching(bounds).workArea)
    )
    scheduleBoundsSave('manager')
  }
}

function bindDisplayListeners(): void {
  if (displayListenersBound) return
  displayListenersBound = true
  screen.on('display-added', reclampWindows)
  screen.on('display-removed', reclampWindows)
  screen.on('display-metrics-changed', reclampWindows)
}

export interface CreateWindowsOptions {
  /** 开机自启（--silent）时不弹挂件，只进托盘 */
  silent?: boolean
}

export function createWindows(options: CreateWindowsOptions = {}): void {
  widgetMode = getBooleanSetting('capsule') ? 'capsule' : 'widget'
  widgetWindow = createWidgetWindow(widgetMode)
  loadView(widgetWindow, 'widget')
  widgetWindow.once('ready-to-show', () => {
    if (!options.silent) showWidget()
  })
  // 完整窗口按需创建：常驻挂件时不必承担第二个渲染进程的内存开销
  // （docs/07 H：挂件常驻内存 < 300MB）。首次打开由 showManager() 懒加载。
  bindDisplayListeners()
}

export function getWidgetWindow(): BrowserWindow | null {
  return widgetWindow
}

export function getManagerWindow(): BrowserWindow | null {
  return managerWindow
}

export function showWidget(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  // 显示前确保 bounds 与当前形态一致（例如上次退出时位置数据已更新）
  widgetWindow.setBounds(widgetBoundsForMode(widgetMode))
  applyWidgetOpacity()
  widgetWindow.show()
  widgetWindow.focus()
}

export function hideWidget(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  widgetWindow.hide()
}

export function isWidgetVisible(): boolean {
  return Boolean(widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible())
}

export function toggleWidget(): void {
  if (isWidgetVisible()) hideWidget()
  else showWidget()
}

function revealManager(): void {
  const win = managerWindow
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

/**
 * 取得完整窗口；未创建或已被销毁（渲染层 window.close()）时按需创建。
 * @param initialView 首次打开时要定位的内置视图（Alt+1..5），通过 URL 参数传递
 */
function ensureManagerWindow(initialView?: string): BrowserWindow {
  if (managerWindow && !managerWindow.isDestroyed()) return managerWindow
  const win = createManagerWindow()
  managerWindow = win
  loadView(win, 'manager', initialView ? { nav: initialView } : {})
  return win
}

export function showManager(): void {
  const win = ensureManagerWindow()
  if (win.webContents.isLoadingMainFrame()) {
    win.once('ready-to-show', revealManager)
    return
  }
  revealManager()
}

/** 打开完整窗口并定位到指定内置视图（全局快捷键 Alt+1..5） */
export function showManagerView(viewId: string): void {
  if (!managerWindow || managerWindow.isDestroyed()) {
    const win = ensureManagerWindow(viewId)
    win.once('ready-to-show', revealManager)
    return
  }
  if (managerWindow.webContents.isLoadingMainFrame()) {
    managerWindow.webContents.once('did-finish-load', () => {
      broadcast('app:navigate', { viewId })
    })
  } else {
    broadcast('app:navigate', { viewId })
  }
  revealManager()
}

export function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function broadcastToOthers(channel: string, payload: unknown, senderId: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win.webContents.id !== senderId) win.webContents.send(channel, payload)
  }
}

/** 退出前把防抖中的位置立即写库（before-quit 调用） */
export function flushWindowBounds(): void {
  flushBoundsSaves()
}
