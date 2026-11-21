/**
 * useSettings · 应用设置读写
 *
 * - 挂载时预取全部 SettingsKey（`settings.get`），未知/失败的键不阻塞其余设置；
 * - 监听 `on.settingsChanged`（主进程写库后广播）保持多窗口一致；
 * - `setSetting` 先本地乐观更新再落库，失败置 error 并重新抛出。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SettingsKey } from '../../../shared/types'

/** 全部设置键（与 src/shared/types.ts 的 SettingsKey 同步；设置面板按此顺序/分组渲染） */
export const SETTINGS_KEYS: SettingsKey[] = [
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

export type SettingsMap = Partial<Record<SettingsKey, unknown>>

export interface UseSettingsResult {
  settings: SettingsMap
  loading: boolean
  error: string | null
  setSetting: (key: SettingsKey, value: unknown) => Promise<void>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<SettingsMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const mySeq = ++seq.current
    let cancelled = false
    Promise.all(
      SETTINGS_KEYS.map(async (key) => {
        try {
          return [key, await window.api.settings.get({ key })] as const
        } catch {
          return [key, undefined] as const
        }
      })
    )
      .then((entries) => {
        if (cancelled || mySeq !== seq.current) return
        const loaded: SettingsMap = {}
        entries.forEach(([key, value]) => {
          if (value !== undefined) loaded[key] = value
        })
        setSettings(loaded)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled || mySeq !== seq.current) return
        setError(toMessage(err))
      })
      .finally(() => {
        if (cancelled || mySeq !== seq.current) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return window.api.on.settingsChanged(({ key, value }) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    })
  }, [])

  const setSetting = useCallback(async (key: SettingsKey, value: unknown): Promise<void> => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    try {
      await window.api.settings.set({ key, value })
      setError(null)
    } catch (err: unknown) {
      setError(toMessage(err))
      throw err
    }
  }, [])

  return { settings, loading, error, setSetting }
}
