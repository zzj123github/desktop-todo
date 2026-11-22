/* =========================================================
   render.js · 所有界面片段的生成
   ========================================================= */
(function(){
'use strict';
var DT = window.DT;
var R = window.R = {};
var esc = DT.escapeHtml;

R.ctx = {
  searchOpen:false,
  doneOpen:false,
  widgetDoneOpen:false,
  widgetCollapsed:false,
  /* 临时调整 C：挂件输入区是否展开为完整 composer（默认收起为小按钮） */
  widgetComposerOpen:false,
  animateId:null
};

R.icon = function(name, cls){
  return '<svg class="ic'+(cls?' '+cls:'')+'"><use href="#i-'+name+'"/></svg>';
};
R.ring = function(pct, size){
  var cls = size==='sm' ? ' sm' : (size==='xs' ? ' xs' : '');
  if(pct >= 100) cls += ' wide';
  return '<div class="ring'+cls+'" style="--p:'+pct+'"><svg viewBox="0 0 40 40" aria-hidden="true">'
    + '<circle class="tr" cx="20" cy="20" r="16"/><circle class="pr" cx="20" cy="20" r="16"/></svg>'
    + '<span>'+pct+'%</span></div>';
};
R.dueLabel = function(iso){
  if(!iso) return '';
  var d = new Date(iso), ts = DT.dayStart(new Date()), ds = DT.dayStart(d);
  var diff = Math.round((ds-ts)/86400000);
  if(diff===0) return '今天 '+DT.fmtHM(d);
  if(diff===1) return '明天 '+DT.fmtHM(d);
  if(diff>1 && diff<7) return DT.weekday(d)+' '+DT.fmtHM(d);
  return DT.monthDay(d);
};
R.draftDueLabel = function(iso){
  if(!iso) return '日期';
  var d = new Date(iso), ts = DT.dayStart(new Date());
  if(DT.dayStart(d).getTime()===ts.getTime()) return '今天';
  if(DT.dayStart(d).getTime()===DT.addDays(ts,1).getTime()) return '明天';
  return DT.monthDay(d);
};

/* ---------- 任务行 ---------- */
var LINK_ICON = {url:'globe', folder:'folder', file:'file'};
R.linkHtml = function(lk, t, idx){
  return '<span class="t-link" data-act="open-link" data-id="'+t.id+'" data-i="'+idx+'" title="'+esc(lk.path)+'">'
    + R.icon(LINK_ICON[lk.type]||'link') + esc(lk.name) + '</span>';
};
R.taskChips = function(t){
  var out = '';
  var p = t.projectId ? DT.projectById(t.projectId) : null;
  if(p) out += '<span class="chip dot" style="--dot:'+p.color+'">'+esc(p.name)+'</span>';
  (t.tagIds||[]).forEach(function(id){
    var tg = DT.tagById(id);
    if(tg) out += '<span class="chip tag">'+esc(tg.name)+'</span>';
  });
  if(!t.done && t.priority && t.priority!=='none'){
    out += '<span class="prio '+t.priority+'">'+R.icon('flag')+DT.prioLabel[t.priority]+'</span>';
  }
  return out;
};
R.metaHtml = function(t){
  var out = [];
  if(t.done){
    out.push('<span>已完成</span>');
  } else if(t.due){
    var d = DT.fmtDue(t);
    out.push('<span class="'+(d.over?'over':'')+'">'+esc(d.text)+'</span>');
  }
  var links = t.links||[];
  links.slice(0,2).forEach(function(lk,i){ out.push(R.linkHtml(lk,t,i)); });
  if(links.length>2) out.push('<span>+'+(links.length-2)+' 个链接</span>');
  return out.join('<span class="sep">·</span>');
};
R.taskRow = function(t, opt){
  opt = opt || {};
  var chips = opt.widget ? '' : R.taskChips(t);
  var anim = R.ctx.animateId===t.id ? ' row-enter' : '';
  return '<div class="task-row'+(t.done?' done':'')+anim+'" data-act="edit-task" data-id="'+t.id+'" role="button" tabindex="0">'
    + '<button type="button" class="t-check" data-act="toggle-task" data-id="'+t.id+'" role="checkbox" aria-checked="'+(t.done?'true':'false')+'" aria-label="'+(t.done?'标记为未完成':'标记为完成')+'">'+R.icon('check')+'</button>'
    + '<div class="t-main"><div class="t-title">'+esc(t.title)+chips+'</div><div class="t-meta">'+R.metaHtml(t)+'</div></div>'
    + '<div class="t-tail"><button type="button" class="t-mini danger" data-act="delete-task" data-id="'+t.id+'" title="删除任务" aria-label="删除任务">'+R.icon('trash')+'</button></div>'
    + '</div>';
};

/* ---------- 左栏 ---------- */
R.sidebar = function(){
  var c = DT.navCounts();
  var nav = DT.state.ui.nav;
  function item(type,id,icon,label,count,danger){
    var active = nav.type===type && (id ? nav.id===id : true);
    return '<button type="button" class="nav-item'+(active?' active':'')+(danger&&count?' overdue':'')+'" data-act="nav" data-type="'+type+'"'
      + (id?' data-id="'+id+'"':'') + '>' + R.icon(icon) + '<span>'+esc(label)+'</span><span class="n-count">'+(count||'')+'</span></button>';
  }
  function section(label,scope){
    return '<div class="nav-sec"><span>'+label+'</span>'
      + '<button type="button" class="nav-sec-mgr" data-act="manage-scope" data-scope="'+scope+'" title="管理'+label+'" aria-label="管理'+label+'">'+R.icon('pencil')+'</button></div>';
  }
  var html = '<div class="brand"><span class="brand-icon">'+R.icon('check')+'</span><span class="brand-name">桌面待办</span></div>';
  html += '<div class="sb-scroll">';
  html += '<div class="nav">'
    + item('inbox',null,'inbox','收件箱',c.inbox)
    + item('today',null,'sun','今天',c.today)
    + item('overdue',null,'alert','已逾期',c.overdue,true)
    + item('upcoming',null,'calendar','即将到期',c.upcoming)
    + item('done',null,'check-circle','已完成',c.done)
    + '</div>';
  html += section('项目','project') + '<div class="nav">';
  DT.state.projects.forEach(function(p){
    var on = nav.type==='project' && nav.id===p.id;
    html += '<div class="nav-row">'
      + '<button type="button" class="nav-item'+(on?' active':'')+'" data-act="nav" data-type="project" data-id="'+p.id+'">'
      + '<span class="proj-dot" style="--dot:'+p.color+'"></span><span class="nav-tx">'+esc(p.name)+'</span><span class="n-count">'+(c.projects[p.id]||'')+'</span></button>'
      + '<button type="button" class="nav-del" data-act="del-project" data-id="'+p.id+'" title="删除项目" aria-label="删除项目 '+esc(p.name)+'">'+R.icon('trash')+'</button>'
      + '</div>';
  });
  html += '</div>' + section('标签','tag') + '<div class="nav">';
  DT.state.tags.forEach(function(tg){
    var on = nav.type==='tag' && nav.id===tg.id;
    html += '<div class="nav-row">'
      + '<button type="button" class="nav-item'+(on?' active':'')+'" data-act="nav" data-type="tag" data-id="'+tg.id+'">'
      + '<span class="tag-ic">'+R.icon('tag')+'</span><span class="nav-tx">'+esc(tg.name)+'</span><span class="n-count">'+(c.tags[tg.id]||'')+'</span></button>'
      + '<button type="button" class="nav-del" data-act="del-tag" data-id="'+tg.id+'" title="删除标签" aria-label="删除标签 '+esc(tg.name)+'">'+R.icon('trash')+'</button>'
      + '</div>';
  });
  html += '</div>';
  html += '</div>';
  html += '<div class="sb-foot">'
    + '<button type="button" class="sb-settings" data-act="settings">'+R.icon('settings')+'设置</button></div>';
  return html;
};

/* ---------- 完整窗口主区 ---------- */
R.main = function(){
  var meta = DT.viewMeta();
  var g = DT.grouped();
  var prog = DT.progress(g.scope);
  var tabs = DT.tabCounts(g.scope);
  var overdue = g.scope.filter(function(t){return DT.isOverdue(t);}).length;
  var html = '<div class="mhead">'
    + '<div class="mhead-l"><h1 class="mtitle">'+esc(meta.title)+'</h1><div class="msub">'
    + '<span>'+esc(meta.sub)+'</span>'
    + (overdue ? '<span class="sep">·</span><span class="over">'+overdue+' 项逾期</span>' : '')
    + '</div></div>'
    + '<div class="mhead-r">' + R.ring(prog.pct)
    + '<div class="mhead-shapes">'
    + '<button type="button" class="icon-btn" data-act="to-widget" title="收起到挂件" aria-label="收起到挂件">'+R.icon('grid')+'</button>'
    + '<button type="button" class="icon-btn" data-act="to-capsule" title="收起到胶囊" aria-label="收起到胶囊">'+R.icon('minus')+'</button>'
    + '</div>'
    + '<button type="button" class="btn-pri" data-act="new-task">'+R.icon('plus')+'新建</button>'
    + '<button type="button" class="icon-btn mhead-close" data-act="close-window" title="关闭完整窗口，回到桌面" aria-label="关闭完整窗口">'+R.icon('x')+'</button>'
    + '</div></div>';
  html += '<div class="tabs" role="tablist">'
    + R.tabBtn('all','全部',tabs.all)
    + R.tabBtn('todo','待办',tabs.todo)
    + R.tabBtn('done','已完成',tabs.done)
    + '</div>';
  html += R.filterbar();
  html += '<div class="groups" id="groupsHost">' + R.groupsHtml(g) + '</div>';
  html += R.composerHtml('main');
  html += '<div class="mfoot"><span>'+prog.done+'/'+prog.total+' 已完成</span>'
    + '<span class="hint">双击空白处快速新增 · 拖入文件自动挂链接</span></div>';
  return html;
};
R.tabBtn = function(key,label,count){
  var on = DT.state.ui.tab===key;
  return '<button type="button" class="tab'+(on?' on':'')+'" data-act="tab" data-tab="'+key+'" role="tab">'+esc(label)+'<span class="count">'+count+'</span></button>';
};
R.filterbar = function(){
  var f = DT.state.ui.filters;
  var chips = DT.activeFilterChips();
  var tagCount = (f.projectIds||[]).length + (f.tagIds||[]).length;
  var html = '<div class="filterbar">';
  html += '<button type="button" class="fbtn" data-act="filter-tags">'+R.icon('tag')+'标签'
    + (tagCount?'<span class="fcount">'+tagCount+'</span>':'')+R.icon('chevron')+'</button>';
  html += '<button type="button" class="fbtn" data-act="filter-date">'+R.icon('calendar')+'日期'
    + (f.date?'<span class="fcount">1</span>':'')+R.icon('chevron')+'</button>';
  html += '<button type="button" class="fbtn" data-act="filter-prio">'+R.icon('flag')+'优先级'
    + ((f.priorities||[]).length?'<span class="fcount">'+f.priorities.length+'</span>':'')+R.icon('chevron')+'</button>';
  chips.forEach(function(ch){
    html += '<button type="button" class="fchip" data-act="remove-chip" data-kind="'+ch.kind+'"'+(ch.id?' data-id="'+ch.id+'"':'')+'>'
      + esc(ch.label)+'<span class="x">'+R.icon('x')+'</span></button>';
  });
  if(DT.filtersActive()) html += '<button type="button" class="fclear" data-act="clear-filters">清除</button>';
  html += '<div class="fright">';
  if(R.ctx.searchOpen){
    html += '<div class="searchbox">'+R.icon('search')
      + '<input id="mainSearchInput" type="text" placeholder="搜索标题或备注" value="'+esc(f.keyword)+'" aria-label="搜索任务">'
      + '<button type="button" class="sx" data-act="close-search" aria-label="关闭搜索">'+R.icon('x')+'</button></div>';
  } else {
    html += '<button type="button" class="icon-btn" data-act="toggle-search" title="搜索 (Ctrl+F)" aria-label="搜索">'+R.icon('search')+'</button>';
  }
  html += '</div></div>';
  return html;
};
R.groupsHtml = function(g){
  g = g || DT.grouped();
  var pending = g.pending, done = g.done;
  var tab = DT.state.ui.tab;
  /* 已完成组始终给出表头（数量 + 折叠箭头）：只藏在 todo 标签页；
     全部/已完成页都显示，默认折叠但可展开。 */
  var showDone = (tab!=='todo') && (tab==='done' || done.length>0 || R.ctx.doneOpen);
  var html = '';
  if(tab!=='done'){
    html += '<div class="group-head"><span>待办</span><span class="g-count">'+pending.length+'</span></div>';
    if(pending.length){
      html += '<div class="grow-list">' + pending.map(function(t){return R.taskRow(t);}).join('') + '</div>';
    }
  }
  if(showDone || tab==='done'){
    var closed = (!R.ctx.doneOpen && tab!=='done' && pending.length>0);
    html += '<div class="group-head"><span>已完成</span><span class="g-count">'+done.length+'</span>'
      + (tab!=='done' ? '<button type="button" class="chev'+(closed?' closed':'')+'" data-act="toggle-done-group" aria-label="折叠已完成">'+R.icon('chevron')+'</button>' : '')
      + '</div>';
    if(!closed){
      if(done.length) html += '<div class="grow-list">' + done.map(function(t){return R.taskRow(t);}).join('') + '</div>';
      else html += '<div class="m-empty">还没有已完成的任务</div>';
    }
  }
  if(!pending.length && !done.length){
    var filtered = DT.filtersActive();
    html = '<div class="m-empty"><b>'+(filtered?'没有匹配的任务':'这里还是空的')+'</b>'
      + (filtered ? '换个筛选条件，或清除筛选看全部。' : '在下面的输入框里加一条，回车就保存。')
      + (filtered ? '<div style="margin-top:10px"><button type="button" class="btn-sm" data-act="clear-filters">清除筛选</button></div>' : '')
      + '</div>';
  }
  return html;
};

/* ---------- 输入框 ---------- */
function draftOf(scope){ return R.draft[scope]; }
R.chipProjectLabel = function(scope){
  var d = draftOf(scope);
  var names = [];
  (d.projectIds||[]).forEach(function(id){ var p=DT.projectById(id); if(p) names.push(p.name); });
  (d.tagIds||[]).forEach(function(id){ var t=DT.tagById(id); if(t) names.push(t.name); });
  if(!names.length) return '标签';
  return names[0] + (names.length>1?' +'+(names.length-1):'');
};
R.composerHtml = function(scope){
  var d = draftOf(scope);
  var due = d.due ? '<span>'+esc(R.draftDueLabel(d.due))+'</span><span class="x" data-act="composer-clear" data-scope="'+scope+'" data-kind="due">'+R.icon('x')+'</span>' : '<span>日期</span>';
  var tags = d.projectIds.length||d.tagIds.length ? '<span>'+esc(R.chipProjectLabel(scope))+'</span><span class="x" data-act="composer-clear" data-scope="'+scope+'" data-kind="tags">'+R.icon('x')+'</span>' : '<span>标签</span>';
  var prio = d.priority ? '<span>'+DT.prioLabel[d.priority]+'</span><span class="x" data-act="composer-clear" data-scope="'+scope+'" data-kind="priority">'+R.icon('x')+'</span>' : '<span>优先级</span>';
  var links = d.links.length ? '<span>'+d.links.length+' 个链接</span><span class="x" data-act="composer-clear" data-scope="'+scope+'" data-kind="links">'+R.icon('x')+'</span>' : '<span>链接</span>';
  var id = scope==='main' ? 'mainCInput' : 'widgetCInput';
  var ph = scope==='main' ? '添加任务，回车保存…' : '添加任务，回车保存…';
  return '<div class="composer" data-scope="'+scope+'">'
    + '<textarea class="cinput" id="'+id+'" rows="1" placeholder="'+ph+'" autocomplete="off" spellcheck="false">'+esc(d.text)+'</textarea>'
    + '<div class="composer-tools">'
    + '<button type="button" class="ctool'+(d.due?' on':'')+'" data-act="composer-chip" data-scope="'+scope+'" data-kind="due">'+R.icon('calendar')+due+R.icon('chevron')+'</button>'
    + '<button type="button" class="ctool'+((d.projectIds.length||d.tagIds.length)?' on':'')+'" data-act="composer-chip" data-scope="'+scope+'" data-kind="tags">'+R.icon('tag')+tags+R.icon('chevron')+'</button>'
    + '<button type="button" class="ctool'+(d.priority?' on':'')+'" data-act="composer-chip" data-scope="'+scope+'" data-kind="priority">'+R.icon('flag')+prio+R.icon('chevron')+'</button>'
    + '<button type="button" class="ctool'+(d.links.length?' on':'')+'" data-act="composer-chip" data-scope="'+scope+'" data-kind="links">'+R.icon('folder')+links+R.icon('chevron')+'</button>'
    + '<button type="button" class="composer-send" data-act="composer-send" data-scope="'+scope+'" title="保存（Enter）" aria-label="保存任务">'+R.icon('arrow-up')+'</button>'
    + '</div></div>';
};

/* ---------- 桌面挂件 / 胶囊：就近角基准（临时调整 A v1.1） ---------- */
R.WIDGET_W = 352;
R.capsuleSize = {w:284, h:54};
R.DEFAULT_WIDGET_H = 400;
/* 两种形态共用安全区：水平 16、顶部让开 demo-bar、底部让开任务栏。
   共用同一安全区，保证切换形态时基准角坐标在四角都严格不变。 */
R.SAFE = {x:16, top:56, bottom:54};
R.widgetHeight = function(){
  var el = document.querySelector('#widgetLayer .widget');
  return el ? el.offsetHeight : 0;
};
R.shapeSize = function(shape){
  if(shape==='capsule') return {w:R.capsuleSize.w, h:R.capsuleSize.h};
  return {w:R.WIDGET_W, h:R.widgetHeight() || DT.state.ui.lastWidgetH || R.DEFAULT_WIDGET_H};
};
R.cornerLeft = function(corner){ return corner==='tl'||corner==='bl'; };
R.cornerTop = function(corner){ return corner==='tl'||corner==='tr'; };
/* 当前形态的矩形离屏幕哪个角最近（用中心所在象限判断；无位置时默认右上） */
R.detectCorner = function(rect){
  var vw = window.innerWidth, vh = window.innerHeight;
  var left = rect.left + rect.w/2 < vw/2;
  var top = rect.top + rect.h/2 < vh/2;
  return (top?'t':'b') + (left?'l':'r');
};
R.cornerCoords = function(rect, corner){
  return {
    x: R.cornerLeft(corner) ? rect.left : rect.left + rect.w,
    y: R.cornerTop(corner) ? rect.top : rect.top + rect.h
  };
};
/* 由基准角 + 形态尺寸还原左上角 */
R.rectFromAnchor = function(shape, corner, ax, ay){
  var s = R.shapeSize(shape);
  return {
    left: R.cornerLeft(corner) ? ax : ax - s.w,
    top: R.cornerTop(corner) ? ay : ay - s.h,
    w: s.w, h: s.h
  };
};
R.clampRect = function(shape, rect){
  var vw = window.innerWidth, vh = window.innerHeight;
  var s = R.shapeSize(shape);
  var minX = R.SAFE.x, maxX = Math.max(minX, vw - s.w - R.SAFE.x);
  var minY = R.SAFE.top, maxY = Math.max(minY, vh - s.h - R.SAFE.bottom);
  return {left:DT.clamp(rect.left, minX, maxX), top:DT.clamp(rect.top, minY, maxY), w:s.w, h:s.h};
};
/* 读取/初始化基准角锚点，返回目标形态左上角；同时把锚点收紧到可视区（不落盘） */
R.applyAnchor = function(shape){
  var ui = DT.state.ui;
  if(!ui.anchor || typeof ui.anchor!=='object') ui.anchor = {corner:'tr', x:null, y:null};
  var a = ui.anchor;
  if(a.x==null || a.y==null || isNaN(a.x) || isNaN(a.y)){
    /* 默认右上角：与原型挂件默认位置一致 */
    a.corner = 'tr';
    a.x = window.innerWidth - 56;
    a.y = 88;
  }
  var rect = R.clampRect(shape, R.rectFromAnchor(shape, a.corner, a.x, a.y));
  var c = R.cornerCoords(rect, a.corner);
  a.x = c.x; a.y = c.y;
  return {x:rect.left, y:rect.top};
};
/* 记录当前形态的最近角：优先量 DOM，完整窗口打开时用锚点 + 上次尺寸还原 */
R.captureAnchor = function(shape){
  var ui = DT.state.ui;
  var wrap = document.querySelector('#widgetLayer .w-wrap, #widgetLayer .cap-wrap');
  var layer = document.getElementById('widgetLayer');
  var rect = null;
  if(wrap && layer && !layer.hidden){
    /* 用 offset* 而非 getBoundingClientRect：胶囊 hover 有 translateY(-2px) 动效，
       量 DOM 矩形会把悬停偏移带进锚点。 */
    rect = {left:wrap.offsetLeft, top:wrap.offsetTop, w:wrap.offsetWidth, h:wrap.offsetHeight};
  } else if(ui.anchor && ui.anchor.x!=null){
    rect = R.rectFromAnchor(shape, ui.anchor.corner, ui.anchor.x, ui.anchor.y);
  }
  if(!rect) return;
  var corner = R.detectCorner(rect);
  var c = R.cornerCoords(rect, corner);
  ui.anchor = {corner:corner, x:c.x, y:c.y};
};
/* 拖动时写位置：clamp 后按新矩形重新判断最近角 */
R.moveTo = function(shape, x, y){
  var rect = R.clampRect(shape, {left:x, top:y, w:0, h:0});
  var corner = R.detectCorner(rect);
  var c = R.cornerCoords(rect, corner);
  DT.state.ui.anchor = {corner:corner, x:c.x, y:c.y};
  return {x:rect.left, y:rect.top};
};
/* 渲染后用真实高度再对齐一次：只沿基准角相反方向伸缩，不动基准角 */
R.syncShape = function(shape){
  var wrap = document.querySelector('#widgetLayer .w-wrap, #widgetLayer .cap-wrap');
  if(!wrap) return;
  var p = R.applyAnchor(shape);
  wrap.style.left = p.x + 'px';
  wrap.style.top = p.y + 'px';
  wrap.style.opacity = (DT.settings().opacity || 100)/100;
  DT.state.ui.lastShape = shape;
  if(shape!=='capsule') DT.state.ui.lastWidgetH = wrap.offsetHeight;
};
/* 保留原型 API：窗口 resize 时按基准角重新收紧 */
R.ensureWidgetPos = function(){ if(DT.state.ui.mode==='desktop') R.renderWidgetLayer(); };
R.ensureCapsulePos = function(){ if(DT.state.ui.mode==='desktop') R.renderWidgetLayer(); };
/* 临时调整 C：挂件输入区默认只显示一个紧凑按钮 */
R.widgetComposerBtnHtml = function(){
  return '<button type="button" class="w-add-btn" data-act="widget-composer-open" title="展开输入框（Enter 保存）" aria-label="添加任务">'
    + R.icon('plus') + '<span>添加任务</span></button>';
};
R.widgetHtml = function(){
  var scope = DT.scope({type:'today'});
  var pending = DT.sortPending(scope.filter(function(t){return !t.done;}));
  var done = DT.sortDone(scope.filter(function(t){return t.done;}));
  var prog = DT.progress(scope);
  var overdueCount = pending.filter(DT.isOverdue).length;
  var ts = DT.dayStart(new Date());
  var pin = DT.settings().alwaysOnTop;
  var html = '<div class="widget'+(pin?'':' unpinned')+'" data-widget="1">'
    + '<div class="w-drag" data-drag="widget" title="拖动挂件">'+Array(7).join('<i></i>')+'</div>'
    + '<div class="w-head" data-drag="widget">'
    + '<div class="w-head-row"><div class="w-head-l"><div class="w-title">今天</div>'
    + '<div class="w-sub">'+DT.monthDay(ts)+' '+DT.weekday(ts)+(overdueCount?'<span class="over">· '+overdueCount+' 项逾期</span>':'')+'</div></div>'
    + '<div class="w-tools">'+R.ring(prog.pct,'sm')
    + '<button type="button" class="w-icon'+(pin?' on':'')+'" data-act="toggle-pin" title="'+(pin?'取消置顶':'置顶挂件')+'" aria-label="'+(pin?'取消置顶':'置顶')+'">'+R.icon('pin')+'</button>'
    + '<button type="button" class="w-icon" data-act="collapse-widget" title="收起为胶囊" aria-label="收起为胶囊">'+R.icon('minus')+'</button>'
    + '</div></div></div>';
  html += '<div class="w-body">';
  html += '<div class="w-group"><span>待办</span><span class="count">'+pending.length+'</span></div>';
  if(pending.length){
    html += pending.map(function(t){return R.taskRow(t,{widget:true});}).join('');
  } else {
    html += '<div class="w-empty">今天的任务都完成了</div>';
  }
  var closed = !R.ctx.widgetDoneOpen;
  html += '<div class="w-group"><span>已完成</span><span class="count">'+done.length+'</span>'
    + '<button type="button" class="chev'+(closed?' closed':'')+'" data-act="toggle-widget-done" aria-label="折叠已完成">'+R.icon('chevron')+'</button></div>';
  if(!closed){
    html += done.length ? done.map(function(t){return R.taskRow(t,{widget:true});}).join('') : '<div class="w-empty">暂无</div>';
  }
  html += '</div>';
  html += '<div class="w-add">' + (R.ctx.widgetComposerOpen ? R.composerHtml('widget') : R.widgetComposerBtnHtml()) + '</div>';
  html += '<div class="w-foot"><span>'+prog.done+'/'+prog.total+' 已完成</span><span class="hint">双击标题展开完整窗口</span></div>';
  html += '</div>';
  return html;
};
R.capsuleHtml = function(){
  var cap = DT.capsuleInfo();
  var label = '今天 '+cap.count+' 项'+(cap.overdue?'，'+cap.overdue+' 项逾期':'');
  return '<div class="capsule" data-act="cap-click" title="单击展开挂件，双击打开完整窗口" aria-label="'+esc(label)+'，单击展开挂件，双击打开完整窗口" role="button" tabindex="0">'
    + '<div class="cap-check">'+R.icon('check')+'</div>'
    + '<div class="cap-main"><div class="cap-title">今天 '+cap.count+' 项'
    + (cap.overdue?' · <span class="over">'+cap.overdue+' 项逾期</span>':'')+'</div>'
    + '<div class="cap-sub">'+esc(cap.sub)+'</div></div>'
    + '<div class="cap-ring">'+R.ring(cap.ring.pct,'xs')+'</div></div>';
};
R.renderWidgetLayer = function(){
  var layer = document.getElementById('widgetLayer');
  if(!layer) return;
  var ui = DT.state.ui;
  if(ui.mode!=='desktop'){
    /* 完整窗口打开时桌面形态整体隐藏：三形态互斥 */
    layer.innerHTML = '';
    layer.hidden = true;
    return;
  }
  layer.hidden = false;
  var op = (DT.settings().opacity||100)/100;
  var shape = R.ctx.widgetCollapsed ? 'capsule' : 'widget';
  var p = R.applyAnchor(shape);
  if(shape==='capsule'){
    layer.innerHTML = '<div class="cap-wrap" style="left:'+p.x+'px;top:'+p.y+'px;opacity:'+op+'">' + R.capsuleHtml() + '</div>';
  } else {
    var tip = '';
    if(!ui.tipDismissed){
      tip = '<div class="desk-tip">'+R.icon('help')+'<div>这是桌面挂件：拖我换位置，双击标题打开完整窗口；任务能直接勾选、点链接打开。</div>'
        + '<button type="button" data-act="dismiss-tip" aria-label="关闭提示">'+R.icon('x')+'</button></div>';
    }
    layer.innerHTML = '<div class="w-wrap" style="left:'+p.x+'px;top:'+p.y+'px;opacity:'+op+'">'+tip+R.widgetHtml()+'</div>';
  }
  R.syncShape(shape);
};

/* ---------- 整体渲染 ---------- */
/* 输入框自动换行：一行起步，随内容增高，超过上限后内部滚动 */
R.composerMaxH = 110;
R.autosizeComposer = function(el){
  if(!el || el.tagName!=='TEXTAREA') return;
  el.style.height = 'auto';
  var h = el.scrollHeight;
  el.style.height = Math.min(Math.max(h, 22), R.composerMaxH) + 'px';
  el.style.overflowY = h > R.composerMaxH ? 'auto' : 'hidden';
};
R.autosizeComposers = function(){
  var list = document.querySelectorAll('.composer textarea.cinput');
  for(var i=0;i<list.length;i++) R.autosizeComposer(list[i]);
};
R.renderAll = function(){
  var ui = DT.state.ui;
  var root = document.getElementById('root');
  /* 单桌面场景：完整窗口是覆盖在桌面上的窗口，不再切换场景 */
  root.className = 'root is-desktop';
  document.getElementById('desktopScene').hidden = false;
  document.getElementById('managerScene').hidden = ui.mode!=='manager';
  /* 桌面形态层始终渲染；窗口打开时由 renderWidgetLayer 清空并隐藏，保证三形态互斥 */
  R.renderWidgetLayer();
  if(ui.mode==='manager'){
    document.getElementById('sidebar').innerHTML = R.sidebar();
    document.getElementById('main').innerHTML = R.main();
  }
  R.ctx.animateId = null;
  R.autosizeComposers();
};
R.renderGroups = function(){
  var host = document.getElementById('groupsHost');
  if(host) host.innerHTML = R.groupsHtml();
};
R.renderComposer = function(scope){
  var sel = scope==='main' ? '#main .composer' : '.widget .composer';
  var el = document.querySelector(sel);
  if(!el) return;
  var wrap = document.createElement('div');
  wrap.innerHTML = R.composerHtml(scope);
  el.replaceWith(wrap.firstChild);
  R.autosizeComposers();
};

/* ---------- 设置 / 说明 / 打开链接 ---------- */
R.settingsModal = function(){
  var s = DT.settings();
  function row(name,desc,control){
    return '<div class="set-row"><div class="set-main"><div class="set-name">'+name+'</div><div class="set-desc">'+desc+'</div></div>'+control+'</div>';
  }
  var html = '<div class="modal" role="dialog" aria-modal="true" aria-label="设置">'
    + '<div class="modal-head"><div class="modal-title">设置</div><button type="button" class="modal-x" data-act="close-modal" aria-label="关闭">'+R.icon('x')+'</button></div>'
    + '<div class="modal-body">'
    + row('桌面挂件置顶','挂件始终显示在其他窗口之上','<button type="button" class="switch'+(s.alwaysOnTop?' on':'')+'" data-act="set-top" role="switch" aria-checked="'+(s.alwaysOnTop?'true':'false')+'" aria-label="置顶"></button>')
    + row('挂件透明度','不干扰桌面底下的内容',
        '<div class="seg-mini">'+[100,90,80].map(function(v){return '<button type="button" class="'+(s.opacity===v?'on':'')+'" data-act="set-opacity" data-v="'+v+'">'+v+'%</button>';}).join('')+'</div>')
    + row('开机自启','登录 Windows 后自动启动挂件（默认关闭）','<button type="button" class="switch'+(s.autostart?' on':'')+'" data-act="set-autostart" role="switch" aria-checked="'+(s.autostart?'true':'false')+'" aria-label="开机自启"></button>')
    + row('全局快捷键','Ctrl+Shift+Space 快速添加 · Alt+H 显隐挂件','<button type="button" class="switch'+(s.hotkeys?' on':'')+'" data-act="set-hotkeys" role="switch" aria-checked="'+(s.hotkeys?'true':'false')+'" aria-label="全局快捷键"></button>')
    + row('项目与标签','新建、重命名或删除项目与标签','<button type="button" class="btn-sm" data-act="manage">管理</button>')
    + row('数据','导出 JSON 备份，或恢复演示数据',
        '<div style="display:flex;gap:6px"><button type="button" class="btn-sm" data-act="export-data">导出</button><button type="button" class="btn-sm" data-act="reset">重置</button></div>')
    + '</div>'
    + '<div class="modal-foot"><span class="spacer"></span><button type="button" class="btn-pri" data-act="close-modal">完成</button></div></div>';
  return html;
};
R.helpModal = function(){
  return '<div class="modal wide" role="dialog" aria-modal="true" aria-label="使用说明">'
    + '<div class="modal-head"><div class="modal-title">怎么玩这个原型</div><button type="button" class="modal-x" data-act="close-modal" aria-label="关闭">'+R.icon('x')+'</button></div>'
    + '<div class="modal-body help-block">'
    + '<h4>一个桌面，三种形态</h4>'
    + '<p>默认是桌面挂件。挂件、胶囊、完整窗口同一时刻只出现一个：窗口标题行的按钮可以把窗口收成挂件或胶囊，双击挂件标题打开窗口；窗口右上角 X 或 <kbd>Esc</kbd> 回到桌面。</p>'
    + '<h4>值得试的几件事</h4>'
    + '<ul>'
    + '<li>勾选一条任务，看进度环和「已完成」如何更新；再点「已完成」展开、取消勾选。</li>'
    + '<li>点任务里的蓝色链接：会弹出「打开链接」说明（网页 → 默认浏览器；文件夹 → 资源管理器）。</li>'
    + '<li>点一条任务打开编辑面板，改日期/优先级/标签，或者点「删除」再撤销。</li>'
    + '<li>点挂件底部「+ 添加任务」展开输入框：回车保存、Shift+回车换行、Esc 或点别处收起。</li>'
    + '<li>挂件顶部减号 = 收成胶囊；双击标题 = 打开完整窗口。胶囊单击展开挂件，双击打开完整窗口。</li>'
    + '<li>把挂件或胶囊拖到屏幕四角：切换形态时，离得最近的那个角会保持不动，高度变化也向另一侧伸缩。</li>'
    + '<li>完整窗口里试筛选：标签 / 日期 / 优先级 组合，再点搜索；顶部「待办 / 已完成 / 全部」也能切。</li>'
    + '</ul>'
    + '<h4>快捷键</h4>'
    + '<ul><li><kbd>N</kbd> 或 <kbd>Ctrl</kbd>+<kbd>N</kbd> 新建任务</li><li><kbd>/</kbd> 或 <kbd>Ctrl</kbd>+<kbd>F</kbd> 搜索</li><li><kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>5</kbd> 切左栏视图</li><li><kbd>Esc</kbd> 收起输入 / 关闭浮层 / 关闭完整窗口</li></ul>'
    + '</div>'
    + '<div class="modal-foot"><span class="spacer"></span><button type="button" class="btn-pri" data-act="close-modal">开始体验</button></div></div>';
};
R.openLinkModal = function(link, task){
  var icon = LINK_ICON[link.type]||'link';
  var isUrl = link.type==='url';
  var kind = link.type==='url' ? '网页链接' : (link.type==='folder' ? '文件夹' : '文件');
  return '<div class="modal open-modal" role="dialog" aria-modal="true" aria-label="打开链接">'
    + '<div class="modal-head"><div class="modal-title">打开链接</div><button type="button" class="modal-x" data-act="close-modal" aria-label="关闭">'+R.icon('x')+'</button></div>'
    + '<div class="modal-body">'
    + '<div class="om-head"><div class="om-icon">'+R.icon(icon)+'</div><div style="min-width:0"><div class="om-name">'+esc(link.name)+'</div><div class="om-path">'+esc(link.path)+'</div></div></div>'
    + '<div class="om-body">打开方式：<b>'+kind+'</b> → '+(isUrl?'用系统默认浏览器打开':'打开资源管理器并定位到该位置')
    + (link.type==='folder'&&/^\\\\/.test(link.path)?'（UNC 路径会先探测共享盘是否可达，800ms 超时后提示「可能不在内网」）':'')
    + '。<br>原型中只展示打开方式，不会真的启动浏览器或资源管理器。</div>'
    + '<div class="om-note">安全规则：只允许 http/https 交给浏览器；本地路径先校验存在；禁止 file://、javascript: 与 shell 拼接。</div>'
    + '</div>'
    + '<div class="modal-foot"><span class="spacer"></span>'
    + '<button type="button" class="btn-ghost" data-act="copy-path" data-path="'+esc(link.path)+'">复制路径</button>'
    + '<button type="button" class="btn-ghost" data-act="close-modal">关闭</button>'
    + (isUrl?'<button type="button" class="btn-pri" data-act="open-url" data-url="'+esc(link.path)+'">用浏览器打开</button>':'')
    + '</div></div>';
};


/* ---------- 自定义日期时间选择器（claude 风格，替代原生 datetime-local） ---------- */
R.dpDate = function(v){
  if(!v) return null;
  if(v instanceof Date) return isNaN(v.getTime())?null:v;
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v.replace(/-/g,'/')+' 00:00');
  var d = new Date(v); return isNaN(d.getTime())?null:d;
};
R.dpFmt = function(v, mode){
  var d = R.dpDate(v);
  if(!d) return mode==='date' ? '选择日期' : '选择日期时间';
  var s = (d.getMonth()+1)+'月'+d.getDate()+'日 周'+'日一二三四五六'[d.getDay()];
  if(mode!=='date') s += ' ' + DT.pad2(d.getHours())+':'+DT.pad2(d.getMinutes());
  return s;
};
R.dpField = function(o){
  var mode = o.mode||'datetime';
  return '<button type="button" class="dp-field'+(o.value?'':' empty')+'" data-act="dp-open"'
    + ' data-scope="'+esc(o.scope)+'"'
    + (o.cscope ? ' data-cscope="'+esc(o.cscope)+'"' : '')
    + ' data-mode="'+mode+'"'
    + ' data-value="'+esc(o.value||'')+'">'
    + R.icon('calendar')
    + '<span class="dp-field-tx">'+esc(R.dpFmt(o.value, mode))+'</span>'
    + R.icon('chevron')
    + '</button>';
};
R.dpPopHtml = function(dp){
  var y = dp.view.y, m = dp.view.m;
  var first = new Date(y,m,1);
  var off = (first.getDay()+6)%7;
  var start = new Date(y,m,1-off);
  var now = new Date();
  var sel = R.dpDate(dp.sel);
  var selToday = !!(sel && DT.sameDay(sel, now));
  var isDateTime = dp.mode !== 'date';
  var cells = '';
  for(var i=0;i<42;i++){
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
    var cls = 'dp-day' + (d.getMonth()!==m ? ' out' : '');
    if(DT.sameDay(d,now)) cls += ' today';
    if(sel && DT.sameDay(d,sel)) cls += ' sel';
    var past = isDateTime && DT.dayStart(d).getTime() < DT.dayStart(now).getTime();
    if(past) cls += ' past';
    var iso = d.getFullYear()+'-'+DT.pad2(d.getMonth()+1)+'-'+DT.pad2(d.getDate());
    cells += '<button type="button" class="'+cls+'" data-act="dp-day" data-d="'+iso+'"'+(past?' disabled aria-disabled="true"':'')+'>'+d.getDate()+'</button>';
  }
  var ns = DT.nextSlot(new Date());
  var hh = sel ? DT.pad2(sel.getHours()) : DT.pad2(ns.getHours());
  var mi = sel ? DT.pad2(sel.getMinutes()) : DT.pad2(ns.getMinutes());
  var time = '';
  if(dp.mode!=='date'){
    var hourList = '', minList = '';
    var selH = parseInt(hh,10);
    for(var h=0; h<24; h++){
      var hv = DT.pad2(h);
      var hPast = selToday && h < now.getHours();
      hourList += '<button type="button" class="dp-tl-item'+(hPast?' past':'')+(selH===h?' on':'')+'" data-act="dp-list-h" data-v="'+hv+'"'+(hPast?' disabled aria-disabled="true"':'')+'>'+hv+'</button>';
    }
    var minutePastBase = selToday && (selH < now.getHours());
    for(var q=0; q<60; q++){
      var qv = DT.pad2(q);
      var qPast = minutePastBase || (selToday && selH===now.getHours() && q < now.getMinutes());
      minList += '<button type="button" class="dp-tl-item'+(qPast?' past':'')+(parseInt(mi,10)===q?' on':'')+'" data-act="dp-list-m" data-v="'+qv+'"'+(qPast?' disabled aria-disabled="true"':'')+'>'+qv+'</button>';
    }
    var timeList = dp.timeList
      ? '<div class="dp-timelist">'
          + '<div class="dp-tl-col"><div class="dp-tl-hd">小时</div><div class="dp-tl-scroll" id="dpHourList">'+hourList+'</div></div>'
          + '<div class="dp-tl-col"><div class="dp-tl-hd">分钟</div><div class="dp-tl-scroll" id="dpMinList">'+minList+'</div></div>'
        + '</div>'
      : '';
    time = '<div class="dp-time">'
      + '<span class="dp-time-lb">时间</span>'
      + '<input class="dp-tinp" id="dpHour" type="text" inputmode="numeric" maxlength="2" value="'+hh+'" aria-label="小时">'
      + '<span class="dp-colon">:</span>'
      + '<input class="dp-tinp" id="dpMin" type="text" inputmode="numeric" maxlength="2" value="'+mi+'" aria-label="分钟">'
      + '<button type="button" class="dp-time-pick'+(dp.timeList?' on':'')+'" data-act="dp-timelist" title="选择时间" aria-label="选择时间" aria-expanded="'+(dp.timeList?'true':'false')+'">'+R.icon('chevron')+'</button>'
      + '<div class="dp-quickrow">'
      + DT.quickTimes(dp.sel, 2).map(function(t){ return '<button type="button" class="dp-q" data-act="dp-quick" data-t="'+t+'">'+t+'</button>'; }).join('')
      + '</div>'
      + '</div>'
      + timeList;
  }
  return '<div class="dp-head">'
    + '<button type="button" class="dp-nav prev" data-act="dp-prev" aria-label="上个月">'+R.icon('chevron')+'</button>'
    + '<div class="dp-title">'+y+'年'+(m+1)+'月</div>'
    + '<button type="button" class="dp-nav next" data-act="dp-next" aria-label="下个月">'+R.icon('chevron')+'</button>'
    + '</div>'
    + '<div class="dp-week">'+['一','二','三','四','五','六','日'].map(function(w){ return '<span>'+w+'</span>'; }).join('')+'</div>'
    + '<div class="dp-grid">'+cells+'</div>'
    + time
    + '<div class="dp-foot"><button type="button" class="ghost-btn" data-act="dp-clear">清除</button>'
    + '<span class="spacer"></span>'
    + '<button type="button" class="ghost-btn" data-act="dp-cancel">取消</button>'
    + '<button type="button" class="btn-sm" data-act="dp-ok">确定</button></div>';
};

/* ---------- 编辑面板 ---------- */
R.editorModal = function(ed){
  var d = ed.draft;
  var title = ed.isNew ? '新建任务' : '编辑任务';
  var prios = [['high','高'],['med','中'],['low','低'],['none','无']];
  var html = '<div class="modal wide" role="dialog" aria-modal="true" aria-label="'+title+'">'
    + '<div class="modal-head"><div class="modal-title">'+title+'</div>'
    + '<button type="button" class="modal-x" data-act="close-modal" aria-label="关闭">'+R.icon('x')+'</button></div>'
    + '<div class="modal-body" id="editorBody">';

  html += '<div class="form-field"><div class="field-label">标题</div>'
    + '<input class="text-input" id="edTitle" type="text" placeholder="要做什么？" value="'+esc(d.title)+'"></div>';
  html += '<div class="form-field"><div class="field-label">备注 <span class="opt">可选</span></div>'
    + '<textarea class="text-input" id="edNote" placeholder="补充说明、验收标准…">'+esc(d.note)+'</textarea></div>';

  html += '<div class="form-field"><div class="field-label">项目</div><div class="chip-row">'
    + '<button type="button" class="pick-chip'+(d.projectId?'':' on')+'" data-act="ed-project" data-id="">无项目</button>';
  DT.state.projects.forEach(function(p){
    html += '<button type="button" class="pick-chip'+(d.projectId===p.id?' on':'')+'" data-act="ed-project" data-id="'+p.id+'">'
      + '<span style="width:6px;height:6px;border-radius:50%;background:'+p.color+';display:inline-block"></span>'+esc(p.name)+'</button>';
  });
  html += (ed.addingProject
    ? '<input class="mini-input" id="edNewProject" placeholder="新项目名" autocomplete="off"><button type="button" class="pick-chip add" data-act="ed-save-project">创建</button>'
    : '<button type="button" class="pick-chip add" data-act="ed-add-project">+ 新建</button>');
  html += '</div></div>';

  html += '<div class="form-field"><div class="field-label">标签 <span class="opt">可多选</span></div><div class="chip-row">';
  DT.state.tags.forEach(function(tg){
    var on = (d.tagIds||[]).indexOf(tg.id)>=0;
    html += '<button type="button" class="pick-chip'+(on?' on':'')+'" data-act="ed-tag" data-id="'+tg.id+'">'+esc(tg.name)+'</button>';
  });
  html += (ed.addingTag
    ? '<input class="mini-input" id="edNewTag" placeholder="新标签" autocomplete="off"><button type="button" class="pick-chip add" data-act="ed-save-tag">创建</button>'
    : '<button type="button" class="pick-chip add" data-act="ed-add-tag">+ 新建</button>');
  html += '</div></div>';

  html += '<div class="form-field"><div class="field-label">优先级</div><div class="chip-row">';
  prios.forEach(function(p){
    html += '<button type="button" class="pick-chip'+(d.priority===p[0]?' on':'')+'" data-act="ed-priority" data-v="'+p[0]+'">'+p[1]+'</button>';
  });
  html += '</div></div>';

  html += '<div class="form-field"><div class="field-label">日期与时间 <span class="opt">可选</span></div>'
    + '<div class="date-chips">'
    + '<button type="button" class="pick-chip'+(d.due&&DT.sameDay(d.due,new Date())?' on':'')+'" data-act="ed-due" data-v="today">今天</button>'
    + '<button type="button" class="pick-chip'+(d.due&&DT.sameDay(d.due,DT.addDays(new Date(),1))?' on':'')+'" data-act="ed-due" data-v="tomorrow">明天</button>'
    + '<button type="button" class="pick-chip'+(d.due?'':' on')+'" data-act="ed-due" data-v="none">无日期</button>'
    + R.dpField({scope:'editor', mode:'datetime', value:d.due||''})
    + '</div></div>';

  html += '<div class="form-field"><div class="field-label">链接 <span class="opt">网页 / 文件夹 / UNC / 文件</span></div>';
  html += '<div class="link-list">';
  (d.links||[]).forEach(function(lk,i){
    html += '<div class="link-row"><div class="lr-ic">'+R.icon(LINK_ICON[lk.type]||'link')+'</div>'
      + '<div class="lr-main"><div class="lr-name">'+esc(lk.name||lk.path)+'</div><div class="lr-path">'+esc(lk.path)+'</div></div>'
      + '<button type="button" class="lr-btn" data-act="ed-preview-link" data-i="'+i+'" title="查看打开方式">'+R.icon('arrow-up')+'</button>'
      + '<button type="button" class="lr-btn danger" data-act="ed-remove-link" data-i="'+i+'" title="移除链接">'+R.icon('trash')+'</button></div>';
  });
  if(!(d.links||[]).length) html += '<div class="m-empty" style="padding:12px 0 6px">还没有链接</div>';
  html += '</div>';
  html += '<div class="add-link-row"><input class="text-input" id="edLinkInput" type="text" placeholder="粘贴网址 / 文件夹路径 / UNC 共享路径" autocomplete="off">'
    + '<button type="button" class="btn-sm" data-act="ed-add-link">添加</button></div>';
  html += '<div class="dropzone" id="edDrop">'+R.icon('folder')+'<div>把文件 / 文件夹拖到这里，或粘贴路径</div><div style="font-size:10px;color:var(--faint)">拖入后自动识别为文件、文件夹或网址</div></div>';
  html += '<div class="help-block"><p class="note">链接保存为绝对路径；网页用默认浏览器打开，文件夹用资源管理器打开；UNC 共享盘不可达时会提示。</p></div>';
  html += '</div></div>';

  html += '<div class="modal-foot">';
  if(!ed.isNew){
    if(ed.deleteConfirm){
      html += '<div class="confirm-row">删除后可以撤销。<span class="spacer"></span>'
        + '<button type="button" class="btn-ghost" data-act="ed-delete-cancel">取消</button>'
        + '<button type="button" class="btn-danger" data-act="ed-delete-confirm">删除</button></div>';
    } else {
      html += '<button type="button" class="danger-text" data-act="ed-delete">'+R.icon('trash')+'删除任务</button>';
    }
  }
  html += '<span class="spacer"></span><button type="button" class="btn-ghost" data-act="close-modal">取消</button>'
    + '<button type="button" class="btn-pri" data-act="ed-save">保存</button></div></div>';
  return html;
};

/* ---------- 项目 / 标签管理 ---------- */
R.manageModal = function(mg){
  mg = mg || {};
  var c = DT.navCounts();
  function rowIcon(kind,item){
    return kind==='project'
      ? '<span class="mg-dot" style="--dot:'+item.color+'"></span>'
      : '<span class="mg-tagic">'+R.icon('tag')+'</span>';
  }
  function rows(kind,list,countMap){
    if(!list.length) return '<div class="mg-empty">还没有'+(kind==='project'?'项目':'标签')+'</div>';
    return list.map(function(item){
      var count = countMap[item.id]||0;
      var renaming = mg.rename && mg.rename.kind===kind && mg.rename.id===item.id;
      if(renaming){
        return '<div class="mg-row editing">'+rowIcon(kind,item)
          + '<input class="mg-input" id="mgRenameInput" type="text" maxlength="40" value="'+esc(item.name)+'" autocomplete="off" aria-label="重命名'+esc(item.name)+'">'
          + '<button type="button" class="mg-btn pri" data-act="mg-rename-save">保存</button>'
          + '<button type="button" class="mg-btn" data-act="mg-rename-cancel">取消</button></div>';
      }
      return '<div class="mg-row">'+rowIcon(kind,item)
        + '<span class="mg-name">'+esc(item.name)+'</span>'
        + '<span class="mg-count">'+(count?count+' 项待办':'暂无待办')+'</span>'
        + '<button type="button" class="mg-act" data-act="mg-rename" data-kind="'+kind+'" data-id="'+item.id+'" title="重命名" aria-label="重命名 '+esc(item.name)+'">'+R.icon('pencil')+'</button>'
        + '<button type="button" class="mg-act danger" data-act="mg-delete" data-kind="'+kind+'" data-id="'+item.id+'" title="删除" aria-label="删除 '+esc(item.name)+'">'+R.icon('trash')+'</button>'
        + '</div>';
    }).join('');
  }
  function addArea(kind,label,placeholder){
    if(mg.adding===kind){
      return '<div class="mg-row editing">'
        + (kind==='project'
          ? '<span class="mg-dot" style="--dot:#D8CFBC"></span>'
          : '<span class="mg-tagic">'+R.icon('tag')+'</span>')
        + '<input class="mg-input" id="'+(kind==='project'?'mgNewProject':'mgNewTag')+'" type="text" maxlength="40" placeholder="'+placeholder+'" autocomplete="off" aria-label="新建'+label+'">'
        + '<button type="button" class="mg-btn pri" data-act="mg-create" data-kind="'+kind+'">创建</button>'
        + '<button type="button" class="mg-btn" data-act="mg-add-cancel">取消</button></div>';
    }
    return '<button type="button" class="mg-add" data-act="mg-add" data-kind="'+kind+'">'+R.icon('plus')+'新建'+label+'</button>';
  }
  var scope = mg.scope || null;
  var isProject = !scope || scope==='project';
  var isTag = !scope || scope==='tag';
  var title = scope==='project' ? '管理项目' : (scope==='tag' ? '管理标签' : '管理项目与标签');
  var subtitle = scope==='project' ? '重命名、删除或新建项目' : (scope==='tag' ? '重命名、删除或新建标签' : '重命名、删除或新建');
  var help = scope==='project'
    ? '删除项目时任务不会被删除，只会移出该项目。删除后可以在底部提示里撤销。'
    : (scope==='tag'
      ? '删除标签时任务保留，只去掉这个标签。删除后可以在底部提示里撤销。'
      : '删除项目时任务不会被删除，只会移出该项目；删除标签时任务保留，只去掉这个标签。删除后都可以在底部提示里撤销。');
  var body = '';
  if(isProject){
    body += '<div class="mg-sec"><div class="mg-sec-h"><span>项目</span><span class="mg-sec-n">'+DT.state.projects.length+' 个</span></div>'
      + '<div class="mg-list">'+rows('project',DT.state.projects,c.projects)+'</div>'
      + addArea('project','项目','项目名称')+'</div>';
  }
  if(isTag){
    body += '<div class="mg-sec"><div class="mg-sec-h"><span>标签</span><span class="mg-sec-n">'+DT.state.tags.length+' 个</span></div>'
      + '<div class="mg-list">'+rows('tag',DT.state.tags,c.tags)+'</div>'
      + addArea('tag','标签','标签名称')+'</div>';
  }
  var html = '<div class="modal manage-modal'+(scope?' manage-scoped':'')+'" role="dialog" aria-modal="true" aria-label="'+title+'">'
    + '<div class="modal-head"><div class="modal-title">'+title+'</div><div class="modal-sub">'+subtitle+'</div>'
    + '<button type="button" class="modal-x" data-act="close-modal" aria-label="关闭">'+R.icon('x')+'</button></div>'
    + '<div class="modal-body">'+body
    + '<div class="mg-help">'+help+'</div>'
    + '</div>'
    + '<div class="modal-foot"><span class="spacer"></span><button type="button" class="btn-pri" data-act="close-modal">完成</button></div></div>';
  return html;
};

/* ---------- 删除二次确认（有关联数据时） ---------- */
R.deleteConfirmModal = function(del){
  if(!del) return '';
  var isProject = del.kind==='project';
  var label = isProject ? '项目' : '标签';
  var list = isProject ? DT.state.projects : DT.state.tags;
  var item = list.filter(function(x){ return x.id===del.id; })[0];
  if(!item) return '';
  var impact = del.impact || {total:0, pending:0};
  var done = Math.max(0, impact.total - impact.pending);
  var tail = isProject
    ? '删除项目不会删除任务，任务会变成「无项目」；'
    : '删除标签不会删除任务，只会去掉这个标签；';
  return '<div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label="确认删除">'
    + '<div class="modal-head"><div class="modal-title">删除'+label+'「'+esc(item.name)+'」？</div>'
    + '<button type="button" class="modal-x" data-act="del-confirm-cancel" aria-label="取消">'+R.icon('x')+'</button></div>'
    + '<div class="modal-body"><div class="cf-warn">'
    + '<span class="cf-warn-ic">'+R.icon('trash')+'</span>'
    + '<div class="cf-warn-tx"><p>该'+label+'下还有 <b>'+impact.total+'</b> 项任务（待办 '+impact.pending+' · 已完成 '+done+'）。</p>'
    + '<p class="cf-sub">'+tail+'删除后可在底部提示里撤销。</p></div>'
    + '</div></div>'
    + '<div class="modal-foot"><span class="spacer"></span>'
    + '<button type="button" class="btn-ghost" data-act="del-confirm-cancel">取消</button>'
    + '<button type="button" class="btn-danger" data-act="del-confirm-ok">删除'+label+'</button>'
    + '</div></div>';
};

/* ---------- 弹层通用 ---------- */
R.overlayOpen = function(html){
  var ov = document.getElementById('overlay');
  ov.innerHTML = html;
  ov.hidden = false;
  var modal = ov.querySelector('.modal');
  if(modal){
    modal.classList.add('enter');
    var done = function(e){
      if(e && e.animationName && e.animationName!=='modalIn') return;
      modal.classList.remove('enter');
      modal.removeEventListener('animationend', done);
    };
    modal.addEventListener('animationend', done);
    setTimeout(done, 380);
  }
  var focusEl = ov.querySelector('input,textarea,button');
  if(focusEl) setTimeout(function(){ try{ focusEl.focus(); }catch(e){} }, 30);
};
R.overlayUpdate = function(html){
  var ov = document.getElementById('overlay');
  if(!ov || ov.hidden) return;
  var body = ov.querySelector('.modal-body');
  var top = body ? body.scrollTop : 0;
  ov.innerHTML = html;
  var next = ov.querySelector('.modal-body');
  if(next && top) next.scrollTop = top;
};
R.overlayClose = function(){
  var ov = document.getElementById('overlay');
  ov.hidden = true;
  ov.innerHTML = '';
};
R.isOverlayOpen = function(){ return !document.getElementById('overlay').hidden; };

R.draft = {
  main:{text:'', due:null, projectIds:[], tagIds:[], priority:null, links:[]},
  widget:{text:'', due:null, projectIds:[], tagIds:[], priority:null, links:[]}
};
})();
