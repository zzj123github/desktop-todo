/**
 * DateTimePicker · 自绘日期（时间）选择器
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.9 · docs/02-DESIGN-SPEC.md §4
 * 禁用原生 input[type=date]；288 宽、z190；过去时间不可选；快捷时间固定 2 个；Esc 只关选择器。
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement
} from 'react'
import { createPortal } from 'react-dom'
import { anchoredPosition, rectOf } from './anchoredPosition'
import { Icon } from './Icons'
import { zh } from '../i18n/zh'
import {
  addDays,
  dayStart,
  fmtHM,
  monthDay,
  nextSlot,
  quickTimes,
  sameDay,
  weekday,
  type TimeUsageMap
} from '../lib/date'
import { clampScrollTarget, easeOutCubic, normalizeWheelPixels, scrollProgress } from '../lib/scroll'
import { useToast } from './Toast'

export type PickerMode = 'datetime' | 'date'

interface CalendarDay {
  ts: number
  date: number
  out: boolean
  past: boolean
  today: boolean
  selected: boolean
}

/** 时间列表滚轮的单个动画状态（每个 .dp-tl-scroll 一份） */
interface WheelScrollAnim {
  raf: number
  from: number
  target: number
  start: number
}

/** 字段文案：11月25日 周三 09:00 / 11月25日 周三 */
export function formatPickerValue(value: number | null, mode: PickerMode): string {
  if (!value) return mode === 'date' ? zh.datePicker.emptyDate : zh.datePicker.emptyDateTime
  const text = `${monthDay(value)} ${weekday(value)}`
  return mode === 'date' ? text : `${text} ${fmtHM(value)}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function buildMonth(view: Date, selected: number | null, mode: PickerMode, now: number): CalendarDay[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7 // 周一开头
  const start = new Date(view.getFullYear(), view.getMonth(), 1 - offset)
  const todayStart = dayStart(now)
  const days: CalendarDay[] = []
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const ts = date.getTime()
    days.push({
      ts,
      date: date.getDate(),
      out: date.getMonth() !== view.getMonth(),
      past: mode === 'datetime' && dayStart(ts) < todayStart,
      today: sameDay(ts, now),
      selected: selected !== null && sameDay(ts, selected)
    })
  }
  return days
}

export interface DateTimePickerProps {
  mode?: PickerMode
  value: number | null
  onChange: (value: number | null) => void
  /** 快捷时间使用统计（settings.timeUsage） */
  usage?: TimeUsageMap
  /** 每次确认后回调，用于累计 timeUsage */
  onPickTime?: (hhmm: string) => void
  defaultOpen?: boolean
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

export function DateTimePicker({
  mode = 'datetime',
  value,
  onChange,
  usage,
  onPickTime,
  defaultOpen = false,
  disabled = false,
  ariaLabel,
  className
}: DateTimePickerProps): ReactElement {
  const [open, setOpen] = useState(defaultOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`dp-field${value ? '' : ' empty'}${className ? ` ${className}` : ''}`}
        disabled={disabled}
        aria-label={ariaLabel ?? formatPickerValue(value, mode)}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Icon name="calendar" size={13} />
        <span className="dp-field-tx">{formatPickerValue(value, mode)}</span>
        <Icon name="chevron" size={12} />
      </button>
      {open && triggerRef.current ? (
        <DatePickerOverlay
          anchor={triggerRef.current}
          mode={mode}
          value={value}
          usage={usage}
          onPickTime={onPickTime}
          onChange={(next) => {
            onChange(next)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

export interface DatePickerOverlayProps {
  anchor: HTMLElement
  mode?: PickerMode
  value: number | null
  usage?: TimeUsageMap
  onPickTime?: (hhmm: string) => void
  onChange: (value: number | null) => void
  onClose: () => void
}

export function DatePickerOverlay({
  anchor,
  mode = 'datetime',
  value,
  usage,
  onPickTime,
  onChange,
  onClose
}: DatePickerOverlayProps): ReactElement {
  const { showToast } = useToast()
  const now = Date.now()
  const initial = value ?? null
  const [view, setView] = useState<Date>(() => {
    const base = initial ?? now
    const d = new Date(base)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState<number | null>(initial)
  const [hour, setHour] = useState<string>(() => {
    if (initial) return pad2(new Date(initial).getHours())
    return pad2(new Date(nextSlot(now)).getHours())
  })
  const [minute, setMinute] = useState<string>(() => {
    if (initial) return pad2(new Date(initial).getMinutes())
    return pad2(new Date(nextSlot(now)).getMinutes())
  })
  const [timeList, setTimeList] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)
  const listWrapRef = useRef<HTMLDivElement>(null)
  /** 时间列表每列一个缓动动画，滚轮切换时以当前实际位置为新起点 */
  const wheelAnims = useRef(new Map<HTMLElement, WheelScrollAnim>())
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = popRef.current
    if (!el) return
    const place = (): void => {
      const rect = rectOf(anchor)
      const measured = el.getBoundingClientRect()
      const p = anchoredPosition(
        rect,
        measured.width || 288,
        measured.height || 360,
        window.innerWidth,
        window.innerHeight
      )
      setPos({ left: p.left, top: p.top })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor, timeList])

  const selectedToday = selected !== null && sameDay(selected, now)
  const currentHour = Number.parseInt(hour || '0', 10) || 0
  const currentMinute = Number.parseInt(minute || '0', 10) || 0

  const days = useMemo(() => buildMonth(view, selected, mode, now), [view, selected, mode, now])
  const quick = useMemo(() => quickTimes(now, usage ?? {}, 2), [now, usage])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    const onPointer = (event: MouseEvent): void => {
      const target = event.target as Node
      if (popRef.current?.contains(target)) return
      if (anchor.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointer, true)
    }
  }, [anchor, onClose])

  /**
   * 时间列表滚轮平滑滚动（用户 m06992）
   * 原生滚轮一格会把 132px 可视区一次换掉 5 行，没有中间帧，观感像跳变；
   * 这里统一接管：增量归一 → 目标夹取 → rAF ease-out；键盘/滚动条仍走原生。
   */
  useEffect(() => {
    if (!timeList) return
    const wrap = listWrapRef.current
    if (!wrap) return
    const anims = wheelAnims.current
    const stopAll = (): void => {
      anims.forEach((anim) => cancelAnimationFrame(anim.raf))
      anims.clear()
    }
    const reduceMotion = (): boolean =>
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const onWheel = (event: WheelEvent): void => {
      const col = event.target instanceof Element ? event.target.closest('.dp-tl-scroll') : null
      if (!(col instanceof HTMLElement)) return
      event.preventDefault()
      const delta = normalizeWheelPixels(event.deltaY, event.deltaMode, col.clientHeight)
      if (!delta) return
      const maxScroll = col.scrollHeight - col.clientHeight
      const from = col.scrollTop
      const target = clampScrollTarget(from, delta, maxScroll)
      const prev = anims.get(col)
      if (prev) cancelAnimationFrame(prev.raf)
      anims.delete(col)
      if (target === from) return
      if (reduceMotion()) {
        col.scrollTop = target
        return
      }
      const start = performance.now()
      const anim: WheelScrollAnim = { raf: 0, from, target, start }
      const step = (now: number): void => {
        const progress = easeOutCubic(scrollProgress(now - start))
        col.scrollTop = from + (target - from) * progress
        if (progress < 1) {
          anim.raf = requestAnimationFrame(step)
        } else {
          col.scrollTop = target
          if (anims.get(col) === anim) anims.delete(col)
        }
      }
      anim.raf = requestAnimationFrame(step)
      anims.set(col, anim)
    }
    wrap.addEventListener('wheel', onWheel, { passive: false })
    // 拖动滚动条/键盘滚动时让位给原生行为，避免与动画争夺 scrollTop
    wrap.addEventListener('pointerdown', stopAll)
    return () => {
      wrap.removeEventListener('wheel', onWheel)
      wrap.removeEventListener('pointerdown', stopAll)
      stopAll()
    }
  }, [timeList])

  const pickDay = (day: CalendarDay): void => {
    if (day.past) return
    setSelected(day.ts)
    if (mode === 'date') {
      // 日期模式：选完即确认
      onChange(dayStart(day.ts))
      return
    }
    const isToday = sameDay(day.ts, now)
    let h = currentHour
    let m = currentMinute
    if (!selected) {
      const slot = new Date(nextSlot(now))
      h = slot.getHours()
      m = slot.getMinutes()
    }
    if (isToday) {
      const candidate = dayStart(day.ts) + h * 3_600_000 + m * 60_000
      if (candidate <= now) {
        const slot = new Date(nextSlot(now))
        h = slot.getHours()
        m = slot.getMinutes()
      }
    }
    setHour(pad2(h))
    setMinute(pad2(m))
  }

  const pickQuick = (ts: number): void => {
    if (ts <= Date.now()) {
      showToast(zh.datePicker.pastQuick)
      return
    }
    setSelected(dayStart(ts))
    setHour(pad2(new Date(ts).getHours()))
    setMinute(pad2(new Date(ts).getMinutes()))
  }

  const isPastTime = (): boolean => {
    if (mode === 'date') {
      if (!selected) return false
      return dayStart(selected) < dayStart(Date.now())
    }
    const base = dayStart(selected ?? Date.now())
    const ts = base + currentHour * 3_600_000 + currentMinute * 60_000
    return ts <= Date.now()
  }

  const confirm = (): void => {
    if (mode === 'date') {
      if (!selected) return
      onChange(dayStart(selected))
      return
    }
    const day = selected ?? dayStart(Date.now())
    const ts = dayStart(day) + currentHour * 3_600_000 + currentMinute * 60_000
    if (ts <= Date.now()) {
      showToast(zh.datePicker.pastTime)
      return
    }
    onPickTime?.(`${pad2(currentHour)}:${pad2(currentMinute)}`)
    onChange(ts)
  }

  const daysBeforeToday = mode === 'datetime' ? dayStart(now) : Number.NEGATIVE_INFINITY

  const hourDisabled = (h: number): boolean => selectedToday && h < new Date(now).getHours()
  const minuteDisabled = (m: number): boolean =>
    selectedToday &&
    (currentHour < new Date(now).getHours() ||
      (currentHour === new Date(now).getHours() && m < new Date(now).getMinutes()))

  return createPortal(
    <div
      ref={popRef}
      className="dp-pop"
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' } as CSSProperties}
      role="dialog"
      aria-label={mode === 'date' ? zh.datePicker.emptyDate : zh.datePicker.emptyDateTime}
    >
      <div className="dp-head">
        <button
          type="button"
          className="dp-nav prev"
          aria-label={zh.datePicker.prevMonth}
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
        >
          <Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />
        </button>
        <div className="dp-title">
          {view.getFullYear()}
          {zh.datePicker.yearSuffix}
          {view.getMonth() + 1}
          {zh.datePicker.monthSuffix}
        </div>
        <button
          type="button"
          className="dp-nav next"
          aria-label={zh.datePicker.nextMonth}
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
        >
          <Icon name="chevron" size={13} style={{ transform: 'rotate(-90deg)' }} />
        </button>
      </div>
      <div className="dp-week">
        {zh.datePicker.weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="dp-grid">
        {days.map((day) => {
          const cls = ['dp-day']
          if (day.out) cls.push('out')
          if (day.today) cls.push('today')
          if (day.selected) cls.push('sel')
          if (day.past) cls.push('past')
          return (
            <button
              key={day.ts}
              type="button"
              className={cls.join(' ')}
              disabled={day.past}
              aria-disabled={day.past}
              onClick={() => pickDay(day)}
            >
              {day.date}
            </button>
          )
        })}
      </div>
      {mode === 'datetime' ? (
        <div className="dp-time">
          <span className="dp-time-lb">{zh.datePicker.time}</span>
          <input
            className="dp-tinp"
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={hour}
            aria-label={zh.datePicker.hour}
            onChange={(event) => setHour(event.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={() => setHour(pad2(Math.min(23, Number.parseInt(hour || '0', 10) || 0)))}
          />
          <span className="dp-colon">:</span>
          <input
            className="dp-tinp"
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={minute}
            aria-label={zh.datePicker.minute}
            onChange={(event) => setMinute(event.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={() => setMinute(pad2(Math.min(59, Number.parseInt(minute || '0', 10) || 0)))}
          />
          <button
            type="button"
            className={`dp-time-pick${timeList ? ' on' : ''}`}
            title={zh.datePicker.time}
            aria-label={zh.datePicker.time}
            aria-expanded={timeList}
            onClick={() => setTimeList((prev) => !prev)}
          >
            <Icon name="chevron" size={11} style={{ transform: timeList ? 'rotate(180deg)' : undefined }} />
          </button>
          <div className="dp-quickrow">
            {quick.map((ts) => (
              <button key={ts} type="button" className="dp-q" onClick={() => pickQuick(ts)}>
                {fmtHM(ts)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {timeList && mode === 'datetime' ? (
        <div className="dp-timelist" ref={listWrapRef}>
          <div className="dp-tl-col">
            <div className="dp-tl-hd">{zh.datePicker.hour}</div>
            <div className="dp-tl-scroll">
              {Array.from({ length: 24 }, (_, h) => {
                const past = hourDisabled(h)
                return (
                  <button
                    key={h}
                    type="button"
                    className={`dp-tl-item${past ? ' past' : ''}${currentHour === h ? ' on' : ''}`}
                    disabled={past}
                    onClick={() => {
                      setHour(pad2(h))
                      if (selectedToday && h === new Date(now).getHours()) {
                        const minNow = new Date(now).getMinutes()
                        if (Number.parseInt(minute || '0', 10) < minNow) setMinute(pad2(minNow))
                      }
                    }}
                  >
                    {pad2(h)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="dp-tl-col">
            <div className="dp-tl-hd">{zh.datePicker.minute}</div>
            <div className="dp-tl-scroll">
              {Array.from({ length: 60 }, (_, m) => {
                const past = minuteDisabled(m)
                return (
                  <button
                    key={m}
                    type="button"
                    className={`dp-tl-item${past ? ' past' : ''}${currentMinute === m ? ' on' : ''}`}
                    disabled={past}
                    onClick={() => setMinute(pad2(m))}
                  >
                    {pad2(m)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
      <div className="dp-foot">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setSelected(null)
            onChange(null)
          }}
        >
          {zh.datePicker.clear}
        </button>
        <span className="spacer" />
        <button type="button" className="ghost-btn" onClick={onClose}>
          {zh.datePicker.cancel}
        </button>
        <button
          type="button"
          className="btn-sm"
          disabled={isPastTime()}
          aria-disabled={isPastTime()}
          onClick={confirm}
        >
          {zh.datePicker.confirm}
        </button>
      </div>
    </div>,
    document.body
  )
}
