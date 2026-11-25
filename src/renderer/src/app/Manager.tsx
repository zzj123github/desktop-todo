/**
 * Manager · 完整窗口（1100×720，min 900×600）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §2.2/§2.3 · docs/01-PRD.md FR-2/FR-3/FR-4 · design/app-manager.png / app-inbox.png / app-filter.png
 * 左栏导航 + 主区标题/进度环/tabs/筛选行/分组列表/底部输入框。
 * 九视图与五维筛选在渲染层本地计算（lib/scope.ts）：任务全量一次拉取，任务变更由 tasks:changed 驱动刷新。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'
import type { AppInfo, FilterDTO, LinkDTO, SavedViewDTO, SettingsKey, TaskDTO } from '../../../shared/types'
import { Icon } from '../components/Icons'
import { IconButton } from '../components/IconButton'
import { ProgressRing } from '../components/ProgressRing'
import { TaskRow } from '../components/TaskRow'
import { Composer, type ComposerSubmit } from '../components/Composer'
import { EditorModal } from '../components/EditorModal'
import { EmptyState } from '../components/EmptyState'
import { ManageModal, type ManageScope } from '../components/ManageModal'
import { SettingsModal } from './SettingsModal'
import { HelpModal } from './HelpModal'
import { FilterBar } from './FilterBar'
import { ViewMenu } from '../components/ViewMenu'
import { WindowControls } from '../components/WindowControls'
import { useToast } from '../components/Toast'
import { useFilter, useNow, useSettings, useTags, useTasks, useTimeUsage, useViews } from '../hooks'
import {
  applyFilter,
  applyTab,
  groupTasks,
  navCounts,
  progressOf,
  scopeTasks,
  tabCounts,
  type Nav,
  type Tab
} from '../lib/scope'
import { atFuture, monthDay, weekday } from '../lib/date'
import { isFilterActive, removeChip } from '../lib/filters'
import { zh } from '../i18n/zh'
import { isLinkUnavailable } from '../lib/links'
import { isMacOS } from '../lib/platform'

const ALL_FILTER: FilterDTO = {
  status: 'all',
  date: { mode: 'any' },
  tagIds: [],
  priorities: [],
  keyword: ''
}

const NAV_ITEMS: ReadonlyArray<{ type: 'inbox' | 'today' | 'overdue' | 'upcoming' | 'done'; icon: 'inbox' | 'sun' | 'alert' | 'calendar' | 'check-circle'; label: string }> = [
  { type: 'inbox', icon: 'inbox', label: zh.nav.inbox },
  { type: 'today', icon: 'sun', label: zh.nav.today },
  { type: 'overdue', icon: 'alert', label: zh.nav.overdue },
  { type: 'upcoming', icon: 'calendar', label: zh.nav.upcoming },
  { type: 'done', icon: 'check-circle', label: zh.nav.done }
]

type SimpleNavType = 'inbox' | 'today' | 'overdue' | 'upcoming' | 'done'

function isSimpleNav(nav: Nav): nav is { type: SimpleNavType } {
  return typeof nav === 'object' && !('id' in nav)
}

export function Manager(): ReactElement {
  const { showToast } = useToast()
  const now = useNow()
  const { tasks, refresh: refreshTasks } = useTasks(ALL_FILTER)
  const { projects, tags, refresh: refreshTags } = useTags()
  const { views, save: saveView, remove: removeView } = useViews()
  const { settings, setSetting } = useSettings()
  const timeUsage = useTimeUsage()

  const { filter, setFilter, reset, counts, active, chips, toggleTag, togglePriority, setDate, setKeyword } = useFilter()
  const [tab, setTab] = useState<Tab>('all')
  const [nav, setNav] = useState<Nav>(() => {
    // 全局快捷键 Alt+1..5 首次打开窗口时通过 ?nav= 指定落地视图（避免导航事件早于渲染层挂载）
    const initial = new URLSearchParams(window.location.search).get('nav')
    const simple: SimpleNavType[] = ['inbox', 'today', 'overdue', 'upcoming', 'done']
    if (initial && (simple as string[]).includes(initial)) return { type: initial as SimpleNavType }
    return { type: 'today' }
  })
  const [pendingCollapsed, setPendingCollapsed] = useState(false)
  const [doneCollapsed, setDoneCollapsed] = useState(false)
  const [editor, setEditor] = useState<{ task: TaskDTO | null; initialDue?: number | null; initialTitle?: string } | null>(null)
  const [manageScope, setManageScope] = useState<ManageScope | null>(null)
  const [manageFromSettings, setManageFromSettings] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const restoredView = useRef(false)

  useEffect(() => {
    void window.api.app.getInfo().then(setAppInfo).catch(() => setAppInfo(null))
  }, [])

  // 恢复上次保存的桌面视图（FR-4.4：临时筛选不跨启动保留，但恢复上次视图）
  useEffect(() => {
    if (restoredView.current || !views.length) return
    restoredView.current = true
    const lastId = settings.lastViewId
    const view = typeof lastId === 'string' ? views.find((item) => item.id === lastId) : undefined
    if (view) {
      setNav({ type: 'saved', id: view.id, name: view.name, filter: view.filter })
      setFilter(view.filter)
    }
  }, [views, settings.lastViewId, setFilter])

  const scope = useMemo(() => scopeTasks(tasks, nav, now), [tasks, nav, now])
  const filtered = useMemo(() => applyFilter(scope, filter, now), [scope, filter, now])
  const tabbed = useMemo(() => applyTab(filtered, tab), [filtered, tab])
  const groups = useMemo(() => groupTasks(tabbed, now), [tabbed, now])
  const countsInScope = useMemo(() => tabCounts(scope), [scope])
  const progress = useMemo(() => progressOf(scope), [scope])
  const navNums = useMemo(() => navCounts(tasks, now), [tasks, now])
  const chipsList = useMemo(() => chips([...projects, ...tags]), [chips, projects, tags])
  const overdueInScope = useMemo(
    () => scope.filter((task) => task.status === 0 && task.dueAt !== null && task.dueAt < now).length,
    [scope, now]
  )

  const projectById = useMemo(() => new Map(projects.map((item) => [item.id, item])), [projects])
  const tagById = useMemo(() => new Map(tags.map((item) => [item.id, item])), [tags])

  const projectIdOfNav = nav.type === 'project' ? nav.id : null
  const tagIdOfNav = nav.type === 'tag' ? nav.id : null

  const heading = useMemo((): { title: string; sub: string; over: string } => {
    if (isSimpleNav(nav)) {
      if (nav.type === 'today') {
        return {
          title: zh.nav.today,
          sub: `${monthDay(now)} ${weekday(now)}`,
          over: overdueInScope > 0 ? `${overdueInScope} 项逾期` : ''
        }
      }
      if (nav.type === 'inbox') return { title: zh.nav.inbox, sub: zh.viewMeta.inbox(countsInScope.todo), over: '' }
      if (nav.type === 'overdue') return { title: zh.nav.overdue, sub: zh.viewMeta.overdue(countsInScope.todo), over: '' }
      if (nav.type === 'upcoming') return { title: zh.nav.upcoming, sub: zh.viewMeta.upcoming(countsInScope.todo), over: '' }
      return { title: zh.nav.done, sub: zh.viewMeta.done(countsInScope.done), over: '' }
    }
    if (nav.type === 'project') {
      const project = projectById.get(nav.id)
      return { title: project?.name ?? zh.common.project, sub: zh.viewMeta.project(countsInScope.todo), over: '' }
    }
    if (nav.type === 'tag') {
      const tag = tagById.get(nav.id)
      return { title: tag ? `#${tag.name}` : zh.common.tag, sub: zh.viewMeta.tag(countsInScope.todo), over: '' }
    }
    return { title: nav.name, sub: zh.viewMeta.saved(countsInScope.all), over: '' }
  }, [nav, now, countsInScope, overdueInScope, projectById, tagById])

  const initialDue = useMemo((): number | null | undefined => {
    if (nav.type === 'inbox') return null
    if (nav.type === 'upcoming') return atFuture(now, 1)
    return undefined
  }, [nav, now])

  const openNew = useCallback(() => {
    setEditor({ task: null, initialDue })
  }, [initialDue])

  const refreshAll = useCallback(() => {
    refreshTasks()
    refreshTags()
  }, [refreshTasks, refreshTags])

  const selectNav = useCallback(
    (next: Nav) => {
      setNav(next)
      setTab('all')
      if (next.type === 'saved') {
        setFilter(next.filter)
        void setSetting('lastViewId', next.id)
      }
    },
    [setFilter, setSetting]
  )

  const selectSimpleNav = useCallback(
    (type: SimpleNavType) => {
      setNav({ type })
      setTab('all')
      void setSetting('lastViewId', null)
    },
    [setSetting]
  )

  const openTask = useCallback((task: TaskDTO) => {
    setEditor({ task })
  }, [])

  const toggleTask = useCallback(
    async (task: TaskDTO) => {
      const done = task.status === 0
      try {
        await window.api.tasks.toggle({ id: task.id, done })
        refreshTasks()
        if (done) {
          showToast(zh.toast.taskDone(task.title), {
            undo: () => {
              void window.api.tasks.toggle({ id: task.id, done: false }).then(refreshTasks)
            }
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
        refreshAll()
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
                refreshAll()
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
    [refreshAll, showToast]
  )

  const openLink = useCallback(
    async (link: LinkDTO) => {
      const result = await window.api.links.open({ id: link.id })
      if (!result.ok) {
        showToast(isLinkUnavailable(result) ? zh.toast.linkMissing : zh.toast.openFailed)
      }
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
          projectId: draft.projectId ?? projectIdOfNav ?? undefined,
          tagIds: tagIdOfNav && !draft.tagIds.includes(tagIdOfNav) ? [...draft.tagIds, tagIdOfNav] : draft.tagIds,
          links: draft.links
        })
        refreshAll()
        if (draft.dueAt !== null) timeUsage.note(draft.dueAt)
      } catch (err) {
        showToast(err instanceof Error ? err.message : zh.common.error)
        throw err
      }
    },
    [refreshAll, projectIdOfNav, tagIdOfNav, timeUsage, showToast]
  )

  const saveCurrentView = useCallback(
    async (name: string) => {
      try {
        await saveView({ name, filter })
        showToast(zh.toast.viewSaved(name))
      } catch {
        showToast(zh.common.error)
      }
    },
    [saveView, filter, showToast]
  )

  const renameView = useCallback(
    async (view: SavedViewDTO, name: string) => {
      try {
        await saveView({ id: view.id, name, filter: view.filter })
        showToast(zh.toast.viewRenamed)
      } catch {
        showToast(zh.common.error)
      }
    },
    [saveView, showToast]
  )

  const deleteView = useCallback(
    async (view: SavedViewDTO) => {
      try {
        await removeView(view.id)
        showToast(zh.toast.viewDeleted(view.name))
        if (nav.type === 'saved' && nav.id === view.id) selectSimpleNav('today')
      } catch {
        showToast(zh.common.error)
      }
    },
    [removeView, showToast, nav, selectSimpleNav]
  )

  const openManage = useCallback((scope: ManageScope) => {
    setManageFromSettings(false)
    setManageScope(scope)
  }, [])

  const closeManage = useCallback(() => {
    setManageScope(null)
    if (manageFromSettings) {
      setManageFromSettings(false)
      setSettingsOpen(true)
    }
  }, [manageFromSettings])

  const handleSettingsOpenManage = useCallback(() => {
    setSettingsOpen(false)
    setManageFromSettings(true)
    setManageScope('all')
  }, [])

  const onBlankDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      if (target.closest('.task-row') || target.closest('button') || target.closest('.group-head')) return
      openNew()
    },
    [openNew]
  )

  // Ctrl+N / Ctrl+F / Esc（docs/01 FR-5.4、docs/04 无边框窗口）
  // Esc：先由弹窗/浮层/日期选择器自行消费；无浮层时收起完整窗口（window.close() 被主进程拦截为 hide）。
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        openNew()
      }
      if (event.key === 'Escape') {
        if (document.querySelector('.overlay, .dp-pop, .pop')) return
        const target = event.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
        event.preventDefault()
        window.close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openNew])

  // 外部（托盘 / 快捷键 / 挂件展开）导航请求
  useEffect(() => {
    return window.api.on.navigate((payload) => {
      const viewId = payload.viewId
      if (viewId === 'inbox' || viewId === 'today' || viewId === 'overdue' || viewId === 'upcoming' || viewId === 'done') {
        selectSimpleNav(viewId)
        return
      }
      const saved = views.find((view) => view.id === viewId)
      if (saved) {
        setNav({ type: 'saved', id: saved.id, name: saved.name, filter: saved.filter })
        setFilter(saved.filter)
      }
    })
  }, [selectSimpleNav, views, setFilter])

  const renderTaskRow = (task: TaskDTO): ReactElement => (
    <TaskRow
      key={task.id}
      task={task}
      mode="main"
      projects={projects}
      tags={tags}
      now={now}
      onToggle={() => void toggleTask(task)}
      onEdit={() => openTask(task)}
      onOpenLink={(link) => void openLink(link)}
      onDelete={() => void deleteTask(task)}
    />
  )

  const groupsHost = (): ReactElement => {
    const showPending = tab !== 'done' && groups.pending.length > 0
    const showDone = tab !== 'todo' && groups.done.length > 0
    if (!showPending && !showDone) {
      const filteredActive = isFilterActive(filter)
      if (tab === 'done') {
        return (
          <EmptyState variant="main" title={zh.manager.emptyDoneTitle} body={zh.manager.emptyDoneBody} />
        )
      }
      if (filteredActive) {
        return (
          <EmptyState
            variant="main"
            title={zh.manager.emptyFilteredTitle}
            body={zh.manager.emptyFilteredBody}
            action={
              <button type="button" className="btn-sm" onClick={reset}>
                {zh.filter.clearAll}
              </button>
            }
          />
        )
      }
      return <EmptyState variant="main" title={zh.manager.emptyTitle} body={zh.manager.emptyBody} />
    }
    return (
      <>
        {showPending ? (
          <>
            <div className="group-head">
              <button
                type="button"
                className={`chev${pendingCollapsed ? ' closed' : ''}`}
                aria-label={pendingCollapsed ? zh.aria.expandGroup(zh.groups.todo) : zh.aria.collapseGroup(zh.groups.todo)}
                onClick={() => setPendingCollapsed((value) => !value)}
              >
                <Icon name="chevron" size={12} />
              </button>
              <span>{zh.groups.todo}</span>
              <span className="g-count">{groups.pending.length}</span>
            </div>
            {!pendingCollapsed ? <div className="grow-list">{groups.pending.map(renderTaskRow)}</div> : null}
          </>
        ) : null}
        {showDone ? (
          <>
            <div className="group-head">
              <button
                type="button"
                className={`chev${doneCollapsed ? ' closed' : ''}`}
                aria-label={doneCollapsed ? zh.aria.expandGroup(zh.groups.done) : zh.aria.collapseGroup(zh.groups.done)}
                onClick={() => setDoneCollapsed((value) => !value)}
              >
                <Icon name="chevron" size={12} />
              </button>
              <span>{zh.groups.done}</span>
              <span className="g-count">{groups.done.length}</span>
            </div>
            {!doneCollapsed ? <div className="grow-list">{groups.done.map(renderTaskRow)}</div> : null}
          </>
        ) : null}
      </>
    )
  }

  return (
    <div className="manager-scene">
      <div className="mgr" data-platform={isMacOS() ? 'mac' : 'win'}>
        <div className="mgr-drag" aria-hidden="true" />
        <WindowControls />
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-icon" aria-hidden="true">
              <Icon name="check" size={15} />
            </span>
            <span className="brand-name">{zh.app.name}</span>
            <span className="brand-ver">{zh.app.version}</span>
          </div>
          <div className="sb-scroll">
            <nav className="nav" aria-label={zh.app.windowTitle}>
              {NAV_ITEMS.map((item) => {
                const activeNav = nav.type === item.type
                const count =
                  item.type === 'today'
                    ? navNums.today
                    : item.type === 'inbox'
                      ? navNums.inbox
                      : item.type === 'overdue'
                        ? navNums.overdue
                        : item.type === 'upcoming'
                          ? navNums.upcoming
                          : navNums.done
                return (
                  <button
                    key={item.type}
                    type="button"
                    className={`nav-item${activeNav ? ' active' : ''}${item.type === 'overdue' && count > 0 ? ' overdue' : ''}`}
                    aria-current={activeNav ? 'page' : undefined}
                    aria-label={zh.aria.navItem(item.label, count)}
                    onClick={() => selectSimpleNav(item.type)}
                  >
                    <Icon name={item.icon} size={15} className="ic" />
                    <span>{item.label}</span>
                    <span className="n-count">{count || ''}</span>
                  </button>
                )
              })}
            </nav>

            <div className="nav-sec">
              <span>{zh.nav.projects}</span>
              <button
                type="button"
                className="nav-sec-mgr"
                title={zh.nav.manageProjects}
                aria-label={zh.aria.manageEntry(zh.common.project)}
                onClick={() => openManage('project')}
              >
                <Icon name="pencil" size={12} />
              </button>
            </div>
            <div className="nav">
              {projects.map((project) => {
                const on = nav.type === 'project' && nav.id === project.id
                return (
                  <div className="nav-row" key={project.id}>
                    <button
                      type="button"
                      className={`nav-item${on ? ' active' : ''}`}
                      aria-current={on ? 'page' : undefined}
                      onClick={() => selectNav({ type: 'project', id: project.id })}
                    >
                      <span className="proj-dot" style={{ '--dot': project.color } as React.CSSProperties} aria-hidden="true" />
                      <span className="nav-tx">{project.name}</span>
                      <span className="n-count">{navNums.projects[project.id] || ''}</span>
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="nav-sec">
              <span>{zh.nav.tags}</span>
              <button
                type="button"
                className="nav-sec-mgr"
                title={zh.nav.manageTags}
                aria-label={zh.aria.manageEntry(zh.common.tag)}
                onClick={() => openManage('tag')}
              >
                <Icon name="pencil" size={12} />
              </button>
            </div>
            <div className="nav">
              {tags.map((tag) => {
                const on = nav.type === 'tag' && nav.id === tag.id
                return (
                  <div className="nav-row" key={tag.id}>
                    <button
                      type="button"
                      className={`nav-item${on ? ' active' : ''}`}
                      aria-current={on ? 'page' : undefined}
                      onClick={() => selectNav({ type: 'tag', id: tag.id })}
                    >
                      <span className="tag-ic" aria-hidden="true">
                        <Icon name="tag" size={13} />
                      </span>
                      <span className="nav-tx">{tag.name}</span>
                      <span className="n-count">{navNums.tags[tag.id] || ''}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="sb-foot">
            <button type="button" className="sb-settings" onClick={() => setHelpOpen(true)}>
              <Icon name="help" size={14} className="ic" />
              {zh.nav.help}
            </button>
            <button type="button" className="sb-settings" onClick={() => setSettingsOpen(true)}>
              <Icon name="settings" size={14} className="ic" />
              {zh.nav.settings}
            </button>
          </div>
        </aside>

        <section className="main">
          <div className="mhead">
            <div className="mhead-l">
              <div className="mhead-title-row">
                <h1 className="mtitle">{heading.title}</h1>
                <ViewMenu
                  views={views}
                  activeViewId={nav.type === 'saved' ? nav.id : null}
                  currentFilter={filter}
                  filterActive={active}
                  onSelect={(view) => selectNav({ type: 'saved', id: view.id, name: view.name, filter: view.filter })}
                  onSave={saveCurrentView}
                  onRename={renameView}
                  onDelete={deleteView}
                  compact
                />
              </div>
              <div className="msub">
                <span>{heading.sub}</span>
                {heading.over ? (
                  <>
                    <span className="sep">·</span>
                    <span className="over">{heading.over}</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="mhead-r">
              <ProgressRing percent={progress.percent} size="md" />
              <span className="mhead-shapes">
                <IconButton
                  icon="grid"
                  label={zh.manager.collapseToWidget}
                  onClick={() => void window.api.app.showWidget({ collapsed: false })}
                />
                <IconButton
                  icon="minus"
                  label={zh.manager.collapseToCapsule}
                  onClick={() => void window.api.app.showWidget({ collapsed: true })}
                />
              </span>
              <button type="button" className="btn-pri" onClick={openNew}>
                <Icon name="plus" size={14} />
                {zh.manager.newTask}
              </button>
            </div>
          </div>

          <div className="tabs" role="tablist">
            {(['all', 'todo', 'done'] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`tab${tab === key ? ' on' : ''}`}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {key === 'all' ? zh.tabs.all : key === 'todo' ? zh.tabs.todo : zh.tabs.done}
                <span className="count">
                  {key === 'all' ? countsInScope.all : key === 'todo' ? countsInScope.todo : countsInScope.done}
                </span>
              </button>
            ))}
          </div>

          <div>
            <FilterBar
              filter={filter}
              now={now}
              projects={projects}
              tags={tags}
              counts={counts}
              active={active}
              chips={chipsList}
              onSetFilter={setFilter}
              onReset={reset}
              onToggleTag={toggleTag}
              onTogglePriority={togglePriority}
              onSetDate={setDate}
              onSetKeyword={setKeyword}
              onRemoveChip={(key: string) => setFilter(removeChip(filter, key))}
              onTimeUsage={timeUsage.note}
              timeUsage={timeUsage.usage}
            />
          </div>

          <div className="groups" onDoubleClick={onBlankDoubleClick}>
            {groupsHost()}
          </div>

          <Composer
            mode="main"
            projects={projects}
            tags={tags}
            fallbackDue={initialDue}
            timeUsage={timeUsage.usage}
            onPickTime={(value) => timeUsage.note(value)}
            onSubmit={submitComposer}
            onTagsChanged={refreshTags}
            placeholder={zh.composer.placeholder}
          />

          <div className="mfoot">
            <span>{zh.widget.doneSummary(progress.done, progress.total)}</span>
            <span className="hint">{zh.manager.doubleClickTip} · 拖入文件自动挂链接</span>
          </div>
        </section>
      </div>

      {editor ? (
        <EditorModal
          task={editor.task}
          projects={projects}
          tags={tags}
          initialDue={editor.initialDue}
          initialTitle={editor.initialTitle}
          timeUsage={timeUsage.usage}
          onPickTime={(value) => timeUsage.note(value)}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            refreshAll()
          }}
          onDeleted={() => {
            setEditor(null)
            refreshAll()
          }}
          onTagsChanged={refreshTags}
        />
      ) : null}

      {manageScope ? (
        <ManageModal
          scope={manageScope}
          projects={projects}
          tags={tags}
          onClose={closeManage}
          onChanged={refreshAll}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsModal
          settings={settings}
          appInfo={appInfo}
          onSet={(key: SettingsKey, value: unknown) => void setSetting(key, value)}
          onOpenManage={handleSettingsOpenManage}
          onClose={() => setSettingsOpen(false)}
          onDataChanged={refreshAll}
        />
      ) : null}

      {helpOpen ? <HelpModal onClose={() => setHelpOpen(false)} /> : null}
    </div>
  )
}
