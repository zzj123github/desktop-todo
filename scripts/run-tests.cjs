#!/usr/bin/env node
/**
 * 测试入口：用 Electron 自带 Node 运行 Vitest。
 *
 * 原因：
 * 1) better-sqlite3 的原生模块只能按一个 ABI 编译/下载，本项目为 Electron 40（ABI 143）
 *    放置了预编译二进制；系统 Node 22 的 ABI 是 127，直接 `vitest` 会加载失败。
 *    Electron 的 ELECTRON_RUN_AS_NODE 模式提供同一 ABI，可以正常跑 Node 测试。
 * 2) 本机 workspace 路径下执行的进程写 %TEMP% 会 EPERM，所以从 workspace 外的
 *    Electron 运行时副本启动（见 scripts/electron-runtime.cjs）。
 *
 * 用法：node scripts/run-tests.cjs [watch] [额外 vitest 参数]
 */
const { spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')
const { ensureElectronRuntime, root } = require('./electron-runtime.cjs')

const electronBinary = ensureElectronRuntime()
if (!electronBinary) {
  console.error('[run-tests] 未找到可用的 Electron 运行时，请先 pnpm install 并运行 scripts/fetch-native-assets.py')
  process.exit(1)
}

const vitestCli = path.join(root, 'node_modules', 'vitest', 'vitest.mjs')
if (!existsSync(vitestCli)) {
  console.error('[run-tests] 未找到 vitest，请先 pnpm install')
  process.exit(1)
}

const args = process.argv.slice(2)
const watch = args[0] === 'watch'
const mode = watch ? [] : ['--run']
const extra = watch ? args.slice(1) : args

const result = spawnSync(electronBinary, [vitestCli, ...mode, ...extra], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
if (result.error) console.error('[run-tests]', result.error)
process.exit(result.status === null ? 1 : result.status)
