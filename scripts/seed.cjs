#!/usr/bin/env node
/**
 * 演示数据种子入口：`pnpm seed`
 *
 * 用 workspace 之外的 Electron 运行时副本启动已构建的 main 进程，并带 `--seed`
 * 让 src/main/seed.ts 导入 resources/seed.json（+ 补足任务）后退出；不打开任何窗口。
 * 背景（为什么复制运行时）见 scripts/electron-runtime.cjs 顶部说明。
 *
 * 前置：先 `pnpm build`（需要 out/main/index.js）。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { ensureElectronRuntime, root } = require('./electron-runtime.cjs')

function fail(message) {
  console.error(`[seed] ${message}`)
  process.exit(1)
}

const mainEntry = path.join(root, 'out', 'main', 'index.js')
if (!fs.existsSync(mainEntry)) {
  fail('缺少 out/main/index.js，请先运行 pnpm build（或 pnpm dev 构建一次）')
}

const electronBinary = ensureElectronRuntime()
if (!electronBinary) {
  fail('Electron 运行时未就位，请先 pnpm install 并运行 scripts/fetch-native-assets.py')
}

const args = [root, '--seed']
console.log(`[seed] ${electronBinary} ${args.join(' ')}`)
const child = spawn(electronBinary, args, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
})
child.on('error', (error) => fail(error.message))
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[seed] 进程被信号 ${signal} 终止`)
    process.exit(1)
  }
  process.exit(code === null ? 0 : code)
})
