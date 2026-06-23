/* Moesora 相册 / 瞬间增强（彩色分组标签、时间轴、点赞、评论气泡）
   纯前端，幂等可重复调用（供首屏与 Pjax 复用）；无对应容器时不动作。 */
(function () {
  "use strict";

  var UPVOTE_API = "/apis/api.halo.run/v1alpha1/trackers/upvote";
  var LIKED_KEY = "moe-mo-liked";

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // 给一组图片绑定点击放大（复用主题自带灯箱）
  function bindLightbox(imgs) {
    if (!window.MoesoraLightbox || !imgs.length) return;
    imgs.forEach(function (im) {
      if (im.dataset.moeLb) return;
      im.dataset.moeLb = "1";
      im.style.cursor = "zoom-in";
      im.addEventListener("click", function () {
        window.MoesoraLightbox.open(imgs, im);
      });
    });
  }

  // ---- 相册：彩色分组标签切换 ----
  function initPhotos() {
    var wrap = document.querySelector(".moe-photo-wrap");
    if (!wrap) return;
    var tabs = wrap.querySelectorAll(".moe-photo-tab");
    var panels = wrap.querySelectorAll(".moe-photo-panel");
    tabs.forEach(function (t) {
      if (t.dataset.moeBound) return;
      t.dataset.moeBound = "1";
      t.addEventListener("click", function () {
        var tgt = t.getAttribute("data-target");
        tabs.forEach(function (x) { x.classList.remove("is-active"); });
        t.classList.add("is-active");
        panels.forEach(function (p) {
          p.classList.toggle("is-active", p.getAttribute("data-panel") === tgt);
        });
      });
    });
    panels.forEach(function (p) {
      bindLightbox(Array.prototype.slice.call(p.querySelectorAll("img.moe-lb-photo")));
    });
  }

  // ---- 瞬间：时间轴时间格式化 ----
  function formatTimes(wrap) {
    wrap.querySelectorAll(".moe-tl-time").forEach(function (el) {
      if (el.dataset.moeFmt) return;
      el.dataset.moeFmt = "1";
      var iso = el.getAttribute("datetime") || el.textContent;
      var d = new Date(iso);
      if (!isNaN(d.getTime())) {
        el.textContent = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
          " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
      }
    });
  }

  function readLiked(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveLiked(key, map) {
    try { localStorage.setItem(key, JSON.stringify(map)); } catch (e) {}
  }

  // ---- 瞬间：点赞（Halo tracker upvote，本地记忆防重复计数） ----
  function initLikes(wrap) {
    var liked = readLiked(LIKED_KEY);
    wrap.querySelectorAll(".moe-mo-like").forEach(function (btn) {
      if (btn.dataset.moeBound) return;
      btn.dataset.moeBound = "1";
      var name = btn.getAttribute("data-name");
      var nEl = btn.querySelector(".moe-mo-n");
      if (liked[name]) btn.classList.add("is-liked");
      btn.addEventListener("click", function () {
        if (btn.dataset.busy || liked[name]) return;
        btn.dataset.busy = "1";
        fetch(UPVOTE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ group: "moment.halo.run", plural: "moments", name: name })
        }).then(function (r) {
          if (!r.ok) throw new Error("upvote failed: " + r.status);
          liked[name] = 1;
          saveLiked(LIKED_KEY, liked);
          btn.classList.add("is-liked");
          if (nEl) nEl.textContent = (parseInt(nEl.textContent, 10) || 0) + 1;
        }).catch(function (e) {
          console.error("[moe-moment] 点赞失败：", e);
        }).then(function () {
          btn.dataset.busy = "";
        });
      });
    });
  }

  // ---- 瞬间：评论气泡（点击展开，首次挂载内置评论） ----
  function initComments(wrap) {
    wrap.querySelectorAll(".moe-mo-cmt-toggle").forEach(function (btn) {
      if (btn.dataset.moeBound) return;
      btn.dataset.moeBound = "1";
      btn.addEventListener("click", function () {
        var card = btn.closest(".moe-tl-card");
        if (!card) return;
        var box = card.querySelector(".moe-mo-comments");
        if (!box) return;
        box.hidden = !box.hidden;
        if (!box.hidden && !box.dataset.mounted) {
          box.dataset.mounted = "1";
          var cmt = box.querySelector(".moe-comment");
          if (cmt && window.MoesoraComment && window.MoesoraComment.mount) {
            window.MoesoraComment.mount(cmt);
          }
        }
      });
    });
  }

  function initMoments() {
    var wrap = document.querySelector(".moe-moment-wrap");
    if (!wrap) return;
    formatTimes(wrap);
    wrap.querySelectorAll(".moe-moment-media").forEach(function (media) {
      bindLightbox(Array.prototype.slice.call(media.querySelectorAll("img.moe-lb-photo")));
    });
    initLikes(wrap);
    initComments(wrap);
  }

  // ---- 文章：赞赏按钮兼作点赞（保留展开收款码，额外给文章点赞一次） ----
  function initReward() {
    var btn = document.querySelector(".moe-reward-btn[data-name]");
    if (!btn || btn.dataset.moeLikeBound) return;
    btn.dataset.moeLikeBound = "1";
    var name = btn.getAttribute("data-name");
    var heartEl = document.querySelector(".moe-upvote-n");
    var liked = readLiked("moe-post-liked");
    if (liked[name]) btn.classList.add("is-liked");
    btn.addEventListener("click", function () {
      // 展开/收起收款码由按钮自带的 onclick 处理；这里只负责点赞一次
      if (btn.dataset.likeBusy || liked[name]) return;
      btn.dataset.likeBusy = "1";
      fetch(UPVOTE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ group: "content.halo.run", plural: "posts", name: name })
      }).then(function (r) {
        if (!r.ok) throw new Error("upvote failed: " + r.status);
        liked[name] = 1;
        saveLiked("moe-post-liked", liked);
        btn.classList.add("is-liked");
        if (heartEl) heartEl.textContent = (parseInt(heartEl.textContent, 10) || 0) + 1;
      }).catch(function (e) {
        console.error("[moe-reward] 点赞失败：", e);
      }).then(function () {
        btn.dataset.likeBusy = "";
      });
    });
  }

  function boot() {
    try { initPhotos(); } catch (e) { console.error("[moe-feed] photos:", e); }
    try { initMoments(); } catch (e) { console.error("[moe-feed] moments:", e); }
    try { initReward(); } catch (e) { console.error("[moe-feed] reward:", e); }
  }

  window.MoesoraFeed = boot;
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
