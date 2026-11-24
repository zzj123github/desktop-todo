/**
 * WindowControls · 完整窗口的自绘窗口按钮（最小化 / 最大化 / 关闭）
 *
 * Contract: design/PROPOSAL-v1.6.md（已确认）、docs/02 §窗口按钮、docs/08 §3.14
 *
 * 完整窗口是 frame:false 的自绘窗口，没有系统标题栏，所以这三个按钮只能由渲染层画、
 * 通过 preload 的 window.api.window.* 让主进程执行。位置与样式按平台区分：
 * - Windows：窗口右上角 46×32 直角按钮组，关闭悬停红底白叉；
 * - macOS：窗口左上角 12px 红绿灯，悬停才显示符号，⌥ 单击绿灯走缩放而不是全屏。
 *
 * 挂件 / 胶囊 / 编辑弹窗没有窗口按钮（无任务栏位置，形态切换已有入口）。
 */
import { useEffect, useState, type ReactElement } from 'react'
import type { WindowControlState } from '../../../shared/types'
import { isMacOS } from '../lib/platform'
import { zh } from '../i18n/zh'
import { Icon } from './Icons'

const INITIAL_STATE: WindowControlState = { maximized: false, fullscreen: false }

export function WindowControls(): ReactElement {
  const mac = isMacOS()
  const [state, setState] = useState<WindowControlState>(INITIAL_STATE)
  // macOS 红绿灯失焦变灰是系统行为；窗口没有焦点时同步这个外观
  const [focused, setFocused] = useState(true)

  useEffect(() => {
    let alive = true
    void window.api.window
      .getState()
      .then((next) => {
        if (alive) setState(next)
      })
      .catch(() => {
        // 拿不到状态时保持初始值：按钮仍可用，图标停在「最大化」
      })
    const off = window.api.window.onStateChange((next) => setState(next))
    const onFocus = (): void => setFocused(true)
    const onBlur = (): void => setFocused(false)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      alive = false
      off()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const labels = zh.windowControls
  // Windows 的按钮跟随最大化；macOS 绿灯只跟随全屏（⌥ 缩放不改变绿灯语义与外观）
  const maximized = state.maximized
  const fullscreen = state.fullscreen
  const minimize = (): void => void window.api.window.minimize()
  const toggleMaximize = (): void => void window.api.window.toggleMaximize()
  const toggleFullscreen = (): void => void window.api.window.toggleFullscreen()
  const close = (): void => window.close()

  if (mac) {
    return (
      <div className={`wc wc-mac${focused ? '' : ' is-blur'}`} role="group" aria-label={labels.group}>
        <button
          type="button"
          className="tl tl-close"
          title={labels.close}
          aria-label={labels.close}
          onClick={close}
        >
          <Icon name="x" size={12} strokeWidth={1.2} />
        </button>
        <button
          type="button"
          className="tl tl-min"
          title={labels.minimize}
          aria-label={labels.minimize}
          onClick={minimize}
        >
          <Icon name="minus" size={12} strokeWidth={1.2} />
        </button>
        <button
          type="button"
          className="tl tl-max"
          title={fullscreen ? labels.exitFullscreen : labels.fullscreen}
          aria-label={fullscreen ? labels.exitFullscreen : labels.fullscreen}
          aria-pressed={fullscreen}
          onClick={(event) => {
            // macOS 惯例：单击进全屏，⌥ 单击只缩放（= 最大化），不切 Space
            if (event.altKey) toggleMaximize()
            else toggleFullscreen()
          }}
        >
          <Icon name="window-expand" size={12} strokeWidth={1.2} />
        </button>
      </div>
    )
  }

  return (
    <div className="wc wc-win" role="group" aria-label={labels.group}>
      <button
        type="button"
        className="wcb"
        title={labels.minimize}
        aria-label={labels.minimize}
        onClick={minimize}
      >
        <Icon name="window-min" size={10} strokeWidth={1} />
      </button>
      <button
        type="button"
        className="wcb"
        title={maximized ? labels.restore : labels.maximize}
        aria-label={maximized ? labels.restore : labels.maximize}
        aria-pressed={maximized}
        onClick={toggleMaximize}
      >
        <Icon name={maximized ? 'window-restore' : 'window-max'} size={10} strokeWidth={1} />
      </button>
      <button
        type="button"
        className="wcb wcb-close"
        title={labels.close}
        aria-label={labels.close}
        onClick={close}
      >
        <Icon name="x" size={10} strokeWidth={1} />
      </button>
    </div>
  )
}
