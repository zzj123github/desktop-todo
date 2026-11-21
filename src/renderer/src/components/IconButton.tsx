/**
 * IconButton · 30×30 图标按钮（必须有 aria-label）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.1
 */
import type { ButtonHTMLAttributes, ReactElement } from 'react'
import { Icon, type IconName } from './Icons'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
  size?: number
  active?: boolean
  danger?: boolean
  children?: never
}

export function IconButton({
  icon,
  label,
  size = 15,
  active = false,
  danger = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps): ReactElement {
  const extra = [className, active ? 'on' : '', danger ? 'danger' : ''].filter(Boolean).join(' ')
  return (
    <button
      type={type}
      className={`icon-btn${extra ? ` ${extra}` : ''}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}
