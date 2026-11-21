import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'

const view = new URLSearchParams(window.location.search).get('view') ?? 'widget'
document.documentElement.dataset.view = view

function FirstLight(): React.JSX.Element {
  return (
    <div className={view === 'manager' ? 'boot-manager' : 'boot-widget'}>
      <div className="boot-title">桌面待办</div>
      <div className="boot-sub">{view === 'manager' ? '完整窗口 · M0 骨架' : '桌面挂件 · M0 骨架'}</div>
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <FirstLight />
  </StrictMode>
)
