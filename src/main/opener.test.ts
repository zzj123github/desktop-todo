/**
 * opener 单元测试（纯识别逻辑 + 不真正打开外部程序的失败分支）
 * 覆盖：http/https、win32 下 file:// 拒绝、危险协议 blocked、UNC/盘符/cygdrive、
 *       darwin 绝对 POSIX 路径与 file URL（中文/空格/URL 转义）、裸域名补 https、
 *       相对路径/环境变量 unsupported、默认显示名、失效路径 missing。
 * 平台通过函数可选参数显式注入（默认 process.platform），同一份用例在任何宿主系统上
 * 都能同时跑 win32 与 darwin 两个分支。
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

// 平台字面量：显式注入，避免测试结果依赖宿主系统（项目同时在 Windows 与 macOS 上跑）
const WIN32 = 'win32' as const
const DARWIN = 'darwin' as const

describe('classifyTarget · win32 回归', () => {
  it('http/https 识别为 url 且保持原样', () => {
    expect(classifyTarget('https://wiki.company.com/ieop/review', WIN32)).toEqual({
      kind: 'url',
      target: 'https://wiki.company.com/ieop/review'
    })
    expect(classifyTarget('  http://example.com/a?b=1  ', WIN32)).toEqual({
      kind: 'url',
      target: 'http://example.com/a?b=1'
    })
  })

  it('裸域名自动补 https://，带路径的裸域名同样识别', () => {
    expect(classifyTarget('wiki.company.com/review', WIN32)).toEqual({
      kind: 'url',
      target: 'https://wiki.company.com/review'
    })
    expect(classifyTarget('supplier.company.com', WIN32)).toEqual({
      kind: 'url',
      target: 'https://supplier.company.com'
    })
  })

  it('file:// 与相对路径/环境变量一律 unsupported', () => {
    expect(classifyTarget('file:///C:/Users/me/doc.pdf', WIN32)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('docs/readme.txt', WIN32)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('%USERPROFILE%\\Desktop', WIN32)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('report.docx', WIN32)).toMatchObject({ kind: null, reason: 'unsupported' })
    expect(classifyTarget('   ', WIN32)).toMatchObject({ kind: null, reason: 'unsupported' })
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
      expect(classifyTarget(target, WIN32)).toMatchObject({ kind: null, reason: 'blocked' })
    }
  })

  it('本地盘符路径按扩展名推断 file/folder，并统一反斜杠', () => {
    expect(classifyTarget('C:/Users/me/report.docx', WIN32)).toEqual({
      kind: 'file',
      target: 'C:\\Users\\me\\report.docx'
    })
    expect(classifyTarget('C:\\Users\\me\\Documents', WIN32)).toEqual({
      kind: 'folder',
      target: 'C:\\Users\\me\\Documents'
    })
    expect(classifyTarget('"C:\\Temp\\notes"', WIN32)).toMatchObject({ kind: 'folder' })
    expect(classifyTarget('C:\\Users\\me\\Documents\\', WIN32)).toMatchObject({ kind: 'folder' })
  })

  it('UNC 路径保留双反斜杠并识别为本地路径', () => {
    expect(classifyTarget('\\\\fileserver\\项目A\\IEOP', WIN32)).toEqual({
      kind: 'folder',
      target: '\\\\fileserver\\项目A\\IEOP'
    })
    expect(classifyTarget('//fileserver/share/report.pdf', WIN32)).toEqual({
      kind: 'file',
      target: '\\\\fileserver\\share\\report.pdf'
    })
  })

  it('其他协议 unsupported（mailto 等）', () => {
    expect(classifyTarget('mailto:someone@example.com', WIN32)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('ftp://example.com/file', WIN32)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
  })
})

describe('classifyTarget · darwin/posix', () => {
  it('绝对 POSIX 路径按扩展名推断 file/folder，保留正斜杠', () => {
    expect(classifyTarget('/Users/me/report.docx', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/report.docx'
    })
    expect(classifyTarget('/Users/me/Documents', DARWIN)).toEqual({
      kind: 'folder',
      target: '/Users/me/Documents'
    })
    // 结尾分隔符优先判文件夹，且 path.posix.normalize 保留结尾分隔符
    expect(classifyTarget('/Users/me/Documents/', DARWIN)).toEqual({
      kind: 'folder',
      target: '/Users/me/Documents/'
    })
  })

  it('含中文/空格的 POSIX 路径、首尾引号与 . / .. 规范化', () => {
    expect(classifyTarget('/Users/me/项目 资料/周报 2024.xlsx', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/项目 资料/周报 2024.xlsx'
    })
    expect(classifyTarget('"/Users/me/项目 A/"', DARWIN)).toEqual({
      kind: 'folder',
      target: '/Users/me/项目 A/'
    })
    expect(classifyTarget('  ‘/Users/me/文档’  ', DARWIN)).toEqual({
      kind: 'folder',
      target: '/Users/me/文档'
    })
    expect(classifyTarget('/Users//me/./项目/../文档/报告.pdf', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/文档/报告.pdf'
    })
  })

  it('file:/// 本机 URL 解码为本地路径（URL 转义/空格/中文）', () => {
    expect(classifyTarget('file:///Users/me/%E6%8A%A5%E5%91%8A%202024.pdf', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/报告 2024.pdf'
    })
    expect(classifyTarget('file:///Users/me/my%20report.pdf', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/my report.pdf'
    })
    expect(classifyTarget('file:///Users/me/%E9%A1%B9%E7%9B%AE%20A/', DARWIN)).toEqual({
      kind: 'folder',
      target: '/Users/me/项目 A/'
    })
    // 大小写不敏感、localhost 主机、含中文的未转义 URL 都能解出同一路径
    expect(classifyTarget('FILE:///Users/me/A.PDF', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/A.PDF'
    })
    expect(classifyTarget('file://localhost/Users/me/a.txt', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/a.txt'
    })
    expect(classifyTarget('file:///Users/me/项目 资料/周报 2024.xlsx', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/项目 资料/周报 2024.xlsx'
    })
  })

  it('Windows 路径语义在 darwin 下 unsupported（不误判为本地路径）', () => {
    // 盘符、UNC、正向 UNC、cygdrive 都是 Windows 语义
    expect(classifyTarget('C:\\Users\\me\\report.docx', DARWIN)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('\\\\fileserver\\share', DARWIN)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('//fileserver/share', DARWIN)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('/cygdrive/c/Users/me', DARWIN)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    // 非本机 host 的 file URL（UNC）与 Windows 盘符形式的 file URL 也不支持
    expect(classifyTarget('file://server/share/report.pdf', DARWIN)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
    expect(classifyTarget('file:///C:/Users/me/doc.pdf', DARWIN)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
  })

  it('相对路径/环境变量 unsupported', () => {
    for (const target of [
      'docs/readme.txt',
      '../report.pdf',
      '~/Documents',
      '%USERPROFILE%\\Desktop',
      'report.docx',
      '   '
    ]) {
      expect(classifyTarget(target, DARWIN)).toMatchObject({ kind: null, reason: 'unsupported' })
    }
  })

  it('危险协议在 darwin 下同样 blocked', () => {
    for (const target of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<b>x</b>',
      'vbscript:msgbox(1)',
      'cmd:/c calc',
      'powershell:Start-Process calc',
      'ms-script:evil',
      'mshta:evil'
    ]) {
      expect(classifyTarget(target, DARWIN)).toMatchObject({ kind: null, reason: 'blocked' })
    }
  })

  it('http/https 与裸域名在 darwin 下行为不变', () => {
    expect(classifyTarget('https://wiki.company.com/ieop/review', DARWIN)).toEqual({
      kind: 'url',
      target: 'https://wiki.company.com/ieop/review'
    })
    expect(classifyTarget('supplier.company.com', DARWIN)).toEqual({
      kind: 'url',
      target: 'https://supplier.company.com'
    })
    expect(classifyTarget('mailto:someone@example.com', DARWIN)).toMatchObject({
      kind: null,
      reason: 'unsupported'
    })
  })
})

describe('路径工具', () => {
  it('normalizeLocalPath · win32：引号、正斜杠、cygwin 风格', () => {
    expect(normalizeLocalPath('"C:/Users/me/report.docx"', WIN32)).toBe(
      'C:\\Users\\me\\report.docx'
    )
    expect(normalizeLocalPath('/cygdrive/c/Users/me', WIN32)).toBe('C:\\Users\\me')
    // path.win32.normalize 会给 UNC 共享根补结尾分隔符（Windows 语义）
    expect(normalizeLocalPath('\\\\server\\share', WIN32)).toBe('\\\\server\\share\\')
    expect(normalizeLocalPath('C:/Users/me/../me/docs', WIN32)).toBe('C:\\Users\\me\\docs')
  })

  it('normalizeLocalPath · darwin：保留正斜杠，处理 . / .. / 重复斜杠 / 引号', () => {
    expect(normalizeLocalPath('/Users//me/./a/../b', DARWIN)).toBe('/Users/me/b')
    expect(normalizeLocalPath('"/Users/me/项目 资料/"', DARWIN)).toBe('/Users/me/项目 资料/')
    expect(normalizeLocalPath('/Users/me/文档', DARWIN)).toBe('/Users/me/文档')
  })

  it('isAbsoluteLocalPath · win32：覆盖盘符/正反斜杠 UNC/cygdrive', () => {
    expect(isAbsoluteLocalPath('C:\\Temp', WIN32)).toBe(true)
    expect(isAbsoluteLocalPath('C:/Temp', WIN32)).toBe(true)
    expect(isAbsoluteLocalPath('\\\\server\\share', WIN32)).toBe(true)
    expect(isAbsoluteLocalPath('//server/share', WIN32)).toBe(true)
    expect(isAbsoluteLocalPath('/cygdrive/d/work', WIN32)).toBe(true)
    expect(isAbsoluteLocalPath('docs/readme.md', WIN32)).toBe(false)
    expect(isAbsoluteLocalPath('https://example.com', WIN32)).toBe(false)
  })

  it('isAbsoluteLocalPath · darwin：只认绝对 POSIX 路径', () => {
    expect(isAbsoluteLocalPath('/Users/me', DARWIN)).toBe(true)
    expect(isAbsoluteLocalPath('/Users/me/项目 资料/报告.pdf', DARWIN)).toBe(true)
    // Windows 语义（UNC/盘符/cygdrive）与相对路径都不算 POSIX 绝对路径
    expect(isAbsoluteLocalPath('//fileserver/share', DARWIN)).toBe(false)
    expect(isAbsoluteLocalPath('C:/Temp', DARWIN)).toBe(false)
    expect(isAbsoluteLocalPath('C:\\Temp', DARWIN)).toBe(false)
    expect(isAbsoluteLocalPath('/cygdrive/d/work', DARWIN)).toBe(false)
    expect(isAbsoluteLocalPath('docs/readme.md', DARWIN)).toBe(false)
    expect(isAbsoluteLocalPath('https://example.com', DARWIN)).toBe(false)
  })

  it('classifyLocalKind · win32：结尾分隔符=文件夹，有扩展名=文件', () => {
    expect(classifyLocalKind('C:\\Temp\\', WIN32)).toBe('folder')
    expect(classifyLocalKind('C:\\Temp\\a.b.docx', WIN32)).toBe('file')
    expect(classifyLocalKind('\\\\server\\share\\文件夹', WIN32)).toBe('folder')
  })

  it('classifyLocalKind · darwin：结尾分隔符优先，其次看扩展名', () => {
    expect(classifyLocalKind('/Users/me/Documents/', DARWIN)).toBe('folder')
    expect(classifyLocalKind('/Users/me/周报.xlsx', DARWIN)).toBe('file')
    expect(classifyLocalKind('/Users/me/项目 A', DARWIN)).toBe('folder')
    expect(classifyLocalKind('"/Users/me/项目 A/"', DARWIN)).toBe('folder')
  })

  it('defaultDisplayName · win32：网页取 hostname，文件去扩展名', () => {
    expect(defaultDisplayName('https://wiki.company.com/a/b', 'url', WIN32)).toBe(
      'wiki.company.com'
    )
    expect(defaultDisplayName('C:\\Users\\me\\周报.xlsx', 'file', WIN32)).toBe('周报')
    expect(defaultDisplayName('C:\\Users\\me\\周报模板', 'folder', WIN32)).toBe('周报模板')
  })

  it('defaultDisplayName · darwin：正斜杠路径取 basename，文件去扩展名', () => {
    expect(defaultDisplayName('/Users/me/周报.xlsx', 'file', DARWIN)).toBe('周报')
    expect(defaultDisplayName('/Users/me/项目 A/', 'folder', DARWIN)).toBe('项目 A')
    expect(defaultDisplayName('/Users/me/报告 v2.1.docx', 'file', DARWIN)).toBe('报告 v2.1')
  })
})

describe('openLink 安全分支', () => {
  it('win32：危险协议/不支持的协议返回结构化错误，不抛异常', async () => {
    await expect(openLink('javascript:alert(1)', undefined, WIN32)).resolves.toMatchObject({
      ok: false,
      reason: 'blocked'
    })
    await expect(openLink('file:///C:/secret.txt', undefined, WIN32)).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported'
    })
    await expect(openLink('mailto:a@b.com', undefined, WIN32)).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported'
    })
  })

  it('win32：不存在的本地路径返回 missing（不交给 shell）', async () => {
    const result = await openLink(
      'C:\\desktop-todo-test\\definitely-missing\\2024\\report.pdf',
      'file',
      WIN32
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missing')
    expect(result.target).toContain('report.pdf')
  })

  it('darwin：危险协议 blocked、非本机 file URL unsupported', async () => {
    await expect(openLink('javascript:alert(1)', undefined, DARWIN)).resolves.toMatchObject({
      ok: false,
      reason: 'blocked'
    })
    await expect(
      openLink('file://server/share/secret.txt', undefined, DARWIN)
    ).resolves.toMatchObject({ ok: false, reason: 'unsupported' })
  })

  it('darwin：不存在的 POSIX 路径/file URL 转本地后返回 missing（不交给 shell）', async () => {
    const posixResult = await openLink(
      '/Users/desktop-todo-test/definitely-missing/2024/report.pdf',
      'file',
      DARWIN
    )
    expect(posixResult.ok).toBe(false)
    expect(posixResult.reason).toBe('missing')
    expect(posixResult.target).toBe(
      '/Users/desktop-todo-test/definitely-missing/2024/report.pdf'
    )

    const fileUrlResult = await openLink(
      'file:///Users/desktop-todo-test/definitely-missing/%E6%8A%A5%E5%91%8A.pdf',
      undefined,
      DARWIN
    )
    expect(fileUrlResult.ok).toBe(false)
    expect(fileUrlResult.reason).toBe('missing')
    expect(fileUrlResult.target).toBe('/Users/desktop-todo-test/definitely-missing/报告.pdf')
  })
})
