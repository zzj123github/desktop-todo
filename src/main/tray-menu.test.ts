/**
 * 托盘菜单模板与 tooltip 文案测试（纯函数）
 * Contract: docs/04-TECH-PLAN.md §托盘、docs/01-PRD.md FR-5、docs/07-ACCEPTANCE.md F
 */
import { describe, expect, it, vi } from 'vitest'
import { buildTrayMenuTemplate, formatTrayTooltip } from './tray-menu'

function deps(overrides: Partial<Parameters<typeof buildTrayMenuTemplate>[0]> = {}) {
  const actions = {
    toggleWidget: vi.fn(),
    showWidget: vi.fn(),
    showManager: vi.fn(),
    setLaunchAtLogin: vi.fn(),
    quit: vi.fn()
  }
  return { widgetVisible: true, loginChecked: false, actions, ...overrides }
}

describe('buildTrayMenuTemplate', () => {
  it('菜单顺序与文案符合 docs/04：显示/隐藏挂件、快速添加、打开完整窗口、开机自启、退出', () => {
    const template = buildTrayMenuTemplate(deps())
    expect(template.map((item) => (item.type === 'separator' ? 'separator' : item.label))).toEqual([
      '隐藏挂件',
      '快速添加',
      '打开完整窗口',
      'separator',
      '开机自启',
      'separator',
      '退出'
    ])
  })

  it('挂件隐藏时首项文案为「显示挂件」', () => {
    const template = buildTrayMenuTemplate(deps({ widgetVisible: false }))
    expect(template[0].label).toBe('显示挂件')
  })

  it('开机自启项是 checkbox 且勾选态跟随系统登录项', () => {
    const on = buildTrayMenuTemplate(deps({ loginChecked: true }))
    const item = on.find((entry) => entry.label === '开机自启')
    expect(item?.type).toBe('checkbox')
    expect(item?.checked).toBe(true)
  })

  it('点击各菜单项调用对应动作', () => {
    const d = deps()
    const template = buildTrayMenuTemplate(d)
    template[0].click?.({})
    template[1].click?.({})
    template[2].click?.({})
    template[6].click?.({})
    expect(d.actions.toggleWidget).toHaveBeenCalledTimes(1)
    expect(d.actions.showWidget).toHaveBeenCalledTimes(1)
    expect(d.actions.showManager).toHaveBeenCalledTimes(1)
    expect(d.actions.quit).toHaveBeenCalledTimes(1)
  })

  it('开机自启点击读取勾选后的新状态', () => {
    const d = deps()
    const template = buildTrayMenuTemplate(d)
    const item = template.find((entry) => entry.label === '开机自启')
    item?.click?.({ checked: true })
    expect(d.actions.setLaunchAtLogin).toHaveBeenCalledWith(true)
    item?.click?.({ checked: false })
    expect(d.actions.setLaunchAtLogin).toHaveBeenLastCalledWith(false)
  })
})

describe('formatTrayTooltip', () => {
  it('显示今天未完成条数', () => {
    expect(formatTrayTooltip(0)).toBe('桌面待办 · 今天 0 项')
    expect(formatTrayTooltip(7)).toBe('桌面待办 · 今天 7 项')
  })

  it('DB 不可用时退化为应用名', () => {
    expect(formatTrayTooltip(null)).toBe('桌面待办')
  })
})
