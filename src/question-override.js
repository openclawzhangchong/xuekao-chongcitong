/* =====================================================================
 * 教师题目修正与删除层（在 bank-gate.js 之后、app.js / pk-app.js / arena-app.js 之前执行）
 * ---------------------------------------------------------------------
 * 【修正】做题时发现题干 / 选项 / 答案有误，点「✏️ 修正本题」输密码后改。
 *   存储：localStorage['xkc.qoverrides.v1']，按【原 qid】存覆盖字段。
 *   关键：修正会挂 _origQid（原 qid）；engine.qidOf 优先返回它，
 *         所以「改题干」不会改变 qid，学生历史作答 / 错题本 / 备课夹零断链。
 *   作用范围：window.BANK_ALL 里的原对象就地合并，所有档位视图 / 各业务模块
 *         共享同一对象引用，因此同步生效。
 *
 * 【删除】题目有硬伤、不想再让学生练到，点「🗑 删除本题」输密码后隐藏。
 *   存储：localStorage['xkc.qdeleted.v1']，按【原 qid】存删除标记 + 题干摘要。
 *   铁律：绝不改动 window.BANK_ALL 数组的长度或顺序！
 *         三档白名单（XK_TIER_INDEX）存的是 BANK_ALL 的【下标】，一旦 splice
 *         会全档错位。删除只是在构造 window.BANK 视图时过滤掉这些题，
 *         原对象仍留在 BANK_ALL 里（真源一题不删、qid 不变、可随时恢复）。
 *   apply() 就地同步 window.BANK 数组内容（不换引用），因为 app.js 缓存了该引用。
 *
 * 限制：修正与删除都只存本机，不自动同步到其它设备或云端；各自提供导出 / 导入。
 * 密码：只放哈希常量，不放明文；前端校验只能防误触，不是真正的访问控制。
 * ===================================================================== */
(function () {
  'use strict';
  var root = window;
  var STORE_KEY = 'xkc.qoverrides.v1';
  var DEL_KEY = 'xkc.qdeleted.v1';
  var PWD_HASH = 998481989;
  var XK = root.XK;
  var store = Object.create(null);
  var orig = Object.create(null);
  var loaded = false;
  var delStore = Object.create(null);
  var delLoaded = false;

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

  /* ==================== 删除层：本机隐藏标记（不碰 BANK_ALL） ==================== */
  function validQid(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 64 && !/[\r\n<>]/.test(id);
  }
  function loadDel() {
    delStore = Object.create(null);
    try {
      var raw = root.localStorage && localStorage.getItem(DEL_KEY);
      var j = raw ? JSON.parse(raw) : null;
      if (j && j.items && typeof j.items === 'object') {
        Object.keys(j.items).forEach(function (id) {
          if (!validQid(id)) return;
          var it = j.items[id] || {};
          delStore[id] = {
            s: typeof it.s === 'string' ? it.s.slice(0, 120) : '',
            m: typeof it.m === 'string' ? it.m.slice(0, 8) : '',
            at: Number(it.at) || 0
          };
        });
      }
    } catch (e) { delStore = Object.create(null); }
    delLoaded = true;
    return delStore;
  }
  function saveDel() {
    try {
      localStorage.setItem(DEL_KEY, JSON.stringify({
        v: 1, title: '学考冲刺通 · 教师删除题目清单',
        count: Object.keys(delStore).length, items: delStore
      }));
      return true;
    } catch (e) { return false; }
  }
  function ensureDel() { if (!delLoaded) loadDel(); return delStore; }
  function isDeleted(id) { return !!ensureDel()[id]; }
  function deletedCount() { return Object.keys(ensureDel()).length; }
  // 供 bank-gate.bankOf / guard 调用：只过滤视图，绝不改 BANK_ALL
  function filter(arr) {
    if (!Array.isArray(arr) || !deletedCount()) return arr;
    return arr.filter(function (q) { return !delStore[qid(q)]; });
  }
  // 视图重建：gate.apply() 就地同步 window.BANK，app.js 持有的数组引用不断
  function rebuildView() {
    var G = root.XK_BANK_GATE;
    if (G && G.apply) G.apply();
    return root.BANK;
  }
  function del(id, info) {
    if (!validQid(id)) return false;
    ensureDel();
    info = info || {};
    delStore[id] = {
      s: typeof info.s === 'string' ? info.s.slice(0, 120) : '',
      m: typeof info.m === 'string' ? info.m.slice(0, 8) : '',
      at: Date.now()
    };
    var ok = saveDel();
    rebuildView();
    return ok;
  }
  function undel(id) {
    if (!isDeleted(id)) return false;
    delete delStore[id];
    var ok = saveDel();
    rebuildView();
    return ok;
  }
  function delList() {
    return Object.keys(ensureDel()).map(function (id) {
      var it = delStore[id];
      return { qid: id, s: it.s, m: it.m, at: it.at };
    }).sort(function (a, b) { return b.at - a.at; });
  }
  function delExportText() {
    return JSON.stringify({
      v: 1, title: '学考冲刺通 · 教师删除题目清单',
      count: deletedCount(), items: delStore
    }, null, 2);
  }
  function delImportText(text) {
    var j;
    try { j = JSON.parse(text); } catch (e) { return { ok: false, count: 0, err: '不是合法 JSON' }; }
    if (!j || !j.items || typeof j.items !== 'object') return { ok: false, count: 0, err: '缺少 items 字段' };
    ensureDel();
    var n = 0;
    Object.keys(j.items).forEach(function (id) {
      if (!validQid(id)) return;
      var it = j.items[id] || {};
      delStore[id] = {
        s: typeof it.s === 'string' ? it.s.slice(0, 120) : '',
        m: typeof it.m === 'string' ? it.m.slice(0, 8) : '',
        at: Number(it.at) || Date.now()
      };
      n++;
    });
    saveDel();
    rebuildView();
    return { ok: true, count: n, err: '' };
  }

  root.XK_QDEL = {
    checkPwd: checkPwd,
    qid: qid,
    filter: filter,
    del: del,
    undel: undel,
    has: isDeleted,
    count: deletedCount,
    list: delList,
    load: loadDel,
    save: saveDel,
    exportText: delExportText,
    importText: delImportText,
    rebuildView: rebuildView
  };

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
  refresh();       // 先给 BANK_ALL 挂 _origQid 并套用本机修正
  rebuildView();   // 再按删除清单重建 BANK 视图（此时 qid 已稳定）
})();
