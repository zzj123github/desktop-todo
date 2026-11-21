import { useCallback, useMemo, useState } from 'react'
import type { FilterDTO, FilterDateMode, TagDTO, TaskPriority } from '../../../shared/types'
import {
  activeFilterChips,
  emptyFilter,
  filterCounts,
  isFilterActive,
  removeChip as removeChipFrom,
  setDate as setDateOn,
  type ActiveChip,
  type FilterCounts
} from '../lib/filters'

export type FilterInitializer = FilterDTO | (() => FilterDTO)

export interface UseFilterResult {
  /** 当前筛选条件（不可变） */
  filter: FilterDTO
  /** 整体替换筛选条件 */
  setFilter: (next: FilterDTO) => void
  /** 重置为默认空筛选 */
  reset: () => void
  /** 各维度生效数量与总数（用于筛选行角标） */
  counts: FilterCounts
  /** 是否有任何生效条件 */
  active: boolean
  /** 生成筛选 chip（需要标签表才能显示标签名） */
  chips: (tags: TagDTO[]) => ActiveChip[]
  setStatus: (status: FilterDTO['status']) => void
  setDate: (mode: FilterDateMode, range?: { from?: string; to?: string }) => void
  setKeyword: (keyword: string) => void
  toggleTag: (tagId: string) => void
  togglePriority: (priority: TaskPriority) => void
  removeChip: (key: string) => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : list.concat(value)
}

/**
 * 筛选条件状态容器：跨视图（挂件 / 完整窗口 / 胶囊）复用。
 * 只管理系统状态，不发请求；配合 `useTasks(filter)` 使用。
 */
export function useFilter(initial?: FilterInitializer): UseFilterResult {
  const [filter, setFilterState] = useState<FilterDTO>(() => {
    const value = typeof initial === 'function' ? initial() : initial
    return value ?? emptyFilter()
  })

  const setFilter = useCallback((next: FilterDTO) => {
    setFilterState(next)
  }, [])

  const reset = useCallback(() => {
    setFilterState(emptyFilter())
  }, [])

  const setStatus = useCallback((status: FilterDTO['status']) => {
    setFilterState((prev) => (prev.status === status ? prev : { ...prev, status }))
  }, [])

  const setDate = useCallback(
    (mode: FilterDateMode, range?: { from?: string; to?: string }) => {
      setFilterState((prev) => setDateOn(prev, mode, range))
    },
    []
  )

  const setKeyword = useCallback((keyword: string) => {
    setFilterState((prev) => (prev.keyword === keyword ? prev : { ...prev, keyword }))
  }, [])

  const toggleTag = useCallback((tagId: string) => {
    setFilterState((prev) => ({ ...prev, tagIds: toggle(prev.tagIds, tagId) }))
  }, [])

  const togglePriority = useCallback((priority: TaskPriority) => {
    setFilterState((prev) => ({ ...prev, priorities: toggle(prev.priorities, priority) }))
  }, [])

  const removeChip = useCallback((key: string) => {
    setFilterState((prev) => removeChipFrom(prev, key))
  }, [])

  const counts = useMemo(() => filterCounts(filter), [filter])
  const active = useMemo(() => isFilterActive(filter), [filter])
  const chips = useCallback(
    (tags: TagDTO[]) => activeFilterChips(filter, tags),
    [filter]
  )

  return {
    filter,
    setFilter,
    reset,
    counts,
    active,
    chips,
    setStatus,
    setDate,
    setKeyword,
    toggleTag,
    togglePriority,
    removeChip
  }
}
