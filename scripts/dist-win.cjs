#!/usr/bin/env node
/**
 * Windows 打包入口：默认 patch +1 → electron-vite build → electron-builder → 删旧包。
 *
 * 用法（在项目根、Windows 上执行）：
 *   node scripts/dist-win.cjs                 # 全量 win（portable + nsis）
 *   node scripts/dist-win.cjs portable        # 仅 portable
 *   node scripts/dist-win.cjs nsis            # 仅 nsis
 *   node scripts/dist-win.cjs --skip-build    # 跳过 vite build
 *   node scripts/dist-win.cjs --no-bump       # 不升 package.json 版本
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { root } = require('./electron-runtime.cjs')
const { bumpPatchVersion, cleanOldReleaseArtifacts, currentVersion } = require('./release-version.cjs')

function fail(message) {
  console.error(`[dist-win] ${message}`)
  process.exit(1)
}

function run(command, args) {
  console.log(`\n[dist-win] ${path.basename(command)} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env } })
  if (result.error) fail(`无法启动 ${command}：${result.error.message}`)
  if (result.status !== 0) fail(`命令失败（退出码 ${result.status}）：${command} ${args.join(' ')}`)
}

function parseArgs(argv) {
  let skipBuild = false
  let noBump = false
  let target = null // null = both
  for (const arg of argv) {
    if (arg === '--skip-build') skipBuild = true
    else if (arg === '--no-bump') noBump = true
    else if (arg === 'portable' || arg === 'nsis') target = arg
    else fail(`未知参数：${arg}（可用：portable / nsis / --skip-build / --no-bump）`)
  }
  return { skipBuild, noBump, target }
}

const { skipBuild, noBump, target } = parseArgs(process.argv.slice(2))

if (!fs.existsSync(path.join(root, 'node_modules', 'electron-builder', 'cli.js'))) {
  fail('未找到 electron-builder，请先 pnpm install')
}

if (!noBump) bumpPatchVersion()

if (!skipBuild) {
  run(process.execPath, [
    path.join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'),
    'build'
  ])
}

const builderArgs = [
  path.join(root, 'node_modules', 'electron-builder', 'cli.js'),
  '--win',
  '--publish',
  'never',
  ...(target ? [target] : [])
]
run(process.execPath, builderArgs)

const version = currentVersion()
const expected =
  target === 'portable'
    ? [`DesktopTodo-${version}-portable.exe`]
    : target === 'nsis'
      ? [`DesktopTodo-${version}-setup.exe`]
      : [`DesktopTodo-${version}-portable.exe`, `DesktopTodo-${version}-setup.exe`]

for (const name of expected) {
  const full = path.join(root, 'release', name)
  if (!fs.existsSync(full)) fail(`安装包未生成：release/${name}`)
  const size = fs.statSync(full).size
  console.log(`[dist-win] 产物：release/${name}  ${size} B（${(size / 1024 / 1024).toFixed(1)} MiB）`)
}
cleanOldReleaseArtifacts(version)
