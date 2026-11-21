/**
 * opener 单元测试（纯识别逻辑 + 不真正打开外部程序的失败分支）
 * 覆盖：http/https、file:// 拒绝、危险协议 blocked、UNC/盘符/正斜杠路径、
 *       裸域名补 https、相对路径/环境变量 unsupported、默认显示名、失效路径 missing。
 */
import { describe, expect, it } from 'vitest'
import {
  classifyLocalKind,
  classifyTarget,
  defaultDisplayName,
  isAbsoluteLocalPath,
  normalizeLocalPath,
  openLink
} from './opener'

describe('classifyTarget', () => {
  it('http/https 识别为 url 且保持原样', () => {
    expect(classifyTarget('https://wiki.company.com/ieop/review')).toEqual({
      kind: 'url',
      target: 'https://wiki.company.com/ieop/review'
    })
    expect(classifyTarget('  http://example.com/a?b=1  ')).toEqual({
      kind: 'url',
      target: 'http://example.com/a?b=1'
    })
  })

  it('裸域名自动补 https://，带路径的裸域名同样识别', () => {
    expect(classifyTarget('wiki.company.com/review')).toEqual({
      kind: 'url',
      target: 'https://wiki.company.com/review'
    })
    expect(classifyTarget('supplier.company.com')).toEqual({
      kind: 'url',
      target: 'https://supplier.company.com'
    })
  })

  it('file:// 与相对路径/环境变量一律 unsupported', () => {
    expect(classifyTarget('file:///C:/Users/me/doc.pdf')).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('docs/readme.txt')).toMatchObject({ kind: null, reason: 'unsupported' })
    expect(classifyTarget('%USERPROFILE%\\Desktop')).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('report.docx')).toMatchObject({ kind: null, reason: 'unsupported' })
    expect(classifyTarget('   ')).toMatchObject({ kind: null, reason: 'unsupported' })
  })

  it('危险协议 blocked（不保存、不打开）', () => {
    for (const target of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<b>x</b>',
      'vbscript:msgbox(1)',
      'cmd:/c calc',
      'powershell:Start-Process calc'
    ]) {
      expect(classifyTarget(target)).toMatchObject({ kind: null, reason: 'blocked' })
    }
  })

  it('本地盘符路径按扩展名推断 file/folder，并统一反斜杠', () => {
    expect(classifyTarget('C:/Users/me/report.docx')).toEqual({
      kind: 'file',
      target: 'C:\\Users\\me\\report.docx'
    })
    expect(classifyTarget('C:\\Users\\me\\Documents')).toEqual({
      kind: 'folder',
      target: 'C:\\Users\\me\\Documents'
    })
    expect(classifyTarget('"C:\\Temp\\notes"')).toMatchObject({ kind: 'folder' })
    expect(classifyTarget('C:\\Users\\me\\Documents\\')).toMatchObject({ kind: 'folder' })
  })

  it('UNC 路径保留双反斜杠并识别为本地路径', () => {
    expect(classifyTarget('\\\\fileserver\\项目A\\IEOP')).toEqual({
      kind: 'folder',
      target: '\\\\fileserver\\项目A\\IEOP'
    })
    expect(classifyTarget('//fileserver/share/report.pdf')).toEqual({
      kind: 'file',
      target: '\\\\fileserver\\share\\report.pdf'
    })
  })

  it('其他协议 unsupported（mailto 等）', () => {
    expect(classifyTarget('mailto:someone@example.com')).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('ftp://example.com/file')).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
  })
})

describe('路径工具', () => {
  it('normalizeLocalPath 处理引号、正斜杠、cygwin 风格', () => {
    expect(normalizeLocalPath('"C:/Users/me/report.docx"')).toBe('C:\\Users\\me\\report.docx')
    expect(normalizeLocalPath('/cygdrive/c/Users/me')).toBe('C:\\Users\\me')
    // path.win32.normalize 会给 UNC 共享根补结尾分隔符（Windows 语义）
    expect(normalizeLocalPath('\\\\server\\share')).toBe('\\\\server\\share\\')
    expect(normalizeLocalPath('C:/Users/me/../me/docs')).toBe('C:\\Users\\me\\docs')
  })

  it('isAbsoluteLocalPath 覆盖盘符/正反斜杠 UNC/cygdrive', () => {
    expect(isAbsoluteLocalPath('C:\\Temp')).toBe(true)
    expect(isAbsoluteLocalPath('C:/Temp')).toBe(true)
    expect(isAbsoluteLocalPath('\\\\server\\share')).toBe(true)
    expect(isAbsoluteLocalPath('//server/share')).toBe(true)
    expect(isAbsoluteLocalPath('/cygdrive/d/work')).toBe(true)
    expect(isAbsoluteLocalPath('docs/readme.md')).toBe(false)
    expect(isAbsoluteLocalPath('https://example.com')).toBe(false)
  })

  it('classifyLocalKind 结尾分隔符=文件夹，有扩展名=文件', () => {
    expect(classifyLocalKind('C:\\Temp\\')).toBe('folder')
    expect(classifyLocalKind('C:\\Temp\\a.b.docx')).toBe('file')
    expect(classifyLocalKind('\\\\server\\share\\文件夹')).toBe('folder')
  })

  it('defaultDisplayName：网页取 hostname，文件去扩展名', () => {
    expect(defaultDisplayName('https://wiki.company.com/a/b', 'url')).toBe('wiki.company.com')
    expect(defaultDisplayName('C:\\Users\\me\\周报.xlsx', 'file')).toBe('周报')
    expect(defaultDisplayName('C:\\Users\\me\\周报模板', 'folder')).toBe('周报模板')
  })
})

describe('openLink 安全分支', () => {
  it('危险协议/不支持的协议返回结构化错误，不抛异常', async () => {
    await expect(openLink('javascript:alert(1)')).resolves.toMatchObject({
      ok: false,
      reason: 'blocked'
    })
    await expect(openLink('file:///C:/secret.txt')).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported'
    })
    await expect(openLink('mailto:a@b.com')).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported'
    })
  })

  it('不存在的本地路径返回 missing（不交给 shell）', async () => {
    const result = await openLink(
      'C:\\desktop-todo-test\\definitely-missing\\2024\\report.pdf',
      'file'
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missing')
    expect(result.target).toContain('report.pdf')
  })
})
