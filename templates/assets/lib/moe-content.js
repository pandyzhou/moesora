/*!
 * Moesora 正文内容增强
 * ① 时间线：```timeline 代码块（每行「日期 [颜色] | 内容」，@开头为分组标题）
 * ② 彩色提示框：引用块以 [!TIP]/[!NOTE]/[!WARNING]/[!DANGER]/[!SUCCESS] 开头
 * ③ 圆形头像：图片 alt 含「头像」或「avatar」
 * 都用编辑器不会过滤的原生写法驱动。
 */
(function () {
  "use strict";
  if (window.MoesoraContent) return;

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function inline(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }

  // ---------- 时间线 ----------
  function buildTimeline(pre) {
    var code = pre.querySelector("code") || pre;
    var lines = (code.textContent || "").split("\n");
    var tl = document.createElement("div");
    tl.className = "moe-timeline";
    var COLORS = { red: 1, yellow: 1, green: 1, blue: 1 };
    var ALIAS = { warn: "yellow", warning: "yellow", danger: "red", error: "red", tip: "blue", info: "blue", ok: "green", success: "green" };
    lines.forEach(function (line) {
      var t = line.replace(/\s+$/, "");
      if (!t.trim()) return;
      if (/^(?::{2,3}\s*)?timeline$/i.test(t.trim())) return;
      if (t.trim().charAt(0) === "@") {
        var g = document.createElement("div");
        g.className = "moe-tl-group";
        var gd = document.createElement("span"); gd.className = "moe-tl-dot moe-tl-dot-lg";
        var gt = document.createElement("div"); gt.className = "moe-tl-grouptitle"; gt.textContent = t.trim().slice(1).trim();
        g.appendChild(gd); g.appendChild(gt); tl.appendChild(g);
        return;
      }
      var bar = t.indexOf("|");
      var left = bar >= 0 ? t.slice(0, bar).trim() : "";
      var body = bar >= 0 ? t.slice(bar + 1).trim() : t.trim();
      var color = "blue";
      var cm = left.match(/\[([a-zA-Z]+)\]/);
      if (cm) {
        var c = cm[1].toLowerCase();
        if (ALIAS[c]) c = ALIAS[c];
        if (COLORS[c]) color = c;
        left = left.replace(cm[0], "").trim();
      }
      var item = document.createElement("div");
      item.className = "moe-tl-item";
      var dot = document.createElement("span"); dot.className = "moe-tl-dot is-" + color;
      var de = document.createElement("div"); de.className = "moe-tl-date"; de.textContent = left;
      var bx = document.createElement("div"); bx.className = "moe-tl-box is-" + color; bx.innerHTML = inline(body);
      item.appendChild(dot);
      if (left) item.appendChild(de);
      item.appendChild(bx);
      tl.appendChild(item);
    });
    if (pre.parentNode) pre.parentNode.replaceChild(tl, pre);
  }

  // ---------- 彩色提示框 ----------
  var NICON = {
    tip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>'
  };
  var TYPES = { TIP: "tip", NOTE: "note", INFO: "tip", IMPORTANT: "note", TODO: "note", WARNING: "warn", WARN: "warn", CAUTION: "warn", DANGER: "danger", ERROR: "danger", SUCCESS: "ok", OK: "ok" };
  var LABEL = { tip: "提示", note: "笔记", warn: "注意", danger: "警告", ok: "成功" };

  function buildCallout(bq) {
    var raw = (bq.textContent || "").replace(/^\s+/, "");
    var m = raw.match(/^>*\s*\[!\s*([A-Za-z]+)\s*\]/);
    if (!m) return;
    var type = TYPES[m[1].toUpperCase()];
    if (!type) return;
    var note = document.createElement("div");
    note.className = "moe-note is-" + type;
    var head = document.createElement("div");
    head.className = "moe-note-head";
    head.innerHTML = NICON[type] + "<span>" + LABEL[type] + "</span>";
    var body = document.createElement("div");
    body.className = "moe-note-body";
    while (bq.firstChild) body.appendChild(bq.firstChild);
    var first = body.querySelector("p") || body.firstElementChild;
    if (first) first.innerHTML = first.innerHTML.replace(/^\s*(?:&gt;|&#62;|>)*\s*\[!\s*\w+\s*\]\s*/i, "");
    if (first && first.tagName === "P" && !first.textContent.trim() && !first.querySelector("img,a,code,br")) first.remove();
    note.appendChild(head); note.appendChild(body);
    if (bq.parentNode) bq.parentNode.replaceChild(note, bq);
  }

  window.MoesoraContent = function (container) {
    var root = container || document.querySelector(".moe-post-content") || document;
    if (!root || !root.querySelectorAll) return;

    Array.prototype.forEach.call(root.querySelectorAll("pre"), function (pre) {
      if (pre.dataset.moeTl) return;
      var code = pre.querySelector("code");
      var cls = (pre.className + " " + (code ? code.className : "")).toLowerCase();
      var txt = (code ? code.textContent : pre.textContent) || "", firstLine = "", arr = txt.split("\n"), i;
      for (i = 0; i < arr.length; i++) { if (arr[i].trim()) { firstLine = arr[i].trim(); break; } }
      if (cls.indexOf("timeline") === -1 && !/^(?::{2,3}\s*)?timeline$/i.test(firstLine)) return;
      pre.dataset.moeTl = "1";
      try { buildTimeline(pre); } catch (e) { console.error("[moe-content] 时间线渲染失败：", e); }
    });

    Array.prototype.forEach.call(root.querySelectorAll("blockquote"), function (bq) {
      if (bq.dataset.moeNote) return;
      bq.dataset.moeNote = "1";
      try { buildCallout(bq); } catch (e) { console.error("[moe-content] 提示框渲染失败：", e); }
    });

    Array.prototype.forEach.call(root.querySelectorAll("img"), function (img) {
      if (img.dataset.moeAvatar) return;
      if (/头像|avatar/i.test(img.getAttribute("alt") || "")) { img.dataset.moeAvatar = "1"; img.classList.add("moe-avatar"); }
    });
  };
})();
