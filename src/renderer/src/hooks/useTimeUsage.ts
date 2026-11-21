/**
 * useTimeUsage · 「常用时间」快捷 chip 的使用统计（docs/02 §5.6）
 *
 * 数据源是设置表 `timeUsage`（`{ 'HH:mm': 次数 }`，主进程 settings 归一化：只保留正数、最多 100 项）。
 * 跨窗口一致靠 `on.settingsChanged`；对象键顺序用于近似「最近使用」排序（最近使用的时间被移到末尾）。
 * 多视图（挂件 / 完整窗口 / 胶囊）各自持有实例互不干扰。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { noteTimeUsage } from '../lib/date'

export const TIME_USAGE_KEY = 'timeUsage' as const

/** 设置里的原始形态：`{ 'HH:mm': 次数 }` */
export type TimeUsageCounts = Record<string, number>

export interface UseTimeUsageResult {
  /** 与 lib/date 的 `quickTimes(now, usage)` 直接兼容 */
  usage: TimeUsageCounts
  /** 记录一次实际使用的到期时刻；可传时间戳或 `'HH:mm'`（对应 DateTimePicker onPickTime） */
  note: (dueAt: number | string | null) => void
  loading: boolean
  error: string | null
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** 校验主进程返回/广播的 timeUsage 值 */
export function normalizeTimeUsage(value: unknown): TimeUsageCounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: TimeUsageCounts = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) result[key] = Math.round(raw)
  }
  return result
}

export function useTimeUsage(): UseTimeUsageResult {
  const [usage, setUsage] = useState<TimeUsageCounts>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const usageRef = useRef<TimeUsageCounts>({})
  const seq = useRef(0)

  useEffect(() => {
    const mySeq = ++seq.current
    let cancelled = false
    window.api.settings
      .get({ key: TIME_USAGE_KEY })
      .then((value) => {
        if (cancelled || mySeq !== seq.current) return
        const next = normalizeTimeUsage(value)
        usageRef.current = next
        setUsage(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled || mySeq !== seq.current) return
        setError(toMessage(err))
      })
      .finally(() => {
        if (cancelled || mySeq !== seq.current) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return window.api.on.settingsChanged(({ key, value }) => {
      if (key !== TIME_USAGE_KEY) return
      const next = normalizeTimeUsage(value)
      usageRef.current = next
      setUsage(next)
    })
  }, [])

  const note = useCallback((dueAt: number | string | null) => {
    const single = noteTimeUsage(usageRef.current, dueAt)
    if (single === usageRef.current) return
    // 把 {count,last} 摊平为设置表约定的次数，并把最近使用的时间移到末尾（近似最近使用顺序）
    const counts: TimeUsageCounts = {}
    for (const [label, entry] of Object.entries(single)) {
      const count =
        typeof entry === 'number' ? entry : entry && typeof entry.count === 'number' ? entry.count : 0
      if (count > 0) counts[label] = count
    }
    const keys = Object.keys(counts)
    if (keys.length > 100) {
      keys.slice(0, keys.length - 100).forEach((key) => {
        delete counts[key]
      })
    }
    usageRef.current = counts
    setUsage(counts)
    window.api.settings
      .set({ key: TIME_USAGE_KEY, value: counts })
      .then(() => setError(null))
      .catch((err: unknown) => setError(toMessage(err)))
  }, [])

  return { usage, note, loading, error }
}
