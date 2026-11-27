/* =========================================================
   桌面待办 · iOS 交互原型 js（提案 v2.0 · 待确认）
   数据口径与桌面基线一致：今天 = 今天到期 + 已逾期；
   逾期按到期时刻与当前时刻比较；纯本地 localStorage。
   ========================================================= */
(function(){
'use strict';
var KEY = 'desktopTodo.ios.proto.v1';
var $ = function(s, r){ return (r||document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function uid(p){ return (p||'id')+Math.random().toString(36).slice(2,9); }
function pad2(n){ return (n<10?'0':'')+n; }
function dayStart(d){ var x=new Date(d); x.setHours(0,0,0,0); return x; }
function sameDay(a,b){ return dayStart(a).getTime()===dayStart(b).getTime(); }
function addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
function at(off,h,m){ var d=new Date(); d.setDate(d.getDate()+off); d.setHours(h||9,m||0,0,0); return d.toISOString(); }
function hm(d){ var x=new Date(d); return pad2(x.getHours())+':'+pad2(x.getMinutes()); }
function md(d){ var x=new Date(d); return (x.getMonth()+1)+'月'+x.getDate()+'日'; }
function weekday(d){ return ['周日','周一','周二','周三','周四','周五','周六'][new Date(d).getDay()]; }
function isOverdue(t){ return !!(t.due && !t.done && new Date(t.due).getTime() < Date.now()); }
function fmtGap(ms){
  var mins=Math.max(1,Math.round(ms/60000));
  if(mins<60) return mins+' 分钟';
  var h=Math.round(mins/60);
  if(h<24) return h+' 小时';
  return Math.round(h/24)+' 天';
}
function fmtDue(t){
  if(!t.due) return {text:'无日期', over:false};
  var d=new Date(t.due), now=new Date(), tx;
  if(sameDay(d,now)) tx='今天 '+hm(d);
  else if(sameDay(d,addDays(now,1))) tx='明天 '+hm(d);
  else tx=md(d)+' '+hm(d);
  if(isOverdue(t)) return {text:tx+' · 已逾期 '+fmtGap(now-d), over:true};
  return {text:tx, over:false};
}

/* ---------- 演示数据 ---------- */
function seed(){
  var projects=[
    {id:'p1',name:'工作',color:'#6E8FB8'},
    {id:'p2',name:'个人',color:'#C9A227'},
    {id:'p3',name:'学习',color:'#7F9A6D'}
  ];
  var tags=[{id:'t1',name:'会议'},{id:'t2',name:'设备'},{id:'t3',name:'阅读'}];
  function T(title,off,h,m,o){
    o=o||{};
    return {id:uid('task'),title:title,notes:o.notes||'',proj:o.proj||null,tags:o.tags||[],
      prio:o.prio||null,due:off==null?null:at(off,h,m),links:o.links||[],
      done:!!o.done,doneAt:o.done?at(off||0,h||9,m||0):null,created:Date.now()};
  }
  var tasks=[
    T('晨间站会',0,9,30,{proj:'p1',tags:['t1'],done:true}),
    T('给房东回电话',-1,18,0,{proj:'p2',prio:'med'}),
    T('修复打包脚本签名报错',0,8,0,{proj:'p1',prio:'high',tags:['t2'],
      links:[{id:uid('lk'),kind:'web',title:'构建日志 · CI',url:'https://ci.example.com/build/1024'}]}),
    T('评审 iOS 原型提案',0,14,0,{proj:'p1',tags:['t1'],prio:'high',
      links:[{id:uid('lk'),kind:'web',title:'提案 v2.0 · 仓库',url:'https://github.com/zzj123github/desktop-todo'}]}),
    T('健身房 45 分钟',0,18,30,{proj:'p2'}),
    T('读《设计中的设计》30 页',0,21,0,{proj:'p3',tags:['t3'],prio:'low'}),
    T('写周报',1,9,0,{proj:'p1'}),
    T('牙医复诊',1,15,0,{proj:'p2',prio:'med'}),
    T('整理读书笔记',2,10,0,{proj:'p3',tags:['t3']}),
    T('研究 SwiftUI 动画曲线',null,0,0,{proj:'p3',
      links:[{id:uid('lk'),kind:'web',title:'HIG · Motion',url:'https://developer.apple.com/design/human-interface-guidelines/motion'}]}),
    T('买猫粮',null,0,0,{}),
    T('提交报销单',-1,16,0,{proj:'p1',done:true})
  ];
  return {tasks:tasks,projects:projects,tags:tags,
    settings:{notify:true,haptics:true,sound:false}};
}
function load(){
  try{ var raw=localStorage.getItem(KEY); if(raw){ var s=JSON.parse(raw); if(s&&s.tasks) return s; } }catch(e){}
  return null;
}
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} }
var state = load() || seed();

/* ---------- 会话 UI 状态 ---------- */
var ui = {tab:'today', view:null, scene:'app', doneOpen:false, status:'all',
  filters:{date:null,proj:[],tags:[],prio:[],kw:''}};
var sheet = null; /* {kind, draft, ...} */

/* ---------- 视图口径 ---------- */
function viewTasks(key){
  var now=new Date();
  return state.tasks.filter(function(t){
    if(key==='today') return t.due && (sameDay(t.due,now) || isOverdue(t));
    if(key==='inbox') return !t.due && !t.proj;
    if(key==='overdue') return isOverdue(t);
    if(key==='upcoming') return t.due && !t.done && dayStart(t.due)>dayStart(now);
    if(key==='done') return t.done;
    if(key.indexOf('proj:')===0) return t.proj===key.slice(5);
    if(key.indexOf('tag:')===0) return t.tags.indexOf(key.slice(4))>=0;
    return false;
  });
}
function pendingCount(key){ return viewTasks(key).filter(function(t){return !t.done;}).length; }
function viewMeta(key){
  if(key==='today') return {title:'今天',icon:'i-sun'};
  if(key==='inbox') return {title:'收件箱',icon:'i-inbox'};
  if(key==='overdue') return {title:'已逾期',icon:'i-alert'};
  if(key==='upcoming') return {title:'即将到期',icon:'i-calendar'};
  if(key==='done') return {title:'已完成',icon:'i-check-circle'};
  if(key.indexOf('proj:')===0){
    var p=state.projects.filter(function(x){return x.id===key.slice(5);})[0];
    return {title:p?p.name:'项目',proj:p};
  }
  if(key.indexOf('tag:')===0){
    var t=state.tags.filter(function(x){return x.id===key.slice(4);})[0];
    return {title:t?'# '+t.name:'标签',tag:t};
  }
  return {title:'任务'};
}
function applyFilters(list){
  var f=ui.filters, now=new Date();
  return list.filter(function(t){
    if(f.date==='today' && !(t.due&&sameDay(t.due,now))) return false;
    if(f.date==='tomorrow' && !(t.due&&sameDay(t.due,addDays(now,1)))) return false;
    if(f.date==='week' && !(t.due&&dayStart(t.due)>=dayStart(now)&&dayStart(t.due)<=dayStart(addDays(now,7)))) return false;
    if(f.date==='overdue' && !isOverdue(t)) return false;
    if(f.proj.length && f.proj.indexOf(t.proj)<0) return false;
    if(f.tags.length && !f.tags.some(function(x){return t.tags.indexOf(x)>=0;})) return false;
    if(f.prio.length && f.prio.indexOf(t.prio)<0) return false;
    if(f.kw && (t.title+' '+(t.notes||'')).toLowerCase().indexOf(f.kw.toLowerCase())<0) return false;
    return true;
  });
}
function filterCount(){
  var f=ui.filters;
  return (f.date?1:0)+f.proj.length+f.tags.length+f.prio.length+(f.kw?1:0);
}
function sortTasks(list){
  return list.slice().sort(function(a,b){
    if(a.done!==b.done) return a.done?1:-1;
    if(a.done) return (b.doneAt||'')<(a.doneAt||'')?-1:1;
    if(a.due&&b.due) return new Date(a.due)-new Date(b.due);
    if(a.due) return -1;
    if(b.due) return 1;
    return a.created-b.created;
  });
}
function todayStats(){
  var list=viewTasks('today');
  var pend=list.filter(function(t){return !t.done;});
  var over=pend.filter(isOverdue).length;
  var done=list.length-pend.length;
  var pct=list.length?Math.round(done/list.length*100):0;
  return {total:list.length,pend:pend.length,over:over,done:done,pct:pct};
}

/* ---------- 小组件 ---------- */
function ringHtml(pct,cls){
  return '<span class="ring '+(cls||'')+'" style="--p:'+(pct*1.0053).toFixed(2)+'">'+
    '<svg viewBox="0 0 40 40"><circle class="tr" cx="20" cy="20" r="16"/><circle class="pr" cx="20" cy="20" r="16"/></svg>'+
    '<span>'+pct+'%</span></span>';
}
function prioHtml(p){
  if(!p) return '';
  var map={high:['高','high'],med:['中','med'],low:['低','low']};
  var m=map[p]; if(!m) return '';
  return '<span class="prio '+m[1]+'"><svg class="ic"><use href="#i-flag"/></svg>'+m[0]+'</span>';
}
function projChip(id){
  var p=state.projects.filter(function(x){return x.id===id;})[0];
  if(!p) return '';
  return '<span class="chip dot" style="--dot:'+p.color+'">'+esc(p.name)+'</span>';
}
function tagChips(ids){
  return (ids||[]).map(function(id){
    var t=state.tags.filter(function(x){return x.id===id;})[0];
    return t?'<span class="chip tag">#'+esc(t.name)+'</span>':'';
  }).join('');
}
function linkIcon(kind){ return kind==='web'?'i-globe':(kind==='folder'?'i-folder':'i-file'); }

/* ---------- 任务行 ---------- */
function taskRow(t){
  var due=fmtDue(t);
  var metas=[];
  if(t.due) metas.push('<span class="'+(due.over?'over':'')+'">'+esc(due.text)+'</span>');
  (t.links||[]).slice(0,1).forEach(function(l){
    metas.push('<span class="t-link" data-act="open-link" data-id="'+t.id+'"><svg class="ic"><use href="#'+linkIcon(l.kind)+'"/></svg>'+esc(l.title)+'</span>');
  });
  var meta=metas.length?'<div class="t-meta">'+metas.join('<span class="sep">·</span>')+'</div>':'';
  return '<div class="task-row'+(t.done?' done':'')+'" data-act="open-task" data-id="'+t.id+'">'+
    '<button class="t-check" data-act="check" data-id="'+t.id+'" aria-label="'+(t.done?'标记为待办':'完成任务')+'"><svg class="ic"><use href="#i-check"/></svg></button>'+
    '<div class="t-main"><div class="t-title">'+esc(t.title)+prioHtml(t.prio)+projChip(t.proj)+tagChips(t.tags)+'</div>'+meta+'</div>'+
    '<span class="t-chev"><svg class="ic"><use href="#i-chevron-right"/></svg></span></div>';
}

/* ---------- 列表页 ---------- */
function listPage(key){
  var meta=viewMeta(key);
  var base=applyFilters(viewTasks(key));
  var pendAll=sortTasks(base.filter(function(t){return !t.done;}));
  var doneAll=sortTasks(base.filter(function(t){return t.done;}));
  var pend=ui.status==='done'?[]:pendAll;
  var done=ui.status==='pend'?[]:doneAll;
  var now=new Date();
  var over=pendAll.filter(isOverdue).length;
  var pct=base.length?Math.round(doneAll.length/base.length*100):0;
  var sub;
  if(key==='today') sub=md(now)+' '+weekday(now)+'<span class="sep">·</span>'+pendAll.length+' 项待办'+
    (over?'<span class="sep">·</span><span class="over">'+over+' 项逾期</span>':'');
  else sub=pendAll.length+' 项待办<span class="sep">·</span>'+doneAll.length+' 项已完成'+
    (over?'<span class="sep">·</span><span class="over">'+over+' 项逾期</span>':'');

  var html='';
  if(ui.view) html+='<div class="backbar"><button class="back-btn" data-act="back"><svg class="ic"><use href="#i-chevron-left"/></svg>视图</button></div>';
  html+='<div class="phead"><div class="phead-row"><div style="min-width:0">'+
    '<h1 class="ptitle">'+(meta.proj?'<span class="proj-dot" style="--dot:'+meta.proj.color+';display:inline-block;margin:0 8px 4px 0"></span>':'')+esc(meta.title)+'</h1>'+
    '<div class="psub">'+sub+'</div></div>'+
    '<div class="phead-r">'+ringHtml(pct)+'<button class="icon-btn" data-act="filter" aria-label="筛选">'+
    '<svg class="ic"><use href="#i-sliders"/></svg>'+(filterCount()?'<span class="dot-badge"></span>':'')+'</button></div></div></div>';

  if(key!=='done'){
    html+='<div class="tabs">'+
      '<button class="tab'+(ui.status==='all'?' on':'')+'" data-act="status-tab" data-v="all">全部 <span class="count">'+base.length+'</span></button>'+
      '<button class="tab'+(ui.status==='pend'?' on':'')+'" data-act="status-tab" data-v="pend">待办 <span class="count">'+pendAll.length+'</span></button>'+
      '<button class="tab'+(ui.status==='done'?' on':'')+'" data-act="status-tab" data-v="done">已完成 <span class="count">'+doneAll.length+'</span></button></div>';
  }

  var f=ui.filters, chips=[];
  if(f.date){
    var dl={today:'今天',tomorrow:'明天',week:'本周',overdue:'已逾期'}[f.date];
    chips.push('<button class="fchip" data-act="fclear" data-k="date">'+dl+'<span class="x"><svg class="ic"><use href="#i-x"/></svg></span></button>');
  }
  f.proj.forEach(function(id){
    var p=state.projects.filter(function(x){return x.id===id;})[0];
    chips.push('<button class="fchip" data-act="fclear" data-k="proj" data-v="'+id+'">'+esc(p?p.name:id)+'<span class="x"><svg class="ic"><use href="#i-x"/></svg></span></button>');
  });
  f.tags.forEach(function(id){
    var t=state.tags.filter(function(x){return x.id===id;})[0];
    chips.push('<button class="fchip" data-act="fclear" data-k="tags" data-v="'+id+'">#'+esc(t?t.name:id)+'<span class="x"><svg class="ic"><use href="#i-x"/></svg></span></button>');
  });
  f.prio.forEach(function(p){
    var n={high:'高',med:'中',low:'低'}[p];
    chips.push('<button class="fchip" data-act="fclear" data-k="prio" data-v="'+p+'">'+n+'优先级<span class="x"><svg class="ic"><use href="#i-x"/></svg></span></button>');
  });
  if(f.kw) chips.push('<button class="fchip" data-act="fclear" data-k="kw">“'+esc(f.kw)+'”<span class="x"><svg class="ic"><use href="#i-x"/></svg></span></button>');
  html+='<div class="filterbar"><button class="fbtn" data-act="filter"><svg class="ic"><use href="#i-sliders"/></svg>筛选'+
    (filterCount()?'<span class="fcount">'+filterCount()+'</span>':'')+'</button>'+chips.join('')+
    (chips.length?'<button class="fclear" data-act="fclear-all">清除</button>':'')+'</div>';
  html+='<div class="searchbox"><svg class="ic"><use href="#i-search"/></svg>'+
    '<input id="kwInput" placeholder="搜索任务" value="'+esc(f.kw)+'"></div>';

  if(!base.length){
    html+='<div class="m-empty"><b>这里空空如也</b>'+
      (filterCount()?'没有符合筛选条件的任务，试试清除筛选':'点下方 ＋ 添加第一条任务')+'</div>';
  }else{
    if(key==='done'){
      html+='<div class="group-head">已完成 <span class="g-count">'+done.length+'</span></div>';
      html+='<div class="task-card">'+done.map(taskRow).join('')+'</div>';
    }else{
      if(pend.length){
        html+='<div class="group-head">待办 <span class="g-count">'+pend.length+'</span></div>';
        html+='<div class="task-card">'+pend.map(taskRow).join('')+'</div>';
      }
      if(done.length){
        html+='<div class="group-head">已完成 <span class="g-count">'+done.length+'</span>'+
          '<button class="chev'+(ui.doneOpen?'':' closed')+'" data-act="toggle-done" aria-label="折叠已完成"><svg class="ic"><use href="#i-chevron"/></svg></button></div>';
        if(ui.doneOpen||ui.status==='done') html+='<div class="task-card">'+done.map(taskRow).join('')+'</div>';
      }
      if(!pend.length&&!done.length) html+='<div class="m-empty"><b>都完成了</b>今天没有待办，好好休息</div>';
    }
  }
  return html;
}

/* ---------- 视图页 ---------- */
function viewsPage(){
  var html='<div class="phead"><h1 class="ptitle">视图</h1><div class="psub">全部清单 · 项目 · 标签</div></div>';
  var rows=[
    ['today','i-sun','今天'],['inbox','i-inbox','收件箱'],['overdue','i-alert','已逾期'],
    ['upcoming','i-calendar','即将到期'],['done','i-check-circle','已完成']
  ];
  html+='<div class="sec-title">清单</div><div class="nav-card">';
  rows.forEach(function(r){
    var n=r[0]==='done'?viewTasks('done').length:pendingCount(r[0]);
    html+='<button class="nav-item'+(r[0]==='overdue'&&n?' overdue':'')+'" data-act="open-view" data-v="'+r[0]+'">'+
      '<svg class="ic"><use href="#'+r[1]+'"/></svg>'+r[2]+'<span class="n-count">'+n+'</span>'+
      '<span class="n-chev"><svg class="ic"><use href="#i-chevron-right"/></svg></span></button>';
  });
  html+='</div>';
  html+='<div class="sec-title">项目<button class="nav-sec-mgr" data-act="manage" data-scope="proj" aria-label="管理项目"><svg class="ic"><use href="#i-pencil"/></svg></button></div><div class="nav-card">';
  state.projects.forEach(function(p){
    html+='<button class="nav-item" data-act="open-view" data-v="proj:'+p.id+'">'+
      '<span class="proj-dot" style="--dot:'+p.color+'"></span>'+esc(p.name)+
      '<span class="n-count">'+pendingCount('proj:'+p.id)+'</span><span class="n-chev"><svg class="ic"><use href="#i-chevron-right"/></svg></span></button>';
  });
  if(!state.projects.length) html+='<div class="m-empty" style="padding:16px">还没有项目</div>';
  html+='</div>';
  html+='<div class="sec-title">标签<button class="nav-sec-mgr" data-act="manage" data-scope="tag" aria-label="管理标签"><svg class="ic"><use href="#i-pencil"/></svg></button></div><div class="nav-card">';
  state.tags.forEach(function(t){
    html+='<button class="nav-item" data-act="open-view" data-v="tag:'+t.id+'">'+
      '<span class="tag-ic"><svg class="ic"><use href="#i-tag"/></svg></span># '+esc(t.name)+
      '<span class="n-count">'+pendingCount('tag:'+t.id)+'</span><span class="n-chev"><svg class="ic"><use href="#i-chevron-right"/></svg></span></button>';
  });
  if(!state.tags.length) html+='<div class="m-empty" style="padding:16px">还没有标签</div>';
  html+='</div>';
  return html;
}

/* ---------- 设置页 ---------- */
function settingsPage(){
  var s=state.settings;
  function sw(k){ return '<button class="switch'+(s[k]?' on':'')+'" data-act="switch" data-k="'+k+'" role="switch" aria-checked="'+!!s[k]+'" aria-label="'+k+'"></button>'; }
  var html='<div class="phead"><h1 class="ptitle">设置</h1><div class="psub">提醒 · 数据 · 关于</div></div>';
  html+='<div class="sec-title">提醒</div><div class="nav-card">'+
    '<div class="nav-item"><svg class="ic"><use href="#i-bell"/></svg><div class="set-main"><div class="set-name">到期提醒通知</div><div class="set-desc">到期时发送本地通知（需系统授权）</div></div>'+sw('notify')+'</div>'+
    '<div class="nav-item"><svg class="ic"><use href="#i-clock"/></svg><div class="set-main"><div class="set-name">提醒声音</div><div class="set-desc">通知到达时播放提示音</div></div>'+sw('sound')+'</div>'+
    '<div class="nav-item"><svg class="ic"><use href="#i-check-circle"/></svg><div class="set-main"><div class="set-name">完成触感反馈</div><div class="set-desc">勾选任务时轻震动（Haptic）</div></div>'+sw('haptics')+'</div></div>';
  html+='<div class="sec-title">数据</div><div class="nav-card">'+
    '<button class="nav-item" data-act="manage" data-scope="all"><svg class="ic"><use href="#i-folder"/></svg><div class="set-main"><div class="set-name">项目与标签</div></div><span class="n-chev"><svg class="ic"><use href="#i-chevron-right"/></svg></span></button>'+
    '<button class="nav-item" data-act="export"><svg class="ic"><use href="#i-export"/></svg><div class="set-main"><div class="set-name">导出数据</div><div class="set-desc">JSON · 通过系统分享面板发送</div></div><span class="n-chev"><svg class="ic"><use href="#i-chevron-right"/></svg></span></button>'+
    '<button class="nav-item danger" data-act="reset"><svg class="ic"><use href="#i-refresh"/></svg><div class="set-main"><div class="set-name">重置演示数据</div></div></button></div>';
  html+='<div class="sec-title">关于</div><div class="nav-card">'+
    '<button class="nav-item" data-act="widget-demo"><svg class="ic"><use href="#i-widget"/></svg><div class="set-main"><div class="set-name">主屏幕与锁屏小组件</div><div class="set-desc">查看小组件预览</div></div><span class="n-chev"><svg class="ic"><use href="#i-chevron-right"/></svg></span></button>'+
    '<button class="nav-item" data-act="help"><svg class="ic"><use href="#i-help"/></svg><div class="set-main"><div class="set-name">使用说明</div></div><span class="n-chev"><svg class="ic"><use href="#i-chevron-right"/></svg></span></button></div>';
  html+='<div class="about-line">桌面待办 · iOS 提案 v2.0（待确认）<br>数据只保存在本机，与桌面版同一套设计令牌</div>';
  return html;
}

/* ---------- 页面渲染 ---------- */
function render(){
  var page=$('#page');
  var key=ui.view || (ui.tab==='today'?'today':(ui.tab==='done'?'done':null));
  if(ui.tab==='views'&&!ui.view) page.innerHTML=viewsPage();
  else if(ui.tab==='settings') page.innerHTML=settingsPage();
  else page.innerHTML=listPage(key||'today');
  $$('.tab-item').forEach(function(b){ b.classList.toggle('on',b.dataset.tab===ui.tab&&!ui.view); });
  if(ui.view) $$('.tab-item').forEach(function(b){ b.classList.toggle('on',b.dataset.tab==='views'); });
  save();
}
function rerenderPage(anim){
  render();
  if(anim){ var p=$('#page'); p.classList.remove('page-enter'); void p.offsetWidth; p.classList.add('page-enter'); }
}

/* ---------- Sheet 基建 ---------- */
function openSheet(kind,draft){
  sheet={kind:kind,draft:draft||{}};
  renderSheet();
}
function closeSheet(){
  sheet=null;
  $('#sheetLayer').innerHTML='';
}
function sheetShell(title,sub,body,foot){
  return '<div class="sheet-overlay"><div class="sheet" role="dialog" aria-label="'+esc(title)+'">'+
    '<div class="sheet-grab"><i></i></div>'+
    '<div class="sheet-head"><span class="sheet-title">'+esc(title)+'</span>'+(sub?'<span class="sheet-sub">'+esc(sub)+'</span>':'')+
    '<button class="sheet-x" data-act="sheet-close" aria-label="关闭"><svg class="ic"><use href="#i-x"/></svg></button></div>'+
    '<div class="sheet-body">'+body+'</div>'+(foot?'<div class="sheet-foot">'+foot+'</div>':'')+'</div></div>';
}
function renderSheet(){
  if(!sheet) return;
  var host=$('#sheetLayer'), html='';
  var d=sheet.draft;
  if(sheet.kind==='add') html=addSheetHtml(d);
  else if(sheet.kind==='edit') html=editSheetHtml(d);
  else if(sheet.kind==='filter') html=filterSheetHtml();
  else if(sheet.kind==='manage') html=manageSheetHtml(d);
  else if(sheet.kind==='help') html=helpSheetHtml();
  else if(sheet.kind==='confirm') html=confirmSheetHtml(d);
  host.innerHTML=html;
  var focus=host.querySelector('[data-autofocus]');
  if(focus&&!sheet.focused){ sheet.focused=true; setTimeout(function(){ focus.focus(); },60); }
}

/* ---------- 添加任务 ---------- */
function blankDraft(){
  return {title:'',notes:'',proj:null,tags:[],prio:null,due:null,links:[],dpOpen:false,dpMonth:new Date(),dpH:'18',dpM:'00'};
}
function parseInput(text){
  var out={due:null,proj:null,tags:[],prio:null,clean:text};
  var now=new Date(), off=null;
  out.clean=out.clean.replace(/(^|\s)(今天|明天|后天)(?=\s|$)/,function(m,s,w){
    off={今天:0,明天:1,后天:2}[w]; return s;
  });
  var tm=out.clean.match(/(^|\s)(\d{1,2}):(\d{2})(?=\s|$)/);
  if(tm){ out.clean=out.clean.replace(tm[0],' '); out.h=+tm[2]; out.m=+tm[3]; }
  out.clean=out.clean.replace(/(^|\s)#([^\s#]+)/g,function(m,s,name){
    var t=state.tags.filter(function(x){return x.name===name;})[0];
    if(t) out.tags.push(t.id);
    return s;
  });
  out.clean=out.clean.replace(/(^|\s)!(高|中|低)(?=\s|$)/,function(m,s,p){
    out.prio={高:'high',中:'med',低:'low'}[p]; return s;
  });
  if(off!=null||tm){
    var base=off==null?0:off;
    var dd=new Date(); dd.setDate(dd.getDate()+base);
    dd.setHours(out.h!=null?out.h:18,out.m||0,0,0);
    out.due=dd.toISOString();
  }
  out.clean=out.clean.replace(/\s+/g,' ').trim();
  return out;
}
function composerHtml(d,placeholder){
  var chips=[];
  if(d.due){ var dd=new Date(d.due);
    chips.push('<span class="chip" style="background:var(--accent-soft);color:var(--accent-deep)">'+esc((sameDay(dd,new Date())?'今天 ':sameDay(dd,addDays(new Date(),1))?'明天 ':md(dd)+' ')+hm(dd))+'</span>'); }
  if(d.proj) chips.push(projChip(d.proj));
  d.tags.forEach(function(id){ chips.push(tagChips([id])); });
  if(d.prio) chips.push(prioHtml(d.prio));
  return '<div class="composer"><textarea class="cinput" id="cInput" rows="1" placeholder="'+esc(placeholder)+'" data-autofocus>'+esc(d.title)+'</textarea>'+
    '<div class="composer-tools">'+
    '<button class="ctool'+(d.due?' on':'')+'" data-act="dp-toggle"><svg class="ic"><use href="#i-calendar"/></svg>'+(d.due?esc(fmtDue({due:d.due,done:false}).text):'日期')+'</button>'+
    '<button class="ctool'+(d.prio?' on':'')+'" data-act="prio-cycle"><svg class="ic"><use href="#i-flag"/></svg>'+(d.prio?{high:'高',med:'中',low:'低'}[d.prio]+'优先级':'优先级')+'</button>'+
    '<button class="composer-send" data-act="add-send" aria-label="添加"><svg class="ic"><use href="#i-arrow-up"/></svg></button>'+
    '</div></div>'+
    (chips.length?'<div class="parse-preview">'+chips.join('')+'</div>':'')+
    (d.dpOpen?dpEmbedHtml(d):'');
}
function addSheetHtml(d){
  var body=composerHtml(d,'明天 9:00 写周报 #会议 !高')+
    '<div class="parse-hint">直接输入「明天 9:00 写周报 #会议 !高」，自动识别日期、标签与优先级；回车保存。</div>'+
    '<div class="form-field"><div class="field-label">项目</div><div class="chip-row">'+
    state.projects.map(function(p){
      return '<button class="pick-chip'+(d.proj===p.id?' on':'')+'" data-act="pick-proj" data-v="'+p.id+'"><span class="dot" style="--dot:'+p.color+'"></span>'+esc(p.name)+'</button>';
    }).join('')+'</div></div>'+
    '<div class="form-field"><div class="field-label">标签</div><div class="chip-row">'+
    state.tags.map(function(t){
      return '<button class="pick-chip'+(d.tags.indexOf(t.id)>=0?' on':'')+'" data-act="pick-tag" data-v="'+t.id+'"># '+esc(t.name)+'</button>';
    }).join('')+'</div></div>';
  return sheetShell('添加任务','',body,'');
}

/* ---------- 编辑任务 ---------- */
function editSheetHtml(d){
  var t=d;
  var body='<div class="form-field" style="margin-top:4px"><div class="field-label">标题</div>'+
    '<input class="text-input" id="eTitle" value="'+esc(t.title)+'" data-autofocus></div>'+
    '<div class="form-field"><div class="field-label">备注 <span class="opt">可选</span></div>'+
    '<textarea class="text-input" id="eNotes" placeholder="补充说明">'+esc(t.notes)+'</textarea></div>'+
    '<div class="form-field"><div class="field-label">项目</div><div class="chip-row">'+
    state.projects.map(function(p){
      return '<button class="pick-chip'+(t.proj===p.id?' on':'')+'" data-act="pick-proj" data-v="'+p.id+'"><span class="dot" style="--dot:'+p.color+'"></span>'+esc(p.name)+'</button>';
    }).join('')+'</div></div>'+
    '<div class="form-field"><div class="field-label">标签</div><div class="chip-row">'+
    state.tags.map(function(x){
      return '<button class="pick-chip'+(t.tags.indexOf(x.id)>=0?' on':'')+'" data-act="pick-tag" data-v="'+x.id+'"># '+esc(x.name)+'</button>';
    }).join('')+'</div></div>'+
    '<div class="form-field"><div class="field-label">优先级</div><div class="chip-row">'+
    [['high','高'],['med','中'],['low','低']].map(function(p){
      return '<button class="pick-chip'+(t.prio===p[0]?' on':'')+'" data-act="pick-prio" data-v="'+p[0]+'">'+p[1]+'</button>';
    }).join('')+'</div></div>'+
    '<div class="form-field"><div class="field-label">日期时间</div>'+
    '<button class="dp-field'+(t.due?'':' empty')+'" data-act="dp-toggle"><svg class="ic"><use href="#i-calendar"/></svg>'+
    '<span class="dp-field-tx">'+(t.due?esc(fmtDue({due:t.due,done:false}).text):'选择日期时间')+'</span></button>'+
    (t.dpOpen?dpEmbedHtml(t):'')+'</div>'+
    '<div class="form-field"><div class="field-label">链接</div><div class="link-list">'+
    (t.links.length?t.links.map(function(l){
      return '<div class="link-row"><span class="lr-ic"><svg class="ic"><use href="#'+linkIcon(l.kind)+'"/></svg></span>'+
        '<div class="lr-main"><div class="lr-name">'+esc(l.title)+'</div><div class="lr-path">'+esc(l.url)+'</div></div>'+
        '<button class="lr-btn" data-act="open-link-url" data-v="'+esc(l.url)+'" aria-label="打开链接"><svg class="ic"><use href="#i-globe"/></svg></button>'+
        '<button class="lr-btn danger" data-act="link-del" data-v="'+l.id+'" aria-label="删除链接"><svg class="ic"><use href="#i-trash"/></svg></button></div>';
    }).join(''):'<div class="m-empty" style="padding:12px 0 6px">还没有链接</div>')+
    '<div class="add-link-row"><input class="text-input" id="lkUrl" placeholder="粘贴网址或路径" style="flex:1">'+
    '<button class="btn-sm" data-act="link-add">添加</button></div></div></div>';
  var foot='<button class="danger-text" data-act="edit-del"><svg class="ic"><use href="#i-trash"/></svg>删除</button>'+
    '<span class="spacer"></span><button class="btn-ghost" data-act="sheet-close">取消</button>'+
    '<button class="btn-pri" data-act="edit-save">保存</button>';
  return sheetShell('编辑任务','',body,foot);
}

/* ---------- 日期时间选择器（claude 风格内嵌） ---------- */
function dpEmbedHtml(d){
  var month=d.dpMonth||new Date();
  var first=new Date(month.getFullYear(),month.getMonth(),1);
  var startOffset=(first.getDay()+6)%7;
  var gridStart=addDays(first,-startOffset);
  var today=new Date();
  var sel=d.due?new Date(d.due):null;
  var cells='';
  for(var i=0;i<42;i++){
    var day=addDays(gridStart,i);
    var cls='dp-day';
    if(day.getMonth()!==month.getMonth()) cls+=' out';
    if(sameDay(day,today)) cls+=' today';
    if(sel&&sameDay(day,sel)) cls+=' sel';
    if(dayStart(day)<dayStart(today)) cls+=' past';
    cells+='<button class="'+cls+'" data-act="dp-day" data-v="'+day.getTime()+'">'+day.getDate()+'</button>';
  }
  var quick=['09:00','18:00'].filter(function(q){
    if(!sel||!sameDay(sel,today)) return true;
    var p=q.split(':'); var x=new Date(); x.setHours(+p[0],+p[1],0,0);
    return x>today;
  });
  return '<div class="dp-embed"><div class="dp-head">'+
    '<button class="dp-nav" data-act="dp-nav" data-v="-1" aria-label="上个月"><svg class="ic"><use href="#i-chevron-left"/></svg></button>'+
    '<span class="dp-title">'+month.getFullYear()+'年'+(month.getMonth()+1)+'月</span>'+
    '<button class="dp-nav" data-act="dp-nav" data-v="1" aria-label="下个月"><svg class="ic"><use href="#i-chevron-right"/></svg></button></div>'+
    '<div class="dp-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>'+
    '<div class="dp-grid">'+cells+'</div>'+
    '<div class="dp-time"><span class="dp-time-lb">时间</span>'+
    '<input class="dp-tinp" id="dpH" value="'+esc(d.dpH||'18')+'" maxlength="2" inputmode="numeric"><span class="dp-colon">:</span>'+
    '<input class="dp-tinp" id="dpM" value="'+esc(d.dpM||'00')+'" maxlength="2" inputmode="numeric">'+
    '<span class="dp-quickrow">'+quick.map(function(q){return '<button class="dp-q" data-act="dp-q" data-v="'+q+'">'+q+'</button>';}).join('')+'</span></div>'+
    '<div class="dp-foot"><button class="btn-ghost" data-act="dp-clear" style="height:32px">清除</button><span class="spacer"></span>'+
    '<button class="btn-sm" data-act="dp-ok" style="height:32px">确定</button></div></div>';
}

/* ---------- 筛选 ---------- */
function filterSheetHtml(){
  var f=ui.filters;
  function chip(on,act,v,label){ return '<button class="pick-chip'+(on?' on':'')+'" data-act="'+act+'" data-v="'+v+'">'+label+'</button>'; }
  var body='<div class="form-field" style="margin-top:4px"><div class="field-label">日期</div><div class="chip-row">'+
    [['today','今天'],['tomorrow','明天'],['week','本周'],['overdue','已逾期']].map(function(x){
      return chip(f.date===x[0],'f-date',x[0],x[1]); }).join('')+'</div></div>'+
    '<div class="form-field"><div class="field-label">项目</div><div class="chip-row">'+
    state.projects.map(function(p){ return chip(f.proj.indexOf(p.id)>=0,'f-proj',p.id,'<span class="dot" style="--dot:'+p.color+'"></span>'+esc(p.name)); }).join('')+'</div></div>'+
    '<div class="form-field"><div class="field-label">标签</div><div class="chip-row">'+
    state.tags.map(function(t){ return chip(f.tags.indexOf(t.id)>=0,'f-tag',t.id,'# '+esc(t.name)); }).join('')+'</div></div>'+
    '<div class="form-field"><div class="field-label">优先级</div><div class="chip-row">'+
    [['high','高'],['med','中'],['low','低']].map(function(x){ return chip(f.prio.indexOf(x[0])>=0,'f-prio',x[0],x[1]); }).join('')+'</div></div>'+
    '<div class="form-field"><div class="field-label">关键词</div>'+
    '<input class="text-input" id="fKw" placeholder="搜索标题与备注" value="'+esc(f.kw)+'"></div>';
  var foot='<button class="btn-ghost" data-act="fclear-all">清除全部</button><span class="spacer"></span>'+
    '<button class="btn-pri" data-act="f-apply">完成</button>';
  return sheetShell('筛选','',body,foot);
}

/* ---------- 项目/标签管理 ---------- */
function manageSheetHtml(d){
  var scope=d.scope||'all';
  var body='';
  function section(kind,label){
    var arr=kind==='proj'?state.projects:state.tags;
    var rows=arr.map(function(x){
      var n=state.tasks.filter(function(t){ return kind==='proj'?t.proj===x.id:t.tags.indexOf(x.id)>=0; }).length;
      if(d.editing===x.id){
        return '<div class="mg-row"><input class="mg-input" id="mgInput" value="'+esc(x.name)+'" data-autofocus>'+
          '<button class="btn-sm" data-act="mg-save" data-kind="'+kind+'" data-v="'+x.id+'" style="height:32px">保存</button></div>';
      }
      return '<div class="mg-row">'+(kind==='proj'?'<span class="proj-dot" style="--dot:'+x.color+'"></span>':'<span class="tag-ic"><svg class="ic"><use href="#i-tag"/></svg></span>')+
        '<span class="mg-name">'+esc(x.name)+'</span><span class="mg-count">'+n+' 项</span>'+
        '<button class="mg-act" data-act="mg-edit" data-v="'+x.id+'" aria-label="重命名"><svg class="ic"><use href="#i-pencil"/></svg></button>'+
        '<button class="mg-act danger" data-act="mg-del" data-kind="'+kind+'" data-v="'+x.id+'" aria-label="删除"><svg class="ic"><use href="#i-trash"/></svg></button></div>';
    }).join('');
    return '<div class="form-field" style="margin-top:10px"><div class="field-label">'+label+'</div><div class="mg-list">'+
      (rows||'<div class="m-empty" style="padding:10px 0 4px">还没有'+label+'</div>')+'</div>'+
      '<div class="add-link-row"><input class="text-input" id="mgNew_'+kind+'" placeholder="新'+label+'名称" style="flex:1;height:38px;font-size:13px">'+
      '<button class="btn-sm" data-act="mg-add" data-kind="'+kind+'">添加</button></div></div>';
  }
  if(scope!=='tag') body+=section('proj','项目');
  if(scope!=='proj') body+=section('tag','标签');
  body+='<div class="mg-help">删除项目后，其任务变为「无项目」；删除标签会从任务上移除。均保留撤销。</div>';
  return sheetShell(scope==='proj'?'管理项目':scope==='tag'?'管理标签':'项目与标签','',body,
    '<span class="spacer"></span><button class="btn-pri" data-act="sheet-close">完成</button>');
}

/* ---------- 使用说明 / 确认 ---------- */
function helpSheetHtml(){
  var body='<div class="help-section"><h3>四个页签</h3><ul>'+
    '<li>今天：今天到期与已逾期的任务</li><li>视图：收件箱 / 已逾期 / 即将到期 / 项目 / 标签</li>'+
    '<li>中间陶土色 ＋：快速添加任务</li><li>已完成 / 设置：回顾与偏好</li></ul></div>'+
    '<div class="help-section"><h3>添加与编辑</h3><ul>'+
    '<li>输入「明天 9:00 写周报 #会议 !高」自动识别日期、标签、优先级</li>'+
    '<li>点任务打开编辑；点圆圈直接完成</li><li>删除保留 5 秒撤销</li></ul></div>'+
    '<div class="help-section"><h3>小组件</h3><ul>'+
    '<li>主屏幕：小尺寸进度环 / 中尺寸今日清单</li>'+
    '<li>锁屏：圆形进度 + 胶囊摘要（对应桌面版收起胶囊）</li>'+
    '<li>用顶部体验条切换「主屏幕小组件 / 锁屏」预览</li></ul></div>'+
    '<div class="help-section"><h3>数据</h3><ul>'+
    '<li>原型数据存浏览器 localStorage，仅本机</li><li>正式版纯本地存储，不做云同步</li></ul></div>';
  return sheetShell('使用说明','iOS 提案 v2.0',body,'<span class="spacer"></span><button class="btn-pri" data-act="sheet-close">知道了</button>');
}
function confirmSheetHtml(d){
  var body='<div class="cf-warn"><span class="cf-warn-ic"><svg class="ic"><use href="#i-alert"/></svg></span>'+
    '<div class="cf-warn-tx"><p>'+d.msg+'</p>'+(d.sub?'<p class="cf-sub">'+esc(d.sub)+'</p>':'')+'</div></div>';
  var foot='<span class="spacer"></span><button class="btn-ghost" data-act="sheet-close">取消</button>'+
    '<button class="btn-danger" data-act="confirm-ok">'+esc(d.okLabel||'删除')+'</button>';
  return sheetShell(d.title||'确认删除','',body,foot);
}

/* ---------- toast ---------- */
var toastTimer=null;
function toast(msg,actLabel,fn){
  var host=$('#toastHost');
  host.innerHTML='<div class="toast"><svg class="ic tic"><use href="#i-check"/></svg><span>'+esc(msg)+'</span>'+
    (actLabel?'<button class="tact" id="toastAct">'+esc(actLabel)+'</button>':'')+'</div>';
  if(actLabel&&fn) $('#toastAct').onclick=function(){ fn(); host.innerHTML=''; };
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){ host.innerHTML=''; },4000);
}

