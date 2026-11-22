/**
 * 主进程异常日志
 *
 * 目的（用户 m07685）：便携版偶发「托盘 → 退出」时弹出
 * 「A JavaScript error occurred in the main process」。
 * Electron 默认把未捕获异常显示成原生错误框；为了让退出阶段不再弹框、
 * 同时保留可追溯的证据，这里提供最小日志能力：
 * - 所有未捕获异常 / 未处理 Promise 拒绝写入 `userData/logs/main.log`；
 * - 退出过程中（quitting）不再弹框，只记录；
 * - 日志按 512KB 轮转为 `main.old.log`，避免无限增长。
 *
 * 本模块不 import electron，便于单测；`userData` 路径由调用方传入。
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const MAIN_LOG_DIR_NAME = 'logs'
export const MAIN_LOG_FILE_NAME = 'main.log'
export const MAIN_LOG_ROTATED_FILE_NAME = 'main.old.log'
/** 单文件超过该大小后轮转（字节） */
export const MAIN_LOG_MAX_BYTES = 512 * 1024

/** 把未知错误转成适合写入日志的多行文本（Error 带堆栈） */
export function formatErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`
  }
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/** 一行日志：ISO 时间 + 场景说明；错误详情另起多行，便于 grep 与肉眼阅读 */
export function formatLogLine(scope: string, error?: unknown): string {
  const time = new Date().toISOString()
  const head = `[${time}] ${scope}`
  if (error === undefined) return `${head}\n`
  return `${head}\n${formatErrorDetail(error)}\n`
}

/** 日志目录（userData/logs）；调用方负责保证 userData 可用 */
export function mainLogDir(userDataDir: string): string {
  return join(userDataDir, MAIN_LOG_DIR_NAME)
}

/** 写入一行日志；IO 失败静默（日志不能影响主流程） */
export function writeMainLog(logDir: string, line: string): void {
  try {
    mkdirSync(logDir, { recursive: true })
    const file = join(logDir, MAIN_LOG_FILE_NAME)
    if (existsSync(file) && statSync(file).size > MAIN_LOG_MAX_BYTES) {
      renameSync(file, join(logDir, MAIN_LOG_ROTATED_FILE_NAME))
    }
    appendFileSync(file, line, 'utf8')
  } catch {
    /* 日志失败不影响主流程 */
  }
}

/** 记录一条主进程异常（退出阶段同样记录，但不弹框） */
export function logMainError(logDir: string, scope: string, error: unknown): void {
  writeMainLog(logDir, formatLogLine(scope, error))
}
