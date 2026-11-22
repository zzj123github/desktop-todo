/**
 * NoticeModal · 应用内提示弹窗（可复用基础组件）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.8（Modal）· docs/01-PRD.md FR-5
 *
 * 替代系统原生 dialog，用项目自建 Modal + Button + tokens 呈现启动阶段提示
 * （全局快捷键注册失败、数据文件异常等）。视觉与应用内其它弹窗一致，
 * 后续新增应用级提示只需向 NoticeLayer 投递 AppNotice。
 */
import type { ReactElement } from 'react'
import type { AppNotice } from '../../../shared/types'
import { Button } from './Button'
import { Icon } from './Icons'
import { Modal } from './Modal'
import { zh } from '../i18n/zh'

export interface NoticeModalProps {
  notice: AppNotice
  onClose: () => void
  /** 独立提示窗口内使用：不画遮罩、原地渲染（同 Modal 的 embedded） */
  embedded?: boolean
}

const KIND_ICON = {
  info: 'help',
  warning: 'alert',
  error: 'alert'
} as const

export function NoticeModal({ notice, onClose, embedded = false }: NoticeModalProps): ReactElement {
  const acknowledge = notice.acknowledgeLabel ?? zh.notice.ack
  return (
    <Modal
      title={notice.title}
      size="confirm"
      role="alertdialog"
      embedded={embedded}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <Button variant="primary" onClick={onClose}>
            {acknowledge}
          </Button>
        </>
      }
    >
      <div className={`notice notice-${notice.kind}`}>
        <div className="cf-warn">
          <span className="cf-warn-ic" aria-hidden="true">
            <Icon name={KIND_ICON[notice.kind]} size={14} />
          </span>
          <div className="cf-warn-tx">
            {notice.message ? <p>{notice.message}</p> : null}
            {notice.items && notice.items.length > 0 ? (
              <ul className="notice-list">
                {notice.items.map((item, index) => (
                  <li className="notice-row" key={`${item.label}-${index}`}>
                    <span className="notice-kbd">{item.label}</span>
                    {item.detail ? <span className="notice-detail">{item.detail}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {notice.hint ? <p className="cf-sub notice-hint">{notice.hint}</p> : null}
          </div>
        </div>
      </div>
    </Modal>
  )
}
