/**
 * windows 位置基准（m03793）单元测试
 * 只测纯计算函数：anchorForBounds / boundsForShape 不触碰 electron 屏幕 API，
 * 可在 Electron-as-node 下运行（见 scripts/run-tests.cjs）。
 */
import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  anchorForBounds,
  attachDevToolsShortcut,
  boundsForShape,
  CAPSULE_WINDOW_HEIGHT,
  CAPSULE_WINDOW_WIDTH,
  normalizeShapeBounds,
  WIDGET_WINDOW_MAX_HEIGHT,
  WIDGET_WINDOW_MIN_HEIGHT,
  WIDGET_WINDOW_WIDTH
} from './windows'

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

describe('normalizeShapeBounds（窗口 2px 透明留白，用户 m06254）', () => {
  it('胶囊形态规范为 288×58 窗口尺寸', () => {
    const next = normalizeShapeBounds({ x: 100, y: 200, width: 352, height: 420 }, 'capsule')
    expect(next.width).toBe(CAPSULE_WINDOW_WIDTH)
    expect(next.height).toBe(CAPSULE_WINDOW_HEIGHT)
    expect(next.x).toBe(100)
    expect(next.y).toBe(200)
  })

  it('挂件形态宽度固定为 356，高度夹在窗口上下限内', () => {
    const normal = normalizeShapeBounds({ x: 0, y: 0, width: 100, height: 300 }, 'widget')
    expect(normal.width).toBe(WIDGET_WINDOW_WIDTH)
    expect(normal.height).toBe(300)

    const tooSmall = normalizeShapeBounds({ x: 0, y: 0, width: 100, height: 10 }, 'widget')
    expect(tooSmall.height).toBe(WIDGET_WINDOW_MIN_HEIGHT)

    const tooTall = normalizeShapeBounds({ x: 0, y: 0, width: 100, height: 9999 }, 'widget')
    expect(tooTall.height).toBe(WIDGET_WINDOW_MAX_HEIGHT)
  })

  it('窗口尺寸比可见卡片四周各多 2px', () => {
    expect(WIDGET_WINDOW_WIDTH - 352).toBe(4)
    expect(CAPSULE_WINDOW_WIDTH - 284).toBe(4)
    expect(CAPSULE_WINDOW_HEIGHT - 54).toBe(4)
  })
})

describe('attachDevToolsShortcut', () => {
  it('F12 第一次打开分离式 DevTools，再按一次关闭', () => {
    const { win, contents } = fakeWindow()
    attachDevToolsShortcut(win, true)

    const opened = pressKey(contents, 'F12')
    expect(opened.preventDefault).toHaveBeenCalled()
    expect(contents.openDevTools).toHaveBeenCalledWith({ mode: 'detach', activate: false })

    contents.isDevToolsOpened.mockReturnValue(true)
    pressKey(contents, 'F12')
    expect(contents.closeDevTools).toHaveBeenCalledTimes(1)
  })

  it('忽略 keyUp 与非 F12 按键', () => {
    const { win, contents } = fakeWindow()
    attachDevToolsShortcut(win, true)

    pressKey(contents, 'F12', 'keyUp')
    pressKey(contents, 'F11')

    expect(contents.openDevTools).not.toHaveBeenCalled()
    expect(contents.closeDevTools).not.toHaveBeenCalled()
  })

  it('打包版（enabled=false）不注册监听，F12 无行为', () => {
    const { win, contents } = fakeWindow()
    attachDevToolsShortcut(win, false)

    const event = pressKey(contents, 'F12')

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(contents.openDevTools).not.toHaveBeenCalled()
  })
})

/** 只用到 webContents 的 before-input-event 与 DevTools 开关接口 */
function fakeWindow(): {
  win: BrowserWindow
  contents: EventEmitter & {
    isDevToolsOpened: ReturnType<typeof vi.fn>
    openDevTools: ReturnType<typeof vi.fn>
    closeDevTools: ReturnType<typeof vi.fn>
  }
} {
  const contents = Object.assign(new EventEmitter(), {
    isDevToolsOpened: vi.fn(() => false),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn()
  })
  return { win: { webContents: contents } as unknown as BrowserWindow, contents }
}

function pressKey(
  contents: EventEmitter,
  key: string,
  type: 'keyDown' | 'keyUp' = 'keyDown'
): { preventDefault: ReturnType<typeof vi.fn> } {
  const event = { preventDefault: vi.fn() }
  contents.emit('before-input-event', event, { type, key })
  return event
}
