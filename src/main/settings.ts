/**
 * settings · settings 表读写、默认值、窗口 bounds 记忆
 * Contract: docs/03-DATA-MODEL.md §6 · docs/04-TECH-PLAN.md §3.2
 */
import type { SettingsKey } from '../shared/types'
import { getDb } from './db'

export type WindowBoundsKey = 'widgetBounds' | 'capsuleBounds' | 'managerBounds'

export interface WindowBoundsRecord {
  x: number
  y: number
  width: number
  height: number
  /** screen.getAllDisplays() 的 display.id，用于多显示器恢复 */
  displayId?: number
}

export const SETTINGS_KEYS: readonly SettingsKey[] = [
  'alwaysOnTop',
  'opacity',
  'launchAtLogin',
  'globalShortcuts',
  'lastViewId',
  'widgetBounds',
  'capsuleBounds',
  'managerBounds',
  'capsule',
  'timeUsage'
]

export const WINDOW_BOUNDS_KEYS: readonly WindowBoundsKey[] = [
  'widgetBounds',
  'capsuleBounds',
  'managerBounds'
]

/** docs/03 §6 默认值（timeUsage 见 docs/02 §快捷时间） */
export const DEFAULT_SETTINGS: Readonly<Record<SettingsKey, unknown>> = {
  alwaysOnTop: true,
  opacity: 1,
  launchAtLogin: false,
  globalShortcuts: true,
  lastViewId: null,
  widgetBounds: null,
  capsuleBounds: null,
  managerBounds: null,
  capsule: false,
  timeUsage: {}
}

/** 允许的透明度档位：100 / 90 / 80 */
export const OPACITY_STEPS: readonly number[] = [1, 0.9, 0.8]

export function isSettingsKey(value: unknown): value is SettingsKey {
  return typeof value === 'string' && (SETTINGS_KEYS as readonly string[]).includes(value)
}

export function isWindowBoundsKey(value: unknown): value is WindowBoundsKey {
  return typeof value === 'string' && (WINDOW_BOUNDS_KEYS as readonly string[]).includes(value)
}

function normalizeOpacity(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 1
  if (numeric >= 0.95) return 1
  if (numeric >= 0.85) return 0.9
  return 0.8
}

function normalizeBounds(value: unknown): WindowBoundsRecord | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const x = record['x']
  const y = record['y']
  const width = record['width']
  const height = record['height']
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }
  const displayId = record['displayId']
  const normalized: WindowBoundsRecord = {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  }
  if (typeof displayId === 'number' && Number.isFinite(displayId)) {
    normalized.displayId = displayId
  }
  return normalized
}

/** timeUsage：{ 'HH:MM': 使用次数 }，只保留有限非负数，最多 100 项 */
function normalizeTimeUsage(value: unknown): Record<string, number> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, number> = {}
  let count = 0
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (count >= 100) break
    const numeric = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0
    if (!numeric) continue
    result[String(key).slice(0, 32)] = Math.round(numeric)
    count += 1
  }
  return result
}

/** 写入前的类型/取值归一化；未知 key 抛错（IPC 层会转成结构化错误） */
export function normalizeSettingValue(key: SettingsKey, value: unknown): unknown {
  switch (key) {
    case 'alwaysOnTop':
    case 'launchAtLogin':
    case 'globalShortcuts':
    case 'capsule':
      return Boolean(value)
    case 'opacity':
      return normalizeOpacity(value)
    case 'lastViewId':
      return value === null || value === undefined || value === '' ? null : String(value)
    case 'widgetBounds':
    case 'capsuleBounds':
    case 'managerBounds':
      return normalizeBounds(value)
    case 'timeUsage':
      return normalizeTimeUsage(value)
    default:
      return value
  }
}

function readRaw(key: SettingsKey): unknown {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  if (!row) return undefined
  try {
    return JSON.parse(row.value) as unknown
  } catch {
    return undefined
  }
}

/** settings:get：缺失或损坏时回落到默认值 */
export function getSetting(key: SettingsKey): unknown {
  if (!isSettingsKey(key)) throw new Error(`未知设置项：${String(key)}`)
  const raw = readRaw(key)
  return raw === undefined ? DEFAULT_SETTINGS[key] : raw
}

export function getBooleanSetting(key: SettingsKey): boolean {
  return Boolean(getSetting(key))
}

export function getNumberSetting(key: SettingsKey): number {
  const value = getSetting(key)
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(DEFAULT_SETTINGS[key])
}

export function getStringSetting(key: SettingsKey): string | null {
  const value = getSetting(key)
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function writeSetting(key: SettingsKey, value: unknown): void {
  const db = getDb()
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, JSON.stringify(normalizeSettingValue(key, value)))
}

/** settings:set：写入并返回归一化后的值（供主进程广播使用） */
export function setSetting(key: SettingsKey, value: unknown): unknown {
  if (!isSettingsKey(key)) throw new Error(`未知设置项：${String(key)}`)
  const normalized = normalizeSettingValue(key, value)
  const db = getDb()
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, JSON.stringify(normalized))
  return normalized
}

/** 读取窗口位置记忆（迁移/导入兼容损坏值） */
export function readBounds(key: WindowBoundsKey): WindowBoundsRecord | null {
  const raw = readRaw(key)
  return normalizeBounds(raw)
}

export function writeBounds(key: WindowBoundsKey, bounds: WindowBoundsRecord | null): void {
  const db = getDb()
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, JSON.stringify(normalizeBounds(bounds)))
}
