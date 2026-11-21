/**
 * Button · 主/次/幽灵/危险文字四种形态
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.1 · design/app-*.png（app-editor / app-settings-manage）
 */
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import { Icon, type IconName } from './Icons'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: IconName
  children?: ReactNode
}

const CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-pri',
  secondary: 'btn-sm',
  ghost: 'btn-ghost',
  danger: 'danger-text'
}

export function Button({
  variant = 'primary',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      className={`${CLASS[variant]}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {icon ? <Icon name={icon} className="ic" /> : null}
      {children}
    </button>
  )
}
