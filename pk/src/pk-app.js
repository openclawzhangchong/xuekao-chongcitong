/* =====================================================================
 * 双人课堂 PK 答题 · 应用逻辑
 * 存储适配层：localStorage 实现（D1 预留同接口，见 Store 注释）
 * ===================================================================== */
/* ================= 课堂数据落盘同步（本地数据库） =================
 * 班级版服务在跑（http 且 /api/hello=class 且非云端模式）时：PK 战绩/擂台战绩/备课夹
 * 推送到 data/classroom.json（按 section 时间戳合并，服务端 .bak 滚动备份），页面加载即
 * 拉取合并恢复——浏览器 localStorage 只是缓存，清了也能从服务端恢复。
 * file://、无服务、云端模式（worker 无该端点）：静默跳过，行为与旧版完全一致。
 * 擂台/备课夹经 window.__CLASSROOM_SYNC.mark('arena'|'prep') 复用同一通道；
 * 拉取在页面加载即发生（早于 __PK_MOUNT），挂载后读到的已是合并结果。 */
var CSYNC = {
  on: false, timer: null,
  KEYS: { matches: 'pk.matches', arena: 'pk.arena.v1', prep: 'xkc.prep.v1' },
  get: function (k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  stamps: function () { return this.get('pk.csync', {}) || {}; },
  mark: function (name) {
    try {
      var s = this.stamps(); s[name] = Date.now();
      this.set('pk.csync', s);
      if (this.on) this.schedule();
    } catch (e) { }
  },
  schedule: function () {
    var self = this;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(function () { self.push(); }, 1500);
  },
  snapshot: function (names) {
    var out = { updated: Date.now(), sections: {} }, st = this.stamps();
    for (var i = 0; i < names.length; i++) {
      var n = names[i], data = this.get(this.KEYS[n], null);
      if (data === null || data === undefined) continue;
      out.sections[n] = { ts: st[n] || 0, data: data };
    }
    return out;
  },
  push: function (names) {
    if (!this.on) return;
    names = names || ['matches', 'arena', 'prep'];
    try {
      fetch('/api/classroom', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.snapshot(names))
      }).catch(function () { });
    } catch (e) { }
  },
  pull: function () {
    if (!this.on) return;
    var self = this;
    try {
      fetch('/api/classroom').then(function (r) { return r.json(); }).then(function (j) {
        var sec = (j && j.sections) || {}, st = self.stamps(), changed = false;
        Object.keys(sec).forEach(function (n) {
          var s = sec[n];
          if (!s || typeof s.ts !== 'number' || s.data === undefined) return;
          if ((st[n] || 0) >= s.ts) return;            // 本地不比服务端旧，不动
          if (n === 'matches' && Object.prototype.toString.call(s.data) === '[object Array]') {
            // 战绩并集去重（本地 + 服务端新增），按时间降序，上限 500
            var local = self.get(self.KEYS[n], []) || [], seen = {}, all = [];
            var key = function (m) {
              return (m.ts || 0) + '|' + ((m.left || {}).sid || '') + '|' + ((m.right || {}).sid || '') +
                '|' + ((m.left || {}).score || 0) + '/' + ((m.right || {}).score || 0);
            };
            local.concat(s.data).forEach(function (m) {
              if (!m || typeof m !== 'object') return;
              var k = key(m);
              if (!seen[k]) { seen[k] = 1; all.push(m); }
            });
            all.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
            self.set(self.KEYS[n], all.slice(0, 500));
          } else {
            self.set(self.KEYS[n], s.data);
          }
          st[n] = s.ts; changed = true;
        });
        if (changed) {
          self.set('pk.csync', st);
          try { window.__PK_REFRESH && window.__PK_REFRESH(); } catch (e) { }
        }
      }).catch(function () { });
    } catch (e) { }
  },
  init: function () {
    try {
      if (location.protocol === 'file:') return;
      var self = this;
      fetch('/api/hello').then(function (r) { return r.json(); }).then(function (j) {
        // 云端模式（worker 带 label:'cloud'）没有 /api/classroom，不激活
        if (!j || j.mode !== 'class' || j.label === 'cloud') return;
        self.on = true;
        self.pull();
      }).catch(function () { });
    } catch (e) { }
  }
};
window.__CLASSROOM_SYNC = {
  mark: function (n) { CSYNC.mark(n); },
  pull: function () { CSYNC.pull(); }
};
CSYNC.init();

/* 内置班级花名册（25 计算机 01 班）：PK 花名册缺省 + 首页课堂互动点名名单缺省共用
 * 单一数据源：改名单改这里（或 PK 管理花名册后保存到 pk.roster） */
window.XK_DEFAULT_ROSTER = [
    { sid: '2025001', name: '陈博杰' },
    { sid: '2025002', name: '陈嘉伟' },
    { sid: '2025003', name: '陈凯棋' },
    { sid: '2025004', name: '陈晓璐' },
    { sid: '2025005', name: '陈羽韩' },
    { sid: '2025006', name: '陈紫欣' },
    { sid: '2025007', name: '程伟杰' },
    { sid: '2025008', name: '邓志' },
    { sid: '2025009', name: '何静' },
    { sid: '2025010', name: '黄凯杰' },
    { sid: '2025011', name: '黄晓伟' },
    { sid: '2025012', name: '李航' },
    { sid: '2025013', name: '林静静' },
    { sid: '2025014', name: '林烨凯' },
    { sid: '2025015', name: '林泽豪' },
    { sid: '2025016', name: '林志灵' },
    { sid: '2025017', name: '凌峰' },
    { sid: '2025018', name: '刘晨希' },
    { sid: '2025019', name: '刘椿尧' },
    { sid: '2025020', name: '刘智伟' },
    { sid: '2025021', name: '倪皓轩' },
    { sid: '2025022', name: '沈金龙' },
    { sid: '2025023', name: '宋海龙' },
    { sid: '2025024', name: '宋政烨' },
    { sid: '2025025', name: '王依晨' },
    { sid: '2025026', name: '翁晨辉' },
    { sid: '2025027', name: '谢志豪' },
    { sid: '2025028', name: '颜琦镔' },
    { sid: '2025029', name: '叶睿晨' },
    { sid: '2025030', name: '游子鹏' },
    { sid: '2025031', name: '张亿乐' },
    { sid: '2025032', name: '赵伟坤' },
    { sid: '2025033', name: '郑杨鸿' },
    { sid: '2025034', name: '郑子添' },
    { sid: '2025035', name: '朱炫杰' },
    { sid: '2025036', name: '朱紫寒' }
  ];

