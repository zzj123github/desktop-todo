/**
 * notices 单测：应用内提示队列
 *
 * 覆盖：首条立即投递、确认后推进下一条、全部确认后关闭提示窗口、
 * 窗口加载中重试、2.5s 无法投递降级原生兜底。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acknowledgeNotice,
  getCurrentNotice,
  getPendingNoticeCount,
  initNotices,
  postNotice,
  resetNotices,
  type NoticeFallback,
  type NoticePresenter
} from './notices'
import type { AppNotice } from '../shared/types'

interface Harness {
  presenter: NoticePresenter
  sent: AppNotice[]
  fallbacks: NoticeFallback[]
  opened: number
  closed: number
  setLoaded: (loaded: boolean) => void
}

function createHarness(): Harness {
  let loaded = true
  const harness: Harness = {
    sent: [],
    fallbacks: [],
    opened: 0,
    closed: 0,
    setLoaded: (next) => {
      loaded = next
    },
    presenter: {
      openWindow: () => {
        harness.opened += 1
      },
      closeWindow: () => {
        harness.closed += 1
      },
      isLoaded: () => loaded,
      send: (notice) => {
        harness.sent.push(notice)
        return true
      },
      showFallback: (options) => {
        harness.fallbacks.push(options)
      }
    }
  }
  return harness
}

const notice = (title = '部分全局快捷键注册失败'): Omit<AppNotice, 'id'> => ({
  kind: 'warning',
  title,
  message: '以下快捷键可能被其他程序占用：',
  items: [
    { label: 'Alt+H', detail: '显示/隐藏挂件' },
    { label: 'Alt+2', detail: '打开今天' }
  ],
  hint: '可在设置中关闭全局快捷键。',
  acknowledgeLabel: '知道了'
})

beforeEach(() => {
  resetNotices()
})

afterEach(() => {
  resetNotices()
  vi.useRealTimers()
})

describe('postNotice', () => {
  it('打开提示窗口并投递第一条（带 id 与完整结构）', () => {
    const harness = createHarness()
    initNotices(harness.presenter)

    postNotice(notice())

    expect(harness.opened).toBe(1)
    expect(harness.sent).toHaveLength(1)
    expect(harness.sent[0].id).toMatch(/^notice-/)
    expect(harness.sent[0].kind).toBe('warning')
    expect(harness.sent[0].items?.map((item) => item.label)).toEqual(['Alt+H', 'Alt+2'])
    expect(getCurrentNotice()).not.toBeNull()
    expect(getPendingNoticeCount()).toBe(1)
  })

  it('多条提示排队，确认后逐条投递', () => {
    const harness = createHarness()
    initNotices(harness.presenter)

    postNotice(notice('第一条'))
    postNotice(notice('第二条'))

    expect(harness.sent.map((item) => item.title)).toEqual(['第一条'])
    expect(getPendingNoticeCount()).toBe(2)

    acknowledgeNotice()

    expect(harness.sent.map((item) => item.title)).toEqual(['第一条', '第二条'])
    expect(getPendingNoticeCount()).toBe(1)

    acknowledgeNotice()

    expect(getPendingNoticeCount()).toBe(0)
    expect(harness.closed).toBe(1)
  })

  it('窗口加载中时重试，加载完成后投递', () => {
    vi.useFakeTimers()
    const harness = createHarness()
    harness.setLoaded(false)
    initNotices(harness.presenter)

    postNotice(notice())
    expect(harness.sent).toHaveLength(0)

    vi.advanceTimersByTime(240)
    expect(harness.sent).toHaveLength(0)
    expect(harness.opened).toBeGreaterThan(1)

    harness.setLoaded(true)
    vi.advanceTimersByTime(240)

    expect(harness.sent).toHaveLength(1)
    expect(harness.fallbacks).toHaveLength(0)
  })
})

describe('原生兜底', () => {
  it('2.5s 内始终无法投递时调用 showFallback 并关闭提示窗口', () => {
    vi.useFakeTimers()
    const harness = createHarness()
    harness.setLoaded(false)
    initNotices(harness.presenter)

    postNotice(notice())

    vi.advanceTimersByTime(2600)

    expect(harness.fallbacks).toHaveLength(1)
    expect(harness.fallbacks[0]).toMatchObject({
      type: 'warning',
      title: '部分全局快捷键注册失败',
      message: '以下快捷键可能被其他程序占用：'
    })
    expect(getPendingNoticeCount()).toBe(0)
    expect(harness.closed).toBe(1)
  })
})
