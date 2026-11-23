import { describe, expect, it, vi } from 'vitest'
import { detectLink, fmtDateTime, isLinkOnly, parseQuick } from './parseQuick'

/** 固定基准：2026-11-21（周六）13:05 本地时间 */
const NOW = new Date(2026, 10, 21, 13, 5, 0, 0).getTime()
const at = (y: number, mo: number, d: number, h = 0, mi = 0): number =>
  new Date(y, mo - 1, d, h, mi, 0, 0).getTime()

/** 平台字面量：显式注入，避免用例结果依赖宿主系统（项目同时在 Windows 与 macOS 上跑） */
const WIN32 = 'win32' as const
const DARWIN = 'darwin' as const

describe('parseQuick · 标题与默认到期时间', () => {
  it('空输入返回「新任务」+ 今天 18:00（默认时间已过则下一个未来半点）', () => {
    expect(parseQuick('', NOW)).toEqual({
      title: '新任务',
      dueAt: at(2026, 11, 21, 18, 0),
      dueText: '今天',
      priority: 0,
      tagNames: [],
      links: []
    })
    expect(parseQuick('   ', NOW).title).toBe('新任务')
  })

  it('只有标题时不解析时间，标题原样保留（含末尾的 18:00）', () => {
    const parsed = parseQuick('周报 18:00', NOW)
    expect(parsed.title).toBe('周报 18:00')
    expect(parsed.dueAt).toBe(at(2026, 11, 21, 18, 0))
    expect(parsed.dueText).toBe('今天')
  })

  it('标题内多空格折叠为单个空格', () => {
    expect(parseQuick('买   牛   奶', NOW).title).toBe('买 牛 奶')
  })

  it('opts.defaultDue 覆盖兜底时间；显式 null 表示不预填日期', () => {
    expect(parseQuick('买牛奶', NOW, { defaultDue: null }).dueAt).toBeNull()
    expect(parseQuick('买牛奶', NOW, { defaultDue: null }).dueText).toBeNull()
    expect(parseQuick('买牛奶', NOW, { defaultDue: at(2026, 11, 22, 18, 0) })).toMatchObject({
      dueAt: at(2026, 11, 22, 18, 0),
      dueText: '明天'
    })
  })

  it('显式日期词优先于 opts.defaultDue', () => {
    expect(parseQuick('明天 买菜', NOW, { defaultDue: at(2026, 11, 25, 9, 0) }).dueAt).toBe(
      at(2026, 11, 22, 18, 0)
    )
    expect(parseQuick('明天 买菜', NOW, { defaultDue: null }).dueAt).toBe(at(2026, 11, 22, 18, 0))
  })

  it('date-only 默认 18:00；今天是今天 18:00', () => {
    expect(parseQuick('今天 买菜', NOW)).toMatchObject({
      title: '买菜',
      dueAt: at(2026, 11, 21, 18, 0),
      dueText: '今天'
    })
  })

  it('今天的默认 18:00 已过时用下一个未来半点', () => {
    const late = at(2026, 11, 21, 19, 0)
    expect(parseQuick('今天 买菜', late)).toMatchObject({
      title: '买菜',
      dueAt: at(2026, 11, 21, 19, 30)
    })
  })
})

