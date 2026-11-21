/**
 * useViews · 自定义视图（保存的筛选）列表
 *
 * - `views.list()` 拉取；`save` / `remove` 直接走 window.api 并在成功后刷新列表；
 * - 失败时置 error 并重新抛出，调用方（视图管理弹窗）可据此 toast；
 * - 请求序号防旧响应覆盖。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FilterDTO, SavedViewDTO } from '../../../shared/types'

export interface UseViewsResult {
  views: SavedViewDTO[]
  loading: boolean
  error: string | null
  refresh: () => void
  save: (input: { id?: string; name: string; filter: FilterDTO }) => Promise<SavedViewDTO>
  remove: (id: string) => Promise<{ ok: true }>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useViews(): UseViewsResult {
  const [views, setViews] = useState<SavedViewDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const seq = useRef(0)

  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    const mySeq = ++seq.current
    let cancelled = false
    setLoading(true)
    window.api.views
      .list()
      .then((list) => {
        if (cancelled || mySeq !== seq.current) return
        setViews(list)
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
  }, [reloadToken])

  const save = useCallback(
    async (input: { id?: string; name: string; filter: FilterDTO }): Promise<SavedViewDTO> => {
      try {
        const saved = await window.api.views.save(input)
        setError(null)
        refresh()
        return saved
      } catch (err: unknown) {
        setError(toMessage(err))
        throw err
      }
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string): Promise<{ ok: true }> => {
      try {
        const result = await window.api.views.delete({ id })
        setError(null)
        refresh()
        return result
      } catch (err: unknown) {
        setError(toMessage(err))
        throw err
      }
    },
    [refresh]
  )

  return { views, loading, error, refresh, save, remove }
}
