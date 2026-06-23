/*!
 * Moesora 视频播放器（B 站风格）
 * 接管文章正文里的 <video>，套上自定义控制条。
 * 支持：本地视频 / 外链 mp4 等常用格式（浏览器原生）+ m3u8(HLS，按需加载本地 hls.js)。
 * 给 <video> 加 data-no-player 可跳过美化。
 */
(function () {
  "use strict";
  if (window.MoesoraVideo) return;
  var SELF = document.currentScript; // 用于推导本地 hls.js 路径，最可靠

  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  function pad(n) { n = Math.floor(n); return (n < 10 ? "0" : "") + n; }
  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
    return h > 0 ? (h + ":" + pad(m) + ":" + pad(s)) : (pad(m) + ":" + pad(s));
  }

  // 推导主题资源根（/.../assets）：优先用本脚本自身地址，其次扫描其它脚本
  function assetsBase() {
    var src = (SELF && SELF.src) || "";
    var m = src.match(/^(.*\/assets)\//);
    if (m) return m[1];
    var ss = document.querySelectorAll("script[src]");
    for (var i = 0; i < ss.length; i++) {
      m = ss[i].src.match(/^(.*\/assets)\//);
      if (m) return m[1];
    }
    return "";
  }

  // 按需加载 hls.js（只加载一次）
  var hlsQueue = null;
  function loadHls(cb) {
    if (window.Hls) { cb(window.Hls); return; }
    if (hlsQueue) { hlsQueue.push(cb); return; }
    hlsQueue = [cb];
    var base = assetsBase();
    var s = document.createElement("script");
    s.src = (base || "") + "/lib/hls.min.js";
    s.async = true;
    s.onload = function () { var q = hlsQueue; hlsQueue = null; q.forEach(function (f) { f(window.Hls || null); }); };
    s.onerror = function () { var q = hlsQueue; hlsQueue = null; q.forEach(function (f) { f(null); }); };
    document.head.appendChild(s);
  }

  function srcOf(video) {
    if (video.getAttribute("src")) return video.getAttribute("src");
    var so = video.querySelector("source");
    return so ? so.getAttribute("src") : "";
  }
  function isHls(video, url) {
    if (/\.m3u8(\?|#|$)/i.test(url || "")) return true;
    var so = video.querySelector && video.querySelector("source[type]");
    if (so && /mpegurl/i.test(so.getAttribute("type") || "")) return true;
    if (video.getAttribute && /mpegurl/i.test(video.getAttribute("type") || "")) return true;
    return false;
  }

  var ICON = {
    play: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.5-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    volume: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    muted: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    full: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M16 21h3a2 2 0 0 0 2-2v-3M8 21H5a2 2 0 0 1-2-2v-3"/></svg>',
    exitFull: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
    bigplay: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.5-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z"/></svg>',
    pip: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><rect x="11" y="11" width="8" height="6" rx="1" fill="currentColor" stroke="none"/></svg>'
  };

  function build(video) {
    var doc = document;
    var wrap = doc.createElement("div");
    wrap.className = "moe-vp";
    wrap.tabIndex = 0;
    video.parentNode.insertBefore(wrap, video);
    wrap.appendChild(video);
    video.classList.add("moe-vp-video");
    video.removeAttribute("controls");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    if (video.preload !== "none") video.preload = "auto";
    // 封面图：data-poster 优先映射到原生 poster（移动端点播放前也能看到这张图）
    if (video.dataset.poster && !video.getAttribute("poster")) video.poster = video.dataset.poster;

    wrap.insertAdjacentHTML("beforeend",
      '<div class="moe-vp-loading" data-r="loading"><span></span></div>' +
      '<div class="moe-vp-err" data-r="err" hidden></div>' +
      '<button type="button" class="moe-vp-big" data-r="big" aria-label="播放">' + ICON.bigplay + '</button>' +
      '<div class="moe-vp-ctrl" data-r="ctrl">' +
        '<div class="moe-vp-prog" data-r="prog"><div class="moe-vp-buf" data-r="buf"></div><div class="moe-vp-played" data-r="played"></div><i class="moe-vp-dot" data-r="dot"></i></div>' +
        '<div class="moe-vp-row">' +
          '<button type="button" class="moe-vp-btn" data-r="play" aria-label="播放/暂停">' + ICON.play + '</button>' +
          '<span class="moe-vp-time"><b data-r="cur">0:00</b> / <span data-r="dur">0:00</span></span>' +
          '<span class="moe-vp-sp"></span>' +
          '<div class="moe-vp-vol"><button type="button" class="moe-vp-btn" data-r="mute" aria-label="静音">' + ICON.volume + '</button><span class="moe-vp-volbar" data-r="volbar"><i class="moe-vp-volfill" data-r="volfill"></i></span></div>' +
          '<div class="moe-vp-speed"><button type="button" class="moe-vp-btn moe-vp-spbtn" data-r="spbtn">1.0x</button><div class="moe-vp-spmenu" data-r="spmenu" hidden></div></div>' +
          '<button type="button" class="moe-vp-btn moe-vp-pip" data-r="pip" aria-label="画中画" hidden>' + ICON.pip + '</button>' +
          '<button type="button" class="moe-vp-btn" data-r="fs" aria-label="全屏">' + ICON.full + '</button>' +
        '</div>' +
      '</div>'
    );

    var $ = function (r) { return wrap.querySelector('[data-r="' + r + '"]'); };
    var els = {
      loading: $("loading"), err: $("err"), big: $("big"), ctrl: $("ctrl"), prog: $("prog"), buf: $("buf"),
      played: $("played"), dot: $("dot"), play: $("play"), cur: $("cur"), dur: $("dur"),
      mute: $("mute"), volbar: $("volbar"), volfill: $("volfill"),
      spbtn: $("spbtn"), spmenu: $("spmenu"), fs: $("fs"), pip: $("pip")
    };

    SPEEDS.forEach(function (sp) {
      var b = doc.createElement("button");
      b.type = "button"; b.className = "moe-vp-spitem"; b.textContent = sp + "x"; b.dataset.sp = sp;
      if (sp === 1) b.classList.add("on");
      els.spmenu.appendChild(b);
    });

    function showLoad(b) { if (els.err.hidden) els.loading.style.display = b ? "" : "none"; }
    function showError(msg) {
      els.err.textContent = msg; els.err.hidden = false;
      els.loading.style.display = "none";
      els.big.style.display = "none";
    }
    showLoad(false);

    var posterDone = false, posterSeeking = false;
    function isPlaying() { return !video.paused && !video.ended; }
    function syncPlayIcon() {
      els.play.innerHTML = isPlaying() ? ICON.pause : ICON.play;
      wrap.classList.toggle("playing", isPlaying());
      if (els.err.hidden) els.big.style.display = isPlaying() ? "none" : "";
    }
    function toggle() { posterDone = true; if (video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } else video.pause(); }

    els.big.addEventListener("click", toggle);
    els.play.addEventListener("click", toggle);
    video.addEventListener("click", function (e) { e.preventDefault(); toggle(); });
    video.addEventListener("dblclick", function (e) { e.preventDefault(); toggleFs(); });
    video.addEventListener("play", syncPlayIcon);
    video.addEventListener("pause", syncPlayIcon);
    video.addEventListener("ended", syncPlayIcon);

    function updTime() {
      els.cur.textContent = fmt(video.currentTime);
      var d = video.duration;
      if (isFinite(d) && d > 0) {
        els.played.style.width = (video.currentTime / d * 100) + "%";
        els.dot.style.left = (video.currentTime / d * 100) + "%";
      }
    }
    function updDur() { els.dur.textContent = fmt(video.duration); }
    function updBuf() {
      try {
        var d = video.duration;
        if (video.buffered.length && isFinite(d) && d > 0) {
          els.buf.style.width = (video.buffered.end(video.buffered.length - 1) / d * 100) + "%";
        }
      } catch (e) {}
    }
    video.addEventListener("timeupdate", updTime);
    video.addEventListener("durationchange", updDur);
    video.addEventListener("loadeddata", function () { if (video.readyState >= 2) posterDone = true; });
    video.addEventListener("loadedmetadata", function () {
      updDur(); updTime();
      // 首帧：preload=auto 时浏览器通常自动画首帧；对加载慢的外链，若 0.5s 后仍无画面，轻推一次
      setTimeout(function () {
        if (posterDone || !video.paused || video.currentTime > 0 || video.readyState >= 2) return;
        posterSeeking = true;
        try { video.currentTime = 0.05; } catch (e) { posterSeeking = false; }
      }, 500);
    });
    video.addEventListener("progress", updBuf);

    video.addEventListener("waiting", function () { showLoad(true); });
    video.addEventListener("playing", function () { showLoad(false); });
    video.addEventListener("canplay", function () { showLoad(false); });
    video.addEventListener("seeking", function () { if (!posterSeeking) showLoad(true); });
    video.addEventListener("seeked", function () { showLoad(false); posterSeeking = false; posterDone = true; });

    function seekAt(clientX) {
      var r = els.prog.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      if (isFinite(video.duration)) { video.currentTime = p * video.duration; updTime(); }
    }
    var seeking = false;
    els.prog.addEventListener("mousedown", function (e) { seeking = true; seekAt(e.clientX); e.preventDefault(); });
    doc.addEventListener("mousemove", function (e) { if (seeking) seekAt(e.clientX); });
    doc.addEventListener("mouseup", function () { seeking = false; });
    els.prog.addEventListener("touchstart", function (e) { seeking = true; seekAt(e.touches[0].clientX); }, { passive: true });
    els.prog.addEventListener("touchmove", function (e) { if (seeking) { seekAt(e.touches[0].clientX); } }, { passive: true });
    els.prog.addEventListener("touchend", function () { seeking = false; });

    function updVol() {
      var v = video.muted ? 0 : video.volume;
      els.volfill.style.width = (v * 100) + "%";
      els.mute.innerHTML = (v === 0) ? ICON.muted : ICON.volume;
    }
    els.mute.addEventListener("click", function () { video.muted = !video.muted; if (!video.muted && video.volume === 0) video.volume = 1; updVol(); });
    function volAt(clientX) {
      var r = els.volbar.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      video.volume = p; video.muted = (p === 0); updVol();
    }
    var volDrag = false;
    els.volbar.addEventListener("mousedown", function (e) { volDrag = true; volAt(e.clientX); e.preventDefault(); });
    doc.addEventListener("mousemove", function (e) { if (volDrag) volAt(e.clientX); });
    doc.addEventListener("mouseup", function () { volDrag = false; });
    video.addEventListener("volumechange", updVol);

    els.spbtn.addEventListener("click", function (e) { e.stopPropagation(); els.spmenu.hidden = !els.spmenu.hidden; });
    els.spmenu.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sp]"); if (!b) return;
      var sp = parseFloat(b.dataset.sp); video.playbackRate = sp;
      els.spbtn.textContent = sp + "x";
      els.spmenu.querySelectorAll(".moe-vp-spitem").forEach(function (it) { it.classList.toggle("on", it === b); });
      els.spmenu.hidden = true;
    });
    doc.addEventListener("click", function (e) { if (!els.spmenu.hidden && !e.target.closest(".moe-vp-speed")) els.spmenu.hidden = true; });

    function fsEl() { return doc.fullscreenElement || doc.webkitFullscreenElement; }
    function toggleFs() {
      if (fsEl()) {
        (doc.exitFullscreen || doc.webkitExitFullscreen || function () {}).call(doc);
      } else if (wrap.requestFullscreen || wrap.webkitRequestFullscreen) {
        (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    }
    els.fs.addEventListener("click", toggleFs);
    function syncFs() { var on = fsEl() === wrap; wrap.classList.toggle("fs", on); els.fs.innerHTML = on ? ICON.exitFull : ICON.full; }
    doc.addEventListener("fullscreenchange", syncFs);
    doc.addEventListener("webkitfullscreenchange", syncFs);

    // 画中画
    if (doc.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function" && !video.disablePictureInPicture) {
      els.pip.hidden = false;
      els.pip.addEventListener("click", function () {
        try {
          if (doc.pictureInPictureElement) doc.exitPictureInPicture();
          else video.requestPictureInPicture();
        } catch (e) { console.error("[moe-video] 画中画失败：", e); }
      });
    }

    var hideTimer = null;
    function showCtrl() {
      wrap.classList.add("active");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { if (isPlaying()) wrap.classList.remove("active"); }, 2600);
    }
    wrap.addEventListener("mousemove", showCtrl);
    wrap.addEventListener("touchstart", showCtrl, { passive: true });
    wrap.addEventListener("mouseleave", function () { if (isPlaying()) wrap.classList.remove("active"); });
    video.addEventListener("play", showCtrl);
    video.addEventListener("pause", function () { wrap.classList.add("active"); clearTimeout(hideTimer); });

    wrap.addEventListener("keydown", function (e) {
      switch (e.key) {
        case " ": case "Spacebar": e.preventDefault(); toggle(); break;
        case "ArrowLeft": e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 5); break;
        case "ArrowRight": e.preventDefault(); video.currentTime = Math.min(video.duration || 1e9, video.currentTime + 5); break;
        case "ArrowUp": e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); video.muted = false; break;
        case "ArrowDown": e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
        case "f": case "F": e.preventDefault(); toggleFs(); break;
      }
    });

    syncPlayIcon(); updVol(); updDur(); updTime();
    return { showError: showError, showLoad: showLoad };
  }

  function setupSource(video, api) {
    var url = srcOf(video);
    if (!isHls(video, url)) return; // 普通格式：浏览器原生处理
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari/iOS 原生支持 HLS
      if (!video.getAttribute("src")) video.src = url;
      return;
    }
    // 其它浏览器（Chrome/Firefox 等）用 hls.js
    var so = video.querySelector("source");
    if (so && so.parentNode) so.remove();
    video.removeAttribute("src");
    api.showLoad(true);
    loadHls(function (Hls) {
      if (!Hls || !Hls.isSupported()) {
        api.showError("当前浏览器无法播放该 m3u8（hls.js 组件未能加载，请检查主题资源是否完整）。");
        return;
      }
      try {
        var hls = new Hls({ maxBufferLength: 30, enableWorker: true });
        video._moeHls = hls;
        var netRetries = 0;
        hls.on(Hls.Events.ERROR, function (evt, data) {
          if (!data || !data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (netRetries++ < 2) { try { hls.startLoad(); } catch (e) {} }
            else api.showError("视频加载失败：请确认 m3u8 地址可访问，且该服务器已开启跨域(CORS)。Chrome 控制台 Network 里能看到具体原因。");
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            try { hls.recoverMediaError(); } catch (e) { api.showError("视频解码失败。"); }
          } else {
            api.showError("视频播放失败。");
            try { hls.destroy(); } catch (e) {}
          }
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      } catch (e) {
        api.showError("视频初始化失败。");
        console.error("[moe-video] HLS 初始化失败：", e);
      }
    });
  }

  window.MoesoraVideo = function (container) {
    var root = container || document;
    var vids = root.querySelectorAll ? root.querySelectorAll("video") : [];
    Array.prototype.forEach.call(vids, function (video) {
      if (video.dataset.moeVp) return;
      if (video.hasAttribute("data-no-player") || video.closest(".moe-vp")) { video.dataset.moeVp = "skip"; return; }
      video.dataset.moeVp = "1";
      try {
        var api = build(video);
        setupSource(video, api);
      } catch (e) { console.error("[moe-video] 初始化失败：", e); }
    });
  };
})();
