/**
 * 开机自启 · 主进程
 *
 * Contract: docs/04-TECH-PLAN.md §开机自启
 *   app.setLoginItemSettings({ openAtLogin, path: process.execPath, args: ['--silent'] })
 *   app.getLoginItemSettings().openAtLogin
 *
 * 说明：
 * - 开机自启默认关闭（settings.launchAtLogin 默认 false，docs/00）。
 * - 带 --silent 启动时只进托盘，不弹挂件（src/main/index.ts 读取 argv）。
 * - 开发环境 process.execPath 是 electron.exe，注册项只在用户主动开启时写入；
 *   给用户看的文案由托盘菜单/渲染层负责，这里不拼任何界面文案。
 */
import { app } from 'electron'
import { getBooleanSetting, writeSetting } from './settings'
import { broadcast } from './windows'

/** 开机自启时附加的启动参数（见 docs/04 §单实例/启动） */
export const SILENT_ARG = '--silent'

interface LoginItemOptions {
  path: string
  args: string[]
}

function loginItemOptions(): LoginItemOptions {
  return { path: process.execPath, args: [SILENT_ARG] }
}

/** 读取系统开机自启的当前状态（用于托盘勾选态） */
export function isLoginItemEnabled(): boolean {
  try {
    return app.getLoginItemSettings(loginItemOptions()).openAtLogin
  } catch {
    return false
  }
}

/** 仅写系统登录项，不写 settings（settings 与系统项由 setLaunchAtLogin 保持一致） */
export function applyLaunchAtLogin(enabled: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      ...loginItemOptions()
    })
  } catch (error) {
    console.warn('[login] 写入开机自启登录项失败：', error instanceof Error ? error.message : error)
  }
}

/**
 * 托盘菜单勾选/设置页写入后调用：系统项 + settings 双写，并通知所有窗口。
 * settings:changed 由这里广播，避免调用方各自重复广播。
 */
export function setLaunchAtLogin(enabled: boolean): void {
  applyLaunchAtLogin(enabled)
  writeSetting('launchAtLogin', enabled)
  broadcast('settings:changed', { key: 'launchAtLogin', value: enabled })
}

/** 启动时轻量对账：以 settings 为准同步系统登录项（不广播，避免启动期噪音） */
export function syncLaunchAtLogin(): void {
  applyLaunchAtLogin(getBooleanSetting('launchAtLogin'))
}
