/**
 * windows 位置基准（m03793）单元测试
 * 只测纯计算函数：anchorForBounds / boundsForShape 不触碰 electron 屏幕 API，
 * 可在 Electron-as-node 下运行（见 scripts/run-tests.cjs）。
 */
import { describe, expect, it } from 'vitest'
import { anchorForBounds, boundsForShape } from './windows'

const WORK_AREA = { x: 0, y: 0, width: 1440, height: 900 }

describe('anchorForBounds', () => {
  it('右上角窗口判定为 top-right（默认）', () => {
    const bounds = { x: 1440 - 352 - 56, y: 88, width: 352, height: 420 }
    expect(anchorForBounds(bounds, WORK_AREA)).toBe('top-right')
  })

  it('四个象限分别返回对应基准角', () => {
    const size = { width: 100, height: 100 }
    expect(anchorForBounds({ x: 10, y: 10, ...size }, WORK_AREA)).toBe('top-left')
    expect(anchorForBounds({ x: 1330, y: 10, ...size }, WORK_AREA)).toBe('top-right')
    expect(anchorForBounds({ x: 10, y: 790, ...size }, WORK_AREA)).toBe('bottom-left')
    expect(anchorForBounds({ x: 1330, y: 790, ...size }, WORK_AREA)).toBe('bottom-right')
  })
})

describe('boundsForShape', () => {
  it('右上基准：切换胶囊时右上角坐标不变', () => {
    const widget = { x: 1440 - 352 - 56, y: 88, width: 352, height: 420 }
    const capsule = boundsForShape(widget, 284, 54, WORK_AREA)
    expect(capsule.width).toBe(284)
    expect(capsule.height).toBe(54)
    // 右边缘与顶边保持不变
    expect(capsule.x + capsule.width).toBe(widget.x + widget.width)
    expect(capsule.y).toBe(widget.y)
  })

  it('右下基准：切换挂件时右下角坐标不变', () => {
    const capsule = { x: 1440 - 284 - 56, y: 900 - 54 - 70, width: 284, height: 54 }
    const widget = boundsForShape(capsule, 352, 420, WORK_AREA)
    expect(widget.x + widget.width).toBe(capsule.x + capsule.width)
    expect(widget.y + widget.height).toBe(capsule.y + capsule.height)
  })

  it('左上/左下基准同样保持对应角', () => {
    const topLeft = { x: 16, y: 60, width: 352, height: 300 }
    const shrunk = boundsForShape(topLeft, 284, 54, WORK_AREA)
    expect(shrunk.x).toBe(16)
    expect(shrunk.y).toBe(60)

    const bottomLeft = { x: 16, y: 500, width: 284, height: 54 }
    const grown = boundsForShape(bottomLeft, 352, 420, WORK_AREA)
    expect(grown.x).toBe(16)
    expect(grown.y + grown.height).toBe(bottomLeft.y + bottomLeft.height)
  })

  it('目标尺寸超出工作区时夹进工作区且不越界', () => {
    const nearBottom = { x: 1400, y: 860, width: 100, height: 100 }
    const next = boundsForShape(nearBottom, 352, 520, WORK_AREA)
    expect(next.x).toBeGreaterThanOrEqual(WORK_AREA.x)
    expect(next.y).toBeGreaterThanOrEqual(WORK_AREA.y)
    expect(next.x + next.width).toBeLessThanOrEqual(WORK_AREA.x + WORK_AREA.width)
    expect(next.y + next.height).toBeLessThanOrEqual(WORK_AREA.y + WORK_AREA.height)
  })
})
