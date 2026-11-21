/**
 * TaskRow · 任务行（主区与挂件两种密度）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.2 · design/app-*.png（app-inbox / app-desktop）
 * 整行点击进入编辑；勾选与链接点击 stopPropagation；逾期文案统一由 lib/date 提供。
 */
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react'
import type { LinkDTO, TagDTO, TaskDTO } from '../../../shared/types'
import { dueParts } from '../lib/date'
import { Chip, PriorityChip } from './Chip'
import { Checkbox } from './Checkbox'
import { Icon } from './Icons'
import { zh } from '../i18n/zh'

export interface TaskRowProps {
  task: TaskDTO
  mode?: 'main' | 'widget'
  projects: TagDTO[]
  tags: TagDTO[]
  onToggle: (task: TaskDTO) => void
  onEdit: (task: TaskDTO) => void
  onOpenLink: (link: LinkDTO) => void
  onDelete: (task: TaskDTO) => void
  /** 60s 时钟；用于逾期文案刷新 */
  now?: number
}

const KIND_ICON = { url: 'globe', folder: 'folder', file: 'file' } as const

export function TaskRow({
  task,
  mode = 'main',
  projects,
  tags,
  onToggle,
  onEdit,
  onOpenLink,
  onDelete,
  now
}: TaskRowProps): ReactElement {
  const done = task.status === 1
  const due = dueParts(task, now)
  const project = task.projectId ? projects.find((item) => item.id === task.projectId) : null
  const taskTags = task.tagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is TagDTO => Boolean(tag))
  const links = task.links ?? []
  // docs/08 §3.3：行内不折叠链接，最多展示 2 个 + 「+N 个链接」（挂件与主区一致）
  const visibleLinks = links.slice(0, 2)
  const restLinks = links.length - visibleLinks.length
  const widget = mode === 'widget'

  const edit = (): void => onEdit(task)
  const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      edit()
    }
  }
  const stop = (event: MouseEvent): void => event.stopPropagation()

  return (
    <div
      className={`task-row${done ? ' done' : ''}${widget ? ' widget-row' : ''}`}
      role="button"
      tabIndex={0}
      onClick={edit}
      onKeyDown={onRowKeyDown}
      data-task-id={task.id}
    >
      <Checkbox
        checked={done}
        label={zh.aria.taskCheckbox(task.title, done)}
        onChange={() => onToggle(task)}
      />
      <div className="t-main">
        <div className="t-title">
          <span className="t-title-tx">{task.title}</span>
          {!widget ? (
            <>
              {project ? (
                <Chip kind="project" dotColor={project.color} title={project.name}>
                  {project.name}
                </Chip>
              ) : null}
              {taskTags.map((tag) => (
                <Chip key={tag.id} kind="tag">
                  {tag.name}
                </Chip>
              ))}
              <PriorityChip priority={task.priority} />
            </>
          ) : null}
        </div>
        <div className="t-meta">
          {done ? (
            <span>{zh.common.doneLabel}</span>
          ) : due.text ? (
            <span className={due.overdue ? 'over' : undefined}>{due.text}</span>
          ) : null}
          {visibleLinks.map((link, index) => (
            <span key={link.id} className="t-meta-sep-wrap">
              {index === 0 ? (due.text || done ? <span className="sep">·</span> : null) : <span className="sep">·</span>}
              <button
                type="button"
                className="t-link"
                title={link.target}
                aria-label={zh.aria.openLink(link.display || link.target)}
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenLink(link)
                }}
              >
                <Icon name={KIND_ICON[link.kind]} className="ic" />
                {link.display || link.target}
              </button>
            </span>
          ))}
          {restLinks > 0 ? (
            <span className="t-meta-sep-wrap">
              {due.text || done || visibleLinks.length > 0 ? <span className="sep">·</span> : null}
              <span className="t-more-links">+{restLinks} 个链接</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="t-tail" onClick={stop}>
        <button
          type="button"
          className="t-mini danger"
          aria-label={`${zh.common.delete}「${task.title}」`}
          title={zh.common.delete}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation()
            onDelete(task)
          }}
        >
          <Icon name="trash" size={12} />
        </button>
      </div>
    </div>
  )
}
