/**
 * App · 渲染层入口：按窗口视图（?view=）渲染挂件 / 胶囊 / 完整窗口 / 快速添加
 * Contract: docs/04-TECH-DESIGN.md §窗口形态 · docs/09-PROJECT-STRUCTURE.md §2.2（同一 bundle，多视图）
 */
import { useEffect, useState, type ReactElement } from 'react'
import { ToastProvider } from '../components/Toast'
import { Widget } from './Widget'
import { Capsule } from './Capsule'
import { Manager } from './Manager'
import { QuickAdd } from './QuickAdd'
import { useSettings } from '../hooks'

export type AppView = 'widget' | 'manager' | 'quickadd'

function readView(): AppView {
  const param = new URLSearchParams(window.location.search).get('view')
  if (param === 'manager' || param === 'quickadd') return param
  return 'widget'
}

function DesktopHost(): ReactElement {
  const { settings } = useSettings()
  const [collapsed, setCollapsed] = useState<boolean>(settings.capsule === true)

  useEffect(() => {
    if (settings.capsule === undefined) return
    setCollapsed(settings.capsule === true)
  }, [settings.capsule])

  useEffect(() => {
    return window.api.on.widgetCollapsed((payload) => setCollapsed(payload.collapsed))
  }, [])

  useEffect(() => {
    const mode = collapsed ? 'capsule' : 'widget'
    document.documentElement.dataset.view = mode
    document.documentElement.className = `view-${mode}`
  }, [collapsed])

  return collapsed ? <Capsule /> : <Widget />
}

export function App(): ReactElement {
  const [view] = useState<AppView>(() => readView())

  useEffect(() => {
    document.documentElement.dataset.view = view
    document.documentElement.className = `view-${view}`
  }, [view])

  return (
    <ToastProvider>
      {view === 'manager' ? <Manager /> : view === 'quickadd' ? <QuickAdd /> : <DesktopHost />}
    </ToastProvider>
  )
}
