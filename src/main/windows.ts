/**
 * windows · widget / manager / capsule / quickadd 窗口
 * Contract: docs/04-TECH-PLAN.md §窗口 · docs/08-UI-ENGINEERING-SPEC.md §2
 *
 * 挂件与胶囊是同一个 BrowserWindow 内的两个 React 视图（不新建第二个窗口），
 * 从而共享状态、避免两个窗口的焦点竞争。完整窗口是独立 BrowserWindow。
 */
import { BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'node:path'

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

let widgetWindow: BrowserWindow | null = null
let managerWindow: BrowserWindow | null = null
let quitting = false

export function setQuitting(value: boolean): void {
  quitting = value
}

export function isQuitting(): boolean {
  return quitting
}

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function loadView(win: BrowserWindow, view: 'widget' | 'manager' | 'quickadd'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(`${devUrl}/${view === 'quickadd' ? 'quickadd.html' : 'index.html'}?view=${view}`)
  } else {
    void win.loadFile(join(__dirname, `../renderer/${view === 'quickadd' ? 'quickadd.html' : 'index.html'}`), {
      search: `?view=${view}`
    })
  }
}

/** 把矩形夹进某个显示器工作区，避免多显示器拔插后窗口消失 */
export function clampToWorkArea(bounds: Rectangle): Rectangle {
  const display = screen.getDisplayMatching(bounds)
  const wa = display.workArea
  const width = Math.min(bounds.width, wa.width)
  const height = Math.min(bounds.height, wa.height)
  const x = Math.min(Math.max(bounds.x, wa.x), wa.x + wa.width - width)
  const y = Math.min(Math.max(bounds.y, wa.y), wa.y + wa.height - height)
  return { x, y, width, height }
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

function createWidgetWindow(): BrowserWindow {
  const bounds = defaultWidgetBounds()
  const win = new BrowserWindow({
    ...bounds,
    title: '桌面待办',
    frame: false,
    transparent: false,
    backgroundColor: '#FAF8F2',
    roundedCorners: true,
    hasShadow: true,
    show: false,
    resizable: false,
    maximizable: false,
    minimizable: true,
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
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(false)
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win.hide()
  })
  win.on('closed', () => {
    widgetWindow = null
  })
  return win
}

function createManagerWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: MANAGER_WIDTH,
    height: MANAGER_HEIGHT,
    minWidth: MANAGER_MIN_WIDTH,
    minHeight: MANAGER_MIN_HEIGHT,
    title: '桌面待办',
    frame: false,
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
  return win
}

export interface CreateWindowsOptions {
  /** 开机自启（--silent）时不弹挂件，只进托盘 */
  silent?: boolean
}

export function createWindows(options: CreateWindowsOptions = {}): void {
  widgetWindow = createWidgetWindow()
  loadView(widgetWindow, 'widget')
  widgetWindow.once('ready-to-show', () => {
    if (!options.silent) showWidget()
  })
  managerWindow = createManagerWindow()
  loadView(managerWindow, 'manager')
}

export function getWidgetWindow(): BrowserWindow | null {
  return widgetWindow
}

export function getManagerWindow(): BrowserWindow | null {
  return managerWindow
}

export function showWidget(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
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

export function showManager(): void {
  if (!managerWindow || managerWindow.isDestroyed()) return
  if (managerWindow.isMinimized()) managerWindow.restore()
  managerWindow.show()
  managerWindow.focus()
}

export function resizeWidgetHeight(height: number): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  const nextHeight = Math.max(WIDGET_MIN_HEIGHT, Math.min(Math.round(height), WIDGET_MAX_HEIGHT))
  const bounds = widgetWindow.getBounds()
  if (bounds.height === nextHeight) return
  const display = screen.getDisplayMatching(bounds)
  const wa = display.workArea
  const maxHeight = Math.min(nextHeight, wa.height - 16)
  const y = Math.min(bounds.y, wa.y + wa.height - maxHeight)
  widgetWindow.setBounds({ x: bounds.x, y, width: WIDGET_WIDTH, height: maxHeight })
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
