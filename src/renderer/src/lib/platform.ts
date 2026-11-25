/**
 * platform · 运行平台判断
 * Contract: src/shared/types.ts §DesktopTodoApi.platform · docs/08-UI-ENGINEERING-SPEC.md §4
 * 平台由 preload 通过 contextBridge 同步注入（window.api.platform），渲染层在 preload 之后执行，
 * 模块初始化时读一次即可（运行中不会变化）。
 * 非 Electron 环境（单测 node / api 缺失）安全回退 'win32'：Windows 文案保持默认值。
 */
import type { DesktopPlatform } from '../../../shared/types'

/** 无 window 或 preload 未注入时的回退平台：保持原有 Windows 文案 */
const FALLBACK_PLATFORM: DesktopPlatform = 'win32'

function readPlatform(): DesktopPlatform {
  if (typeof window === 'undefined') return FALLBACK_PLATFORM
  return window.api?.platform ?? FALLBACK_PLATFORM
}

/** 当前运行平台（模块初始化时确定的快照） */
export const platform: DesktopPlatform = readPlatform()

/** 是否 macOS（⌘/⌥/⇧ 快捷键、菜单栏、登录时启动等文案按此切换） */
export function isMacOS(): boolean {
  return platform === 'darwin'
}
