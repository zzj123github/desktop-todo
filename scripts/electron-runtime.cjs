#!/usr/bin/env node
/**
 * 共享的 Electron 运行时定位/复制模块（dev、测试、验收脚本共用）。
 *
 * Windows（本机 DSH 会话）对 workspace 路径下执行 GUI/桌面进程有额外沙箱限制，
 * 直接从 `node_modules/.../electron.exe` 启动时：
 *   - GUI 模式会以 0x80000003 (STATUS_BREAKPOINT) 静默崩溃；
 *   - ELECTRON_RUN_AS_NODE 模式下只能在 workspace 内写文件，写 %TEMP% 会 EPERM。
 * 因此 Windows 下把 dist 复制到 workspace 之外再执行。
 *
 * macOS：Electron 的 GUI 入口是 `dist/Electron.app/Contents/MacOS/Electron`，
 * 直接从 node_modules 启动即可，无需复制（也不该复制 275MB 的 .app）。
 * 打包后的应用由用户从任意目录启动，不受上述限制。
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

/** electron 包内可执行文件相对路径（macOS 为 .app 内的可执行文件） */
function platformBinaryRelativePath() {
  if (process.platform === 'darwin') {
    return path.join('dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
  }
  if (process.platform === 'win32') return path.join('dist', 'electron.exe')
  return path.join('dist', 'electron')
}

/** 定位可用的 Electron 可执行文件，返回路径（失败返回 null）。 */
function ensureElectronRuntime({ quiet = false } = {}) {
  const info = runtimeRoot()
  if (!info) return null
  const sourceBinary = path.join(info.pkg, platformBinaryRelativePath())
  if (!fs.existsSync(sourceBinary)) return null
  // macOS/Linux：直接使用 node_modules 内的运行时
  if (process.platform !== 'win32') return sourceBinary
  // Windows：复制到 workspace 之外再执行（见文件头说明）
  const exe = path.join(info.dir, 'electron.exe')
  if (fs.existsSync(exe)) return exe
  fs.rmSync(info.dir, { recursive: true, force: true })
  fs.mkdirSync(info.dir, { recursive: true })
  if (!quiet) console.log(`[electron-runtime] 复制 Electron ${info.version} -> ${info.dir}`)
  fs.cpSync(path.join(info.pkg, 'dist'), info.dir, { recursive: true })
  return exe
}

module.exports = { ensureElectronRuntime, root }
