/**
 * windows · widget / capsule / manager 窗口
 * Contract: docs/04-TECH-PLAN.md §窗口 · docs/08-UI-ENGINEERING-SPEC.md §2 · Lead m00124/m00232/m03793
 *
 * 挂件与胶囊是同一个 BrowserWindow 的两个形态（只 setBounds，不重建窗口）：
 * - 挂件：352 宽，高度由 renderer 上报（widget:setHeight，夹 96..min(520, workArea.height)）；
 * - 胶囊：284×54，位置由 renderer 拖动后上报（widget:saveCapsulePosition）。
 * 透明窗口（CSS 画圆角/阴影），完整窗口保持不透明。
 *
 * 位置基准（m03793）：挂件与胶囊共用同一位置；切换形态或高度变化时，按窗口当前
 * 所在的屏幕象限固定基准角（左上/右上/左下/右下，默认右上），该角坐标不变并夹进工作区。
 * 三态互斥（m03793）：挂件 / 胶囊 / 完整窗口同一时刻只显示一种；完整窗口关闭或销毁后
 * 回到之前的桌面形态。
 *
 * bounds 持久化到 settings 的 widgetBounds（桌面形态共用）/ managerBounds，
 * 结构 { x, y, width, height, displayId }，防抖 300ms。capsuleBounds 作为旧字段保留兼容，
 * 不再单独读写。
 */
