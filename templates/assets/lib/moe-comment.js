/*!
 * Moesora 内置评论（直接调用 Halo 公开评论 API）
 * 游客填 昵称(输QQ自动取昵称) + 手机号 + 邮箱 即可评论；头像用 cravatar；表情走 CDN；可贴图（图床/内嵌）。
 * 需在 Halo 后台「评论设置」开启允许匿名/自定义账号评论。可被 Pjax 重复调用（幂等）。
 */
(function () {
  "use strict";
  var API = "/apis/api.halo.run/v1alpha1", GROUP = "content.halo.run", VERSION = "v1alpha1";
  var CFG = window.MoesoraConfig || {};
  var UP = CFG.commentUpload || {};
  var CRAVATAR = "https://cn.cravatar.com/avatar/";
  var EMOJI_BASE = (CFG.cdnBase || "https://gcore.jsdelivr.net") + "/gh/2x-ercha/twikoo-magic@master/image/QQ/";
  var EMOJI_NS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207];
  var EMOJI_SET = {}; EMOJI_NS.forEach(function (n) { EMOJI_SET[n] = 1; });

  // ---------- md5（cravatar 邮箱哈希） ----------
  var md5 = (function () {
    function sa(x, y) { var l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
    function rol(n, c) { return (n << c) | (n >>> (32 - c)); }
    function cmn(q, a, b, x, s, t) { return sa(rol(sa(sa(a, q), sa(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
    function bm(x, len) {
      x[len >> 5] |= 0x80 << (len % 32); x[(((len + 64) >>> 9) << 4) + 14] = len;
      var i, oa, ob, oc, od, a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
      for (i = 0; i < x.length; i += 16) {
        oa = a; ob = b; oc = c; od = d;
        a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586); c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426); c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417); c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101); c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
        a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632); c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
        a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083); c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690); c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784); c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
        a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463); c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353); c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222); c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835); c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415); c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606); c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744); c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379); c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
        a = sa(a, oa); b = sa(b, ob); c = sa(c, oc); d = sa(d, od);
      }
      return [a, b, c, d];
    }
    function b2r(input) { var i, o = ""; for (i = 0; i < input.length * 32; i += 8) o += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xff); return o; }
    function r2b(input) { var i, o = []; o[(input.length >> 2) - 1] = undefined; for (i = 0; i < o.length; i += 1) o[i] = 0; for (i = 0; i < input.length * 8; i += 8) o[i >> 5] |= (input.charCodeAt(i / 8) & 0xff) << (i % 32); return o; }
    function r2h(input) { var h = "0123456789abcdef", o = "", x, i; for (i = 0; i < input.length; i += 1) { x = input.charCodeAt(i); o += h.charAt((x >>> 4) & 0x0f) + h.charAt(x & 0x0f); } return o; }
    return function (s) { return r2h(b2r(bm(r2b(unescape(encodeURIComponent(s))), s.length * 8))); };
  })();

  // ---------- 工具 ----------
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function getCookie(name) { var m = document.cookie.match("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, "\\$1") + "=([^;]*)"); return m ? decodeURIComponent(m[1]) : ""; }
  function timeAgo(iso) {
    if (!iso) return ""; var t = new Date(iso).getTime(); if (isNaN(t)) return "";
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "刚刚"; if (s < 3600) return Math.floor(s / 60) + " 分钟前"; if (s < 86400) return Math.floor(s / 3600) + " 小时前"; if (s < 2592000) return Math.floor(s / 86400) + " 天前";
    var d = new Date(t); function p(n) { return (n < 10 ? "0" : "") + n; } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function insertAtCursor(ta, text) {
    if (!ta) return;
    var s = ta.selectionStart != null ? ta.selectionStart : ta.value.length, e = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    var pos = s + text.length; try { ta.selectionStart = ta.selectionEnd = pos; } catch (err) {} ta.focus();
  }
  // 默认头像：客户端随机生成的对称色块（identicon），随机色相，不依赖网络，每次加载随机一个
  var DEFAULT_AVATAR = (function () {
    var hue = Math.floor(Math.random() * 360);
    var fg = "hsl(" + hue + ",58%,56%)", bg = "hsl(" + hue + ",52%,93%)";
    var cells = "";
    for (var y = 0; y < 5; y++) for (var x = 0; x < 3; x++) {
      if (Math.random() > 0.5) {
        cells += '<rect x="' + (4 + x * 8) + '" y="' + (4 + y * 8) + '" width="8" height="8"/>';
        if (x < 2) cells += '<rect x="' + (4 + (4 - x) * 8) + '" y="' + (4 + y * 8) + '" width="8" height="8"/>';
      }
    }
    return "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="24" fill="' + bg + '"/><g fill="' + fg + '">' + cells + '</g></svg>');
  })();
  function fixAvatars(scope) { (scope || document).querySelectorAll('img.moe-cmt-avatar,img[data-role="avatar"]').forEach(function (im) { im.onerror = function () { this.onerror = null; this.src = DEFAULT_AVATAR; }; }); }
  // 评论里的图片点击进主题灯箱，可放大/缩小查看
  function bindLightbox(scope) {
    var root = document.getElementById("moe-comment") || document;
    (scope || root).querySelectorAll("img.moe-cmt-img").forEach(function (im) {
      if (im.dataset.moeLb) return; im.dataset.moeLb = "1"; im.style.cursor = "zoom-in";
      im.addEventListener("click", function (e) {
        if (!(window.MoesoraLightbox && window.MoesoraLightbox.open)) return;
        e.preventDefault();
        var list = [].slice.call(root.querySelectorAll("img.moe-cmt-img"));
        window.MoesoraLightbox.open(list, im);
      });
    });
  }
  function fileToDataUrl(file, cb) {
    var reader = new FileReader(); reader.onerror = function () { cb(null); };
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1280, w = img.width, h = img.height;
        if (w > max || h > max) { var r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        try { var c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); cb(c.toDataURL("image/jpeg", 0.85)); } catch (e) { cb(reader.result); }
      };
      img.onerror = function () { cb(reader.result); }; img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // ---------- 头像（cravatar 邮箱头像） ----------
  function cravatarByEmail(email) { return CRAVATAR + md5(String(email || "").trim().toLowerCase()) + "?s=100&d=monsterid"; }
  function qqAvatar(qq) { return "https://q1.qlogo.cn/g?b=qq&nk=" + encodeURIComponent(qq) + "&s=100"; }
  function ownerDisplay(owner) {
    var d = (owner && owner.displayName) || "";
    var i = d.indexOf("\u2063");
    if (i >= 0) { var q = d.slice(i + 1).replace(/\D/g, ""); return { name: d.slice(0, i), qq: /^\d{5,13}$/.test(q) ? q : "" }; }
    return { name: d, qq: "" };
  }
  function qqFrom(owner) {
    owner = owner || {}; var ann = owner.annotations || {};
    var od = ownerDisplay(owner); if (od.qq) return od.qq;
    if (ann.qq && /^\d{5,13}$/.test(ann.qq)) return ann.qq;
    var m = /^(\d{5,13})@qq\.com$/i.exec(owner.name || ""); if (m) return m[1];
    var dn = (owner.displayName || "").trim(); if (/^\d{5,13}$/.test(dn)) return dn;
    return "";
  }
  function avatarOf(owner) {
    owner = owner || {}; if (owner.avatar) return owner.avatar;
    var ann = owner.annotations || {};
    if (ann.avatar) return ann.avatar;
    var qq = qqFrom(owner); if (qq) return qqAvatar(qq);
    if (ann["email-hash"]) return CRAVATAR + ann["email-hash"] + "?s=100&d=monsterid";
    return DEFAULT_AVATAR;
  }

  // ---------- 表情（CDN QQ 表情） ----------
  function stickerSrc(n) { return EMOJI_BASE + n + ".gif"; }

  // ---------- 正文渲染：表情 [/qqN] + markdown 图片 + 换行 ----------
  function renderContent(raw) {
    raw = String(raw == null ? "" : raw); var toks = [];
    function stash(html) { toks.push(html); return "\u0000T" + (toks.length - 1) + "\u0000"; }
    raw = raw.replace(/!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^\s)]+)\)/g, function (m, alt, url) { return stash('<img class="moe-cmt-img" loading="lazy" src="' + esc(url) + '" alt="' + esc(alt) + '">'); });
    raw = raw.replace(/\[\/qq(\d+)\]/g, function (m, n) { return EMOJI_SET[n] ? stash('<img class="moe-cmt-sticker" src="' + stickerSrc(n) + '" alt="表情">') : m; });
    var s = esc(raw).replace(/\n/g, "<br>");
    s = s.replace(/\u0000T(\d+)\u0000/g, function (m, i) { return toks[+i]; });
    return s;
  }
  function sanitizeHtml(html) {
    var d = document.createElement("div"); d.innerHTML = html || "";
    d.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button,textarea,svg,base").forEach(function (el) { el.parentNode && el.parentNode.removeChild(el); });
    d.querySelectorAll("*").forEach(function (el) {
      [].slice.call(el.attributes).forEach(function (at) {
        var n = (at.name || "").toLowerCase(), v = (at.value || "").replace(/\s+/g, "").toLowerCase();
        if (n.indexOf("on") === 0 || ((n === "href" || n === "src" || n === "xlink:href" || n === "formaction" || n === "action") && /^javascript:|^data:text\/html/.test(v))) el.removeAttribute(at.name);
      });
    });
    return d.innerHTML;
  }
  function displayHtml(spec) { var raw = spec && spec.raw; if (raw != null && raw !== "") return renderContent(raw); return sanitizeHtml((spec && spec.content) || ""); }

  // ---------- 网络 ----------
  function api(path, opts) {
    opts = opts || {}; var headers = opts.headers || {};
    if (opts.method && opts.method !== "GET") { headers["Content-Type"] = "application/json"; var x = getCookie("XSRF-TOKEN"); if (x) headers["X-XSRF-TOKEN"] = x; }
    return fetch(API + path, { method: opts.method || "GET", headers: headers, credentials: "same-origin", body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (res) { return res.text().then(function (txt) { var data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {} if (!res.ok) { var msg = (data && (data.detail || data.message || data.title)) || ("请求失败（HTTP " + res.status + "）"); var err = new Error(msg); err.status = res.status; throw err; } return data; }); });
  }
  function listComments(group, kind, name, page, size) { return api("/comments?group=" + group + "&version=" + VERSION + "&kind=" + kind + "&name=" + encodeURIComponent(name) + "&page=" + page + "&size=" + size); }
  function listReplies(commentName, page, size) { return api("/comments/" + encodeURIComponent(commentName) + "/reply?page=" + page + "&size=" + size); }
  function ownerPayload(info) { var ann = {}; if (info.avatar) ann.avatar = info.avatar; if (info.qq) ann.qq = info.qq; if (info.phone) ann.phone = info.phone; var dn = info.qq ? (info.nickname + "\u2063" + info.qq) : info.nickname; return { kind: "Email", name: info.email, displayName: dn, annotations: ann }; }
  function createComment(group, kind, name, text, info) { return api("/comments", { method: "POST", body: { raw: text, content: renderContent(text), allowNotification: true, subjectRef: { group: group, version: VERSION, kind: kind, name: name }, owner: ownerPayload(info) } }); }
  function createReply(commentName, text, info, quoteReply) { var body = { raw: text, content: renderContent(text), allowNotification: true, owner: ownerPayload(info) }; if (quoteReply) body.quoteReply = quoteReply; return api("/comments/" + encodeURIComponent(commentName) + "/reply", { method: "POST", body: body }); }

  // ---------- 图片上传（图床或内嵌） ----------
  function pickUrl(data, path) {
    if (!data) return "";
    if (path) { var v = data; path.split(".").forEach(function (k) { v = v && v[k]; }); if (typeof v === "string") return v; }
    return (data.data && data.data.url) || data.url || (data.data && data.data.links && data.data.links.url) || (data.data && data.data.fullurl) || data.fullurl || "";
  }
  function uploadToBed(file, onOk, onErr) {
    var fd = new FormData(); fd.append(UP.field || "file", file);
    var headers = {}; if (UP.header) { var i = UP.header.indexOf(":"); if (i > 0) headers[UP.header.slice(0, i).trim()] = UP.header.slice(i + 1).trim(); }
    fetch(UP.url, { method: "POST", body: fd, headers: headers }).then(function (r) { return r.text(); })
      .then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) {} var url = pickUrl(d, UP.resp); if (url) onOk(url); else onErr("图床未返回图片地址"); })
      .catch(function () { onErr("图片上传失败"); });
  }

  // ---------- 表单 ----------
  var LS = "moe-comment-author";
  function loadAuthor() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function saveAuthor(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }
  var EMOJI_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>';
  var IMG_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/></svg>';

  function formHtml() {
    var a = loadAuthor();
    var av = a.qq ? qqAvatar(a.qq) : (a.email ? cravatarByEmail(a.email) : DEFAULT_AVATAR);
    return '' +
      '<div class="moe-cmt-form">' +
        '<div class="moe-cmt-form-avatar"><img alt="头像" src="' + av + '" data-role="avatar"></div>' +
        '<div class="moe-cmt-form-main">' +
          '<div class="moe-cmt-fields">' +
            '<input class="moe-cmt-input" data-role="nickname" type="text" maxlength="32" placeholder="昵称 *" value="' + esc(a.nickname || "") + '">' +
            '<input class="moe-cmt-input" data-role="qq" type="text" inputmode="numeric" maxlength="13" placeholder="QQ号（选填，用于头像）" value="' + esc(a.qq || "") + '">' +
            '<input class="moe-cmt-input" data-role="phone" type="tel" inputmode="numeric" maxlength="11" placeholder="手机号 *" value="' + esc(a.phone || "") + '">' +
            '<input class="moe-cmt-input" data-role="email" type="email" maxlength="64" placeholder="邮箱 *" value="' + esc(a.email || "") + '">' +
          '</div>' +
          '<textarea class="moe-cmt-textarea" data-role="text" rows="4" placeholder="写下你的评论…"></textarea>' +
          '<div class="moe-cmt-preview" data-role="preview" hidden></div>' +
          '<div class="moe-cmt-tools">' +
            '<button type="button" class="moe-cmt-tool" data-role="emoji-btn" title="表情" aria-label="表情">' + EMOJI_ICON + '</button>' +
            '<button type="button" class="moe-cmt-tool" data-role="img-btn" title="图片" aria-label="图片">' + IMG_ICON + '</button>' +
            '<input type="file" accept="image/*" data-role="img-input" hidden>' +
          '</div>' +
          '<div class="moe-cmt-emoji" data-role="emoji-panel" hidden></div>' +
          '<div class="moe-cmt-attach" data-role="attach" hidden></div>' +
          '<div class="moe-cmt-form-foot">' +
            '<span class="moe-cmt-tip" data-role="tip"></span>' +
            '<div class="moe-cmt-btns">' +
              '<button type="button" class="moe-cmt-preview-btn" data-role="preview-btn">预览</button>' +
              '<button type="button" class="moe-cmt-submit" data-role="submit">提交</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  function readForm(wrap) {
    return {
      nickname: (wrap.querySelector('[data-role="nickname"]').value || "").trim(),
      qq: (wrap.querySelector('[data-role="qq"]').value || "").trim(),
      phone: (wrap.querySelector('[data-role="phone"]').value || "").trim(),
      email: (wrap.querySelector('[data-role="email"]').value || "").trim(),
      text: (wrap.querySelector('[data-role="text"]').value || "").trim()
    };
  }
  function validate(f) {
    if (!f.nickname) return "请填写昵称";
    if (f.qq && !/^\d{5,13}$/.test(f.qq)) return "QQ号格式不正确";
    if (!f.phone) return "请填写手机号";
    if (!/^1[3-9]\d{9}$/.test(f.phone)) return "手机号格式不正确";
    if (!f.email) return "请填写邮箱";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "邮箱格式不正确";
    if (!f.text) return "评论内容不能为空";
    return "";
  }

  function bindForm(wrap, onSubmit) {
    var nickEl = wrap.querySelector('[data-role="nickname"]');
    var emailEl = wrap.querySelector('[data-role="email"]');
    var phoneEl = wrap.querySelector('[data-role="phone"]');
    var avatarEl = wrap.querySelector('[data-role="avatar"]');
    var ta = wrap.querySelector('[data-role="text"]');
    var tip = wrap.querySelector('[data-role="tip"]');
    var btn = wrap.querySelector('[data-role="submit"]');
    var pvBtn = wrap.querySelector('[data-role="preview-btn"]');
    var pv = wrap.querySelector('[data-role="preview"]');
    var emojiBtn = wrap.querySelector('[data-role="emoji-btn"]');
    var emojiPanel = wrap.querySelector('[data-role="emoji-panel"]');
    var imgBtn = wrap.querySelector('[data-role="img-btn"]');
    var imgInput = wrap.querySelector('[data-role="img-input"]');
    var attachWrap = wrap.querySelector('[data-role="attach"]');
    var attached = [], MAX_IMG = 3, qqNum = "";

    function setTip(msg, cls) { tip.className = "moe-cmt-tip" + (cls ? " " + cls : ""); tip.textContent = msg || ""; }
    function refreshAvatar() { var em = (emailEl.value || "").trim(); avatarEl.src = qqNum ? qqAvatar(qqNum) : (em ? cravatarByEmail(em) : DEFAULT_AVATAR); }
    fixAvatars(wrap);

    // QQ 号：独立填写，仅用于生成头像（q1.qlogo.cn，免接口）；昵称由用户自己填写
    var qqEl = wrap.querySelector('[data-role="qq"]');
    qqNum = (qqEl && /^\d{5,13}$/.test(qqEl.value.trim())) ? qqEl.value.trim() : "";
    if (qqEl) qqEl.addEventListener("input", function () {
      qqEl.value = qqEl.value.replace(/\D/g, "");
      var v = qqEl.value.trim();
      qqNum = /^\d{5,13}$/.test(v) ? v : "";
      refreshAvatar();
      markValid(qqEl, v === "" || /^\d{5,13}$/.test(v));
    });
    function markValid(el, ok) { if (el) el.classList.toggle("is-invalid", !ok && el.value.trim() !== ""); }
    emailEl.addEventListener("input", function () { refreshAvatar(); markValid(emailEl, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())); });
    if (phoneEl) phoneEl.addEventListener("input", function () { phoneEl.value = phoneEl.value.replace(/\D/g, ""); markValid(phoneEl, /^1[3-9]\d{9}$/.test(phoneEl.value.trim())); });

    // 表情面板（CDN 图片，懒加载）
    if (emojiBtn && emojiPanel) {
      emojiBtn.addEventListener("click", function () {
        if (!emojiPanel.dataset.built) {
          emojiPanel.dataset.built = "1";
          EMOJI_NS.forEach(function (n) {
            var b = document.createElement("button"); b.type = "button";
            var im = document.createElement("img"); im.loading = "lazy"; im.src = stickerSrc(n); im.alt = "表情";
            b.appendChild(im);
            b.addEventListener("click", function () { insertAtCursor(ta, "[/qq" + n + "]"); });
            emojiPanel.appendChild(b);
          });
        }
        emojiPanel.hidden = !emojiPanel.hidden;
      });
      if (!window.__moeCmtEmojiDoc) {
        window.__moeCmtEmojiDoc = true;
        document.addEventListener("click", function (e) {
          document.querySelectorAll('[data-role="emoji-panel"]').forEach(function (p) {
            if (p.hidden) return;
            if (!p.contains(e.target) && !(e.target.closest && e.target.closest('[data-role="emoji-btn"]'))) p.hidden = true;
          });
        });
      }
    }

    // 图片：图床上传 或 本地内嵌
    function renderAttach() {
      attachWrap.innerHTML = "";
      attached.forEach(function (url, idx) {
        var it = document.createElement("div"); it.className = "moe-cmt-attach-item";
        it.innerHTML = '<img alt="预览" src="' + esc(url) + '"><button type="button" class="moe-cmt-attach-del" title="移除" aria-label="移除">×</button>';
        it.querySelector(".moe-cmt-attach-del").addEventListener("click", function () { attached.splice(idx, 1); renderAttach(); });
        attachWrap.appendChild(it);
      });
      attachWrap.hidden = attached.length === 0;
    }
    if (imgBtn && imgInput) {
      imgBtn.addEventListener("click", function () { if (!UP.url && attached.length >= MAX_IMG) { setTip("最多 " + MAX_IMG + " 张图片", "is-err"); return; } imgInput.value = ""; imgInput.click(); });
      imgInput.addEventListener("change", function () {
        var file = imgInput.files && imgInput.files[0]; if (!file) return;
        if (!/^image\//.test(file.type)) { setTip("请选择图片文件", "is-err"); return; }
        if (UP.url) { setTip("图片上传中…", ""); uploadToBed(file, function (url) { insertAtCursor(ta, "![" + (file.name || "图片") + "](" + url + ")"); setTip("图片上传成功！", "is-ok"); }, function (msg) { setTip(msg, "is-err"); }); }
        else { fileToDataUrl(file, function (u) { if (u) { attached.push(u); renderAttach(); } else setTip("图片读取失败", "is-err"); }); }
      });
    }

    // 预览
    pvBtn.addEventListener("click", function () {
      if (pv.hidden) {
        var t = (ta.value || "").trim();
        var full = t + attached.map(function (u) { return "\n![图片](" + u + ")"; }).join("");
        pv.innerHTML = full ? renderContent(full) : '<span class="moe-cmt-muted">没有可预览的内容</span>';
        pv.hidden = false; pvBtn.textContent = "收起"; fixAvatars(pv); bindLightbox(pv);
      } else { pv.hidden = true; pvBtn.textContent = "预览"; }
    });

    btn.addEventListener("click", function () {
      var f = readForm(wrap); var err = validate(f);
      if (err) { setTip(err, "is-err"); return; }
      var qq = (f.qq && /^\d{5,13}$/.test(f.qq)) ? f.qq : "";
      var info = { nickname: f.nickname, phone: f.phone, email: f.email, qq: qq, avatar: qq ? qqAvatar(qq) : cravatarByEmail(f.email) };
      saveAuthor({ nickname: f.nickname, qq: qq, phone: f.phone, email: f.email });
      var fullRaw = f.text + attached.map(function (u) { return "\n![图片](" + u + ")"; }).join("");
      btn.disabled = true; btn.textContent = "提交中…"; setTip("", "");
      onSubmit(fullRaw, info).then(function () {
        ta.value = ""; attached = []; renderAttach(); pv.hidden = true; pvBtn.textContent = "预览";
        setTip("评论成功！如开启审核，将在站长通过后显示。", "is-ok");
      }).catch(function (e) { setTip("评论失败：" + (e && e.message ? e.message : "未知错误"), "is-err"); console.error("[moe-comment]", e); })
        .then(function () { btn.disabled = false; btn.textContent = "提交"; });
    });
  }

  // ---------- 渲染评论 ----------
  function commentNode(item) {
    var spec = item.spec || {}, owner = item.owner || spec.owner || {}, meta = item.metadata || {};
    var el = document.createElement("div"); el.className = "moe-cmt-item";
    el.innerHTML =
      '<img class="moe-cmt-avatar" alt="头像" loading="lazy" src="' + esc(avatarOf(owner)) + '">' +
      '<div class="moe-cmt-body">' +
        '<div class="moe-cmt-head"><span class="moe-cmt-name">' + esc(ownerDisplay(owner).name || "匿名") + '</span><span class="moe-cmt-time">' + esc(timeAgo(spec.creationTime || meta.creationTimestamp)) + '</span></div>' +
        '<div class="moe-cmt-content">' + displayHtml(spec) + '</div>' +
        '<div class="moe-cmt-actions"><button type="button" class="moe-cmt-reply-btn">回复</button></div>' +
        '<div class="moe-cmt-replies" data-replies></div>' +
        '<div class="moe-cmt-reply-box" hidden></div>' +
      '</div>';
    var replyBtn = el.querySelector(".moe-cmt-reply-btn"), replyBox = el.querySelector(".moe-cmt-reply-box");
    replyBtn.addEventListener("click", function () {
      if (replyBox.hasChildNodes()) { replyBox.hidden = !replyBox.hidden; return; }
      replyBox.innerHTML = formHtml(); replyBox.hidden = false;
      bindForm(replyBox, function (text, info) { return createReply(meta.name, text, info).then(function () { loadRepliesInto(el, meta.name); }); });
    });
    var rc = (item.status && item.status.replyCount) || spec.replyCount || 0;
    if (rc > 0) loadRepliesInto(el, meta.name);
    fixAvatars(el); bindLightbox(el);
    return el;
  }
  function loadRepliesInto(commentEl, commentName) {
    var box = commentEl.querySelector("[data-replies]");
    listReplies(commentName, 0, 100).then(function (res) {
      var items = (res && res.items) || []; box.innerHTML = "";
      items.forEach(function (r) {
        var s = r.spec || {}, o = r.owner || s.owner || {}, m = r.metadata || {};
        var rEl = document.createElement("div"); rEl.className = "moe-cmt-item is-reply";
        rEl.innerHTML =
          '<img class="moe-cmt-avatar" alt="头像" loading="lazy" src="' + esc(avatarOf(o)) + '">' +
          '<div class="moe-cmt-body"><div class="moe-cmt-head"><span class="moe-cmt-name">' + esc(ownerDisplay(o).name || "匿名") + '</span><span class="moe-cmt-time">' + esc(timeAgo(s.creationTime || m.creationTimestamp)) + '</span></div>' +
          '<div class="moe-cmt-content">' + displayHtml(s) + '</div></div>';
        box.appendChild(rEl);
      });
      fixAvatars(box); bindLightbox(box);
    }).catch(function (e) { console.error("[moe-comment] 回复加载失败：", e); });
  }

  // ---------- 初始化 ----------
  function init(root) {
    if (!root || root.dataset.moeMounted === "1") return;
    root.dataset.moeMounted = "1";
    var postName = root.dataset.name, kind = root.dataset.kind || "Post", group = root.dataset.group || GROUP, SIZE = 10, page = 0;
    root.innerHTML =
      '<div class="moe-cmt-formwrap"></div>' +
      '<div class="moe-cmt-listhead"><span class="moe-cmt-count">评论</span></div>' +
      '<div class="moe-cmt-list" aria-live="polite"></div>' +
      '<div class="moe-cmt-more" hidden><button type="button" class="moe-cmt-more-btn">加载更多</button></div>' +
      '<div class="moe-cmt-state" data-state></div>';
    var formWrap = root.querySelector(".moe-cmt-formwrap"), listEl = root.querySelector(".moe-cmt-list"), countEl = root.querySelector(".moe-cmt-count");
    var moreWrap = root.querySelector(".moe-cmt-more"), moreBtn = root.querySelector(".moe-cmt-more-btn"), stateEl = root.querySelector("[data-state]");
    formWrap.innerHTML = formHtml();
    bindForm(formWrap, function (text, info) { return createComment(group, kind, postName, text, info).then(function () { reload(); }); });
    function reload() { page = 0; listEl.innerHTML = ""; load(); }
    function load() {
      stateEl.textContent = page === 0 ? "评论加载中…" : "";
      listComments(group, kind, postName, page, SIZE).then(function (res) {
        stateEl.textContent = "";
        var items = (res && res.items) || [], total = (res && res.total) != null ? res.total : items.length;
        countEl.textContent = total > 0 ? (total + " 条评论") : "暂无评论，来抢沙发吧～";
        items.forEach(function (it) { listEl.appendChild(commentNode(it)); });
        var hasNext = res && (res.hasNext != null ? res.hasNext : (res.page + 1 < res.totalPages));
        moreWrap.hidden = !hasNext; if (hasNext) page += 1;
      }).catch(function (e) { stateEl.textContent = "评论加载失败：" + (e && e.message ? e.message : "请稍后重试"); console.error("[moe-comment] 列表加载失败：", e); });
    }
    moreBtn.addEventListener("click", load);
    load();
  }
  function boot() { document.querySelectorAll("#moe-comment[data-name]").forEach(init); }
  boot.mount = init;
  window.MoesoraComment = boot;
  if (document.readyState !== "loading") boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