/* ---------- 场景 ---------- */
function renderWidgetScene(){
  var s=todayStats();
  var now=new Date();
  var list=sortTasks(viewTasks('today').filter(function(t){return !t.done;})).slice(0,3);
  var rows=list.map(function(t){
    var due=fmtDue(t);
    return '<div class="wm-row"><span class="wm-check"></span><span class="wm-t">'+esc(t.title)+'</span>'+
      '<span class="wm-time'+(due.over?' over':'')+'">'+(t.due?hm(t.due):'')+'</span></div>';
  }).join('');
  $('#sceneWidget').innerHTML=
    '<div class="hs-date">'+md(now)+' '+weekday(now)+'</div>'+
    '<div class="hs-grid"><div class="hs-row">'+
    '<div class="ios-widget w-small" data-act="goto-app" role="button" aria-label="今天小组件">'+
      '<div class="ws-head"><div><div class="ws-title">今天</div><div class="ws-date">'+md(now)+' '+weekday(now)+'</div></div></div>'+
      '<div class="ws-mid">'+ringHtml(s.pct,'lg')+'</div>'+
      '<div class="ws-foot">'+s.pend+' 项待办'+(s.over?' · <span class="over">'+s.over+' 逾期</span>':'')+'</div></div>'+
    '<div style="width:158px;display:flex;flex-direction:column;gap:22px">'+
      '<div class="dock-ic g1" style="width:56px;height:56px;margin:0 auto"><svg class="ic"><use href="#i-calendar"/></svg></div>'+
      '<div class="dock-ic g2" style="width:56px;height:56px;margin:0 auto"><svg class="ic"><use href="#i-notes"/></svg></div></div>'+
    '</div>'+
    '<div class="ios-widget w-medium" data-act="goto-app" role="button" aria-label="今天清单小组件">'+
      '<div class="wm-head"><div><div class="wm-title">今天</div><div class="wm-sub">'+s.pend+' 项待办'+(s.over?' · <span class="over">'+s.over+' 项逾期</span>':'')+'</div></div>'+ringHtml(s.pct,'sm')+'</div>'+
      '<div class="wm-list">'+(rows||'<div class="m-empty" style="padding:10px">今天没有待办</div>')+'</div></div>'+
    '<div class="hs-hint">小尺寸 ≈ 桌面挂件的进度摘要 · 中尺寸 ≈ 挂件清单<br>点按小组件直达 App「今天」（正式版纳入 WidgetKit）</div></div>'+
    '<div class="hs-dock"><div class="dock-ic g3"><svg class="ic"><use href="#i-globe"/></svg></div>'+
    '<div class="dock-ic app" data-act="goto-app" role="button" aria-label="打开桌面待办"><svg class="ic"><use href="#i-check"/></svg></div>'+
    '<div class="dock-ic g1"><svg class="ic"><use href="#i-folder"/></svg></div>'+
    '<div class="dock-ic g2"><svg class="ic"><use href="#i-bell"/></svg></div></div>';
}
function renderLockScene(){
  var s=todayStats();
  var next=sortTasks(viewTasks('today').filter(function(t){return !t.done;}))[0];
  var now=new Date();
  $('#sceneLock').innerHTML=
    '<div class="lk-date">'+md(now)+' '+weekday(now)+'</div>'+
    '<div class="lk-clock">9:41</div>'+
    '<div class="lk-accessory" data-act="goto-app" role="button" aria-label="今天摘要">'+
      '<span class="cap-check"><svg class="ic"><use href="#i-check"/></svg></span>'+
      '<span>今天 '+s.pend+' 项'+(s.over?' · <span class="over">'+s.over+' 逾期</span>':'')+'</span>'+
      '<span class="lk-ring" style="--p:'+(s.pct*1.0053).toFixed(2)+'"><svg viewBox="0 0 40 40"><circle class="tr" cx="20" cy="20" r="16"/><circle class="pr" cx="20" cy="20" r="16"/></svg></span></div>'+
    (next?'<div class="lk-rect" data-act="goto-app" role="button" aria-label="下一项任务">'+
      '<div class="lr-t"><svg class="ic"><use href="#i-clock"/></svg>接下来</div>'+
      '<div class="lr-task">'+esc(next.title)+'</div>'+
      '<div class="lr-sub">'+esc(fmtDue(next).text)+'</div></div>':'')+
    '<div class="lk-hint">锁屏胶囊 ≈ 桌面版收起胶囊（284×54 的锁屏等价物）<br>点按进入 App「今天」</div>'+
    '<div class="lk-torch"><svg class="ic"><use href="#i-sun"/></svg></div>'+
    '<div class="lk-cam"><svg class="ic"><use href="#i-grid"/></svg></div>';
}
function setScene(name){
  ui.scene=name;
  $('#sceneApp').hidden=name!=='app';
  $('#sceneWidget').hidden=name!=='widget';
  $('#sceneLock').hidden=name!=='lock';
  $('#dScreen').classList.toggle('lock-on',name==='lock');
  $('#dScreen').classList.toggle('widget-on',name==='widget');
  $$('.db-seg-btn').forEach(function(b){ b.classList.toggle('on',b.dataset.scene===name); });
  if(name==='widget') renderWidgetScene();
  if(name==='lock') renderLockScene();
  $('#stageNote').textContent=name==='app'?'iPhone 15 Pro · 393×852 · 与桌面版共用同一套设计令牌（暖纸底 / 陶土橙 / 衬线展示标题）':
    name==='widget'?'主屏幕小组件 · 小尺寸（进度摘要）+ 中尺寸（今日清单）· 点按直达 App':'锁屏 · 胶囊摘要 + 接下来任务 · 点按直达 App';
}

