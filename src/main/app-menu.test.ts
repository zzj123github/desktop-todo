/**
 * macOS 应用菜单模板测试（纯函数）
 * Contract: docs/04-TECH-PLAN.md §窗口 · docs/09-PROJECT-STRUCTURE.md §6.1
 *
 * 重点：
 * - 「编辑」菜单必须包含 undo/redo/cut/copy/paste/selectAll 标准 role，
 *   否则 macOS 输入框里 ⌘C/⌘V/⌘A/⌘Z 不生效；
 * - 应用菜单必须有关于/隐藏/退出；窗口菜单有最小化/缩放/关闭与两个窗口入口。
 */
import { describe, expect, it, vi } from 'vitest'
import { buildApplicationMenuTemplate } from './app-menu'

function topLabels(template: ReturnType<typeof buildApplicationMenuTemplate>): string[] {
  return template.map((menu) => menu.label ?? '')
}

function submenuOf(
  template: ReturnType<typeof buildApplicationMenuTemplate>,
  label: string
): Array<{ role?: string; label?: string; type?: string; click?: () => void }> {
  const menu = template.find((entry) => entry.label === label)
  return (menu?.submenu ?? []) as Array<{ role?: string; label?: string; type?: string; click?: () => void }>
}

describe('buildApplicationMenuTemplate', () => {
  it('顶层为 桌面待办 / 编辑 / 窗口', () => {
    expect(topLabels(buildApplicationMenuTemplate())).toEqual(['桌面待办', '编辑', '窗口'])
  })

  it('应用菜单包含关于/隐藏/隐藏其他/显示全部/退出，退出使用 quit role（⌘Q）', () => {
    const appMenu = submenuOf(buildApplicationMenuTemplate(), '桌面待办')
    const roles = appMenu.map((item) => item.role).filter(Boolean)
    expect(roles).toEqual(['about', 'hide', 'hideOthers', 'unhide', 'quit'])
  })

  it('编辑菜单包含 macOS 输入框依赖的标准 role', () => {
    const editMenu = submenuOf(buildApplicationMenuTemplate(), '编辑')
    const roles = editMenu.map((item) => item.role).filter(Boolean)
    expect(roles).toEqual(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'])
  })

  it('窗口菜单包含最小化/缩放/关闭（⌘M/⌘W）与两个窗口入口', () => {
    const deps = { showWidget: vi.fn(), showManager: vi.fn() }
    const windowMenu = submenuOf(buildApplicationMenuTemplate(deps), '窗口')
    const roles = windowMenu.map((item) => item.role).filter(Boolean)
    expect(roles).toEqual(['minimize', 'zoom', 'close'])
    const labels = windowMenu.filter((item) => item.type !== 'separator').map((item) => item.label)
    expect(labels).toContain('显示挂件')
    expect(labels).toContain('打开完整窗口')
  })

  it('点击窗口菜单入口调用对应动作', () => {
    const deps = { showWidget: vi.fn(), showManager: vi.fn() }
    const windowMenu = submenuOf(buildApplicationMenuTemplate(deps), '窗口')
    windowMenu.find((item) => item.label === '显示挂件')?.click?.()
    windowMenu.find((item) => item.label === '打开完整窗口')?.click?.()
    expect(deps.showWidget).toHaveBeenCalledTimes(1)
    expect(deps.showManager).toHaveBeenCalledTimes(1)
  })
})
