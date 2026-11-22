/**
 * EditorModal · 任务编辑面板
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.8 · design/app-editor.png / app-dp-editor.png
 * 字段：标题/备注/项目/标签（可内联新建）/优先级/日期时间（自绘）/多链接（拖拽或粘贴）/删除二次确认。
 */
import { useMemo, useRef, useState, type DragEvent, type FocusEvent, type ReactElement } from 'react'
import type { LinkKind, TagDTO, TaskDTO, TaskPriority } from '../../../shared/types'
import { addDays, atFuture, dayStart, sameDay, type TimeUsageMap } from '../lib/date'
import { autoLinkTitle, isLinkUnavailable, parseLinkInput } from '../lib/links'
import { Modal } from './Modal'
import { DateTimePicker } from './DateTimePicker'
import { Icon, type IconName } from './Icons'
import { PickChip } from './Chip'
import { useToast } from './Toast'
import { zh } from '../i18n/zh'

interface DraftLink {
  id?: string
  kind: LinkKind
  target: string
  display: string
}

export interface EditorModalProps {
  /** null = 新建任务 */
  task: TaskDTO | null
  projects: TagDTO[]
  tags: TagDTO[]
  /** 新建时预填的日期（来自当前视图：今天/明天） */
  initialDue?: number | null
  initialTitle?: string
  timeUsage?: TimeUsageMap
  onPickTime?: (hhmm: string) => void
  onClose: () => void
  onSaved: (task: TaskDTO, isNew: boolean) => void
  onDeleted: (task: TaskDTO) => void
  onTagsChanged: () => void
  /** 独立编辑窗口内渲染时使用：不画遮罩、原地渲染（见 app/EditorWindowHost.tsx） */
  embedded?: boolean
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 3, label: zh.priority.high },
  { value: 2, label: zh.priority.medium },
  { value: 1, label: zh.priority.low },
  { value: 0, label: zh.priority.none }
]

const PRIORITY_ICON = { 3: 'flag', 2: 'flag', 1: 'flag', 0: 'flag' } as const

const LINK_ICON: Record<LinkKind, IconName> = { url: 'globe', folder: 'folder', file: 'file' }

