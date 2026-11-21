/**
 * Chip / PickChip · 只读标签与可选筛选 chip
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.4 · design/app-*.png（app-inbox / app-filter）
 */
import type { ReactElement, ReactNode } from 'react'
import type { TaskPriority } from '../../../shared/types'
import { Icon } from './Icons'
import { zh } from '../i18n/zh'

export type ChipKind = 'plain' | 'tag' | 'project'

export interface ChipProps {
  children: ReactNode
  kind?: ChipKind
  /** 项目色点 */
  dotColor?: string
  className?: string
  title?: string
}

export function Chip({ children, kind = 'plain', dotColor, className, title }: ChipProps): ReactElement {
  const classes = ['chip']
  if (kind === 'tag') classes.push('tag')
  if (kind === 'project') classes.push('proj')
  if (dotColor) classes.push('dot')
  if (className) classes.push(className)
  return (
    <span
      className={classes.join(' ')}
      title={title}
      style={dotColor ? ({ '--dot': dotColor } as React.CSSProperties) : undefined}
    >
      {children}
    </span>
  )
}

export interface PriorityChipProps {
  priority: TaskPriority
}

const PRIORITY_CLASS: Record<Exclude<TaskPriority, 0>, string> = {
  1: 'low',
  2: 'med',
  3: 'high'
}

const PRIORITY_LABEL: Record<Exclude<TaskPriority, 0>, string> = {
  1: zh.priority.low,
  2: zh.priority.medium,
  3: zh.priority.high
}

/** 优先级 chip：必须同时有颜色与文字（不只靠颜色表达） */
export function PriorityChip({ priority }: PriorityChipProps): ReactElement | null {
  if (priority === 0) return null
  const level = priority as Exclude<TaskPriority, 0>
  return (
    <span className={`prio ${PRIORITY_CLASS[level]}`}>
      <Icon name="flag" className="ic" />
      {PRIORITY_LABEL[level]}
    </span>
  )
}

export interface PickChipProps {
  children: ReactNode
  active?: boolean
  add?: boolean
  onClick?: () => void
  className?: string
  title?: string
}

/** 可点击 chip：26–27 高、选中 accent-soft */
export function PickChip({
  children,
  active = false,
  add = false,
  onClick,
  className,
  title
}: PickChipProps): ReactElement {
  const classes = ['pick-chip']
  if (active) classes.push('on')
  if (add) classes.push('add')
  if (className) classes.push(className)
  return (
    <button type="button" className={classes.join(' ')} aria-pressed={active} onClick={onClick} title={title}>
      {children}
    </button>
  )
}
