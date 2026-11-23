/**
 * 链接打开结果判定（渲染层共享）
 * Contract: docs/03-DATA-MODEL.md §链接 · docs/04-TECH-DESIGN.md links:open
 * 本地路径不存在（missing）与 UNC/网络位置不可达（unreachable）都按「找不到该位置」处理：
 * 两者对用户是同一类失效，统一给出重新选择/删除入口（docs/03 第 127 行）。
 *
 * 平台口径：识别复用 parseQuick.detectLink；platform 参数默认取运行环境
 * （preload 注入的 window.api.platform，Node 单测回退 win32），macOS 下按 POSIX 语义识别绝对路径，
 * 与主进程 src/main/opener.ts 保持一致（渲染层先拦下的输入必须能被主进程保存/打开）。
 */
import type { DesktopPlatform, LinkKind, OpenResult } from '../../../shared/types'
import { detectLink } from './parseQuick'

export function isLinkUnavailable(result: OpenResult): boolean {
  return !result.ok && (result.reason === 'missing' || result.reason === 'unreachable')
}

/**
 * 链接自动标题（用户反馈 #2：链接标题可编辑，留空时回退自动标题）
 * 规则与 docs/03 的链接识别一致：URL 去协议后截 44 字、路径取最后一段。
 * 识别失败（如 javascript: 等被拒绝的输入）时退回原始文本，保证总有可读标题。
 * platform 默认取运行环境；显式传入用于单测两平台同跑。
 */
export function autoLinkTitle(target: string, platform?: DesktopPlatform): string {
  const trimmed = target.trim()
  if (!trimmed) return ''
  return detectLink(trimmed, platform)?.display || trimmed
}

/**
 * 添加/编辑链接时的输入解析（用户 m06711：添加时可直接填标题，编辑时可改地址）。
 * 地址必填且必须能识别；标题可选，留空回退自动标题，超长截断 120。
 * platform 默认取运行环境（macOS 下接受 /Users/... 等 POSIX 路径），可由调用方注入。
 */
export function parseLinkInput(
  target: string,
  title = '',
  platform?: DesktopPlatform
): { kind: LinkKind; target: string; display: string } | null {
  const trimmedTarget = target.trim()
  if (!trimmedTarget) return null
  const detected = detectLink(trimmedTarget, platform)
  if (!detected) return null
  const trimmedTitle = title.trim().slice(0, 120)
  return { kind: detected.kind, target: detected.target, display: trimmedTitle || detected.display }
}