describe('parseQuick · 日期词', () => {
  it('今天/明天/后天/大后天 + HH:mm', () => {
    expect(parseQuick('今天 09:00 写周报', NOW)).toMatchObject({
      title: '写周报',
      dueAt: at(2026, 11, 21, 9, 0),
      dueText: '今天'
    })
    expect(parseQuick('买牛奶 明天 14:30', NOW)).toMatchObject({
      title: '买牛奶',
      dueAt: at(2026, 11, 22, 14, 30),
      dueText: '明天'
    })
    expect(parseQuick('后天', NOW)).toMatchObject({
      title: '新任务',
      dueAt: at(2026, 11, 23, 18, 0),
      dueText: '11月23日'
    })
    expect(parseQuick('大后天', NOW).dueAt).toBe(at(2026, 11, 24, 18, 0))
    expect(parseQuick('明天', NOW).dueAt).toBe(at(2026, 11, 22, 18, 0))
  })

  it('显式时刻即使今天已过去也保留（原型行为）', () => {
    expect(parseQuick('今天 09:00 写周报', NOW).dueAt).toBe(at(2026, 11, 21, 9, 0))
  })

  it('周X / 星期X：取下一个该星期几，同一天算今天', () => {
    expect(parseQuick('看电影 周六 20:00', NOW)).toMatchObject({
      title: '看电影',
      dueAt: at(2026, 11, 21, 20, 0)
    })
    expect(parseQuick('周五 20:00 健身', NOW)).toMatchObject({
      title: '健身',
      dueAt: at(2026, 11, 27, 20, 0),
      dueText: '11月27日'
    })
    expect(parseQuick('星期天 10:00', NOW).dueAt).toBe(at(2026, 11, 22, 10, 0))
    expect(parseQuick('周一 10:00', NOW).dueAt).toBe(at(2026, 11, 23, 10, 0))
  })

  it('本周X：本周内对应日（可能已过去，原型行为）', () => {
    expect(parseQuick('本周日 10:00 聚餐', NOW)).toMatchObject({
      title: '聚餐',
      dueAt: at(2026, 11, 22, 10, 0)
    })
    expect(parseQuick('本周六 09:00', NOW).dueAt).toBe(at(2026, 11, 21, 9, 0))
    expect(parseQuick('本周一 09:00', NOW).dueAt).toBe(at(2026, 11, 16, 9, 0))
  })

  it('全角冒号也接受', () => {
    expect(parseQuick('明天 9：30 开会', NOW)).toMatchObject({
      title: '开会',
      dueAt: at(2026, 11, 22, 9, 30)
    })
  })

  it('只移除第一个日期词，其余留在标题', () => {
    expect(parseQuick('明天 买牛奶 后天', NOW)).toMatchObject({
      title: '买牛奶 后天',
      dueAt: at(2026, 11, 22, 18, 0)
    })
  })
})

describe('parseQuick · 标签与优先级', () => {
  it('#标签 全部收集并去掉', () => {
    expect(parseQuick('#工作 写文档 高', NOW)).toMatchObject({
      title: '写文档',
      tagNames: ['工作'],
      priority: 3
    })
    expect(parseQuick('#a #b 任务', NOW).tagNames).toEqual(['a', 'b'])
    // 原型不做去重（由 Composer 合并时去重）
    expect(parseQuick('#a #a 任务', NOW).tagNames).toEqual(['a', 'a'])
  })

  it('高/中/低 必须出现在末尾（可带「优先级」）', () => {
    expect(parseQuick('买牛奶 高', NOW)).toMatchObject({ title: '买牛奶', priority: 3 })
    expect(parseQuick('买牛奶 中', NOW)).toMatchObject({ title: '买牛奶', priority: 2 })
    expect(parseQuick('买牛奶 低优先级', NOW)).toMatchObject({ title: '买牛奶', priority: 1 })
    expect(parseQuick('低优先级 买菜', NOW)).toMatchObject({ title: '低优先级 买菜', priority: 0 })
    expect(parseQuick('高 买菜', NOW)).toMatchObject({ title: '高 买菜', priority: 0 })
    expect(parseQuick('买菜', NOW).priority).toBe(0)
  })
})

