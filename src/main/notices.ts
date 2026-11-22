/**
 * 应用内提示 · 主进程展示队列
 *
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.8（Modal）· docs/01-PRD.md FR-5
 *
 * 启动阶段的系统提示（全局快捷键注册失败、数据文件异常）不再使用原生 dialog，
 * 而是显示在一个独立的透明提示窗口里（472 宽，内容由渲染层 NoticeModal 自绘），
 * 与应用内视觉一致，也给项目沉淀「应用内 dialog」这一基础能力。
 *
 * 队列规则：
 * - 提示逐条展示，用户确认（知道了 / Esc / X）后显示下一条，全部确认后关闭提示窗口；
 * - 提示窗口迟迟无法加载（渲染进程异常）时，2.5s 后降级为原生 dialog，避免用户完全无感；
 * - 本模块不 import electron，窗口与原生兜底由主进程入口注入，便于单测。
 */
import type { AppNotice } from '../shared/types'

/** 无法投递时降级的原生对话框参数 */
export interface NoticeFallback {
  type: 'info' | 'warning' | 'error'
  title: string
  message: string
  detail?: string
}

/** 主进程入口注入的副作用（创建/关闭提示窗口、投递事件、原生兜底） */
export interface NoticePresenter {
  openWindow: () => void
  closeWindow: () => void
  isLoaded: () => boolean
  send: (notice: AppNotice) => boolean
  showFallback: (options: NoticeFallback) => void
}

/** 窗口加载重试间隔与降级等待 */
const RETRY_INTERVAL_MS = 120
const FALLBACK_DELAY_MS = 2500

let presenter: NoticePresenter | null = null
const queue: AppNotice[] = []
let displayed: AppNotice | null = null
let retryTimer: NodeJS.Timeout | null = null
let retryDeadline = 0
let sequence = 0

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  retryDeadline = 0
}

function fallbackCurrent(): void {
  const notice = displayed
  displayed = null
  clearRetry()
  if (!notice || !presenter) return
  try {
    presenter.showFallback({
      type: notice.kind,
      title: notice.title,
      message: notice.message ?? notice.title,
      detail: notice.hint
    })
  } catch (error) {
    console.warn('[notices] 原生兜底提示失败：', error instanceof Error ? error.message : error)
  }
  pump()
}

function retryDelivery(): void {
  const notice = displayed
  if (!presenter || !notice) return
  if (!retryDeadline) retryDeadline = Date.now() + FALLBACK_DELAY_MS
  presenter.openWindow()
  if (presenter.isLoaded() && presenter.send(notice)) {
    clearRetry()
    // 渲染层已接收并展示；等待用户确认（acknowledgeNotice）后推进队列
    return
  }
  if (Date.now() >= retryDeadline) {
    fallbackCurrent()
    return
  }
  retryTimer = setTimeout(retryDelivery, RETRY_INTERVAL_MS)
  retryTimer.unref?.()
}

/** 显示下一条（没有则关闭提示窗口） */
function pump(): void {
  if (displayed) return
  const next = queue.shift()
  if (!next) {
    presenter?.closeWindow()
    return
  }
  displayed = next
  retryDelivery()
}

/** 主进程启动时注入窗口与兜底实现 */
export function initNotices(next: NoticePresenter): void {
  presenter = next
  if (displayed || queue.length > 0) pump()
}

/** 投递一条应用内提示，返回提示 id（日志/测试用） */
export function postNotice(notice: Omit<AppNotice, 'id'>): string {
  const id = `notice-${Date.now()}-${sequence++}`
  queue.push({ ...notice, id })
  pump()
  return id
}

/** 用户确认当前提示：显示下一条，或关闭提示窗口 */
export function acknowledgeNotice(): void {
  displayed = null
  clearRetry()
  pump()
}

/** 提示窗口关闭（用户强关/窗口异常）时丢弃当前提示并继续队列 */
export function handleNoticeWindowClosed(): void {
  displayed = null
  clearRetry()
  if (queue.length > 0) pump()
}

/** 测试/诊断用 */
export function getPendingNoticeCount(): number {
  return queue.length + (displayed ? 1 : 0)
}

export function getCurrentNotice(): AppNotice | null {
  return displayed
}

/** 测试用：清空队列、定时器与注入的实现 */
export function resetNotices(): void {
  presenter = null
  queue.length = 0
  displayed = null
  clearRetry()
  sequence = 0
}
