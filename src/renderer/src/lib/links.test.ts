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
