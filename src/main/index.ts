/**
 * 主进程入口 · 桌面待办
 *
 * 启动顺序（docs/04-TECH-PLAN.md §启动流程）：
 *   单实例锁 → app ready → 打开 SQLite（损坏自动 .bak 重建）→ 注册 IPC
 *   → 创建窗口 → 托盘 → 全局快捷键 → 开机自启对账
 *
 * 特殊参数：
 *   --silent  开机自启：只进托盘，不显示挂件
 *   --seed    导入演示数据后退出（pnpm seed / scripts/seed.cjs）
 */
import { app, dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import { checkpoint, closeDatabase, getDbError, isDbHealthy, openDatabase } from './db'
import { getIpcParentWindow, registerIpcHandlers } from './ipc'
import { syncLaunchAtLogin } from './login'
import { runSeed } from './seed'
import { disposeShortcuts, setupShortcuts } from './shortcuts'
import { createTray, destroyTray } from './tray'
import {
  createWindows,
  flushWindowBounds,
  getManagerWindow,
  getWidgetWindow,
  setQuitting,
  showWidget
} from './windows'

const APP_USER_MODEL_ID = 'com.lazasons.desktoptodo'

/** 是否带 --silent（开机自启静默进托盘） */
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function reportFatal(message: string, error?: unknown): void {
  const detail = error instanceof Error ? error.message : error === undefined ? '' : String(error)
  console.error(`[main] ${message}${detail ? `：${detail}` : ''}`)
}

function showMessageBoxSafe(options: {
  type: 'info' | 'warning' | 'error'
  title: string
  message: string
  detail?: string
}): void {
  const parent: BrowserWindow | null = getIpcParentWindow() ?? null
  void (parent && !parent.isDestroyed()
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options)
  ).catch((error) => reportFatal('无法弹出提示框', error))
}

/** --seed：导入演示数据后退出，不创建任何窗口 */
function runSeedMode(): void {
  const result = openDatabase()
  if (!result.healthy || !isDbHealthy()) {
    reportFatal('种子导入失败，数据库不可用', result.error ?? getDbError())
    closeDatabase()
    app.exit(1)
    return
  }
  try {
    const seeded = runSeed()
    console.log(
      `[seed] 已导入 ${seeded.count} 条任务、${seeded.tags} 个标签、${seeded.views} 个视图 → ${result.dbPath}`
    )
    closeDatabase()
    app.exit(0)
  } catch (error) {
    reportFatal('种子导入失败', error)
    closeDatabase()
    app.exit(1)
  }
}

function bootstrap(): void {
  app.setAppUserModelId(APP_USER_MODEL_ID)

  const silent = hasFlag('--silent')
  const seedMode = hasFlag('--seed')

  if (seedMode) {
    runSeedMode()
    return
  }

  const result = openDatabase()
  if (!result.healthy) {
    reportFatal('数据库不可用', result.error ?? getDbError())
  }

  try {
    syncLaunchAtLogin()
  } catch (error) {
    reportFatal('同步开机自启状态失败', error)
  }

  try {
    registerIpcHandlers()
  } catch (error) {
    reportFatal('注册 IPC 失败', error)
  }

  try {
    createWindows({ silent })
  } catch (error) {
    reportFatal('创建窗口失败', error)
  }

  try {
    createTray()
  } catch (error) {
    reportFatal('创建托盘失败', error)
  }

  try {
    setupShortcuts({ notify: !silent })
  } catch (error) {
    reportFatal('注册全局快捷键失败', error)
  }

  if (!silent) {
    if (!result.healthy) {
      // 数据库彻底打不开：提示用户数据无法保存（getInfo 里也会带 dbHealthy/dbError）
      setTimeout(() => {
        showMessageBoxSafe({
          type: 'error',
          title: '数据文件不可用',
          message: '数据库无法打开，本次运行的数据不会保存。',
          detail: result.error ?? getDbError() ?? undefined
        })
      }, 800)
    } else if (result.error) {
      // 损坏后自动重建成功：告知备份位置，避免用户以为数据凭空消失
      setTimeout(() => {
        showMessageBoxSafe({
          type: 'warning',
          title: '数据文件已重建',
          message: '原数据文件无法打开，已备份为 data.db.bak 并新建空数据库。',
          detail: result.error
        })
      }, 800)
    }
  }

  app.on('activate', () => {
    const widget = getWidgetWindow()
    const manager = getManagerWindow()
    if (!widget && !manager) createWindows({ silent })
    else showWidget()
  })
}

// 单实例：第二次启动只唤起已有实例的挂件
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    try {
      showWidget()
    } catch (error) {
      reportFatal('二次启动唤起挂件失败', error)
    }
  })

  app.on('before-quit', () => {
    try {
      setQuitting(true)
      flushWindowBounds()
      checkpoint()
    } catch (error) {
      reportFatal('退出前保存窗口位置失败', error)
    }
    try {
      closeDatabase()
    } catch (error) {
      reportFatal('退出前关闭数据库失败', error)
    }
  })

  app.on('will-quit', () => {
    try {
      disposeShortcuts()
    } catch (error) {
      reportFatal('退出前释放快捷键失败', error)
    }
    try {
      destroyTray()
    } catch (error) {
      reportFatal('退出前销毁托盘失败', error)
    }
  })

  // 关窗只隐藏进托盘（windows.ts 已拦截 close），因此不在此退出应用
  app.on('window-all-closed', () => {
    /* 常驻托盘 */
  })

  app
    .whenReady()
    .then(() => {
      bootstrap()
    })
    .catch((error) => {
      reportFatal('应用启动失败', error)
      app.quit()
    })
}