describe('parseQuick · 链接与路径', () => {
  it('URL 摘出、display 去 scheme 且截断 38 字符', () => {
    const parsed = parseQuick('https://x.com/a #tag 明天 9:30', NOW)
    expect(parsed.links).toEqual([
      { kind: 'url', target: 'https://x.com/a', display: 'x.com/a' }
    ])
    expect(parsed.tagNames).toEqual(['tag'])
    expect(parsed.dueAt).toBe(at(2026, 11, 22, 9, 30))
    expect(parsed.title).toBe('新任务')

    const long = 'https://' + 'a'.repeat(60)
    expect(parseQuick(long, NOW).links[0].display.length).toBe(38)
  })

  it('盘符路径按扩展名区分 file/folder，标题保留剩余文字', () => {
    expect(parseQuick('C:\\Users\\a.txt 打开', NOW)).toMatchObject({
      title: '打开',
      links: [{ kind: 'file', target: 'C:\\Users\\a.txt', display: 'a.txt' }]
    })
    // docs/03 §5：C:/ 正斜杠写法同样合法（原型漏判）
    expect(parseQuick('C:/Users/a.png 打开', NOW).links).toEqual([
      { kind: 'file', target: 'C:/Users/a.png', display: 'a.png' }
    ])
    expect(parseQuick('D:\\work 备份', NOW).links).toEqual([
      { kind: 'folder', target: 'D:\\work', display: 'work' }
    ])
  })

  it('UNC 双反斜杠路径（原型 detectLink 漏判，docs/03 §5 要求支持）', () => {
    expect(parseQuick('\\\\server\\share\\dir 打开', NOW)).toMatchObject({
      title: '打开',
      links: [{ kind: 'folder', target: '\\\\server\\share\\dir', display: 'dir' }]
    })
  })

  it('file:/// 本地路径先转盘符路径（docs/03 §5）', () => {
    expect(parseQuick('file:///C:/Users/a.txt 打开', NOW)).toMatchObject({
      title: '打开',
      links: [{ kind: 'file', target: 'C:/Users/a.txt', display: 'a.txt' }]
    })
    // 百分号编码解码
    expect(parseQuick('file:///C:/Users/%E4%B8%AD.txt', NOW).links[0].target).toBe(
      'C:/Users/中.txt'
    )
  })

  it('正斜杠 UNC 不在 parseQuick 识别范围（原型行为，仅 detectLink 支持）', () => {
    const parsed = parseQuick('//server/share/dir', NOW)
    expect(parsed.links).toEqual([])
    expect(parsed.title).toBe('//server/share/dir')
  })
})

describe('detectLink', () => {
  it('接受 http(s) 与 www.（自动补 https）', () => {
    expect(detectLink('https://example.com/a?b=1')).toEqual({
      kind: 'url',
      target: 'https://example.com/a?b=1',
      display: 'example.com/a?b=1'
    })
    expect(detectLink('www.baidu.com')).toEqual({
      kind: 'url',
      target: 'https://www.baidu.com',
      display: 'www.baidu.com'
    })
    expect(detectLink('  https://a.com  ')).toEqual({
      kind: 'url',
      target: 'https://a.com',
      display: 'a.com'
    })
  })

  it('URL display 截断 44 字符', () => {
    expect(detectLink('https://' + 'a'.repeat(60))?.display.length).toBe(44)
  })

  it('接受盘符路径（含正斜杠）与 UNC', () => {
    expect(detectLink('C:\\Users\\a.txt')).toMatchObject({ kind: 'file', display: 'a.txt' })
    expect(detectLink('C:/Users/a.png')).toMatchObject({ kind: 'file', display: 'a.png' })
    expect(detectLink('D:\\x')).toMatchObject({ kind: 'folder', display: 'x' })
    expect(detectLink('//server/share/dir')).toMatchObject({ kind: 'folder', display: 'dir' })
    expect(detectLink('\\\\server\\share\\dir')).toMatchObject({ kind: 'folder', display: 'dir' })
  })

  it('file:/// 转为本地路径后判断类型（docs/03 §5）', () => {
    expect(detectLink('file:///C:/Users/a.txt')).toEqual({
      kind: 'file',
      target: 'C:/Users/a.txt',
      display: 'a.txt'
    })
    expect(detectLink('file:///C:/Users')).toMatchObject({ kind: 'folder', target: 'C:/Users' })
  })

  it('拒绝不支持的输入', () => {
    expect(detectLink('')).toBeNull()
    expect(detectLink('   ')).toBeNull()
    expect(detectLink('随便的文字')).toBeNull()
    expect(detectLink('javascript:alert(1)')).toBeNull()
    expect(detectLink('ftp://example.com/x')).toBeNull()
    expect(detectLink('mailto:a@b.com')).toBeNull()
    expect(detectLink('file://server/share/x')).toBeNull()
  })
})

