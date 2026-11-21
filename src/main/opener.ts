/**
 * opener · 链接类型识别与安全打开（网页 / 本地文件与文件夹）
 * Contract: docs/03-DATA-MODEL.md §5 · docs/04-TECH-PLAN.md §5.1 · docs/07-ACCEPTANCE.md E
 *
 * 安全规则：
 * - 只允许 http/https 与绝对本地路径（盘符 / UNC）；
 * - file:、javascript:、data:、vbscript:、cmd:、powershell: 等一律拒绝；
 * - 相对路径、%ENV% 变量、其他协议（mailto: 等）返回 unsupported；
 * - 本地路径先 fs.access（800ms 超时）再 shell.openPath，失效返回 missing / unreachable。
 */
import { shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { LinkKind, OpenReason, OpenResult } from '../shared/types'

const ACCESS_TIMEOUT_MS = 800
const HTTP_RE = /^https?:\/\//i
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/
const DRIVE_RE = /^[a-zA-Z]:[\\/]/
const UNC_RE = /^\\\\[^\\]/
const FORWARD_UNC_RE = /^\/\/[^/]/
const CYGWIN_RE = /^\/cygdrive\/[a-zA-Z]\//
const ENV_RE = /^%[^%]+%/
const BLOCKED_SCHEMES = new Set([
  'javascript',
  'data',
  'vbscript',
  'cmd',
  'powershell',
  'ms-script',
  'mshta'
])

export interface TargetClassification {
  /** 识别出的链接类型；null 表示拒绝保存/打开 */
  kind: LinkKind | null
  /** 规范化后的 target（本地路径统一反斜杠、URL 原样、裸域名补 https://） */
  target: string
  reason?: OpenReason
}

function stripQuotes(input: string): string {
  let value = input.trim()
  // 去成对的首尾引号（中英文引号都处理），最多两层
  for (let i = 0; i < 2; i += 1) {
    const first = value[0]
    const last = value[value.length - 1]
    const pairs: Record<string, string> = {
      '"': '"',
      "'": "'",
      '“': '”',
      '‘': '’',
      '「': '」',
      '『': '』'
    }
    if (first && last && value.length >= 2 && pairs[first] && pairs[first] === last) {
      value = value.slice(1, -1).trim()
    } else {
      break
    }
  }
  return value
}

/** 本地路径规范化：去引号、反斜杠统一、path.win32.normalize；保留 UNC */
export function normalizeLocalPath(input: string): string {
  let value = stripQuotes(input)
  if (CYGWIN_RE.test(value)) {
    value = value.replace(/^\/cygdrive\/([a-zA-Z])\//, (_match, drive: string) => `${drive.toUpperCase()}:\\`)
  }
  value = value.replace(/\//g, '\\')
  return path.win32.normalize(value)
}

/** UNC / 盘符绝对路径判断（正斜杠、反斜杠、/cygdrive 都算） */
export function isAbsoluteLocalPath(input: string): boolean {
  const value = stripQuotes(input)
  return (
    DRIVE_RE.test(value) ||
    UNC_RE.test(value) ||
    FORWARD_UNC_RE.test(value) ||
    CYGWIN_RE.test(value)
  )
}

function hasFileExtension(normalizedPath: string): boolean {
  const base = path.win32.basename(normalizedPath)
  return /\.[A-Za-z0-9]{1,8}$/.test(base)
}

/** 本地路径按「结尾分隔符 / 是否有扩展名」推断 folder 或 file */
export function classifyLocalKind(input: string): LinkKind {
  const raw = stripQuotes(input)
  if (/[\\/]$/.test(raw)) return 'folder'
  const normalized = normalizeLocalPath(raw)
  return hasFileExtension(normalized) ? 'file' : 'folder'
}

function looksLikeBareDomain(value: string): boolean {
  if (/\s/.test(value)) return false
  if (!/^[a-zA-Z0-9]/.test(value)) return false
  const host = value.split(/[/?#]/, 1)[0] ?? ''
  const labels = host.split('.')
  if (labels.length < 2) return false
  const tld = labels[labels.length - 1] ?? ''
  if (!/^[a-zA-Z]{2,}$/.test(tld)) return false
  if (labels.some((label) => label.length === 0)) return false
  // 只有 1 个点时要求带路径/查询，避免把 report.docx 当成域名
  return labels.length >= 3 || /[/?#]/.test(value)
}

/**
 * 识别用户输入/拖拽的内容：
 * - 裸域名自动补 https://（docs/03 §5）；
 * - file: 返回 unsupported（不可保存为链接），危险协议返回 blocked；
 * - 相对路径 / 环境变量返回 unsupported。
 */
export function classifyTarget(input: string): TargetClassification {
  const raw = stripQuotes(typeof input === 'string' ? input : '')
  if (!raw) return { kind: null, target: '', reason: 'unsupported' }
  if (ENV_RE.test(raw)) return { kind: null, target: raw, reason: 'unsupported' }

  if (isAbsoluteLocalPath(raw)) {
    return { kind: classifyLocalKind(raw), target: normalizeLocalPath(raw) }
  }

  const schemeMatch = SCHEME_RE.exec(raw)
  if (schemeMatch) {
    const scheme = (schemeMatch[1] ?? '').toLowerCase()
    if (scheme === 'http' || scheme === 'https') {
      return { kind: 'url', target: raw }
    }
    if (BLOCKED_SCHEMES.has(scheme)) return { kind: null, target: raw, reason: 'blocked' }
    return { kind: null, target: raw, reason: 'unsupported' }
  }

  if (looksLikeBareDomain(raw)) {
    return { kind: 'url', target: `https://${raw}` }
  }

  return { kind: null, target: raw, reason: 'unsupported' }
}

/** 默认显示名：网页取 hostname，文件/文件夹取 basename（文件去扩展名） */
export function defaultDisplayName(target: string, kind: LinkKind): string {
  if (kind === 'url') {
    try {
      return new URL(target).hostname
    } catch {
      return target
    }
  }
  const normalized = normalizeLocalPath(target).replace(/[\\/]+$/, '')
  const base = path.win32.basename(normalized)
  if (kind === 'file') {
    const withoutExt = base.replace(/\.[A-Za-z0-9]{1,8}$/, '')
    return withoutExt || base || target
  }
  return base || target
}

type AccessCheck = 'ok' | 'missing' | 'unreachable'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function checkLocalPath(target: string): Promise<AccessCheck> {
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      fs.access(target),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('__access_timeout__')), ACCESS_TIMEOUT_MS)
      })
    ])
    return 'ok'
  } catch (error) {
    if (messageOf(error) === '__access_timeout__') return 'unreachable'
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'missing'
    return 'unreachable'
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * 打开链接（http/https 或本地绝对路径）；成功才应更新 last_checked_at。
 * 不做危险协议打开，不阻塞 UI（UNC 超时走 800ms 上限）。
 */
export async function openLink(target: string, kind?: LinkKind): Promise<OpenResult> {
  const classification = classifyTarget(target)
  const resolvedTarget = classification.target || stripQuotes(typeof target === 'string' ? target : '')
  const resolvedKind = classification.kind ?? kind ?? null
  if (!resolvedKind || !classification.kind) {
    return {
      ok: false,
      reason: classification.reason ?? 'unsupported',
      target: resolvedTarget
    }
  }

  if (resolvedKind === 'url') {
    if (!HTTP_RE.test(resolvedTarget)) {
      return { ok: false, reason: 'unsupported', target: resolvedTarget }
    }
    try {
      await shell.openExternal(resolvedTarget)
      return { ok: true, target: resolvedTarget }
    } catch (error) {
      return { ok: false, reason: 'shell', error: messageOf(error), target: resolvedTarget }
    }
  }

  const access = await checkLocalPath(resolvedTarget)
  if (access === 'missing') return { ok: false, reason: 'missing', target: resolvedTarget }
  if (access === 'unreachable') return { ok: false, reason: 'unreachable', target: resolvedTarget }

  try {
    const error = await shell.openPath(resolvedTarget)
    if (error) return { ok: false, reason: 'shell', error, target: resolvedTarget }
    return { ok: true, target: resolvedTarget }
  } catch (error) {
    return { ok: false, reason: 'shell', error: messageOf(error), target: resolvedTarget }
  }
}
