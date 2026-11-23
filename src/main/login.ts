/**
 * 开机/登录自启 · 主进程
 *
 * Contract: docs/04-TECH-PLAN.md §开机自启
 *   Windows：app.setLoginItemSettings({ openAtLogin, path: process.execPath, args: ['--silent'] })
 *   macOS  ：app.setLoginItemSettings({ openAtLogin, openAsHidden })（path/args 仅 Windows 生效）
 *   读取：app.getLoginItemSettings().openAtLogin
 *
 * 说明：
 * - 开机自启默认关闭（settings.launchAtLogin 默认 false，docs/00）。
 * - Windows 带 --silent 启动时只进托盘，不弹挂件（src/main/index.ts 读取 argv）。
 * - macOS 登录项无法传启动参数（path/args 仅 Windows），因此用
 *   `wasOpenedAtLogin` 判断「是否由登录项拉起」→ 静默启动（菜单栏 + Dock 隐藏，不弹挂件）。
 *   `openAsHidden` 在 macOS 13+ 已不可用，仅作为老系统兼容字段传入。
 * - 开发环境 process.execPath 是 electron 可执行文件，注册项只在用户主动开启时写入；
 *   给用户看的文案由托盘菜单/渲染层负责，这里不拼任何界面文案。
 */
import { app } from 'electron'
import { getBooleanSetting, writeSetting } from './settings'
import { broadcast } from './windows'

/** 开机自启时附加的启动参数（Windows，见 docs/04 §单实例/启动） */
export const SILENT_ARG = '--silent'

interface LoginItemOptions {
  path: string
  args: string[]
}

function isMacOS(): boolean {
  return process.platform === 'darwin'
}

function loginItemOptions(): LoginItemOptions {
  return { path: process.execPath, args: [SILENT_ARG] }
}

/** 读取系统开机自启的当前状态（用于托盘勾选态） */
export function isLoginItemEnabled(): boolean {
  try {
    // macOS 不认 path/args，传空选项即可；Windows 仍按可执行文件路径查询
    return app.getLoginItemSettings(isMacOS() ? undefined : loginItemOptions()).openAtLogin
  } catch {
    return false
  }
}

/** 仅写系统登录项，不写 settings（settings 与系统项由 setLaunchAtLogin 保持一致） */
export function applyLaunchAtLogin(enabled: boolean): void {
  try {
    if (isMacOS()) {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        // macOS 12 及更早可用；macOS 13+ 由系统 SMAppService 管理，字段被忽略
        openAsHidden: enabled
      })
      return
    }
    app.setLoginItemSettings({
      openAtLogin: enabled,
      ...loginItemOptions()
    })
  } catch (error) {
    console.warn('[login] 写入开机自启登录项失败：', error instanceof Error ? error.message : error)
  }
}

/**
 * 是否由系统登录项拉起（macOS）。
 * 用于 macOS 静默启动：登录启动时不弹挂件，只留菜单栏图标（Windows 走 --silent 参数）。
 */
export function wasLaunchedAtLogin(): boolean {
  if (!isMacOS()) return false
  try {
    const settings = app.getLoginItemSettings()
    return Boolean(settings.wasOpenedAtLogin || settings.wasOpenedAsHidden)
  } catch {
    return false
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
