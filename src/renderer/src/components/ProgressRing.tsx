/**
 * ProgressRing · 进度环
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.6 · design/app-*.png
 * viewBox 40×40、r=16、stroke 3；尺寸 40/34/26；100% 时数字缩到 .52/.448/.334。
 */
import type { CSSProperties, ReactElement } from 'react'
import { zh } from '../i18n/zh'

export type RingSize = 'md' | 'sm' | 'xs'

export interface ProgressRingProps {
  percent: number
  size?: RingSize
  className?: string
}

const SIZE_CLASS: Record<RingSize, string> = { md: '', sm: ' sm', xs: ' xs' }

export function ProgressRing({ percent, size = 'md', className }: ProgressRingProps): ReactElement {
  const pct = Math.max(0, Math.min(100, Math.round(percent)))
  const classes = ['ring', SIZE_CLASS[size].trim(), pct >= 100 ? 'wide' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={classes}
      style={{ '--p': pct } as CSSProperties}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={zh.aria.progress(pct)}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle className="tr" cx="20" cy="20" r="16" />
        <circle className="pr" cx="20" cy="20" r="16" />
      </svg>
      <span>{pct}%</span>
    </div>
  )
}
