/* =====================================================================
 * 教师题目修正层（在 bank-gate.js 之后、app.js / pk-app.js / arena-app.js 之前执行）
 * ---------------------------------------------------------------------
 * 场景：做题时发现某题题干 / 选项 / 答案有误，老师在答题页点「✏️ 修正」，
 *       输入教师密码后在模态框里改，保存即生效。
 * 存储：localStorage['xkc.qoverrides.v1']，按【原 qid】存覆盖字段。
 *       src/data.js 真源一字不改，构建产物不需要重新生成。
 * 关键：修正会挂 _origQid（原 qid）；engine.qidOf 优先返回它，
 *       所以「改题干」不会改变 qid，学生历史作答 / 错题本 / 备课夹零断链。
 * 作用范围：window.BANK_ALL 里的原对象就地合并覆盖，因此所有档位视图、
 *       刷题 / 模拟考 / 诊断 / 错题本 / PK / 擂台 / 备课夹同步生效（同一对象引用）。
 * 限制：修正存本机，不自动同步到其它设备或云端；提供导出 / 导入 JSON 迁移。
 * 密码：只放哈希常量，不放明文；前端校验只能防误触，不是真正的访问控制。
 * ===================================================================== */
(function () {
  'use strict';
  var root = window;
  var STORE_KEY = 'xkc.qoverrides.v1';
  var PWD_HASH = 998481989;
  var XK = root.XK;
  var store = Object.create(null);
  var orig = Object.create(null);
  var loaded = false;

  function pwdHash(s) {
    var h = 2166136261;
    s = String(s == null ? '' : s);
    for (var r = 0; r < 64; r++) {
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
    }
    return h >>> 0;
  }
  function checkPwd(s) { return pwdHash(s) === PWD_HASH; }
  function cloneOpts(o) {
    return (o || []).map(function (x) { return [String(x[0]), String(x[1] == null ? '' : x[1])]; });
  }
  function snapshot(q) {
    return { s: q.s, o: cloneOpts(q.o), a: q.a, e: q.e, t: q.t };
  }
  function sanitize(p) {
    var out = {};
    if (!p || typeof p !== 'object') return out;
    if (typeof p.s === 'string') out.s = p.s;
    if (Array.isArray(p.o)) {
      out.o = p.o.filter(function (x) { return Array.isArray(x) && x.length >= 2 && x[0]; })
        .map(function (x) { return [String(x[0]).slice(0, 4), String(x[1] == null ? '' : x[1])]; });
    }
    if (typeof p.a === 'string') out.a = p.a.replace(/[^A-Z√×]/g, '').slice(0, 8);
    if (typeof p.e === 'string') out.e = p.e;
    if (typeof p.t === 'string') out.t = p.t;
    return out;
  }
  function load() {
    store = Object.create(null);
    try {
      var raw = root.localStorage && localStorage.getItem(STORE_KEY);
      var j = raw ? JSON.parse(raw) : null;
      if (j && j.items && typeof j.items === 'object') {
        Object.keys(j.items).forEach(function (qid) {
          var p = sanitize(j.items[qid]);
          if (Object.keys(p).length) store[qid] = p;
        });
      }
    } catch (e) { store = Object.create(null); }
    loaded = true;
    return store;
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, items: store }));
      return true;
    } catch (e) { return false; }
  }
  function qid(q) { return (q && q._origQid) || XK.qidOf(q); }
  function applyOne(q) {
    if (!q) return q;
    var id = (q && q._origQid) || XK.qidOf(q);
    if (!orig[id]) orig[id] = snapshot(q);
    var b = orig[id], p = store[id];
    // 先恢复原值再套覆盖，保证重复 apply 幂等、可恢复原题
    q.s = b.s; q.o = cloneOpts(b.o); q.a = b.a; q.e = b.e; q.t = b.t;
    q._origQid = id;
    if (p) {
      if (p.s !== undefined) q.s = p.s;
      if (p.o !== undefined) q.o = cloneOpts(p.o);
      if (p.a !== undefined) q.a = p.a;
      if (p.e !== undefined) q.e = p.e;
      if (p.t !== undefined) q.t = p.t;
    }
    return q;
  }
  function applyTo(arr) {
    if (!Array.isArray(arr)) return arr;
    if (!loaded) load();
    (root.BANK_ALL || []).forEach(function (q) {
      var id = XK.qidOf(q);
      if (!orig[id]) orig[id] = snapshot(q);
    });
    arr.forEach(applyOne);
    return arr;
  }
  // 就地改原对象（不换数组），所有持有引用的模块立即看到修正
  function refresh() {
    applyTo(root.BANK_ALL || root.BANK);
    applyTo(root.BANK);
    return root.BANK;
  }
  function set(id, patch) {
    if (!id) return false;
    var p = sanitize(patch);
    if (!Object.keys(p).length) return false;
    store[id] = p;
    var ok = save();
    refresh();
    return ok;
  }
  function remove(id) {
    if (!id || !store[id]) return false;
    delete store[id];
    var ok = save();
    refresh();
    return ok;
  }
  function exportText() {
    return JSON.stringify({ v: 1, title: '学考冲刺通 · 教师题目修正', count: Object.keys(store).length, items: store }, null, 2);
  }
  function importText(text) {
    var j;
    try { j = JSON.parse(text); } catch (e) { return { ok: false, count: 0, err: '不是合法 JSON' }; }
    if (!j || !j.items || typeof j.items !== 'object') return { ok: false, count: 0, err: '缺少 items 字段' };
    var n = 0;
    Object.keys(j.items).forEach(function (qid) {
      var p = sanitize(j.items[qid]);
      if (Object.keys(p).length) { store[qid] = p; n++; }
    });
    save();
    refresh();
    return { ok: true, count: n, err: '' };
  }

  root.XK_QOVER = {
    checkPwd: checkPwd,
    load: load,
    save: save,
    refresh: refresh,
    applyTo: applyTo,
    set: set,
    remove: remove,
    get: function (id) { return store[id] || null; },
    has: function (id) { return !!store[id]; },
    count: function () { return Object.keys(store).length; },
    qid: qid,
    exportText: exportText,
    importText: importText
  };
  refresh();
})();
