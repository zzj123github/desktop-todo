/**
 * Toast · 底部居中提示（含撤销）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.11 · design/app-*.png（app-editor 等）
 * 停留 3.2s，带撤销时 5s；不阻挡点击；文案包含动作对象。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icons'
import { zh } from '../i18n/zh'

export interface ToastOptions {
  /** 撤销回调；存在时停留 5s 并显示「撤销」 */
  undo?: () => void | Promise<void>
  duration?: number
}

interface ToastItem {
  id: number
  message: string
  undo?: () => void | Promise<void>
  duration: number
}

interface ToastApi {
  showToast: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = ++seq
      const duration = options?.duration ?? (options?.undo ? 5000 : 3200)
      setItems((list) => [...list.slice(-2), { id, message, undo: options?.undo, duration }])
      window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-host" role="status" aria-live="polite">
          {items.map((item) => (
            <ToastView
              key={item.id}
              item={item}
              onUndo={async () => {
                await item.undo?.()
                dismiss(item.id)
              }}
            />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

function ToastView({
  item,
  onUndo
}: {
  item: ToastItem
  onUndo: () => void
}): ReactElement {
  const timer = useRef<number | null>(null)
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])
  return (
    <div className="toast">
      <Icon name="check" className="tic" />
      <span>{item.message}</span>
      {item.undo ? (
        <button
          type="button"
          className="tact"
          onClick={() => {
            if (timer.current) window.clearTimeout(timer.current)
            onUndo()
          }}
        >
          {zh.toast.undo}
        </button>
      ) : null}
    </div>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}