describe('isLinkOnly / fmtDateTime', () => {
  it('isLinkOnly 判断整行是否为链接/路径', () => {
    expect(isLinkOnly('https://a.com')).toBe(true)
    expect(isLinkOnly('C:\\Users\\a.txt')).toBe(true)
    expect(isLinkOnly('随便的文字')).toBe(false)
    expect(isLinkOnly('')).toBe(false)
  })

  it('fmtDateTime 输出「M月D日 周X HH:mm」，日期模式只到日', () => {
    const ts = at(2026, 11, 25, 9, 0)
    expect(fmtDateTime(ts)).toBe('11月25日 周三 09:00')
    expect(fmtDateTime(ts, false)).toBe('11月25日 周三')
  })
})

describe('detectLink · darwin/posix（macOS 本地链接识别）', () => {
  it('绝对 POSIX 路径：文件按扩展名、文件夹按结尾分隔符，中文与空格原样保留', () => {
    expect(detectLink('/Users/me/报告 2024.pdf', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/报告 2024.pdf',
      display: '报告 2024.pdf'
    })
    expect(detectLink('/Users/me/项目 资料/周报 2024.xlsx', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/项目 资料/周报 2024.xlsx',
      display: '周报 2024.xlsx'
    })
    expect(detectLink('/Users/me/Documents/', DARWIN)).toEqual({
      kind: 'folder',
      target: '/Users/me/Documents/',
      display: 'Documents'
    })
    expect(detectLink('/Users/me/项目 资料', DARWIN)).toMatchObject({
      kind: 'folder',
      display: '项目 资料'
    })
  })

  it('file:/// 本机 URL 解码为 POSIX 路径；file://localhost 与大小写同样接受', () => {
    expect(detectLink('file:///Users/me/%E6%8A%A5%E5%91%8A%202024.pdf', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/报告 2024.pdf',
      display: '报告 2024.pdf'
    })
    expect(detectLink('FILE:///Users/me/A.PDF', DARWIN)).toMatchObject({
      kind: 'file',
      target: '/Users/me/A.PDF'
    })
    expect(detectLink('file://localhost/Users/me/a.txt', DARWIN)).toMatchObject({
      kind: 'file',
      target: '/Users/me/a.txt'
    })
    expect(detectLink('file:///Users/me/项目 A/', DARWIN)).toMatchObject({
      kind: 'folder',
      target: '/Users/me/项目 A/'
    })
  })

  it('成对引号（中英文）会被去掉，引号内路径照常识别', () => {
    expect(detectLink('"/Users/me/报告 2024.pdf"', DARWIN)).toEqual({
      kind: 'file',
      target: '/Users/me/报告 2024.pdf',
      display: '报告 2024.pdf'
    })
    expect(detectLink('  ‘/Users/me/文档’  ', DARWIN)).toEqual({
      kind: 'folder',
      target: '/Users/me/文档',
      display: '文档'
    })
  })

  it('Windows 路径语义在 darwin 下不识别（与主进程 opener 一致，不误判）', () => {
    expect(detectLink('//server/share/dir', DARWIN)).toBeNull()
    expect(detectLink('\\\\server\\share\\dir', DARWIN)).toBeNull()
    expect(detectLink('/cygdrive/c/Users/me', DARWIN)).toBeNull()
    expect(detectLink('C:\\Users\\a.txt', DARWIN)).toBeNull()
    expect(detectLink('C:/Users/a.txt', DARWIN)).toBeNull()
    expect(detectLink('file:///C:/Users/a.txt', DARWIN)).toBeNull()
    expect(detectLink('file://server/share/x', DARWIN)).toBeNull()
  })

  it('危险协议与相对路径在 darwin 下仍返回 null', () => {
    for (const raw of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<b>x</b>',
      'vbscript:msgbox(1)',
      'cmd:/c calc',
      'powershell:Start-Process calc',
      'mailto:a@b.com',
      'ftp://example.com/x',
      'docs/readme.txt',
      '~/Documents',
      'report.docx'
    ]) {
      expect(detectLink(raw, DARWIN)).toBeNull()
    }
  })

  it('win32 下 /Users/... 仍不识别（原有 Windows 语义零回归）', () => {
    expect(detectLink('/Users/me/a.txt', WIN32)).toBeNull()
    expect(detectLink('/Users/me/a.txt')).toBeNull()
  })
})

