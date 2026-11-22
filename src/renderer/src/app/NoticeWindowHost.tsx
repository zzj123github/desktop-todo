/**
 * NoticeWindowHost · 应用内提示窗口
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.8 · docs/01-PRD.md FR-5
 *
 * 独立透明窗口（472 宽）里的提示宿主：接收主进程 `app:notice` 事件，
 * 用项目自建 NoticeModal 展示；用户确认后调 `notice.acknowledge()`，
 * 主进程负责显示下一条或关闭窗口。高度测量后上报（notice:ready）以便窗口居中。
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { AppNotice } from '../../../shared/types'
import { NoticeModal } from '../components/NoticeModal'

export function NoticeWindowHost(): ReactElement | null {
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return window.api.on.notice((next) => setNotice(next))
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const report = (): void => {
      const height = Math.ceil(host.getBoundingClientRect().height)
      if (height > 0) void window.api.notice.ready({ height })
    }
    const observer = new ResizeObserver(report)
    observer.observe(host)
    report()
    return () => observer.disconnect()
  }, [notice])

  if (!notice) return null

  const acknowledge = (): void => {
    void window.api.notice.acknowledge()
    setNotice(null)
  }

  return (
    <div className="notice-window-host" ref={hostRef}>
      <NoticeModal embedded notice={notice} onClose={acknowledge} />
    </div>
  )
}
