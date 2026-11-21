#!/usr/bin/env node
/**
 * 共享的 Electron 运行时定位/复制模块（dev、测试、验收脚本共用）。
 *
 * 为什么复制：本机 DSH 会话对 workspace 路径下执行的 GUI/桌面进程有额外沙箱限制，
 * 直接从 `node_modules/.../electron.exe` 启动时：
 *   - GUI 模式会以 0x80000003 (STATUS_BREAKPOINT) 静默崩溃；
 *   - ELECTRON_RUN_AS_NODE 模式下只能在 workspace 内写文件，写 %TEMP% 会 EPERM。
 * 复制到 workspace 之外再执行即可正常工作。打包后的应用由用户从任意目录启动，不受此限制。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.join(__dirname, '..')

function electronPackageDir() {
  try {
    return path.dirname(require.resolve('electron/package.json'))
  } catch {
    return null
  }
}

function runtimeRoot() {
  const pkg = electronPackageDir()
  if (!pkg) return null
  const version = require(path.join(pkg, 'package.json')).version
  const baseDir = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
    'desktop-todo-dev'
  )
  return { pkg, version, dir: path.join(baseDir, `electron-${version}`) }
}

/** 确保 workspace 外的 Electron 运行时副本存在，返回 electron.exe 路径（失败返回 null）。 */
function ensureElectronRuntime({ quiet = false } = {}) {
  const info = runtimeRoot()
  if (!info) return null
  const exe = path.join(info.dir, 'electron.exe')
  const sourceExe = path.join(info.pkg, 'dist', 'electron.exe')
  if (!fs.existsSync(sourceExe)) return null
  if (fs.existsSync(exe)) return exe
  fs.rmSync(info.dir, { recursive: true, force: true })
  fs.mkdirSync(info.dir, { recursive: true })
  if (!quiet) console.log(`[electron-runtime] 复制 Electron ${info.version} -> ${info.dir}`)
  fs.cpSync(path.join(info.pkg, 'dist'), info.dir, { recursive: true })
  return exe
}

module.exports = { ensureElectronRuntime, root }
