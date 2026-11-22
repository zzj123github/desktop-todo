/**
 * 滚动工具 · 滚轮增量归一与缓动
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.9 · 用户 m06992（时间列表滚轮平滑）
 *
 * 背景：原生鼠标滚轮在时间列表里一次跳 5 行（120px），可视区只有约 5.5 行，
 * 没有中间帧，观感像一次换屏。这里把 wheel 增量归一成像素并做应用侧缓动，
 * 纯函数部分与 DOM 解耦，便于单测。
 */

/** 时间列表行高（与 .dp-tl-item 的 24px 对应） */
export const WHEEL_ROW_PX = 24

/** 像素增量缩放：一次标准滚轮 deltaY≈120 → 约 48px（2 行） */
export const WHEEL_PIXEL_SCALE = 0.4

/** 单次滚轮最多滚动的像素，避免高速滚轮/翻页轮一下跳过整列 */
export const WHEEL_STEP_LIMIT = 120

/** 平滑滚动时长（ms） */
export const SCROLL_ANIM_MS = 160

/**
 * 把 WheelEvent 的增量归一成像素。
 * @param deltaY 原始 deltaY
 * @param deltaMode 0=像素、1=行、2=页（DOM_DELTA_*）
 * @param viewportPx 可视高度（页模式用）
 */
export function normalizeWheelPixels(deltaY: number, deltaMode: number, viewportPx: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 0
  let px: number
  if (deltaMode === 1) {
    px = deltaY * WHEEL_ROW_PX
  } else if (deltaMode === 2) {
    px = deltaY * Math.max(0, viewportPx)
  } else {
    px = deltaY * WHEEL_PIXEL_SCALE
  }
  if (px > WHEEL_STEP_LIMIT) return WHEEL_STEP_LIMIT
  if (px < -WHEEL_STEP_LIMIT) return -WHEEL_STEP_LIMIT
  return px
}

/** 目标滚动位置：从当前位置加增量并夹在 [0, maxScroll] */
export function clampScrollTarget(current: number, deltaPx: number, maxScroll: number): number {
  const max = Math.max(0, maxScroll)
  const next = (Number.isFinite(current) ? current : 0) + (Number.isFinite(deltaPx) ? deltaPx : 0)
  if (next <= 0) return 0
  if (next >= max) return max
  return next
}

/** ease-out cubic：0→0、1→1，前快后慢 */
export function easeOutCubic(t: number): number {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t
  return 1 - Math.pow(1 - clamped, 3)
}

/** 动画进度（0..1） */
export function scrollProgress(elapsedMs: number, durationMs = SCROLL_ANIM_MS): number {
  if (durationMs <= 0) return 1
  const t = elapsedMs / durationMs
  return t <= 0 ? 0 : t >= 1 ? 1 : t
}
