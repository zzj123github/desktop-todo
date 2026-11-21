/**
 * useTasks · 任务列表数据源（挂件 / 完整窗口 / 胶囊共用）
 *
 * - 只经 `window.api`（preload 白名单）取数，不 import electron / main 源码；
 * - 监听 `on.tasksChanged` 自动刷新（主进程在增删改后广播）；
 * - 用请求序号丢弃乱序响应：筛选快速切换时旧响应不会覆盖新结果；
 * - 出错时 `error` 有值、`loading` 归 false，并保留上一次成功的列表，避免界面闪空。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FilterDTO, TaskDTO } from '../../../shared/types'

export interface UseTasksResult {
  tasks: TaskDTO[]
  loading: boolean
  error: string | null
  refresh: () => void
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useTasks(filter: FilterDTO, viewId?: string | null): UseTasksResult {
  // 父组件每次渲染都可能新建 filter 对象；用序列化内容作为依赖，内容不变就不重新取数
  const filterKey = useMemo(() => JSON.stringify(filter), [filter])
  const view = viewId ?? null
  const [tasks, setTasks] = useState<TaskDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const seq = useRef(0)

  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    const mySeq = ++seq.current
    let cancelled = false
    setLoading(true)
    window.api.tasks
      .list({ filter, viewId: view ?? undefined })
      .then((list) => {
        if (cancelled || mySeq !== seq.current) return
        setTasks(list)
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
    // filter 用 filterKey 表达（父组件会重建对象）；filter 本身由 key 覆盖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, view, reloadToken])

  useEffect(() => {
    return window.api.on.tasksChanged(() => refresh())
  }, [refresh])

  return { tasks, loading, error, refresh }
}
