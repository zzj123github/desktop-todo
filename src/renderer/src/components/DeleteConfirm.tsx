/**
 * DeleteConfirm · 删除项目 / 标签的二次确认（有关联任务时）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.11 · design/app-delete-confirm.png
 * 424 宽 alertdialog；警示块 accent-soft 底 + warn-border 边；只 X/取消/Esc 关闭，点遮罩不关。
 */
import type { ReactElement } from 'react'
import type { TagKind } from '../../../shared/types'
import { Modal } from './Modal'
import { Icon } from './Icons'
import { zh } from '../i18n/zh'

export interface DeleteImpact {
  total: number
  pending: number
}

export interface DeleteConfirmProps {
  kind: TagKind
  name: string
  impact: DeleteImpact
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirm({ kind, name, impact, onCancel, onConfirm }: DeleteConfirmProps): ReactElement {
  const isProject = kind === 'project'
  const done = Math.max(0, impact.total - impact.pending)
  const title = isProject ? zh.deleteConfirm.projectTitle(name) : zh.deleteConfirm.tagTitle(name)
  const stats = isProject
    ? zh.deleteConfirm.projectStats(impact.total, impact.pending, done)
    : zh.deleteConfirm.tagStats(impact.total, impact.pending, done)
  const body = isProject ? zh.deleteConfirm.projectBody : zh.deleteConfirm.tagBody

  return (
    <Modal
      title={title}
      size="confirm"
      role="alertdialog"
      onClose={onCancel}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {zh.deleteConfirm.cancel}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            {isProject ? zh.deleteConfirm.confirmProject : zh.deleteConfirm.confirmTag}
          </button>
        </>
      }
    >
      <div className="cf-warn">
        <span className="cf-warn-ic" aria-hidden="true">
          <Icon name="trash" size={16} />
        </span>
        <div className="cf-warn-tx">
          <p>{stats}</p>
          <p className="cf-sub">{body}</p>
        </div>
      </div>
    </Modal>
  )
}
