/**
 * Capsule · 桌面胶囊（284×54，圆角 999）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §2.4 · docs/01-PRD.md FR-1.7 · design/app-capsule.png
 *
 * 交互（与原型一致）：
 * - 单击任意位置 → 展开为挂件；
 * - 按住拖动 ≥4px → 移动胶囊位置（renderer pointer + main setBounds，不用
 *   -webkit-app-region，否则拖动区会吞掉单击事件）；
 * - 拖动结束后位置写回 settings.capsuleBounds。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from 'react'
import type { FilterDTO } from '../../../shared/types'
import { Icon } from '../components/Icons'
import { ProgressRing } from '../components/ProgressRing'
import { useTasks, useNow } from '../hooks'
import { pendingTime, progressOf, scopeTasks, sortPending } from '../lib/scope'
import { zh } from '../i18n/zh'

const ALL_FILTER: FilterDTO = {
  status: 'all',
  date: { mode: 'any' },
  tagIds: [],
  priorities: [],
  keyword: ''
}

/** 拖动判定阈值（docs/?? 原型：移动 ≥4px 才算拖动，否则视为单击） */
const DRAG_THRESHOLD = 4

interface DragState {
  startX: number
  startY: number
  started: boolean
}

export function Capsule(): ReactElement {
  const now = useNow()
  const { tasks } = useTasks(ALL_FILTER)
  const dragRef = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState(false)

  const scope = useMemo(() => scopeTasks(tasks, { type: 'today' }, now), [tasks, now])
  const pending = useMemo(() => sortPending(scope.filter((task) => task.status === 0), now), [scope, now])
  const progress = useMemo(() => progressOf(scope), [scope])
  const overdue = useMemo(
    () => pending.filter((task) => task.dueAt !== null && task.dueAt < now).length,
    [pending, now]
  )
  const next = pending[0] ?? null

  const sub = useMemo((): string => {
    if (next) {
      const time = pendingTime(next)
      return zh.widget.capsuleSub(next.title, time)
    }
    if (scope.length > 0 && pending.length === 0) return zh.widget.capsuleDone
    return zh.widget.capsuleNoTask
  }, [next, scope.length, pending.length])

  const expand = useCallback(() => {
    void window.api.widget.setCollapsed({ collapsed: false })
  }, [])

  // 卸载（切换形态）时若仍在拖动，结束拖动并落盘，避免位置丢失
  useEffect(() => {
    return () => {
      if (dragRef.current?.started) void window.api.widget.endDrag()
      dragRef.current = null
    }
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    dragRef.current = { startX: event.screenX, startY: event.screenY, started: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.screenX - drag.startX
    const dy = event.screenY - drag.startY
    if (!drag.started) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      drag.started = true
      setDragging(true)
      void window.api.widget.beginDrag()
    }
    void window.api.widget.dragMove({ dx, dy })
  }, [])

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag.started) {
      setDragging(false)
      void window.api.widget.endDrag()
      return
    }
    // 位移小于阈值 → 单击：展开挂件
    expand()
  }, [expand])

  const onPointerCancel = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag?.started) {
      setDragging(false)
      void window.api.widget.endDrag()
    }
  }, [])

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        expand()
      }
    },
    [expand]
  )

  return (
    <div className="cap-wrap">
      <div
        className={`capsule${dragging ? ' dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={zh.widget.expand}
        title={zh.widget.expand}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
      >
        <span className="cap-check" aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
        <div className="cap-main">
          <div className="cap-title">
            {zh.widget.title} {pending.length} 项
            {overdue > 0 ? (
              <>
                {' · '}
                <span className="over">{overdue} 项逾期</span>
              </>
            ) : null}
          </div>
          <div className="cap-sub">{sub}</div>
        </div>
        <div className="cap-ring">
          <ProgressRing percent={progress.percent} size="xs" />
        </div>
      </div>
    </div>
  )
}
