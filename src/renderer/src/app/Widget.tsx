/**
 * Widget · 桌面挂件（352 宽，高度自适应 max 520）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §2.1/§2.2 · docs/01-PRD.md FR-1 · design/app-desktop.png
 * 固定「今天」视图：勾选、点链接、双击标题展开完整窗口、图钉切换置顶、收起为胶囊。
 * 窗口透明由主进程负责，挂件卡片自身圆角/阴影铺满视口；高度由 ResizeObserver 上报。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'
import type { FilterDTO, LinkDTO, SavedViewDTO, TaskDTO } from '../../../shared/types'
import { Icon } from '../components/Icons'
import { ProgressRing } from '../components/ProgressRing'
import { TaskRow } from '../components/TaskRow'
import { Composer, type ComposerSubmit } from '../components/Composer'
import { EditorModal } from '../components/EditorModal'
import { ViewMenu } from '../components/ViewMenu'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useSettings, useTags, useTasks, useTimeUsage, useViews } from '../hooks'
import { useNow } from '../hooks'
import { applyFilter, groupTasks, progressOf, scopeTasks, sortDone, sortPending } from '../lib/scope'
import { monthDay, weekday } from '../lib/date'
import { emptyFilter } from '../lib/filters'
import { zh } from '../i18n/zh'
import { isLinkUnavailable } from '../lib/links'

const ALL_FILTER: FilterDTO = {
  status: 'all',
  date: { mode: 'any' },
  tagIds: [],
  priorities: [],
  keyword: ''
}

/** docs/08 §2.1：挂件最大高度 520px（主进程会再按工作区夹一次） */
const WIDGET_MAX_HEIGHT = 520

