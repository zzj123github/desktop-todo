/**
 * useTags · 标签 / 项目列表（TagListsDTO）
 *
 * - 只经 `window.api.tags.list()` 取数；
 * - 同时监听 `on.tasksChanged`：pendingCount（未完成数）随任务变化，需要跟着刷新；
 * - 请求序号防旧响应覆盖；出错保留上次列表并置 error。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TagDTO } from '../../../shared/types'

export interface UseTagsResult {
  tags: TagDTO[]
  projects: TagDTO[]
  loading: boolean
  error: string | null
  refresh: () => void
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useTags(): UseTagsResult {
  const [tags, setTags] = useState<TagDTO[]>([])
  const [projects, setProjects] = useState<TagDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const seq = useRef(0)

  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    const mySeq = ++seq.current
    let cancelled = false
    setLoading(true)
    window.api.tags
      .list()
      .then((lists) => {
        if (cancelled || mySeq !== seq.current) return
        setTags(lists.tags)
        setProjects(lists.projects)
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

  useEffect(() => {
    return window.api.on.tasksChanged(() => refresh())
  }, [refresh])

  return { tags, projects, loading, error, refresh }
}
