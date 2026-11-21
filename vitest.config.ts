/**
 * Vitest 根配置。渲染层与主进程模块都跑在 node 环境；
 * 使用 scripts/run-tests.cjs 通过 Electron 自带 Node 启动，解决 better-sqlite3 的 ABI 一致性。
 * 登记：docs/09-PROJECT-STRUCTURE.md §6.1
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules/**', 'out/**', 'release/**'],
    passWithNoTests: true,
    testTimeout: 20000,
    hookTimeout: 20000
  }
})
