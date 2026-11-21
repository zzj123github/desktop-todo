/**
 * Capsule · 桌面胶囊（284×54，圆角 999）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §2.4 · docs/01-PRD.md FR-1.7 · design/app-capsule.png
 * 收起后替代挂件；显示今天待办数/逾期/最近一项，点击左侧陶土圆展开挂件。
 */
import { useCallback, useMemo, type ReactElement } from 'react'
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

export function Capsule(): ReactElement {
  const now = useNow()
  const { tasks } = useTasks(ALL_FILTER)

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

  return (
    <div className="cap-wrap">
      <div className="capsule" role="group" aria-label={zh.widget.title}>
        <button
          type="button"
          className="cap-check"
          onClick={expand}
          title={zh.widget.expand}
          aria-label={zh.widget.expand}
        >
          <Icon name="check" size={16} />
        </button>
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
