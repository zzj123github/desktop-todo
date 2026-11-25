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
 *
 * DOM 必须分两层：外层 .wc 铺满窗口只做定位层，内层 .wc-mac / .wc-win 才是贴边按钮组。
 * 两者写在同一节点时 .wc 的 inset:0 会把 flex 容器撑满整窗，三个灯交叉轴对齐会漂。
 */
import { useEffect, useState, type ReactElement } from 'react'
import type { WindowControlState } from '../../../shared/types'
import { isMacOS } from '../lib/platform'
import { zh } from '../i18n/zh'
import { Icon } from './Icons'

const INITIAL_STATE: WindowControlState = { maximized: false, fullscreen: false }

/** macOS 红绿灯专用 12×12 符号（与 design/proto-v1.6 一致）。
 *  不能复用 Icons 的 24 viewBox：缩进 12px 圆点后笔画过细，绿灯角箭头还会只占一角显得更小。 */
function MacTrafficIcon({ kind }: { kind: 'close' | 'min' | 'max' }): ReactElement {
  const d =
    kind === 'close'
      ? 'M3.4 3.4l5.2 5.2M8.6 3.4L3.4 8.6'
      : kind === 'min'
        ? 'M2.8 6h6.4'
        : 'M3 7.4L7.4 3M3 3h4.4v4.4'
  return (
    <svg className="tl-ic" viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  )
}

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
      <div className="wc">
        <div className={`wc-mac${focused ? '' : ' is-blur'}`} role="group" aria-label={labels.group}>
          <button
            type="button"
            className="tl tl-close"
            title={labels.close}
            aria-label={labels.close}
            onClick={close}
          >
            <MacTrafficIcon kind="close" />
          </button>
          <button
            type="button"
            className="tl tl-min"
            title={labels.minimize}
            aria-label={labels.minimize}
            onClick={minimize}
          >
            <MacTrafficIcon kind="min" />
          </button>
          <button
            type="button"
            className="tl tl-max"
            title={fullscreen ? labels.exitFullscreen : labels.fullscreen}
            aria-label={fullscreen ? labels.exitFullscreen : labels.fullscreen}
            aria-pressed={fullscreen}
            onClick={(event) => {
              // macOS 惯例：单击进全屏，⌥ 单击只缩放（= 最大化），不切空间
              if (event.altKey) toggleMaximize()
              else toggleFullscreen()
            }}
          >
            <MacTrafficIcon kind="max" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wc">
      <div className="wc-win" role="group" aria-label={labels.group}>
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
    </div>
  )
}
