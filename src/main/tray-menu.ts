/**
 * 托盘菜单模板 · 纯函数（不 import electron，便于单测）
 *
 * Contract: docs/04-TECH-PLAN.md §托盘 · docs/01-PRD.md FR-5
 * 菜单项（从上到下）：显示/隐藏挂件、快速添加、打开完整窗口、分隔线、
 *                    开机自启（勾选）、分隔线、退出。
 * Tooltip：`桌面待办 · 今天 N 项`；DB 不可用时退化为「桌面待办」。
 *
 * 平台文案：macOS 的登录项叫「登录时启动」而不是「开机自启」；
 * 未传 platform 时按 Windows 文案输出，保证原有测试与行为不变。
 */

export interface TrayMenuItem {
  type?: 'separator' | 'checkbox'
  label?: string
  checked?: boolean
  click?: (item: { checked?: boolean }) => void
}

export interface TrayMenuDeps {
  widgetVisible: boolean
  loginChecked: boolean
  /** 运行平台；仅用于菜单文案（darwin 与 Windows 表述不同），默认按 Windows 处理 */
  platform?: NodeJS.Platform
  actions: {
    toggleWidget: () => void
    showWidget: () => void
    showManager: () => void
    setLaunchAtLogin: (enabled: boolean) => void
    quit: () => void
  }
}

/** 构建托盘右键菜单模板（顺序/文案/勾选态由 docs/04 与 FR-5 固定） */
export function buildTrayMenuTemplate(deps: TrayMenuDeps): TrayMenuItem[] {
  const { actions } = deps
  const isMac = deps.platform === 'darwin'
  return [
    {
      label: deps.widgetVisible ? '隐藏挂件' : '显示挂件',
      click: () => actions.toggleWidget()
    },
    {
      label: '快速添加',
      click: () => actions.showWidget()
    },
    {
      label: '打开完整窗口',
      click: () => actions.showManager()
    },
    { type: 'separator' },
    {
      label: isMac ? '登录时启动' : '开机自启',
      type: 'checkbox',
      checked: deps.loginChecked,
      click: (item) => actions.setLaunchAtLogin(item.checked === true)
    },
    { type: 'separator' },
    {
      label: isMac ? '退出桌面待办' : '退出',
      click: () => actions.quit()
    }
  ]
}

/** 托盘 tooltip 文案；pending 为今天未完成条数 */
export function formatTrayTooltip(pending: number | null): string {
  if (pending === null) return '桌面待办'
  return `桌面待办 · 今天 ${pending} 项`
}
