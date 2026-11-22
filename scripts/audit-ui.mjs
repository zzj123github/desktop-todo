/**
 * 交互审计（真实 UI 行为回归，运行时通过 CDP 操作 dev/打包版窗口）
 *
 * 覆盖：挂件折叠输入 / 行 hover / 勾选与撤销 / 编辑窗口 / 图钉 / 胶囊 hover 与单击 /
 *       桌面视图下拉 / 双击标题 / 三态互斥 / 九视图 / tab / 筛选 / 搜索 / 分组折叠 /
 *       窗口内编辑模态 / 设置 / 管理弹窗 / 新建任务 / 关闭回桌面形态 / 数据清理。
 *
 * 前置：先以 CDP 端口启动应用（见 README「开发与构建命令」）：
 *   node scripts/dev-launch.cjs -- --remote-debugging-port=9241
 *   （或 env -u ELECTRON_RUN_AS_NODE 启动打包版并带 --remote-debugging-port）
 *
 * 用法：node scripts/audit-ui.mjs        （默认端口 9241）
 *       CDP_PORT=9242 node scripts/audit-ui.mjs
 * 产物：.agents/reports/audit/report.json + 截图（该目录已 gitignore）。
 * 退出码：0 全部通过；1 有失败；2 脚本异常。
 */
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.CDP_PORT || 9241)
const SHOT_DIR = path.resolve('.agents/reports/audit')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const report = []
let failures = 0
function check(name, cond, detail = '') {
  const status = cond ? 'PASS' : 'FAIL'
  if (!cond) failures += 1
  report.push({ name, status, detail })
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function targets() {
  return (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).filter((t) => t.type === 'page')
}

async function connect(match) {
  const list = await targets()
  const t = list.find((x) => x.url.includes(match))
  if (!t) throw new Error(`target not found: ${match}`)
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  let seq = 0
  const waiting = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && waiting.has(m.id)) {
      waiting.get(m.id)(m)
      waiting.delete(m.id)
    }
  })
  const send = (method, params) =>
    new Promise((resolve) => {
      const id = ++seq
      waiting.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true
    })
    if (r.result?.exceptionDetails) {
      throw new Error(r.result.exceptionDetails.exception?.description || 'evaluate failed')
    }
    return r.result?.result?.value
  }
  const hover = async (selector) => {
    const rect = await evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`
    )
    if (!rect) throw new Error(`hover target missing: ${selector}`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(rect.x), y: Math.round(rect.y) })
    await sleep(260)
  }
  const clickAt = async (selector) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
    await sleep(240)
  }
  const typeInto = async (selector, text, key = null) => {
    await evaluate(`(()=>{
      const el=document.querySelector(${JSON.stringify(selector)});
      el.focus();
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set;
      setter.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input',{bubbles:true}));
      return el.value;
    })()`)
    if (key) {
      await evaluate(`(()=>{
        const el=document.querySelector(${JSON.stringify(selector)});
        el.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},code:${JSON.stringify(key)},keyCode:13,which:13,bubbles:true,cancelable:true}));
      })()`)
      await sleep(320)
    }
  }
  const pressKey = async (key, code = key) => {
    await evaluate(
      `document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},code:${JSON.stringify(code)},bubbles:true,cancelable:true}))`
    )
    await sleep(260)
  }
  const screenshot = async (file, w, h) => {
    if (w && h) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false })
      await sleep(200)
    }
    const r = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SHOT_DIR, file), Buffer.from(r.result.data, 'base64'))
    await send('Emulation.clearDeviceMetricsOverride')
  }
  return { ws, send, evaluate, hover, clickAt, typeInto, pressKey, screenshot, close: () => ws.close() }
}

async function waitTarget(match, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const list = await targets()
    const found = list.find((x) => x.url.includes(match))
    if (found) return found
    await sleep(150)
  }
  return null
}

async function waitNoTarget(match, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const list = await targets()
    if (!list.some((x) => x.url.includes(match))) return true
    await sleep(150)
  }
  return false
}

const ALL_FILTER = { status: 'all', date: { mode: 'any' }, tagIds: [], priorities: [], keyword: '' }

async function main() {
  const widget = await connect('view=widget')
  const api = (expr) => widget.evaluate(expr)
  const initialAlwaysOnTop = await api(`window.api.settings.get({key:'alwaysOnTop'})`)

  // 挂件高度是主进程按渲染层上报异步调整的，读数/坐标必须在窗口稳定后再取，
  // 否则 hover 坐标会落在旧布局上（窗口高度变化中）造成假 FAIL。
  const waitHeightSettled = async (timeout = 3000) => {
    let last = -1
    let stable = 0
    const started = Date.now()
    while (Date.now() - started < timeout) {
      const h = await api('innerHeight')
      if (h === last) {
        stable += 1
        if (stable >= 2) return h
      } else {
        stable = 0
        last = h
      }
      await sleep(150)
    }
    return last
  }

  // ---------- 0. 复位 & 测试数据 ----------
  await api('window.api.widget.setCollapsed({collapsed:false})')
  await sleep(700)
  await api(`window.api.tasks.list({filter:${JSON.stringify(ALL_FILTER)}}).then(list=>list.filter(t=>t.title.startsWith('审计')).forEach(t=>window.api.tasks.delete({id:t.id})))`)
  await sleep(300)
  const projectId = await api(
    `window.api.tags.list().then(r=>{const p=r.projects.find(x=>x.name==='审计项目')||null;return p?p.id:null})`
  )
  const auditProjectId =
    projectId ||
    (await api(`window.api.tags.create({name:'审计项目',kind:'project'}).then(r=>r.tag?r.tag.id:r.id)`))
  const tagId = await api(
    `window.api.tags.list().then(r=>{const t=r.tags.find(x=>x.name==='审计标签A')||null;return t?t.id:null})`
  )
  const auditTagId =
    tagId || (await api(`window.api.tags.create({name:'审计标签A',kind:'tag'}).then(r=>r.tag?r.tag.id:r.id)`))
  const now = Date.now()
  const todayTen = new Date()
  todayTen.setHours(10, 0, 0, 0)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(18, 0, 0, 0)
  const fixtures = [
    { title: '审计任务一', dueAt: todayTen.getTime(), priority: 3, tagIds: [auditTagId], projectId: auditProjectId },
    { title: '审计任务二', dueAt: tomorrow.getTime(), priority: 1 },
    { title: '审计任务三', dueAt: null, priority: 0 },
    { title: '审计任务四', dueAt: now - 3600_000, priority: 2 }
  ]
  const ids = []
  for (const f of fixtures) {
    const t = await api(`window.api.tasks.create(${JSON.stringify(f)}).then(r=>r.id)`)
    ids.push(t)
  }
  await api(`window.api.tasks.toggle({id:${JSON.stringify(ids[3])},done:true})`)
  await api(
    `window.api.links.add({taskId:${JSON.stringify(ids[0])},target:'https://example.com/docs/very/long/path/to/mold-review-notes-2026',display:'example.com/docs/very/long/path/to/mold-revi'})`
  )
  await sleep(600)
  check('测试数据创建', ids.length === 4, `tasks=${ids.length}`)

  // ---------- 1. 挂件基础 ----------
  await api('window.api.app.showWidget({collapsed:false})')
  await waitHeightSettled()
  check('挂件可见', (await api('document.documentElement.className')) === 'view-widget')
  const widgetFit = JSON.parse(
    await api(
      `(()=>{const r=document.querySelector('.widget').getBoundingClientRect();return JSON.stringify({x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2),iw:innerWidth,ih:innerHeight})})()`
    )
  )
  check(
    '挂件卡片完整位于窗口内（窗口四周 2px 透明留白）',
    widgetFit.x >= 1 &&
      widgetFit.y >= 1 &&
      widgetFit.x + widgetFit.w <= widgetFit.iw - 0.5 &&
      widgetFit.y + widgetFit.h <= widgetFit.ih - 0.5 &&
      Math.abs(widgetFit.w - 352) < 0.5,
    JSON.stringify(widgetFit)
  )
  check('挂件折叠输入按钮存在', await api(`Boolean(document.querySelector('.w-add-btn'))`))
  await widget.screenshot('01-widget-folded.png', 356, 244)

  const baseH = await waitHeightSettled()
  await widget.clickAt('.w-add-btn')
  await waitHeightSettled()
  const openH = await api('innerHeight')
  check('点击添加按钮展开输入框', await api(`Boolean(document.querySelector('.w-add textarea'))`), `h ${baseH}->${openH}`)
  const addBottom = await api(`Math.round(document.querySelector('.w-add').getBoundingClientRect().bottom)`)
  check('展开后输入区完整可见（不被窗口裁切）', addBottom <= openH + 2, `addBottom=${addBottom} innerH=${openH}`)
  check('输入框自动聚焦', (await api('document.activeElement?.tagName')) === 'TEXTAREA')
  await widget.screenshot('02-widget-composer.png', 356, Math.min(524, openH))
  await widget.pressKey('Escape')
  await waitHeightSettled()
  check('Esc 收起输入框', await api(`Boolean(document.querySelector('.w-add-btn'))`), `h=${await api('innerHeight')}`)

  // 行 hover / 删除按钮 hover：窗口高度稳定后再取坐标；未命中时移开重试（最多 3 次）
  const hoverRowUntil = async (probe, ok) => {
    let before = null
    let after = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await widget.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4 })
      await sleep(240)
      before = await api(probe)
      await widget.hover('.task-row')
      after = await api(probe)
      if (ok(before, after)) return { before, after }
      await sleep(240)
    }
    return { before, after }
  }
  const rowHover = await hoverRowUntil(
    `getComputedStyle(document.querySelector('.task-row')).backgroundColor`,
    (a, b) => a !== b
  )
  check('任务行 hover 有背景反馈', rowHover.before !== rowHover.after, `${rowHover.before} -> ${rowHover.after}`)
  const tailHover = await hoverRowUntil(
    `getComputedStyle(document.querySelector('.task-row .t-tail')).opacity`,
    (a, b) => Number(a) === 0 && Number(b) === 1
  )
  check('行尾操作 hover 才显示', Number(tailHover.before) === 0 && Number(tailHover.after) === 1, `${tailHover.before} -> ${tailHover.after}`)

  // 勾选 + toast 撤销
  const beforeDone = await api(`window.api.tasks.list({filter:${JSON.stringify(ALL_FILTER)}}).then(l=>l.filter(t=>t.status===1).length)`)
  await widget.clickAt('.task-row .t-check')
  await sleep(500)
  const afterDone = await api(`window.api.tasks.list({filter:${JSON.stringify(ALL_FILTER)}}).then(l=>l.filter(t=>t.status===1).length)`)
  check('勾选任务完成', afterDone === beforeDone + 1, `${beforeDone} -> ${afterDone}`)
  check('完成 toast 出现', await api(`Boolean(document.querySelector('.toast'))`))
  await widget.screenshot('03-widget-toast.png', 356, 264)
  await widget.clickAt('.toast .tact')
  await sleep(500)
  const undone = await api(`window.api.tasks.list({filter:${JSON.stringify(ALL_FILTER)}}).then(l=>l.filter(t=>t.status===1).length)`)
  check('toast 撤销恢复', undone === beforeDone, `${afterDone} -> ${undone}`)

  // 点击任务行打开独立编辑窗口
  await widget.clickAt('.task-row .t-main')
  const editorTarget = await waitTarget('view=editor')
  check('点击任务行打开独立编辑窗口', Boolean(editorTarget), editorTarget?.url.replace(/^.*index\.html/, 'index.html'))
  if (editorTarget) {
    const editor = await connect('view=editor')
    // 编辑窗口为按内容自适应高度，等 React 挂载完成再断言，避免读到初始空窗
    for (let i = 0; i < 20; i++) {
      if (await editor.evaluate(`Boolean(document.querySelector('.modal.wide'))`)) break
      await sleep(150)
    }
    const info = await editor.evaluate(
      `JSON.stringify({inner:innerWidth+'x'+innerHeight,wide:Boolean(document.querySelector('.modal.wide')),overlay:Boolean(document.querySelector('.overlay')),title:document.querySelector('.modal-title')?.textContent})`
    )
    check('编辑窗口为 wide 嵌入模态、无遮罩', info.includes('"wide":true') && info.includes('"overlay":false'), info)
    // 链接标题：点击名称进入内联编辑，Enter 保存；清空后回退自动名称
    const autoTitle = await editor.evaluate(`document.querySelector('.link-row .lr-name')?.textContent?.trim()`)
    await editor.clickAt('.link-row .lr-name-btn')
    await sleep(200)
    await editor.typeInto('.link-row .lr-title-input', '模具复核说明', 'Enter')
    const editedTitle = await editor.evaluate(`document.querySelector('.link-row .lr-name')?.textContent?.trim()`)
    check('链接标题可内联编辑并保存', editedTitle === '模具复核说明', `${autoTitle} -> ${editedTitle}`)
    await editor.clickAt('.link-row .lr-name-btn')
    await sleep(150)
    await editor.typeInto('.link-row .lr-title-input', '', 'Enter')
    const fallbackTitle = await editor.evaluate(`document.querySelector('.link-row .lr-name')?.textContent?.trim()`)
    check('清空链接标题回退自动名称', Boolean(autoTitle) && fallbackTitle === autoTitle, `${editedTitle} -> ${fallbackTitle}`)
    // 地址与标题可同时修改（用户 m06711）：点击路径进入同一编辑态，改地址后重识别
    await editor.clickAt('.link-row .lr-path-btn')
    await sleep(200)
    const twoFields = await editor.evaluate(
      `JSON.stringify({target:Boolean(document.querySelector('.link-row .lr-target-input')),title:Boolean(document.querySelector('.link-row .lr-title-input'))})`
    )
    check(
      '链接编辑态同时可改地址与标题',
      twoFields.includes('"target":true') && twoFields.includes('"title":true'),
      twoFields
    )
    await editor.screenshot('03c-editor-link-edit.png', 550, 781)
    await editor.typeInto('.link-row .lr-target-input', 'https://example.com/edited/path', 'Enter')
    const editedTarget = await editor.evaluate(
      `JSON.stringify({path:document.querySelector('.link-row .lr-path')?.textContent?.trim(),name:document.querySelector('.link-row .lr-name')?.textContent?.trim()})`
    )
    check(
      '链接地址可修改并重算自动标题',
      editedTarget.includes('example.com/edited/path') && editedTarget.includes('"name":"example.com/edited/path"'),
      editedTarget
    )
    // 无效地址：拒绝并保持编辑，Esc 取消后保留原地址
    await editor.clickAt('.link-row .lr-path-btn')
    await sleep(150)
    await editor.typeInto('.link-row .lr-target-input', 'javascript:alert(1)', 'Enter')
    const invalidEdit = await editor.evaluate(
      `JSON.stringify({editing:Boolean(document.querySelector('.link-row .lr-edit')),toast:Boolean(document.querySelector('.toast'))})`
    )
    check(
      '无效链接地址被拒绝并保持编辑',
      invalidEdit.includes('"editing":true') && invalidEdit.includes('"toast":true'),
      invalidEdit
    )
    await editor.pressKey('Escape')
    await sleep(200)
    const afterEsc = await editor.evaluate(
      `JSON.stringify({editing:Boolean(document.querySelector('.link-row .lr-edit')),path:document.querySelector('.link-row .lr-path')?.textContent?.trim()})`
    )
    check(
      '无效地址 Esc 取消后保留原地址',
      !afterEsc.includes('"editing":true') && afterEsc.includes('example.com/edited/path'),
      afterEsc
    )
    await editor.screenshot('03b-editor-link-title.png', 550, 781)
    await editor.evaluate('window.close()')
    check('编辑窗口可关闭', await waitNoTarget('view=editor'))
    editor.close()
  }

  // 图钉 / 收起 / Esc
  const pin0 = await api(`window.api.settings.get({key:'alwaysOnTop'})`)
  await widget.clickAt('[data-act="toggle-pin"]')
  await sleep(400)
  const pin1 = await api(`window.api.settings.get({key:'alwaysOnTop'})`)
  check('图钉切换置顶', Boolean(pin0) !== Boolean(pin1), `${pin0} -> ${pin1}`)
  await widget.clickAt('[data-act="toggle-pin"]')
  await sleep(300)
  await widget.clickAt('[aria-label="收起为胶囊"]')
  await sleep(800)
  check('收起为胶囊', (await api('document.documentElement.className')) === 'view-capsule', `inner=${await api('innerWidth + "x" + innerHeight')}`)
  const capsuleFit = JSON.parse(
    await api(
      `(()=>{const r=document.querySelector('.capsule').getBoundingClientRect();return JSON.stringify({x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2),iw:innerWidth,ih:innerHeight})})()`
    )
  )
  check(
    '胶囊卡片完整位于窗口内（窗口四周 2px 透明留白）',
    capsuleFit.x >= 1 &&
      capsuleFit.y >= 1 &&
      capsuleFit.x + capsuleFit.w <= capsuleFit.iw - 0.5 &&
      capsuleFit.y + capsuleFit.h <= capsuleFit.ih - 0.5 &&
      Math.abs(capsuleFit.w - 284) < 0.5 &&
      Math.abs(capsuleFit.h - 54) < 0.5,
    JSON.stringify(capsuleFit)
  )
  const capGeom0 = await api(
    `(()=>{const el=document.querySelector('.capsule');const r=el.getBoundingClientRect();return JSON.stringify({y:+r.y.toFixed(2),h:+r.height.toFixed(2),t:getComputedStyle(el).transform})})()`
  )
  await widget.hover('.capsule')
  const capGeom1 = await api(
    `(()=>{const el=document.querySelector('.capsule');const r=el.getBoundingClientRect();return JSON.stringify({y:+r.y.toFixed(2),h:+r.height.toFixed(2),t:getComputedStyle(el).transform})})()`
  )
  check('胶囊 hover 不位移', capGeom0 === capGeom1, `${capGeom0} -> ${capGeom1}`)
  await widget.screenshot('04-capsule-hover.png', 288, 58)
  const capRect = JSON.parse(await api(`(()=>{const r=document.querySelector('.capsule').getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`))
  await widget.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: Math.round(capRect.x), y: Math.round(capRect.y) })
  await sleep(60)
  await widget.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: Math.round(capRect.x), y: Math.round(capRect.y) })
  await sleep(900)
  check('单击胶囊展开挂件', (await api('document.documentElement.className')) === 'view-widget', await api('document.documentElement.className'))
  await widget.screenshot('05-widget-list.png', 356, Math.min(524, await api('innerHeight')))

  // 桌面视图下拉
  await widget.clickAt('.mtitle-btn')
  await sleep(600)
  check('桌面视图下拉打开', await api(`Boolean(document.querySelector('.pop'))`))
  await widget.screenshot('06-widget-viewmenu.png', 356, Math.min(524, await api('innerHeight')))
  await widget.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: 6, y: 6 })
  await widget.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: 6, y: 6 })
  await sleep(400)
  check('点击外部关闭桌面视图下拉', !(await api(`Boolean(document.querySelector('.pop'))`)))

  // 双击标题打开完整窗口
  check('双击标题前仍为桌面形态', (await api('document.documentElement.className')) === 'view-widget', await api('document.documentElement.className'))
  await widget.evaluate(`(()=>{const el=document.querySelector('.w-title-row');if(!el)throw new Error('w-title-row missing');el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))})()`)
  const managerTarget = await waitTarget('view=manager')
  check('双击标题打开完整窗口', Boolean(managerTarget))
  await sleep(800)
  const widgetHidden = await api('document.visibilityState')
  check('三态互斥：完整窗口打开时挂件隐藏', widgetHidden === 'hidden', widgetHidden)

  // ---------- 2. 完整窗口 ----------
  const manager = await connect('view=manager')
  const mev = (expr) => manager.evaluate(expr)
  await manager.screenshot('07-manager-today.png', 1100, 720)
  const mtitle = await mev(`document.querySelector('.mtitle')?.textContent`)
  check('完整窗口标题为今天', mtitle === '今天', mtitle)

  // 导航
  for (const [label, expect] of [
    ['收件箱', '收件箱'],
    ['已逾期', '已逾期'],
    ['明天', null]
  ]) {
    if (!expect) continue
    await mev(`[...document.querySelectorAll('.nav-item')].find(e=>e.textContent.includes(${JSON.stringify(label)})).click()`)
    await sleep(400)
    const t = await mev(`document.querySelector('.mtitle')?.textContent`)
    check(`导航切换：${label}`, t === expect, t)
  }
  await mev(`[...document.querySelectorAll('.nav-item')].find(e=>e.textContent.includes('今天')).click()`)
  await sleep(400)

  // tabs
  const tabAllCount = await mev(`document.querySelectorAll('.task-row').length`)
  await mev(`[...document.querySelectorAll('.tab')].find(e=>e.textContent.includes('已完成')).click()`)
  await sleep(400)
  const doneCount = await mev(`document.querySelectorAll('.task-row').length`)
  check('tab 已完成过滤', doneCount >= 1 && doneCount < tabAllCount, `all=${tabAllCount} done=${doneCount}`)
  await mev(`[...document.querySelectorAll('.tab')].find(e=>e.textContent.includes('全部')).click()`)
  await sleep(300)

  // 筛选：标签
  await mev(`[...document.querySelectorAll('.filterbar .fbtn')].find(e=>e.textContent.includes('标签')).click()`)
  await sleep(350)
  const tagRows = await mev(`document.querySelectorAll('.pop .pop-row').length`)
  check('标签筛选浮层有项目/标签行', tagRows >= 2, `rows=${tagRows}`)
  await mev(`(()=>{const rows=[...document.querySelectorAll('.pop .pop-row')];const r=rows.find(e=>e.textContent.includes('审计标签A'));r.click()})()`)
  await sleep(450)
  const filteredRows = await mev(`document.querySelectorAll('.task-row').length`)
  check('标签筛选生效', filteredRows >= 1 && filteredRows < tabAllCount, `rows=${filteredRows}`)
  await manager.screenshot('08-manager-filtertag.png', 1100, 720)
  await mev(`document.querySelector('.fclear')?.click()`)
  await sleep(400)
  const restoredRows = await mev(`document.querySelectorAll('.task-row').length`)
  check('清除筛选恢复', restoredRows === tabAllCount, `${filteredRows} -> ${restoredRows}`)
  // 关闭浮层
  await mev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`)
  await sleep(250)

  // 浮层互斥：用程序化点击（不触发 outside mousedown）打开第二个浮层，
  // 第一个必须由全局注册器关闭，否则「保存为桌面视图」表单会与筛选浮层叠压。
  await mev(`[...document.querySelectorAll('.filterbar .fbtn')].find(e=>e.textContent.includes('优先级')).click()`)
  await sleep(300)
  const popBefore = await mev(`document.querySelectorAll('.pop').length`)
  check('优先级筛选浮层打开', popBefore === 1, `pop=${popBefore}`)
  await mev(`[...document.querySelectorAll('.pop .pop-row')].find(e=>e.textContent.includes('高'))?.click()`)
  await sleep(300)
  await mev(`document.querySelector('.mtitle-btn').click()`)
  await sleep(350)
  const popAfter = await mev(`document.querySelectorAll('.pop').length`)
  check('同一时刻只有一个 Popover（视图菜单顶替筛选浮层）', popAfter === 1, `before=${popBefore} after=${popAfter}`)
  await mev(`[...document.querySelectorAll('.pop .pop-foot button')].find(e=>e.textContent.includes('保存为桌面视图')).click()`)
  await sleep(350)
  const saveForm = await mev(`(()=>{
    const pops=document.querySelectorAll('.pop');
    const p=pops[0];
    const f=document.querySelector('.view-form input');
    const bar=document.querySelector('.filterbar');
    if(!p||!f||!bar) return 'missing';
    const r=p.getBoundingClientRect(), q=f.getBoundingClientRect(), b=bar.getBoundingClientRect();
    const inside = q.top>=r.top-1 && q.bottom<=r.bottom+1;
    return JSON.stringify({pops:pops.length,inside});
  })()`)
  check('保存视图表单完整且只剩一个 Popover', saveForm.includes('"pops":1') && saveForm.includes('"inside":true'), saveForm)
  await mev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`)
  await sleep(250)
  await mev(`document.querySelector('.fclear')?.click()`)
  await sleep(300)

  // 搜索
  await mev(`document.querySelector('.fright .icon-btn')?.click()`)
  await sleep(300)
  check('搜索框打开', await mev(`Boolean(document.querySelector('.searchbox input'))`))
  await manager.typeInto('.searchbox input', '审计任务一')
  await sleep(500)
  const searchRows = await mev(`document.querySelectorAll('.task-row').length`)
  check('搜索过滤', searchRows === 1, `rows=${searchRows}`)
  await manager.pressKey('Escape')
  await sleep(350)
  check('Esc 关闭搜索并恢复', (await mev(`document.querySelectorAll('.task-row').length`)) === tabAllCount)

  // 分组折叠
  const firstGroup = await mev(`document.querySelector('.group-head')?.outerHTML`)
  check('分组头存在', Boolean(firstGroup))
  await mev(`document.querySelector('.group-head .chev')?.click()`)
  await sleep(350)
  check('分组可折叠', await mev(`Boolean(document.querySelector('.group-head .chev.closed'))`))
  await mev(`document.querySelector('.group-head .chev')?.click()`)
  await sleep(300)

  // 行点击 -> 窗口内模态
  await mev(`document.querySelector('.task-row .t-main').click()`)
  await sleep(500)
  check('完整窗口内点击任务打开模态', await mev(`Boolean(document.querySelector('.overlay .modal.wide'))`))
  await manager.screenshot('09-manager-editor-modal.png', 1100, 720)

  // 时间列表滚轮平滑滚动（用户 m06992）：原生滚轮一次跳 5 行，这里改为应用内缓动
  await mev(`document.querySelector('.modal .dp-field')?.click()`)
  await sleep(700)
  await mev(`(()=>{const b=document.querySelector('.dp-time-pick');if(b)b.click();return !!b})()`)
  await sleep(450)
  const smoothList = await mev(`(()=>{
    const el=document.querySelector('.dp-tl-scroll');
    if(!el) return null;
    el.scrollTop=0;
    const r=el.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.x+8),y:Math.round(r.y+r.height/2)});
  })()`)
  check('时间列表展开（滚轮平滑前置）', Boolean(smoothList), smoothList || '')
  if (smoothList) {
    const pt = JSON.parse(smoothList)
    await mev(`(()=>{const el=document.querySelector('.dp-tl-scroll');window.__aw=[];function f(){window.__aw.push(el.scrollTop);if(window.__aw.length<1200)requestAnimationFrame(f)}requestAnimationFrame(f);return true})()`)
    for (let k = 0; k < 2; k += 1) {
      await manager.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: pt.x, y: pt.y, deltaX: 0, deltaY: 120 })
      await sleep(150)
    }
    await sleep(500)
    const tops = (await mev(`window.__aw||[]`)).map((n) => Number(Number(n).toFixed(2)))
    const uniq = [...new Set(tops)]
    const finalTop = tops.length ? tops[tops.length - 1] : 0
    check('时间列表滚轮平滑滚动（出现中间帧）', uniq.length >= 4 && finalTop >= 90, `uniq=${uniq.length} final=${finalTop}`)
    await manager.screenshot('13-dp-smooth-scroll.png', 1100, 720)
    // prefers-reduced-motion：直接定位、不播动画
    await manager.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await mev(`document.querySelector('.dp-tl-scroll').scrollTop=0`)
    await manager.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: pt.x, y: pt.y, deltaX: 0, deltaY: 120 })
    await sleep(180)
    const rmTop = await mev(`document.querySelector('.dp-tl-scroll').scrollTop`)
    check('reduced-motion 下时间列表直接定位', rmTop === 48, `top=${rmTop}`)
    await manager.send('Emulation.setEmulatedMedia', { features: [] })
    await mev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`)
    await sleep(350)
    const escKeptModal = await mev(`Boolean(document.querySelector('.overlay .modal')) && !document.querySelector('.dp-pop')`)
    check('Esc 只关日期浮层不关模态', escKeptModal)
  }
  await mev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`)
  await sleep(500)
  check('Esc 只关模态不关窗口', await mev(`Boolean(document.querySelector('.mgr')) && !document.querySelector('.overlay')`))

  // 设置
  await mev(`[...document.querySelectorAll('.sb-foot .sb-settings')].find(b=>b.textContent.includes('设置')).click()`)
  await sleep(500)
  const setRows = await mev(`document.querySelectorAll('.set-row').length`)
  check('设置弹窗行数', setRows === 8, `rows=${setRows}`)
  await manager.screenshot('10-manager-settings.png', 1100, 720)
  // 切换置顶开关
  const topBefore = await mev(`window.api.settings.get({key:'alwaysOnTop'})`)
  await mev(`document.querySelector('.set-row .switch').click()`)
  await sleep(400)
  const topAfter = await mev(`window.api.settings.get({key:'alwaysOnTop'})`)
  check('设置置顶开关生效', Boolean(topBefore) !== Boolean(topAfter), `${topBefore} -> ${topAfter}`)
  await mev(`document.querySelector('.set-row .switch').click()`)
  await sleep(300)
  // 透明度
  const segBtns = await mev(`document.querySelectorAll('.seg-mini button').length`)
  check('透明度三档存在', segBtns === 3, `buttons=${segBtns}`)
  await mev(`[...document.querySelectorAll('.seg-mini button')].find(b=>b.textContent.includes('90')).click()`)
  await sleep(400)
  check('透明度 90% 生效', (await mev(`window.api.settings.get({key:'opacity'})`)) === 0.9)
  await mev(`[...document.querySelectorAll('.seg-mini button')].find(b=>b.textContent.includes('100')).click()`)
  await sleep(300)
  // 从设置进入管理
  await mev(`[...document.querySelectorAll('.set-row button')].find(b=>b.textContent.includes('管理')).click()`)
  await sleep(500)
  check('设置进入管理弹窗', await mev(`Boolean(document.querySelector('.manage-modal'))`))
  await manager.screenshot('11-manager-manage.png', 1100, 720)
  // 新建标签
  await mev(`[...document.querySelectorAll('.mg-btn, .mg-add button, .mg-add')].length`)
  const createRes = await mev(`(async()=>{
    const add=document.querySelector('.mg-sec .mg-add button, .mg-sec .mg-add');
    if(add){add.click();await new Promise(r=>setTimeout(r,150));}
    const input=document.querySelector('.mg-input');
    if(!input) return 'no-input';
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,'审计临时标签');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
    await new Promise(r=>setTimeout(r,400));
    return document.querySelector('.manage-modal')?.textContent.includes('审计临时标签') ? 'created':'missing';
  })()`)
  check('管理弹窗新建标签', createRes === 'created', String(createRes))
  // 删除该标签（无任务，直接删 + toast 撤销）
  const tagDeleteRes = await mev(`(async()=>{
    const rows=[...document.querySelectorAll('.mg-row')];
    const row=rows.find(r=>r.textContent.includes('审计临时标签'));
    if(!row) return 'row-missing';
    const del=row.querySelector('.mg-act.danger'); if(!del) return 'del-missing';
    del.click(); await new Promise(r=>setTimeout(r,400));
    const toast=document.querySelector('.toast'); return toast? 'deleted':'no-toast';
  })()`)
  check('管理弹窗删除标签并提示撤销', tagDeleteRes === 'deleted', String(tagDeleteRes))
  await mev(`document.querySelector('.toast .tact')?.click()`)
  await sleep(400)
  check('撤销删除恢复标签', await mev(`document.querySelector('.manage-modal')?.textContent.includes('审计临时标签')`))
  // 清理：再次删除且不撤销
  await mev(`(async()=>{
    const rows=[...document.querySelectorAll('.mg-row')];
    const row=rows.find(r=>r.textContent.includes('审计临时标签'));
    row?.querySelector('.mg-act.danger')?.click();
    await new Promise(r=>setTimeout(r,300));
  })()`)
  await sleep(300)
  // 关闭管理 -> 回设置 -> 关闭设置
  await mev(`document.querySelector('.modal-x').click()`)
  await sleep(500)
  check('管理关闭返回设置', await mev(`Boolean(document.querySelector('.set-row')) && !document.querySelector('.manage-modal')`))
  await mev(`document.querySelector('.modal-x').click()`)
  await sleep(400)

  // 使用说明：侧栏 footer 入口在设置之上，打开 wide 只读弹窗，知道了关闭
  const footOrder = await mev(
    `JSON.stringify([...document.querySelectorAll('.sb-foot .sb-settings')].map(e=>e.textContent.trim()))`
  )
  const footList = JSON.parse(footOrder)
  check(
    '侧栏 footer 使用说明在设置之上',
    footList.length === 2 && footList[0].includes('使用说明') && footList[1].includes('设置'),
    footOrder
  )
  await mev(`[...document.querySelectorAll('.sb-foot .sb-settings')].find(b=>b.textContent.includes('使用说明')).click()`)
  await sleep(500)
  const helpInfo = await mev(`(()=>{
    const m=document.querySelector('.overlay .modal.wide');
    if(!m) return 'missing';
    return JSON.stringify({
      title:m.querySelector('.modal-title')?.textContent,
      sections:m.querySelectorAll('.help-section').length,
      foot:[...m.querySelectorAll('.modal-foot button')].map(b=>b.textContent.trim())
    });
  })()`)
  check(
    '使用说明弹窗分节完整且 footer 仅知道了',
    helpInfo.includes('"title":"使用说明"') &&
      helpInfo.includes('"sections":6') &&
      helpInfo.includes('知道了'),
    helpInfo
  )
  await manager.screenshot('12-manager-help.png', 1100, 720)
  await mev(`[...document.querySelectorAll('.modal-foot button')].find(b=>b.textContent.includes('知道了')).click()`)
  await sleep(400)
  check('使用说明知道了关闭', !(await mev(`Boolean(document.querySelector('.overlay'))`)))

  // 新建任务（编辑器）
  await mev(`[...document.querySelectorAll('.mhead-r button')].find(b=>b.textContent.includes('新建')).click()`)
  await sleep(500)
  check('新建打开编辑器', await mev(`Boolean(document.querySelector('.overlay .modal.wide'))`))
  // 空链接：空态与拖拽区文案必须区分，不得出现两处相同提示
  const emptyLinkCopy = await mev(`(()=>{
    const m=document.querySelector('.overlay .modal');
    if(!m) return 'missing';
    const empty=m.querySelector('.m-empty')?.textContent?.trim()||'';
    const dz=m.querySelector('.dropzone')?.textContent?.trim()||'';
    return JSON.stringify({empty,dz,dup:empty===dz});
  })()`)
  check(
    '空链接提示为「还没有链接」且拖拽区文案独立',
    emptyLinkCopy.includes('还没有链接') &&
      emptyLinkCopy.includes('把文件 / 文件夹拖到这里') &&
      emptyLinkCopy.includes('"dup":false'),
    emptyLinkCopy
  )
  // 添加链接行：地址 + 标题两个输入，添加时可直接填标题（用户 m06711）
  const addForm = await mev(`(()=>{
    const row=document.querySelector('.overlay .add-link-row');
    if(!row) return 'missing';
    return JSON.stringify({inputs:row.querySelectorAll('input').length,target:Boolean(row.querySelector('.link-target-input')),title:Boolean(row.querySelector('.link-title-input'))});
  })()`)
  check(
    '添加链接行含地址与标题两个输入',
    addForm.includes('"inputs":2') && addForm.includes('"target":true') && addForm.includes('"title":true'),
    addForm
  )
  await manager.typeInto('.overlay .add-link-row .link-target-input', 'https://example.com/audit/link')
  await manager.typeInto('.overlay .add-link-row .link-title-input', '审计链接标题')
  await manager.evaluate(`document.querySelector('.overlay .add-link-row .btn-sm').click()`)
  await sleep(400)
  const addedLink = await mev(`JSON.stringify({name:document.querySelector('.overlay .link-row .lr-name')?.textContent?.trim(),path:document.querySelector('.overlay .link-row .lr-path')?.textContent?.trim()})`)
  check(
    '添加链接时可直接填标题',
    addedLink.includes('审计链接标题') && addedLink.includes('example.com/audit/link'),
    addedLink
  )
  await manager.typeInto('.modal .text-input', '审计新建任务')
  await manager.clickAt('.modal .btn-pri')
  await sleep(700)
  check('新建任务保存成功', await mev(`Boolean(document.querySelector('.mgr')) && document.querySelectorAll('.task-row').length >= 1`))

  // ---------- 3. 收尾 ----------
  await mev('window.close()')
  const managerGone = await waitNoTarget('view=manager')
  check('关闭完整窗口', managerGone)
  await sleep(900)
  check('关闭完整窗口后回到桌面形态', (await api('document.documentElement.className')) === 'view-widget', await api('document.documentElement.className'))

  await api(`window.api.tasks.list({filter:${JSON.stringify(ALL_FILTER)}}).then(list=>list.filter(t=>t.title.startsWith('审计')).forEach(t=>window.api.tasks.delete({id:t.id})))`)
  await api(`window.api.tags.delete({id:${JSON.stringify(auditTagId)}})`)
  await api(`window.api.tags.delete({id:${JSON.stringify(auditProjectId)}})`)
  await sleep(500)
  const leftovers = await api(`window.api.tasks.list({filter:${JSON.stringify(ALL_FILTER)}}).then(l=>l.filter(t=>t.title.startsWith('审计')).length)`)
  check('测试数据清理', leftovers === 0, `leftover=${leftovers}`)

  // 恢复审计前的设置
  await api(`window.api.settings.set({key:'alwaysOnTop',value:${initialAlwaysOnTop ? 'true' : 'false'}})`)
  await api(`window.api.settings.set({key:'opacity',value:1})`)
  await api('window.api.widget.setCollapsed({collapsed:false})')
  await sleep(300)
  check('审计后恢复设置', (await api(`window.api.settings.get({key:'opacity'})`)) === 1)

  manager.close()
  widget.close()

  const out = path.join(SHOT_DIR, 'report.json')
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), failures, report }, null, 2))
  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAIL`} — report: ${out}`)
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((err) => {
  console.error('AUDIT CRASH:', err)
  process.exitCode = 2
})