export function EditorModal({
  task,
  projects,
  tags,
  initialDue,
  initialTitle,
  timeUsage,
  onPickTime,
  onClose,
  onSaved,
  onDeleted,
  onTagsChanged,
  embedded
}: EditorModalProps): ReactElement {
  const { showToast } = useToast()
  const isNew = task === null
  const now = Date.now()
  const [title, setTitle] = useState(task?.title ?? initialTitle ?? '')
  const [note, setNote] = useState(task?.note ?? '')
  const [projectId, setProjectId] = useState<string | null>(task?.projectId ?? null)
  const [tagIds, setTagIds] = useState<string[]>(task?.tagIds ?? [])
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 0)
  const [due, setDue] = useState<number | null>(task ? task.dueAt : (initialDue ?? null))
  const [links, setLinks] = useState<DraftLink[]>(
    (task?.links ?? []).map((link) => ({
      id: link.id,
      kind: link.kind,
      target: link.target,
      display: link.display
    }))
  )
  const [linkForm, setLinkForm] = useState({ target: '', title: '' })
  const linkTargetRef = useRef<HTMLInputElement>(null)
  /** 正在行内编辑的链接（key 与链接行 DOM key 一致）：地址与标题可同时修改（用户 m06711） */
  const [editingLink, setEditingLink] = useState<{
    key: string
    target: string
    title: string
    field: 'target' | 'title'
  } | null>(null)
  const editingLinkRef = useRef(false)
  const [adding, setAdding] = useState<'project' | 'tag' | null>(null)
  const [newName, setNewName] = useState('')
  const [deleteStep, setDeleteStep] = useState(false)
  const [shakeTitle, setShakeTitle] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dropOver, setDropOver] = useState(false)
  const [invalidId, setInvalidId] = useState<string | null>(null)

  const todayAt = useMemo(() => atFuture(now, 0, 18, 0), [now])
  const tomorrowAt = useMemo(() => atFuture(now, 1, 18, 0), [now])

  const addLinkByTarget = (target: string): void => {
    const parsed = parseLinkInput(target)
    if (!parsed) {
      showToast(zh.toast.linkInvalid)
      return
    }
    setLinks((prev) => [...prev, parsed])
  }

  /** 行内编辑：标题与路径都可点开，一次编辑地址与标题（用户 m06711） */
  const beginLinkEdit = (key: string, link: DraftLink, field: 'target' | 'title'): void => {
    editingLinkRef.current = true
    setEditingLink({
      key,
      target: link.target,
      title: link.display || autoLinkTitle(link.target),
      field
    })
  }

  const cancelLinkEdit = (): void => {
    editingLinkRef.current = false
    setEditingLink(null)
  }

  /**
   * 失焦/Enter 保存：地址重新识别，无效则保持编辑。
   * 标题未改（空或等于旧自动标题）时跟随新地址重算自动标题；自定义标题保持不变。
   */
  const commitLinkEdit = (index: number): void => {
    if (!editingLinkRef.current || !editingLink) return
    const parsed = parseLinkInput(editingLink.target)
    if (!parsed) {
      showToast(zh.toast.linkInvalid)
      return
    }
    const current = links[index]
    const oldAutoTitle = current ? autoLinkTitle(current.target) : ''
    const title = editingLink.title.trim()
    const customTitle = Boolean(title) && title !== oldAutoTitle
    editingLinkRef.current = false
    setLinks((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              kind: parsed.kind,
              target: parsed.target,
              display: customTitle ? title.slice(0, 120) : parsed.display
            }
          : item
      )
    )
    setEditingLink(null)
  }

  /** 两个输入之间切换焦点时不提交，离开整组后才保存 */
  const handleLinkEditBlur = (index: number, event: FocusEvent<HTMLInputElement>): void => {
    const next = event.relatedTarget
    if (next && event.currentTarget.closest('.lr-edit')?.contains(next)) return
    commitLinkEdit(index)
  }

  const addLinkFromInput = (): void => {
    const parsed = parseLinkInput(linkForm.target, linkForm.title)
    if (!parsed) {
      showToast(zh.toast.linkInvalid)
      return
    }
    setLinks((prev) => [...prev, parsed])
    setLinkForm({ target: '', title: '' })
    window.requestAnimationFrame(() => linkTargetRef.current?.focus())
  }

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDropOver(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length) {
      files.forEach((file) => {
        const path = window.api.drop.getPathForFile(file)
        if (path) addLinkByTarget(path)
      })
      return
    }
    const uri = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
    if (uri) addLinkByTarget(uri)
  }

  const openLink = async (link: DraftLink): Promise<void> => {
    const result = link.id
      ? await window.api.links.open({ id: link.id })
      : await window.api.links.open({ target: link.target, kind: link.kind })
    if (!result.ok) {
      if (isLinkUnavailable(result)) {
        showToast(zh.toast.linkMissing)
        setInvalidId(link.id ?? link.target)
      } else {
        showToast(result.error || zh.toast.openFailed)
      }
    }
  }

  const relocateLink = async (link: DraftLink): Promise<void> => {
    if (!link.id) return
    // 契约（docs/04 IPC 表 links:relocate）：主进程弹文件选择器，成功后返回更新后的 link
    const result = await window.api.links.relocate({ id: link.id })
    if (result.ok && result.link) {
      setLinks((prev) =>
        prev.map((item) =>
          item.id === link.id
            ? { ...item, target: result.link!.target, display: result.link!.display, kind: result.link!.kind }
            : item
        )
      )
      setInvalidId(null)
    }
  }

  const createScope = async (kind: 'project' | 'tag'): Promise<void> => {
    const name = newName.trim()
    if (!name) {
      showToast(zh.manage.emptyName)
      return
    }
    try {
      const created = await window.api.tags.create({ name, kind })
      if (kind === 'project') setProjectId(created.id)
      else setTagIds((prev) => [...prev, created.id])
      setAdding(null)
      setNewName('')
      onTagsChanged()
    } catch (err) {
      showToast(err instanceof Error && /exist|重名/.test(err.message) ? zh.manage.duplicate : zh.common.error)
    }
  }

  const save = async (): Promise<void> => {
    const nextTitle = title.trim()
    if (!nextTitle) {
      setShakeTitle(true)
      window.setTimeout(() => setShakeTitle(false), 400)
      showToast(zh.editor.titleRequired)
      return
    }
    const payloadLinks = links.map((link) => ({
      id: link.id,
      target: link.target,
      display: link.display
    }))
    setBusy(true)
    try {
      if (task) {
        const updated = await window.api.tasks.update({
          id: task.id,
          patch: {
            title: nextTitle,
            note,
            projectId,
            tagIds,
            priority,
            dueAt: due,
            links: payloadLinks
          }
        })
        onSaved(updated, false)
      } else {
        const created = await window.api.tasks.create({
          title: nextTitle,
          note,
          projectId,
          tagIds,
          priority,
          dueAt: due,
          links: payloadLinks
        })
        onSaved(created, true)
      }
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : zh.common.error)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!task) return
    setBusy(true)
    try {
      await window.api.tasks.delete({ id: task.id })
      onDeleted(task)
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : zh.common.error)
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <>
      {!isNew ? (
        deleteStep ? (
          <div className="confirm-row">
            <span>{zh.editor.confirmDelete}</span>
            <span className="spacer" />
            <button type="button" className="btn-ghost" onClick={() => setDeleteStep(false)}>
              {zh.common.cancel}
            </button>
            <button type="button" className="btn-danger" disabled={busy} onClick={() => void remove()}>
              {zh.common.delete}
            </button>
          </div>
        ) : (
          <button type="button" className="danger-text" onClick={() => setDeleteStep(true)}>
            <Icon name="trash" size={13} />
            {zh.editor.deleteTask}
          </button>
        )
      ) : null}
      <span className="spacer" />
      <button type="button" className="btn-ghost" onClick={onClose}>
        {zh.common.cancel}
      </button>
      <button type="button" className="btn-pri" disabled={busy} onClick={() => void save()}>
        {zh.common.save}
      </button>
    </>
  )

  return (
    <Modal
      title={isNew ? zh.editor.createdTitle : zh.editor.title}
      size="wide"
      onClose={onClose}
      footer={footer}
      embedded={embedded}
    >
      <div className="form-field">
        <div className="field-label">{zh.editor.titleLabel}</div>
        <input
          className={`text-input${shakeTitle ? ' shake' : ''}`}
          type="text"
          value={title}
          placeholder={zh.editor.titlePlaceholder}
          aria-label={zh.editor.titleLabel}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void save()
            }
          }}
        />
      </div>

      <div className="form-field">
        <div className="field-label">
          {zh.editor.noteLabel} <span className="opt">可选</span>
        </div>
        <textarea
          className="text-input"
          rows={3}
          value={note}
          placeholder={zh.editor.notePlaceholder}
          aria-label={zh.editor.noteLabel}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="form-field">
        <div className="field-label">{zh.editor.projectLabel}</div>
        <div className="chip-row">
          <PickChip active={projectId === null} onClick={() => setProjectId(null)}>
            {zh.editor.noProject}
          </PickChip>
          {projects.map((project) => (
            <PickChip
              key={project.id}
              active={projectId === project.id}
              onClick={() => setProjectId(project.id)}
            >
              <span className="proj-dot" style={{ background: project.color }} />
              {project.name}
            </PickChip>
          ))}
          {adding === 'project' ? (
            <>
              <input
                className="mini-input"
                autoFocus
                value={newName}
                placeholder={zh.editor.projectPlaceholder}
                aria-label={zh.editor.projectPlaceholder}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void createScope('project')
                  }
                  if (event.key === 'Escape') setAdding(null)
                }}
              />
              <PickChip add onClick={() => void createScope('project')}>
                {zh.manage.create}
              </PickChip>
            </>
          ) : (
            <PickChip
              add
              onClick={() => {
                setAdding('project')
                setNewName('')
              }}
            >
              {zh.editor.newProject}
            </PickChip>
          )}
        </div>
      </div>

      <div className="form-field">
        <div className="field-label">
          {zh.editor.tagsLabel} <span className="opt">{'可多选'}</span>
        </div>
        <div className="chip-row">
          {tags.map((tag) => (
            <PickChip
              key={tag.id}
              active={tagIds.includes(tag.id)}
              onClick={() =>
                setTagIds((prev) =>
                  prev.includes(tag.id) ? prev.filter((item) => item !== tag.id) : [...prev, tag.id]
                )
              }
            >
              {tag.name}
            </PickChip>
          ))}
          {adding === 'tag' ? (
            <>
              <input
                className="mini-input"
                autoFocus
                value={newName}
                placeholder={zh.editor.tagPlaceholder}
                aria-label={zh.editor.tagPlaceholder}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void createScope('tag')
                  }
                  if (event.key === 'Escape') setAdding(null)
                }}
              />
              <PickChip add onClick={() => void createScope('tag')}>
                {zh.manage.create}
              </PickChip>
            </>
          ) : (
            <PickChip
              add
              onClick={() => {
                setAdding('tag')
                setNewName('')
              }}
            >
              {zh.editor.newTag}
            </PickChip>
          )}
        </div>
      </div>

      <div className="form-field">
        <div className="field-label">{zh.editor.priorityLabel}</div>
        <div className="chip-row">
          {PRIORITIES.map((item) => (
            <PickChip key={item.value} active={priority === item.value} onClick={() => setPriority(item.value)}>
              {item.value ? <Icon name={PRIORITY_ICON[item.value]} size={11} className={`prio-ic prio-${item.value}`} /> : null}
              {item.label}
            </PickChip>
          ))}
        </div>
      </div>

      <div className="form-field">
        <div className="field-label">
          {zh.editor.dueLabel} <span className="opt">可选</span>
        </div>
        <div className="date-chips">
          <PickChip active={due !== null && sameDay(due, now)} onClick={() => setDue(todayAt)}>
            {zh.common.today}
          </PickChip>
          <PickChip
            active={due !== null && sameDay(due, addDays(dayStart(now), 1))}
            onClick={() => setDue(tomorrowAt)}
          >
            {zh.common.tomorrow}
          </PickChip>
          <PickChip active={due === null} onClick={() => setDue(null)}>
            {zh.composer.noDate}
          </PickChip>
          <DateTimePicker
            mode="datetime"
            value={due}
            onChange={setDue}
            usage={timeUsage}
            onPickTime={onPickTime}
            ariaLabel={zh.editor.dueLabel}
          />
        </div>
      </div>

      <div className="form-field">
        <div className="field-label">
          {zh.editor.linksLabel} <span className="opt">{'网页 / 文件夹 / UNC / 文件'}</span>
        </div>
        <div className="link-list">
          {links.length === 0 ? <div className="m-empty">{zh.editor.emptyLinks}</div> : null}
          {links.map((link, index) => {
            const name = link.display || autoLinkTitle(link.target)
            const rowKey = `${link.target}-${index}`
            const editing = editingLink?.key === rowKey
            return (
              <div key={rowKey} className={`link-row${editing ? ' editing' : ''}`}>
                <span className="lr-ic" aria-hidden="true">
                  <Icon name={LINK_ICON[link.kind]} size={12} />
                </span>
                <div className="lr-main">
                  {editing && editingLink ? (
                    <div className="lr-edit">
                      <input
                        className="lr-target-input"
                        value={editingLink.target}
                        aria-label={zh.editor.linkTargetLabel}
                        placeholder={zh.editor.linkPlaceholder}
                        autoFocus={editingLink.field === 'target'}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) =>
                          setEditingLink({ ...editingLink, target: event.target.value })
                        }
                        onBlur={(event) => handleLinkEditBlur(index, event)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitLinkEdit(index)
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            event.stopPropagation()
                            cancelLinkEdit()
                          }
                        }}
                      />
                      <input
                        className="lr-title-input"
                        value={editingLink.title}
                        aria-label={zh.editor.linkTitleLabel}
                        placeholder={zh.editor.linkTitlePlaceholder}
                        autoFocus={editingLink.field === 'title'}
                        maxLength={120}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) =>
                          setEditingLink({ ...editingLink, title: event.target.value })
                        }
                        onBlur={(event) => handleLinkEditBlur(index, event)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitLinkEdit(index)
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            event.stopPropagation()
                            cancelLinkEdit()
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="lr-name lr-name-btn"
                        title={zh.editor.linkTitleEdit}
                        aria-label={zh.aria.editLinkTitle(name)}
                        onClick={() => beginLinkEdit(rowKey, link, 'title')}
                      >
                        {name}
                      </button>
                      <button
                        type="button"
                        className="lr-path lr-path-btn"
                        title={zh.editor.linkTargetEdit}
                        aria-label={zh.aria.editLinkTarget(name)}
                        onClick={() => beginLinkEdit(rowKey, link, 'target')}
                      >
                        {link.target}
                      </button>
                    </>
                  )}
                </div>
                {invalidId && (invalidId === link.id || invalidId === link.target) && link.id ? (
                  <button type="button" className="btn-sm" onClick={() => void relocateLink(link)}>
                    {zh.editor.relocate}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="lr-btn"
                    title={zh.common.open}
                    aria-label={zh.aria.openLink(name)}
                    onClick={() => void openLink(link)}
                  >
                    <Icon name="arrow-up" size={12} style={{ transform: 'rotate(45deg)' }} />
                  </button>
                )}
                <button
                  type="button"
                  className="lr-btn danger"
                  title={zh.common.remove}
                  aria-label={zh.aria.removeLink(name)}
                  onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Icon name="trash" size={12} />
                </button>
              </div>
            )
          })}
        </div>
        <div className="add-link-row">
          <input
            ref={linkTargetRef}
            className="text-input link-target-input"
            type="text"
            value={linkForm.target}
            placeholder={zh.editor.linkPlaceholder}
            aria-label={zh.editor.linkTargetLabel}
            onChange={(event) => setLinkForm({ ...linkForm, target: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addLinkFromInput()
              }
            }}
          />
          <input
            className="text-input link-title-input"
            type="text"
            value={linkForm.title}
            placeholder={zh.editor.linkTitleOptional}
            aria-label={zh.editor.linkTitleLabel}
            maxLength={120}
            onChange={(event) => setLinkForm({ ...linkForm, title: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addLinkFromInput()
              }
            }}
          />
          <button type="button" className="btn-sm" onClick={addLinkFromInput}>
            {zh.editor.addLink}
          </button>
        </div>
        <div
          className={`dropzone${dropOver ? ' over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDropOver(true)
          }}
          onDragLeave={() => setDropOver(false)}
          onDrop={onDrop}
        >
          <Icon name="folder" size={15} />
          <div>{zh.editor.dropHint}</div>
          <div style={{ fontSize: '10px', color: 'var(--faint)' }}>{zh.editor.dropHintSub}</div>
        </div>
      </div>
    </Modal>
  )
}
