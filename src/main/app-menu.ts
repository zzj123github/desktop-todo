/**
 * macOS 应用菜单 · 主进程
 *
 * Contract: docs/04-TECH-PLAN.md §窗口/§托盘 · docs/09-PROJECT-STRUCTURE.md §6.1
 *
 * Windows/Linux 保持现状（无边框窗口 + 自绘界面，不设置应用菜单）；macOS 必须显式设置
 * 应用菜单，否则：① 输入框里 ⌘C/⌘V/⌘A/⌘Z 不生效（系统依赖「编辑」菜单的 role）；
 * ② 没有 ⌘Q/⌘W/⌘M 与「关于/隐藏」等标准项。
 *
 * 菜单只做标准 role + 两个窗口入口，不重复托盘菜单的全部功能：
 *   桌面待办（关于 / 隐藏 / 隐藏其他 / 显示全部 / 退出）
 *   编辑（撤销 / 重做 / 剪切 / 复制 / 粘贴 / 全选）
 *   窗口（最小化 / 缩放 / 关闭 / 显示挂件 / 打开完整窗口）
 */
import { app, Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { showManager, showWidget } from './windows'

/** 菜单里两个自定义窗口入口（测试可注入替身，避免依赖真实窗口） */
export interface AppMenuActions {
  showWidget: () => void
  showManager: () => void
}

/** 构建 macOS 应用菜单模板（纯函数，便于单测；不读窗口状态） */
export function buildApplicationMenuTemplate(
  actions: AppMenuActions = { showWidget, showManager }
): MenuItemConstructorOptions[] {
  return [
    {
      label: '桌面待办',
      submenu: [
        { role: 'about', label: '关于桌面待办' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏桌面待办' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出桌面待办' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { role: 'close', label: '关闭' },
        { type: 'separator' },
        { label: '显示挂件', click: () => actions.showWidget() },
        { label: '打开完整窗口', click: () => actions.showManager() }
      ]
    }
  ]
}

/**
 * 安装 macOS 应用菜单并设置「关于」面板文案；非 macOS 平台不做任何事，
 * 保持 Windows 现有行为（默认菜单不显示、也不影响 Ctrl 快捷键）。
 */
export function installApplicationMenu(actions: AppMenuActions = { showWidget, showManager }): void {
  if (process.platform !== 'darwin') return
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildApplicationMenuTemplate(actions)))
  app.setAboutPanelOptions({
    applicationName: '桌面待办',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright © 2026 lazasons'
  })
}
