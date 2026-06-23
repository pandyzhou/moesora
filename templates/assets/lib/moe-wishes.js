/* Moesora 留言墙 moe-wishes.js
 * 存储：Halo 评论(kind=SinglePage)。分类/颜色编码在内容前缀 【分类|颜色】。
 * 布局：随机散落（位置/交叠/层级随机），卡片竖直不旋转。点击卡片就地"顶出"展开全文，再点收回。
 * 卡片：正文(游客留言) → 管理员回复(小字斜体)+「已回复」 → 底部 昵称/日期。
 * 回复只能由管理员在 Halo 后台进行（前台不提供回复入口）。
 * 暴露 window.MoesoraWishes（幂等扫描 #moe-wishes[data-name]，可被 Pjax 重复调用）。
 */
(function () {
  "use strict";
  var API = "/apis/api.halo.run/v1alpha1", GROUP = "content.halo.run", VERSION = "v1alpha1";
  var COLORS = ["green", "blue", "purple", "pink", "orange", "yellow"];

  function getCookie(n) { var m = document.cookie.match("(^|;)\\s*" + n + "\\s*=\\s*([^;]+)"); return m ? decodeURIComponent(m.pop()) : ""; }
  function api(path, opts) {
    opts = opts || {};
    var headers = { Accept: "application/json" };
    if (opts.method && opts.method !== "GET") { headers["Content-Type"] = "application/json"; var x = getCookie("XSRF-TOKEN"); if (x) headers["X-XSRF-TOKEN"] = x; }
    return fetch(API + path, { method: opts.method || "GET", headers: headers, credentials: "same-origin", body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); }); return r.status === 204 ? {} : r.json(); });
  }
  function listComments(name, page, size) { return api("/comments?group=" + GROUP + "&version=" + VERSION + "&kind=SinglePage&name=" + encodeURIComponent(name) + "&page=" + page + "&size=" + size); }
  function listReplies(commentName, page, size) { return api("/comments/" + encodeURIComponent(commentName) + "/reply?page=" + page + "&size=" + size); }
  function createComment(name, raw, html, info) {
    return api("/comments", { method: "POST", body: {
      raw: raw, content: html, allowNotification: true,
      subjectRef: { group: GROUP, version: VERSION, kind: "SinglePage", name: name },
      owner: { kind: "Email", name: info.email, displayName: info.nickname, annotations: {} } } });
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }
  function htmlToText(h) { var d = document.createElement("div"); d.innerHTML = h || ""; return (d.textContent || d.innerText || "").trim(); }
  function hashIdx(s, n) { var h = 0, i; s = s || ""; for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return h % n; }
  function rnd(seed) { var x = Math.sin(seed * 99991) * 10000; return x - Math.floor(x); }
  function parseMsg(raw, seed) {
    var m = /^\s*【([^|】]{1,12})\|([a-z]+)】([\s\S]*)$/.exec(raw || "");
    if (m && COLORS.indexOf(m[2]) >= 0) return { cat: m[1], color: m[2], text: m[3].trim() };
    return { cat: "", color: COLORS[hashIdx(seed || raw, COLORS.length)], text: (raw || "").trim() };
  }
  function fmtDate(iso) { if (!iso) return ""; var d = new Date(iso); if (isNaN(d)) return ""; return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate(); }
  function rawOf(spec) { return spec && spec.raw != null && spec.raw !== "" ? spec.raw : htmlToText(spec && spec.content); }

  function init(root) {
    if (!root || root.dataset.moeMounted === "1") return;
    root.dataset.moeMounted = "1";
    var pageName = root.dataset.name;
    var cats = (root.dataset.cats || "心愿,树洞,反馈").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var defaultCat = cats[0] || "留言";
    var SIZE = 60, page = 0, curFilter = "__all__", chosenColor = COLORS[0], chosenCat = defaultCat;
    var openEl = null;

    root.innerHTML =
      '<div class="moe-wish-tabs"><button type="button" class="moe-wish-tab is-on" data-f="__all__">全部</button>' +
      cats.map(function (c) { return '<button type="button" class="moe-wish-tab" data-f="' + esc(c) + '">' + esc(c) + '</button>'; }).join("") + '</div>' +
      '<div class="moe-wish-wall" aria-live="polite"></div>' +
      '<div class="moe-wish-state" data-state>留言加载中…</div>' +
      '<div class="moe-wish-more" hidden><button type="button" class="moe-wish-more-btn">加载更多</button></div>' +
      '<div class="moe-wish-form">' +
        '<input class="moe-wish-nick" type="text" maxlength="20" placeholder="昵称">' +
        '<input class="moe-wish-mail" type="email" maxlength="60" placeholder="邮箱(选填)">' +
        '<div class="moe-wish-mid">' +
          '<textarea class="moe-wish-ta" maxlength="200" rows="1" placeholder="写下你想说的话…"></textarea>' +
          '<span class="moe-wish-count">0/200</span>' +
          '<span class="moe-wish-colors">' + COLORS.map(function (c, i) { return '<button type="button" class="moe-wish-color moe-wish-c-' + c + (i === 0 ? " is-on" : "") + '" data-c="' + c + '" title="' + c + '"></button>'; }).join("") + '</span>' +
          '<select class="moe-wish-catsel">' + cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join("") + '</select>' +
          '<button type="button" class="moe-wish-send">发布</button>' +
        '</div>' +
      '</div>';

    var wall = root.querySelector(".moe-wish-wall"), stateEl = root.querySelector("[data-state]");
    var moreWrap = root.querySelector(".moe-wish-more"), moreBtn = root.querySelector(".moe-wish-more-btn");
    var nickEl = root.querySelector(".moe-wish-nick"), mailEl = root.querySelector(".moe-wish-mail");
    var taEl = root.querySelector(".moe-wish-ta"), countEl = root.querySelector(".moe-wish-count");
    var sendBtn = root.querySelector(".moe-wish-send"), catSel = root.querySelector(".moe-wish-catsel");

    function toast(msg, ok) {
      var t = root.querySelector(".moe-wish-toast");
      if (!t) { t = document.createElement("div"); t.className = "moe-wish-toast"; root.appendChild(t); }
      t.textContent = msg; t.classList.toggle("is-err", !ok); t.classList.add("show");
      clearTimeout(t.__h); t.__h = setTimeout(function () { t.classList.remove("show"); }, 3200);
    }
    function emailOk(m) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m); }
    function repliesHtml(items) {
      if (!items.length) return "";
      var lines = items.map(function (r) { return '<div class="moe-wish-reply-line">' + nl2br(rawOf(r.spec || {})) + '</div>'; }).join("");
      return '<div class="moe-wish-replied">已回复</div>' + lines;
    }

    // 就地展开/收回
    function closeOpen() { if (openEl) { openEl.classList.remove("is-open"); openEl = null; } }
    function toggleOpen(el) { if (el === openEl) { closeOpen(); return; } closeOpen(); el.classList.add("is-open"); openEl = el; }
    root.addEventListener("click", function () { closeOpen(); }); // 点空白处收回（卡片点击已 stopPropagation）

    // ---------- 卡片 ----------
    function cardNode(item) {
      var spec = item.spec || {}, owner = item.owner || spec.owner || {}, meta = item.metadata || {};
      var seed = (meta.name || "") + (owner.displayName || "");
      var p = parseMsg(rawOf(spec), seed);
      var cat = p.cat || defaultCat;
      var el = document.createElement("article");
      el.className = "moe-wish-card moe-wish-c-" + p.color;
      el.setAttribute("data-cat", cat);
      el.dataset.cn = meta.name;
      el.dataset.seed = String(hashIdx(seed, 100000));
      el.innerHTML =
        '<div class="moe-wish-bar"><span class="moe-wish-dots"><i></i><i></i><i></i></span>' +
        '<span class="moe-wish-cat">' + esc(cat) + '</span></div>' +
        '<div class="moe-wish-text">' + nl2br(p.text) + '</div>' +
        '<div class="moe-wish-reply-wrap" data-replywrap hidden></div>' +
        '<div class="moe-wish-foot"><span class="moe-wish-name">' + esc(owner.displayName || "匿名") + '</span>' +
        '<span class="moe-wish-date">' + esc(fmtDate(spec.creationTime || meta.creationTimestamp)) + '</span></div>';
      el.addEventListener("click", function (e) { e.stopPropagation(); toggleOpen(el); });
      var rc = (item.status && item.status.replyCount) || spec.replyCount || 0;
      if (rc > 0 && meta.name) loadCardReplies(el, meta.name);
      return el;
    }
    function loadCardReplies(el, cn) {
      listReplies(cn, 0, 50).then(function (res) {
        var items = (res && res.items) || []; if (!items.length) return;
        var wrap = el.querySelector("[data-replywrap]");
        wrap.innerHTML = repliesHtml(items); wrap.hidden = false;
        relayout();
      }).catch(function (e) { console.error("[moe-wishes] 卡片回复加载失败：", e); });
    }

    // ---------- 随机散落布局（竖直、不旋转） ----------
    var relayoutTimer = null;
    function relayout() { clearTimeout(relayoutTimer); relayoutTimer = setTimeout(layout, 90); }
    function layout() {
      var cards = [].slice.call(wall.querySelectorAll(".moe-wish-card")).filter(function (c) { return c.style.display !== "none"; });
      var W = wall.clientWidth || root.clientWidth || 320;
      if (W < 540) { // 窄屏：单列正常流
        wall.style.height = "";
        cards.forEach(function (c) { c.style.position = ""; c.style.left = ""; c.style.top = ""; c.style.width = ""; c.style.zIndex = ""; c.style.transform = ""; });
        return;
      }
      var cardW = Math.min(200, Math.max(178, Math.floor((W - 24) / 5)));
      var cols = Math.max(2, Math.floor(W / (cardW * 0.86)));
      var pitchX = cols > 1 ? (W - cardW) / (cols - 1) : 0;
      var rowH = 118, maxBottom = 0;
      cards.forEach(function (c, i) {
        c.style.position = "absolute"; c.style.width = cardW + "px"; c.style.transform = "none";
        var h = c.offsetHeight;
        var col = i % cols, row = Math.floor(i / cols);
        var sd = +c.dataset.seed || 0;
        var jx = (rnd(sd) - 0.5) * pitchX * 0.85;
        var jy = (rnd(sd + 5) - 0.5) * rowH * 1.15;
        var x = Math.max(-6, Math.min(W - cardW + 6, col * pitchX + jx));
        var y = Math.max(0, row * rowH + jy);
        c.style.left = x + "px"; c.style.top = y + "px";
        c.style.zIndex = String(hashIdx(c.dataset.cn || String(sd), 900) + 1);
        if (y + h > maxBottom) maxBottom = y + h;
      });
      wall.style.height = (maxBottom + 24) + "px";
    }
    var roTimer = null;
    window.addEventListener("resize", function () { clearTimeout(roTimer); roTimer = setTimeout(layout, 120); });

    // ---------- 交互 ----------
    root.querySelectorAll(".moe-wish-tab").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        root.querySelectorAll(".moe-wish-tab").forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on"); curFilter = b.dataset.f; closeOpen(); applyFilter();
      });
    });
    function applyFilter() {
      wall.querySelectorAll(".moe-wish-card").forEach(function (c) {
        c.style.display = (curFilter === "__all__" || c.getAttribute("data-cat") === curFilter) ? "" : "none";
      });
      layout();
    }
    root.querySelectorAll(".moe-wish-color").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); root.querySelectorAll(".moe-wish-color").forEach(function (x) { x.classList.remove("is-on"); }); b.classList.add("is-on"); chosenColor = b.dataset.c; });
    });
    catSel.addEventListener("change", function () { chosenCat = catSel.value; });
    taEl.addEventListener("input", function () { countEl.textContent = taEl.value.length + "/200"; taEl.style.height = "auto"; taEl.style.height = Math.min(taEl.scrollHeight, 120) + "px"; });
    root.querySelector(".moe-wish-form").addEventListener("click", function (e) { e.stopPropagation(); });

    function load() {
      stateEl.textContent = page === 0 ? "留言加载中…" : ""; stateEl.style.display = "";
      listComments(pageName, page, SIZE).then(function (res) {
        var items = (res && res.items) || [];
        if (page === 0 && items.length === 0) { stateEl.textContent = "还没有留言，快来写下第一条吧～"; }
        else { stateEl.style.display = "none"; }
        items.forEach(function (it) { wall.appendChild(cardNode(it)); });
        applyFilter();
        requestAnimationFrame(layout);
        var hasNext = res && (res.hasNext != null ? res.hasNext : (res.page + 1 < res.totalPages));
        moreWrap.hidden = !hasNext; if (hasNext) page += 1;
      }).catch(function (e) { stateEl.textContent = "留言加载失败，请稍后重试"; console.error("[moe-wishes] 加载失败：", e); });
    }
    moreBtn.addEventListener("click", function (e) { e.stopPropagation(); load(); });

    function send() {
      var nick = (nickEl.value || "").trim(), text = (taEl.value || "").trim(), mail = (mailEl.value || "").trim();
      if (!nick) { toast("请先填写昵称", false); nickEl.focus(); return; }
      if (!text) { toast("留言内容不能为空", false); taEl.focus(); return; }
      if (mail && !emailOk(mail)) { toast("邮箱格式不正确", false); mailEl.focus(); return; }
      if (!mail) mail = "wish_" + Date.now() + Math.floor(Math.random() * 1e4) + "@guest.local";
      var raw = "【" + chosenCat + "|" + chosenColor + "】" + text;
      var html = "<p>【" + esc(chosenCat) + "|" + chosenColor + "】" + nl2br(text) + "</p>";
      sendBtn.disabled = true; sendBtn.textContent = "发布中…";
      createComment(pageName, raw, html, { nickname: nick, email: mail }).then(function () {
        taEl.value = ""; countEl.textContent = "0/200"; taEl.style.height = "auto";
        toast("发布成功！若站点开启了审核，将在通过后显示～", true);
        page = 0; wall.innerHTML = ""; openEl = null; load();
      }).catch(function (e) {
        toast("发布失败：" + (/40[13]/.test(String(e && e.message)) ? "请检查站点评论设置(登录/验证码)" : "请稍后重试"), false);
        console.error("[moe-wishes] 发布失败：", e);
      }).then(function () { sendBtn.disabled = false; sendBtn.textContent = "发布"; });
    }
    sendBtn.addEventListener("click", function (e) { e.stopPropagation(); send(); });
    taEl.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); } });

    load();
  }

  function boot() { document.querySelectorAll("#moe-wishes[data-name]").forEach(init); }
  window.MoesoraWishes = boot;
  if (document.readyState !== "loading") boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
