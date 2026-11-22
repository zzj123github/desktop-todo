/**
 * EditorWindowHost · 任务编辑弹窗宿主（?view=editor）
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.8 · design/app-editor.png · Lead m04418
 *
 * 挂件只有 352 宽，502 wide 的编辑面板塞进挂件会被裁切（原型是桌面级弹窗）。
 * 主进程为此创建一个独立的透明窗口（src/main/windows.ts openEditorWindow），本组件在
 * 该窗口里渲染同一个 EditorModal（embedded 模式：不画遮罩、原地渲染），并把内容高度
 * 上报给主进程（editor:ready），由主进程按高度居中。
 *
 * 关闭路径：X / 取消 / Esc / 保存 / 删除 → editor.close()（主进程销毁窗口），
 * 挂件与桌面形态保持原样。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { EditorModal } from '../components/EditorModal'
import { useTags, useTimeUsage } from '../hooks'
import type { FilterDTO, TaskDTO } from '../../../shared/types'

const ALL_FILTER: FilterDTO = {
  status: 'all',
  date: { mode: 'any' },
  tagIds: [],
  priorities: [],
  keyword: ''
}

function readTaskId(): string | null {
  const value = new URLSearchParams(window.location.search).get('task')
  return value && value !== '' ? value : null
}

export function EditorWindowHost(): ReactElement {
  const taskId = useMemo(readTaskId, [])
  const { projects, tags, refresh: refreshTags } = useTags()
  const timeUsage = useTimeUsage()

  const [task, setTask] = useState<TaskDTO | null>(null)
  const [loaded, setLoaded] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)

  const close = useCallback((): void => {
    void window.api.editor.close()
  }, [])

  // 取任务详情：主进程没有单条查询通道，按全量列表查找（挂件同样持有全量）
  const refreshTask = useCallback((): void => {
    window.api.tasks
      .list({ filter: ALL_FILTER })
      .then((list) => {
        const found = taskId ? (list.find((item) => item.id === taskId) ?? null) : null
        setTask(found)
        setLoaded(true)
      })
      .catch(() => close())
  }, [taskId, close])

  useEffect(() => {
    if (!taskId) {
      setLoaded(true)
      return
    }
    refreshTask()
    return window.api.on.tasksChanged(refreshTask)
  }, [taskId, refreshTask])

  // 任务在别处被删除时（编辑中），关闭弹窗
  useEffect(() => {
    if (loaded && taskId && !task) close()
  }, [loaded, taskId, task, close])

  // 内容高度上报：主进程按高度重排并居中（窗口本身不滚动）
  useEffect(() => {
    const el = hostRef.current
    if (!el || !loaded) return
    let frame = 0
    const report = (): void => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      if (height > 0) void window.api.editor.ready({ height })
    }
    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(report)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(el)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [loaded])

  return (
    <div className="editor-window-host" ref={hostRef}>
      {loaded && (task || !taskId) ? (
        <EditorModal
          embedded
          task={task}
          projects={projects}
          tags={tags}
          timeUsage={timeUsage.usage}
          onPickTime={(value) => timeUsage.note(value)}
          onClose={close}
          onSaved={() => close()}
          onDeleted={() => close()}
          onTagsChanged={refreshTags}
        />
      ) : null}
    </div>
  )
}
