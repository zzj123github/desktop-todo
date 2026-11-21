/**
 * SettingsModal · 设置弹窗
 * Contract: docs/01-PRD.md FR-6 · docs/08-UI-ENGINEERING-SPEC.md · design/app-settings-manage.png
 *
 * 分区：置顶 / 失焦透明度 / 开机自启 / 全局快捷键 / 数据目录 / 备份导入导出 / 项目与标签 / 关于。
 * 所有文案来自 i18n/zh.ts；设置值由父级 useSettings() 持有，本组件只派发 onSet(key, value)。
 */
import { useState, type ReactElement } from 'react'
import type { AppInfo, SettingsKey } from '../../../shared/types'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { zh } from '../i18n/zh'

export interface SettingsModalProps {
  settings: Partial<Record<SettingsKey, unknown>>
  appInfo: AppInfo | null
  onSet: (key: SettingsKey, value: unknown) => void
  /** 打开项目与标签管理弹窗；scope=all 表示全部 */
  onOpenManage: (scope: 'all' | 'project' | 'tag') => void
  onClose: () => void
  /** 导入等会改写任务数据的操作完成后通知父级刷新 */
  onDataChanged: () => void
}

interface OpacityOption {
  value: number
  label: string
}

const OPACITY_OPTIONS: OpacityOption[] = [
  { value: 1, label: '100%' },
  { value: 0.9, label: '90%' },
  { value: 0.8, label: '80%' }
]

/** 把任意来源的透明度值吸附到 100/90/80 档位（与主进程 settings 归一化口径一致） */
function normalizeOpacity(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 1
  if (numeric >= 0.95) return 1
  if (numeric >= 0.85) return 0.9
  return 0.8
}

export function SettingsModal({
  settings,
  appInfo,
  onSet,
  onOpenManage,
  onClose,
  onDataChanged
}: SettingsModalProps): ReactElement {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [importConfirm, setImportConfirm] = useState(false)

  const alwaysOnTop = settings.alwaysOnTop !== false
  const launchAtLogin = settings.launchAtLogin === true
  const globalShortcuts = settings.globalShortcuts !== false
  const opacity = normalizeOpacity(settings.opacity)

  const runDataAction = async (action: () => Promise<boolean>): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  const openDataDir = (): void => {
    void runDataAction(async () => {
      const result = await window.api.app.openDataDir()
      if (!result.ok) showToast(zh.common.error)
      return result.ok
    })
  }

  const exportData = (): void => {
    void runDataAction(async () => {
      const result = await window.api.app.exportData()
      if (result.ok) {
        showToast(zh.settings.exportOk)
        return true
      }
      if (!result.canceled) showToast(zh.common.error)
      return false
    })
  }

  const requestImport = (): void => {
    if (busy) return
    /* 导入会整体覆盖本地数据（docs/01 FR-6.2）：用项目内确认弹窗，不用系统 confirm */
    setImportConfirm(true)
  }

  const importData = (): void => {
    if (busy) return
    setImportConfirm(false)
    void runDataAction(async () => {
      const result = await window.api.app.importData()
      if (result.ok) {
        showToast(zh.settings.importOk(result.count ?? 0))
        onDataChanged()
        return true
      }
      if (!result.canceled) showToast(zh.common.error)
      return false
    })
  }

  const renderSwitch = (key: SettingsKey, on: boolean, label: string): ReactElement => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onSet(key, !on)}
    />
  )

  const footer = (
    <>
      <span className="spacer" />
      <Button variant="primary" onClick={onClose}>
        {zh.settings.done}
      </Button>
    </>
  )

  return (
    <>
    <Modal title={zh.settings.title} onClose={onClose} footer={footer} closeLabel={zh.common.close}>
      <div className="set-row">
        <div className="set-main">
          <div className="set-name">{zh.settings.alwaysOnTop}</div>
          <div className="set-desc">{zh.settings.alwaysOnTopDesc}</div>
        </div>
        {renderSwitch('alwaysOnTop', alwaysOnTop, zh.settings.alwaysOnTop)}
      </div>

      <div className="set-row">
        <div className="set-main">
          <div className="set-name">{zh.settings.opacity}</div>
          <div className="set-desc">{zh.settings.opacityDesc}</div>
        </div>
        <div className="seg-mini" role="group" aria-label={zh.settings.opacity}>
          {OPACITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={opacity === option.value ? 'on' : undefined}
              aria-pressed={opacity === option.value}
              onClick={() => onSet('opacity', option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="set-row">
        <div className="set-main">
          <div className="set-name">{zh.settings.launchAtLogin}</div>
          <div className="set-desc">{zh.settings.launchAtLoginDesc}</div>
        </div>
        {renderSwitch('launchAtLogin', launchAtLogin, zh.settings.launchAtLogin)}
      </div>

      <div className="set-row">
        <div className="set-main">
          <div className="set-name">{zh.settings.shortcuts}</div>
          <div className="set-desc">{zh.settings.shortcutsDesc}</div>
        </div>
        {renderSwitch('globalShortcuts', globalShortcuts, zh.settings.shortcuts)}
      </div>

      <div className="set-row">
        <div className="set-main">
          <div className="set-name">{zh.settings.manageScope}</div>
          <div className="set-desc">{zh.settings.manageScopeDesc}</div>
        </div>
        <Button variant="secondary" onClick={() => onOpenManage('all')}>
          {zh.settings.manage}
        </Button>
      </div>

      <div className="set-row">
        <div className="set-main">
          <div className="set-name">{zh.settings.dataDir}</div>
          <div className="set-desc set-desc-path" title={appInfo?.dataDir ?? undefined}>
            {appInfo?.dataDir ?? zh.common.loading}
          </div>
        </div>
        <Button variant="secondary" onClick={openDataDir} disabled={busy}>
          {zh.settings.openDataDir}
        </Button>
      </div>

      <div className="set-row">
        <div className="set-main">
          <div className="set-name">{zh.settings.data}</div>
          <div className="set-desc">
            {zh.settings.exportHint} · {zh.settings.importHint}
          </div>
        </div>
        <div className="set-actions">
          <Button variant="secondary" onClick={exportData} disabled={busy}>
            {zh.settings.exportData}
          </Button>
          <Button variant="secondary" onClick={requestImport} disabled={busy}>
            {zh.settings.importData}
          </Button>
        </div>
      </div>

      <div className="set-row">
        <div className="set-main">
          <div className="set-name">{zh.settings.about}</div>
          <div className="set-desc">
            {appInfo ? zh.settings.aboutVersion(appInfo.version) : zh.common.loading}
          </div>
          <div className="set-desc">
            {`Electron ${appInfo?.electron ?? '—'} · Chrome ${appInfo?.chrome ?? '—'} · Node ${
              appInfo?.node ?? '—'
            }`}
          </div>
        </div>
      </div>
    </Modal>
    {importConfirm ? (
      <Modal
        title={zh.settings.importConfirmTitle}
        size="confirm"
        role="alertdialog"
        onClose={() => setImportConfirm(false)}
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={() => setImportConfirm(false)}>
              {zh.common.cancel}
            </Button>
            <Button variant="danger" onClick={importData}>
              {zh.settings.importConfirmAction}
            </Button>
          </>
        }
      >
        <div className="cf-warn">
          <div className="cf-warn-tx">
            <p>{zh.settings.importConfirmBody}</p>
          </div>
        </div>
      </Modal>
    ) : null}
    </>
  )
}
