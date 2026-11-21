/**
 * Composer · 底部快速输入（挂件与完整窗口共用）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.6 · design/app-*.png
 * Enter 保存、Shift+Enter 换行、IME 组字不提交；工具行 4 项（日期/标签/优先级/链接）各带浮层。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { LinkKind, TagDTO, TaskPriority } from '../../../shared/types'
import { atFuture, fmtHM, type TimeUsageMap } from '../lib/date'
import { detectLink, draftDueLabel, parseQuick } from '../lib/parseQuick'
import { Popover } from './Popover'
import { DateTimePicker } from './DateTimePicker'
import { Icon, type IconName } from './Icons'
import { LinkRow } from './LinkRow'
import { PickChip } from './Chip'
import { useToast } from './Toast'
import { zh } from '../i18n/zh'

export interface ComposerLink {
  kind: LinkKind
  target: string
  display: string
}

/** 提交给页面的任务草稿（页面负责调用 tasks.create 与 toast / 动画） */
export interface ComposerSubmit {
  title: string
  projectId: string | null
  tagIds: string[]
  priority: TaskPriority
  dueAt: number | null
  links: ComposerLink[]
}

export interface ComposerProps {
  mode: 'main' | 'widget'
  projects: TagDTO[]
  tags: TagDTO[]
  /** 未输入日期词时的兜底到期时间；undefined 用默认今天 18:00，null 表示不设日期 */
  fallbackDue?: number | null
  timeUsage?: TimeUsageMap
  onPickTime?: (hhmm: string) => void
  onSubmit: (draft: ComposerSubmit) => Promise<void> | void
  /** #标签自动新建后通知页面刷新标签列表 */
  onTagsChanged?: () => void
  inputRef?: React.RefObject<HTMLTextAreaElement>
  placeholder?: string
}

type PopKind = 'due' | 'tags' | 'priority' | 'links'

const PRIORITY_ORDER: TaskPriority[] = [3, 2, 1, 0]
const PRIORITY_TEXT: Record<TaskPriority, string> = {
  3: zh.priority.high,
  2: zh.priority.medium,
  1: zh.priority.low,
  0: zh.priority.none
}

const PRIORITY_ICON: Record<TaskPriority, string> = { 3: '高', 2: '中', 1: '低', 0: '' }

