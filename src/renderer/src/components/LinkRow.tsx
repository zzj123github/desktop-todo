/**
 * LinkRow · 任务链接行
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §3.12 · docs/03-DATA-MODEL.md §链接
 * 图标按 kind：url→globe / folder→folder / file→file；点击打开；删除按钮 hover 危险色。
 */
import type { ReactElement } from 'react'
import type { LinkDTO } from '../../../shared/types'
import { Icon } from './Icons'
import { zh } from '../i18n/zh'
import { autoLinkTitle } from '../lib/links'

export interface LinkRowProps {
  link: Pick<LinkDTO, 'id' | 'kind' | 'target' | 'display'>
  onOpen?: (link: LinkRowProps['link']) => void
  onRemove?: (link: LinkRowProps['link']) => void
  /** 编辑面板里显示移除；只读场景不传 */
  removable?: boolean
}

const KIND_ICON = { url: 'globe', folder: 'folder', file: 'file' } as const

export function LinkRow({ link, onOpen, onRemove, removable = true }: LinkRowProps): ReactElement {
  const name = link.display || autoLinkTitle(link.target)
  const icon = KIND_ICON[link.kind]
  return (
    <div className="link-row">
      <span className="lr-ic" aria-hidden="true">
        <Icon name={icon} size={12} />
      </span>
      <button
        type="button"
        className="lr-main lr-open"
        onClick={() => onOpen?.(link)}
        aria-label={zh.aria.openLink(name)}
        title={link.target}
      >
        <div className="lr-name">{name}</div>
        <div className="lr-path">{link.target}</div>
      </button>
      {onOpen ? (
        <button
          type="button"
          className="lr-btn"
          aria-label={zh.aria.openLink(name)}
          title={zh.common.open}
          onClick={() => onOpen(link)}
        >
          <Icon name="arrow-up" size={12} style={{ transform: 'rotate(45deg)' }} />
        </button>
      ) : null}
      {removable && onRemove ? (
        <button
          type="button"
          className="lr-btn danger"
          aria-label={zh.aria.removeLink(name)}
          title={zh.common.remove}
          onClick={() => onRemove(link)}
        >
          <Icon name="trash" size={12} />
        </button>
      ) : null}
    </div>
  )
}