describe('isLinkOnly · darwin', () => {
  it('darwin 下 POSIX 路径算「只有一个链接」，win32 默认不算', () => {
    expect(isLinkOnly('/Users/me/a.txt', DARWIN)).toBe(true)
    expect(isLinkOnly('/Users/me/Documents/', DARWIN)).toBe(true)
    expect(isLinkOnly('file:///Users/me/a.txt', DARWIN)).toBe(true)
    expect(isLinkOnly('随便的文字', DARWIN)).toBe(false)
    expect(isLinkOnly('', DARWIN)).toBe(false)
    expect(isLinkOnly('/Users/me/a.txt')).toBe(false)
    expect(isLinkOnly('/Users/me/a.txt', WIN32)).toBe(false)
  })
})

describe('默认平台回退（window.api.platform → win32）', () => {
  it('运行环境注入 darwin 时默认按 macOS 识别；无 window 时回退 win32', () => {
    expect(detectLink('/Users/me/a.txt')).toBeNull()
    vi.stubGlobal('window', { api: { platform: DARWIN } })
    try {
      expect(detectLink('/Users/me/a.txt')).toEqual({
        kind: 'file',
        target: '/Users/me/a.txt',
        display: 'a.txt'
      })
    } finally {
      vi.unstubAllGlobals()
    }
    expect(detectLink('/Users/me/a.txt')).toBeNull()
  })
})

describe('parseQuick · darwin 整行本地路径（Composer 粘贴路径场景）', () => {
  const darwinOpts = { platform: DARWIN, defaultDue: null as number | null }

  it('整行单个 POSIX 文件/文件夹路径摘成链接，标题回落「新任务」', () => {
    expect(parseQuick('/Users/me/报告 2024.pdf', NOW, darwinOpts)).toMatchObject({
      title: '新任务',
      links: [{ kind: 'file', target: '/Users/me/报告 2024.pdf', display: '报告 2024.pdf' }]
    })
    expect(parseQuick('/Users/me/Documents/', NOW, darwinOpts).links).toEqual([
      { kind: 'folder', target: '/Users/me/Documents/', display: 'Documents' }
    ])
  })

  it('整行 file URL 先解码为 POSIX 路径；引号包裹同样可用', () => {
    expect(parseQuick('file:///Users/me/%E4%B8%AD%E6%96%87.txt', NOW, darwinOpts).links).toEqual([
      { kind: 'file', target: '/Users/me/中文.txt', display: '中文.txt' }
    ])
    expect(parseQuick('"/Users/me/我的 文件.pdf"', NOW, darwinOpts).links).toEqual([
      { kind: 'file', target: '/Users/me/我的 文件.pdf', display: '我的 文件.pdf' }
    ])
  })

  it('win32 语义在 darwin 下不产生链接；行内混排的 POSIX 路径也不识别（文档化取舍）', () => {
    expect(parseQuick('C:\\Users\\a.txt', NOW, darwinOpts).links).toEqual([])
    expect(parseQuick('\\\\server\\share\\dir', NOW, darwinOpts).links).toEqual([])
    const mixed = parseQuick('打开 /Users/me/a.txt', NOW, darwinOpts)
    expect(mixed.links).toEqual([])
    expect(mixed.title).toBe('打开 /Users/me/a.txt')
  })

  it('win32 下整行 /Users 路径仍不识别（默认平台零回归）', () => {
    expect(parseQuick('/Users/me/a.txt', NOW, { defaultDue: null }).links).toEqual([])
    expect(parseQuick('/Users/me/a.txt', NOW, { defaultDue: null, platform: WIN32 }).links).toEqual([])
  })
})