/* ---------- 行为 ---------- */
function findTask(id){ return state.tasks.filter(function(t){return t.id===id;})[0]; }
function syncDraftInputs(){
  if(!sheet) return;
  var d=sheet.draft;
  if(sheet.kind==='add'){ var c=$('#cInput'); if(c) d.title=c.value; }
  if(sheet.kind==='edit'){
    var t=$('#eTitle'), n=$('#eNotes');
    if(t) d.title=t.value;
    if(n) d.notes=n.value;
  }
  var h=$('#dpH'), m=$('#dpM');
  if(h) d.dpH=h.value;
  if(m) d.dpM=m.value;
}
function commitDue(d){
  var base=d.dpSel?new Date(d.dpSel):(d.due?new Date(d.due):new Date());
  var hh=Math.min(23,Math.max(0,parseInt(d.dpH,10)||0));
  var mm=Math.min(59,Math.max(0,parseInt(d.dpM,10)||0));
  base.setHours(hh,mm,0,0);
  if(base.getTime()<Date.now()){ toast('不能选择当前时间之前'); return false; }
  d.due=base.toISOString();
  return true;
}
function addTaskFromDraft(d){
  var parsed=parseInput(d.title||'');
  var title=parsed.clean;
  if(!title){ toast('先写点内容再添加'); return null; }
  var t={id:uid('task'),title:title,notes:d.notes||'',
    proj:d.proj||parsed.proj,tags:(d.tags||[]).concat(parsed.tags).filter(function(v,i,a){return a.indexOf(v)===i;}),
    prio:d.prio||parsed.prio,due:d.due||parsed.due,links:d.links||[],
    done:false,doneAt:null,created:Date.now()};
  state.tasks.push(t); save();
  return t;
}
function deleteTask(id){
  var idx=-1;
  state.tasks.some(function(t,i){ if(t.id===id){idx=i;return true;} return false; });
  if(idx<0) return;
  var removed=state.tasks.splice(idx,1)[0];
  save(); render();
  toast('已删除「'+removed.title.slice(0,12)+(removed.title.length>12?'…':'')+'」','撤销',function(){
    state.tasks.splice(Math.min(idx,state.tasks.length),0,removed); save(); render();
  });
}

