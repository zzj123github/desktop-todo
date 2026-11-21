/**
 * ManageModal · 项目 / 标签管理（完整弹窗 + 单项范围）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.10 · design/app-manage.png / app-manage-project.png / app-sidebar-manage-entry.png
 * 行内重命名、新建、删除（有关联任务二次确认），删除后 toast 撤销；从设置进入关闭返回设置由父级控制。
 */
import { useState, type ReactElement } from 'react'
import type { TagDTO, TagKind } from '../../../shared/types'
import { Modal } from './Modal'
import { Icon } from './Icons'
import { DeleteConfirm, type DeleteImpact } from './DeleteConfirm'
import { useToast } from './Toast'
import { zh } from '../i18n/zh'

export type ManageScope = 'all' | TagKind

export interface ManageModalProps {
  scope: ManageScope
  projects: TagDTO[]
  tags: TagDTO[]
  onClose: () => void
  /** 创建/重命名/删除/撤销后刷新标签与任务列表 */
  onChanged: () => void
}

interface RenameState {
  kind: TagKind
  id: string
  value: string
}

interface ConfirmState {
  kind: TagKind
  id: string
  name: string
  impact: DeleteImpact
}

const ALL_FILTER = {
  status: 'all' as const,
  date: { mode: 'any' as const },
  tagIds: [],
  priorities: [],
  keyword: ''
}

