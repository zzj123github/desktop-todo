/**
 * 托盘 · 主进程
 *
 * Contract: docs/04-TECH-PLAN.md §托盘 · docs/01-PRD.md FR-5
 * 菜单项（从上到下）：显示/隐藏挂件、快速添加、打开完整窗口、分隔线、
 *                    开机自启（勾选）、分隔线、退出。
 * Tooltip：`桌面待办 · 今天 N 项`（微信任务=未完成且 due_at < 明天 0 点）。
 *
 * 关闭窗口只隐藏进托盘（windows.ts 已处理），退出走菜单/托盘 → app.quit()。
 */
import { app, Menu, Tray, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { MenuItemConstructorOptions, NativeImage } from 'electron'
import { buildTrayMenuTemplate, formatTrayTooltip } from './tray-menu'
import { countTodayPending } from './repo/tasks'
import { getBooleanSetting } from './settings'
import { isLoginItemEnabled, setLaunchAtLogin } from './login'
import {
  getManagerWindow,
  getWidgetWindow,
  isWidgetVisible,
  showManager,
  showWidget,
  toggleWidget
} from './windows'

let tray: Tray | null = null
let tooltipTimer: NodeJS.Timeout | null = null
let lastTooltip = ''

/**
 * 托盘图标候选路径：
 * - packaged：extraResources 把 build/tray.ico 复制到 resources/tray.ico（electron-builder.yml）；
 * - dev：直接读仓库 build/tray.ico；
 * - 其余候选保留为回退，最终失败由 createTray 用 app.getFileIcon(process.execPath) 兜底。
 */
function iconCandidates(): string[] {
  const appPath = app.getAppPath()
  const packaged: string[] = [join(process.resourcesPath, 'tray.ico')]
  const dev: string[] = [join(appPath, 'build', 'tray.ico')]
  const fallbacks: string[] = [
    join(appPath, 'build', 'tray.ico'),
    join(process.resourcesPath, 'build', 'tray.ico'),
    join(__dirname, '../../build/tray.ico'),
    join(appPath, 'build', 'icon.ico'),
    join(process.resourcesPath, 'build', 'icon.ico'),
    join(__dirname, '../../build/icon.ico')
  ]
  return app.isPackaged ? [...packaged, ...dev, ...fallbacks] : [...dev, ...packaged, ...fallbacks]
}

function loadTrayIcon(): NativeImage | null {
  for (const candidate of iconCandidates()) {
    try {
      if (!existsSync(candidate)) continue
      const image = nativeImage.createFromPath(candidate)
      if (!image.isEmpty()) return image
    } catch {
      // 继续尝试下一个候选路径
    }
  }
  return null
}

function tooltipText(): string {
  try {
    return formatTrayTooltip(countTodayPending())
  } catch {
    // DB 尚未打开/已关闭：只显示标题
    return formatTrayTooltip(null)
  }
}

function menuItems(): MenuItemConstructorOptions[] {
  return buildTrayMenuTemplate({
    widgetVisible: isWidgetVisible(),
    loginChecked: (() => {
      try {
        return isLoginItemEnabled()
      } catch {
        return getBooleanSetting('launchAtLogin')
      }
    })(),
    actions: {
      toggleWidget,
      showWidget,
      showManager,
      setLaunchAtLogin,
      quit: () => app.quit()
    }
  }) as unknown as MenuItemConstructorOptions[]
}

function updateTooltip(): void {
  if (!tray || tray.isDestroyed()) return
  const text = tooltipText()
  if (text === lastTooltip) return
  lastTooltip = text
  try {
    tray.setToolTip(text)
  } catch {
    // 托盘已销毁
  }
}

/** 更新 tooltip 与（下次弹出的）菜单内容；ipc.ts 在任务写操作后也会调用 */
export function refreshTray(): void {
  updateTooltip()
}

export function getTray(): Tray | null {
  return tray
}

export function createTray(): Tray | null {
  if (tray && !tray.isDestroyed()) return tray
  const icon = loadTrayIcon()
  // Tray 必须拿到非空图片；打包后 build/ 缺失时的 FileIcon 回退见下
  tray = icon ? new Tray(icon) : new Tray(nativeImage.createEmpty())
  lastTooltip = ''
  updateTooltip()

  if (!icon) {
    void app
      .getFileIcon(process.execPath, { size: 'small' })
      .then((image) => {
        if (tray && !tray.isDestroyed() && !image.isEmpty()) tray.setImage(image)
      })
      .catch(() => {
        // 回退失败时保留空图标，仅日志提示（M6 打包阶段补 extraResources）
        console.warn('[tray] 未找到托盘图标资源，打包配置需补 build/tray.ico')
      })
  }

  // 动态菜单：每次右键时构建，保证「显示/隐藏挂件」「开机自启」勾选态最新
  tray.on('right-click', () => {
    if (!tray || tray.isDestroyed()) return
    updateTooltip()
    tray.popUpContextMenu(Menu.buildFromTemplate(menuItems()))
  })

  // Windows 习惯：单击切换挂件，双击打开完整窗口
  tray.on('click', () => {
    toggleWidget()
    updateTooltip()
  })
  tray.on('double-click', () => {
    showManager()
  })

  // 每分钟对账一次（逾期=按时间戳，tooltip 需要跟随时间变化）
  if (tooltipTimer) clearInterval(tooltipTimer)
  tooltipTimer = setInterval(() => {
    updateTooltip()
  }, 60_000)
  if (typeof tooltipTimer.unref === 'function') tooltipTimer.unref()

  return tray
}

export function destroyTray(): void {
  if (tooltipTimer) {
    clearInterval(tooltipTimer)
    tooltipTimer = null
  }
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = null
  lastTooltip = ''
}

/** 托盘菜单/快捷键点击后用于把焦点带回窗口（托盘在 Windows 上不抢焦点） */
export function focusWidgetFromTray(): void {
  const widget = getWidgetWindow()
  const manager = getManagerWindow()
  if (widget && !widget.isDestroyed() && widget.isVisible()) {
    widget.focus()
    return
  }
  if (manager && !manager.isDestroyed() && manager.isVisible()) {
    manager.focus()
    return
  }
  showWidget()
}
