/**
 * macOS 平台能力封装 · 主进程
 *
 * Contract: docs/04-TECH-PLAN.md §窗口/§托盘 · docs/09-PROJECT-STRUCTURE.md §6.1
 *
 * 桌面待办在 macOS 上以「桌面挂件 + 菜单栏图标」为主入口，完整窗口按需打开：
 * - Dock：默认隐藏（不占 Dock、不进 Cmd+Tab），只有完整窗口可见时才显示；
 * - 激活：从全局快捷键/菜单栏图标唤起窗口时，macOS 需要先把应用激活，
 *   再给窗口焦点，否则窗口会显示但收不到键盘输入；
 * - 其余平台（Windows/Linux）调用这些函数时全部是 no-op，保持现有行为。
 */
import { app } from 'electron'

export function isMacOS(): boolean {
  return process.platform === 'darwin'
}

/** 显示 Dock 图标（完整窗口可见期间使用，让应用可被 Cmd+Tab 切回） */
export function showDock(): void {
  if (!isMacOS()) return
  try {
    app.dock?.show()
  } catch {
    // Dock 不可用（异常环境）时忽略，不影响窗口
  }
}

/** 隐藏 Dock 图标（只留桌面挂件/胶囊与菜单栏图标） */
export function hideDock(): void {
  if (!isMacOS()) return
  try {
    app.dock?.hide()
  } catch {
    // 同上
  }
}

/**
 * 把应用激活到前台（macOS）。
 * 全局快捷键唤起挂件、菜单栏图标打开窗口时使用；放在 win.show()/focus() 之前调用。
 */
export function activateApp(): void {
  if (!isMacOS()) return
  try {
    app.focus({ steal: true })
  } catch {
    // 激活失败时窗口仍会显示，只是可能不在前台
  }
}
