/**
 * useNow · 每分钟刷新的“当前时间”（驱动相对时间文案、逾期状态、顶栏日期）
 *
 * - 对齐到下一个本地分钟边界触发（不是固定 60s 漂移），跨日、跨月由 Date 自然处理；
 * - 窗口重新可见 / 获得焦点时立刻重新取样，避免系统休眠后文案停在旧时间；
 * - 只读当前时间，不写状态到全局；各视图可各用一个实例（开销极小）。
 */
import { useEffect, useState } from 'react'

const MIN_TICK_MS = 250

/** 下一个本地分钟边界（毫秒偏移，加 20ms 余量确保 setNow 时已过边界） */
function msToNextMinute(now: number): number {
  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setMinutes(next.getMinutes() + 1)
  return Math.max(MIN_TICK_MS, next.getTime() - now + 20)
}

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const tick = (): void => {
      if (cancelled) return
      const current = Date.now()
      setNow(current)
      timer = setTimeout(tick, msToNextMinute(current))
    }

    const resync = (): void => {
      if (cancelled) return
      setNow(Date.now())
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(tick, msToNextMinute(Date.now()))
    }

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') resync()
    }

    timer = setTimeout(tick, msToNextMinute(now))
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', resync)

    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', resync)
    }
    // now 只用于首次排程；后续由 tick 自行续排
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return now
}
