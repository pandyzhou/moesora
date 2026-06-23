/*!
 * Moesora 看板娘（Live2D）
 * 运行库走 CDN（不打包进主题）；模型由用户在设置里填 URL。
 * 支持多角色切换、鼠标实时跟随、点击触发动作、对话气泡。
 */
(function () {
  "use strict";
  var CFG = window.MoesoraConfig || {};
  var L = CFG.live2d || {};
  if (!L.on) return;

  // 解析模型列表： 每行 "名称|模型json地址"
  var models = String(L.models || "").split(/\n+/).map(function (line) {
    var i = line.indexOf("|");
    if (i < 0) return null;
    var name = line.slice(0, i).trim(), url = line.slice(i + 1).trim();
    return (name && url) ? { name: name, url: url } : null;
  }).filter(Boolean);
  if (!models.length) return;

  var SCALE = parseFloat(L.scale) || 1;
  if (!(SCALE > 0)) SCALE = 1;
  var POS = L.position === "bottom-left" ? "left" : "right";
  var POSWORD = POS === "left" ? "左下角" : "右下角";
  // 基础逻辑画布；显示尺寸随 scale 放大，使模型放大时画布也一起变大、不被边界裁切。
  // 同时限制画布高度不超过视口的 72%，避免顶部顶出屏幕外被“切头”。
  var BASE_W = 240, BASE_H = 300;
  function calcSize() {
    var w = Math.round(BASE_W * SCALE), h = Math.round(BASE_H * SCALE);
    var maxH = Math.round((window.innerHeight || 800) * 0.72);
    if (h > maxH) { var k = maxH / h; h = maxH; w = Math.round(w * k); }
    return { w: w, h: h };
  }
  var _sz = calcSize();
  var W = _sz.w, H = _sz.h;
  // 高分屏清晰度：按设备像素比渲染
  var DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  // 本脚本自身所在目录（用于引用同目录下打包的 Cubism 核心库）
  var SELF = (function () {
    if (document.currentScript && document.currentScript.src) return document.currentScript.src;
    var t = document.querySelector('script[src*="moe-live2d"]');
    return t ? t.src : "";
  })();
  var LIB_BASE = SELF ? SELF.replace(/\/[^\/?#]*([?#].*)?$/, "") : "";

  var CDN = String(CFG.cdnBase || "https://gcore.jsdelivr.net").replace(/\/+$/, "");
  // 运行库全部随主题本地加载（避免 cubism.live2d.com / jsdelivr 在国内被墙导致加载失败）
  var LIBS = LIB_BASE ? [
    LIB_BASE + "/live2dcubismcore.min.js",   // Cubism 核心
    LIB_BASE + "/pixi.min.js",               // PIXI 6
    LIB_BASE + "/cubism4.min.js"             // pixi-live2d-display (Cubism3/4)
  ] : [                                       // 兜底：万一取不到自身路径才走 CDN
    "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
    CDN + "/npm/[email protected]/dist/browser/pixi.min.js",
    CDN + "/npm/[email protected]/dist/cubism4.min.js"
  ];

  var GREETINGS = [
    "欢迎来到这里～(*´∇｀*)", "今天也要元气满满哦！", "点点我会有反应的~",
    POSWORD + "的我一直在陪着你呢", "记得多喝水哦 (｡･ω･｡)", "喜欢这篇文章的话点个赞吧～"
  ];

  // 顺序加载；任一失败只记录、不中断，最后用全局对象判断是否就绪
  function loadSeq(list, done) {
    var i = 0, failed = [];
    (function next() {
      if (i >= list.length) { done(failed); return; }
      var url = list[i++];
      var s = document.createElement("script");
      s.src = url; s.async = false;
      s.onload = next;
      s.onerror = function () { console.error("[moe-live2d] 库加载失败：" + url); failed.push(url); next(); };
      document.head.appendChild(s);
    })();
  }

  var widget, canvas, bubbleEl, fab, app = null, model = null, cur = 0, bubbleTimer = null;

  function buildWidget() {
    widget = document.createElement("div");
    widget.className = "moe-l2d moe-l2d-" + POS;
    widget.id = "moe-l2d";
    widget.style.width = W + "px";
    widget.style.height = H + "px";
    widget.innerHTML =
      '<div class="moe-l2d-bubble" data-role="bubble" hidden></div>' +
      '<canvas class="moe-l2d-canvas"></canvas>' +
      '<div class="moe-l2d-tools">' +
        '<button type="button" data-role="switch" title="切换角色" aria-label="切换角色">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
        '</button>' +
        '<button type="button" data-role="hide" title="隐藏" aria-label="隐藏">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(widget);
    canvas = widget.querySelector(".moe-l2d-canvas");
    bubbleEl = widget.querySelector("[data-role=bubble]");

    // 隐藏后的小浮标
    fab = document.createElement("button");
    fab.type = "button";
    fab.className = "moe-l2d-fab moe-l2d-" + POS;
    fab.title = "召唤看板娘";
    fab.setAttribute("hidden", "");
    fab.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none" style="display:block">' +
      '<path d="M12 21s-7.2-4.6-9.6-9C1.1 9.2 2.3 5.8 5.5 5.1c1.9-.4 3.8.4 4.9 1.9L12 8.6l1.6-1.6c1.1-1.5 3-2.3 4.9-1.9 3.2.7 4.4 4.1 3.1 6.9-2.4 4.4-9.6 9-9.6 9z"/>' +
      '</svg>';
    document.body.appendChild(fab);

    widget.querySelector("[data-role=switch]").addEventListener("click", function () { switchModel(); });
    if (models.length < 2) widget.querySelector("[data-role=switch]").style.display = "none";
    widget.querySelector("[data-role=hide]").addEventListener("click", function () {
      widget.classList.add("moe-l2d-off"); fab.removeAttribute("hidden");
      try { localStorage.setItem("moe-l2d-hidden", "1"); } catch (e) {}
    });
    fab.addEventListener("click", function () {
      startLoad();
      widget.classList.remove("moe-l2d-off"); fab.setAttribute("hidden", "");
      try { localStorage.removeItem("moe-l2d-hidden"); } catch (e) {}
      say(rand(GREETINGS));
    });

    var hidden = false; try { hidden = localStorage.getItem("moe-l2d-hidden") === "1"; } catch (e) {}
    if (hidden) { widget.classList.add("moe-l2d-off"); fab.removeAttribute("hidden"); }

    // 接近底部时上浮避让页脚（与返回顶部/音乐控件一致）
    function liftOnScroll() {
      var y = window.pageYOffset;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var nearBottom = max > 0 && (max - y) < 150;
      fab.classList.toggle("near-bottom", nearBottom);
    }
    window.addEventListener("scroll", liftOnScroll, { passive: true });
    window.addEventListener("resize", liftOnScroll, { passive: true });
    liftOnScroll();
  }

  function rand(a) { return a[Math.floor(Math.random() * a.length)]; }
  function say(text, ms) {
    if (!bubbleEl) return;
    bubbleEl.textContent = text; bubbleEl.hidden = false;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubbleEl.hidden = true; }, ms || 4000);
  }

  function initPixi() {
    // 注册 Ticker / 交互（保险，避免某些环境未自动注册）
    try {
      var L2D = PIXI.live2d.Live2DModel;
      if (L2D && L2D.registerTicker && PIXI.Ticker) L2D.registerTicker(PIXI.Ticker);
      if (L2D && L2D.registerInteraction && PIXI.InteractionManager) L2D.registerInteraction(PIXI.InteractionManager);
    } catch (e) { console.warn("[moe-live2d] 注册 Ticker/交互失败（可忽略）：", e); }

    try {
      if (PIXI.settings) PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false; // 允许软件 WebGL
      app = new PIXI.Application({
        view: canvas,
        width: W, height: H,
        backgroundAlpha: 0,
        antialias: true,
        autoStart: true,
        resolution: DPR,      // 高分屏按设备像素比渲染 -> 清晰不模糊
        autoDensity: true     // 自动把 canvas 的 CSS 尺寸维持为 W×H
      });
    } catch (e) {
      console.error("[moe-live2d] 渲染器创建失败：浏览器 WebGL 不可用。", e);
      say("看板娘需要 WebGL：请在浏览器设置里开启“硬件加速”后重试（可访问 get.webgl.org 检测）", 10000);
      return;
    }

    // 鼠标全页跟随
    document.addEventListener("mousemove", function (e) {
      if (!model || widget.classList.contains("moe-l2d-off")) return;
      var r = canvas.getBoundingClientRect();
      try { model.focus(e.clientX - r.left, e.clientY - r.top); } catch (err) {}
    });
    // 点击看板娘 -> 随机表情 + 气泡
    canvas.addEventListener("click", function () {
      if (!model) return;
      try { model.expression(); } catch (err) {}
      say(rand(GREETINGS));
    });

    loadModel(cur, true);

    // 视口变化时，重新计算画布尺寸 + 重新适配模型（避免旋转/缩放后被切）
    var rT = null;
    window.addEventListener("resize", function () {
      clearTimeout(rT);
      rT = setTimeout(function () {
        var sz = calcSize();
        if (sz.w === W && sz.h === H) return;
        W = sz.w; H = sz.h;
        widget.style.width = W + "px";
        widget.style.height = H + "px";
        try { app.renderer.resize(W, H); } catch (e) {}
        placeModel();
      }, 200);
    }, { passive: true });
  }

  function loadModel(idx, greet) {
    var m = models[idx]; if (!m) return;
    say("加载中…(" + m.name + ")", 2000);
    var p;
    try {
      p = PIXI.live2d.Live2DModel.from(m.url, { autoInteract: true });
    } catch (e) {
      console.error("[moe-live2d] 创建模型失败：", e);
      say("创建模型失败：" + (e && e.message ? e.message : e), 8000);
      return;
    }
    p.then(function (mdl) {
      if (model) { app.stage.removeChild(model); try { model.destroy(); } catch (e) {} model = null; }
      model = mdl;
      app.stage.addChild(model);
      placeModel();
      // 点击触发表情 + 气泡（有 HitArea 的模型）
      model.on("hit", function () { try { model.expression(); } catch (e) {} say(rand(GREETINGS)); });
      if (greet) say(rand(GREETINGS));
    }).catch(function (err) {
      console.error("[moe-live2d] 模型加载失败：", m.url, err);
      say("模型加载失败：" + (err && err.message ? err.message : "请检查地址/CORS") , 8000);
    });
  }

  // 把模型完整放进画布：等比缩放使整体可见（头脚都在），偏向所在角落、底部贴合
  function placeModel() {
    if (!model) return;
    var mw = model.width, mh = model.height;
    if (!mw || !mh) return;
    // contain：取较小比例，保证模型整体（含头/脚）都在画布内，再留 4% 边距
    var fit = Math.min(W / mw, H / mh) * 0.96;
    model.scale.set(fit);
    var sw = mw * fit, sh = mh * fit;
    // pixi-live2d-display 的 model 默认锚点在左上角(0,0)；用绝对坐标定位最可靠，不依赖 anchor 支持与否
    // 水平方向偏向所在角落：右下角时靠右、左下角时靠左（在居中基础上推 38% 的剩余空间）
    var slack = W - sw;
    model.x = POS === "left" ? slack * 0.12 : slack * 0.88;
    model.y = H - sh + Math.round(H * 0.02); // 底部贴合，略微沉出底边让它更靠下
  }

  function switchModel() {
    if (models.length < 2) { say("只有一个角色哦~"); return; }
    cur = (cur + 1) % models.length;
    say("换成 " + models[cur].name + " 啦~");
    loadModel(cur, false);
  }

  var loadStarted = false;
  function startLoad() {
    if (loadStarted) return; loadStarted = true;
    loadSeq(LIBS, function (failed) {
      var ready = window.PIXI && PIXI.live2d && PIXI.live2d.Live2DModel;
      if (!ready) {
        console.error("[moe-live2d] 运行库未就绪，失败的库：", failed);
        say("看板娘运行库加载失败，请检查网络/CDN (>_<)", 6000);
        return;
      }
      try { initPixi(); } catch (e) { console.error("[moe-live2d] 初始化失败：", e); say("初始化失败：" + (e && e.message ? e.message : e), 9000); }
    });
  }

  function boot() {
    if (window.__moeL2dBooted) return; window.__moeL2dBooted = true;
    var isMobile = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) return; // 移动端默认不显示看板娘（含小圆按钮）
    buildWidget();
    startLoad();
  }

  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
