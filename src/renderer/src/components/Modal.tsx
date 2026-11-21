/**
 * Modal · 模态容器
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.8 · design/app-*.png
 * 只允许 X / 取消 / 保存 / Esc 关闭；点击遮罩绝不关闭；打开焦点进入；关闭焦点返回触发元素；锁背景滚动。
 */
import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icons'

export type ModalSize = 'default' | 'wide' | 'manage' | 'single' | 'confirm'

const SIZE_CLASS: Record<ModalSize, string> = {
  default: '',
  wide: 'wide',
  manage: 'manage-modal',
  single: 'manage-modal manage-scoped',
  confirm: 'confirm-modal'
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  title: string
  subtitle?: string
  size?: ModalSize
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  role?: 'dialog' | 'alertdialog'
  /** 关闭按钮的 aria-label，默认「关闭」 */
  closeLabel?: string
  className?: string
}

export function Modal({
  title,
  subtitle,
  size = 'default',
  onClose,
  children,
  footer,
  role = 'dialog',
  closeLabel = '关闭',
  className
}: ModalProps): ReactElement {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE)
    if (first) first.focus()
    else dialog?.focus()

    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      // Esc 逐层关闭：日期选择器/浮层打开时由它们自己处理
      if (document.querySelector('.dp-pop, .pop')) return
      // 仅最顶层模态响应 Esc（管理弹窗内再开删除确认时只关确认框）
      const overlays = document.querySelectorAll('.overlay')
      if (overlays[overlays.length - 1] !== overlayRef.current) return
      event.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = bodyOverflow
      previous?.focus?.()
    }
  }, [])

  const classes = ['modal', SIZE_CLASS[size], className ?? ''].filter(Boolean).join(' ')

  return createPortal(
    <div
      ref={overlayRef}
      className="overlay"
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      // 点击遮罩不关闭：这里刻意不处理 onClick
    >
      <div
        ref={dialogRef}
        className={classes}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div className="modal-title" id={titleId}>
            {title}
          </div>
          {subtitle ? <div className="modal-sub">{subtitle}</div> : null}
          <button type="button" className="modal-x" aria-label={closeLabel} onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}