window.__PK_MOUNT = function () {
  'use strict';
  if (window.__PK_MOUNTED) { window.__PK_REFRESH && window.__PK_REFRESH(); return; }
  window.__PK_MOUNTED = true;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ================= 存储适配层 =================
   * 页面逻辑只调用 Store.*，不直接触碰存储介质。
   * 现实现：localStorage。后续迁移 D1 时，实现同接口的
   * CloudflareStore（fetch /api/...）并 Store.use(CloudflareStore) 即可，
   * 页面逻辑零改动。
   * ============================================== */
  var LocalStore = {
    name: 'localStorage',
    load: function (key, fallback) {
      try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    save: function (key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { } }
  };
  /* D1 预留实现（接口签名与 LocalStore 完全一致，均为异步）：
  var CloudflareStore = {
    name: 'd1',
    load: function (key, fb) { return fetch('/api/kv/' + key).then(r => r.json()).catch(() => fb); },
    save: function (key, val) { return fetch('/api/kv/' + key, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(val) }); }
  };
  */
  var Store = {
    use: function (impl) { this.impl = impl; },
    load: function (key, fb) { return this.impl.load(key, fb); },
    save: function (key, val) { return this.impl.save(key, val); },
    impl: LocalStore
  };

  /* ================= 默认班级（首次打开自动载入） ================= */
  var DEFAULT_CLASS_NAME = '25计算机01班';
  var DEFAULT_ROSTER = window.XK_DEFAULT_ROSTER;


  var K_ROSTER = 'pk.roster', K_MATCHES = 'pk.matches', K_CFG = 'pk.cfg';

  /* ================= 题库三通道 ================= */
  var BANK = (window.BANK || []).slice(); // 通道①：内嵌
  function bankInfo() {
    var base = BANK.length + ' 题' + (window.BANK_VER ? '（' + window.BANK_VER + '）' : '');
    var pool = bankPool();
    if (pool.length === BANK.length) return base + ' · 全库';
    return base + ' · 已选 ' + selectedModCount() + ' 章 ' + pool.length + ' 题';
  }
  function setBank(arr, from) {
    if (!Array.isArray(arr) || !arr.length) throw new Error('题库为空或格式不对');
    arr.forEach(function (q, i) {
      if (!q.s || !q.o || !q.a) throw new Error('第 ' + (i + 1) + ' 题缺少 s/o/a 字段');
    });
    BANK = arr;
    toast('题库已切换：' + bankInfo() + '（来源：' + from + '）');
  }
  // 通道②：fetch 线上 JSON
  function fetchBank(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { setBank(Array.isArray(j) ? j : (j.bank || j.BANK), '线上题库' + (j.ver ? ' ' + j.ver : '')); renderHome(); })
      .catch(function (e) { toast('拉取失败：' + e.message); });
  }
  // 通道③：粘贴 JSON
  function pasteBank(text) {
    try { setBank(JSON.parse(text), '粘贴'); renderHome(); }
    catch (e) { toast('粘贴内容不是合法 JSON'); }
  }

  /* ================= 配置 ================= */
  // 题库地址：默认同源 /api/bank（班级版/云端版都有）；纯静态打开时回退线上主站
  var DEFAULT_BANK_URL = (function () {
    try {
      if (location.protocol === 'file:') return 'https://xuekao.jiuyeke.cn/api/bank';
      return location.origin + '/api/bank';
    } catch (e) { return 'https://xuekao.jiuyeke.cn/api/bank'; }
  })();

  var CFG = Store.load(K_CFG, { count: 10, minutes: 10 });
  if (CFG.source !== 'prep') CFG.source = 'bank';   // 题源：bank=全库随机 / prep=备课夹按勾选顺序
  function saveCfg() { Store.save(K_CFG, CFG); }

  /* ================= 章节过滤 =================
   * CFG.mods 缺失 = 不过滤，等于本功能上线前的抽题范围。
   * 没有 m 字段的题（教师用「粘贴 JSON」导入的自定义题库）永远保留，
   * 否则切到自定义题库会被 9 个内置章节码清空。
   * ============================================ */
  function modCodes() {
    var out = [];
    (window.BANK_META || []).forEach(function (m) { if (m && m.code) out.push(m.code); });
    return out;
  }
  function poolOf(sel) { return window.XK.bankPool(BANK, sel); }
  function bankPool() { return poolOf(CFG.mods); }
  function selectedModCount() {
    var codes = modCodes(), n = 0;
    for (var i = 0; i < codes.length; i++) if (!CFG.mods || CFG.mods[codes[i]] !== false) n++;
    return n;
  }
  function modCountOf(code) {
    var n = 0;
    for (var i = 0; i < BANK.length; i++) if (BANK[i].m === code) n++;
    return n;
  }

  /* ================= 花名册 ================= */
  var ROSTER = Store.load(K_ROSTER, null);
  if (!Array.isArray(ROSTER)) {
    // 首次使用：载入内置默认班级
    ROSTER = DEFAULT_ROSTER.slice();
    Store.save(K_ROSTER, ROSTER);
  }
  function saveRoster() { Store.save(K_ROSTER, ROSTER); }
  function parseRoster(text) {
    var out = [], seen = {};
    String(text || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      var p = line.split(/[,，\t ]+/);
      var name = (p[p.length - 1] || '').trim(), sid = p.length > 1 ? p.slice(0, -1).join('').trim() : '';
      if (!name || name.length > 24 || seen[name]) return;
      seen[name] = 1;
      out.push({ sid: sid, name: name });
    });
    return out;
  }

  /* ================= 比赛记录 ================= */
  var MATCHES = Store.load(K_MATCHES, []);
  function saveMatch(m) { MATCHES.push(m); Store.save(K_MATCHES, MATCHES.slice(-500)); CSYNC.mark('matches'); }


  /* ================= 音效 & TTS ================= */
  var sndOn = Store.load('pk.snd', true);
  var AC = null;
  function ac() {
    if (!sndOn) return null;
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (AC.state === 'suspended') { try { AC.resume(); } catch (e) { } }
    return AC;
  }
  function tone(f, start, dur, type, vol) {
    var c = ac(); if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'triangle'; o.frequency.setValueAtTime(f, c.currentTime + start);
      g.gain.setValueAtTime(0.0001, c.currentTime + start);
      g.gain.exponentialRampToValueAtTime(vol || 0.18, c.currentTime + start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
    } catch (e) { }
  }
  var SFX = {
    correct: function () { if (!sndOn) return; [523.25, 659.25, 783.99].forEach(function (f, i) { tone(f, i * 0.08, 0.15, 'triangle', 0.2); }); },
    wrong: function () { if (!sndOn) return; tone(311.13, 0, 0.15, 'sine', 0.14); tone(233.08, 0.13, 0.24, 'sine', 0.13); },
    finish: function () { if (!sndOn) return; [392, 523.25, 659.25, 783.99].forEach(function (f, i) { tone(f, i * 0.1, 0.28, 'triangle', 0.18); }); tone(1046.5, 0.44, 0.5, 'triangle', 0.2); },
    unlock: function () { ac(); }
  };
  // TTS：随机中文音色（沿用学考冲刺通的音色策略）
  function zhVoices() {
    if (!('speechSynthesis' in window)) return [];
    return speechSynthesis.getVoices().filter(function (v) { return /^zh/i.test(v.lang); });
  }
  function tts(text, cb) {
    if (!sndOn || !('speechSynthesis' in window)) { if (cb) cb(); return; }
    try {
      speechSynthesis.cancel();
      var vs = zhVoices();
      var u = new SpeechSynthesisUtterance(text);
      if (vs.length) u.voice = vs[Math.floor(Math.random() * vs.length)]; // 每次随机音色
      u.lang = 'zh-CN'; u.rate = 1.1;
      if (cb) u.onend = cb;
      speechSynthesis.speak(u);
    } catch (e) { if (cb) cb(); }
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = function () { };

  function toast(msg) {
    var t = $('pkToast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ================= 背景音乐（教师自备文件夹轮播） =================
   * 两种来源：①班级版服务 music/ 文件夹（/api/music 歌单，永久生效）
   *          ②「⚙️ 设置」里临时选本地文件夹（webkitdirectory，本次会话有效）
   * 对战进行中循环轮换；TTS 播报自动压低到 20%；默认关闭、设置记忆。 */
  var BGM = {
    cfg: Store.load('pk.bgm', { on: false, vol: 0.5 }) || { on: false, vol: 0.5 },   // 默认 50%，教师可调
    audio: null, urls: [], names: [], idx: 0,
    init: function () {
      var self = this;
      this.audio = document.getElementById('bgmAudio');
      if (!this.audio) {
        this.audio = document.createElement('audio');
        this.audio.id = 'bgmAudio';
        document.body.appendChild(this.audio);
      }
      this.audio.volume = this.vol();
      this.audio.addEventListener('ended', function () { self.next(); });
      setInterval(function () { self.duck(); }, 500);
      if (location.protocol !== 'file:') {
        try {
          fetch('/api/music').then(function (r) { return r.json(); }).then(function (j) {
            if (j && j.ok && j.files && j.files.length && !self.urls.length) {
              self.setList(j.files.map(function (n) { return '/music/' + encodeURIComponent(n); }), j.files);
            }
          }).catch(function () { });
        } catch (e) { }
      }
      this.render();
    },
    vol: function () { var v = parseFloat(this.cfg.vol); return isNaN(v) ? 0.35 : Math.max(0, Math.min(1, v)); },
    duck: function () {
      if (!this.audio) return;
      var speaking = false;
      try { speaking = window.speechSynthesis && speechSynthesis.speaking; } catch (e) { }
      this.audio.volume = this.vol() * (speaking ? 0.2 : 1);
    },
    setList: function (urls, names) {
      this.urls = urls || []; this.names = names || []; this.idx = 0;
      if (this.cfg.on) this.play();
      this.render();
    },
    play: function () {
      if (!this.audio || !this.urls.length) return;
      this.audio.src = this.urls[this.idx];
      var p = this.audio.play();
      if (p && p.catch) p.catch(function () { });   // 无音频设备/自动播放限制：静默
    },
    stop: function () { if (this.audio) this.audio.pause(); },
    next: function () {
      if (!this.urls.length) return;
      this.idx = (this.idx + 1) % this.urls.length;
      if (this.cfg.on) this.play();
      this.render();
    },
    toggle: function () {
      this.cfg.on = !this.cfg.on;
      Store.save('pk.bgm', this.cfg);
      if (this.cfg.on) {
        if (!this.urls.length) {
          this.cfg.on = false; Store.save('pk.bgm', this.cfg);
          toast('还没有歌单：放 mp3 进班级版服务 music/ 文件夹，或在「⚙️ 设置」里选本地文件夹');
        } else this.play();
      } else this.stop();
      this.render();
    },
    pickFolder: function () { var inp = $('bgmDir'); if (inp) inp.click(); },
    onDirPick: function (files) {
      var okExt = ['.mp3', '.wav', '.m4a', '.ogg', '.flac'];
      var urls = [], names = [];
      Array.prototype.forEach.call(files || [], function (f) {
        var n = (f.name || '').toLowerCase();
        for (var i = 0; i < okExt.length; i++) {
          if (n.slice(-okExt[i].length) === okExt[i]) {
            urls.push(URL.createObjectURL(f)); names.push(f.name); break;
          }
        }
      });
      if (!urls.length) { toast('文件夹里没有 mp3/wav 等音频文件'); return; }
      this.setList(urls, names);
      toast('歌单 ' + urls.length + ' 首（本次会话有效；要永久生效就把文件放进班级版服务 music/ 文件夹）');
    },
    setVol: function (v) { this.cfg.vol = Math.max(0, Math.min(1, v)); Store.save('pk.bgm', this.cfg); if (this.audio) this.audio.volume = this.vol(); },
    render: function () {
      var t = $('bgmToggle');
      if (t) t.textContent = this.cfg.on ? '🎵 音乐开' : '🎵 音乐关';
      var s = $('bgmStat');
      if (s) s.textContent = this.urls.length
        ? ('歌单 ' + this.urls.length + ' 首 · 当前第 ' + (this.idx + 1) + ' 首' + (this.names[this.idx] ? '：' + this.names[this.idx] : ''))
        : '未选文件夹';
      var v = $('bgmVol'); if (v && document.activeElement !== v) v.value = Math.round(this.vol() * 100);
    }
  };

  /* ================= PK 状态机 =================  /* ================= PK 状态机 ================= */
  // state: idle → running → finished
  var PK = {
    state: 'idle',
    left: null, right: null,   // {sid,name,seq:[题索引],idx,score,streak,answered:[],locked}
    durationSec: 600, leftTs: 0,
    timerId: null, leftSec: 0
  };
  function sideObj(side, sid, name) { return { side: side, sid: sid, name: name, seq: [], idx: 0, score: 0, streak: 0, answered: [], locked: false, done: false }; }

  function normAns(a) { var s = (a == null ? '' : String(a)).trim().toUpperCase(); return (s === '√' || s === '×') ? s : s.split('').sort().join(''); }
  function isCorrect(q, sel) {
    if (!sel || !sel.length) return false;
    return sel.slice().map(normAns).sort().join('') === normAns(q.a);
  }
  function shuffled(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function prepList() { return CSYNC.get('xkc.prep.v1', []) || []; }
  function renderPrepSource() {
    var prep = prepList(), isPrep = CFG.source === 'prep';
    var b1 = $('pkSrcBank'), b2 = $('pkSrcPrep'), c = $('pkPrepCount');
    if (b1) b1.classList.toggle('on', !isPrep);
    if (b2) b2.classList.toggle('on', isPrep);
    if (c) c.textContent = '备课夹 ' + prep.length + ' 题' + (isPrep && prep.length ? '（按勾选顺序出题）' : '');
  }
  /* 换一题：跳过当前题，双方同步换成一库名新题（备课夹题量不变，只影响本场） */
  function changeCurrentQ() {
    if (PK.state !== 'running') return;
    if ((PK.left.locked && !PK.left.done) || (PK.right.locked && !PK.right.done)) { toast('当前题已提交，先点「下一题」再换'); return; }
    var used = {}, XK = window.XK;
    [PK.left, PK.right].forEach(function (P) {
      (P.seq || []).forEach(function (q, i) { if (i !== P.idx) used[XK.qidOf(q)] = 1; });
    });
    var fresh = null;
    for (var t = 0; t < 60 && !fresh; t++) {
      var q = BANK[Math.floor(Math.random() * BANK.length)];
      if (q && !used[XK.qidOf(q)]) fresh = q;
    }
    if (!fresh) { toast('换题失败：题库都被用完了'); return; }
    [PK.left, PK.right].forEach(function (P) {
      if (P.done || P.idx >= P.seq.length) return;
      P.seq[P.idx] = fresh;
      delete P.answered[P.idx];
      renderSide(P.side);
    });
    tts('换一题');
  }
  /* 舞台键盘快答：左侧 A–F 选 + 回车提交；右侧 1–6 选 + 空格提交 */
  function stageKeys(e) {
    if (PK.state !== 'running') return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    var k = (e.key || '').toLowerCase();
    var L = PK.left, R = PK.right;
    if (!L || !R) return;
    function optAt(q, i) { return (q && q.o && i >= 0 && i < q.o.length) ? q.o[i][0] : null; }
    if (k === 'enter') {
      if (!L.locked && !L.done) { var b = $('LSubmit'); if (b && !b.disabled) { b.click(); e.preventDefault(); } }
      return;
    }
    if (k === ' ') {
      if (!R.locked && !R.done) { var b2 = $('rSubmit'); if (b2 && !b2.disabled) { b2.click(); e.preventDefault(); } }
      return;
    }
    var iL = 'abcdef'.indexOf(k);
    if (iL >= 0 && !L.locked && !L.done) {
      var kl = optAt(L.seq[L.idx], iL);
      if (kl) { pickOpt('L', kl); e.preventDefault(); return; }
    }
    var iR = '123456'.indexOf(k);
    if (iR >= 0 && !R.locked && !R.done) {
      var kr = optAt(R.seq[R.idx], iR);
      if (kr) { pickOpt('r', kr); e.preventDefault(); return; }
    }
  }
  function pickQuestions(n) {
    if (CFG.source === 'prep') {
      var r = window.XK.resolvePrep(BANK, prepList());
      if (r.list.length) return r.list.slice(0, n);   // 备课夹：按勾选顺序出题
    }
    return window.XK.pickFromBank(BANK, CFG.mods, n);
  }

  /* ================= 渲染：首页/选人 =================
   * option 的 value 用花名册下标：sid 允许为空（批量导入只填姓名），
   * 若用 sid 当值会与占位符的空串撞车——无编号的学生既进不了下拉、也选不中。
   * 已选学生用 pickL/pickR 持有花名册里的对象引用，花名册增删后按下标重新定位。
   * =============================================== */
  var pickL = null, pickR = null;
  function studentOfSelect(sel) {
    var at = parseInt(sel.value, 10);
    return isNaN(at) ? null : (ROSTER[at] || null);
  }
  function rebind(student) {
    if (!student) return null;
    for (var i = 0; i < ROSTER.length; i++) {
      if (ROSTER[i] === student) return student;
      if (ROSTER[i].sid === student.sid && ROSTER[i].name === student.name) return ROSTER[i];
    }
    return null;
  }
  function fillSelect(sel, exclude, keep) {
    sel.innerHTML = '<option value="">— 选择选手 —</option>';
    ROSTER.forEach(function (s, i) {
      if (s === exclude) return; // 两侧不能同一个人
      var o = document.createElement('option');
      o.value = String(i); o.textContent = (s.sid ? s.sid + ' · ' : '') + s.name;
      sel.appendChild(o);
    });
    var at = keep ? ROSTER.indexOf(keep) : -1;
    sel.value = at >= 0 ? String(at) : '';
  }
  function renderHome() {
    $('bankInfo').textContent = '题库：' + bankInfo();
    renderPrepSource();
    pickL = rebind(pickL); pickR = rebind(pickR);
    if (pickL && pickL === pickR) pickR = null; // 以左为准
    fillSelect($('pkSelL'), pickR, pickL);
    fillSelect($('pkSelR'), pickL, pickR);
    $('pkCfgCount').value = CFG.count;
    $('pkCfgMinutes').value = CFG.minutes;
    renderModBox();
  }

  /* ================= 随机匹配 =================
   * 只把人填进两侧下拉并播报，不开赛：上台、讲两句、维持纪律的时机留给教师。
   * ============================================ */
  function randomMatch() {
    if (PK.state === 'running') { toast('本轮进行中，先点「重置新一轮」再换人'); return; }
    if (ROSTER.length < 2) { toast('花名册至少需要 2 人才能随机匹配'); return; }
    var idx = shuffled(ROSTER.length);
    pickL = ROSTER[idx[0]]; pickR = ROSTER[idx[1]];
    renderHome();
    toast('已随机匹配：' + pickL.name + ' vs ' + pickR.name);
    tts('请' + pickL.name + '、' + pickR.name + '上台对战！');
  }

  /* ================= 开始 PK ================= */
  /* 对战中把「选人」那一行折叠掉：45px 全还给题面（投屏实测最长题就差这几行）。
   * 下拉在开赛后本来就不生效（要换人得先「重置新一轮」），留着只是占高度。 */
  function syncStageClass() {
    document.body.classList.toggle('pk-running', PK.state === 'running');
  }

  function startPK() {
    var L = studentOfSelect($('pkSelL')), R = studentOfSelect($('pkSelR'));
    if (!L || !R) { toast('请先选择左右两名选手'); return; }
    if (L === R) { toast('左右不能是同一个人，请重选'); return; }
    SFX.unlock();
    CFG.count = Math.max(1, Math.min(50, parseInt($('pkCfgCount').value, 10) || 10));
    CFG.minutes = Math.max(1, Math.min(60, parseInt($('pkCfgMinutes').value, 10) || 10));
    saveCfg();
    var qs = pickQuestions(CFG.count);
    if (!qs.length) { toast(CFG.source === 'prep' ? '备课夹是空的：先去首页「📋 备课夹」勾题，或把题源切回全库' : '没有勾中任何题目，请在「开赛设置」里勾上出题章节'); return; }
    if (qs.length < CFG.count) { toast((CFG.source === 'prep' ? '备课夹只有 ' : '所选章节只有 ') + qs.length + ' 题，本轮按 ' + qs.length + ' 题进行'); }
    PK.left = sideObj('L', L.sid, L.name); PK.right = sideObj('r', R.sid, R.name);
    // seq 存题目对象本身。早先存的是 BANK 下标 0..n-1，随机抽题结果被丢弃，
    // 每局做的都是题库最前面 n 题（左右只是顺序不同）。
    PK.left.seq = qs.slice();
    PK.right.seq = CFG.source === 'prep' ? qs.slice() : shuffled(qs.length).map(function (i) { return qs[i]; }); // 备课夹按勾选顺序（讲完就打）；全库各自乱序
    PK.state = 'running';
    syncStageClass();
    PK.durationSec = CFG.minutes * 60;
    PK.leftSec = PK.durationSec;
    PK.leftTs = Date.now();
    $('pkSetup').classList.add('hidden');
    $('pkArena').classList.remove('hidden');
    $('btnStart').disabled = true;
    $('btnReset').disabled = false;
    $('btnChangeQ').disabled = false;
    renderSide('L'); renderSide('r');
    updateTop();
    startTimer();
    tts('PK开始，' + L.name + '对战' + R.name + '，共' + CFG.count + '题，限时' + CFG.minutes + '分钟，祝两位好运！');
  }

  /* ================= 一屏自适应 =================
   * 投屏时两侧各占半屏，题目必须整屏可见：先按 1px 逐级缩字号，
   * 缩到 PKFS_MIN 仍装不下才允许该侧内部滚动——绝不能把字缩到后排看不清，
   * 也绝不能把题目切掉。
   * =============================================== */
  var PKFS_MIN = 16;
  function fitSide(side) {
    var root = $(side === 'L' ? 'pkPanelL' : 'pkPanelR');
    if (!root || !root.scrollHeight) return;
    root.style.removeProperty('--pkfs');
    root.classList.remove('pkfit-scroll');
    var base = parseFloat(getComputedStyle(root).getPropertyValue('--pkfs')) || 23;
    var res = window.XK.fitToBox(base, function (fs) {
      root.style.setProperty('--pkfs', fs + 'px');
      return { h: root.scrollHeight, avail: root.clientHeight };
    }, PKFS_MIN);
    root.style.setProperty('--pkfs', res.fs + 'px');
    root.classList.toggle('pkfit-scroll', res.scroll);
  }
  function fitSides() { fitSide('L'); fitSide('r'); }

  /* ================= 面板渲染 ================= */
  function renderSide(side) {
    var P = side === 'L' ? PK.left : PK.right;
    var root = $(side === 'L' ? 'pkPanelL' : 'pkPanelR');
    var i = P.idx;
    root.classList.toggle('locked', P.locked || P.done);
    root.classList.toggle('done', P.done);
    $(side + 'Name').textContent = P.name + (P.sid ? '（' + P.sid + '）' : '');
    $(side + 'Score').textContent = P.score;
    var st = $(side + 'Streak');
    st.classList.toggle('off', P.streak < 2);
    st.textContent = '🔥 ' + P.streak + ' 连击';
    $(side + 'Prog').style.width = (P.seq.length ? Math.round(P.idx / P.seq.length * 100) : 0) + '%';
    $(side + 'ProgText').textContent = '已完成 ' + P.idx + ' / ' + P.seq.length + ' 题';
    if (P.done) { $(side + 'Body').innerHTML = '<div class="done-tag">🎉 已完成全部题目！等待对手…</div>'; return; }
    if (P.idx >= P.seq.length) { $(side + 'Body').innerHTML = '<div class="done-tag">🎉 已完成全部题目！</div>'; return; }
    var q = P.seq[i];
    $(side + 'Meta').innerHTML = '<span class="qtype">' + esc(q.qt || '') + '</span><span>第 ' + (i + 1) + ' / ' + P.seq.length + ' 题</span>' + (q.kd ? '<span>' + esc(q.kd) + '</span>' : '');
    var body = $(side + 'Body');
    body.innerHTML = '';
    var stem = document.createElement('div'); stem.className = 'qstem'; stem.textContent = window.XK.cleanStem(q.s); body.appendChild(stem);
    var opts = document.createElement('div'); opts.className = 'opts';
    var selNow = P.answered[i] ? P.answered[i].sel : [];
    q.o.forEach(function (o) {
      var d = document.createElement('div'); d.className = 'opt';
      var k = document.createElement('div'); k.className = 'k'; k.textContent = o[0];
      var v = document.createElement('div'); v.className = 'v'; v.textContent = (o[1] && o[1] !== o[0]) ? o[0] + '. ' + o[1] : o[0];
      d.appendChild(k); d.appendChild(v);
      if (selNow.indexOf(o[0]) !== -1) d.classList.add('sel');
      d.setAttribute('data-key', o[0]);
      d.tabIndex = 0; d.setAttribute('role', 'button');
      d.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); d.click(); } };
      d.onclick = function () { pickOpt(side, o[0]); };
      opts.appendChild(d);
    });
    body.appendChild(opts);
    var fb = document.createElement('div'); fb.className = 'feedback'; fb.id = side + 'Fb'; body.appendChild(fb);
    var btn = document.createElement('button'); btn.className = 'submit-btn'; btn.id = side + 'Submit';
    btn.textContent = selNow.length ? '提交本题' : '选择答案后提交';
    btn.disabled = P.locked || P.done || !selNow.length;
    btn.onclick = function () { submitSide(side); };
    body.appendChild(btn);
    fitSide(side);
  }
  function pickOpt(side, key) {
    var P = side === 'L' ? PK.left : PK.right;
    if (P.locked || P.done) return;
    var q = P.seq[P.idx];
    var multi = q.qt === '多选';
    if (multi) {
      var i = P.answered[P.idx] ? P.answered[P.idx].sel.indexOf(key) : -1;
      if (P.answered[P.idx]) {
        var arr = P.answered[P.idx].sel;
        var at = arr.indexOf(key);
        if (at === -1) arr.push(key); else arr.splice(at, 1);
      } else {
        P.answered[P.idx] = { sel: [key] };
      }
    } else {
      P.answered[P.idx] = { sel: [key] };
    }
    // 高亮
    var selNow = P.answered[P.idx] ? P.answered[P.idx].sel : [];
    var root = $(side === 'L' ? 'pkPanelL' : 'pkPanelR');
    root.querySelectorAll('.opt').forEach(function (o) {
      o.classList.toggle('sel', selNow.indexOf(o.getAttribute('data-key')) !== -1);
    });
    var btn = $(side + 'Submit');
    btn.disabled = !selNow.length;
    btn.textContent = '提交本题';
  }

  /* ================= 提交（锁定） ================= */
  function submitSide(side) {
    var P = side === 'L' ? PK.left : PK.right;
    if (P.locked || P.done || PK.state !== 'running') return;
    var q = P.seq[P.idx];
    var sel = (P.answered[P.idx] || { sel: [] }).sel.slice();
    if (!sel.length) return;
    var right = isCorrect(q, sel);
    P.locked = true;
    P.answered[P.idx] = { sel: sel, right: right };
    if (right) { P.score++; P.streak++; } else { P.streak = 0; }
    // 判定反馈
    var root = $(side === 'L' ? 'pkPanelL' : 'pkPanelR');
    root.querySelectorAll('.opt').forEach(function (o) {
      var k = o.getAttribute('data-key');
      o.classList.add('dim');
      if (normAns(q.a).indexOf(normAns(k)) !== -1 && normAns(q.a).indexOf(k) !== -1 || (q.qt === '多选' ? q.a.split('').indexOf(k) !== -1 : k === normAns(q.a))) {
        // 简化：正确项高亮
      }
    });
    // 正确/错误标记
    root.querySelectorAll('.opt').forEach(function (o) {
      var k = o.getAttribute('data-key');
      var isAnsKey = (q.qt === '多选') ? q.a.split('').indexOf(k) !== -1 : (normAns(k) === normAns(q.a));
      if (isAnsKey) { o.classList.remove('dim'); o.classList.add('correct'); }
      else if (sel.indexOf(k) !== -1) { o.classList.remove('dim'); o.classList.add('wrong'); }
    });
    root.classList.add('locked');
    var fb = $(side + 'Fb');
    fb.className = 'feedback show ' + (right ? 'ok' : 'err');
    fb.textContent = right ? '✅ 答对！' + (P.streak >= 2 ? '🔥' + P.streak + ' 连击' : '') : '❌ 答错咯，正确答案：' + q.a;
    if (right) SFX.correct(); else SFX.wrong();
    tts(right ? window.XKP.pickPraise(P.name, P.streak) : window.XKP.pickEncourage(P.name));
    var btn = $(side + 'Submit');
    btn.disabled = true; btn.textContent = '已提交';
    // 下一题按钮（延迟出按钮？直接改文案：提交后按钮变「下一题」）
    setTimeout(function () {
      btn.disabled = false; btn.textContent = '下一题 →';
      btn.onclick = function () { nextSide(side); };
    }, 500);
    renderSideHeader(side);
    updateTop();
    fitSide(side);
  }
  function nextSide(side) {
    var P = side === 'L' ? PK.left : PK.right;
    P.locked = false;
    P.idx++;
    if (P.idx >= P.seq.length) {
      P.done = true; P.locked = true;
      renderSide(side);
      checkAllDone();
      return;
    }
    renderSide(side);
  }
  function renderSideHeader(side) {
    var P = side === 'L' ? PK.left : PK.right;
    $(side + 'Score').textContent = P.score;
    var st = $(side + 'Streak');
    st.classList.toggle('off', P.streak < 2);
    st.textContent = '🔥 ' + P.streak + ' 连击';
    $(side + 'Prog').style.width = (P.seq.length ? Math.round(P.idx / P.seq.length * 100) : 0) + '%';
    $(side + 'ProgText').textContent = '已完成 ' + P.idx + ' / ' + P.seq.length + ' 题';
  }
  function updateTop() {
    var L = PK.left.score, R = PK.right.score;
    $('pkBarL').style.width = Math.max(8, Math.round(L / Math.max(L + R, CFG.count) * 100)) + '%';
    $('pkBarL').textContent = L;
    $('pkBarR').textContent = R;
    var lt = $('pkLeadTag');
    if (L === R) { lt.className = 'lead-tag tie'; lt.innerHTML = '🤝 平局 <span class="who">' + L + ':' + R + '</span>'; }
    else if (L > R) { lt.className = 'lead-tag'; lt.innerHTML = '🏆 领先：<span class="who">' + esc(PK.left.name) + '</span>（' + L + ':' + R + '）'; }
    else { lt.className = 'lead-tag'; lt.innerHTML = '🏆 领先：<span class="who">' + esc(PK.right.name) + '</span>（' + R + ':' + L + '）'; }
  }

  /* ================= 计时 ================= */
  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    PK.timerId = setInterval(function () {
      PK.leftSec--;
      updateTimerDisplay();
      if (PK.leftSec <= 0) { stopTimer(); timeUp(); }
    }, 1000);
  }
  function stopTimer() { if (PK.timerId) { clearInterval(PK.timerId); PK.timerId = null; } }
  function updateTimerDisplay() {
    var s = Math.max(0, PK.leftSec), m = Math.floor(s / 60), ss = s % 60;
    var t = $('pkTimer');
    t.textContent = (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
    t.classList.toggle('warn', s <= 60 && s > 10);
    t.classList.toggle('critical', s <= 10);
  }
  function timeUp() {
    if (PK.state !== 'running') return;
    PK.left.locked = true; PK.right.locked = true;
    toast('⏰ 时间到！两侧锁卷');
    endMatch('timeup');
  }
  function checkAllDone() {
    if (PK.left.done && PK.right.done) { endMatch('both'); return; }
    if (PK.left.done || PK.right.done) {
      toast('🎉 ' + (PK.left.done ? PK.left.name : PK.right.name) + ' 已完成！另一方继续作答');
    }
  }

  /* ================= 结束 ================= */
  function endMatch(reason) {
    if (PK.state !== 'running') return;
    PK.state = 'finished';
    syncStageClass();
    stopTimer();
    $('btnChangeQ').disabled = true;
    PK.left.done = true; PK.right.done = true;
    PK.left.locked = true; PK.right.locked = true;
    renderSide('L'); renderSide('r');
    var L = PK.left, R = PK.right;
    var winner = L.score > R.score ? 'L' : (R.score > L.score ? 'R' : 'tie');
    var dur = Math.round((Date.now() - PK.leftTs) / 1000);
    saveMatch({
      ts: Date.now(), qcount: L.seq.length, durationSec: dur, reason: reason,
      left: { sid: L.sid, name: L.name, score: L.score, answered: L.idx, streakMax: 0 },
      right: { sid: R.sid, name: R.name, score: R.score, answered: R.idx, streakMax: 0 },
      winner: winner
    });
    renderEnd(winner, reason);
    SFX.finish();
    var line;
    if (winner === 'tie') line = '比赛结束，左边选手' + L.name + '得分' + L.score + '分，右边选手' + R.name + '得分' + R.score + '分，两人分数相同，平局！大家都很棒！';
    else {
      var w = winner === 'L' ? L : R, l2 = winner === 'L' ? R : L;
      line = '比赛结束，左边选手' + L.name + '得分' + L.score + '分，右边选手' + R.name + '得分' + R.score + '分。' + w.name + '选手更厉害！' + l2.name + '选手继续加油！';
    }
    setTimeout(function () { tts(line); }, 600);
  }

  /* ================= 结束弹窗 ================= */
  function renderEnd(winner, reason) {
    var L = PK.left, R = PK.right;
    var winLine = winner === 'tie' ? '🤝 平局！' : ('🏆 ' + (winner === 'L' ? L.name : R.name) + ' 获胜！');
    $('endWin').textContent = winLine;
    $('endLScore').textContent = L.score;
    $('endRScore').textContent = R.score;
    $('endLName').textContent = L.name;
    $('endRName').textContent = R.name;
    // 错题复盘
    var rv = $('endReview');
    rv.innerHTML = '';
    [['L', L], ['r', R]].forEach(function (pair) {
      var side = pair[0], P = pair[1];
      var wrongs = [];
      P.answered.forEach(function (a, i) {
        if (!a || a.right) return;
        var q = P.seq[i];
        wrongs.push({ q: q, sel: a.sel });
      });
      if (!wrongs.length) return;
      var h = document.createElement('div'); h.className = 'review-h'; h.textContent = '📕 ' + P.name + ' 的错题（' + wrongs.length + '）';
      rv.appendChild(h);
      wrongs.forEach(function (w) {
        var d = document.createElement('div'); d.className = 'review-item';
        d.innerHTML = '<div class="rs">' + esc(window.XK.cleanStem(w.q.s)) + '</div>' +
          '<div class="ra">你的答案：<b style="color:#fca5a5">' + esc(w.sel.join('') || '未答') + '</b>　正确答案：<b>' + esc(w.q.a) + '</b></div>';
        rv.appendChild(d);
      });
    });
    if (!rv.children.length) rv.innerHTML = '<div class="muted" style="text-align:center;padding:10px">🎉 双方都没有错题！</div>';
    $('endMask').classList.remove('hidden');
    $('btnStart').disabled = false;
  }

  /* ================= 排行榜 ================= */
  function aggregate() {
    var map = {};
    MATCHES.forEach(function (m) {
      [['L', m.left, m.right], ['r', m.right, m.left]].forEach(function (p) {
        var sid = p[1].sid, name = p[1].name;
        if (!sid) return;
        var s = map[sid] = map[sid] || { sid: sid, name: name, games: 0, wins: 0, score: 0 };
        s.games++; s.score += p[1].score;
        if (m.winner === p[0]) s.wins++;
        if (!s.name && name) s.name = name;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function renderLeaderboard(sortBy) {
    var list = aggregate();
    var sb = sortBy || 'score';
    list.sort(function (a, b) { return b[sb] - a[sb] || b.wins - a.wins; });
    var tb = $('lbBody'); tb.innerHTML = '';
    if (!list.length) { tb.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:18px">还没有比赛记录——完成一场 PK 后这里会出现排行榜</td></tr>'; return; }
    list.forEach(function (s, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + esc(s.sid) + '</td><td>' + esc(s.name) + '</td><td>' + s.games + '</td><td>' + s.wins + '</td><td><b>' + s.score + '</b></td><td>' + (s.games ? (s.score / s.games).toFixed(1) : '0') + '</td>';
      tb.appendChild(tr);
    });
  }

  /* ================= 花名册管理 ================= */
  var rosterEditing = null; // 正在编辑的行索引
  function renderRoster() {
    var tb = $('pkRosterBody'); tb.innerHTML = '';
    ROSTER.forEach(function (s, i) {
      var tr = document.createElement('tr');
      if (rosterEditing === i) {
        tr.innerHTML = '<td>' + (i + 1) + '</td>' +
          '<td><input id="reSid" value="' + esc(s.sid) + '"></td>' +
          '<td><input id="reName" value="' + esc(s.name) + '"></td>' +
          '<td><button class="rbtn save" id="reSave">保存</button></td>';
        tb.appendChild(tr);
        $('reSave').onclick = function () {
          var sid = $('reSid').value.trim().slice(0, 20), name = $('reName').value.trim().slice(0, 24);
          if (!name) { toast('姓名不能为空'); return; }
          ROSTER[i] = { sid: sid, name: name };
          rosterEditing = null; saveRoster(); renderRoster(); renderHome();
        };
      } else {
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + esc(s.sid) + '</td><td>' + esc(s.name) + '</td>' +
          '<td><button class="rbtn save" data-edit="' + i + '">编辑</button><button class="rbtn del" data-del="' + i + '">删除</button></td>';
        tb.appendChild(tr);
      }
    });
    if (!ROSTER.length) tb.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center;padding:14px">花名册为空——手动添加或批量粘贴导入</td></tr>';
    tb.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { rosterEditing = parseInt(b.getAttribute('data-edit'), 10); renderRoster(); }; });
    tb.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () {
        var i = parseInt(b.getAttribute('data-del'), 10);
        if (confirm('删除学生「' + ROSTER[i].name + '」？（历史成绩保留）')) { ROSTER.splice(i, 1); saveRoster(); renderRoster(); renderHome(); }
      };
    });
    $('rosterCountLabel').textContent = '共 ' + ROSTER.length + ' 名学生' + (ROSTER.length === DEFAULT_ROSTER.length ? '（' + DEFAULT_CLASS_NAME + '）' : '');
  }

  /* ================= 章节勾选（开赛设置面板） =================
   * 和题量/计时同级：点一下立刻生效并落盘，没有「保存默认值」那一步。
   * 默认全选＝整个题库，但「已选 N 章 · 可抽 X 题」必须摆在明面上，不做隐形默认。
   * ============================================ */
  function normalizeMods() {
    var codes = modCodes(), m = CFG.mods || {}, out = {};
    for (var i = 0; i < codes.length; i++) out[codes[i]] = m[codes[i]] !== false;
    CFG.mods = out;
  }
  function countOn(sel) {
    var n = 0;
    for (var k in sel) if (sel[k]) n++;
    return n;
  }
  function renderModBox() {
    normalizeMods();
    var box = $('pkCfgMods'); box.innerHTML = '';
    var codes = modCodes();
    if (!codes.length) {
      var tip = document.createElement('div');
      tip.className = 'noMods';
      tip.textContent = '当前题库没有章节信息，按整个题库抽题。';
      box.appendChild(tip);
    }
    codes.forEach(function (code) {
      var meta = (window.BANK_META || []).filter(function (m) { return m.code === code; })[0] || {};
      var d = document.createElement('div');
      d.className = 'pkmod' + (CFG.mods[code] ? ' on' : '');
      d.setAttribute('data-code', code);
      var nm = document.createElement('span'); nm.className = 'mn'; nm.textContent = meta.disp || meta.name || code;
      var mi = document.createElement('span'); mi.className = 'mi'; mi.textContent = modCountOf(code) + ' 题';
      var ck = document.createElement('span'); ck.className = 'ck';
      d.appendChild(nm); d.appendChild(mi); d.appendChild(ck);
      d.onclick = function () { setMod(code, !CFG.mods[code]); };
      box.appendChild(d);
    });
    var pool = bankPool();
    $('pkModsCount').textContent = '已选 ' + countOn(CFG.mods) + ' 章 · 可抽 ' + pool.length + ' 题' +
      (pool.length === BANK.length ? '（＝全库）' : '');
  }
  function setMod(code, on) {
    normalizeMods();
    CFG.mods[code] = on;
    saveCfg();
    renderHome();
  }
  function setAllMods(on) {
    normalizeMods();
    for (var k in CFG.mods) CFG.mods[k] = on;
    saveCfg();
    renderHome();
  }

  /* ================= 事件绑定 ================= */
  function bind() {
    $('btnStart').onclick = startPK;
    $('btnRand').onclick = randomMatch;
    // 投屏模式下底部页签整条让位给题面，退出只能走这里；独立版没有「首页」可回，直接藏掉
    var hb = $('btnHome');
    if (hb) {
      if (window.__PK_ONLEAVE) { hb.style.display = ''; hb.onclick = function () { window.__PK_ONLEAVE(); }; }
      else hb.style.display = 'none';
    }
    $('btnReset').onclick = function () {
      if (PK.state === 'running' && !confirm('本轮还在进行中，确定重置？')) return;
      resetRound();
    };
    $('btnChangeQ').onclick = changeCurrentQ;
    $('bgmToggle').onclick = function () { BGM.toggle(); };
    $('pkNavBack').onclick = function () { window.XKNav && window.XKNav.back(); };
    $('pkNavFwd').onclick = function () { window.XKNav && window.XKNav.forward(); };
    $('bgmDirBtn').onclick = function () { BGM.pickFolder(); };
    $('bgmDir').onchange = function () { BGM.onDirPick(this.files); };
    $('bgmVol').oninput = function () { BGM.setVol(parseInt(this.value, 10) / 100); };
    $('pkSrcBank').onclick = function () { CFG.source = 'bank'; saveCfg(); renderPrepSource(); };
    $('pkSrcPrep').onclick = function () {
      CFG.source = 'prep'; saveCfg(); renderPrepSource();
      if (!prepList().length) toast('备课夹还是空的：先去首页「📋 备课夹」勾题');
    };
    document.addEventListener('keydown', stageKeys);
    $('btnLb').onclick = function () { renderLeaderboard('score'); $('lbMask').classList.remove('hidden'); };
    $('lbClose').onclick = function () { $('lbMask').classList.add('hidden'); };
    $('lbFromEnd').onclick = function () { renderLeaderboard('score'); $('endMask').classList.add('hidden'); $('lbMask').classList.remove('hidden'); };
    $('lbSortScore').onclick = function () { renderLeaderboard('score'); };
    $('lbSortWins').onclick = function () { renderLeaderboard('wins'); };
    $('btnRoster').onclick = function () { rosterEditing = null; renderRoster(); $('pkRosterMask').classList.remove('hidden'); };
    $('rosterClose').onclick = function () { $('pkRosterMask').classList.add('hidden'); renderHome(); };
    $('rosterAdd').onclick = function () {
      var sid = $('pkNewSid').value.trim().slice(0, 20), name = $('pkNewName').value.trim().slice(0, 24);
      if (!name) { toast('姓名不能为空'); return; }
      if (ROSTER.some(function (s) { return s.name === name; })) { toast('已有同名学生'); return; }
      ROSTER.push({ sid: sid, name: name });
      saveRoster(); renderRoster();
      $('pkNewSid').value = ''; $('pkNewName').value = '';
    };
    $('rosterImport').onclick = function () {
      var list = parseRoster($('pkRosterPaste').value);
      if (!list.length) { toast('没有解析出有效名单'); return; }
      list.forEach(function (s) {
        if (!ROSTER.some(function (x) { return x.name === s.name; })) ROSTER.push(s);
      });
      saveRoster(); renderRoster();
      $('pkRosterPaste').value = '';
      toast('批量导入完成，当前 ' + ROSTER.length + ' 人');
    };
    $('rosterReset').onclick = function () {
      if (!confirm('恢复为默认班级「' + DEFAULT_CLASS_NAME + '」（' + DEFAULT_ROSTER.length + ' 人）？\n当前自定义名单将被替换。')) return;
      ROSTER = DEFAULT_ROSTER.slice();
      saveRoster(); renderRoster(); renderHome();
      toast('已恢复默认班级：' + DEFAULT_CLASS_NAME + '（' + ROSTER.length + ' 人）');
    };
    $('btnCfg').onclick = function () {
      $('cfgPaste').value = '';
      // 弹窗里的题量/计时回填当前已存值；章节勾选不在这里，在开赛设置面板
      // 弹窗里的题量/计时用 pkDlg* 独立 id：面板那对（pkCfg*）才是 startPK 读的，
      // 同名会让 getElementById 只拿到第一个，弹窗改的值永远不生效。
      $('pkDlgCount').value = CFG.count;
      $('pkDlgMinutes').value = CFG.minutes;
      try {
        var inp = $('cfgBankUrl');
        if (inp && !inp.value) inp.value = DEFAULT_BANK_URL;
        var hint = $('bankUrlHint');
        if (hint) hint.textContent = '当前题库：' + bankInfo();
      } catch (e) { }
      $('cfgMask').classList.remove('hidden');
    };
    $('cfgClose').onclick = function () { $('cfgMask').classList.add('hidden'); };
    $('pkModsAll').onclick = function () { setAllMods(true); };
    $('pkModsNone').onclick = function () { setAllMods(false); };
    $('cfgFetch').onclick = function () {
      var u = $('cfgBankUrl').value.trim();
      if (!u) { toast('先填题库地址'); return; }
      fetchBank(u);
    };
    $('cfgPasteApply').onclick = function () { pasteBank($('cfgPaste').value); };
    $('cfgSave').onclick = function () {
      CFG.count = Math.max(1, Math.min(50, parseInt($('pkDlgCount').value, 10) || 10));
      CFG.minutes = Math.max(1, Math.min(60, parseInt($('pkDlgMinutes').value, 10) || 10));
      saveCfg(); renderHome(); toast('已保存：' + CFG.count + ' 题 / ' + CFG.minutes + ' 分钟');
      $('cfgMask').classList.add('hidden');
    };
    $('btnSnd').onclick = function () {
      sndOn = !sndOn;
      Store.save('pk.snd', sndOn);
      $('btnSnd').textContent = sndOn ? '🔊 音效开' : '🔇 音效关';
      if (sndOn) { SFX.unlock(); SFX.correct(); }
    };
    $('endClose').onclick = function () { $('endMask').classList.add('hidden'); resetRound(); };
    $('pkSelL').onchange = function () { pickL = studentOfSelect($('pkSelL')); renderHome(); };
    $('pkSelR').onchange = function () { pickR = studentOfSelect($('pkSelR')); renderHome(); };
    // 恢复音效开关文案
    $('btnSnd').textContent = sndOn ? '🔊 音效开' : '🔇 音效关';
  }
  function resetRound() {
    PK.state = 'idle';
    syncStageClass();
    PK.left = null; PK.right = null;
    pickL = null; pickR = null;
    stopTimer();
    $('endMask').classList.add('hidden');
    $('pkArena').classList.add('hidden');
    $('pkSetup').classList.remove('hidden');
    $('btnStart').disabled = false;
    $('btnReset').disabled = true;
    $('btnChangeQ').disabled = true;
    $('pkTimer').textContent = '10:00';
    $('pkTimer').className = 'timer';
    $('pkLeadTag').textContent = '🏆 待开赛';
    $('pkBarL').style.width = '50%'; $('pkBarL').textContent = '0';
    $('pkBarR').textContent = '0';
    renderHome();
  }

  /* 单测钩子：只暴露只读快照，不参与任何界面逻辑（tests/dom-stub.js 用） */
  window.__PK_TEST = {
    bankPool: bankPool,
    fitToBox: window.XK.fitToBox,
    PKFS_MIN: PKFS_MIN,
    cfg: function () { return CFG; },
    pk: function () { return PK; },
    picks: function () { return [pickL, pickR]; },
    // 供 tools/gate-fit.js 用真实渲染路径逐题量高度（不是重新实现一遍 fitSide）
    render: function (side) { renderSide(side); },
    bgm: function () { return BGM; }
  };

  /* ================= 启动 ================= */
  // 刷新钩子（主站每次进入 PK 页调用）：重读存储 + 重渲染选人下拉
  window.__PK_REFRESH = function () {
    try {
      var r = Store.load(K_ROSTER, null);
      if (Array.isArray(r) && r.length) ROSTER = r;
      else if (!Array.isArray(r)) { ROSTER = DEFAULT_ROSTER.slice(); Store.save(K_ROSTER, ROSTER); }
      var m = Store.load(K_MATCHES, []);
      if (Array.isArray(m)) MATCHES = m;
    } catch (e) { }
    try { renderHome(); } catch (e) { if (window.console) console.error('[PK] renderHome:', e); }
  };

  // 初始化（逐项容错，单点失败不阻断后续）
  document.addEventListener('click', function () { try { SFX.unlock(); } catch (e) { } }, { once: true });
  window.addEventListener('resize', function () { if (PK.state === 'running') fitSides(); });
  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); } catch (e) { } }
  try { renderHome(); } catch (e) { if (window.console) console.error('[PK] init renderHome:', e); }
  // 内嵌题库已可用；若设置了外部地址则静默尝试更新（失败忽略）
  (function __PK_AUTOFETCH() {
    try {
      var inp = $('cfgBankUrl');
      var url = (inp && inp.value) || DEFAULT_BANK_URL;
      if (inp && !inp.value) inp.value = url;
      // 纯静态（file://）不自动拉，避免无谓网络请求
      if (location.protocol === 'file:') return;
      fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && (j.bank || Array.isArray(j))) {
          var arr = j.bank || j;
          if (Array.isArray(arr) && arr.length) { BANK = arr; try { renderHome(); } catch (e) { } }
        }
      }).catch(function () { });
    } catch (e) { }
  })();
  try { bind(); } catch (e) { if (window.console) console.error('[PK] bind:', e); }
  try { BGM.init(); } catch (e) { if (window.console) console.error('[PK] bgm init:', e); }
  try { $('btnSnd').textContent = sndOn ? '🔊 音效开' : '🔇 音效关'; } catch (e) { }
};