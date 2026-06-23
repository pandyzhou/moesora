/*!
 * Moesora 音频播放器
 * 接管文章正文里的 <audio>，套上主题风格的紧凑控制条。
 * 给 <audio> 加 data-no-player 可跳过美化；可用 data-title 指定标题。
 */
(function () {
  "use strict";
  if (window.MoesoraAudio) return;

  var SPEEDS = [0.75, 1, 1.25, 1.5, 2];

  function pad(n) { n = Math.floor(n); return (n < 10 ? "0" : "") + n; }
  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
    return h > 0 ? (h + ":" + pad(m) + ":" + pad(s)) : (m + ":" + pad(s));
  }
  function titleOf(audio) {
    var t = audio.getAttribute("data-title") || audio.getAttribute("title");
    if (t) return t;
    var src = audio.getAttribute("src") || "";
    if (!src) { var so = audio.querySelector("source"); src = so ? so.getAttribute("src") : ""; }
    try { src = decodeURIComponent(src.split("?")[0].split("#")[0]); } catch (e) {}
    var name = (src.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
    return name || "音频";
  }

  var ICON = {
    play: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.5-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    volume: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    muted: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    note: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M9 17.5a2.5 2.5 0 1 1-2.5-2.5c.55 0 1.06.18 1.5.46V6l9-2v8.5a2.5 2.5 0 1 1-2.5-2.5c.55 0 1.06.18 1.5.46V5.5L9 7v10.5z"/></svg>'
  };

  function build(audio) {
    var doc = document;
    var wrap = doc.createElement("div");
    wrap.className = "moe-ap";
    audio.parentNode.insertBefore(wrap, audio);
    wrap.appendChild(audio);
    audio.removeAttribute("controls");
    audio.style.display = "none";
    if (!audio.preload || audio.preload === "auto") audio.preload = "metadata";

    wrap.insertAdjacentHTML("beforeend",
      '<button type="button" class="moe-ap-play" data-r="play" aria-label="播放/暂停">' + ICON.play + '</button>' +
      '<div class="moe-ap-body">' +
        '<div class="moe-ap-title" data-r="title"><span class="moe-ap-note">' + ICON.note + '</span><span data-r="titletext"></span></div>' +
        '<div class="moe-ap-prog" data-r="prog"><div class="moe-ap-buf" data-r="buf"></div><div class="moe-ap-played" data-r="played"></div><i class="moe-ap-dot" data-r="dot"></i></div>' +
        '<div class="moe-ap-meta"><span data-r="cur">0:00</span><button type="button" class="moe-ap-speed" data-r="speed">1.0x</button><span data-r="dur">0:00</span></div>' +
      '</div>' +
      '<div class="moe-ap-vol"><button type="button" class="moe-ap-mute" data-r="mute" aria-label="静音">' + ICON.volume + '</button><span class="moe-ap-volbar" data-r="volbar"><i class="moe-ap-volfill" data-r="volfill"></i></span></div>'
    );

    var $ = function (r) { return wrap.querySelector('[data-r="' + r + '"]'); };
    var els = {
      play: $("play"), titletext: $("titletext"), prog: $("prog"), buf: $("buf"),
      played: $("played"), dot: $("dot"), cur: $("cur"), dur: $("dur"),
      speed: $("speed"), mute: $("mute"), volbar: $("volbar"), volfill: $("volfill")
    };
    els.titletext.textContent = titleOf(audio);

    function isPlaying() { return !audio.paused && !audio.ended; }
    function syncPlay() {
      els.play.innerHTML = isPlaying() ? ICON.pause : ICON.play;
      wrap.classList.toggle("playing", isPlaying());
    }
    function toggle() { if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } else audio.pause(); }
    els.play.addEventListener("click", toggle);
    audio.addEventListener("play", syncPlay);
    audio.addEventListener("pause", syncPlay);
    audio.addEventListener("ended", syncPlay);

    function updTime() {
      els.cur.textContent = fmt(audio.currentTime);
      var d = audio.duration;
      if (isFinite(d) && d > 0) {
        var p = audio.currentTime / d * 100;
        els.played.style.width = p + "%"; els.dot.style.left = p + "%";
      }
    }
    function updDur() { els.dur.textContent = fmt(audio.duration); }
    function updBuf() {
      try {
        var d = audio.duration;
        if (audio.buffered.length && isFinite(d) && d > 0)
          els.buf.style.width = (audio.buffered.end(audio.buffered.length - 1) / d * 100) + "%";
      } catch (e) {}
    }
    audio.addEventListener("timeupdate", updTime);
    audio.addEventListener("durationchange", updDur);
    audio.addEventListener("loadedmetadata", function () { updDur(); updTime(); });
    audio.addEventListener("progress", updBuf);

    function seekAt(clientX) {
      var r = els.prog.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      if (isFinite(audio.duration)) { audio.currentTime = p * audio.duration; updTime(); }
    }
    var seeking = false;
    els.prog.addEventListener("mousedown", function (e) { seeking = true; seekAt(e.clientX); e.preventDefault(); });
    doc.addEventListener("mousemove", function (e) { if (seeking) seekAt(e.clientX); });
    doc.addEventListener("mouseup", function () { seeking = false; });
    els.prog.addEventListener("touchstart", function (e) { seeking = true; seekAt(e.touches[0].clientX); }, { passive: true });
    els.prog.addEventListener("touchmove", function (e) { if (seeking) seekAt(e.touches[0].clientX); }, { passive: true });
    els.prog.addEventListener("touchend", function () { seeking = false; });

    function updVol() {
      var v = audio.muted ? 0 : audio.volume;
      els.volfill.style.width = (v * 100) + "%";
      els.mute.innerHTML = (v === 0) ? ICON.muted : ICON.volume;
    }
    els.mute.addEventListener("click", function () { audio.muted = !audio.muted; if (!audio.muted && audio.volume === 0) audio.volume = 1; updVol(); });
    function volAt(clientX) {
      var r = els.volbar.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      audio.volume = p; audio.muted = (p === 0); updVol();
    }
    var volDrag = false;
    els.volbar.addEventListener("mousedown", function (e) { volDrag = true; volAt(e.clientX); e.preventDefault(); });
    doc.addEventListener("mousemove", function (e) { if (volDrag) volAt(e.clientX); });
    doc.addEventListener("mouseup", function () { volDrag = false; });
    audio.addEventListener("volumechange", updVol);

    // 倍速：点击循环切换
    var spIdx = 1;
    els.speed.addEventListener("click", function () {
      spIdx = (spIdx + 1) % SPEEDS.length;
      audio.playbackRate = SPEEDS[spIdx];
      els.speed.textContent = (SPEEDS[spIdx] === 1 ? "1.0" : SPEEDS[spIdx]) + "x";
    });

    syncPlay(); updVol(); updDur(); updTime();
  }

  window.MoesoraAudio = function (container) {
    var root = container || document;
    var list = root.querySelectorAll ? root.querySelectorAll("audio") : [];
    Array.prototype.forEach.call(list, function (audio) {
      if (audio.dataset.moeAp) return;
      if (audio.hasAttribute("data-no-player") || audio.closest(".moe-ap")) { audio.dataset.moeAp = "skip"; return; }
      audio.dataset.moeAp = "1";
      try { build(audio); } catch (e) { console.error("[moe-audio] 初始化失败：", e); }
    });
  };
})();
