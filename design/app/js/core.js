/* =========================================================
   core.js · 数据模型 / 存储 / 日期 / 选择器
   ========================================================= */
(function(){
'use strict';
var DT = window.DT = {};
var STORE_KEY = 'desktopTodo.proto.v1';
DT.STORE_KEY = STORE_KEY;
DT.VERSION = '1.0';

/* ---------- 基础工具 ---------- */
DT.uid = function(p){ return (p||'id') + Math.random().toString(36).slice(2,9); };
DT.clamp = function(v,a,b){ return Math.max(a,Math.min(b,v)); };
DT.pad2 = function(n){ return (n<10?'0':'')+n; };
DT.escapeHtml = function(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
};
DT.debounce = function(fn,ms){
  var t; return function(){ var a=arguments,c=this; clearTimeout(t); t=setTimeout(function(){fn.apply(c,a)},ms); };
};

/* ---------- 时间 ---------- */
DT.dayStart = function(d){ var x=new Date(d); x.setHours(0,0,0,0); return x; };
DT.addDays = function(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; };
DT.sameDay = function(a,b){ return DT.dayStart(a).getTime()===DT.dayStart(b).getTime(); };
DT.dateKey = function(d){ var x=new Date(d); return x.getFullYear()+'-'+DT.pad2(x.getMonth()+1)+'-'+DT.pad2(x.getDate()); };
DT.fmtHM = function(d){ var x=new Date(d); return DT.pad2(x.getHours())+':'+DT.pad2(x.getMinutes()); };
DT.weekday = function(d){ return ['周日','周一','周二','周三','周四','周五','周六'][new Date(d).getDay()]; };
DT.monthDay = function(d){ var x=new Date(d); return (x.getMonth()+1)+'月'+x.getDate()+'日'; };
DT.at = function(dayOffset,h,m){
  var d=new Date(); d.setDate(d.getDate()+dayOffset); d.setHours(h||9,m||0,0,0); return d.toISOString();
};
DT.nowMinute = function(){ var d=new Date(); d.setSeconds(0,0); return d; };
/* 今天下一个未来半点（严格晚于当前时刻），用于“今天”默认时间 */
DT.nextSlot = function(from){
  var d = new Date(from || Date.now());
  d.setSeconds(0,0);
  if(d.getMinutes() < 30) d.setMinutes(30);
  else d.setHours(d.getHours()+1, 0, 0, 0);
  return d;
};
/* 今天/明天的默认到期时间；若给的时间已过去，自动顺延到今天下一个半点 */
DT.atFuture = function(dayOffset,h,m){
  var d = new Date(); d.setDate(d.getDate()+dayOffset); d.setHours(h||9,m||0,0,0);
  if(d.getTime() > Date.now()) return d.toISOString();
  return DT.nextSlot(new Date()).toISOString();
};
DT.timeToday = function(hm){
  var p = String(hm||'').split(':');
  var d = new Date();
  d.setHours(parseInt(p[0],10)||0, parseInt(p[1],10)||0, 0, 0);
  return d;
};
/* 快捷时间：按用户实际设过的到期时刻统计（次数降序、同次数最近优先），
   次数不足 2 的候选不算“常用”；不足两个时用 09:00/12:00/18:00 与未来半点补齐。
   若选中的是今天，自动过滤已过去的时间。 */
DT.quickTimes = function(sel, limit){
  limit = limit || 2;
  var selDate = sel ? new Date(sel) : new Date();
  var isToday = DT.sameDay(selDate, new Date());
  var now = DT.nowMinute();
  var out = [];
  function ok(hm){
    if(out.length >= limit || out.indexOf(hm) >= 0) return;
    var d = DT.timeToday(hm);
    if(isToday && d.getTime() < now.getTime()) return;
    out.push(hm);
  }
  var usage = (DT.state && DT.state.ui && DT.state.ui.timeUsage) || {};
  Object.keys(usage).map(function(k){
    var e = usage[k] || {};
    return {k:k, count:e.count||0, last:e.last||0};
  }).filter(function(e){ return e.count >= 2; })
    .sort(function(a,b){ return (b.count-a.count) || (b.last-a.last); })
    .forEach(function(e){ ok(e.k); });
  ['09:00','12:00','18:00'].forEach(function(hm){ ok(hm); });
  var slot = DT.nextSlot(new Date());
  var guard = 0;
  while(out.length < limit && guard < 16){
    ok(DT.fmtHM(slot));
    slot = new Date(slot.getTime() + 30*60000);
    guard++;
  }
  return out.slice(0, limit);
};
DT.noteTimeUsage = function(due){
  if(!due || !DT.state || !DT.state.ui) return;
  var d = new Date(due);
  if(isNaN(d.getTime())) return;
  var key = DT.fmtHM(d);
  var map = DT.state.ui.timeUsage || (DT.state.ui.timeUsage = {});
  var e = map[key] || {count:0, last:0};
  e.count = (e.count||0) + 1;
  e.last = Date.now();
  map[key] = e;
  var keys = Object.keys(map);
  if(keys.length > 16){
    keys.sort(function(a,b){ return (map[a].last||0) - (map[b].last||0); });
    keys.slice(0, keys.length-16).forEach(function(k){ delete map[k]; });
  }
};
DT.daysBetween = function(a,b){
  return Math.round((DT.dayStart(a)-DT.dayStart(b))/86400000);
};

/* ---------- 逾期 / 日期显示 ---------- */
DT.isOverdue = function(t){
  return !!(t && t.due && !t.done && new Date(t.due).getTime() < Date.now());
};
DT.fmtGap = function(ms){
  var mins = Math.max(1, Math.round(ms/60000));
  if(mins < 60) return mins + ' 分钟';
  var hours = Math.round(mins/60);
  if(hours < 24) return hours + ' 小时';
  return Math.round(hours/24) + ' 天';
};
DT.fmtDue = function(t){
  if(!t.due) return {text:'无日期', over:false};
  var d = new Date(t.due), now = new Date();
  var ds = DT.dayStart(d), ts = DT.dayStart(now);
  var diff = Math.round((ds-ts)/86400000);
  if(t.done) return {text:'完成于 '+DT.fmtHM(t.doneAt||t.due), over:false};
  if(DT.isOverdue(t)){
    if(diff===0) return {text:'今天 '+DT.fmtHM(d)+' · 已逾期 '+DT.fmtGap(now-d), over:true};
    return {text:'逾期 '+Math.max(1,DT.daysBetween(ts,ds))+' 天', over:true};
  }
  if(diff===0) return {text:'今天 '+DT.fmtHM(d), over:false};
  if(diff===1) return {text:'明天 '+DT.fmtHM(d), over:false};
  if(diff>1 && diff<7) return {text:DT.weekday(d)+' '+DT.fmtHM(d), over:false};
  return {text:DT.monthDay(d)+' '+DT.fmtHM(d), over:false};
};

/* ---------- 种子数据 ---------- */
function link(type,name,path){ return {id:DT.uid('lk'), type:type, name:name, path:path}; }
function task(o){
  return {
    id:o.id||DT.uid('t'),
    title:o.title,
    note:o.note||'',
    projectId:o.projectId||null,
    tagIds:o.tagIds||[],
    priority:o.priority||'none',
    due:o.due||null,
    done:!!o.done,
    doneAt:o.doneAt||null,
    links:o.links||[],
    createdAt:o.createdAt||new Date().toISOString()
  };
}
DT.seed = function(){
  var now = new Date();
  var projects = [
    {id:'pA', name:'项目A', color:'#C98F79'},
    {id:'buy', name:'采购', color:'#9DB49A'},
    {id:'routine', name:'例行事务', color:'#C3AE8A'}
  ];
  var tags = [
    {id:'mould', name:'模具'},
    {id:'supplier', name:'供应商'},
    {id:'equip', name:'设备'}
  ];
  var tasks = [
    task({title:'审核 IEOP 模具图纸 v3', note:'重点看 3.2 节的型腔尺寸与公差表；确认后同步给工艺组。',
      projectId:'pA', tagIds:['mould'], priority:'high', due:DT.at(0,10,0), createdAt:DT.at(-2,9,10),
      links:[link('folder','IEOP-模具图纸','\\\\fileserver\\项目A\\IEOP-模具图纸'), link('url','评审说明 · wiki','https://wiki.company.com/ieop/review')]}),
    task({title:'准备项目A 周会材料', note:'上次会议遗留的 3 个问题要带上。',
      projectId:'pA', tagIds:[], priority:'high', due:DT.at(0,15,0), createdAt:DT.at(-1,16,20),
      links:[link('folder','周会材料','\\\\fileserver\\项目A\\周会材料')]}),
    task({title:'回复张工关于模具变更的邮件', note:'确认变更单编号后再回复。',
      projectId:null, tagIds:['mould','supplier'], priority:'med', due:DT.at(0,11,30), createdAt:DT.at(-1,8,45),
      links:[link('url','邮件原文','https://mail.company.com/thread/8842')]}),
    task({title:'更新部门周报', note:'数据从项目看板导出，周五下班前发出。',
      projectId:'routine', tagIds:[], priority:'low', due:DT.at(0,17,0), createdAt:DT.at(-3,10,0),
      links:[link('folder','周报模板','\\\\fileserver\\部门\\周报模板'), link('url','部门看板','https://wiki.company.com/dept/board')]}),
    task({title:'与供应商确认交期', note:'订单 PO-20261118，等对方回复模具钢交期。',
      projectId:'buy', tagIds:['supplier'], priority:'high', due:DT.at(-1,16,0), createdAt:DT.at(-4,14,0),
      links:[link('url','供应商门户','https://supplier.company.com/orders/PO-20261118')]}),
    task({title:'整理 Q4 采购需求清单', note:'按项目归并，补齐预算列。',
      projectId:'buy', tagIds:[], priority:'med', due:DT.at(1,10,0), createdAt:DT.at(-2,11,0),
      links:[link('folder','采购共享盘','\\\\fileserver\\采购\\Q4')]}),
    task({title:'盘点仓库备件库存', note:'重点盘 3 号库低价易耗件。',
      projectId:'buy', tagIds:['equip'], priority:'low', due:DT.at(2,14,0), createdAt:DT.at(-2,15,30),
      links:[link('folder','库存台账','\\\\fileserver\\采购\\库存')]}),
    task({title:'输出模具评审结论', note:'评审会纪要 + 待办分派。',
      projectId:'pA', tagIds:['mould'], priority:'med', due:DT.at(4,10,0), createdAt:DT.at(-1,9,0),
      links:[link('url','评审说明 · wiki','https://wiki.company.com/ieop/review'), link('folder','会议纪要','\\\\fileserver\\项目A\\会议纪要')]}),
    task({title:'确认下月排班表', note:'', projectId:'routine', tagIds:[], priority:'none',
      due:DT.at(6,18,0), createdAt:DT.at(-1,17,0), links:[]}),
    task({title:'研究新的供应商评估模板', note:'找 2 个同行模板对照一下。',
      priority:'low', due:null, tagIds:['supplier'], createdAt:DT.at(-5,10,0), links:[]}),
    task({title:'整理 IEOP 图纸命名规范', note:'顺便把历史图纸批量重命名清单列出来。',
      projectId:'pA', priority:'none', due:null, createdAt:DT.at(-6,14,0),
      links:[link('folder','IEOP 目录','\\\\fileserver\\项目A\\IEOP')]}),
    task({title:'归档项目会议纪要', note:'', projectId:'pA', tagIds:[], priority:'med',
      due:DT.at(0,9,0), done:true, doneAt:DT.at(0,10,20), createdAt:DT.at(-4,9,0),
      links:[link('folder','会议纪要','\\\\fileserver\\项目A\\会议纪要')]}),
    task({title:'回复设计评审意见', note:'', projectId:'pA', tagIds:['mould'], priority:'med',
      due:DT.at(0,14,0), done:true, doneAt:DT.at(0,14,40), createdAt:DT.at(-3,10,0),
      links:[link('url','评审说明 · wiki','https://wiki.company.com/ieop/review')]}),
    task({title:'下单采购模具钢材', note:'', projectId:'buy', tagIds:['mould','supplier'], priority:'high',
      due:DT.at(-2,11,0), done:true, doneAt:DT.at(-2,12,10), createdAt:DT.at(-5,9,0),
      links:[link('folder','采购合同','\\\\fileserver\\采购\\合同')]}),
    task({title:'提交上周工时', note:'', projectId:'routine', tagIds:[], priority:'none',
      due:DT.at(-1,18,0), done:true, doneAt:DT.at(-1,18,30), createdAt:DT.at(-6,9,0), links:[]})
  ];
  var ui = {
    mode:'desktop',
    nav:{type:'today', id:null},
    tab:'all',
    filters:{keyword:'', projectIds:[], tagIds:[], date:null, priorities:[]},
    /* 临时调整 A（v1.1）：挂件 / 胶囊共用的「基准角」锚点。
       corner 是离屏幕最近的角（默认右上 tr），x/y 是该角在屏幕上的绝对坐标；
       切换形态时保持这个角不动，形态尺寸变化只向另一个方向伸缩。 */
    anchor:{corner:'tr', x:null, y:null},
    /* 最近显示的桌面形态与挂件高度：完整窗口打开时用它还原同一基准角 */
    lastShape:'widget',
    lastWidgetH:0,
    widgetCollapsed:false,
    timeUsage:{},
    tipDismissed:false,
    settings:{alwaysOnTop:true, opacity:100, autostart:false, hotkeys:true}
  };
  return {version:DT.VERSION, seededAt:new Date().toISOString(), projects:projects, tags:tags, tasks:tasks, ui:ui};
};

/* ---------- 状态 ---------- */
DT.state = null;
DT.load = function(){
  var raw = null;
  try{ raw = window.localStorage.getItem(STORE_KEY); }catch(e){}
  var st = null;
  if(raw){
    try{ st = JSON.parse(raw); }catch(e){ st = null; }
  }
  if(!st || !Array.isArray(st.tasks) || !st.projects || !st.tags){ st = DT.seed(); }
  DT.state = DT.normalize(st);
  DT.save();
  return DT.state;
};
DT.save = function(){
  try{ window.localStorage.setItem(STORE_KEY, JSON.stringify(DT.state)); }catch(e){}
};
DT.reset = function(){
  DT.state = DT.seed();
  DT.save();
  return DT.state;
};
DT.normalize = function(st){
  st.projects = st.projects||[];
  st.tags = st.tags||[];
  st.tasks = (st.tasks||[]).map(function(t){
    t.tagIds = t.tagIds||[]; t.links = t.links||[];
    t.priority = t.priority||'none';
    return t;
  });
  st.ui = st.ui||{};
  var d = DT.seed().ui;
  st.ui.mode = st.ui.mode==='manager' ? 'manager' : 'desktop';
  st.ui.nav = st.ui.nav||d.nav;
  if(!st.ui.nav || !st.ui.nav.type) st.ui.nav = d.nav;
  st.ui.tab = st.ui.tab||'all';
  st.ui.filters = st.ui.filters||{};
  var f = st.ui.filters;
  f.keyword = f.keyword||''; f.projectIds = f.projectIds||[]; f.tagIds = f.tagIds||[]; f.priorities = f.priorities||[]; f.date = f.date||null;
  /* 临时调整 A（v1.1）：旧版 shapePos 不再迁移，位置回到默认右上角基准；任务数据不受影响 */
  var a = (st.ui.anchor && typeof st.ui.anchor==='object') ? st.ui.anchor : {};
  st.ui.anchor = {
    corner: ['tl','tr','bl','br'].indexOf(a.corner)>=0 ? a.corner : 'tr',
    x: (typeof a.x==='number' && !isNaN(a.x)) ? a.x : null,
    y: (typeof a.y==='number' && !isNaN(a.y)) ? a.y : null
  };
  st.ui.lastShape = st.ui.lastShape==='capsule' ? 'capsule' : 'widget';
  st.ui.lastWidgetH = (typeof st.ui.lastWidgetH==='number' && st.ui.lastWidgetH>0) ? st.ui.lastWidgetH : 0;
  delete st.ui.shapePos;
  delete st.ui.widget;
  delete st.ui.capsule;
  st.ui.timeUsage = (st.ui.timeUsage && typeof st.ui.timeUsage==='object') ? st.ui.timeUsage : {};
  st.ui.widgetCollapsed = !!st.ui.widgetCollapsed;
  st.ui.tipDismissed = !!st.ui.tipDismissed;
  st.ui.settings = st.ui.settings||{};
  var s = st.ui.settings, sd = d.settings;
  s.alwaysOnTop = s.alwaysOnTop!==false;
  s.opacity = s.opacity||sd.opacity;
  s.autostart = !!s.autostart;
  s.hotkeys = s.hotkeys!==false;
  return st;
};

/* ---------- 查询 ---------- */
DT.projectById = function(id){ return DT.state.projects.filter(function(p){return p.id===id;})[0]||null; };
DT.tagById = function(id){ return DT.state.tags.filter(function(t){return t.id===id;})[0]||null; };
DT.taskById = function(id){ return DT.state.tasks.filter(function(t){return t.id===id;})[0]||null; };
DT.prioWeight = {high:3, med:2, low:1, none:0};
DT.prioLabel = {high:'高', med:'中', low:'低', none:'无'};

DT.scope = function(nav){
  nav = nav||DT.state.ui.nav;
  var tasks = DT.state.tasks;
  var ts = DT.dayStart(new Date());
  var tomorrow = DT.addDays(ts,1);
  var weekEnd = DT.addDays(ts,7);
  switch(nav.type){
    case 'inbox':
      /* 收件箱 B 口径：无日期且无项目；标签不影响归属 */
      return tasks.filter(function(t){ return !t.due && !t.projectId; });
    case 'today':
      return tasks.filter(function(t){
        if(!t.due) return false;
        var ds = DT.dayStart(t.due);
        if(!t.done) return ds.getTime() <= ts.getTime();
        if(ds.getTime() === ts.getTime()) return true;
        return !!t.doneAt && DT.dayStart(t.doneAt).getTime() === ts.getTime();
      });
    case 'overdue':
      return tasks.filter(function(t){ return DT.isOverdue(t); });
    case 'upcoming':
      return tasks.filter(function(t){
        if(!t.due || t.done) return false;
        var ds = DT.dayStart(t.due);
        return ds > ts && ds <= weekEnd;
      });
    case 'done':
      return tasks.filter(function(t){ return t.done; });
    case 'project':
      return tasks.filter(function(t){ return t.projectId===nav.id; });
    case 'tag':
      return tasks.filter(function(t){ return t.tagIds.indexOf(nav.id)>=0; });
  }
  return tasks;
};

/* 当前筛选（不含状态 Tab / 视图） */
DT.applyFilters = function(list){
  var f = DT.state.ui.filters;
  var kw = (f.keyword||'').trim().toLowerCase();
  var ts = DT.dayStart(new Date());
  return list.filter(function(t){
    if(kw){
      var hay = (t.title+' '+(t.note||'')).toLowerCase();
      if(hay.indexOf(kw)<0) return false;
    }
    if((f.projectIds&&f.projectIds.length) || (f.tagIds&&f.tagIds.length)){
      var pOk = t.projectId && f.projectIds.indexOf(t.projectId)>=0;
      var tOk = (t.tagIds||[]).some(function(id){ return f.tagIds.indexOf(id)>=0; });
      if(!pOk && !tOk) return false;
    }
    if(f.date){
      if(!t.due) return false;
      var ds = DT.dayStart(t.due);
      var d = f.date;
      if(d.type==='today'){ if(ds.getTime()!==ts.getTime()) return false; }
      else if(d.type==='tomorrow'){ if(ds.getTime()!==DT.addDays(ts,1).getTime()) return false; }
      else if(d.type==='week'){
        var dow = ts.getDay(); var start = DT.addDays(ts, -(dow===0?6:dow-1));
        if(ds < start || ds > DT.addDays(start,6)) return false;
      }
      else if(d.type==='overdue'){ if(!DT.isOverdue(t)) return false; }
      else if(d.type==='custom'){
        if(!d.value || DT.dateKey(ds)!==d.value) return false;
      }
    }
    if(f.priorities && f.priorities.length && f.priorities.indexOf(t.priority||'none')<0) return false;
    return true;
  });
};
DT.applyTab = function(list){
  var tab = DT.state.ui.tab;
  if(tab==='todo') return list.filter(function(t){return !t.done;});
  if(tab==='done') return list.filter(function(t){return t.done;});
  return list;
};
DT.sortPending = function(list){
  return list.slice().sort(function(a,b){
    var ao = DT.isOverdue(a)?0:1, bo = DT.isOverdue(b)?0:1;
    if(ao!==bo) return ao-bo;
    var ad = a.due?new Date(a.due).getTime():Infinity;
    var bd = b.due?new Date(b.due).getTime():Infinity;
    if(ad!==bd) return ad-bd;
    var ap = DT.prioWeight[a.priority||'none'], bp = DT.prioWeight[b.priority||'none'];
    if(ap!==bp) return bp-ap;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
};
DT.sortDone = function(list){
  return list.slice().sort(function(a,b){
    return String(b.doneAt||'').localeCompare(String(a.doneAt||''));
  });
};
DT.grouped = function(){
  var scope = DT.scope();
  var filtered = DT.applyFilters(scope);
  var tabbed = DT.applyTab(filtered);
  var pending = DT.sortPending(tabbed.filter(function(t){return !t.done;}));
  var done = DT.sortDone(tabbed.filter(function(t){return t.done;}));
  return {scope:scope, filtered:filtered, tabbed:tabbed, pending:pending, done:done};
};
DT.progress = function(scope){
  var done = scope.filter(function(t){return t.done;}).length;
  var total = scope.length;
  return {done:done, total:total, pct: total? Math.round(done/total*100):0};
};
DT.tabCounts = function(scope){
  var todo=0, done=0;
  scope.forEach(function(t){ if(t.done) done++; else todo++; });
  return {todo:todo, done:done, all:scope.length};
};

/* 视图标题与副标题 */
DT.viewMeta = function(){
  var nav = DT.state.ui.nav;
  var ts = DT.dayStart(new Date());
  var scope = DT.scope();
  var counts = DT.tabCounts(scope);
  var overdueCount = scope.filter(function(t){return DT.isOverdue(t);}).length;
  var meta = {title:'今天', sub:'', over:''};
  if(nav.type==='today'){
    meta.title = '今天';
    meta.sub = DT.monthDay(ts)+' '+DT.weekday(ts);
    meta.over = overdueCount ? overdueCount+' 项逾期' : '';
  } else if(nav.type==='inbox'){
    meta.title = '收件箱';
    meta.sub = '未安排日期、未归项目 · '+counts.todo+' 项待处理';
  } else if(nav.type==='overdue'){
    meta.title = '已逾期';
    meta.sub = '共 '+counts.todo+' 项 · 逾期越久越靠前';
  } else if(nav.type==='upcoming'){
    meta.title = '即将到期';
    meta.sub = '未来 7 天 · '+counts.todo+' 项';
  } else if(nav.type==='done'){
    meta.title = '已完成';
    meta.sub = '最近完成 · '+counts.done+' 项';
  } else if(nav.type==='project'){
    var p = DT.projectById(nav.id);
    meta.title = p?p.name:'项目';
    meta.sub = '项目 · '+counts.todo+' 项待办';
  } else if(nav.type==='tag'){
    var tg = DT.tagById(nav.id);
    meta.title = tg?('#'+tg.name):'标签';
    meta.sub = '标签 · '+counts.todo+' 项待办';
  }
  return meta;
};

/* 左栏计数 */
DT.navCounts = function(){
  var ts = DT.dayStart(new Date());
  var tasks = DT.state.tasks;
  var pending = tasks.filter(function(t){return !t.done;});
  var counts = {
    inbox: pending.filter(function(t){return !t.due && !t.projectId;}).length,
    today: pending.filter(function(t){return t.due && DT.dayStart(t.due)<=ts;}).length,
    overdue: pending.filter(function(t){return DT.isOverdue(t);}).length,
    upcoming: pending.filter(function(t){return t.due && DT.dayStart(t.due)>ts && DT.dayStart(t.due)<=DT.addDays(ts,7);}).length,
    done: tasks.filter(function(t){return t.done;}).length,
    projects:{}, tags:{}
  };
  pending.forEach(function(t){
    if(t.projectId) counts.projects[t.projectId]=(counts.projects[t.projectId]||0)+1;
    (t.tagIds||[]).forEach(function(id){ counts.tags[id]=(counts.tags[id]||0)+1; });
  });
  return counts;
};

/* 今天的待办 & 最近一条（胶囊用） */
DT.todayPending = function(){
  var ts = DT.dayStart(new Date());
  return DT.sortPending(DT.state.tasks.filter(function(t){
    return !t.done && t.due && DT.dayStart(t.due)<=ts;
  }));
};
DT.capsuleInfo = function(){
  var pending = DT.todayPending();
  var overdue = pending.filter(function(t){return DT.isOverdue(t);}).length;
  var ring = DT.progress(DT.scope({type:'today'}));
  var first = pending[0];
  var sub = first ? (first.title + (first.due?' · '+DT.fmtHM(first.due):'')) : (ring.total ? '今天的任务已完成' : '今天还没有安排');
  return {count:pending.length, overdue:overdue, ring:ring, sub:sub};
};

/* ---------- 变更操作 ---------- */
DT.addTask = function(o){
  var t = task(o||{});
  DT.state.tasks.unshift(t);
  if(t.due) DT.noteTimeUsage(t.due);
  DT.save();
  return t;
};
DT.updateTask = function(id, patch){
  var t = DT.taskById(id);
  if(!t) return null;
  var oldDue = t.due;
  Object.keys(patch).forEach(function(k){ t[k]=patch[k]; });
  if(Object.prototype.hasOwnProperty.call(patch,'due') && t.due && String(t.due)!==String(oldDue)){
    DT.noteTimeUsage(t.due);
  }
  DT.save();
  return t;
};
DT.toggleTask = function(id){
  var t = DT.taskById(id);
  if(!t) return null;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  DT.save();
  return t;
};
DT.deleteTask = function(id){
  var idx = -1;
  DT.state.tasks.forEach(function(t,i){ if(t.id===id) idx=i; });
  if(idx<0) return null;
  var removed = DT.state.tasks.splice(idx,1)[0];
  DT.save();
  return {task:removed, index:idx};
};
DT.restoreTask = function(rec){
  if(!rec||!rec.task) return;
  DT.state.tasks.splice(DT.clamp(rec.index,0,DT.state.tasks.length),0,rec.task);
  DT.save();
};
DT.createProject = function(name){
  name = (name||'').trim(); if(!name) return null;
  var exist = DT.state.projects.filter(function(p){return p.name===name;})[0];
  if(exist) return exist;
  var colors = ['#C98F79','#9DB49A','#C3AE8A','#9A9DC0','#C0A15C','#A8B7C9'];
  var p = {id:DT.uid('p'), name:name, color:colors[DT.state.projects.length%colors.length]};
  DT.state.projects.push(p); DT.save(); return p;
};
DT.createTag = function(name){
  name = (name||'').trim().replace(/^#/,''); if(!name) return null;
  var exist = DT.state.tags.filter(function(t){return t.name===name;})[0];
  if(exist) return exist;
  var tg = {id:DT.uid('tg'), name:name};
  DT.state.tags.push(tg); DT.save(); return tg;
};

/* ---------- 项目 / 标签 重命名 ---------- */
DT.renameProject = function(id, name){
  name = (name||'').trim();
  var p = DT.projectById(id);
  if(!p) return {ok:false, code:'notfound', item:null};
  if(!name) return {ok:false, code:'empty', item:p};
  var dup = DT.state.projects.filter(function(x){ return x.id!==id && x.name===name; })[0];
  if(dup) return {ok:false, code:'duplicate', item:dup};
  p.name = name; DT.save();
  return {ok:true, code:'', item:p};
};
DT.renameTag = function(id, name){
  name = (name||'').trim().replace(/^#/,'');
  var tg = DT.tagById(id);
  if(!tg) return {ok:false, code:'notfound', item:null};
  if(!name) return {ok:false, code:'empty', item:tg};
  var dup = DT.state.tags.filter(function(x){ return x.id!==id && x.name===name; })[0];
  if(dup) return {ok:false, code:'duplicate', item:dup};
  tg.name = name; DT.save();
  return {ok:true, code:'', item:tg};
};

/* ---------- 项目 / 标签 删除与恢复 ---------- */
DT.deleteProject = function(id){
  var idx=-1; DT.state.projects.forEach(function(p,i){ if(p.id===id) idx=i; });
  if(idx<0) return null;
  var rec = {project:DT.state.projects.splice(idx,1)[0], index:idx, taskIds:[], prevNav:DT.state.ui.nav};
  DT.state.tasks.forEach(function(t){ if(t.projectId===id){ t.projectId=null; rec.taskIds.push(t.id); } });
  var f = DT.state.ui.filters;
  f.projectIds = (f.projectIds||[]).filter(function(x){ return x!==id; });
  if(rec.prevNav && rec.prevNav.type==="project" && rec.prevNav.id===id) DT.state.ui.nav = {type:"today", id:null};
  DT.save(); return rec;
};
DT.restoreProject = function(rec){
  if(!rec || !rec.project) return;
  if(!DT.projectById(rec.project.id)) DT.state.projects.splice(DT.clamp(rec.index,0,DT.state.projects.length),0,rec.project);
  (rec.taskIds||[]).forEach(function(tid){ var t=DT.taskById(tid); if(t && !t.projectId) t.projectId=rec.project.id; });
  if(rec.prevNav) DT.state.ui.nav = rec.prevNav;
  DT.save();
};
DT.deleteTag = function(id){
  var idx=-1; DT.state.tags.forEach(function(g,i){ if(g.id===id) idx=i; });
  if(idx<0) return null;
  var rec = {tag:DT.state.tags.splice(idx,1)[0], index:idx, taskIds:[], prevNav:DT.state.ui.nav};
  DT.state.tasks.forEach(function(t){
    var at = (t.tagIds||[]).indexOf(id);
    if(at>=0){ t.tagIds.splice(at,1); rec.taskIds.push(t.id); }
  });
  var f = DT.state.ui.filters;
  f.tagIds = (f.tagIds||[]).filter(function(x){ return x!==id; });
  if(rec.prevNav && rec.prevNav.type==="tag" && rec.prevNav.id===id) DT.state.ui.nav = {type:"today", id:null};
  DT.save(); return rec;
};
DT.restoreTag = function(rec){
  if(!rec || !rec.tag) return;
  if(!DT.tagById(rec.tag.id)) DT.state.tags.splice(DT.clamp(rec.index,0,DT.state.tags.length),0,rec.tag);
  (rec.taskIds||[]).forEach(function(tid){
    var t=DT.taskById(tid);
    if(t && (t.tagIds||[]).indexOf(rec.tag.id)<0) t.tagIds.push(rec.tag.id);
  });
  if(rec.prevNav) DT.state.ui.nav = rec.prevNav;
  DT.save();
};

/* ---------- 筛选辅助 ---------- */
DT.filtersActive = function(){
  var f = DT.state.ui.filters;
  var n = 0;
  if((f.projectIds||[]).length) n++;
  if((f.tagIds||[]).length) n++;
  if(f.date) n++;
  if((f.priorities||[]).length) n++;
  if(f.keyword && f.keyword.trim()) n++;
  return n;
};
DT.clearFilters = function(){
  DT.state.ui.filters = {keyword:'', projectIds:[], tagIds:[], date:null, priorities:[]};
  DT.save();
};
DT.activeFilterChips = function(){
  var f = DT.state.ui.filters;
  var chips = [];
  (f.projectIds||[]).forEach(function(id){
    var p = DT.projectById(id); if(p) chips.push({kind:'project', id:id, label:'项目 · '+p.name});
  });
  (f.tagIds||[]).forEach(function(id){
    var t = DT.tagById(id); if(t) chips.push({kind:'tag', id:id, label:'标签 · '+t.name});
  });
  if(f.date){
    var map = {today:'今天', tomorrow:'明天', week:'本周', overdue:'已逾期'};
    var label = f.date.type==='custom' ? ('日期 · '+(f.date.value||'')) : ('日期 · '+map[f.date.type]);
    chips.push({kind:'date', label:label});
  }
  (f.priorities||[]).forEach(function(p){
    chips.push({kind:'priority', id:p, label:'优先级 · '+DT.prioLabel[p]});
  });
  if(f.keyword && f.keyword.trim()) chips.push({kind:'keyword', label:'关键词 · '+f.keyword.trim()});
  return chips;
};

/* ---------- 快速输入解析 ---------- */
DT.parseQuick = function(text){
  var out = {title:'', due:null, priority:null, links:[], tagNames:[]};
  var s = String(text||'').trim();
  if(!s) return out;

  var urlRe = /https?:\/\/[^\s，。；、]+/i;
  var m = s.match(urlRe);
  if(m){ out.links.push({type:'url', name:m[0].replace(/^https?:\/\//,'').slice(0,38), path:m[0]}); s = s.replace(urlRe,' '); }

  var pathRe = /(\\\\[^\s，。；]+|[A-Za-z]:\\[^\s，。；]+)/;
  var pm = s.match(pathRe);
  if(pm){
    var p = pm[0];
    var isFile = /\.[A-Za-z0-9]{1,5}$/.test(p);
    out.links.push({type:isFile?'file':'folder', name:p.split(/[\\\/]/).filter(Boolean).pop()||p, path:p});
    s = s.replace(pathRe,' ');
  }

  var tagRe = /#([^\s#，。；]+)/g;
  var tm;
  while((tm = tagRe.exec(s))){ out.tagNames.push(tm[1]); }
  s = s.replace(tagRe,' ');

  var priRe = /(?:^|\s)(高|中|低)(?:优先级)?\s*$/;
  var pmm = s.match(priRe);
  if(pmm){
    out.priority = pmm[1]==='高'?'high':(pmm[1]==='中'?'med':'low');
    s = s.replace(priRe,' ');
  }

  var dateRe = /(今天|明天|后天|大后天|本周[一二三四五六日天]|周[一二三四五六日天]|星期[一二三四五六日天])(?:\s*(\d{1,2})[:：](\d{2}))?/;
  var dm = s.match(dateRe);
  if(dm){
    var base = new Date(); base.setHours(0,0,0,0);
    var tok = dm[1];
    var dd = null;
    if(tok==='今天') dd = DT.addDays(base,0);
    else if(tok==='明天') dd = DT.addDays(base,1);
    else if(tok==='后天') dd = DT.addDays(base,2);
    else if(tok==='大后天') dd = DT.addDays(base,3);
    else {
      var dowMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0};
      var target = dowMap[tok.slice(-1)];
      if(tok.indexOf('本周')===0){
        var dow = base.getDay();
        var monday = DT.addDays(base, -(dow===0?6:dow-1));
        dd = DT.addDays(monday, (target===0?7:target)-1);
      } else {
        var delta = (target-base.getDay()+7)%7;
        dd = DT.addDays(base, delta);
      }
    }
    if(dd){
      if(dm[2]) dd.setHours(parseInt(dm[2],10), parseInt(dm[3],10), 0, 0);
      else if(DT.sameDay(dd, new Date()) && DT.timeToday('18:00').getTime() < DT.nowMinute().getTime()){
        var ns = DT.nextSlot(new Date());
        dd.setHours(ns.getHours(), ns.getMinutes(), 0, 0);
      }
      else dd.setHours(18,0,0,0);
      out.due = dd.toISOString();
      s = s.replace(dateRe,' ');
    }
  }

  out.title = s.replace(/\s+/g,' ').trim();
  if(!out.title) out.title = '新任务';
  return out;
};

/* ---------- 链接类型识别 ---------- */
DT.detectLink = function(raw){
  var s = String(raw||'').trim();
  if(!s) return null;
  if(/^https?:\/\//i.test(s)) return {type:'url', path:s, name:s.replace(/^https?:\/\//i,'').slice(0,44)};
  if(/^www\./i.test(s)) return {type:'url', path:'https://'+s, name:s.slice(0,44)};
  if(/^(\\\\|\/\/)/.test(s)){
    var isFile = /\.[A-Za-z0-9]{1,5}$/.test(s);
    return {type:isFile?'file':'folder', path:s, name:s.split(/[\\\/]/).filter(Boolean).pop()||s};
  }
  if(/^[A-Za-z]:[\\\/]/.test(s)){
    var f = /\.[A-Za-z0-9]{1,5}$/.test(s);
    return {type:f?'file':'folder', path:s, name:s.split(/[\\\/]/).filter(Boolean).pop()||s};
  }
  return null;
};

/* 链接输入解析：地址 + 可选标题 → {type,path,name}。
   规则与 src/renderer/src/lib/links.ts parseLinkInput 一致：地址无法识别（如 javascript:）返回 null；
   标题为空时回退自动标题（URL 去协议截 44 字、路径取最后一段）。 */
DT.parseLinkInput = function(target, title){
  var lk = DT.detectLink(target);
  if(!lk) return null;
  var t = String(title||'').trim();
  if(t) lk.name = t;
  return lk;
};

/* ---------- 设置 ---------- */
DT.settings = function(){ return DT.state.ui.settings; };
DT.setSetting = function(k,v){ DT.state.ui.settings[k]=v; DT.save(); };
DT.dismissTip = function(){ DT.state.ui.tipDismissed = true; DT.save(); };

/* 导出用 JSON */
DT.exportData = function(){
  return JSON.stringify({version:DT.VERSION, exportedAt:new Date().toISOString(),
    projects:DT.state.projects, tags:DT.state.tags, tasks:DT.state.tasks}, null, 2);
};
})();