export function ManageModal({ scope, projects, tags, onClose, onChanged }: ManageModalProps): ReactElement {
  const { showToast } = useToast()
  const [rename, setRename] = useState<RenameState | null>(null)
  const [adding, setAdding] = useState<TagKind | null>(null)
  const [newName, setNewName] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [busy, setBusy] = useState(false)

  const isProject = scope !== 'tag'
  const isTag = scope !== 'project'
  const title = scope === 'project' ? zh.manage.titleProjects : scope === 'tag' ? zh.manage.titleTags : zh.manage.titleAll
  const subtitle =
    scope === 'project'
      ? zh.manage.subtitleProjects
      : scope === 'tag'
        ? zh.manage.subtitleTags
        : zh.manage.subtitle

  const create = async (kind: TagKind): Promise<void> => {
    const name = newName.trim()
    if (!name) {
      showToast(zh.manage.emptyName)
      return
    }
    try {
      await window.api.tags.create({ name, kind })
      setAdding(null)
      setNewName('')
      onChanged()
      showToast(kind === 'project' ? zh.toast.projectCreated(name) : zh.toast.tagCreated(name))
    } catch (err) {
      showToast(err instanceof Error && /exist|重名/.test(err.message) ? zh.manage.duplicate : zh.common.error)
    }
  }

  const saveRename = async (): Promise<void> => {
    if (!rename) return
    const name = rename.value.trim()
    if (!name) {
      showToast(zh.manage.emptyName)
      return
    }
    try {
      await window.api.tags.rename({ id: rename.id, name })
      setRename(null)
      onChanged()
      showToast(zh.toast.renamed)
    } catch (err) {
      showToast(err instanceof Error && /exist|重名/.test(err.message) ? zh.manage.duplicate : zh.common.error)
    }
  }

  const undoDelete = async (
    kind: TagKind,
    record: TagDTO,
    taskIds: string[]
  ): Promise<void> => {
    try {
      const recreated = await window.api.tags.create({
        name: record.name,
        kind: record.kind,
        color: record.color
      })
      if (kind === 'project') {
        for (const taskId of taskIds) {
          await window.api.tasks.update({ id: taskId, patch: { projectId: recreated.id } })
        }
      } else {
        const tasks = await window.api.tasks.list({ filter: ALL_FILTER })
        const byId = new Map(tasks.map((task) => [task.id, task]))
        for (const taskId of taskIds) {
          const task = byId.get(taskId)
          if (!task) continue
          await window.api.tasks.update({
            id: taskId,
            patch: { tagIds: Array.from(new Set([...task.tagIds, recreated.id])) }
          })
        }
      }
      onChanged()
    } catch {
      showToast(zh.common.error)
    }
  }

  const doDelete = async (kind: TagKind, id: string, name: string): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.api.tags.delete({ id })
      setConfirm(null)
      onChanged()
      showToast(kind === 'project' ? zh.toast.projectDeleted(name) : zh.toast.tagDeleted(name), {
        undo: () => void undoDelete(kind, result.record, result.taskIds),
        duration: 5000
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : zh.common.error)
    } finally {
      setBusy(false)
    }
  }

  const requestDelete = async (kind: TagKind, item: TagDTO): Promise<void> => {
    try {
      const affected = await window.api.tasks.list({
        filter: { ...ALL_FILTER, tagIds: [item.id] }
      })
      const impact: DeleteImpact = {
        total: affected.length,
        pending: affected.filter((task) => task.status === 0).length
      }
      if (impact.total > 0) setConfirm({ kind, id: item.id, name: item.name, impact })
      else await doDelete(kind, item.id, item.name)
    } catch (err) {
      showToast(err instanceof Error ? err.message : zh.common.error)
    }
  }

  const rowIcon = (kind: TagKind, item: TagDTO): ReactElement =>
    kind === 'project' ? (
      <span className="mg-dot" style={{ background: item.color }} aria-hidden="true" />
    ) : (
      <span className="mg-tagic" aria-hidden="true">
        <Icon name="tag" size={13} />
      </span>
    )

  const rows = (kind: TagKind, list: TagDTO[]): ReactElement => {
    if (!list.length) {
      return <div className="mg-empty">{kind === 'project' ? zh.manage.emptyProjects : zh.manage.emptyTags}</div>
    }
    return (
      <div className="mg-list">
        {list.map((item) => {
          const editing = rename !== null && rename.kind === kind && rename.id === item.id
          const count = item.pendingCount ?? 0
          if (editing) {
            return (
              <div key={item.id} className="mg-row editing">
                {rowIcon(kind, item)}
                <input
                  className="mg-input"
                  autoFocus
                  maxLength={40}
                  value={rename.value}
                  aria-label={`${zh.common.rename}${item.name}`}
                  onChange={(event) => setRename({ ...rename, value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void saveRename()
                    }
                    if (event.key === 'Escape') setRename(null)
                  }}
                  onFocus={(event) => event.target.select()}
                />
                <button type="button" className="mg-btn pri" onClick={() => void saveRename()}>
                  {zh.common.save}
                </button>
                <button type="button" className="mg-btn" onClick={() => setRename(null)}>
                  {zh.manage.cancel}
                </button>
              </div>
            )
          }
          return (
            <div key={item.id} className="mg-row">
              {rowIcon(kind, item)}
              <span className="mg-name">{item.name}</span>
              <span className="mg-count">
                {count > 0 ? zh.manage.pendingCount(count) : zh.manage.noPending}
              </span>
              <button
                type="button"
                className="mg-act"
                title={zh.common.rename}
                aria-label={`${zh.common.rename}${item.name}`}
                onClick={() => setRename({ kind, id: item.id, value: item.name })}
              >
                <Icon name="pencil" size={13} />
              </button>
              <button
                type="button"
                className="mg-act danger"
                title={zh.common.delete}
                aria-label={`${zh.common.delete}${item.name}`}
                onClick={() => void requestDelete(kind, item)}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  const addArea = (kind: TagKind): ReactElement => {
    if (adding === kind) {
      return (
        <div className="mg-row editing">
          {kind === 'project' ? (
            <span className="mg-dot" style={{ background: 'var(--check-border)' }} aria-hidden="true" />
          ) : (
            <span className="mg-tagic" aria-hidden="true">
              <Icon name="tag" size={13} />
            </span>
          )}
          <input
            className="mg-input"
            autoFocus
            maxLength={40}
            value={newName}
            placeholder={zh.manage.namePlaceholder}
            aria-label={kind === 'project' ? zh.manage.addProject : zh.manage.addTag}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void create(kind)
              }
              if (event.key === 'Escape') setAdding(null)
            }}
          />
          <button type="button" className="mg-btn pri" onClick={() => void create(kind)}>
            {zh.manage.create}
          </button>
          <button type="button" className="mg-btn" onClick={() => setAdding(null)}>
            {zh.manage.cancel}
          </button>
        </div>
      )
    }
    return (
      <button
        type="button"
        className="mg-add"
        onClick={() => {
          setAdding(kind)
          setNewName('')
        }}
      >
        <Icon name="plus" size={12} />
        {kind === 'project' ? zh.manage.addProject : zh.manage.addTag}
      </button>
    )
  }

  const body = (
    <>
      {isProject ? (
        <div className="mg-sec">
          <div className="mg-sec-h">
            <span>{zh.manage.projectsSection}</span>
            <span className="mg-sec-n">{projects.length}</span>
          </div>
          {rows('project', projects)}
          {addArea('project')}
        </div>
      ) : null}
      {isTag ? (
        <div className="mg-sec">
          <div className="mg-sec-h">
            <span>{zh.manage.tagsSection}</span>
            <span className="mg-sec-n">{tags.length}</span>
          </div>
          {rows('tag', tags)}
          {addArea('tag')}
        </div>
      ) : null}
      <div className="mg-help">{zh.manage.help}</div>
    </>
  )

  return (
    <>
      <Modal
        title={title}
        subtitle={subtitle}
        size={scope === 'all' ? 'manage' : 'single'}
        onClose={onClose}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn-pri" onClick={onClose}>
              {zh.manage.close}
            </button>
          </>
        }
      >
        {body}
      </Modal>
      {confirm ? (
        <DeleteConfirm
          kind={confirm.kind}
          name={confirm.name}
          impact={confirm.impact}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void doDelete(confirm.kind, confirm.id, confirm.name)}
        />
      ) : null}
      {busy ? null : null}
    </>
  )
}
