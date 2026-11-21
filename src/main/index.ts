/**
 * main · 应用生命周期、单实例锁、--silent 启动
 * Contract: docs/04-TECH-PLAN.md · docs/09-PROJECT-STRUCTURE.md
 */
import { app, BrowserWindow } from 'electron'
import { createWindows, setQuitting, showWidget } from './windows'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showWidget()
  })

  app.on('before-quit', () => {
    setQuitting(true)
  })

  app.on('window-all-closed', () => {
    // 托盘常驻：窗口全部隐藏/关闭后应用继续运行，退出只从托盘触发
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.lazasons.desktoptodo')
    const silent = process.argv.includes('--silent')
    createWindows({ silent })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindows({ silent })
      else showWidget()
    })
  })
}
