#!/usr/bin/env node
/**
 * macOS 打包入口：先取 arm64 的 better-sqlite3 预编译 .node，再打 Apple 芯片 dmg。
 *
 * 平台范围：仅 Apple 芯片（arm64）。Intel 芯片 Mac 不在支持范围（不构建 x64 包、
 * 不提供 Rosetta 运行说明）。
 *
 * 为什么先取 .node：electron-builder.yml 设了 `npmRebuild: false`（不做原生重建），
 * 打包直接用与 Electron ABI 匹配的预编译 better_sqlite3.node；一个 .node 只能对应
 * 一个 CPU 架构，所以打包前必须显式放入 arm64 产物（Windows 版走同一套预编译流程）。
 *
 * 用法（在项目根执行，仅 macOS）：
 *   node scripts/dist-mac.cjs                 # patch +1 → 构建 + 打 dmg → 删旧包
 *   node scripts/dist-mac.cjs --dir           # 只出解包目录 release/mac-arm64，不生成 dmg、不升版（调试用）
 *   node scripts/dist-mac.cjs --skip-build    # 跳过 electron-vite build（out/ 已是最新）
 *   node scripts/dist-mac.cjs --no-bump       # 不升 package.json 版本（同版本重打）
 *
 * 产物：release/DesktopTodo-<version>-arm64.dmg
 * 未做代码签名（与 Windows 交付一致）：首次打开需右键「打开」或系统设置放行，见 README。
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { root } = require('./electron-runtime.cjs')
const { bumpPatchVersion, cleanOldReleaseArtifacts, currentVersion } = require('./release-version.cjs')

const ARCH = 'arm64'

function fail(message) {
  console.error(`[dist-mac] ${message}`)
  process.exit(1)
}

function run(command, args) {
  console.log(`\n[dist-mac] ${path.basename(command)} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env } })
  if (result.error) fail(`无法启动 ${command}：${result.error.message}`)
  if (result.status !== 0) fail(`命令失败（退出码 ${result.status}）：${command} ${args.join(' ')}`)
}

function parseArgs(argv) {
  let skipBuild = false
  let dirOnly = false
  let noBump = false
  for (const arg of argv) {
    if (arg === '--skip-build') skipBuild = true
    else if (arg === '--dir') dirOnly = true
    else if (arg === '--no-bump') noBump = true
    else fail(`未知参数：${arg}（可用：--skip-build / --dir / --no-bump）`)
  }
  return { skipBuild, dirOnly, noBump }
}

const { skipBuild, dirOnly, noBump } = parseArgs(process.argv.slice(2))

// 正式 dmg：默认末位版本 +1；--dir 调试不升版；--no-bump 同版本重打
if (!dirOnly && !noBump) {
  bumpPatchVersion()
}

if (process.platform !== 'darwin') {
  fail('macOS 安装包只能在 macOS 上构建（dmg 需要 hdiutil）；当前不是 macOS')
}
if (!fs.existsSync(path.join(root, 'node_modules', 'electron-builder', 'cli.js'))) {
  fail('未找到 electron-builder，请先 pnpm install')
}
if (process.arch !== ARCH) {
  console.warn(
    `[dist-mac] 当前机器架构是 ${process.arch}，仍会构建 ${ARCH} 包（仅打包，无法在本机运行验证）`
  )
}

if (!skipBuild) {
  run(process.execPath, [
    path.join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'),
    'build'
  ])
}

run(process.platform === 'win32' ? 'python' : 'python3', [
  path.join(root, 'scripts', 'fetch-native-assets.py'),
  '--skip-electron',
  '--arch',
  ARCH
])

const builderArgs = [
  path.join(root, 'node_modules', 'electron-builder', 'cli.js'),
  '--mac',
  `--${ARCH}`,
  '--publish',
  'never',
  ...(dirOnly ? ['--dir'] : [])
]
run(process.execPath, builderArgs)

if (dirOnly) {
  console.log(`\n[dist-mac] 解包目录：release/mac-${ARCH}/桌面待办.app`)
  process.exit(0)
}

const version = currentVersion()
const artifact = path.join(root, 'release', `DesktopTodo-${version}-${ARCH}.dmg`)
if (!fs.existsSync(artifact)) {
  fail(`安装包未生成：${path.relative(root, artifact)}`)
}
const size = fs.statSync(artifact).size
console.log(
  `\n[dist-mac] 产物：${path.relative(root, artifact)}  ${size} B（${(size / 1024 / 1024).toFixed(1)} MiB）`
)
cleanOldReleaseArtifacts(version)
