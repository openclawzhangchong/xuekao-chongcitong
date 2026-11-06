/* =====================================================================
 * 双人课堂 PK 答题 · 应用逻辑
 * 存储适配层：localStorage 实现（D1 预留同接口，见 Store 注释）
 * ===================================================================== */
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
  var DEFAULT_ROSTER = [
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

  var K_ROSTER = 'pk.roster', K_MATCHES = 'pk.matches', K_CFG = 'pk.cfg';

  /* ================= 题库三通道 ================= */
  var BANK = (window.BANK || []).slice(); // 通道①：内嵌
  function bankInfo() { return BANK.length + ' 题' + (window.BANK_VER ? '（' + window.BANK_VER + '）' : ''); }
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
  function saveCfg() { Store.save(K_CFG, CFG); }

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
  function saveMatch(m) { MATCHES.push(m); Store.save(K_MATCHES, MATCHES.slice(-500)); }

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

  /* ================= PK 状态机 ================= */
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
  function pickQuestions(n) {
    var idxs = shuffled(BANK.length).slice(0, Math.min(n, BANK.length));
    return idxs.map(function (i) { return BANK[i]; });
  }

  /* ================= 渲染：首页/选人 ================= */
  function fillSelect(id, excludeSid, val) {
    var sel = $(id);
    sel.innerHTML = '<option value="">— 选择选手 —</option>';
    ROSTER.forEach(function (s) {
      if (s.sid === excludeSid) return; // 两侧不能同一个人
      var o = document.createElement('option');
      o.value = s.sid; o.textContent = (s.sid ? s.sid + ' · ' : '') + s.name;
      sel.appendChild(o);
    });
    if (val) sel.value = val;
  }
  function renderHome() {
    $('bankInfo').textContent = '题库：' + bankInfo();
    fillSelect('pkSelL', $('pkSelR').value, PK.left && PK.left.sid);
    fillSelect('pkSelR', $('pkSelL').value, PK.right && PK.right.sid);
    $('pkCfgCount').value = CFG.count;
    $('pkCfgMinutes').value = CFG.minutes;
  }

  /* ================= 开始 PK ================= */
  function startPK() {
    var lSid = $('pkSelL').value, rSid = $('pkSelR').value;
    if (!lSid || !rSid) { toast('请先选择左右两名选手'); return; }
    var L = ROSTER.filter(function (s) { return s.sid === lSid; })[0];
    var R = ROSTER.filter(function (s) { return s.sid === rSid; })[0];
    if (!L || !R) { toast('选手不存在，请重新选择'); return; }
    SFX.unlock();
    CFG.count = Math.max(1, Math.min(50, parseInt($('pkCfgCount').value, 10) || 10));
    CFG.minutes = Math.max(1, Math.min(60, parseInt($('pkCfgMinutes').value, 10) || 10));
    saveCfg();
    var qs = pickQuestions(CFG.count);
    PK.left = sideObj('L', lSid, L.name); PK.right = sideObj('r', rSid, R.name);
    PK.left.seq = qs.map(function (_, i) { return i; });
    PK.right.seq = shuffled(qs.length); // 同一批题，各自乱序
    PK.state = 'running';
    PK.durationSec = CFG.minutes * 60;
    PK.leftSec = PK.durationSec;
    PK.leftTs = Date.now();
    $('pkSetup').classList.add('hidden');
    $('pkArena').classList.remove('hidden');
    $('btnStart').disabled = true;
    $('btnReset').disabled = false;
    renderSide('L'); renderSide('r');
    updateTop();
    startTimer();
    tts('PK开始，' + L.name + '对战' + R.name + '，共' + CFG.count + '题，限时' + CFG.minutes + '分钟，祝两位好运！');
  }

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
    var q = BANK[P.seq[i]];
    $(side + 'Meta').innerHTML = '<span class="qtype">' + esc(q.qt || '') + '</span><span>第 ' + (i + 1) + ' / ' + P.seq.length + ' 题</span>' + (q.kd ? '<span>' + esc(q.kd) + '</span>' : '');
    var body = $(side + 'Body');
    body.innerHTML = '';
    var stem = document.createElement('div'); stem.className = 'qstem'; stem.textContent = q.s; body.appendChild(stem);
    var opts = document.createElement('div'); opts.className = 'opts';
    var selNow = P.answered[i] ? P.answered[i].sel : [];
    q.o.forEach(function (o) {
      var d = document.createElement('div'); d.className = 'opt';
      var k = document.createElement('div'); k.className = 'k'; k.textContent = o[0];
      var v = document.createElement('div'); v.className = 'v'; v.textContent = (o[1] && o[1] !== o[0]) ? o[0] + '. ' + o[1] : o[0];
      d.appendChild(k); d.appendChild(v);
      if (selNow.indexOf(o[0]) !== -1) d.classList.add('sel');
      d.setAttribute('data-key', o[0]);
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
  }
  function pickOpt(side, key) {
    var P = side === 'L' ? PK.left : PK.right;
    if (P.locked || P.done) return;
    var q = BANK[P.seq[P.idx]];
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
    var q = BANK[P.seq[P.idx]];
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
    tts(right ? '答对啦！' : '这题答错咯');
    var btn = $(side + 'Submit');
    btn.disabled = true; btn.textContent = '已提交';
    // 下一题按钮（延迟出按钮？直接改文案：提交后按钮变「下一题」）
    setTimeout(function () {
      btn.disabled = false; btn.textContent = '下一题 →';
      btn.onclick = function () { nextSide(side); };
    }, 500);
    renderSideHeader(side);
    updateTop();
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
    var total = Math.max(L + R, 1);
    $('pkBarL').style.width = Math.max(8, Math.round(L / Math.max(L + R, CFG.count) * 100)) + '%';
    $('pkBarL').textContent = L;
    $('pkBarR').textContent = R;
    var lt = $('pkLeadTag');
    if (L === R) { lt.textContent = '🤝 平局 ' + L + ':' + R; lt.className = 'lead-tag tie'; }
    else if (L > R) { lt.textContent = '🏆 领先：' + PK.left.name + '（' + L + ':' + R + '）'; lt.className = 'lead-tag'; }
    else { lt.textContent = '🏆 领先：' + PK.right.name + '（' + R + ':' + L + '）'; lt.className = 'lead-tag'; }
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
    stopTimer();
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
        var q = BANK[P.seq[i]];
        wrongs.push({ q: q, sel: a.sel });
      });
      if (!wrongs.length) return;
      var h = document.createElement('div'); h.className = 'review-h'; h.textContent = '📕 ' + P.name + ' 的错题（' + wrongs.length + '）';
      rv.appendChild(h);
      wrongs.forEach(function (w) {
        var d = document.createElement('div'); d.className = 'review-item';
        d.innerHTML = '<div class="rs">' + esc(w.q.s) + '</div>' +
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

  /* ================= 事件绑定 ================= */
  function bind() {
    $('btnStart').onclick = startPK;
    $('btnReset').onclick = function () {
      if (PK.state === 'running' && !confirm('本轮还在进行中，确定重置？')) return;
      resetRound();
    };
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
      try {
        var inp = $('cfgBankUrl');
        if (inp && !inp.value) inp.value = DEFAULT_BANK_URL;
        var hint = $('bankUrlHint');
        if (hint) hint.textContent = '当前题库：' + bankInfo();
      } catch (e) { }
      $('cfgMask').classList.remove('hidden');
    };
    $('cfgClose').onclick = function () { $('cfgMask').classList.add('hidden'); };
    $('cfgFetch').onclick = function () {
      var u = $('cfgBankUrl').value.trim();
      if (!u) { toast('先填题库地址'); return; }
      fetchBank(u);
    };
    $('cfgPasteApply').onclick = function () { pasteBank($('cfgPaste').value); };
    $('cfgSave').onclick = function () {
      CFG.count = Math.max(1, Math.min(50, parseInt($('pkCfgCount').value, 10) || 10));
      CFG.minutes = Math.max(1, Math.min(60, parseInt($('pkCfgMinutes').value, 10) || 10));
      saveCfg(); renderHome(); toast('已保存');
      $('cfgMask').classList.add('hidden');
    };
    $('btnSnd').onclick = function () {
      sndOn = !sndOn;
      Store.save('pk.snd', sndOn);
      $('btnSnd').textContent = sndOn ? '🔊 音效开' : '🔇 音效关';
      if (sndOn) { SFX.unlock(); SFX.correct(); }
    };
    $('endClose').onclick = function () { $('endMask').classList.add('hidden'); resetRound(); };
    $('pkSelL').onchange = renderHome;
    $('pkSelR').onchange = renderHome;
    // 恢复音效开关文案
    $('btnSnd').textContent = sndOn ? '🔊 音效开' : '🔇 音效关';
  }
  function resetRound() {
    PK.state = 'idle';
    PK.left = null; PK.right = null;
    stopTimer();
    $('endMask').classList.add('hidden');
    $('pkArena').classList.add('hidden');
    $('pkSetup').classList.remove('hidden');
    $('btnStart').disabled = false;
    $('btnReset').disabled = true;
    $('pkTimer').textContent = '10:00';
    $('pkTimer').className = 'timer';
    $('pkLeadTag').textContent = '🏆 待开赛';
    $('pkBarL').style.width = '50%'; $('pkBarL').textContent = '0';
    $('pkBarR').textContent = '0';
    renderHome();
  }

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
  try { $('btnSnd').textContent = sndOn ? '🔊 音效开' : '🔇 音效关'; } catch (e) { }
};