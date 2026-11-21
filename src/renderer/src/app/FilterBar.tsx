/**
 * FilterBar · 完整窗口筛选行（标签/项目、日期、优先级 + 已选 chips + 关键词搜索）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §2.3 · docs/02-DESIGN-SPEC.md §3
 * 行为基准：design/app/js/render.js 的 R.filterbar 与 interactions.js 的 filterPopHtml。
 *
 * 组件只负责呈现与派发动作，筛选状态由使用方（useFilter）持有；
 * 计数与 chips 由调用方传入（lib/filters 的 filterCounts / activeFilterChips 结果）。
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { FilterDTO, FilterDateMode, TagDTO, TaskPriority } from '../../../shared/types'
import type { TimeUsageMap } from '../lib/date'
import type { ActiveChip, FilterCounts } from '../lib/filters'
import { Button } from '../components/Button'
import { DateTimePicker } from '../components/DateTimePicker'
import { Icon } from '../components/Icons'
import { Popover } from '../components/Popover'
import { zh } from '../i18n/zh'
import { dateKey, dayStart } from '../lib/date'

type PopKind = 'scopes' | 'date' | 'priority'

export interface FilterBarProps {
  filter: FilterDTO
  /** 当前时间（useNow()），用于 custom 日期键换算 */
  now: number
  projects: TagDTO[]
  tags: TagDTO[]
  /** 各维度生效数量（useFilter().counts） */
  counts: FilterCounts
  /** 是否有任何生效条件（useFilter().active） */
  active: boolean
  /** 已选条件 chips（useFilter().chips(tags) 结果） */
  chips: ActiveChip[]
  onSetFilter: (next: FilterDTO) => void
  onReset: () => void
  onToggleTag: (tagId: string) => void
  onTogglePriority: (priority: TaskPriority) => void
  onSetDate: (mode: FilterDateMode, range?: { from?: string; to?: string }) => void
  onSetKeyword: (keyword: string) => void
  onRemoveChip: (key: string) => void
  onTimeUsage: (hhmm: string) => void
  timeUsage: TimeUsageMap
}

interface DateRow {
  mode: Exclude<FilterDateMode, 'any' | 'custom'>
  label: string
}

const DATE_ROWS: DateRow[] = [
  { mode: 'today', label: zh.filter.today },
  { mode: 'tomorrow', label: zh.filter.tomorrow },
  { mode: 'week', label: zh.filter.week },
  { mode: 'overdue', label: zh.filter.overdue }
]

interface PriorityRow {
  priority: TaskPriority
  label: string
  className: string
}

const PRIORITY_ROWS: PriorityRow[] = [
  { priority: 3, label: zh.priority.high, className: 'high' },
  { priority: 2, label: zh.priority.medium, className: 'med' },
  { priority: 1, label: zh.priority.low, className: 'low' }
]

