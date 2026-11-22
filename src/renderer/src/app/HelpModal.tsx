/**
 * HelpModal · 使用说明
 * Contract: docs/01-PRD.md FR-6 / docs/02-DESIGN-SPEC.md §4 · docs/08-UI-ENGINEERING-SPEC.md §3.8
 * 入口：完整窗口侧栏 footer「使用说明」（在「设置」之上）。
 * 只读说明弹窗：复用 Modal（wide），只允许 X / 知道了 / Esc 关闭，点遮罩不关闭。
 * 文案全部来自 i18n/zh.ts 的 help 分组（docs/08 §4）。
 */
import type { ReactElement } from 'react'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { zh } from '../i18n/zh'

export interface HelpModalProps {
  onClose: () => void
}

export function HelpModal({ onClose }: HelpModalProps): ReactElement {
  return (
    <Modal
      title={zh.help.title}
      size="wide"
      onClose={onClose}
      closeLabel={zh.common.close}
      footer={
        <>
          <span className="spacer" />
          <Button variant="primary" onClick={onClose}>
            {zh.help.close}
          </Button>
        </>
      }
    >
      <div className="help-body">
        {zh.help.sections.map((section) => (
          <section key={section.title} className="help-section">
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
