import { describe, expect, it } from 'vitest'
import {
  SCROLL_ANIM_MS,
  WHEEL_STEP_LIMIT,
  clampScrollTarget,
  easeOutCubic,
  normalizeWheelPixels,
  scrollProgress
} from './scroll'

describe('normalizeWheelPixels（滚轮增量归一）', () => {
  it('像素模式按 0.4 缩放（一次 120 的滚轮约 2 行）', () => {
    expect(normalizeWheelPixels(120, 0, 132)).toBeCloseTo(48, 5)
    expect(normalizeWheelPixels(-120, 0, 132)).toBeCloseTo(-48, 5)
    expect(normalizeWheelPixels(3, 0, 132)).toBeCloseTo(1.2, 5)
  })

  it('行模式按 24px/行换算', () => {
    expect(normalizeWheelPixels(1, 1, 132)).toBe(24)
    expect(normalizeWheelPixels(3, 1, 132)).toBe(72)
  })

  it('页模式按可视高度换算', () => {
    expect(normalizeWheelPixels(1, 2, 132)).toBe(120)
    expect(normalizeWheelPixels(-1, 2, 132)).toBe(-120)
  })

  it('单次增量限幅 ±120，且非数字/零返回 0', () => {
    expect(normalizeWheelPixels(2000, 0, 132)).toBe(WHEEL_STEP_LIMIT)
    expect(normalizeWheelPixels(-2000, 0, 132)).toBe(-WHEEL_STEP_LIMIT)
    expect(normalizeWheelPixels(Number.NaN, 0, 132)).toBe(0)
    expect(normalizeWheelPixels(0, 0, 132)).toBe(0)
  })
})

describe('clampScrollTarget（目标位置夹取）', () => {
  it('正常增量相加', () => {
    expect(clampScrollTarget(100, 48, 450)).toBe(148)
    expect(clampScrollTarget(100, -48, 450)).toBe(52)
  })

  it('夹在 [0, maxScroll]', () => {
    expect(clampScrollTarget(10, -48, 450)).toBe(0)
    expect(clampScrollTarget(440, 48, 450)).toBe(450)
    expect(clampScrollTarget(0, 48, 0)).toBe(0)
    expect(clampScrollTarget(20, 48, -10)).toBe(0)
  })

  it('非法输入退回 0 边界安全值', () => {
    expect(clampScrollTarget(Number.NaN, 48, 100)).toBe(48)
    expect(clampScrollTarget(50, Number.NaN, 100)).toBe(50)
  })
})

describe('缓动曲线与进度', () => {
  it('easeOutCubic 单调且端点正确', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
    expect(easeOutCubic(0.2)).toBeGreaterThan(easeOutCubic(0.1))
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })

  it('scrollProgress 按时长收敛到 1', () => {
    expect(scrollProgress(0)).toBe(0)
    expect(scrollProgress(SCROLL_ANIM_MS / 2)).toBeCloseTo(0.5, 5)
    expect(scrollProgress(SCROLL_ANIM_MS)).toBe(1)
    expect(scrollProgress(SCROLL_ANIM_MS * 2)).toBe(1)
    expect(scrollProgress(10, 0)).toBe(1)
  })
})