document.addEventListener('click',function(e){
  var el=e.target.closest('[data-act],[data-tab]');
  if(!el) return;
  var act=el.dataset.act;
  if(el.dataset.tab){
    ui.tab=el.dataset.tab; ui.view=null; ui.status='all'; ui.filters={date:null,proj:[],tags:[],prio:[],kw:''};
    rerenderPage(true); return;
  }
  switch(act){
    case 'noop': break;
    case 'status-tab': ui.status=el.dataset.v; render(); break;
    case 'back': ui.view=null; ui.status='all'; rerenderPage(true); break;
    case 'open-view': ui.view=el.dataset.v; ui.tab='views'; ui.status='all'; ui.filters={date:null,proj:[],tags:[],prio:[],kw:''}; rerenderPage(true); break;
    case 'check': {
      e.stopPropagation();
      var t=findTask(el.dataset.id); if(!t) break;
      t.done=!t.done; t.doneAt=t.done?new Date().toISOString():null;
      save();
      el.classList.add('check-pop');
      setTimeout(render,180);
      break;
    }
    case 'open-task': {
      var t2=findTask(el.dataset.id); if(!t2) break;
      var d=JSON.parse(JSON.stringify(t2));
      d.dpOpen=false; d.dpMonth=d.due?new Date(d.due):new Date();
      d.dpH=d.due?hm(d.due).split(':')[0]:'18'; d.dpM=d.due?hm(d.due).split(':')[1]:'00';
      openSheet('edit',d);
      break;
    }
    case 'add': openSheet('add',blankDraft()); break;
    case 'add-send': {
      syncDraftInputs();
      var nt=addTaskFromDraft(sheet.draft);
      if(nt){ closeSheet(); render(); toast('已添加「'+nt.title.slice(0,12)+(nt.title.length>12?'…':'')+'」'); }
      break;
    }
    case 'edit-save': {
      syncDraftInputs();
      var d2=sheet.draft, t3=findTask(d2.id);
      if(!d2.title.trim()){ toast('标题不能为空'); break; }
      if(t3){
        t3.title=d2.title.trim(); t3.notes=d2.notes; t3.proj=d2.proj; t3.tags=d2.tags;
        t3.prio=d2.prio; t3.due=d2.due; t3.links=d2.links;
      }
      save(); closeSheet(); render(); toast('已保存');
      break;
    }
    case 'edit-del': {
      var d3=sheet.draft;
      openSheet('confirm',{title:'删除任务',msg:'确定删除「<b>'+esc(d3.title)+'</b>」？',
        sub:'删除后 5 秒内可撤销。',okLabel:'删除',onOk:function(){ deleteTask(d3.id); }});
      break;
    }
    case 'confirm-ok': {
      var cb=sheet.draft.onOk; closeSheet(); if(cb) cb();
      break;
    }
    case 'sheet-close': closeSheet(); break;
    case 'toggle-done': ui.doneOpen=!ui.doneOpen; render(); break;
    case 'filter': openSheet('filter',{}); break;
    case 'f-date': ui.filters.date=ui.filters.date===el.dataset.v?null:el.dataset.v; renderSheet(); break;
    case 'f-proj': case 'f-tag': case 'f-prio': {
      var key={ 'f-proj':'proj','f-tag':'tags','f-prio':'prio' }[act];
      var arr=ui.filters[key], v=el.dataset.v, i=arr.indexOf(v);
      if(i>=0) arr.splice(i,1); else arr.push(v);
      renderSheet(); break;
    }
    case 'f-apply': {
      var kw=$('#fKw'); ui.filters.kw=kw?kw.value.trim():'';
      closeSheet(); render(); break;
    }
    case 'fclear': {
      var k=el.dataset.k;
      if(k==='date') ui.filters.date=null;
      else if(k==='kw') ui.filters.kw='';
      else { var a=ui.filters[k]; a.splice(a.indexOf(el.dataset.v),1); }
      render(); break;
    }
    case 'fclear-all':
      ui.filters={date:null,proj:[],tags:[],prio:[],kw:''};
      if(sheet&&sheet.kind==='filter') renderSheet();
      render(); break;
    case 'pick-proj': syncDraftInputs(); sheet.draft.proj=sheet.draft.proj===el.dataset.v?null:el.dataset.v; renderSheet(); break;
    case 'pick-tag': {
      syncDraftInputs();
      var tg=sheet.draft.tags, tv=el.dataset.v, ti=tg.indexOf(tv);
      if(ti>=0) tg.splice(ti,1); else tg.push(tv);
      renderSheet(); break;
    }
    case 'pick-prio': syncDraftInputs(); sheet.draft.prio=sheet.draft.prio===el.dataset.v?null:el.dataset.v; renderSheet(); break;
    case 'prio-cycle': {
      syncDraftInputs();
      var order=[null,'high','med','low'];
      var cur=order.indexOf(sheet.draft.prio);
      sheet.draft.prio=order[(cur+1)%order.length];
      renderSheet(); break;
    }
    case 'dp-toggle': {
      syncDraftInputs();
      sheet.draft.dpOpen=!sheet.draft.dpOpen;
      if(sheet.draft.dpOpen&&sheet.draft.due){
        var dd=new Date(sheet.draft.due);
        sheet.draft.dpMonth=new Date(dd.getFullYear(),dd.getMonth(),1);
        sheet.draft.dpSel=dd.getTime();
        sheet.draft.dpH=hm(dd).split(':')[0]; sheet.draft.dpM=hm(dd).split(':')[1];
      }
      renderSheet(); break;
    }
    case 'dp-nav': {
      syncDraftInputs();
      var mm2=sheet.draft.dpMonth||new Date();
      sheet.draft.dpMonth=new Date(mm2.getFullYear(),mm2.getMonth()+parseInt(el.dataset.v,10),1);
      renderSheet(); break;
    }
    case 'dp-day': {
      syncDraftInputs();
      var ts=parseInt(el.dataset.v,10);
      if(ts<dayStart(new Date()).getTime()) break;
      sheet.draft.dpSel=ts;
      renderSheet(); break;
    }
    case 'dp-q': {
      syncDraftInputs();
      var p=el.dataset.v.split(':');
      sheet.draft.dpH=p[0]; sheet.draft.dpM=p[1];
      renderSheet(); break;
    }
    case 'dp-clear': syncDraftInputs(); sheet.draft.due=null; sheet.draft.dpSel=null; sheet.draft.dpOpen=false; renderSheet(); break;
    case 'dp-ok': {
      syncDraftInputs();
      if(!sheet.draft.dpSel&&!sheet.draft.due){ toast('先选择日期'); break; }
      if(commitDue(sheet.draft)){ sheet.draft.dpOpen=false; renderSheet(); }
      break;
    }
    case 'link-add': {
      syncDraftInputs();
      var inp=$('#lkUrl'), url=inp?inp.value.trim():'';
      if(!url) break;
      if(!/^(https?:\/\/|\/|file:\/\/)/i.test(url)){ toast('无法识别的链接地址'); break; }
      var kind=/^https?:\/\//i.test(url)?'web':(url.endsWith('/')?'folder':'file');
      var title=kind==='web'?url.replace(/^https?:\/\//,'').slice(0,44):url.split('/').filter(Boolean).pop();
      sheet.draft.links.push({id:uid('lk'),kind:kind,title:title,url:url});
      renderSheet(); break;
    }
    case 'link-del': {
      syncDraftInputs();
      sheet.draft.links=sheet.draft.links.filter(function(l){return l.id!==el.dataset.v;});
      renderSheet(); break;
    }
    case 'open-link': case 'open-link-url':
      e.stopPropagation();
      toast('原型演示：正式版将打开浏览器 / 文件'); break;
    case 'switch': {
      var sk=el.dataset.k;
      state.settings[sk]=!state.settings[sk]; save(); render();
      if(sk==='notify'&&state.settings.notify) toast('正式版将请求系统通知权限');
      break;
    }
    case 'manage': openSheet('manage',{scope:el.dataset.scope||'all',editing:null}); break;
    case 'mg-edit': syncDraftInputs(); sheet.draft.editing=el.dataset.v; renderSheet(); break;
    case 'mg-save': {
      var inp2=$('#mgInput'), name2=inp2?inp2.value.trim():'';
      var kind2=el.dataset.kind, arr2=kind2==='proj'?state.projects:state.tags;
      var item=arr2.filter(function(x){return x.id===el.dataset.v;})[0];
      if(!name2){ toast('名称不能为空'); break; }
      if(arr2.some(function(x){return x.name===name2&&x.id!==el.dataset.v;})){ toast('已有同名'+(kind2==='proj'?'项目':'标签')); break; }
      if(item) item.name=name2;
      sheet.draft.editing=null; save(); renderSheet(); render(); break;
    }
    case 'mg-add': {
      var kind3=el.dataset.kind;
      var inp3=$('#mgNew_'+kind3), name3=inp3?inp3.value.trim():'';
      var arr3=kind3==='proj'?state.projects:state.tags;
      if(!name3){ toast('名称不能为空'); break; }
      if(arr3.some(function(x){return x.name===name3;})){ toast('已有同名'+(kind3==='proj'?'项目':'标签')); break; }
      if(kind3==='proj'){
        var palette=['#6E8FB8','#C9A227','#7F9A6D','#B98A8A','#8A7FB9'];
        state.projects.push({id:uid('p'),name:name3,color:palette[state.projects.length%palette.length]});
      }else state.tags.push({id:uid('t'),name:name3});
      save(); renderSheet(); render(); break;
    }
    case 'mg-del': {
      var kind4=el.dataset.kind, id4=el.dataset.v;
      var arr4=kind4==='proj'?state.projects:state.tags;
      var it4=arr4.filter(function(x){return x.id===id4;})[0];
      var n4=state.tasks.filter(function(t){return kind4==='proj'?t.proj===id4:t.tags.indexOf(id4)>=0;}).length;
      var doDel=function(){
        var ix=arr4.indexOf(it4); arr4.splice(ix,1);
        state.tasks.forEach(function(t){
          if(kind4==='proj'&&t.proj===id4) t.proj=null;
          if(kind4==='tag') t.tags=t.tags.filter(function(x){return x!==id4;});
        });
        if(ui.view===(kind4==='proj'?'proj:':'tag:')+id4){ ui.view=null; ui.tab='today'; }
        save(); render();
        toast('已删除「'+it4.name+'」','撤销',function(){
          arr4.splice(Math.min(ix,arr4.length),0,it4); save(); render();
        });
      };
      if(n4>0){
        var keepScope=sheet.draft.scope||'all';
        openSheet('confirm',{title:'删除'+(kind4==='proj'?'项目':'标签'),
          msg:'「<b>'+esc(it4.name)+'</b>」关联 '+n4+' 项任务，确定删除？',
          sub:kind4==='proj'?'任务会保留并变为「无项目」。':'标签会从任务上移除，任务保留。',
          okLabel:'删除',onOk:function(){ doDel(); openSheet('manage',{scope:keepScope,editing:null}); }});
      }else{ doDel(); renderSheet(); }
      break;
    }
    case 'help': openSheet('help',{}); break;
    case 'export': toast('原型演示：正式版导出 JSON 并调起分享面板'); break;
    case 'reset':
      openSheet('confirm',{title:'重置演示数据',msg:'恢复初始演示任务？',sub:'当前修改会被清空。',okLabel:'重置',
        onOk:function(){ state=seed(); save(); ui.view=null; ui.tab='today'; render(); toast('已恢复演示数据'); }});
      break;
    case 'widget-demo': setScene('widget'); break;
    case 'goto-app': setScene('app'); ui.tab='today'; ui.view=null; rerenderPage(true); break;
  }
});
/* 搜索输入 */
document.addEventListener('input',function(e){
  if(e.target.id==='kwInput'){
    ui.filters.kw=e.target.value;
    var pos=e.target.selectionStart;
    render();
    var inp=$('#kwInput');
    if(inp){ inp.focus(); try{inp.setSelectionRange(pos,pos);}catch(x){} }
  }
  if(e.target.id==='cInput'){
    var ta=e.target;
    ta.style.height='24px';
    ta.style.height=Math.min(110,ta.scrollHeight)+'px';
    ta.style.overflowY=ta.scrollHeight>110?'auto':'hidden';
    if(sheet&&sheet.kind==='add'){
      sheet.draft.title=ta.value;
      var pv=parseInput(ta.value);
      var chips=[];
      if(pv.due){ var dd=new Date(pv.due);
        chips.push('<span class="chip" style="background:var(--accent-soft);color:var(--accent-deep)">'+esc((sameDay(dd,new Date())?'今天 ':sameDay(dd,addDays(new Date(),1))?'明天 ':md(dd)+' ')+hm(dd))+'</span>'); }
      pv.tags.forEach(function(id){ chips.push(tagChips([id])); });
      if(pv.prio) chips.push(prioHtml(pv.prio));
      var host=$('.parse-preview');
      if(!host&&chips.length){
        host=document.createElement('div'); host.className='parse-preview';
        $('.composer').after(host);
      }
      if(host) host.innerHTML=chips.join('');
    }
  }
});

/* 键盘：Esc 关弹层；composer 回车保存 */
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&sheet){ closeSheet(); return; }
  if(e.key==='Enter'&&!e.shiftKey&&e.target.id==='cInput'&&sheet&&sheet.kind==='add'){
    e.preventDefault();
    syncDraftInputs();
    var nt=addTaskFromDraft(sheet.draft);
    if(nt){ closeSheet(); render(); toast('已添加「'+nt.title.slice(0,12)+(nt.title.length>12?'…':'')+'」'); }
  }
  if(e.key==='Enter'&&e.target.id==='mgInput'){
    var btn=$('[data-act="mg-save"]'); if(btn) btn.click();
  }
});

/* 体验条场景切换 */
$$('.db-seg-btn').forEach(function(b){
  b.addEventListener('click',function(){ setScene(b.dataset.scene); });
});

/* 启动 */
render();
setScene('app');
})();