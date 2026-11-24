/* =========================================================
   interactions.js · 所有交互行为
   ========================================================= */
(function(){
'use strict';
var DT = window.DT;
var R = window.R;
var esc = DT.escapeHtml;
var ED = null;      // 编辑面板状态
var POP = null;     // 当前浮层
var DP = null;      // 自定义日期时间选择器状态
var MG = null;      // 项目/标签管理面板状态
var DEL = null;     // 待确认的项目/标签删除

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function focusSoon(el, select){
  if(!el) return;
  setTimeout(function(){
    try{ el.focus(); if(select && el.select) el.select(); }catch(e){}
  }, 20);
}

/* ---------------- toast ---------------- */
function toast(msg, action){
  var host = document.getElementById('toastHost');
  if(!host) return;
  var el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<svg class="ic tic"><use href="#i-check"/></svg><span>'+esc(msg)+'</span>'
    + (action ? '<button type="button" class="tact">'+esc(action.label||'撤销')+'</button>' : '');
  host.appendChild(el);
  var timer = setTimeout(remove, 4400);
  function remove(){
    clearTimeout(timer);
    el.style.transition = 'opacity .18s';
    el.style.opacity = '0';
    setTimeout(function(){ el.remove(); }, 200);
  }
  if(action){
    el.querySelector('.tact').addEventListener('click', function(){
      try{ action.fn(); }catch(e){}
      remove();
    });
  }
}

/* ---------------- 浮层 ---------------- */
function positionPop(){
  if(!POP) return;
  var el = POP.el, rect = POP.rect;
  el.style.left = '0px'; el.style.top = '0px';
  var w = el.offsetWidth, h = el.offsetHeight;
  var left = DT.clamp(rect.left, 12, Math.max(12, window.innerWidth - w - 12));
  var top = rect.bottom + 6;
  if(top + h > window.innerHeight - 12) top = Math.max(12, rect.top - h - 6);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}
function openPop(anchor, build){
  closePops();
  if(!anchor) return;
  var el = document.createElement('div');
  el.className = 'pop';
  el.setAttribute('role','dialog');
  document.getElementById('popLayer').appendChild(el);
  POP = {el:el, build:build, rect:anchor.getBoundingClientRect()};
  refreshPop();
}
function refreshPop(){
  if(!POP) return;
  POP.el.innerHTML = POP.build();
  positionPop();
}
function closePops(){
  var layer = document.getElementById('popLayer');
  if(layer) layer.innerHTML = '';
  POP = null;
}

/* ---------------- 自定义日期时间选择器 ---------------- */
function dpClose(){
  DP = null;
  var el = document.getElementById('dpPop');
  if(el){ el.hidden = true; el.innerHTML = ''; }
}
function positionDp(){
  if(!DP) return;
  var el = document.getElementById('dpPop');
  if(!el || el.hidden) return;
  var r = DP.rect;
  el.style.left = '0px'; el.style.top = '0px';
  var w = el.offsetWidth, h = el.offsetHeight;
  var left = DT.clamp(r.left, 12, Math.max(12, window.innerWidth - w - 12));
  var top = r.bottom + 6;
  if(top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 6);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}
function dpRender(){
  if(!DP) return;
  var el = document.getElementById('dpPop');
  if(!el) return;
  el.innerHTML = R.dpPopHtml(DP);
  positionDp();
  if(DP.timeList) dpScrollTimeLists();
}
function dpOpen(trigger){
  if(DP && DP.trigger === trigger){ dpClose(); return; }
  var scope = trigger.getAttribute('data-scope');
  var cscope = trigger.getAttribute('data-cscope');
  var mode = trigger.getAttribute('data-mode') || 'datetime';
  var sel = R.dpDate(trigger.getAttribute('data-value'));
  var base = sel || new Date();
  var el = document.getElementById('dpPop');
  if(!el) return;
  DP = {
    trigger: trigger, scope: scope, cscope: cscope, mode: mode,
    sel: sel ? sel.toISOString() : null,
    view: {y: base.getFullYear(), m: base.getMonth()},
    timeList: false,
    rect: trigger.getBoundingClientRect()
  };
  el.hidden = false;
  dpRender();
}
function dpPickDay(iso){
  if(!DP) return;
  var d = R.dpDate(iso);
  if(!d) return;
  var prev = R.dpDate(DP.sel);
  if(DP.mode === 'datetime'){
    if(prev) d.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    else d.setHours(18, 0, 0, 0);
    if(DT.sameDay(d, new Date()) && d.getTime() < DT.nowMinute().getTime()){
      var ns = DT.nextSlot(new Date());
      d.setHours(ns.getHours(), ns.getMinutes(), 0, 0);
    }
  } else {
    d.setHours(0, 0, 0, 0);
  }
  DP.sel = d.toISOString();
  DP.view = {y: d.getFullYear(), m: d.getMonth()};
  dpRender();
}
function dpQuick(t){
  if(!DP) return;
  var parts = String(t || '').split(':');
  var base = R.dpDate(DP.sel) || new Date();
  base.setHours(parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, 0, 0);
  if(DT.sameDay(base, new Date()) && base.getTime() < DT.nowMinute().getTime()){
    toast('这个时间已经过去了，选一个之后的');
    return;
  }
  DP.sel = base.toISOString();
  dpRender();
}
function dpTimeSync(){
  if(!DP) return null;
  var hEl = document.getElementById('dpHour'), mEl = document.getElementById('dpMin');
  if(!hEl || !mEl) return null;
  var base = R.dpDate(DP.sel) || new Date();
  var hh = parseInt(hEl.value,10), mm = parseInt(mEl.value,10);
  if(isNaN(hh)) hh = base.getHours();
  if(isNaN(mm)) mm = base.getMinutes();
  hh = DT.clamp(hh, 0, 23); mm = DT.clamp(mm, 0, 59);
  base.setHours(hh, mm, 0, 0);
  DP.sel = base.toISOString();
  return {h: hh, m: mm};
}
function dpPaintTimeLists(){
  var v = dpTimeSync();
  if(!v) return;
  var hs = document.getElementById('dpHourList'), ms = document.getElementById('dpMinList');
  if(hs){ Array.prototype.forEach.call(hs.children, function(b){ b.classList.toggle('on', parseInt(b.getAttribute('data-v'),10) === v.h); }); }
  if(ms){ Array.prototype.forEach.call(ms.children, function(b){ b.classList.toggle('on', parseInt(b.getAttribute('data-v'),10) === v.m); }); }
}
function dpScrollTimeLists(){
  var hs = document.getElementById('dpHourList'), ms = document.getElementById('dpMinList');
  var hEl = document.getElementById('dpHour'), mEl = document.getElementById('dpMin');
  if(hs && hEl){ var hh = parseInt(hEl.value,10); if(!isNaN(hh)) hs.scrollTop = Math.max(0, hh*24 - 48); }
  if(ms && mEl){ var mm = parseInt(mEl.value,10); if(!isNaN(mm)) ms.scrollTop = Math.max(0, mm*24 - 48); }
}
/* 时间列表（时/分）滚轮平滑滚动：与 src/renderer/src/lib/scroll.ts 同一口径——
   增量归一（像素×0.4 / 行×24 / 页×clientHeight，单次限幅 ±120）→ 目标夹取 → rAF ease-out 160ms。
   键盘方向键与拖动滚动条不拦截，保留原生行为；弹层重绘后元素重建，状态放 WeakMap 天然失效。 */
var TL_SCROLL_DURATION = 160;
var TL_SCROLL_MAX_STEP = 120;
var TL_SCROLL_ROW = 24;
var tlScrollStates = new WeakMap();
var tlReducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

function tlScrollDelta(e, el){
  if(!isFinite(e.deltaY) || e.deltaY === 0) return 0;
  var raw;
  if(e.deltaMode === 1) raw = e.deltaY * TL_SCROLL_ROW;              /* 行模式 */
  else if(e.deltaMode === 2) raw = e.deltaY * el.clientHeight;       /* 页模式 */
  else raw = e.deltaY * 0.4;                                         /* 像素/触控板增量按比例缩放 */
  return DT.clamp(raw, -TL_SCROLL_MAX_STEP, TL_SCROLL_MAX_STEP);
}
function tlScrollState(el){
  var st = tlScrollStates.get(el);
  if(!st){
    st = {from:el.scrollTop, target:el.scrollTop, start:0, raf:0};
    tlScrollStates.set(el, st);
  }
  return st;
}
function tlScrollStop(el){
  var st = tlScrollStates.get(el);
  if(st && st.raf){ cancelAnimationFrame(st.raf); st.raf = 0; }
}
function tlScrollBy(el, delta){
  if(!delta) return;
  var st = tlScrollState(el);
  if(st.raf){ cancelAnimationFrame(st.raf); st.raf = 0; }  /* 连续滚轮：从当前可见位置重新起一段，不叠加动画 */
  var max = Math.max(0, el.scrollHeight - el.clientHeight);
  var from = el.scrollTop;
  var target = DT.clamp(from + delta, 0, max);
  if(target === from) return;
  if(tlReducedMotion && tlReducedMotion.matches){ el.scrollTop = target; return; }
  st.from = from;
  st.target = target;
  st.start = performance.now();
  function frame(now){
    var p = DT.clamp((now - st.start) / TL_SCROLL_DURATION, 0, 1);
    var k = 1 - Math.pow(1 - p, 3);                        /* ease-out cubic */
    el.scrollTop = st.from + (st.target - st.from) * k;
    if(p < 1){
      st.raf = requestAnimationFrame(frame);
    } else {
      st.raf = 0;
      el.scrollTop = st.target;
    }
  }
  st.raf = requestAnimationFrame(frame);
}
function handleTimeListWheel(e){
  var el = e.target && e.target.closest ? e.target.closest('.dp-tl-scroll') : null;
  if(!el) return;
  e.preventDefault();
  tlScrollBy(el, tlScrollDelta(e, el));
}
/* 拖动滚动条 / 点列表项时让位原生滚动，先取消未结束的缓动 */
function stopTimeListScrolls(e){
  if(!e.target || !e.target.closest || !e.target.closest('.dp-tl-scroll')) return;
  var lists = document.querySelectorAll('#dpPop .dp-tl-scroll');
  for(var i=0;i<lists.length;i++) tlScrollStop(lists[i]);
}
function dpToggleTimeList(){
  if(!DP) return;
  dpTimeSync();
  DP.timeList = !DP.timeList;
  dpRender();
}
function dpListPick(kind, v){
  var el = document.getElementById(kind === 'h' ? 'dpHour' : 'dpMin');
  if(!el) return;
  var n = parseInt(v,10);
  el.value = DT.pad2(isNaN(n) ? 0 : DT.clamp(n, 0, kind === 'h' ? 23 : 59));
  dpPaintTimeLists();
  if(DP && DP.timeList) dpRender();
}
function dpCommit(clear){
  if(!DP) return;
  var scope = DP.scope, cscope = DP.cscope, mode = DP.mode;
  var when = null;
  if(!clear){
    var base = R.dpDate(DP.sel) || new Date();
    if(mode === 'datetime'){
      var hEl = document.getElementById('dpHour'), mEl = document.getElementById('dpMin');
      var hh = parseInt(hEl ? hEl.value : '', 10);
      var mm = parseInt(mEl ? mEl.value : '', 10);
      var fb = DT.nextSlot(new Date());
      hh = isNaN(hh) ? (DP.sel ? base.getHours() : fb.getHours()) : DT.clamp(hh, 0, 23);
      mm = isNaN(mm) ? (DP.sel ? base.getMinutes() : fb.getMinutes()) : DT.clamp(mm, 0, 59);
      base.setHours(hh, mm, 0, 0);
      if(base.getTime() < DT.nowMinute().getTime()){
        toast('不能选择当前时间之前');
        dpRender();
        return;
      }
    } else {
      base.setHours(0, 0, 0, 0);
    }
    when = base.toISOString();
  }
  dpClose();
  if(scope === 'editor'){
    if(ED){ ED.draft.due = when; rerenderEditor(); }
  } else if(scope === 'composer'){
    R.draft[cscope].due = when;
    refreshComposer(cscope);
    closePops();
  } else if(scope === 'filter'){
    DT.state.ui.filters.date = when ? {type:'custom', value:DT.dateKey(new Date(when))} : null;
    DT.save(); R.renderAll(); closePops();
  }
}
function dpStep(delta){
  if(!DP) return;
  var m = DP.view.m + delta, y = DP.view.y;
  if(m < 0){ m = 11; y--; } else if(m > 11){ m = 0; y++; }
  DP.view = {y: y, m: m};
  dpRender();
}

/* ---------------- 编辑器 ---------------- */
function editorDefaults(){
  var nav = DT.state.ui.nav;
  var d = {title:'', note:'', projectId:null, tagIds:[], priority:'none', due:null, links:[]};
  if(nav.type==='project') d.projectId = nav.id;
  if(nav.type==='tag') d.tagIds = [nav.id];
  return d;
}
function openEditor(id){
  closePops();
  var t = id ? DT.taskById(id) : null;
  var draft;
  if(t){
    draft = {title:t.title, note:t.note||'', projectId:t.projectId||null,
      tagIds:(t.tagIds||[]).slice(), priority:t.priority||'none', due:t.due||null,
      links:(t.links||[]).map(function(lk){ return {id:lk.id,type:lk.type,name:lk.name,path:lk.path}; })};
  } else {
    draft = editorDefaults();
  }
  ED = {isNew:!t, taskId:t?t.id:null, draft:draft, addingProject:false, addingTag:false, deleteConfirm:false};
  R.overlayOpen(R.editorModal(ED));
  focusSoon($('#edTitle'), true);
}
function rerenderEditor(){
  if(!ED) return;
  var ov = document.getElementById('overlay');
  if(!ov || ov.hidden) return;
  R.overlayUpdate(R.editorModal(ED));
}
/* ---------------- 链接行内编辑（地址 + 标题双字段） ---------------- */
/* 自动标题规则与 src/renderer/src/lib/links.ts autoLinkTitle 一致：
   URL 去协议截 44 字（DT.detectLink），路径取最后一段；识别失败退回原始文本。 */
function autoLinkTitle(lk){
  if(!lk) return '';
  var d = DT.detectLink(lk.path);
  return (d && d.name) || lk.path || '';
}
/* 标题与路径都点得开；field 决定先聚焦哪个输入框。 */
function startLinkEdit(i, field){
  if(!ED) return;
  var lk = ED.draft.links[i];
  if(!lk) return;
  field = field || 'title';
  if(ED.linkEdit && ED.linkEdit.i!==i) commitLinkEdit();
  if(ED.linkEdit && ED.linkEdit.i===i && ED.linkEdit.field===field) return;
  ED.linkEdit = {i:i, field:field};
  rerenderEditor();
  focusSoon($(field==='target' ? '#edLinkTarget' : '#edLinkTitle'), true);
}
/* Enter / 失焦保存：地址重新识别 url / folder / file 并更新图标；无效地址 toast 且保持编辑态；
   标题 trim 后为空回退自动标题。故意不在 commit 内立即重绘：失焦由点击触发时，
   同步重绘会让 mousedown 后的 click 落空（保存 / 取消被吞），改为下一轮事件循环里补一次重绘。 */
function commitLinkEdit(){
  if(!ED || !ED.linkEdit) return;
  var i = ED.linkEdit.i;
  var lk = ED.draft.links[i];
  var titleEl = document.getElementById('edLinkTitle');
  var targetEl = document.getElementById('edLinkTarget');
  if(!lk || !titleEl || !targetEl){ ED.linkEdit = null; return; }
  var parsed = DT.parseLinkInput(targetEl.value, titleEl.value);
  if(!parsed){
    toast('不支持的链接格式，请粘贴网址、文件夹路径或 UNC 共享路径');
    return;
  }
  lk.type = parsed.type;
  lk.path = parsed.path;
  lk.name = parsed.name;
  ED.linkEdit = null;
  setTimeout(function(){
    if(ED && !ED.linkEdit && document.getElementById('edLinkTitle')) rerenderEditor();
  }, 0);
}
function cancelLinkEdit(){
  if(!ED || !ED.linkEdit) return;
  ED.linkEdit = null;
  rerenderEditor();
}
function closeOverlay(){
  R.overlayClose();
  ED = null;
  MG = null;
  DEL = null;
  R.renderAll();
}

/* ---------------- 项目 / 标签 管理 ---------------- */
function openManage(scope, fromSettings){
  closePops();
  MG = {adding:null, rename:null, scope:scope||null, fromSettings:!!fromSettings};
  R.overlayOpen(R.manageModal(MG));
}
function rerenderManage(){
  if(!MG) return;
  var ov = document.getElementById('overlay');
  if(!ov || ov.hidden) return;
  R.overlayUpdate(R.manageModal(MG));
}
function manageFocus(kind){
  if(!MG) return;
  if(kind) MG.adding = kind;
  rerenderManage();
  focusSoon(document.getElementById(kind==='project'?'mgNewProject':'mgNewTag'), true);
}
function manageCreate(kind){
  var inp = document.getElementById(kind==='project'?'mgNewProject':'mgNewTag');
  var name = inp ? inp.value.trim() : '';
  if(kind==='tag') name = name.replace(/^#/,'').trim();
  if(!name){ toast('请输入'+(kind==='project'?'项目':'标签')+'名称'); if(inp) inp.focus(); return; }
  var list = kind==='project' ? DT.state.projects : DT.state.tags;
  var dup = list.filter(function(x){ return x.name===name; })[0];
  if(dup){ toast('已有同名'+(kind==='project'?'项目':'标签')+'「'+dup.name+'」'); if(inp){ inp.focus(); inp.select(); } return; }
  var item = kind==='project' ? DT.createProject(name) : DT.createTag(name);
  if(!item){ toast('创建失败'); return; }
  MG.adding = null;
  R.renderAll();
  rerenderManage();
  toast('已创建'+(kind==='project'?'项目':'标签')+'：'+item.name);
}
function manageRenameSave(){
  if(!MG || !MG.rename) return;
  var inp = $('#mgRenameInput');
  var name = inp ? inp.value.trim() : '';
  var kind = MG.rename.kind, id = MG.rename.id;
  var res = kind==='project' ? DT.renameProject(id,name) : DT.renameTag(id,name);
  if(!res.ok){
    if(res.code==='empty') toast('名称不能为空');
    else if(res.code==='duplicate') toast('已有同名'+(kind==='project'?'项目':'标签')+'「'+res.item.name+'」');
    else toast('找不到这一项');
    if(inp) inp.focus();
    return;
  }
  MG.rename = null;
  R.renderAll();
  rerenderManage();
  toast('已重命名为：'+res.item.name);
}
function deleteImpact(kind,id){
  var list = DT.state.tasks.filter(function(t){
    return kind==='project' ? t.projectId===id : (t.tagIds||[]).indexOf(id)>=0;
  });
  return {total:list.length, pending:list.filter(function(t){ return !t.done; }).length};
}
function requestDelete(kind,id,fromManage){
  if(!id) return;
  var impact = deleteImpact(kind,id);
  if(impact.total>0){
    DEL = {kind:kind, id:id, impact:impact, fromManage:!!fromManage};
    R.overlayOpen(R.deleteConfirmModal(DEL));
    return;
  }
  DEL = null;
  performDelete(kind,id,fromManage);
}
function cancelDeleteConfirm(){
  var d = DEL;
  DEL = null;
  if(!d) return;
  if(d.fromManage && MG) R.overlayOpen(R.manageModal(MG));
  else R.overlayClose();
}
function confirmDelete(){
  var d = DEL;
  DEL = null;
  if(!d) return;
  performDelete(d.kind,d.id,d.fromManage);
}
function performDelete(kind,id,fromManage){
  var rec = kind==='project' ? DT.deleteProject(id) : DT.deleteTag(id);
  if(!rec) return;
  if(MG && MG.rename && MG.rename.kind===kind && MG.rename.id===id) MG.rename=null;
  DT.state.ui.tab = 'all';
  R.renderAll();
  if(fromManage && MG) rerenderManage();
  else R.overlayClose();
  if(kind==='project'){
    toast('已删除项目「'+rec.project.name+'」', {label:'撤销', fn:function(){
      DT.restoreProject(rec); R.renderAll(); if(MG) rerenderManage();
    }});
  } else {
    toast('已删除标签「'+rec.tag.name+'」', {label:'撤销', fn:function(){
      DT.restoreTag(rec); R.renderAll(); if(MG) rerenderManage();
    }});
  }
}
function saveEditor(){
  if(!ED) return;
  var d = ED.draft;
  var titleEl = $('#edTitle'), noteEl = $('#edNote');
  if(titleEl) d.title = titleEl.value;
  if(noteEl) d.note = noteEl.value;
  if(!d.title || !d.title.trim()){
    if(titleEl){ titleEl.classList.add('shake'); setTimeout(function(){titleEl.classList.remove('shake');},400); titleEl.focus(); }
    toast('标题不能为空');
    return;
  }
  var payload = {
    title: d.title.trim(),
    note: d.note || '',
    projectId: d.projectId || null,
    tagIds: (d.tagIds||[]).map(function(x){return x;}).filter(Boolean),
    priority: d.priority || 'none',
    due: d.due || null,
    links: (d.links||[]).map(function(lk){
      return {id:lk.id||DT.uid('lk'), type:lk.type, name:lk.name, path:lk.path};
    })
  };
  var isNew = ED.isNew, taskId = ED.taskId;
  var msg;
  if(isNew){
    var t = DT.addTask(payload);
    R.ctx.animateId = t.id;
    msg = '已添加：' + payload.title;
  } else {
    DT.updateTask(taskId, payload);
    msg = '已保存';
  }
  closeOverlay();
  R.renderAll();
  toast(msg);
}

/* ---------------- 编辑面板里的链接 / 项目 / 标签 ---------------- */
function editorAddLink(target, title){
  if(!ED) return;
  var parsed = DT.parseLinkInput(target, title);
  if(!parsed){
    toast('不支持的链接格式，请粘贴网址、文件夹路径或 UNC 共享路径');
    return;
  }
  ED.draft.links.push({id:DT.uid('lk'), type:parsed.type, name:parsed.name, path:parsed.path});
  ED.linkEdit = null;
  rerenderEditor();
  /* 添加成功后两个输入随重绘清空，焦点回到地址框（与 src EditorModal.addLinkFromInput 一致） */
  focusSoon($('#edLinkInput'));
  toast('已添加链接');
}
function editorCreateProject(){
  if(!ED) return;
  var inp = $('#edNewProject');
  var name = inp ? inp.value.trim() : '';
  if(!name){ toast('请输入项目名称'); return; }
  var existed = DT.state.projects.filter(function(x){return x.name===name;})[0];
  var p = DT.createProject(name);
  if(!p){ toast('请输入项目名称'); return; }
  ED.draft.projectId = p.id;
  ED.addingProject = false;
  rerenderEditor();
  toast((existed?'已使用现有项目：':'已创建项目：') + p.name);
}
function editorCreateTag(){
  if(!ED) return;
  var inp = $('#edNewTag');
  var name = inp ? inp.value.trim().replace(/^#/,'') : '';
  if(!name){ toast('请输入标签名称'); return; }
  var existed = DT.state.tags.filter(function(x){return x.name===name;})[0];
  var tg = DT.createTag(name);
  if(!tg){ toast('请输入标签名称'); return; }
  if(ED.draft.tagIds.indexOf(tg.id) < 0) ED.draft.tagIds.push(tg.id);
  ED.addingTag = false;
  rerenderEditor();
  toast((existed?'已使用现有标签：':'已创建标签：') + tg.name);
}

/* ---------------- 拖拽文件 ---------------- */
function linksFromDrop(dataTransfer){
  var out = [];
  var items = dataTransfer.items;
  if(items && items.length){
    for(var i=0;i<items.length;i++){
      var it = items[i];
      if(!it || it.kind !== 'file') continue;
      var entry = null;
      try{ entry = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null; }catch(e){}
      var file = dataTransfer.files && dataTransfer.files[i];
      var name = (entry && entry.name) || (file && file.name) || '文件';
      var isDir = !!(entry && entry.isDirectory);
      out.push({id:DT.uid('lk'), type:isDir?'folder':'file', name:name,
        path:'[原型演示] \\\\demo-nas\\\\共享\\\\' + name});
    }
  }
  if(!out.length){
    var txt = (dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain') || '').trim();
    if(txt){
      txt.split(/\r?\n/).forEach(function(line){
        var lk = DT.detectLink(line);
        if(lk) out.push({id:DT.uid('lk'), type:lk.type, name:lk.name, path:lk.path});
      });
    }
  }
  return out;
}

/* ---------------- 快速添加 ---------------- */
function addFromComposer(scope){
  var d = R.draft[scope];
  var input = document.getElementById(scope==='main' ? 'mainCInput' : 'widgetCInput');
  if(input) d.text = input.value;
  var raw = (d.text||'').trim();
  if(!raw && !(d.links||[]).length && !(d.projectIds||[]).length && !(d.tagIds||[]).length && !d.due){
    if(input){ input.classList.add('shake'); setTimeout(function(){input.classList.remove('shake');},400); input.focus(); }
    return;
  }
  var parsed = DT.parseQuick(raw);
  var nav = DT.state.ui.nav;
  var projectIds = (d.projectIds||[]).slice();
  var tagIds = (d.tagIds||[]).slice();
  (parsed.tagNames||[]).forEach(function(name){
    var tg = DT.createTag(name);
    if(tg && tagIds.indexOf(tg.id) < 0) tagIds.push(tg.id);
  });
  if(!projectIds.length && nav.type==='project') projectIds = [nav.id];
  if(!tagIds.length && nav.type==='tag') tagIds = [nav.id];
  if(scope==='widget' && !d.due && !parsed.due) parsed.due = DT.atFuture(0,18,0);
  if(!d.due && !parsed.due){
    if(nav.type==='today') parsed.due = DT.atFuture(0,18,0);
    else if(nav.type==='upcoming') parsed.due = DT.atFuture(1,18,0);
  }
  var links = (d.links||[]).map(function(lk){ return {id:lk.id||DT.uid('lk'), type:lk.type, name:lk.name, path:lk.path}; });
  (parsed.links||[]).forEach(function(lk){ links.push({id:DT.uid('lk'), type:lk.type, name:lk.name, path:lk.path}); });
  var title = parsed.title;
  if(!title || title==='新任务'){
    if(!links.length && !d.due){ toast('先写点什么'); return; }
    title = links.length ? links[0].name : '新任务';
  }
  var t = DT.addTask({
    title: title,
    note: '',
    projectId: projectIds[0] || null,
    tagIds: tagIds,
    priority: d.priority || parsed.priority || 'none',
    due: d.due || parsed.due || null,
    links: links
  });
  R.draft[scope] = {text:'', due:null, projectIds:[], tagIds:[], priority:null, links:[]};
  R.ctx.animateId = t.id;
  /* 临时调整 C：挂件提交后收起为小按钮 */
  if(scope==='widget') R.ctx.widgetComposerOpen = false;
  R.renderAll();
  toast('已添加：' + t.title);
  focusSoon(document.getElementById(scope==='main' ? 'mainCInput' : 'widgetCInput'));
}

/* ---------------- 筛选浮层 ---------------- */
function filterPopHtml(kind){
  var f = DT.state.ui.filters;
  var counts = DT.navCounts();
  var html = '';
  if(kind==='tags'){
    html += '<div class="pop-title">按项目</div><div class="pop-list">';
    DT.state.projects.forEach(function(p){
      var on = (f.projectIds||[]).indexOf(p.id)>=0;
      html += '<button type="button" class="pop-row'+(on?' on':'')+'" data-act="pop-tag" data-kind="project" data-id="'+p.id+'">'
        + '<span class="chk">'+R.icon('check')+'</span><span style="width:7px;height:7px;border-radius:50%;background:'+p.color+'"></span>'
        + '<span>'+esc(p.name)+'</span><span class="r-count">'+(counts.projects[p.id]||0)+'</span></button>';
    });
    html += '</div><div class="pop-sec">按标签</div><div class="pop-list">';
    DT.state.tags.forEach(function(tg){
      var on = (f.tagIds||[]).indexOf(tg.id)>=0;
      html += '<button type="button" class="pop-row'+(on?' on':'')+'" data-act="pop-tag" data-kind="tag" data-id="'+tg.id+'">'
        + '<span class="chk">'+R.icon('check')+'</span>'+R.icon('tag')
        + '<span>'+esc(tg.name)+'</span><span class="r-count">'+(counts.tags[tg.id]||0)+'</span></button>';
    });
    html += '</div><div class="pop-foot"><button type="button" class="ghost-btn" data-act="pop-clear-tags">重置</button>'
      + '<button type="button" class="btn-sm" data-act="pop-close">完成</button></div>';
    return html;
  }
  if(kind==='date'){
    var cur = f.date ? f.date.type : null;
    var rows = [['today','今天'],['tomorrow','明天'],['week','本周'],['overdue','已逾期']];
    html += '<div class="pop-title">按日期</div><div class="pop-list">';
    rows.forEach(function(r){
      html += '<button type="button" class="pop-row'+(cur===r[0]?' on':'')+'" data-act="pop-date" data-v="'+r[0]+'">'
        + '<span class="chk">'+R.icon('check')+'</span><span>'+r[1]+'</span></button>';
    });
    html += '</div><div class="pop-sec">指定日期</div>'
      + '<div class="date-custom">'
      + R.dpField({scope:'filter', mode:'date', value:(f.date && f.date.type==='custom' && f.date.value) ? (f.date.value+'T00:00:00') : ''})
      + '</div>'
      + '<div class="pop-foot"><button type="button" class="ghost-btn" data-act="pop-clear-date">重置</button>'
      + '<button type="button" class="btn-sm" data-act="pop-close">完成</button></div>';
    return html;
  }
  var prios = [['high','高'],['med','中'],['low','低'],['none','无']];
  html += '<div class="pop-title">按优先级 <span style="color:var(--faint)">可多选</span></div><div class="pop-list">';
  prios.forEach(function(p){
    var on = (f.priorities||[]).indexOf(p[0])>=0;
    html += '<button type="button" class="pop-row'+(on?' on':'')+'" data-act="pop-prio" data-v="'+p[0]+'">'
      + '<span class="chk">'+R.icon('check')+'</span><span class="prio '+p[0]+'" style="font-size:11.5px">'+R.icon('flag')+p[1]+'</span></button>';
  });
  html += '</div><div class="pop-foot"><button type="button" class="ghost-btn" data-act="pop-clear-prio">重置</button>'
    + '<button type="button" class="btn-sm" data-act="pop-close">完成</button></div>';
  return html;
}
function openFilterPop(kind, anchor){
  openPop(anchor, function(){ return filterPopHtml(kind); });
}

/* ---------------- 输入框 chips 浮层 ---------------- */
function composerPopHtml(scope, kind){
  var d = R.draft[scope];
  var html = '';
  if(kind==='due'){
    var ts = new Date();
    var tdLabel = DT.fmtHM(DT.atFuture(0,18,0));
    var tmLabel = DT.fmtHM(DT.atFuture(1,18,0));
    html += '<div class="pop-title">日期</div><div class="pop-list">';
    html += '<button type="button" class="pop-row'+(d.due&&DT.sameDay(d.due,ts)?' on':'')+'" data-act="comp-date" data-scope="'+scope+'" data-v="today"><span class="chk">'+R.icon('check')+'</span><span>今天 '+tdLabel+'</span></button>';
    html += '<button type="button" class="pop-row'+(d.due&&DT.sameDay(d.due,DT.addDays(ts,1))?' on':'')+'" data-act="comp-date" data-scope="'+scope+'" data-v="tomorrow"><span class="chk">'+R.icon('check')+'</span><span>明天 '+tmLabel+'</span></button>';
    html += '<button type="button" class="pop-row'+(!d.due?' on':'')+'" data-act="comp-date" data-scope="'+scope+'" data-v="none"><span class="chk">'+R.icon('check')+'</span><span>无日期</span></button>';
    html += '</div><div class="pop-sec">指定</div><div class="date-custom">'
      + R.dpField({scope:'composer', cscope:scope, mode:'datetime', value:d.due||''})
      + '</div>'
      + '<div class="pop-foot"><span></span><button type="button" class="btn-sm" data-act="pop-close">完成</button></div>';
    return html;
  }
  if(kind==='tags'){
    html += '<div class="pop-title">项目</div><div class="pop-list">';
    DT.state.projects.forEach(function(p){
      var on = (d.projectIds||[]).indexOf(p.id)>=0;
      html += '<button type="button" class="pop-row'+(on?' on':'')+'" data-act="comp-tag" data-scope="'+scope+'" data-kind="project" data-id="'+p.id+'">'
        + '<span class="chk">'+R.icon('check')+'</span><span style="width:7px;height:7px;border-radius:50%;background:'+p.color+'"></span><span>'+esc(p.name)+'</span></button>';
    });
    html += '</div><div class="pop-sec">标签</div><div class="pop-list">';
    DT.state.tags.forEach(function(tg){
      var on = (d.tagIds||[]).indexOf(tg.id)>=0;
      html += '<button type="button" class="pop-row'+(on?' on':'')+'" data-act="comp-tag" data-scope="'+scope+'" data-kind="tag" data-id="'+tg.id+'">'
        + '<span class="chk">'+R.icon('check')+'</span>'+R.icon('tag')+'<span>'+esc(tg.name)+'</span></button>';
    });
    html += '</div><div class="pop-foot"><button type="button" class="ghost-btn" data-act="comp-clear-tags" data-scope="'+scope+'">重置</button>'
      + '<button type="button" class="btn-sm" data-act="pop-close">完成</button></div>';
    return html;
  }
  if(kind==='priority'){
    html += '<div class="pop-title">优先级</div><div class="pop-list">';
    [['high','高'],['med','中'],['low','低'],['none','无']].forEach(function(p){
      var on = (d.priority||'none')===p[0];
      html += '<button type="button" class="pop-row'+(on?' on':'')+'" data-act="comp-prio" data-scope="'+scope+'" data-v="'+p[0]+'">'
        + '<span class="chk">'+R.icon('check')+'</span><span class="prio '+p[0]+'" style="font-size:11.5px">'+R.icon('flag')+p[1]+'</span></button>';
    });
    html += '</div><div class="pop-foot"><span></span><button type="button" class="btn-sm" data-act="pop-close">完成</button></div>';
    return html;
  }
  html += '<div class="pop-title">加链接</div>'
    + '<input class="kw" id="popLinkInput" type="text" placeholder="https://… 或 \\\\服务器\\共享 或 C:\\文件夹">'
    + '<div class="pop-foot"><button type="button" class="ghost-btn" data-act="pop-close">关闭</button>'
    + '<button type="button" class="btn-sm" data-act="comp-add-link" data-scope="'+scope+'">添加</button></div>';
  return html;
}
function openComposerPop(scope, kind, anchor){
  openPop(anchor, function(){ return composerPopHtml(scope, kind); });
}
function refreshComposer(scope){
  if(scope==='main'){
    R.renderComposer('main');
    focusSoon($('#mainCInput'));
  } else {
    R.renderWidgetLayer();
    focusSoon($('#widgetCInput'));
  }
}

/* ---------------- 模式 ---------------- */
function setMode(mode){
  lastModeSwitchAt = Date.now();
  DT.state.ui.mode = mode;
  DT.save();
  /* 临时调整 C：离开桌面形态时收起挂件输入区，回到桌面时回到默认小按钮 */
  R.ctx.widgetComposerOpen = false;
  closePops();
  R.renderAll();
  if(mode==='manager' && R.ctx.searchOpen){
    focusSoon($('#mainSearchInput'));
  }
}

/* ---------------- 设置 / 帮助 / 重置 ---------------- */
function openResetConfirm(){
  closePops();
  R.overlayOpen('<div class="modal" role="dialog" aria-modal="true" aria-label="重置演示数据">'
    + '<div class="modal-head"><div class="modal-title">重置演示数据？</div><button type="button" class="modal-x" data-act="close-modal" aria-label="关闭">'+R.icon('x')+'</button></div>'
    + '<div class="modal-body"><p style="font-size:12px;color:var(--ink-2);line-height:1.8;margin:4px 0 0">你在原型里新增、修改、完成的任务都会被清掉，恢复成最初的演示数据。这个操作也会重置换算出的视图位置和设置。</p></div>'
    + '<div class="modal-foot"><span class="spacer"></span><button type="button" class="btn-ghost" data-act="close-modal">取消</button>'
    + '<button type="button" class="btn-danger" data-act="reset-confirm">重置</button></div></div>');
}
function exportData(){
  try{
    var blob = new Blob([DT.exportData()], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = '桌面待办-演示数据.json';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 400);
    toast('已导出 JSON');
  }catch(e){ toast('导出失败'); }
}
function copyText(text){
  function fallback(){
    try{
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      toast('已复制路径');
    }catch(e){ toast('复制失败'); }
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ toast('已复制路径'); }, fallback);
  } else fallback();
}

/* ---------------- 临时调整 B / C：桌面三形态互切 + 挂件输入展开 ---------------- */
var capClickTimer = null, capLastClick = 0, lastModeSwitchAt = 0;
/* 当前桌面形态（完整窗口打开时以 ui.lastShape 为最近形态） */
function currentShape(){
  return R.ctx.widgetCollapsed ? 'capsule' : 'widget';
}
/* 打开完整窗口：先记下当前形态的最近角，关闭后回到同一基准角 */
function openWindow(){
  if(DT.state.ui.mode==='manager') return;
  var shape = currentShape();
  R.captureAnchor(shape);
  DT.state.ui.lastShape = shape;
  setMode('manager');
}
/* 挂件 ↔ 胶囊：先记录上一形态的最近角，再按同一基准角切换到目标形态 */
function switchDesktopShape(shape){
  if(DT.state.ui.mode!=='desktop') return;
  R.captureAnchor(currentShape());
  R.ctx.widgetComposerOpen = false;
  R.ctx.widgetCollapsed = shape==='capsule';
  DT.state.ui.widgetCollapsed = shape==='capsule';
  DT.state.ui.lastShape = shape;
  DT.save();
  R.renderWidgetLayer();
}
function expandWidgetFromCapsule(){
  switchDesktopShape('widget');
}
function collapseTo(shape){
  if(DT.state.ui.mode==='manager'){
    /* 窗口 → 桌面形态：按窗口打开前记录的基准角回到目标形态 */
    R.captureAnchor(DT.state.ui.lastShape || 'widget');
    R.ctx.widgetComposerOpen = false;
    R.ctx.widgetCollapsed = shape==='capsule';
    DT.state.ui.widgetCollapsed = shape==='capsule';
    DT.state.ui.lastShape = shape;
    setMode('desktop');
    return;
  }
  switchDesktopShape(shape);
}
function openWidgetComposer(){
  if(R.ctx.widgetCollapsed) return;
  R.ctx.widgetComposerOpen = true;
  R.renderWidgetLayer();
  focusSoon(document.getElementById('widgetCInput'));
}
function closeWidgetComposer(){
  if(!R.ctx.widgetComposerOpen) return;
  R.ctx.widgetComposerOpen = false;
  R.renderWidgetLayer();
}
/* 点击输入区之外（挂件/桌面任意位置）收起展开的 composer */
function maybeCollapseWidgetComposer(target){
  if(!R.ctx.widgetComposerOpen) return;
  if(DT.state.ui.mode!=='desktop') return;
  if(!document.getElementById('overlay').hidden) return;
  if(target.closest('.w-add')) return;
  if(target.closest('#popLayer') || target.closest('#dpPop')) return;
  if(target.closest('#widgetLayer .cap-wrap')) return;
  closeWidgetComposer();
}

/* ---------------- 全局事件 ---------------- */
function shufflePriorities(arr, v){
  var i = arr.indexOf(v);
  if(i>=0) arr.splice(i,1);
  else arr.push(v);
}
function handleClick(e){
  if(capIgnoreClick && Date.now() < capIgnoreClick && e.target.closest('#widgetLayer .cap-wrap')) return;
  /* 临时调整 C：点击挂件输入区之外收起展开的 composer */
  maybeCollapseWidgetComposer(e.target);
  var t = e.target.closest('[data-act]');
  if(!t){
    /* 点击选择器内部的非按钮区域（如时间输入框）不应关闭选择器 */
    if(DP && !e.target.closest('#dpPop')) dpClose();
    if(POP && !e.target.closest('.pop')) closePops();
    return;
  }
  var act = t.getAttribute('data-act');
  if(DP && act !== 'dp-open' && !e.target.closest('#dpPop')) dpClose();
  var isPopAction = act.indexOf('pop-')===0;
  if(POP && !e.target.closest('.pop') && !/^(filter-|composer-chip)/.test(act)){
    closePops();
  }
  switch(act){
    case 'noop': break;
    /* -------- 自定义日期时间选择器 -------- */
    case 'dp-open': dpOpen(t); break;
    case 'dp-prev': dpStep(-1); break;
    case 'dp-next': dpStep(1); break;
    case 'dp-day': dpPickDay(t.getAttribute('data-d')); break;
    case 'dp-quick': dpQuick(t.getAttribute('data-t')); break;
    case 'dp-timelist': dpToggleTimeList(); break;
    case 'dp-list-h': dpListPick('h', t.getAttribute('data-v')); break;
    case 'dp-list-m': dpListPick('m', t.getAttribute('data-v')); break;
    case 'dp-clear': dpCommit(true); break;
    case 'dp-cancel': dpClose(); break;
    case 'dp-ok': dpCommit(false); break;
    case 'new-task': openEditor(null); break;
    case 'edit-task': openEditor(t.getAttribute('data-id')); break;
    case 'open-link': {
      var lid = t.getAttribute('data-id');
      var lix = parseInt(t.getAttribute('data-i'),10);
      var lt = DT.taskById(lid);
      var lk = lt && lt.links ? lt.links[lix] : null;
      if(!lk) break;
      closePops();
      R.overlayOpen(R.openLinkModal(lk, lt));
      break;
    }
    case 'toggle-task': {
      var id = t.getAttribute('data-id');
      var task = DT.taskById(id);
      if(!task) break;
      var wasDone = task.done;
      DT.toggleTask(id);
      R.renderAll();
      toast(wasDone ? ('已恢复：'+task.title) : ('已完成：'+task.title), {label:'撤销', fn:function(){
        DT.toggleTask(id); R.renderAll();
      }});
      break;
    }
    case 'delete-task': {
      var rec = DT.deleteTask(t.getAttribute('data-id'));
      if(!rec) break;
      R.renderAll();
      toast('已删除：'+rec.task.title, {label:'撤销', fn:function(){ DT.restoreTask(rec); R.renderAll(); }});
      break;
    }
    case 'nav': {
      DT.state.ui.nav = {type:t.getAttribute('data-type'), id:t.getAttribute('data-id')||null};
      DT.state.ui.tab = 'all';
      R.ctx.doneOpen = false;
      DT.save();
      closePops();
      R.renderAll();
      break;
    }
    case 'del-project': requestDelete('project', t.getAttribute('data-id'), false); break;
    case 'del-tag': requestDelete('tag', t.getAttribute('data-id'), false); break;
    case 'del-confirm-cancel': cancelDeleteConfirm(); break;
    case 'del-confirm-ok': confirmDelete(); break;
    case 'tab': {
      DT.state.ui.tab = t.getAttribute('data-tab');
      DT.save();
      R.renderAll();
      break;
    }
    case 'toggle-done-group': R.ctx.doneOpen = !R.ctx.doneOpen; R.renderGroups(); break;
    case 'toggle-widget-done': R.ctx.widgetDoneOpen = !R.ctx.widgetDoneOpen; R.renderWidgetLayer(); break;
    case 'toggle-search': {
      R.ctx.searchOpen = !R.ctx.searchOpen;
      R.renderAll();
      if(R.ctx.searchOpen) focusSoon($('#mainSearchInput'));
      break;
    }
    case 'close-search': {
      DT.state.ui.filters.keyword = '';
      R.ctx.searchOpen = false;
      DT.save();
      R.renderAll();
      break;
    }
    case 'clear-filters': DT.clearFilters(); closePops(); R.renderAll(); break;
    case 'remove-chip': {
      var f = DT.state.ui.filters;
      var kind = t.getAttribute('data-kind'), cid = t.getAttribute('data-id');
      if(kind==='project') f.projectIds = f.projectIds.filter(function(x){return x!==cid;});
      else if(kind==='tag') f.tagIds = f.tagIds.filter(function(x){return x!==cid;});
      else if(kind==='priority') f.priorities = f.priorities.filter(function(x){return x!==cid;});
      else if(kind==='date') f.date = null;
      else if(kind==='keyword') f.keyword = '';
      DT.save(); R.renderAll(); break;
    }
    case 'filter-tags': openFilterPop('tags', t); break;
    case 'filter-date': openFilterPop('date', t); break;
    case 'filter-prio': openFilterPop('prio', t); break;
    case 'composer-chip': openComposerPop(t.getAttribute('data-scope'), t.getAttribute('data-kind'), t); break;
    case 'composer-clear': {
      var sc = t.getAttribute('data-scope'), kd = t.getAttribute('data-kind');
      var d = R.draft[sc];
      if(kd==='due') d.due = null;
      if(kd==='tags'){ d.projectIds = []; d.tagIds = []; }
      if(kd==='priority') d.priority = null;
      if(kd==='links') d.links = [];
      refreshComposer(sc);
      break;
    }
    case 'composer-send': addFromComposer(t.getAttribute('data-scope')); break;
    case 'dismiss-tip': DT.dismissTip(); R.renderWidgetLayer(); break;
    case 'toggle-pin': {
      var s = DT.settings();
      s.alwaysOnTop = !s.alwaysOnTop; DT.save(); R.renderWidgetLayer();
      toast(s.alwaysOnTop ? '已置顶' : '已取消置顶');
      break;
    }
    case 'collapse-widget': switchDesktopShape('capsule'); break;
    case 'expand-widget': switchDesktopShape('widget'); break;
    /* 临时调整 B：完整窗口 → 桌面挂件 / 桌面胶囊 */
    case 'to-widget': collapseTo('widget'); break;
    case 'to-capsule': collapseTo('capsule'); break;
    /* 临时调整 B：关闭完整窗口（标题行 X / Esc） */
    case 'close-window': setMode('desktop'); break;
    /* 临时调整 B：胶囊单击展开挂件，250ms 内第二次点击打开完整窗口 */
    case 'cap-click': {
      var capNow = Date.now();
      if(capClickTimer && capNow - capLastClick < 260){
        clearTimeout(capClickTimer); capClickTimer = null;
        openWindow();
      } else {
        capLastClick = capNow;
        capClickTimer = setTimeout(function(){
          capClickTimer = null;
          expandWidgetFromCapsule();
        }, 250);
      }
      break;
    }
    /* 临时调整 C：点击小按钮展开挂件输入区 */
    case 'widget-composer-open': openWidgetComposer(); break;
    case 'settings': closePops(); R.overlayOpen(R.settingsModal()); break;
    case 'help': closePops(); R.overlayOpen(R.helpModal()); break;
    case 'reset': closePops(); openResetConfirm(); break;
    case 'reset-confirm': {
      DT.reset();
      R.ctx.searchOpen = false; R.ctx.doneOpen = false; R.ctx.widgetDoneOpen = false; R.ctx.widgetCollapsed = false;
      R.ctx.widgetComposerOpen = false;
      closeOverlay(); setMode('desktop'); R.renderAll(); toast('演示数据已重置');
      break;
    }
    case 'close-modal': {
      if(MG && MG.fromSettings){
        MG = null; DEL = null;
        R.overlayOpen(R.settingsModal());
        break;
      }
      closeOverlay(); closePops(); break;
    }
    case 'set-top': {
      var st = DT.settings(); st.alwaysOnTop = !st.alwaysOnTop; DT.save(); R.renderWidgetLayer();
      R.overlayOpen(R.settingsModal()); break;
    }
    case 'set-autostart': {
      var sa = DT.settings(); sa.autostart = !sa.autostart; DT.save(); R.overlayOpen(R.settingsModal()); break;
    }
    case 'set-hotkeys': {
      var sh = DT.settings(); sh.hotkeys = !sh.hotkeys; DT.save(); R.overlayOpen(R.settingsModal()); break;
    }
    case 'set-opacity': {
      DT.settings().opacity = parseInt(t.getAttribute('data-v'),10) || 100; DT.save(); R.renderWidgetLayer();
      R.overlayOpen(R.settingsModal()); break;
    }
    case 'export-data': exportData(); break;
    case 'open-url': {
      var url = t.getAttribute('data-url');
      if(url){ try{ window.open(url, '_blank', 'noopener'); }catch(err){} }
      closeOverlay();
      toast('已请求浏览器打开（原型演示）');
      break;
    }
    case 'copy-path': copyText(t.getAttribute('data-path')||''); break;
    /* -------- 筛选浮层动作 -------- */
    case 'pop-close': closePops(); break;
    case 'pop-tag': {
      var pf = DT.state.ui.filters;
      var pk = t.getAttribute('data-kind'), pid = t.getAttribute('data-id');
      if(pk==='project') shufflePriorities(pf.projectIds, pid);
      else shufflePriorities(pf.tagIds, pid);
      DT.save(); R.renderAll(); refreshPop(); break;
    }
    case 'pop-clear-tags': {
      DT.state.ui.filters.projectIds = [];
      DT.state.ui.filters.tagIds = [];
      DT.save(); R.renderAll(); refreshPop(); break;
    }
    case 'pop-date': {
      var pdt = t.getAttribute('data-v');
      DT.state.ui.filters.date = {type:pdt};
      DT.save(); R.renderAll(); closePops(); break;
    }
    case 'pop-clear-date': DT.state.ui.filters.date = null; DT.save(); R.renderAll(); closePops(); break;
    case 'pop-prio': {
      var ppf = DT.state.ui.filters;
      shufflePriorities(ppf.priorities, t.getAttribute('data-v'));
      DT.save(); R.renderAll(); refreshPop(); break;
    }
    case 'pop-clear-prio': DT.state.ui.filters.priorities = []; DT.save(); R.renderAll(); refreshPop(); break;
    /* -------- composer chips 动作 -------- */
    case 'comp-date': {
      var scope = t.getAttribute('data-scope'), v = t.getAttribute('data-v');
      var dd = R.draft[scope];
      if(v==='today') dd.due = DT.atFuture(0,18,0);
      else if(v==='tomorrow') dd.due = DT.atFuture(1,18,0);
      else dd.due = null;
      refreshComposer(scope); closePops(); break;
    }
    case 'comp-tag': {
      var cscope2 = t.getAttribute('data-scope'), kind2 = t.getAttribute('data-kind'), id2 = t.getAttribute('data-id');
      var dd2 = R.draft[cscope2];
      if(kind2==='project') shufflePriorities(dd2.projectIds, id2);
      else shufflePriorities(dd2.tagIds, id2);
      refreshComposer(cscope2); refreshPop(); break;
    }
    case 'comp-clear-tags': {
      var cscope3 = t.getAttribute('data-scope');
      R.draft[cscope3].projectIds = []; R.draft[cscope3].tagIds = [];
      refreshComposer(cscope3); refreshPop(); break;
    }
    case 'comp-prio': {
      var cscope4 = t.getAttribute('data-scope');
      R.draft[cscope4].priority = t.getAttribute('data-v');
      refreshComposer(cscope4); closePops(); break;
    }
    case 'comp-add-link': {
      var cscope5 = t.getAttribute('data-scope');
      var lin = $('#popLinkInput');
      var link = DT.detectLink(lin ? lin.value : '');
      if(!link){ toast('没识别出链接'); break; }
      R.draft[cscope5].links.push({id:DT.uid('lk'), type:link.type, name:link.name, path:link.path});
      refreshComposer(cscope5); refreshPop(); toast('已挂上链接');
      break;
    }
    /* -------- 编辑面板动作 -------- */
    case 'ed-project': if(ED){ ED.draft.projectId = t.getAttribute('data-id')||null; rerenderEditor(); } break;
    case 'ed-tag': if(ED){ shufflePriorities(ED.draft.tagIds, t.getAttribute('data-id')); rerenderEditor(); } break;
    case 'ed-priority': if(ED){ ED.draft.priority = t.getAttribute('data-v'); rerenderEditor(); } break;
    case 'ed-due': {
      if(ED){
        var dv = t.getAttribute('data-v');
        if(dv==='today') ED.draft.due = DT.atFuture(0,18,0);
        else if(dv==='tomorrow') ED.draft.due = DT.atFuture(1,18,0);
        else ED.draft.due = null;
        rerenderEditor();
      }
      break;
    }
    case 'ed-add-project': if(ED){ ED.addingProject = true; rerenderEditor(); focusSoon($('#edNewProject')); } break;
    case 'ed-add-tag': if(ED){ ED.addingTag = true; rerenderEditor(); focusSoon($('#edNewTag')); } break;
    case 'ed-save-project': editorCreateProject(); break;
    case 'ed-save-tag': editorCreateTag(); break;
    case 'ed-link-title': startLinkEdit(parseInt(t.getAttribute('data-i'),10), 'title'); break;
    case 'ed-link-path': startLinkEdit(parseInt(t.getAttribute('data-i'),10), 'target'); break;
    case 'ed-add-link': {
      var targetEl = $('#edLinkInput'), titleEl = $('#edLinkTitleInput');
      editorAddLink(targetEl ? targetEl.value : '', titleEl ? titleEl.value : '');
      break;
    }
    case 'ed-remove-link': if(ED){ ED.linkEdit = null; ED.draft.links.splice(parseInt(t.getAttribute('data-i'),10),1); rerenderEditor(); } break;
    case 'ed-preview-link': {
      if(ED){
        var li = parseInt(t.getAttribute('data-i'),10);
        var lk = ED.draft.links[li];
        if(!lk) break;
        openPop(t, function(){
          return '<div class="pop-title">链接</div>'
            + '<div class="link-row" style="margin-top:0"><div class="lr-ic">'+R.icon(lk.type==='url'?'globe':(lk.type==='file'?'file':'folder'))+'</div>'
            + '<div class="lr-main"><div class="lr-name">'+esc(lk.name)+'</div><div class="lr-path">'+esc(lk.path)+'</div></div></div>'
            + '<div class="help-block"><p style="margin-top:10px">打开方式：'+(lk.type==='url'?'用默认浏览器打开这个网址。':'用资源管理器打开这个位置；UNC 共享盘会先检查是否可达。')+'</p></div>'
            + '<div class="pop-foot"><button type="button" class="ghost-btn" data-act="copy-path" data-path="'+esc(lk.path)+'">复制路径</button>'
            + '<button type="button" class="btn-sm" data-act="pop-close">关闭</button></div>';
        });
      }
      break;
    }
    case 'ed-delete': if(ED){ ED.deleteConfirm = true; rerenderEditor(); } break;
    case 'ed-delete-cancel': if(ED){ ED.deleteConfirm = false; rerenderEditor(); } break;
    case 'ed-delete-confirm': {
      if(ED){
        var rec = DT.deleteTask(ED.taskId);
        closeOverlay();
        R.renderAll();
        if(rec) toast('已删除：'+rec.task.title, {label:'撤销', fn:function(){ DT.restoreTask(rec); R.renderAll(); }});
      }
      break;
    }
    case 'ed-save': saveEditor(); break;
    /* -------- 项目 / 标签 管理 -------- */
    case 'manage': openManage(null, true); break;
    case 'manage-scope': openManage(t.getAttribute('data-scope')); break;
    case 'mg-add': if(MG){ MG.adding = t.getAttribute('data-kind'); MG.rename = null; manageFocus(MG.adding); } break;
    case 'mg-add-cancel': if(MG){ MG.adding = null; rerenderManage(); } break;
    case 'mg-create': if(MG) manageCreate(t.getAttribute('data-kind')); break;
    case 'mg-rename': if(MG){ MG.rename = {kind:t.getAttribute('data-kind'), id:t.getAttribute('data-id')}; MG.adding=null; rerenderManage(); focusSoon($('#mgRenameInput'), true); } break;
    case 'mg-rename-cancel': if(MG){ MG.rename = null; rerenderManage(); } break;
    case 'mg-rename-save': manageRenameSave(); break;
    case 'mg-delete': if(MG) requestDelete(t.getAttribute('data-kind'), t.getAttribute('data-id'), true); break;
    default: break;
  }
}

/* ---------------- 键盘 ---------------- */
function isTyping(el){
  var tag = (el && el.tagName || '').toLowerCase();
  return tag==='input' || tag==='textarea' || (el && el.isContentEditable);
}
function handleKeydown(e){
  if(e.key==='Enter' && (e.isComposing || e.keyCode===229)) return;
  if(e.key==='Escape'){
    if(DP){ dpClose(); return; }
    if(POP){ closePops(); return; }
    if(DEL){ cancelDeleteConfirm(); return; }
    if(ED && ED.linkEdit){ cancelLinkEdit(); return; }
    /* 临时调整 C：Esc 收起挂件展开的输入区 */
    if(R.ctx.widgetComposerOpen && document.getElementById('overlay').hidden){ closeWidgetComposer(); return; }
    if(!document.getElementById('overlay').hidden){
      if(MG && (MG.adding || MG.rename)){ MG.adding = null; MG.rename = null; rerenderManage(); return; }
      if(MG && MG.fromSettings){
        MG = null; DEL = null;
        R.overlayOpen(R.settingsModal());
        return;
      }
      closeOverlay(); return;
    }
    /* 临时调整 B：Esc 关闭完整窗口，回到桌面形态 */
    if(DT.state.ui.mode==='manager'){ setMode('desktop'); return; }
    return;
  }
  /* 临时调整 B：胶囊聚焦时 Enter / Space 展开为挂件 */
  if((e.key==='Enter' || e.key===' ' || e.key==='Spacebar') && e.target && e.target.closest && e.target.closest('#widgetLayer .capsule')){
    e.preventDefault();
    expandWidgetFromCapsule();
    return;
  }
  if(e.key==='Enter'){
    var id = e.target && e.target.id;
    if(id==='mainCInput' || id==='widgetCInput'){
      if(e.shiftKey) return; /* Shift+Enter 换行，回车保存 */
      e.preventDefault(); addFromComposer(id==='mainCInput' ? 'main' : 'widget'); return;
    }
    if(id==='edLinkInput' || id==='edLinkTitleInput'){
      e.preventDefault();
      var addTarget = $('#edLinkInput'), addTitle = $('#edLinkTitleInput');
      editorAddLink(addTarget ? addTarget.value : '', addTitle ? addTitle.value : '');
      return;
    }
    if(id==='edLinkTitle' || id==='edLinkTarget'){ e.preventDefault(); commitLinkEdit(); return; }
    if(id==='edNewProject'){ e.preventDefault(); editorCreateProject(); return; }
    if(id==='edNewTag'){ e.preventDefault(); editorCreateTag(); return; }
    if(id==='popLinkInput'){ e.preventDefault();
      var la = document.querySelector('[data-act="comp-add-link"]');
      if(la) la.click();
      return; }
    if(id==='mgNewProject'){ e.preventDefault(); manageCreate('project'); return; }
    if(id==='mgNewTag'){ e.preventDefault(); manageCreate('tag'); return; }
    if(id==='mgRenameInput'){ e.preventDefault(); manageRenameSave(); return; }
  }
  if(isTyping(e.target)) return;
  var ovOpen = !document.getElementById('overlay').hidden;
  if(ovOpen) return;
  var key = e.key;
  if(key==='n' || key==='N' || ((e.ctrlKey||e.metaKey) && (key==='n'||key==='N'))){
    e.preventDefault(); openEditor(null); return;
  }
  if(key==='/' || ((e.ctrlKey||e.metaKey) && (key==='f'||key==='F'))){
    e.preventDefault();
    if(DT.state.ui.mode!=='manager') openWindow();
    R.ctx.searchOpen = true;
    R.renderAll();
    focusSoon(document.getElementById('mainSearchInput'));
    return;
  }
  if(e.altKey && /^[1-5]$/.test(key)){
    var map = {1:'inbox',2:'today',3:'overdue',4:'upcoming',5:'done'};
    DT.state.ui.nav = {type:map[key], id:null};
    DT.state.ui.tab = 'all';
    DT.save(); R.renderAll();
  }
}
function handleInput(e){
  var id = e.target && e.target.id;
  if(!id) return;
  if(id==='mainCInput'){ R.draft.main.text = e.target.value; R.autosizeComposer(e.target); }
  else if(id==='widgetCInput'){ R.draft.widget.text = e.target.value; R.autosizeComposer(e.target); }
  else if(id==='mainSearchInput'){
    DT.state.ui.filters.keyword = e.target.value;
    DT.save();
    R.renderGroups();
  }
  else if((id==='dpHour' || id==='dpMin') && DP) dpPaintTimeLists();
  else if(id==='edTitle' && ED) ED.draft.title = e.target.value;
  else if(id==='edNote' && ED) ED.draft.note = e.target.value;
}
function handleChange(e){
  /* 日期时间已改为自定义选择器（dp-*），不再监听原生 change；保留占位以兼容 bind()。 */
}

/* ---------------- 挂件拖动 ---------------- */
var drag = null;
var capDrag = null, capIgnoreClick = 0;
function startCapsuleDrag(e){
  var wrap = e.target.closest('#widgetLayer .cap-wrap');
  if(!wrap) return;
  if(e.button!=null && e.button!==0) return;
  e.preventDefault();
  var rect = wrap.getBoundingClientRect();
  capDrag = {wrap:wrap, dx:e.clientX-rect.left, dy:e.clientY-rect.top, x0:e.clientX, y0:e.clientY, moved:false};
  document.addEventListener('pointermove', onCapsuleDragMove);
  document.addEventListener('pointerup', endCapsuleDrag, {once:true});
}
function onCapsuleDragMove(e){
  if(!capDrag) return;
  if(!capDrag.moved && Math.abs(e.clientX-capDrag.x0)+Math.abs(e.clientY-capDrag.y0) < 4) return;
  capDrag.moved = true;
  capDrag.wrap.classList.add('dragging');
  document.body.style.userSelect = 'none';
  /* 临时调整 A（v1.1）：拖动时写回最近角基准锚点（拖动过程不落盘，松手时统一 save） */
  var p = R.moveTo('capsule', e.clientX-capDrag.dx, e.clientY-capDrag.dy);
  capDrag.wrap.style.left = p.x + 'px';
  capDrag.wrap.style.top = p.y + 'px';
}
function endCapsuleDrag(){
  if(capDrag){
    capDrag.wrap.classList.remove('dragging');
    if(capDrag.moved){ DT.save(); capIgnoreClick = Date.now() + 400; }
  }
  capDrag = null;
  document.body.style.userSelect = '';
  document.removeEventListener('pointermove', onCapsuleDragMove);
}
function startWidgetDrag(e){
  var wrap = e.target.closest('.w-wrap');
  if(!wrap) return;
  if(e.target.closest('button, input, .t-check')) return;
  e.preventDefault();
  var rect = wrap.getBoundingClientRect();
  drag = {wrap:wrap, dx:e.clientX-rect.left, dy:e.clientY-rect.top};
  document.body.style.userSelect = 'none';
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', endWidgetDrag, {once:true});
}
function onDragMove(e){
  if(!drag) return;
  var w = drag.wrap;
  /* 临时调整 A（v1.1）：挂件拖动写回最近角基准锚点；按真实高度 clamp，保证不出视口 */
  var p = R.moveTo('widget', e.clientX-drag.dx, e.clientY-drag.dy);
  w.style.left = p.x+'px';
  w.style.top = p.y+'px';
}
function endWidgetDrag(){
  if(drag){ DT.save(); }
  drag = null;
  document.body.style.userSelect = '';
  document.removeEventListener('pointermove', onDragMove);
}

/* ---------------- 拖放文件 ---------------- */
function handleDragOver(e){
  var zone = e.target.closest('#edDrop');
  var list = e.target.closest('#main .groups, .w-body');
  if(zone || list){
    e.preventDefault();
    try{ e.dataTransfer.dropEffect = 'copy'; }catch(err){}
    if(zone) zone.classList.add('over');
  }
}
function handleDragLeave(e){
  var zone = e.target.closest('#edDrop');
  if(zone) zone.classList.remove('over');
}
function handleDrop(e){
  var zone = e.target.closest('#edDrop');
  var list = e.target.closest('#main .groups, .w-body');
  if(!zone && !list) return;
  e.preventDefault();
  var links = linksFromDrop(e.dataTransfer);
  if(zone){
    zone.classList.remove('over');
    if(!ED){ return; }
    if(!links.length){ toast('没有识别到文件或链接'); return; }
    links.forEach(function(lk){ ED.draft.links.push(lk); });
    rerenderEditor();
    toast('已添加 '+links.length+' 个链接');
    return;
  }
  if(!links.length){ toast('没有识别到文件或链接'); return; }
  var nav = DT.state.ui.nav;
  var due = null;
  if(nav.type==='today') due = DT.atFuture(0,18,0);
  else if(nav.type==='upcoming') due = DT.atFuture(1,18,0);
  var t = DT.addTask({
    title: links[0].name,
    note: '从拖入的文件创建',
    projectId: nav.type==='project' ? nav.id : null,
    tagIds: nav.type==='tag' ? [nav.id] : [],
    priority: 'none',
    due: due,
    links: links
  });
  R.ctx.animateId = t.id;
  R.renderAll();
  toast('已创建任务：'+t.title);
}

/* ---------------- 时间 ---------------- */
var lastDayKey = DT.dateKey(new Date());
function tickClock(){
  var now = new Date();
  var t = document.getElementById('tbTime');
  var d = document.getElementById('tbDate');
  if(t) t.textContent = DT.pad2(now.getHours())+':'+DT.pad2(now.getMinutes());
  if(d) d.textContent = now.getFullYear()+'/'+DT.pad2(now.getMonth()+1)+'/'+DT.pad2(now.getDate());
  var key = DT.dateKey(now);
  if(key!==lastDayKey){
    lastDayKey = key;
    R.renderAll();
  }
}

/* ---------------- 初始化 ---------------- */
function bind(){
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  /* 链接行内编辑（地址 + 标题）：pointerdown 早于 blur，先保存再让点击动作（保存 / 取消 / 删除）正常执行；
     点击同一编辑容器内的另一个输入不提交；纯失焦（Tab 等）也保存。 */
  document.addEventListener('pointerdown', function(e){
    if(!ED || !ED.linkEdit) return;
    if(e.target && e.target.closest && e.target.closest('.lr-edit')) return;
    commitLinkEdit();
  }, true);
  document.addEventListener('focusout', function(e){
    if(!ED || !ED.linkEdit) return;
    var t = e.target;
    if(!t || (t.id!=='edLinkTitle' && t.id!=='edLinkTarget')) return;
    var next = e.relatedTarget;
    var box = t.closest ? t.closest('.lr-edit') : null;
    if(next && box && box.contains(next)) return;  /* 两个输入之间换焦点，不提前提交 */
    commitLinkEdit();
  });
  /* 时间列表滚轮改为应用内平滑滚动（见 handleTimeListWheel），只拦截列表内部，页面其余滚动不受影响；
     拖动滚动条或点列表项时先取消缓动，让位原生滚动。 */
  document.addEventListener('wheel', handleTimeListWheel, {passive:false});
  document.addEventListener('pointerdown', stopTimeListScrolls, true);
  document.addEventListener('pointerdown', function(e){
    if(e.target.closest('#widgetLayer .cap-wrap')){ startCapsuleDrag(e); return; }
    var handle = e.target.closest('[data-drag="widget"]');
    if(handle) startWidgetDrag(e);
  });
  window.addEventListener('resize', function(){
    R.ensureWidgetPos();
    positionDp();
  });
  document.addEventListener('dblclick', function(e){
    /* 形态切换后的第二次点击不再触发"双击"语义，避免胶囊双击误开新建编辑框 */
    if(Date.now() - lastModeSwitchAt < 400) return;
    if(e.target.closest('[data-drag="widget"]') && !e.target.closest('button')){
      openWindow();
      return;
    }
    if(DT.state.ui.mode==='manager'){
      var blank = e.target.closest('#main');
      if(blank && !e.target.closest('.task-row, button, input, textarea, .composer, .modal, .pop, .filterbar, .tabs, .mhead')){
        openEditor(null);
      }
    }
  });
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('dragleave', handleDragLeave);
  document.addEventListener('drop', handleDrop);
  /* 弹窗遮罩不响应点击关闭：避免误触遮罩导致正在编辑的内容丢失；关闭请用 X / 取消 / Esc。 */
  var popLayer = document.getElementById('popLayer');
  popLayer.addEventListener('click', function(e){
    if(e.target === popLayer) closePops();
  });
}
function init(){
  DT.load();
  R.ctx.widgetCollapsed = !!DT.state.ui.widgetCollapsed;
  /* 临时调整 A（v1.1）：刷新后按上次形态的最近角还原基准角 */
  if(DT.state.ui.anchor && DT.state.ui.anchor.x!=null){
    R.captureAnchor(DT.state.ui.lastShape || 'widget');
  }
  R.renderAll();
  tickClock();
  setInterval(tickClock, 20000);
  bind();
  window.DTApp = {
    DT:DT, R:R,
    setMode:setMode,
    openWindow:openWindow,
    switchDesktopShape:switchDesktopShape,
    openEditor:openEditor,
    openResetConfirm:openResetConfirm,
    addFromComposer:addFromComposer,
    getEditor:function(){ return ED; },
    getPop:function(){ return POP; }
  };
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();
/* 提案 v1.6：窗口按钮脚本复用同一个 toast（只在本提案副本里暴露） */
window.__protoToast = toast;
})();
