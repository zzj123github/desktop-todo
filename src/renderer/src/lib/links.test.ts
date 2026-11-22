/**
 * links.test.ts · 链接自动标题（用户反馈 #2：链接标题可编辑，留空回退自动标题）
 * 真实行为：调用真实 detectLink 规则，断言 URL/路径/无效输入三类输入的标题输出。
 */
import { describe, expect, it } from 'vitest'
import { autoLinkTitle } from './links'

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
