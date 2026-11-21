/**
 * 链接打开结果判定（渲染层共享）
 * Contract: docs/03-DATA-MODEL.md §链接 · docs/04-TECH-DESIGN.md links:open
 * 本地路径不存在（missing）与 UNC/网络位置不可达（unreachable）都按「找不到该位置」处理：
 * 两者对用户是同一类失效，统一给出重新选择/删除入口（docs/03 第 127 行）。
 */
import type { OpenResult } from '../../../shared/types'

export function isLinkUnavailable(result: OpenResult): boolean {
  return !result.ok && (result.reason === 'missing' || result.reason === 'unreachable')
}
