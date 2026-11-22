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
import { registerIpcHandlers } from './ipc'
import { initNotices, postNotice } from './notices'
import { syncLaunchAtLogin } from './login'
import { runSeed } from './seed'
import { disposeShortcuts, setupShortcuts } from './shortcuts'
import { createTray, destroyTray } from './tray'
import {
  closeNoticeWindow,
  createNoticeWindow,
  createWindows,
  flushWindowBounds,
  getManagerWindow,
  getWidgetWindow,
  isNoticeWindowLoaded,
  sendNoticeToWindow,
  setQuitting,
  showWidget
} from './windows'

const APP_USER_MODEL_ID = 'com.lazasons.desktoptodo'

/**
 * 渲染策略：默认关闭硬件加速（docs/07 §H 内存指标）。
 *
 * 本机实测（Win11 26200 / AMD GPU / ANGLE D3D11 / 175% DPI，打包版）：
 *   硬件合成：GPU 进程 private 常驻约 114 MB（仅挂件）～244 MB（含完整窗口），
 *             含完整窗口时 6 个进程 private 合计约 416 MB，超出 300 MB 目标；
 *   软件合成：GPU 进程 private 约 27 MB，挂件+完整窗口+弹窗合计约 220 MB，
 *             文本、圆角、阴影视觉一致，空闲 CPU 10s 仅 0.02s。
 * 透明挂件窗口 + 本机 GPU 合成的固定开销是主要来源，因此默认走软件合成。
 * 需要硬件加速时设置环境变量 DESKTOP_TODO_GPU=1（用于对比或高刷场景）。
 */
function applyRenderingPolicy(): void {
  if (process.env.DESKTOP_TODO_GPU === '1') return
  app.disableHardwareAcceleration()
}

applyRenderingPolicy()

/** 是否带 --silent（开机自启静默进托盘） */
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function reportFatal(message: string, error?: unknown): void {
  const detail = error instanceof Error ? error.message : error === undefined ? '' : String(error)
  console.error(`[main] ${message}${detail ? `：${detail}` : ''}`)
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

  // 应用内提示：独立提示窗口 + 自建 NoticeModal（原生 dialog 仅作兜底）
  initNotices({
    openWindow: createNoticeWindow,
    closeWindow: closeNoticeWindow,
    isLoaded: isNoticeWindowLoaded,
    send: sendNoticeToWindow,
    showFallback: (options) => {
      void dialog
        .showMessageBox({
          type: options.type,
          title: options.title,
          message: options.message,
          detail: options.detail,
          buttons: ['知道了'],
          defaultId: 0,
          cancelId: 0,
          noLink: true
        })
        .catch((error) => reportFatal('无法弹出兜底提示框', error))
    }
  })

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
      // 数据库彻底打不开：提示用户本次运行的数据无法保存（getInfo 里也会带 dbHealthy/dbError）
      const detail = result.error ?? getDbError() ?? undefined
      setTimeout(() => {
        postNotice({
          kind: 'error',
          title: '数据文件不可用',
          message: '数据库无法打开，本次运行的数据不会保存。',
          hint: detail,
          acknowledgeLabel: '知道了'
        })
      }, 800)
    } else if (result.error) {
      // 损坏后自动重建成功：告知备份位置，避免用户以为数据凭空消失
      setTimeout(() => {
        postNotice({
          kind: 'warning',
          title: '数据文件已重建',
          message: '原数据文件无法打开，已备份为 data.db.bak 并新建空数据库。',
          hint: result.error,
          acknowledgeLabel: '知道了'
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