export function Composer({
  mode,
  projects,
  tags,
  fallbackDue,
  timeUsage,
  onPickTime,
  onSubmit,
  onTagsChanged,
  inputRef,
  placeholder
}: ComposerProps): ReactElement {
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [due, setDue] = useState<number | null>(null)
  const [priority, setPriority] = useState<TaskPriority>(0)
  const [projectIds, setProjectIds] = useState<string[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])
  const [links, setLinks] = useState<ComposerLink[]>([])
  const [openPop, setOpenPop] = useState<PopKind | null>(null)
  const [linkInput, setLinkInput] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const localRef = useRef<HTMLTextAreaElement>(null)
  const areaRef = inputRef ?? localRef
  const dueRef = useRef<HTMLButtonElement>(null)
  const tagsRef = useRef<HTMLButtonElement>(null)
  const prioRef = useRef<HTMLButtonElement>(null)
  const linksRef = useRef<HTMLButtonElement>(null)
  const toolRefs: Record<PopKind, React.RefObject<HTMLButtonElement>> = {
    due: dueRef,
    tags: tagsRef,
    priority: prioRef,
    links: linksRef
  }
  const composing = useRef(false)
  const now = Date.now()

  const todayAt = useMemo(() => atFuture(now, 0, 18, 0), [now])
  const tomorrowAt = useMemo(() => atFuture(now, 1, 18, 0), [now])
  const allScopes = useMemo(() => [...projects, ...tags], [projects, tags])

  /* 输入框高度随内容增长，上限 110px（docs/08 §3.6） */
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(110, Math.max(mode === 'widget' ? 21 : 22, el.scrollHeight))
    el.style.height = `${next}px`
  }, [text, areaRef, mode])

  const resetDraft = useCallback(() => {
    setText('')
    setDue(null)
    setPriority(0)
    setProjectIds([])
    setTagIds([])
    setLinks([])
    setLinkInput('')
    setOpenPop(null)
  }, [])

  const ensureTagIds = async (names: string[]): Promise<string[]> => {
    if (!names.length) return []
    const result: string[] = []
    for (const name of names) {
      const existing = allScopes.find((item) => item.name === name)
      if (existing) {
        result.push(existing.id)
        continue
      }
      try {
        const created = await window.api.tags.create({ name, kind: 'tag' })
        result.push(created.id)
        onTagsChanged?.()
      } catch {
        /* 重名等失败：忽略该标签，任务照常创建 */
      }
    }
    return result
  }

  const submit = async (): Promise<void> => {
    if (busy) return
    const raw = text.trim()
    const hasContent = raw || links.length > 0 || projectIds.length > 0 || tagIds.length > 0 || due !== null
    if (!hasContent) {
      setShake(true)
      window.setTimeout(() => setShake(false), 400)
      areaRef.current?.focus()
      return
    }

    const parsed = parseQuick(raw, now, fallbackDue === undefined ? {} : { defaultDue: fallbackDue })
    const autoTagIds = await ensureTagIds(parsed.tagNames)
    const mergedTagIds = Array.from(new Set([...tagIds, ...autoTagIds]))
    const finalLinks: ComposerLink[] = [...links, ...parsed.links].map((link) => ({
      kind: link.kind,
      target: link.target,
      display: link.display
    }))
    let title = parsed.title
    if (!raw || title === '新任务') {
      if (finalLinks.length) title = finalLinks[0].display
      else if (!due && parsed.dueAt === null) {
        setShake(true)
        window.setTimeout(() => setShake(false), 400)
        return
      }
    }

    setBusy(true)
    try {
      await onSubmit({
        title,
        projectId: projectIds[0] ?? null,
        tagIds: mergedTagIds,
        priority: priority || parsed.priority,
        dueAt: due ?? parsed.dueAt,
        links: finalLinks
      })
      resetDraft()
      areaRef.current?.focus()
    } catch (err) {
      showToast(err instanceof Error ? err.message : zh.common.error)
    } finally {
      setBusy(false)
    }
  }

  const addLink = (): void => {
    const recognized = detectLink(linkInput)
    if (!recognized) {
      showToast(zh.toast.openFailed)
      return
    }
    setLinks((prev) => [...prev, recognized])
    setLinkInput('')
  }

  const toggleProject = (id: string): void => {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const toggleTag = (id: string): void => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter') return
    if (composing.current || event.nativeEvent.isComposing) return
    if (event.shiftKey) return
    event.preventDefault()
    void submit()
  }

  const open = (kind: PopKind): void => {
    setOpenPop((prev) => (prev === kind ? null : kind))
  }

  const dueLabel = due === null ? '' : `${draftDueLabel(due, now)} ${fmtHM(due)}`
  const toolButton = (
    kind: PopKind,
    icon: IconName,
    label: string,
    active: boolean,
    ref: React.RefObject<HTMLButtonElement>,
    extra?: ReactElement | null
  ): ReactElement => (
    <button
      ref={ref}
      type="button"
      className={`ctool${active ? ' on' : ''}`}
      aria-expanded={openPop === kind}
      onClick={() => open(kind)}
    >
      <Icon name={icon} size={13} className="ic" />
      <span>{label}</span>
      {extra}
      <Icon name="chevron" size={9} className="ic" />
    </button>
  )

  return (
    <div className={`composer${mode === 'widget' ? ' widget-composer' : ''}`}>
      <textarea
        ref={areaRef}
        className={`cinput${shake ? ' shake' : ''}`}
        rows={1}
        value={text}
        placeholder={placeholder ?? zh.composer.placeholder}
        aria-label={zh.composer.placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={() => {
          composing.current = false
        }}
      />
      <div className="composer-tools">
        {toolButton(
          'due',
          'calendar',
          dueLabel || zh.composer.due,
          due !== null,
          dueRef,
          due !== null ? (
            <span
              className="x"
              role="button"
              tabIndex={0}
              aria-label={zh.composer.clear}
              onClick={(event) => {
                event.stopPropagation()
                setDue(null)
              }}
            >
              <Icon name="x" size={9} className="ic" />
            </span>
          ) : null
        )}
        {toolButton(
          'tags',
          'tag',
          tagIds.length || projectIds.length
            ? `${zh.composer.tags} ${tagIds.length + projectIds.length}`
            : zh.composer.tags,
          tagIds.length + projectIds.length > 0,
          tagsRef
        )}
        {toolButton(
          'priority',
          'flag',
          priority ? `${zh.composer.priority} ${PRIORITY_TEXT[priority]}` : zh.composer.priority,
          priority !== 0,
          prioRef
        )}
        {toolButton(
          'links',
          'link',
          links.length ? `${zh.composer.links} ${links.length}` : zh.composer.links,
          links.length > 0,
          linksRef
        )}
        <button
          type="button"
          className="composer-send"
          title={zh.composer.send}
          aria-label={zh.composer.send}
          disabled={busy}
          onClick={() => void submit()}
        >
          <Icon name="arrow-up" size={14} />
        </button>
      </div>

      {openPop === 'due' ? (
        <Popover anchor={dueRef.current} onClose={() => setOpenPop(null)}>
          <div className="pop-title">{zh.composer.due}</div>
          <div className="pop-list">
            <button type="button" className="pop-row" onClick={() => { setDue(todayAt); setOpenPop(null) }}>
              <span>{zh.composer.todayPrefix}{fmtHM(todayAt)}</span>
            </button>
            <button type="button" className="pop-row" onClick={() => { setDue(tomorrowAt); setOpenPop(null) }}>
              <span>{zh.composer.tomorrowPrefix}{fmtHM(tomorrowAt)}</span>
            </button>
            <button type="button" className="pop-row" onClick={() => { setDue(null); setOpenPop(null) }}>
              <span>{zh.composer.noDate}</span>
            </button>
          </div>
          <div className="pop-sec">{zh.composer.specify}</div>
          <div className="date-custom">
            <DateTimePicker
              mode="datetime"
              value={due}
              onChange={(next) => {
                setDue(next)
                setOpenPop(null)
              }}
              usage={timeUsage}
              onPickTime={onPickTime}
              ariaLabel={zh.composer.due}
            />
          </div>
          <div className="pop-foot">
            <span />
            <button type="button" className="btn-sm" onClick={() => setOpenPop(null)}>
              {zh.composer.done}
            </button>
          </div>
        </Popover>
      ) : null}

      {openPop === 'tags' ? (
        <Popover anchor={tagsRef.current} onClose={() => setOpenPop(null)}>
          {projects.length ? (
            <>
              <div className="pop-title">{zh.common.project}</div>
              <div className="pop-list">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={`pop-row${projectIds.includes(project.id) ? ' on' : ''}`}
                    onClick={() => toggleProject(project.id)}
                  >
                    <span className="chk">
                      <Icon name="check" size={9} className="ic" />
                    </span>
                    <span className="proj-dot" style={{ background: project.color }} />
                    <span>{project.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {tags.length ? (
            <>
              <div className="pop-sec">{zh.common.tag}</div>
              <div className="pop-list">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`pop-row${tagIds.includes(tag.id) ? ' on' : ''}`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    <span className="chk">
                      <Icon name="check" size={9} className="ic" />
                    </span>
                    <Icon name="tag" size={12} className="ic" />
                    <span>{tag.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {!projects.length && !tags.length ? <div className="pop-sec">{zh.filter.noTags}</div> : null}
          <div className="pop-foot">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setProjectIds([])
                setTagIds([])
              }}
            >
              {zh.common.reset}
            </button>
            <button type="button" className="btn-sm" onClick={() => setOpenPop(null)}>
              {zh.composer.done}
            </button>
          </div>
        </Popover>
      ) : null}

      {openPop === 'priority' ? (
        <Popover anchor={prioRef.current} onClose={() => setOpenPop(null)}>
          <div className="pop-title">{zh.composer.priority}</div>
          <div className="mini-pri">
            {PRIORITY_ORDER.map((value) => (
              <PickChip
                key={value}
                active={priority === value}
                onClick={() => {
                  setPriority(value)
                  setOpenPop(null)
                }}
              >
                {PRIORITY_ICON[value] ? (
                  <Icon name="flag" size={11} className={`prio-ic prio-${value}`} />
                ) : null}
                {PRIORITY_TEXT[value]}
              </PickChip>
            ))}
          </div>
        </Popover>
      ) : null}

      {openPop === 'links' ? (
        <Popover anchor={linksRef.current} onClose={() => setOpenPop(null)}>
          <div className="pop-title">{zh.composer.links}</div>
          {links.map((link, index) => (
            <LinkRow
              key={`${link.target}-${index}`}
              link={{ id: `${index}`, kind: link.kind, target: link.target, display: link.display }}
              removable
              onRemove={() => setLinks((prev) => prev.filter((_, i) => i !== index))}
            />
          ))}
          <input
            className="kw"
            value={linkInput}
            placeholder={zh.composer.linkPlaceholder}
            onChange={(event) => setLinkInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addLink()
              }
            }}
          />
          <div className="pop-foot">
            <button type="button" className="ghost-btn" onClick={() => setOpenPop(null)}>
              {zh.common.close}
            </button>
            <button type="button" className="btn-sm" onClick={addLink}>
              {zh.composer.addLink}
            </button>
          </div>
        </Popover>
      ) : null}
    </div>
  )
}
