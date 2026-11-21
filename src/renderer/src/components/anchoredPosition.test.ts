/**
 * anchoredPosition.test.ts · 浮层内部判定（用户反馈 #7：点日期面板关闭父浮层）
 * 真实行为测试：给 isInsideFloatingLayer 传真实「类元素」对象，验证 DOM 选择器判定。
 */
import { describe, expect, it } from 'vitest'
import { FLOATING_LAYER_SELECTOR, isInsideFloatingLayer } from './anchoredPosition'

/** 最小 Element 替身：只实现 closest(selector) 语义（真实 DOM 的行为契约） */
function fakeElement(chain: string[]): { closest: (selector: string) => unknown } {
  return {
    closest: (selector: string) =>
      chain.includes(selector) ? { matches: true } : chain.length > 0 ? null : null
  }
}

describe('isInsideFloatingLayer', () => {
  it('空事件目标 / 非元素目标不算浮层内', () => {
    expect(isInsideFloatingLayer(null)).toBe(false)
    expect(isInsideFloatingLayer({} as EventTarget)).toBe(false)
  })

  it('日期选择器弹层（.dp-pop）内的点击算浮层内 → 父 Popover 不应关闭', () => {
    const target = fakeElement([FLOATING_LAYER_SELECTOR]) as unknown as EventTarget
    expect(isInsideFloatingLayer(target)).toBe(true)
  })

  it('普通输入区（不在任何浮层）不算浮层内 → 浮层应关闭', () => {
    const target = fakeElement([]) as unknown as EventTarget
    expect(isInsideFloatingLayer(target)).toBe(false)
  })

  it('浮层选择器覆盖 pop / dp-pop / overlay 三类 portal 浮层', () => {
    for (const selector of ['.pop', '.dp-pop', '.overlay']) {
      expect(FLOATING_LAYER_SELECTOR.split(', ')).toContain(selector)
    }
  })
})
