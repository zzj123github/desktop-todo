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
  const needed = Math.min(popHeight, 320)
  let top = anchor.bottom + gap
  let maxHeight = Math.max(120, Math.min(popHeight, below))
  if (below < needed && above > below) {
    maxHeight = Math.max(120, Math.min(popHeight, above))
    top = Math.max(VIEWPORT_MARGIN, anchor.top - gap - maxHeight)
  }
  return { left, top, maxHeight }
}
