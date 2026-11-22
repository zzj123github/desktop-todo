/**
 * anchoredPosition · 浮层锚定定位（Popover 与日期选择器共用）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.7 / §3.9（下方空间不足翻到上方，距视口 12）
 */
export interface AnchorRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface PopoverPosition {
  left: number
  top: number
  maxHeight: number
}

export const POPOVER_GAP = 6
export const VIEWPORT_MARGIN = 12

/**
 * 浮层判定：所有浮层都 portal 到 body，彼此在 DOM 上不是父子关系。
 * Popover 的「点击外部关闭」必须把内部嵌套打开的另一层浮层（如日期选择器 .dp-pop）
 * 视为内部，否则点日期面板的瞬间父浮层先被卸载，日期选择无法完成。
 * 与 docs/08 §3.7/§3.9 的层叠顺序一致（pop 131 / datepicker 190 / overlay 120）。
 */
export const FLOATING_LAYER_SELECTOR = '.pop, .dp-pop, .overlay'

/** target 是否落在任意浮层内（含嵌套浮层） */
export function isInsideFloatingLayer(target: EventTarget | null): boolean {
  const el = target as Element | null
  if (!el || typeof el.closest !== 'function') return false
  return el.closest(FLOATING_LAYER_SELECTOR) !== null
}

export function rectOf(el: HTMLElement): AnchorRect {
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  }
}

/**
 * 计算 fixed 定位坐标；宽度优先用 width，高度用 popHeight 估计。
 * 下方空间不足且上方更宽裕时翻到上方。
 */
export function anchoredPosition(
  anchor: AnchorRect,
  popWidth: number,
  popHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  gap = POPOVER_GAP
): PopoverPosition {
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(anchor.left, viewportWidth - popWidth - VIEWPORT_MARGIN)
  )
  const below = viewportHeight - anchor.bottom - gap - VIEWPORT_MARGIN
  const above = anchor.top - gap - VIEWPORT_MARGIN
  // 08 §3.9：完整放不下时翻到上方（此前用 min(popHeight,320) 估算，
  // 351 高的日期面板在小窗口里会「差一点」而不翻转，底部被窗口裁掉）
  const needed = popHeight
  let top = anchor.bottom + gap
  let maxHeight = Math.max(120, Math.min(popHeight, below))
  if (below < needed && above > below) {
    maxHeight = Math.max(120, Math.min(popHeight, above))
    top = Math.max(VIEWPORT_MARGIN, anchor.top - gap - maxHeight)
  }
  return { left, top, maxHeight }
}
