/**
 * EmptyState · 主区与挂件的空状态
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.13 · design/app-*.png（app-inbox）
 * 文案必须说明下一步动作。
 */
import type { ReactElement, ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  body: string
  variant?: 'main' | 'widget'
  action?: ReactNode
}

export function EmptyState({
  title,
  body,
  variant = 'main',
  action
}: EmptyStateProps): ReactElement {
  const cls = variant === 'widget' ? 'w-empty' : 'm-empty'
  return (
    <div className={cls}>
      <b>{title}</b>
      <div>{body}</div>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}
