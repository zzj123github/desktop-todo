/* =========================================================
   window-controls.js · 提案 v1.6：窗口按钮的原型模拟
   ---------------------------------------------------------
   浏览器里没有真正的窗口，这里只模拟「能感觉到的结果」：
   - 最小化：窗口缩向任务栏后隐藏，任务栏出现应用按钮可点回
   - 最大化 / 还原：窗口铺满工作区（圆角与投影收起），图标切换
   - 关闭：沿用原有 close-window（回到桌面形态）
   - 平台切换：体验条的 Windows / macOS 分段控件，只换按钮样式与位置
   真实实现映射见 design/PROPOSAL-v1.6.md「落地映射」。
   ========================================================= */
(function () {
  'use strict';

  var PLATFORM_KEY = 'desktopTodo.proto.platform';
  var mgr, scene, tbApp, wcMac;
  var minimized = false;

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    if (typeof window.__protoToast === 'function') window.__protoToast(msg);
  }

  function readPlatform() {
    try {
      var saved = localStorage.getItem(PLATFORM_KEY);
      if (saved === 'win' || saved === 'mac') return saved;
    } catch (e) {}
    return 'win';
  }

  function isMac() { return !!mgr && mgr.getAttribute('data-platform') === 'mac'; }

  function setPlatform(p) {
    if (!mgr) return;
    mgr.setAttribute('data-platform', p);
    var segs = document.querySelectorAll('.db-seg-btn[data-plat]');
    for (var i = 0; i < segs.length; i++) {
      var on = segs[i].getAttribute('data-plat') === p;
      segs[i].classList.toggle('on', on);
      segs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    try { localStorage.setItem(PLATFORM_KEY, p); } catch (e) {}
    syncMaxLabel();
  }

  /* ---------- 最大化 / 还原 ---------- */
  function isMaxed() { return !!scene && scene.classList.contains('wc-maxed'); }

  function syncMaxLabel() {
    if (!mgr) return;
    var maxed = isMaxed();
    var buttons = mgr.querySelectorAll('[data-act="win-max"]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var label = b.classList.contains('wcb')
        ? (maxed ? '还原' : '最大化')
        : (maxed ? '退出全屏' : '全屏（⌥ 单击缩放）');
      b.title = label;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', maxed ? 'true' : 'false');
    }
  }

  function toggleMax() {
    if (!scene || !mgr) return;
    scene.classList.toggle('wc-maxed');
    mgr.classList.add('wc-no-anim');
    syncMaxLabel();
  }

  /* ---------- 最小化 / 还原 ---------- */
  function simMinimize() {
    if (!mgr || minimized) return;
    minimized = true;
    mgr.classList.remove('wc-restoring');
    mgr.classList.add('wc-minimizing');
    window.setTimeout(function () {
      if (!minimized) return;
      mgr.classList.remove('wc-minimizing');
      if (scene) scene.hidden = true;
      if (tbApp) tbApp.hidden = false;
      toast(isMac() ? '已最小化到程序坞（原型模拟）' : '已最小化到任务栏（原型模拟）');
    }, 220);
  }

  function simRestore() {
    if (!minimized) return;
    minimized = false;
    if (tbApp) tbApp.hidden = true;
    if (scene) scene.hidden = false;
    if (mgr) {
      mgr.classList.remove('wc-minimizing');
      mgr.classList.add('wc-restoring');
      window.setTimeout(function () { mgr.classList.remove('wc-restoring'); }, 260);
    }
  }

  /* ---------- 事件 ---------- */
  function onDocClick(e) {
    var seg = e.target.closest && e.target.closest('.db-seg-btn[data-plat]');
    if (seg) { setPlatform(seg.getAttribute('data-plat')); return; }

    var t = e.target.closest && e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'win-min') { e.preventDefault(); simMinimize(); }
    else if (act === 'win-max') { e.preventDefault(); toggleMax(); }
    else if (act === 'restore-manager') { e.preventDefault(); simRestore(); }
  }

  /* 双击标题区空白处最大化 / 还原（Windows 惯例）；按钮上不触发 */
  function onDblClick(e) {
    if (minimized || !scene || scene.hidden) return;
    if (!e.target.closest || !e.target.closest('.mhead-l')) return;
    toggleMax();
  }

  /* 失焦模拟：点在窗口外时红绿灯变灰（macOS 系统行为） */
  function onDocPointerDown(e) {
    if (!wcMac || !isMac()) return;
    wcMac.classList.toggle('is-blur', !(mgr && mgr.contains(e.target)));
  }

  function init() {
    mgr = $('mgr');
    scene = $('managerScene');
    tbApp = $('tbApp');
    wcMac = mgr ? mgr.querySelector('.wc-mac') : null;
    setPlatform(readPlatform());

    document.addEventListener('click', onDocClick, true);
    document.addEventListener('dblclick', onDblClick);
    document.addEventListener('pointerdown', onDocPointerDown, true);

    /* 形态切换或重渲染把完整窗口重新打开时，清掉最小化痕迹 */
    if (scene && window.MutationObserver) {
      new MutationObserver(function () {
        if (!scene.hidden && minimized) {
          minimized = false;
          if (tbApp) tbApp.hidden = true;
        }
      }).observe(scene, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
