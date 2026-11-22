/**
 * ViewMenu · 桌面视图下拉（保存/切换/重命名/删除）
 * Contract: docs/01-PRD.md FR-4.3（可保存的桌面视图，挂件与完整窗口共享）· docs/08 §3.5
 * 标题旁下拉；筛选行「保存为桌面视图」复用同一弹层。
 */
import { useRef, useState, type ReactElement } from 'react'
import type { FilterDTO, SavedViewDTO } from '../../../shared/types'
import { Popover } from './Popover'
import { Icon } from './Icons'
import { zh } from '../i18n/zh'

export interface ViewMenuProps {
  views: SavedViewDTO[]
  activeViewId: string | null
  currentFilter: FilterDTO
  filterActive: boolean
  onSelect(view: SavedViewDTO): void
  onSave(name: string, filter: FilterDTO): Promise<void>
  onRename(view: SavedViewDTO, name: string): Promise<void>
  onDelete(view: SavedViewDTO): Promise<void>
  /** 挂件标题旁只显示箭头（design/app-desktop.png：标题行不放文字按钮） */
  compact?: boolean
}

export function ViewMenu({
  views,
  activeViewId,
  currentFilter,
  filterActive,
  onSelect,
  onSave,
  onRename,
  onDelete,
  compact = false
}: ViewMenuProps): ReactElement {
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [mode, setMode] = useState<'list' | 'save' | 'rename'>('list')
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<SavedViewDTO | null>(null)

  // 浮层定位交给 Popover（它自身监听 resize 重算位置）。
  // 注意：不要在这里监听 resize 关闭菜单——挂件打开浮层时窗口会临时加高到 520，
  // resize 会导致菜单刚打开就被关闭（审计发现）。

  const toggle = (): void => {
    if (anchor) {
      setAnchor(null)
      return
    }
    setMode('list')
    setName('')
    setRenaming(null)
    setAnchor(anchorRef.current)
  }

  const submit = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (mode === 'save') await onSave(trimmed, currentFilter)
    if (mode === 'rename' && renaming) await onRename(renaming, trimmed)
    setMode('list')
    setName('')
    setRenaming(null)
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`mtitle-btn${compact ? ' mtitle-btn-icon' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        aria-label={zh.nav.views}
        title={zh.nav.views}
        onClick={toggle}
      >
        {compact ? null : zh.nav.views}
        <Icon name="chevron" size={compact ? 11 : 12} className="mtitle-chev" />
      </button>
      {anchor ? (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="view-menu">
          {mode === 'list' ? (
            <>
              <div className="pop-title">{zh.nav.views}</div>
              <div className="pop-list">
                {views.length === 0 ? <div className="pop-empty">{zh.manager.noViews}</div> : null}
                {views.map((view) => (
                  <div key={view.id} className={`pop-row view-row${view.id === activeViewId ? ' on' : ''}`}>
                    <button
                      type="button"
                      className="view-row-main"
                      onClick={() => {
                        onSelect(view)
                        setAnchor(null)
                      }}
                    >
                      <span className="view-name">{view.name}</span>
                    </button>
                    <button
                      type="button"
                      className="mg-act view-act"
                      title={zh.common.rename}
                      aria-label={`${zh.common.rename}${view.name}`}
                      onClick={() => {
                        setRenaming(view)
                        setName(view.name)
                        setMode('rename')
                      }}
                    >
                      <Icon name="pencil" size={12} />
                    </button>
                    <button
                      type="button"
                      className="mg-act danger view-act"
                      title={zh.common.delete}
                      aria-label={`${zh.common.delete}${view.name}`}
                      onClick={() => void onDelete(view)}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="pop-foot">
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={!filterActive}
                  title={filterActive ? undefined : zh.filter.noFilterToSave}
                  onClick={() => {
                    setName('')
                    setMode('save')
                  }}
                >
                  <Icon name="plus" size={12} />
                  {zh.filter.saveView}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="pop-title">{mode === 'save' ? zh.filter.saveView : zh.common.rename}</div>
              <div className="view-form">
                <input
                  className="text-input"
                  autoFocus
                  maxLength={30}
                  value={name}
                  placeholder={zh.manager.viewNamePlaceholder}
                  aria-label={mode === 'save' ? zh.filter.saveView : zh.common.rename}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void submit()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      event.stopPropagation()
                      setMode('list')
                    }
                  }}
                />
              </div>
              <div className="pop-foot">
                <button type="button" className="ghost-btn" onClick={() => setMode('list')}>
                  {zh.common.cancel}
                </button>
                <button type="button" className="btn-pri btn-mini" onClick={() => void submit()}>
                  {zh.common.save}
                </button>
              </div>
            </>
          )}
        </Popover>
      ) : null}
    </>
  )
}
