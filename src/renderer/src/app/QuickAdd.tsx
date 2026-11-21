/**
 * QuickAdd · 快速添加（520 宽可退化的小窗口，MVP 默认由挂件输入框承担）
 * Contract: docs/04-TECH-DESIGN.md §窗口形态（QuickAdd MVP = 唤起挂件并聚焦输入框）
 * 该视图保留为独立窗口入口：回车保存、Esc 关闭窗口。
 */
import { useEffect, type ReactElement } from 'react'
import { Composer, type ComposerSubmit } from '../components/Composer'
import { useTags, useTimeUsage } from '../hooks'
import { zh } from '../i18n/zh'

export function QuickAdd(): ReactElement {
  const { projects, tags, refresh } = useTags()
  const timeUsage = useTimeUsage()

  useEffect(() => {
    document.documentElement.dataset.view = 'quickadd'
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') window.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = async (draft: ComposerSubmit): Promise<void> => {
    await window.api.tasks.create({
      title: draft.title,
      priority: draft.priority,
      dueAt: draft.dueAt,
      projectId: draft.projectId ?? undefined,
      tagIds: draft.tagIds,
      links: draft.links
    })
    refresh()
    window.close()
  }

  return (
    <div className="quickadd">
      <div className="quickadd-title">{zh.composer.placeholder}</div>
      <Composer
        mode="main"
        projects={projects}
        tags={tags}
        timeUsage={timeUsage.usage}
        onPickTime={(value) => timeUsage.note(value)}
        onSubmit={submit}
        onTagsChanged={refresh}
        placeholder={zh.app.name}
      />
    </div>
  )
}
