/**
 * logger 单测（node:test 语义走 vitest，Electron-as-node 环境）
 * 只测纯行为：日志格式、目录创建、轮转、异常详情回退。
 */
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  formatErrorDetail,
  formatLogLine,
  logMainError,
  MAIN_LOG_FILE_NAME,
  MAIN_LOG_MAX_BYTES,
  MAIN_LOG_ROTATED_FILE_NAME,
  mainLogDir,
  writeMainLog
} from './logger'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'desktop-todo-logger-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('logger（主进程异常日志）', () => {
  it('formatLogLine 带 ISO 时间与场景，未传错误时只有一行', () => {
    const line = formatLogLine('退出前关闭数据库失败')
    expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] 退出前关闭数据库失败\n$/)
  })

  it('formatErrorDetail 对 Error 输出堆栈，对字符串/对象有兜底', () => {
    const error = new Error('数据库不可用')
    expect(formatErrorDetail(error)).toContain('Error: 数据库不可用')
    expect(formatErrorDetail('字符串错误')).toBe('字符串错误')
    expect(formatErrorDetail({ code: 'EPERM' })).toBe('{"code":"EPERM"}')
  })

  it('writeMainLog 自动创建 logs 目录并追加内容', () => {
    const userData = makeTempDir()
    const logDir = mainLogDir(userData)
    writeMainLog(logDir, formatLogLine('第一次'))
    writeMainLog(logDir, formatLogLine('第二次'))
    const text = readFileSync(join(logDir, MAIN_LOG_FILE_NAME), 'utf8')
    expect(text).toContain('第一次')
    expect(text).toContain('第二次')
    expect(text.indexOf('第一次')).toBeLessThan(text.indexOf('第二次'))
  })

  it('超过 512KB 后轮转为 main.old.log，再写入新日志', () => {
    const userData = makeTempDir()
    const logDir = mainLogDir(userData)
    writeMainLog(logDir, formatLogLine('--- placeholder ---'))
    const file = join(logDir, MAIN_LOG_FILE_NAME)
    writeFileSync(file, 'x'.repeat(MAIN_LOG_MAX_BYTES + 1024), 'utf8')
    writeMainLog(logDir, formatLogLine('轮转后的新日志'))
    expect(statSync(file).size).toBeLessThan(MAIN_LOG_MAX_BYTES)
    expect(readFileSync(join(logDir, MAIN_LOG_ROTATED_FILE_NAME), 'utf8')).toContain('x'.repeat(64))
    expect(readFileSync(file, 'utf8')).toContain('轮转后的新日志')
  })

  it('logMainError 写入场景与错误堆栈', () => {
    const logDir = mainLogDir(makeTempDir())
    logMainError(logDir, '未捕获异常', new Error('Object has been destroyed'))
    const text = readFileSync(join(logDir, MAIN_LOG_FILE_NAME), 'utf8')
    expect(text).toContain('未捕获异常')
    expect(text).toContain('Object has been destroyed')
  })
})