/** 把 custom 筛选里的本地日期键（YYYY-MM-DD）还原成当天 00:00 的时间戳 */
function parseDateKey(key: string | undefined): number | null {
  if (!key) return null
  const parsed = new Date(`${key}T00:00:00`).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

export function FilterBar({
  filter,
  now,
  projects,
  tags,
  counts,
  active,
  chips,
  onSetFilter,
  onReset,
  onToggleTag,
  onTogglePriority,
  onSetDate,
  onSetKeyword,
  onRemoveChip,
  onTimeUsage,
  timeUsage
}: FilterBarProps): ReactElement {
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const keepSearchOpen = filter.keyword.length > 0

  // Ctrl+F 打开搜索并聚焦；Esc 关闭（关键词为空时）
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
  }, [searchOpen])

  const [openPop, setOpenPop] = useState<PopKind | null>(null)
  const scopesRef = useRef<HTMLButtonElement>(null)
  const dateRef = useRef<HTMLButtonElement>(null)
  const priorityRef = useRef<HTMLButtonElement>(null)

  const customValue =
    filter.date.mode === 'custom' ? (parseDateKey(filter.date.from) ?? dayStart(now)) : null

  const togglePop = (kind: PopKind): void => {
    setOpenPop((prev) => (prev === kind ? null : kind))
  }

  const closePop = useCallback((kind: PopKind): void => {
    /* 日期浮层里内嵌 DateTimePicker，它的日历弹层（.dp-pop）挂到 body，
       外部点击会先命中本浮层；该弹层存在时交给选择器自己处理，避免一起被卸载。 */
    if (kind === 'date' && typeof document !== 'undefined' && document.querySelector('.dp-pop')) return
    setOpenPop(null)
  }, [])

  const resetScopes = (): void => onSetFilter({ ...filter, tagIds: [] })

  const clickDateMode = (mode: DateRow['mode']): void => {
    onSetDate(filter.date.mode === mode ? 'any' : mode)
  }

  const resetDate = (): void => onSetDate('any')

  const pickCustomDate = (value: number | null): void => {
    if (value === null) {
      onSetDate('any')
      return
    }
    const key = dateKey(value)
    onSetDate('custom', { from: key, to: key })
  }

  const clearPriorities = (): void => onSetFilter({ ...filter, priorities: [] })

  const renderScopeRow = (tag: TagDTO): ReactElement => {
    const selected = filter.tagIds.includes(tag.id)
    const isProject = tag.kind === 'project'
    return (
      <button
        key={tag.id}
        type="button"
        className={`pop-row${selected ? ' on' : ''}`}
        onClick={() => onToggleTag(tag.id)}
      >
        <span className="chk">
          <Icon name="check" />
        </span>
        {isProject ? (
          <span
            style={{ width: 7, height: 7, borderRadius: '50%', background: tag.color, flex: 'none' }}
          />
        ) : (
          <Icon name="tag" size={12} />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tag.name}
        </span>
        {typeof tag.pendingCount === 'number' && tag.pendingCount > 0 ? (
          <span className="r-count">{tag.pendingCount}</span>
        ) : null}
      </button>
    )
  }

  return (
    <>
      <div className="filterbar">
        <button
          ref={scopesRef}
          type="button"
          className={`fbtn${openPop === 'scopes' ? ' open' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={openPop === 'scopes'}
          onClick={() => togglePop('scopes')}
        >
          <Icon name="tag" className="ic" />
          {zh.filter.tags}
          {counts.tags > 0 ? <span className="fcount">{counts.tags}</span> : null}
          <Icon name="chevron" className="ic" size={12} />
        </button>

        <button
          ref={dateRef}
          type="button"
          className={`fbtn${openPop === 'date' ? ' open' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={openPop === 'date'}
          onClick={() => togglePop('date')}
        >
          <Icon name="calendar" className="ic" />
          {zh.filter.date}
          {counts.date > 0 ? <span className="fcount">{counts.date}</span> : null}
          <Icon name="chevron" className="ic" size={12} />
        </button>

        <button
          ref={priorityRef}
          type="button"
          className={`fbtn${openPop === 'priority' ? ' open' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={openPop === 'priority'}
          onClick={() => togglePop('priority')}
        >
          <Icon name="flag" className="ic" />
          {zh.filter.priority}
          {counts.priority > 0 ? <span className="fcount">{counts.priority}</span> : null}
          <Icon name="chevron" className="ic" size={12} />
        </button>

        {active ? (
          <button type="button" className="fclear" title={zh.filter.clearAll} onClick={onReset}>
            {zh.filter.clear}
          </button>
        ) : null}

        <div className="fright">
          {searchOpen || keepSearchOpen ? (
            <div className="searchbox">
              <Icon name="search" className="ic" />
              <input
                ref={searchInputRef}
                type="text"
                value={filter.keyword}
                placeholder={zh.filter.searchPlaceholder}
                aria-label={zh.filter.searchAria}
                onChange={(event) => onSetKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation()
                    if (filter.keyword) onSetKeyword('')
                    setSearchOpen(false)
                  }
                }}
              />
              <button
                type="button"
                className="sx"
                aria-label={zh.filter.closeSearch}
                onClick={() => {
                  if (filter.keyword) onSetKeyword('')
                  setSearchOpen(false)
                }}
              >
                <Icon name="x" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="icon-btn"
              aria-label={zh.filter.searchAria}
              title={zh.filter.searchTitle}
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="search" />
            </button>
          )}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="fchips">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="fchip"
              title={zh.filter.clearAll}
              onClick={() => onRemoveChip(chip.key)}
            >
              {chip.label}
              <span className="x">
                <Icon name="x" />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {openPop === 'scopes' ? (
        <Popover anchor={scopesRef.current} onClose={() => closePop('scopes')}>
          <div className="pop-title">{`${zh.common.project} / ${zh.common.tag}`}</div>
          {projects.length > 0 ? (
            <>
              <div className="pop-sec">{zh.common.project}</div>
              <div className="pop-list">{projects.map(renderScopeRow)}</div>
            </>
          ) : null}
          {tags.length > 0 ? (
            <>
              <div className="pop-sec">{zh.common.tag}</div>
              <div className="pop-list">{tags.map(renderScopeRow)}</div>
            </>
          ) : null}
          {projects.length === 0 && tags.length === 0 ? (
            <div className="pop-title">{zh.filter.noTags}</div>
          ) : null}
          <div className="pop-foot">
            <button type="button" className="ghost-btn" onClick={resetScopes}>
              {zh.filter.reset}
            </button>
            <Button variant="secondary" onClick={() => closePop('scopes')}>
              {zh.common.done}
            </Button>
          </div>
        </Popover>
      ) : null}

      {openPop === 'date' ? (
        <Popover anchor={dateRef.current} onClose={() => closePop('date')}>
          <div className="pop-title">{zh.filter.date}</div>
          <div className="pop-list">
            {DATE_ROWS.map((row) => (
              <button
                key={row.mode}
                type="button"
                className={`pop-row${filter.date.mode === row.mode ? ' on' : ''}`}
                onClick={() => clickDateMode(row.mode)}
              >
                <span className="chk">
                  <Icon name="check" />
                </span>
                {row.label}
              </button>
            ))}
          </div>
          <div className="pop-sec">{zh.filter.custom}</div>
          <DateTimePicker
            mode="date"
            value={customValue}
            onChange={pickCustomDate}
            usage={timeUsage}
            onPickTime={onTimeUsage}
            ariaLabel={zh.filter.custom}
          />
          <div className="pop-foot">
            <button type="button" className="ghost-btn" onClick={resetDate}>
              {zh.filter.reset}
            </button>
            <Button variant="secondary" onClick={() => closePop('date')}>
              {zh.common.done}
            </Button>
          </div>
        </Popover>
      ) : null}

      {openPop === 'priority' ? (
        <Popover anchor={priorityRef.current} onClose={() => closePop('priority')}>
          <div className="pop-title">{zh.filter.priority}</div>
          <div className="pop-list">
            {PRIORITY_ROWS.map((row) => (
              <button
                key={row.priority}
                type="button"
                className={`pop-row${filter.priorities.includes(row.priority) ? ' on' : ''}`}
                onClick={() => onTogglePriority(row.priority)}
              >
                <span className="chk">
                  <Icon name="check" />
                </span>
                <span className={`prio ${row.className}`}>
                  <Icon name="flag" size={12} />
                  {row.label}
                </span>
              </button>
            ))}
            <button
              type="button"
              className={`pop-row${filter.priorities.length === 0 ? ' on' : ''}`}
              onClick={clearPriorities}
            >
              <span className="chk">
                <Icon name="check" />
              </span>
              {zh.priority.none}
            </button>
          </div>
          <div className="pop-foot">
            <button type="button" className="ghost-btn" onClick={clearPriorities}>
              {zh.filter.reset}
            </button>
            <Button variant="secondary" onClick={() => closePop('priority')}>
              {zh.common.done}
            </Button>
          </div>
        </Popover>
      ) : null}
    </>
  )
}
