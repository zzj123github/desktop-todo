/**
 * Checkbox · 自绘圆形勾选
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.3 · design/app-*.png
 * 18px 圆形、1.5px 边框、选中陶土底 + 白勾；整行点击由 TaskRow 负责。
 */
import type { ReactElement } from 'react'
import { Icon } from './Icons'

export interface CheckboxProps {
  checked: boolean
  label: string
  disabled?: boolean
  onChange?: (checked: boolean) => void
  className?: string
}

export function Checkbox({
  checked,
  label,
  disabled = false,
  onChange,
  className
}: CheckboxProps): ReactElement {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`t-check${checked ? ' on' : ''}${className ? ` ${className}` : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        onChange?.(!checked)
      }}
    >
      <Icon name="check" className="ic" size={10} />
    </button>
  )
}