export function Widget(): ReactElement {
  const { showToast } = useToast()
  const now = useNow()
  const { tasks, refresh: refreshTasks } = useTasks(ALL_FILTER)
  const { projects, tags, refresh: refreshTags } = useTags()
  const { settings, setSetting } = useSettings()
  const { views, save: saveView, remove: removeView } = useViews()
  const timeUsage = useTimeUsage()

  const [filter, setFilter] = useState<FilterDTO>(emptyFilter())
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [editor, setEditor] = useState<TaskDTO | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lastHeight = useRef(0)

  const scope = useMemo(() => scopeTasks(tasks, { type: 'today' }, now), [tasks, now])
  const filtered = useMemo(() => applyFilter(scope, filter, now), [scope, filter, now])
  const pending = useMemo(() => sortPending(filtered.filter((task) => task.status === 0), now), [filtered, now])
  const done = useMemo(() => sortDone(filtered.filter((task) => task.status === 1)), [filtered])
  const progress = useMemo(() => progressOf(scope), [scope])
  const overdue = useMemo(
    () => pending.filter((task) => task.dueAt !== null && task.dueAt < now).length,
    [pending, now]
  )
  const pin = settings.alwaysOnTop !== false

  // 高度上报：窗口高度跟随内容（主进程夹在 96..520）
  // 浮层（日期/标签/优先级/链接 Popover、日期选择器）portal 到 body，
  // 在小窗口里会被裁切；打开期间把窗口临时加高到 520 并保持底边不动（anchor=bottom），
  // 关闭后再以 bottom 收回到内容高度，视觉上输入区不移动。
  useEffect(() => {
    const element = rootRef.current
    if (!element) return
    let frame = 0
    let lastAnchor: 'top' | 'bottom' = 'top'
    const overlayOpen = { current: false }
    const overlayWasOpen = { current: false }
    const naturalRef = { current: 0 }
    // 窗口高度会反过来限制 .widget 自身（height:100%），所以按各区块自然高度求和：
    // 拖拽区 + 头部固定高度 + 列表子项自然高度之和 + 输入区 + footer。
    // 注意不能用 .w-body.scrollHeight：它在 flex 拉伸后等于视口高度，会和窗口高度互相锁死。
    const report = (): void => {
      const part = (selector: string): number => {
        const node = element.querySelector<HTMLElement>(selector)
        if (!node) return 0
        return node.getBoundingClientRect().height
      }
      const body = element.querySelector<HTMLElement>('.w-body')
      let bodyHeight = 0
      if (body) {
        const style = window.getComputedStyle(body)
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        const gap = parseFloat(style.rowGap) || 0
        const children = Array.from(body.children) as HTMLElement[]
        bodyHeight =
          children.reduce((sum, node) => sum + node.getBoundingClientRect().height, 0) +
          gap * Math.max(0, children.length - 1) +
          padding
      }
      // +1px 安全余量：子项高度可能是小数，整除后 1px 溢出会误触发滚动条
      const natural = Math.ceil(
        part('.w-drag') + part('.w-head') + bodyHeight + part('.w-add') + part('.w-foot')
      ) + 1
      const expanded = overlayOpen.current
      // 加高后的窗口会让 .w-body 拉伸，此时再量会得到「被撑开的」高度，
      // 因此只在未展开时记录内容自然高度，收起时用它恢复。
      if (!expanded && natural > 0) naturalRef.current = natural
      const base = naturalRef.current || natural
      const height = expanded ? Math.max(base, WIDGET_MAX_HEIGHT) : base
      const anchor: 'top' | 'bottom' = expanded || overlayWasOpen.current ? 'bottom' : 'top'
      overlayWasOpen.current = expanded
      if (height <= 0) return
      if (height === lastHeight.current && anchor === lastAnchor) return
      lastHeight.current = height
      lastAnchor = anchor
      void window.api.widget.setHeight({ height, anchor })
    }
    const schedule = (): void => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        report()
      })
    }
    const syncOverlay = (): void => {
      const next = document.body.querySelector('.pop, .dp-pop') !== null
      if (next === overlayOpen.current) return
      overlayOpen.current = next
      // 立即上报：浮层刚挂载/卸载时马上加高或收回，避免内容在旧高度里被裁一帧
      report()
    }
    report()
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    const overlayObserver = new MutationObserver(syncOverlay)
    overlayObserver.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      overlayObserver.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [tasks.length, pending.length, done.length, doneOpen])

  const collapse = useCallback(() => {
    void window.api.widget.setCollapsed({ collapsed: true })
  }, [])

  // Esc 收起为胶囊（docs/01 FR-1.9）
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || editor) return
      const target = event.target as HTMLElement | null
      if (target?.closest('.overlay')) return
      event.preventDefault()
      collapse()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapse, editor])

  const toggleTask = useCallback(
    async (task: TaskDTO) => {
      const nextDone = task.status === 0
      try {
        await window.api.tasks.toggle({ id: task.id, done: nextDone })
        refreshTasks()
        if (nextDone) {
          showToast(zh.toast.taskDone(task.title), {
            undo: () => void window.api.tasks.toggle({ id: task.id, done: false }).then(refreshTasks)
          })
        }
      } catch {
        showToast(zh.common.error)
      }
    },
    [refreshTasks, showToast]
  )

  const deleteTask = useCallback(
    async (task: TaskDTO) => {
      try {
        await window.api.tasks.delete({ id: task.id })
        refreshTasks()
        showToast(zh.toast.taskDeleted(task.title), {
          undo: () => {
            void (async () => {
              try {
                const recreated = await window.api.tasks.create({
                  title: task.title,
                  note: task.note || undefined,
                  priority: task.priority,
                  dueAt: task.dueAt,
                  tagIds: task.tagIds,
                  projectId: task.projectId ?? undefined,
                  links: task.links.map((link) => ({ target: link.target, display: link.display }))
                })
                if (task.status === 1) await window.api.tasks.toggle({ id: recreated.id, done: true })
                refreshTasks()
              } catch {
                showToast(zh.common.error)
              }
            })()
          }
        })
      } catch {
        showToast(zh.common.error)
      }
    },
    [refreshTasks, showToast]
  )

  const openLink = useCallback(
    async (link: LinkDTO) => {
      const result = await window.api.links.open({ id: link.id })
      if (!result.ok) showToast(isLinkUnavailable(result) ? zh.toast.linkMissing : zh.toast.openFailed)
    },
    [showToast]
  )

  const submitComposer = useCallback(
    async (draft: ComposerSubmit) => {
      try {
        await window.api.tasks.create({
          title: draft.title,
          priority: draft.priority,
          dueAt: draft.dueAt,
          projectId: draft.projectId ?? undefined,
          tagIds: draft.tagIds,
          links: draft.links
        })
        refreshTasks()
        refreshTags()
        if (draft.dueAt !== null) timeUsage.note(draft.dueAt)
      } catch (err) {
        showToast(err instanceof Error ? err.message : zh.common.error)
        throw err
      }
    },
    [refreshTasks, refreshTags, timeUsage, showToast]
  )

  const selectView = useCallback((view: SavedViewDTO) => {
    setFilter(view.filter)
    setActiveViewId(view.id)
  }, [])

  const saveCurrentView = useCallback(
    async (name: string) => {
      const saved = await saveView({ name, filter })
      setActiveViewId(saved.id)
      showToast(zh.toast.viewSaved(name))
    },
    [saveView, filter, showToast]
  )

  const renameView = useCallback(
    async (view: SavedViewDTO, name: string) => {
      await saveView({ id: view.id, name, filter: view.filter })
      showToast(zh.toast.viewRenamed)
    },
    [saveView, showToast]
  )

  const deleteView = useCallback(
    async (view: SavedViewDTO) => {
      await removeView(view.id)
      if (activeViewId === view.id) {
        setActiveViewId(null)
        setFilter(emptyFilter())
      }
      showToast(zh.toast.viewDeleted(view.name))
    },
    [removeView, activeViewId, showToast]
  )

  const togglePin = useCallback(() => {
    void setSetting('alwaysOnTop', !pin)
  }, [setSetting, pin])

  const onHeadDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button')) return
    void window.api.app.showManager()
  }, [])

  const onBodyDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('.task-row') || target.closest('button')) return
    setEditor(null)
    void window.api.app.showManager()
  }, [])

  const renderRow = (task: TaskDTO): ReactElement => (
    <TaskRow
      key={task.id}
      task={task}
      mode="widget"
      projects={projects}
      tags={tags}
      now={now}
      onToggle={() => void toggleTask(task)}
      onEdit={() => setEditor(task)}
      onOpenLink={(link) => void openLink(link)}
      onDelete={() => void deleteTask(task)}
    />
  )

  return (
    <div
      className={`widget${pin ? '' : ' unpinned'}`}
      ref={rootRef}
    >
      <div className="w-drag" title={zh.widget.dragHint} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="w-head" onDoubleClick={onHeadDoubleClick}>
        <div className="w-head-row">
          <div className="w-head-l">
            <div className="w-title-row">
              <div className="w-title">{zh.widget.title}</div>
              <ViewMenu
                views={views}
                activeViewId={activeViewId}
                currentFilter={filter}
                filterActive={false}
                onSelect={selectView}
                onSave={saveCurrentView}
                onRename={renameView}
                onDelete={deleteView}
                compact
              />
            </div>
            <div className="w-sub">
              {monthDay(now)} {weekday(now)}
              {overdue > 0 ? <span className="over"> · {overdue} 项逾期</span> : null}
            </div>
          </div>
          <div className="w-tools">
            <ProgressRing percent={progress.percent} size="sm" />
            <button
              type="button"
              className={`w-icon${pin ? ' on' : ''}`}
              data-act="toggle-pin"
              onClick={togglePin}
              title={pin ? zh.widget.pinOn : zh.widget.pinOff}
              aria-label={pin ? zh.widget.pinOn : zh.widget.pinOff}
            >
              <Icon name="pin" size={15} className="ic" />
            </button>
            <button
              type="button"
              className="w-icon"
              onClick={collapse}
              title={zh.widget.collapse}
              aria-label={zh.widget.collapse}
            >
              <Icon name="minus" size={15} className="ic" />
            </button>
          </div>
        </div>
      </div>

      <div className="w-body" onDoubleClick={onBodyDoubleClick}>
        {pending.length === 0 && done.length === 0 ? (
          <EmptyState variant="widget" title={zh.widget.emptyTitle} body={zh.widget.emptyBody} />
        ) : null}
        {pending.length === 0 && done.length === 0 ? null : (
          <div className="w-group">
            <span>{zh.groups.todo}</span>
            <span className="count">{pending.length}</span>
          </div>
        )}
        {pending.length ? pending.map(renderRow) : null}
        {done.length > 0 || doneOpen ? (
          <div className="w-group">
          <span>{zh.groups.done}</span>
          <span className="count">{done.length}</span>
            <button
              type="button"
              className={`chev${doneOpen ? '' : ' closed'}`}
              aria-label={doneOpen ? zh.aria.collapseGroup(zh.groups.done) : zh.aria.expandGroup(zh.groups.done)}
              onClick={() => setDoneOpen((value) => !value)}
            >
              <Icon name="chevron" size={11} />
            </button>
          </div>
        ) : null}
        {doneOpen ? (
          done.length ? (
            done.map(renderRow)
          ) : (
            <div className="w-empty">{zh.widget.doneEmpty}</div>
          )
        ) : null}
      </div>

      <div className="w-add">
        <Composer
          mode="widget"
          projects={projects}
          tags={tags}
          timeUsage={timeUsage.usage}
          onPickTime={(value) => timeUsage.note(value)}
          onSubmit={submitComposer}
          onTagsChanged={refreshTags}
        />
      </div>

      <div className="w-foot">
        <span>{zh.widget.doneSummary(progress.done, progress.total)}</span>
        <span className="hint">双击标题展开完整窗口</span>
      </div>

      {editor ? (
        <EditorModal
          task={editor}
          projects={projects}
          tags={tags}
          timeUsage={timeUsage.usage}
          onPickTime={(value) => timeUsage.note(value)}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            refreshTasks()
            refreshTags()
          }}
          onDeleted={() => {
            setEditor(null)
            refreshTasks()
          }}
          onTagsChanged={refreshTags}
        />
      ) : null}
    </div>
  )
}