import { app, BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'node:path'
import type { AppNotice, SettingsKey, WindowControlAction, WindowControlState } from '../shared/types'
import { handleNoticeWindowClosed } from './notices'
import { logMainError } from './logger'
import { activateApp, hideDock, showDock } from './macos'
import {
  getBooleanSetting,
  getNumberSetting,
  readBounds,
  writeBounds,
  writeSetting,
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

/**
 * 桌面形态的透明留白（用户 m06254）：
 * 175% 等非整数 DPI 下，Electron 报告的窗口内容尺寸会比 Win32 实际客户区大约 1~2 物理像素，
 * 卡片贴满窗口时右/下边缘会被窗口裁掉。窗口四周各留 2px 透明边，渲染层同尺寸 padding，
 * 可见卡片仍然精确保持 352 / 284×54。
 */
export const SHAPE_PADDING = 2
/** 挂件窗口宽 = 可见 352 + 左右留白 */
export const WIDGET_WINDOW_WIDTH = WIDGET_WIDTH + SHAPE_PADDING * 2
/** 胶囊窗口尺寸 = 可见 284×54 + 四周留白 */
export const CAPSULE_WINDOW_WIDTH = CAPSULE_WIDTH + SHAPE_PADDING * 2
export const CAPSULE_WINDOW_HEIGHT = CAPSULE_HEIGHT + SHAPE_PADDING * 2

/** 窗口目标尺寸的上下限（含留白），与内容高度的 WIDGET_MIN/MAX_HEIGHT 相差 2×padding */
export const WIDGET_WINDOW_MIN_HEIGHT = WIDGET_MIN_HEIGHT + SHAPE_PADDING * 2
export const WIDGET_WINDOW_MAX_HEIGHT = WIDGET_MAX_HEIGHT + SHAPE_PADDING * 2

const WIDGET_DEFAULT_MARGIN_RIGHT = 56 - SHAPE_PADDING
const WIDGET_DEFAULT_MARGIN_TOP = 88 - SHAPE_PADDING
const CAPSULE_DEFAULT_MARGIN_RIGHT = 56 - SHAPE_PADDING
const CAPSULE_DEFAULT_MARGIN_BOTTOM = 70 - SHAPE_PADDING

/** bounds 写库防抖（docs/04 §窗口：move/resize 300ms 防抖） */
const BOUNDS_SAVE_DEBOUNCE_MS = 300

export type WidgetMode = 'widget' | 'capsule'

/** 桌面形态的基准角：切换形态/改变高度时保持该角在屏幕上的坐标不变 */
export type ShapeAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

let widgetWindow: BrowserWindow | null = null
let managerWindow: BrowserWindow | null = null
let widgetMode: WidgetMode = 'widget'
let quitting = false
/** 最近一次挂件形态的内容高度：胶囊展开时按它恢复（renderer 随后会再上报一次） */
let widgetHeight = 0

/**
 * 桌面形态共用的基准角锚点。
 * 只保存「角 + 该角的屏幕坐标」，切换形态/改高度时直接由锚点换算目标矩形，
 * 不再从 getBounds() 反复取整重算，避免多次切换后基准角累积漂移（m03793 验证）。
 */
interface WidgetAnchorPoint {
  corner: ShapeAnchor
  x: number
  y: number
}
let widgetAnchor: WidgetAnchorPoint | null = null
/**
 * 程序化 setBounds 后的短时抑制窗口：'moved' 事件可能回读被物理像素对齐后的坐标，
 * 若此时落盘并重捕获锚点，会在 175% DPI 下引入 ±1~2 DIP 漂移（四角切换验收发现）。
 */
let suppressBoundsPersistUntil = 0

function markProgrammaticBoundsChange(): void {
  suppressBoundsPersistUntil = Date.now() + 500
}
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

/** 主进程日志目录：退出阶段 userData 仍可读，异常统一写 logs/main.log（用户 m07685） */
function mainLogDir(): string {
  try {
    return join(app.getPath('userData'), 'logs')
  } catch {
    return ''
  }
}

function recordMainError(scope: string, error: unknown): void {
  const dir = mainLogDir()
  if (dir) logMainError(dir, scope, error)
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[main] ${scope}：${message}`)
}

/** 退出阶段读设置会命中已关闭的数据库（closeDatabase 后 getDb 抛错）：静默回退 */
function readNumberSettingSafe(key: SettingsKey, fallback: number): number {
  if (quitting) return fallback
  try {
    return getNumberSetting(key)
  } catch {
    return fallback
  }
}

function loadView(
  win: BrowserWindow,
  view: 'widget' | 'manager' | 'quickadd' | 'editor' | 'notice',
  params: Record<string, string> = {}
): void {
  const file = view === 'quickadd' ? 'quickadd.html' : 'index.html'
  const search = new URLSearchParams({ view, ...params }).toString()
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const loading = devUrl
    ? win.loadURL(`${devUrl}/${file}?${search}`)
    : win.loadFile(join(__dirname, `../renderer/${file}`), { search: `?${search}` })
  // 窗口在加载完成前被销毁（退出、切换形态、编辑器复用）会以 ERR_ABORTED 拒绝，
  // 属于预期路径；不能让 Promise 拒绝冒泡成主进程未捕获异常（用户 m07685）。
  void loading.catch((error: unknown) => {
    if (quitting || win.isDestroyed()) return
    recordMainError(`窗口加载失败（${view}）`, error)
  })
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
    x: wa.x + wa.width - WIDGET_WINDOW_WIDTH - WIDGET_DEFAULT_MARGIN_RIGHT,
    y: wa.y + WIDGET_DEFAULT_MARGIN_TOP,
    width: WIDGET_WINDOW_WIDTH,
    height: Math.min(420, WIDGET_MAX_HEIGHT) + SHAPE_PADDING * 2
  }
}

/** 胶囊默认位置同样在右上（m03793：默认基准角为右上） */
export function defaultCapsuleBounds(): Rectangle {
  const wa = screen.getPrimaryDisplay().workArea
  return {
    x: wa.x + wa.width - CAPSULE_WINDOW_WIDTH - CAPSULE_DEFAULT_MARGIN_RIGHT,
    y: wa.y + WIDGET_DEFAULT_MARGIN_TOP,
    width: CAPSULE_WINDOW_WIDTH,
    height: CAPSULE_WINDOW_HEIGHT
  }
}

/** 按窗口中心相对屏幕工作区中心的位置，判定它贴着哪个角（默认右上） */
export function anchorForBounds(bounds: Rectangle, workArea: Rectangle): ShapeAnchor {
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const workCenterX = workArea.x + workArea.width / 2
  const workCenterY = workArea.y + workArea.height / 2
  const right = centerX >= workCenterX
  const bottom = centerY >= workCenterY
  if (bottom) return right ? 'bottom-right' : 'bottom-left'
  return right ? 'top-right' : 'top-left'
}

/**
 * 以当前窗口的基准角为锚点，计算目标尺寸下的新矩形。
 * 例：窗口在右上角时保持右上角坐标不变，把宽高换成目标尺寸，再夹进工作区。
 */
export function boundsForShape(
  current: Rectangle,
  width: number,
  height: number,
  workArea: Rectangle
): Rectangle {
  const anchor = anchorForBounds(current, workArea)
  const anchorX = anchor.endsWith('right') ? current.x + current.width : current.x
  const anchorY = anchor.startsWith('bottom') ? current.y + current.height : current.y
  const x = anchor.endsWith('right') ? anchorX - width : anchorX
  const y = anchor.startsWith('bottom') ? anchorY - height : anchorY
  return clampBoundsToWorkArea({ x, y, width, height }, workArea)
}

/** 记录位置对应的基准角与角坐标（窗口拖动结束/位置恢复时调用） */
function captureWidgetAnchor(bounds: Rectangle, workArea: Rectangle): WidgetAnchorPoint {
  const corner = anchorForBounds(bounds, workArea)
  return {
    corner,
    x: corner.endsWith('right') ? bounds.x + bounds.width : bounds.x,
    y: corner.startsWith('bottom') ? bounds.y + bounds.height : bounds.y
  }
}

/** 由基准角锚点 + 目标尺寸换算矩形（角坐标保持不动） */
function boundsFromWidgetAnchor(
  anchor: WidgetAnchorPoint,
  width: number,
  height: number,
  workArea: Rectangle
): Rectangle {
  const x = anchor.corner.endsWith('right') ? anchor.x - width : anchor.x
  const y = anchor.corner.startsWith('bottom') ? anchor.y - height : anchor.y
  return clampBoundsToWorkArea({ x, y, width, height }, workArea)
}

/** 把持久化/回读的矩形规范化成当前形态的窗口尺寸（宽 = 窗口宽，高 = 窗口高） */
export function normalizeShapeBounds(bounds: Rectangle, mode: WidgetMode): Rectangle {
  if (mode === 'capsule') {
    return { ...bounds, width: CAPSULE_WINDOW_WIDTH, height: CAPSULE_WINDOW_HEIGHT }
  }
  return {
    ...bounds,
    width: WIDGET_WINDOW_WIDTH,
    height: Math.max(
      WIDGET_WINDOW_MIN_HEIGHT,
      Math.min(bounds.height, WIDGET_WINDOW_MAX_HEIGHT)
    )
  }
}

function shapeSize(mode: WidgetMode): { width: number; height: number } {
  if (mode === 'capsule') return { width: CAPSULE_WINDOW_WIDTH, height: CAPSULE_WINDOW_HEIGHT }
  const saved = readBounds('widgetBounds')
  const fallbackContent = Math.min(
    widgetHeight || (saved ? saved.height - SHAPE_PADDING * 2 : 420),
    WIDGET_MAX_HEIGHT
  )
  const contentHeight = Math.max(WIDGET_MIN_HEIGHT, Math.min(fallbackContent, WIDGET_MAX_HEIGHT))
  return { width: WIDGET_WINDOW_WIDTH, height: contentHeight + SHAPE_PADDING * 2 }
}

/**
 * 桌面形态的启动/恢复位置：优先用共用的 widgetBounds；旧数据里只有 capsuleBounds 时也能迁移。
 * 按保存位置所在象限固定基准角，再换成当前形态的尺寸。
 */
function resolveShapeBounds(mode: WidgetMode): Rectangle {
  const saved = readBounds('widgetBounds') ?? readBounds('capsuleBounds')
  const base = normalizeShapeBounds(
    saved ? resolveSavedBounds(saved, defaultWidgetBounds()) : defaultWidgetBounds(),
    mode
  )
  const workArea = screen.getDisplayMatching(base).workArea
  const size = shapeSize(mode)
  widgetAnchor = captureWidgetAnchor(base, workArea)
  return boundsFromWidgetAnchor(widgetAnchor, size.width, size.height, workArea)
}

/** 桌面形态的位置统一持久化到 widgetBounds（挂件/胶囊共用同一位置） */
function saveShapeBounds(bounds: Rectangle, capture = true): void {
  const wa = screen.getDisplayMatching(bounds).workArea
  // 落盘前统一成当前形态的窗口尺寸，避免高 DPI 下回读的 ±1px 误差来回累积
  const normalized = clampBoundsToWorkArea(normalizeShapeBounds(bounds, widgetMode), wa)
  // 由锚点换算出的程序化矩形不再反向捕获锚点，避免 DPI 取整误差累积
  if (capture) widgetAnchor = captureWidgetAnchor(normalized, wa)
  writeBounds('widgetBounds', {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    displayId: displayIdFor(normalized)
  })
}

function displayIdFor(bounds: Rectangle): number {
  return screen.getDisplayMatching(bounds).id
}

// ---------------------------------------------------------------------------
// bounds 持久化（防抖）
// ---------------------------------------------------------------------------

function persistBounds(kind: 'widget' | 'capsule' | 'manager'): void {
  const win = kind === 'manager' ? managerWindow : widgetWindow
  if (!win || win.isDestroyed()) return
  if (kind === 'manager') {
    // 最大化 / 全屏是临时态：不能把它当成用户设的窗口尺寸写库（还原后仍回到原尺寸）
    if (win.isMaximized() || win.isFullScreen()) return
    const bounds = win.getBounds()
    writeBounds('managerBounds', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      displayId: displayIdFor(bounds)
    })
    return
  }
  const bounds = win.getBounds()
  // 程序化切换形态/高度后的 moved 事件不落盘（位置已由 setBounds 主动写入）
  if (Date.now() < suppressBoundsPersistUntil) return
  // 桌面形态（挂件/胶囊）共用同一位置：高 DPI 下 getBounds 可能回读 ±1px 或中间态，
  // 按当前形态规范化尺寸后再落盘，避免下次启动把窗口撑大。
  const isCapsule = widgetMode === 'capsule'
  const width = isCapsule ? CAPSULE_WINDOW_WIDTH : WIDGET_WINDOW_WIDTH
  const height = isCapsule
    ? CAPSULE_WINDOW_HEIGHT
    : Math.round(Math.max(WIDGET_WINDOW_MIN_HEIGHT, Math.min(bounds.height, WIDGET_WINDOW_MAX_HEIGHT)))
  const wa = screen.getDisplayMatching(bounds).workArea
  const next = clampBoundsToWorkArea({ x: bounds.x, y: bounds.y, width, height }, wa)
  // 真实拖动结束后以实际位置重捕获基准角（此后切换形态保持该角）
  widgetAnchor = captureWidgetAnchor(next, wa)
  writeBounds('widgetBounds', {
    x: next.x,
    y: next.y,
    width,
    height,
    displayId: displayIdFor(next)
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
        settleWidgetIdleOpacity()
      } catch (error) {
        // 退出过程中设置表/窗口可能已关闭：记录但不弹框（用户 m07685）
        if (!quitting) recordMainError('窗口位置保存失败', error)
      }
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
    scheduleBoundsSave(kind)
  }
  win.on('moved', handler)
  win.on('resized', handler)
}

// ---------------------------------------------------------------------------
// 透明度 / 置顶
// ---------------------------------------------------------------------------

/** 非焦点时按设置降低不透明度（仅挂件；Windows/macOS 均支持 setOpacity） */
export function applyWidgetOpacity(): void {
  if (quitting || !widgetWindow || widgetWindow.isDestroyed()) return
  // 退出阶段数据库可能已关闭：读取失败时保持当前不透明度，不要把异常抛进 focus/blur 回调
  const configured = readNumberSettingSafe('opacity', 1)
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
  if (quitting || !widgetWindow || widgetWindow.isDestroyed()) return
  const configured = readNumberSettingSafe('opacity', 1)
  if (configured >= 1) return
  if (!widgetWindow.isFocused()) return
  widgetWindow.blur()
}

export function applyAlwaysOnTop(enabled: boolean): void {
  if (quitting || !widgetWindow || widgetWindow.isDestroyed()) return
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
 * 高度变化保持当前基准角（m03793）：窗口在右上角时顶边不动、向下生长；
 * 在右下角时底边不动、向上生长。浮层展开后同样按这个规则加高。
 */
export function setWidgetContentHeight(height: number): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  if (widgetMode === 'capsule') return
  const bounds = widgetWindow.getBounds()
  const wa = screen.getDisplayMatching(bounds).workArea
  // 窗口高度 = 内容高度 + 四周留白；内容高度上限按工作区扣除留白计算
  const maxHeight = Math.min(WIDGET_MAX_HEIGHT, wa.height - SHAPE_PADDING * 2)
  const contentHeight = Math.round(Math.max(WIDGET_MIN_HEIGHT, Math.min(height, maxHeight)))
  widgetHeight = contentHeight
  const anchor = widgetAnchor ?? captureWidgetAnchor(bounds, wa)
  const next = boundsFromWidgetAnchor(
    anchor,
    WIDGET_WINDOW_WIDTH,
    contentHeight + SHAPE_PADDING * 2,
    wa
  )
  if (
    bounds.height === next.height &&
    bounds.y === next.y &&
    bounds.x === next.x &&
    bounds.width === next.width
  ) {
    return
  }
  markProgrammaticBoundsChange()
  widgetWindow.setBounds(next)
  saveShapeBounds(next, false)
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
  const wa = screen.getDisplayMatching({
    x,
    y,
    width: CAPSULE_WINDOW_WIDTH,
    height: CAPSULE_WINDOW_HEIGHT
  }).workArea
  const bounds = clampBoundsToWorkArea(
    { x, y, width: CAPSULE_WINDOW_WIDTH, height: CAPSULE_WINDOW_HEIGHT },
    wa
  )
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

/**
 * 切换挂件/胶囊形态：同一窗口 setBounds，不重建窗口。
 * 位置基准自适应：按当前窗口所在象限固定基准角（默认右上），该角坐标不变。
 */
export function setWidgetCollapsed(collapsed: boolean): void {
  const nextMode: WidgetMode = collapsed ? 'capsule' : 'widget'
  if (widgetMode === nextMode && widgetWindow && !widgetWindow.isDestroyed()) {
    writeSetting('capsule', collapsed)
    return
  }
  const win = widgetWindow
  const previousMode = widgetMode
  const current = win && !win.isDestroyed() ? win.getBounds() : null
  if (win && !win.isDestroyed() && previousMode === 'widget') {
    // 窗口高度含四周留白，换算回内容高度保存，展开时再按内容高度恢复
    const windowHeight = current?.height ?? widgetHeight + SHAPE_PADDING * 2
    widgetHeight = Math.max(
      WIDGET_MIN_HEIGHT,
      Math.min(windowHeight - SHAPE_PADDING * 2, WIDGET_MAX_HEIGHT)
    )
  }
  widgetMode = nextMode
  // 形态切换时丢弃未完成的拖动起点，避免下一次拖动按旧坐标计算
  capsuleDragOrigin = null
  capsuleDragLast = null
  writeSetting('capsule', collapsed)
  if (win && !win.isDestroyed() && current) {
    const wa = screen.getDisplayMatching(current).workArea
    const size = shapeSize(nextMode)
    // 以当前形态的基准角为锚点换算目标形态，角坐标保持不变
    const anchor = widgetAnchor ?? captureWidgetAnchor(current, wa)
    widgetAnchor = anchor
    const next = boundsFromWidgetAnchor(anchor, size.width, size.height, wa)
    markProgrammaticBoundsChange()
    win.setBounds(next)
    saveShapeBounds(next, false)
    if (nextMode === 'widget') applyWidgetOpacity()
  }
  broadcast('widget:collapsed', { collapsed })
}

/**
 * 桌面形态拖动结束后上报位置（IPC 名沿用 widget:saveCapsulePosition）：
 * 挂件/胶囊共用同一位置，统一写入 widgetBounds。
 */
export function saveCapsulePosition(x: number, y: number): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  const size = shapeSize(widgetMode)
  const wa = screen.getDisplayMatching({
    x: Math.round(x),
    y: Math.round(y),
    width: size.width,
    height: size.height
  }).workArea
  const bounds = clampBoundsToWorkArea({ x, y, width: size.width, height: size.height }, wa)
  saveShapeBounds(bounds)
  markProgrammaticBoundsChange()
  widgetWindow.setBounds(bounds)
}

// ---------------------------------------------------------------------------
// 窗口创建
// ---------------------------------------------------------------------------

/**
 * 开发模式：F12 开关当前窗口的 DevTools（分离窗口，不影响 352 宽的挂件）。
 * 打包版不注册（enabled 默认取 !app.isPackaged），正式版没有该行为。
 * activate: false 让 DevTools 不抢焦点，应用窗口保持聚焦时再按 F12 即可关闭。
 */
export function attachDevToolsShortcut(
  win: BrowserWindow,
  enabled: boolean = !app.isPackaged
): void {
  if (!enabled) return
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F12') return
    event.preventDefault()
    const contents = win.webContents
    if (contents.isDevToolsOpened()) contents.closeDevTools()
    else contents.openDevTools({ mode: 'detach', activate: false })
  })
}

function createWidgetWindow(initialMode: WidgetMode): BrowserWindow {
  const bounds = resolveShapeBounds(initialMode)
  widgetHeight = Math.max(
    WIDGET_MIN_HEIGHT,
    Math.min(bounds.height - SHAPE_PADDING * 2, WIDGET_MAX_HEIGHT)
  )
  const win = new BrowserWindow({
    ...bounds,
    title: '桌面待办',
    frame: false,
    thickFrame: false,
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
  attachDevToolsShortcut(win)
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


// ---------------------------------------------------------------------------
// 任务编辑弹窗（桌面级独立窗口）
//
// 挂件只有 352 宽，编辑面板 502 wide 塞进挂件会被裁切（原型是桌面级弹窗）。
// 因此挂件内点击任务时，主进程创建一个独立的透明弹窗承载同一个 EditorModal：
// - 宽 550 = 502 弹窗 + 24×2 内边距，让 08 的 modal 阴影有空间；
// - 高度由渲染层测量后上报（editor:ready），整体居中到挂件所在显示器；
// - 透明无边框、置顶、跳过任务栏，Esc/X/保存/删除后销毁，挂件保持原样。
// ---------------------------------------------------------------------------

/** 编辑弹窗内容宽度（08 §3.8：wide 502）+ 左右内边距 24×2 */
export const EDITOR_WINDOW_WIDTH = 550
const EDITOR_WINDOW_MIN_HEIGHT = 320

let editorWindow: BrowserWindow | null = null

function editorWindowBounds(height: number): Rectangle {
  const reference =
    widgetWindow && !widgetWindow.isDestroyed() ? widgetWindow.getBounds() : undefined
  const display = reference ? screen.getDisplayMatching(reference) : screen.getPrimaryDisplay()
  const workArea = display.workArea
  const width = Math.min(EDITOR_WINDOW_WIDTH, workArea.width)
  const wanted = Math.max(Math.round(height), EDITOR_WINDOW_MIN_HEIGHT)
  const heightPx = Math.min(wanted, workArea.height - 32)
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - heightPx) / 2),
    width,
    height: heightPx
  }
}

/** 打开任务编辑弹窗；taskId 为空表示新建任务 */
export function openEditorWindow(taskId: string | null): void {
  if (quitting) return
  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.destroy()
    editorWindow = null
  }
  const win = new BrowserWindow({
    ...editorWindowBounds(EDITOR_WINDOW_MIN_HEIGHT),
    title: '桌面待办',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    roundedCorners: false,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
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
  attachDevToolsShortcut(win)
  editorWindow = win
  win.on('closed', () => {
    if (editorWindow === win) editorWindow = null
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(false)
  loadView(win, 'editor', taskId ? { task: taskId } : {})
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    // macOS：独立编辑弹窗也是应用窗口，先激活应用再显示（与提示窗口一致）
    activateApp()
    win.show()
    win.focus()
  })
}

/** 关闭任务编辑弹窗（幂等） */
export function closeEditorWindow(): void {
  const win = editorWindow
  editorWindow = null
  if (win && !win.isDestroyed()) win.destroy()
}

/** 渲染层测量内容高度后调用：按内容高度重新居中 */
export function resizeEditorWindow(height: number): void {
  const win = editorWindow
  if (!win || win.isDestroyed()) return
  win.setBounds(editorWindowBounds(height))
}

export function getEditorWindow(): BrowserWindow | null {
  return editorWindow
}

// ---------------------------------------------------------------------------
// 应用内提示窗口（替代原生 dialog）
//
// Contract: docs/08-UI-ENGINEERING-SPEC.md §3.8 · docs/01-PRD.md FR-5
// - 472 宽 = 424 提示弹窗 + 24×2 内边距；透明无边框、置顶、居中到挂件所在显示器；
// - 高度由渲染层测量后上报（notice:ready，已含窗口内边距，主进程不再叠加）；
// - 用户确认（知道了 / Esc / X）后由主进程关闭，挂件/完整窗口保持原样。
// ---------------------------------------------------------------------------

/** 提示弹窗内容宽度（08 §3.8：confirm 424）+ 左右内边距 24×2 */
export const NOTICE_WINDOW_WIDTH = 472
const NOTICE_WINDOW_MIN_HEIGHT = 200

let noticeWindow: BrowserWindow | null = null
let noticeWindowLoaded = false

function noticeWindowBounds(height: number): Rectangle {
  const reference =
    widgetWindow && !widgetWindow.isDestroyed() ? widgetWindow.getBounds() : undefined
  const display = reference ? screen.getDisplayMatching(reference) : screen.getPrimaryDisplay()
  const workArea = display.workArea
  const width = Math.min(NOTICE_WINDOW_WIDTH, workArea.width)
  const wanted = Math.max(Math.round(height), NOTICE_WINDOW_MIN_HEIGHT)
  const heightPx = Math.min(wanted, workArea.height - 32)
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - heightPx) / 2),
    width,
    height: heightPx
  }
}

/** 打开（或聚焦）应用内提示窗口 */
export function createNoticeWindow(): void {
  // 退出阶段不再新建窗口，避免在 teardown 中重新触发加载/队列（用户 m07685）
  if (quitting) return
  if (noticeWindow && !noticeWindow.isDestroyed()) {
    if (!noticeWindow.isVisible()) {
      noticeWindow.show()
      noticeWindow.focus()
    }
    return
  }
  noticeWindowLoaded = false
  const win = new BrowserWindow({
    ...noticeWindowBounds(NOTICE_WINDOW_MIN_HEIGHT),
    title: '桌面待办',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    roundedCorners: false,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
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
  attachDevToolsShortcut(win)
  noticeWindow = win
  win.webContents.on('did-finish-load', () => {
    if (noticeWindow === win) noticeWindowLoaded = true
  })
  win.on('closed', () => {
    if (noticeWindow !== win) return
    noticeWindow = null
    noticeWindowLoaded = false
    handleNoticeWindowClosed()
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(false)
  loadView(win, 'notice')
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    // macOS：提示窗口可能在其他应用前台时弹出，先激活应用再显示
    activateApp()
    win.show()
    win.focus()
  })
}

/** 提示窗口是否已完成首帧（可接收事件） */
export function isNoticeWindowLoaded(): boolean {
  return noticeWindowLoaded && !!noticeWindow && !noticeWindow.isDestroyed()
}

/** 向提示窗口发送一条提示；窗口不可用返回 false */
export function sendNoticeToWindow(notice: AppNotice): boolean {
  const win = noticeWindow
  if (!win || win.isDestroyed() || !noticeWindowLoaded) return false
  try {
    win.webContents.send('app:notice', notice)
    return true
  } catch (error) {
    console.warn('[windows] 发送应用内提示失败：', error instanceof Error ? error.message : error)
    return false
  }
}

/** 关闭提示窗口（幂等） */
export function closeNoticeWindow(): void {
  const win = noticeWindow
  noticeWindow = null
  noticeWindowLoaded = false
  if (win && !win.isDestroyed()) win.destroy()
}

/** 渲染层测量内容高度后调用：按内容高度重新居中 */
export function resizeNoticeWindow(height: number): void {
  const win = noticeWindow
  if (!win || win.isDestroyed()) return
  win.setBounds(noticeWindowBounds(height))
}

/** 供测试/诊断 */
export function getNoticeWindow(): BrowserWindow | null {
  return noticeWindow
}

// ---------------------------------------------------------------------------
// 完整窗口的自绘窗口按钮（最小化 / 最大化 / 全屏）
//
// 完整窗口 frame:false 且没有系统标题栏，最小化/最大化/关闭只能由渲染层按钮发起。
// 方案与视觉见 design/PROPOSAL-v1.6.md；规格见 docs/02 §窗口按钮、docs/08 §3.14。
// ---------------------------------------------------------------------------

export function getManagerWindowState(): WindowControlState {
  const win = managerWindow
  if (!win || win.isDestroyed()) return { maximized: false, fullscreen: false }
  return { maximized: win.isMaximized(), fullscreen: win.isFullScreen() }
}

/** 状态变化后推给渲染层：图标（最大化 ⇄ 还原）与 aria-pressed 跟系统一致 */
function broadcastManagerWindowState(): void {
  const win = managerWindow
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return
  win.webContents.send('window:state', getManagerWindowState())
}

/**
 * 执行窗口按钮动作。窗口不存在时静默忽略（按钮只在完整窗口里渲染）。
 * - minimize：进任务栏 / Dock；
 * - toggle-maximize：最大化 ⇄ 还原（macOS 上即「缩放」，也是 ⌥ 单击绿灯的行为）；
 * - toggle-fullscreen：全屏 ⇄ 退出全屏（macOS 绿色按钮单击）。
 */
export function controlManagerWindow(action: WindowControlAction): void {
  const win = managerWindow
  if (!win || win.isDestroyed()) return
  switch (action) {
    case 'minimize':
      win.minimize()
      break
    case 'toggle-maximize':
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
      break
    case 'toggle-fullscreen':
      win.setFullScreen(!win.isFullScreen())
      break
  }
}

function bindManagerWindowStateEvents(win: BrowserWindow): void {
  win.on('maximize', broadcastManagerWindowState)
  win.on('unmaximize', broadcastManagerWindowState)
  win.on('enter-full-screen', broadcastManagerWindowState)
  win.on('leave-full-screen', broadcastManagerWindowState)
  win.on('restore', broadcastManagerWindowState)
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
  attachDevToolsShortcut(win)
  bindManagerWindowStateEvents(win)
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win.hide()
    // 三态互斥：完整窗口关闭后回到之前的桌面形态（m03793）
    showWidget()
  })
  win.on('closed', () => {
    managerWindow = null
    // 渲染层 window.close() 会直接销毁窗口，绕过上面 close 事件的拦截
    if (!quitting) showWidget()
  })
  bindBoundsPersistence(win, 'manager')
  return win
}

/** 显示器增删/分辨率变化后把已存在窗口重新夹进可见工作区（桌面形态保持基准角） */
function reclampWindows(): void {
  // 退出过程中显示器变化不再重排窗口，避免操作正在销毁的窗口
  if (quitting) return
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    const bounds = widgetWindow.getBounds()
    const wa = screen.getDisplayMatching(bounds).workArea
    const size = shapeSize(widgetMode)
    const target = boundsForShape(bounds, size.width, size.height, wa)
    widgetWindow.setBounds(target)
    saveShapeBounds(target)
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
  // macOS：只显示桌面形态时不占 Dock（完整窗口打开时再显示，见 revealManager）
  if (!managerVisible()) hideDock()
}

export function getWidgetWindow(): BrowserWindow | null {
  return widgetWindow
}

export function getManagerWindow(): BrowserWindow | null {
  return managerWindow
}

/** 完整窗口当前是否可见（三态互斥下桌面形态与完整窗口不会同时显示） */
function managerVisible(): boolean {
  return Boolean(managerWindow && !managerWindow.isDestroyed() && managerWindow.isVisible())
}

/** 显示桌面形态（挂件/胶囊）；三态互斥：显示时隐藏完整窗口 */
export function showWidget(): void {
  if (quitting || !widgetWindow || widgetWindow.isDestroyed()) return
  if (managerWindow && !managerWindow.isDestroyed() && managerWindow.isVisible()) {
    managerWindow.hide()
  }
  // 显示前确保 bounds 与当前形态一致（例如上次退出时位置数据已更新）
  widgetWindow.setBounds(resolveShapeBounds(widgetMode))
  applyWidgetOpacity()
  // macOS：从菜单栏图标/全局快捷键唤起时先把应用激活，窗口才能收到键盘输入
  activateApp()
  widgetWindow.show()
  widgetWindow.focus()
  // 完整窗口已隐藏：macOS 收起 Dock 图标，只留桌面形态 + 菜单栏图标
  hideDock()
}

/**
 * 完整窗口的「收起到挂件 / 收起到胶囊」入口（m03793）：
 * 先切换到目标桌面形态，再隐藏完整窗口并显示桌面形态（三态互斥）。
 */
export function showWidgetMode(collapsed: boolean): void {
  setWidgetCollapsed(collapsed)
  showWidget()
}

export function hideWidget(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  widgetWindow.hide()
}

export function isWidgetVisible(): boolean {
  return Boolean(widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible())
}

export function toggleWidget(): void {
  const managerVisible = Boolean(
    managerWindow && !managerWindow.isDestroyed() && managerWindow.isVisible()
  )
  if (isWidgetVisible() && !managerVisible) hideWidget()
  else showWidget()
}

function revealManager(): void {
  const win = managerWindow
  if (!win || win.isDestroyed()) return
  // 切换场景时收起编辑弹窗，避免两个桌面级窗口叠在一起
  closeEditorWindow()
  // 三态互斥：打开完整窗口时隐藏桌面形态
  if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
    widgetWindow.hide()
  }
  if (win.isMinimized()) win.restore()
  // macOS：完整窗口是常规窗口，显示 Dock 图标（可 Cmd+Tab 切回）并激活应用
  showDock()
  activateApp()
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
  if (quitting) return
  const win = ensureManagerWindow()
  if (win.webContents.isLoadingMainFrame()) {
    win.once('ready-to-show', revealManager)
    return
  }
  revealManager()
}

/** 打开完整窗口并定位到指定内置视图（全局快捷键 Alt+1..5） */
export function showManagerView(viewId: string): void {
  if (quitting) return
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
    if (win.isDestroyed()) continue
    // webContents 可能先于窗口销毁：退出阶段 send 会抛 "Object has been destroyed"
    if (!win.webContents || win.webContents.isDestroyed()) continue
    win.webContents.send(channel, payload)
  }
}

export function broadcastToOthers(channel: string, payload: unknown, senderId: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (!win.webContents || win.webContents.isDestroyed()) continue
    if (win.webContents.id !== senderId) win.webContents.send(channel, payload)
  }
}

/** 退出前把防抖中的位置立即写库（before-quit 调用） */
export function flushWindowBounds(): void {
  flushBoundsSaves()
}
