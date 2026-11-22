/**
 * Popover · 锚定浮层（筛选 / 标签 / 日期等处使用）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.7 · design/app-*.png（app-filter）
 * 320 宽、z131；点击外部与 Esc 关闭；不锁背景滚动；下方空间不足时翻到上方。
 * 同一时刻只允许一个 Popover 挂载（见 anchoredPosition.activatePopover）。
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { isInsideFloatingLayer, activatePopover } from './anchoredPosition'

const GAP = 6
const MARGIN = 12

export interface PopoverProps {
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  className?: string
  /** 浮层宽度；默认由 CSS 的 320px 决定 */
  width?: number
}

interface Position {
  left: number
  top: number
  maxHeight: number
}

function computePosition(anchor: HTMLElement, el: HTMLElement, width: number): Position {
  const rect = anchor.getBoundingClientRect()
  const popRect = el.getBoundingClientRect()
  // 上一次定位可能已用 maxHeight 压过高度；用 scrollHeight 取内容自然高度，
  // 否则视口/窗口变大（或挂件临时加高）后浮层会一直停在旧高度、内容被裁切。
  const contentHeight = Math.max(el.scrollHeight, Math.round(popRect.height))
  const popWidth = width || popRect.width || 320
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  let left = Math.min(rect.left, viewportW - popWidth - MARGIN)
  left = Math.max(MARGIN, left)
  const below = viewportH - rect.bottom - GAP - MARGIN
  const above = rect.top - GAP - MARGIN
  const height = Math.min(contentHeight, Math.max(below, above))
  let top = rect.bottom + GAP
  if (below < Math.min(contentHeight, 160) && above > below) {
    top = Math.max(MARGIN, rect.top - GAP - height)
  }
  return { left, top, maxHeight: Math.max(120, height) }
}

export function Popover({ anchor, onClose, children, className, width }: PopoverProps): ReactElement | null {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Position | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const el = ref.current
    const update = (): void => setPos(computePosition(anchor, el, width ?? 0))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [anchor, width])

  // 同一时刻只保留一个 Popover：新挂载的浮层会先关闭上一个（键盘/程序化打开
  // 不会触发 outside-mousedown，否则两个 .pop 会叠在一起——用户反馈 #1）。
  useEffect(() => {
    return activatePopover(() => onCloseRef.current())
  }, [])

  useEffect(() => {
    const onPointer = (event: MouseEvent): void => {
      const target = event.target as Node
      if (ref.current?.contains(target)) return
      if (anchor?.contains(target)) return
      // 浮层内再打开的子浮层（如日期选择器 .dp-pop，portal 到 body）视为内部点击，
      // 否则父浮层会在按下瞬间关闭，导致日期选择不可用（用户反馈 #7）。
      if (isInsideFloatingLayer(target)) return
      onCloseRef.current()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('mousedown', onPointer, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointer, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [anchor])

  if (!anchor) return null

  return createPortal(
    <div
      ref={ref}
      className={`pop${className ? ` ${className}` : ''}`}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, maxHeight: pos?.maxHeight }}
      role="dialog"
    >
      {children}
    </div>,
    document.body
  )
}
