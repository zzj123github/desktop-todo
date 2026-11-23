/**
 * links.test.ts · 链接自动标题与添加/编辑输入解析
 * 真实行为：调用真实 detectLink 规则，断言 URL/路径/无效输入三类输入的标题与类型输出。
 * 用户 m06711：添加时可直接填标题；编辑时可同时改地址与标题。
 */
import { describe, expect, it } from 'vitest'
import { autoLinkTitle, parseLinkInput } from './links'

describe('autoLinkTitle', () => {
  it('URL 去掉协议、去掉结尾斜杠后截断 44 字', () => {
    const long = 'https://doc.weixin.qq.com/sheet/e3_AUMAKQb1AEoCNDmlditWAR7yUcB'
    const title = autoLinkTitle(long)
    expect(title.startsWith('doc.weixin.qq.com/')).toBe(true)
    expect(title.length).toBeLessThanOrEqual(44)
    expect(title).not.toContain('https://')
  })

  it('www 开头补 https 后按 URL 规则生成标题', () => {
    expect(autoLinkTitle('www.example.com/a/b')).toBe('www.example.com/a/b')
  })

  it('本地/UNC 路径取最后一段作为标题', () => {
    expect(autoLinkTitle('C:\\Users\\lazasons\\Desktop\\模具图纸.pdf')).toBe('模具图纸.pdf')
    expect(autoLinkTitle('\\\\192.168.1.10\\共享\\项目资料')).toBe('项目资料')
  })

  it('无法识别的输入退回原始文本，空输入返回空串', () => {
    expect(autoLinkTitle('javascript:alert(1)')).toBe('javascript:alert(1)')
    expect(autoLinkTitle('   ')).toBe('')
  })
})

describe('parseLinkInput（添加/编辑链接的地址+标题解析）', () => {
  it('标题留空回退自动标题，并按地址识别类型', () => {
    const url = parseLinkInput('https://mail.company.com/thread/8842')
    expect(url).toMatchObject({ kind: 'url', display: 'mail.company.com/thread/8842' })

    const file = parseLinkInput('C:\\Users\\lazasons\\Desktop\\模具图纸.pdf')
    expect(file).toMatchObject({ kind: 'file', display: '模具图纸.pdf' })
  })

  it('填了标题就用标题（去首尾空白，最多 120 字）', () => {
    expect(parseLinkInput('https://example.com/a', '  邮件原文  ')).toMatchObject({
      kind: 'url',
      target: 'https://example.com/a',
      display: '邮件原文'
    })
    const longTitle = 'x'.repeat(200)
    expect(parseLinkInput('https://example.com/a', longTitle)?.display).toHaveLength(120)
  })

  it('地址为空或无法识别时返回 null', () => {
    expect(parseLinkInput('', '标题')).toBeNull()
    expect(parseLinkInput('   ', '标题')).toBeNull()
    expect(parseLinkInput('javascript:alert(1)', '标题')).toBeNull()
  })

  it('UNC 共享识别为 folder，标题默认取最后一段', () => {
    expect(parseLinkInput('\\\\192.168.1.10\\共享\\项目资料')).toMatchObject({
      kind: 'folder',
      display: '项目资料'
    })
  })
})

/** 平台字面量：显式注入，两条平台用例同跑（Node 测试环境默认回退 win32） */
const DARWIN = 'darwin' as const

describe('parseLinkInput · darwin（macOS 本地文件/文件夹）', () => {
  it('接受 /Users/... 绝对 POSIX 路径，标题留空回退 basename', () => {
    expect(parseLinkInput('/Users/me/报告 2024.pdf', '', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/报告 2024.pdf',
      display: '报告 2024.pdf'
    })
    expect(parseLinkInput('/Users/me/Documents/', '', DARWIN)).toEqual({
      kind: 'folder',
      target: '/Users/me/Documents/',
      display: 'Documents'
    })
    expect(parseLinkInput('  "/Users/me/项目 A/"  ', '', DARWIN)).toMatchObject({
      kind: 'folder',
      target: '/Users/me/项目 A/',
      display: '项目 A'
    })
  })

  it('接受 file:/// 本机 URL（解码）并支持自定义标题', () => {
    expect(parseLinkInput('file:///Users/me/%E4%B8%AD%E6%96%87.pdf', '需求文档', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/中文.pdf',
      display: '需求文档'
    })
  })

  it('危险协议与 Windows 语义在 darwin 下拒绝', () => {
    expect(parseLinkInput('javascript:alert(1)', '标题', DARWIN)).toBeNull()
    expect(parseLinkInput('data:text/html,<b>x</b>', '', DARWIN)).toBeNull()
    expect(parseLinkInput('C:\\Users\\me\\a.txt', '', DARWIN)).toBeNull()
    expect(parseLinkInput('//server/share/dir', '', DARWIN)).toBeNull()
  })

  it('默认（win32）下 macOS 路径仍拒绝：原有 Windows 行为零回归', () => {
    expect(parseLinkInput('/Users/me/a.txt')).toBeNull()
    expect(parseLinkInput('/Users/me/a.txt', '标题')).toBeNull()
  })
})

describe('autoLinkTitle · darwin', () => {
  it('macOS 路径取最后一段（含空格/中文），不存在结尾斜杠时也正确', () => {
    expect(autoLinkTitle('/Users/me/报告 2024.pdf', DARWIN)).toBe('报告 2024.pdf')
    expect(autoLinkTitle('/Users/me/项目 资料/', DARWIN)).toBe('项目 资料')
    expect(autoLinkTitle('file:///Users/me/%E6%96%87.docx', DARWIN)).toBe('文.docx')
  })

  it('无法识别的输入退回原始文本（darwin 下 Windows 路径同样退回）', () => {
    expect(autoLinkTitle('javascript:alert(1)', DARWIN)).toBe('javascript:alert(1)')
    expect(autoLinkTitle('C:\\Users\\me\\a.txt', DARWIN)).toBe('C:\\Users\\me\\a.txt')
  })
})
