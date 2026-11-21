#!/usr/bin/env node
/**
 * 开发/验收启动器：从 workspace 外的 Electron 运行时副本启动已构建的应用。
 * 背景与原因见 scripts/electron-runtime.cjs 顶部说明。
 *
 * 用法：
 *   node scripts/dev-launch.cjs            # 启动已构建产物（先 pnpm build）
 *   node scripts/dev-launch.cjs --build    # 先构建再启动
 *   node scripts/dev-launch.cjs -- --silent
 */
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { ensureElectronRuntime, root } = require('./electron-runtime.cjs')

const rawArgs = process.argv.slice(2)
const buildFirst = rawArgs.includes('--build')
const sepIndex = rawArgs.indexOf('--')
const appArgs = sepIndex >= 0 ? rawArgs.slice(sepIndex + 1) : rawArgs.filter((a) => a !== '--build')

function fail(message) {
  console.error(`[dev-launch] ${message}`)
  process.exit(1)
}

if (buildFirst) {
  const build = spawnSync(
    process.execPath,
    [path.join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build'],
    { cwd: root, stdio: 'inherit' }
  )
  if (build.status !== 0) fail('构建失败')
}

const electronBinary = ensureElectronRuntime()
if (!electronBinary) fail('Electron 运行时未就位，请先 pnpm install 并运行 scripts/fetch-native-assets.py')

const mainEntry = path.join(root, 'out', 'main', 'index.js')
if (!fs.existsSync(mainEntry)) fail('缺少 out/main/index.js，请先运行 pnpm build')

console.log(`[dev-launch] ${electronBinary} ${root} ${appArgs.join(' ')}`)
const child = spawn(electronBinary, [root, ...appArgs], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
})
child.on('exit', (code) => process.exit(code === null ? 0 : code))
