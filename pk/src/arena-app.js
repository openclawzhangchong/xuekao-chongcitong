/* =====================================================================
 * 课堂擂台赛 · 应用逻辑
 * 与双人 PK 的关系：只读 pk.roster / pk.snd / xkc.sfx，绝不写它们；
 * 自己的战绩与设置分别存 pk.arena.v1 / pk.arena.cfg。
 * 判分、抽题、一屏自适应全部复用 engine.js 的纯函数，不复制第二份实现。
 * ===================================================================== */
window.__ARENA_MOUNT = function () {
  'use strict';
  if (window.__ARENA_MOUNTED) { window.__ARENA_REFRESH && window.__ARENA_REFRESH(); return; }
  window.__ARENA_MOUNTED = true;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function load(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  var K_ROSTER = 'pk.roster', K_SND = 'pk.snd', K_CFG = 'pk.cfg', K_LOG = 'pk.arena.v1', K_ARCFG = 'pk.arena.cfg';
  var ARFS_MIN = 16;

  var DEFAULT_ROSTER = [];
  (function () {
    var names = ['陈博杰', '陈嘉伟', '陈凯棋', '陈晓璐', '陈羽韩', '陈紫欣', '程伟杰', '邓志', '何静', '黄凯杰', '黄晓伟', '李航',
      '林静静', '林烨凯', '林泽豪', '林志灵', '凌峰', '刘晨希', '刘椿尧', '刘智伟', '倪皓轩', '沈金龙', '宋海龙', '宋政烨',
      '王依晨', '翁晨辉', '谢志豪', '颜琦镔', '叶睿晨', '游子鹏', '张亿乐', '赵伟坤', '郑杨鸿', '郑子添', '朱炫杰', '朱紫寒'];
    for (var i = 0; i < names.length; i++) DEFAULT_ROSTER.push({ sid: '2025' + (i + 1 < 10 ? '00' : i + 1 < 100 ? '0' : '') + (i + 1), name: names[i] });
  })();

  /* ================= 只读：名单与音效开关 ================= */
  function roster() {
    var r = load(K_ROSTER, null);
    return Array.isArray(r) && r.length ? r : DEFAULT_ROSTER;
  }
  function sndOn() { return load(K_SND, true) !== false; }

  /* ================= 擂台设置（独立存储） ================= */
  var CFG = load(K_ARCFG, null);
  if (!CFG || typeof CFG !== 'object') {
    var pk = load(K_CFG, null) || {};
    CFG = { count: 5, minutes: 2, rounds: 10, mods: pk.mods ? JSON.parse(JSON.stringify(pk.mods)) : null };
  }
  if (CFG.source !== 'prep') CFG.source = 'bank';   // 题源：bank=全库随机 / prep=备课夹按勾选顺序
  function saveCfg() { save(K_ARCFG, CFG); }
  function modCodes() {
    var out = [];
    (window.BANK_META || []).forEach(function (m) { if (m && m.code) out.push(m.code); });
    return out;
  }
  function normalizeMods() {
    var codes = modCodes(), m = CFG.mods || {}, out = {};
    for (var i = 0; i < codes.length; i++) out[codes[i]] = m[codes[i]] !== false;
    CFG.mods = out;
  }
  function modCountOf(code) {
    var n = 0;
    for (var i = 0; i < BANK.length; i++) if (BANK[i].m === code) n++;
    return n;
  }

  /* ================= 题库 ================= */
  var BANK = (window.BANK || []).slice();

  /* ================= 战绩（本轮 + 全课累计） ================= */
  function blankLog() {
    return { round: 0, champ: null, played: {}, results: [], best: null, allPlayed: {}, streak: 0 };
  }
  var LOG = load(K_LOG, null);
  if (!LOG || typeof LOG !== 'object' || !Array.isArray(LOG.results)) LOG = blankLog();
  if (!LOG.allPlayed) LOG.allPlayed = {};
  function saveLog() {
    save(K_LOG, LOG);
    try { window.__CLASSROOM_SYNC && window.__CLASSROOM_SYNC.mark('arena'); } catch (e) { }
  }

  /* ================= 本局状态 ================= */
  var AR = { running: false, left: null, right: null, timerId: null, leftSec: 0,
    sel: [], picks: [], pool: null, poolPos: 0, defending: false, isExtra: false };
  function sideObj(key, stu) {
    return { key: key, sid: stu ? stu.sid : '', name: stu ? stu.name : '', seq: [], idx: 0, score: 0, answered: [], locked: false, done: false };
  }

  function toast(msg) {
    var t = $('arToast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }


  function renderArSource() {
    var prep = load('xkc.prep.v1', []) || [], isPrep = CFG.source === 'prep';
    var b1 = $('arSrcBank'), b2 = $('arSrcPrep'), c = $('arPrepCount');
    if (b1) b1.classList.toggle('on', !isPrep);
    if (b2) b2.classList.toggle('on', isPrep);
    if (c) c.textContent = '备课夹 ' + prep.length + ' 题' + (isPrep && prep.length ? '（按勾选顺序出题）' : '');
  }
  /* 换一题：双方当前题同步换成一库名新题（备课夹题量不变，只影响本场） */
  function changeArenaQ() {
    if (!AR.running) return;
    var L = AR.left, R = AR.right;
    if ((L.answered && L.answered[L.idx]) || (R.answered && R.answered[R.idx])) {
      toast('当前题已有人作答，等「下一题」后再换'); return;
    }
    var used = {}, XK = window.XK;
    [L, R].forEach(function (S) { (S.seq || []).forEach(function (q, i) { if (i !== S.idx) used[XK.qidOf(q)] = 1; }); });
    var fresh = null;
    for (var t = 0; t < 60 && !fresh; t++) {
      var q = BANK[Math.floor(Math.random() * BANK.length)];
      if (q && !used[XK.qidOf(q)]) fresh = q;
    }
    if (!fresh) { toast('换题失败：题库都被用完了'); return; }
    [L, R].forEach(function (S, i) {
      if (!S.seq.length || S.idx >= S.seq.length) return;
      S.seq[S.idx] = fresh;
      delete S.answered[S.idx];
      renderSeat(i === 0 ? 'champ' : 'chal');
    });
    tts('换一题');
  }
  /* 舞台键盘快答：擂主 A–F 选 + 回车提交；挑战者 1–6 选 + 空格提交 */
  function arenaKeys(e) {
    if (!AR.running) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    var k = (e.key || '').toLowerCase();
    var L = AR.left, R = AR.right;
    if (!L || !R) return;
    function optAt(S, i) { return (S.seq && S.idx < S.seq.length && S.seq[S.idx].o && i < S.seq[S.idx].o.length) ? S.seq[S.idx].o[i][0] : null; }
    function pickSeat(key, letter, S) {
      if ((S.answered && S.answered[S.idx]) || S.idx >= S.seq.length) return false;
      var o = letter;
      if (o) { pickOpt(key, o); return true; }
      return false;
    }
    if (k === 'enter') {
      if (!(L.answered && L.answered[L.idx]) && L.idx < L.seq.length) {
        var b = $('arChampSubmit'); if (b && !b.disabled) { b.click(); e.preventDefault(); }
      }
      return;
    }
    if (k === ' ') {
      if (!(R.answered && R.answered[R.idx]) && R.idx < R.seq.length) {
        var b2 = $('arChalSubmit'); if (b2 && !b2.disabled) { b2.click(); e.preventDefault(); }
      }
      return;
    }
    var iL = 'abcdef'.indexOf(k);
    if (iL >= 0 && pickSeat('champ', optAt(L, iL), L)) { e.preventDefault(); return; }
    var iR = '123456'.indexOf(k);
    if (iR >= 0 && pickSeat('chal', optAt(R, iR), R)) { e.preventDefault(); return; }
  }

  /* ================= TTS：固定男声 + 低沉慢速，取不到就兜底 ================= */
  function zhVoices() {
    if (!('speechSynthesis' in window)) return [];
    try { return speechSynthesis.getVoices().filter(function (v) { return /^zh/i.test(v.lang); }); } catch (e) { return []; }
  }
  function arenaVoice() {
    var vs = zhVoices();
    if (!vs.length) return null;
    for (var i = 0; i < vs.length; i++) if (/kangkang/i.test(vs[i].name)) return vs[i];
    return vs[0];
  }
  function tts(text, cb) {
    if (!sndOn() || !('speechSynthesis' in window)) { if (cb) cb(); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var v = arenaVoice();
      if (v) u.voice = v;
      u.lang = 'zh-CN';
      u.pitch = 0.8;   // 比双人 PK 低沉
      u.rate = 0.92;   // 报幕式放慢
      if (cb) u.onend = cb;
      speechSynthesis.speak(u);
    } catch (e) { if (cb) cb(); }
  }

  /* ================= 候选席 =================
   * 候选袋只在挂载/重开一轮时洗一次，之后顺序取出：
   * 每次调用都重洗会让教师点选时另外两张卡当场换人。
   * =========================================== */
  function buildPool() {
    var rs = roster();
    AR.pool = window.XK.shuffle(rs.slice());
    AR.poolPos = 0;
    AR.washedNote = '';
  }
  /* 一批候选里绝不重复同一个人：名单不足 k 人时宁可少给，
   * 上层据此提示「至少需要 N 人」，避免出现擂主 vs 擂主。 */
  function nextCandidates(k) {
    if (!AR.pool || !AR.pool.length) buildPool();
    var out = [], used = {}, rewashed = false;
    while (out.length < k) {
      if (AR.poolPos >= AR.pool.length) {
        var fresh = 0;
        AR.pool.forEach(function (s) {
          if (!used[s.sid] && !(LOG.champ && s.sid === LOG.champ.sid)) fresh++;
        });
        if (!fresh) break;
        buildPool();
        rewashed = true;
        continue;
      }
      var s = AR.pool[AR.poolPos++];
      if (LOG.champ && s.sid === LOG.champ.sid) continue;
      if (used[s.sid]) continue;
      used[s.sid] = 1;
      out.push(s);
    }
    if (rewashed) AR.washedNote = '本轮候选已用完，已重新洗入全班。';
    return out;
  }
  function ensurePicks() {
    if (!AR.picks.length) AR.picks = nextCandidates(3);
    return AR.picks;
  }
  function needCount() { return LOG.champ ? 1 : 2; }
  function renderPicks() {
    var box = $('arPickList'); if (!box) return;
    box.innerHTML = '';
    var cs = ensurePicks();
    if (!cs.length) {
      var e = document.createElement('div'); e.className = 'ar-empty';
      e.textContent = '名单里没人可选了，请先在双人 PK 里导入花名册。';
      box.appendChild(e);
    }
    cs.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'ar-pick' + (AR.sel.indexOf(s) !== -1 ? ' on' : '');
      d.setAttribute('data-sid', s.sid);
      var pn = document.createElement('span'); pn.className = 'pn'; pn.textContent = s.name;
      var ps = document.createElement('span'); ps.className = 'ps';
      ps.textContent = (LOG.allPlayed[s.sid] || 0) > 0 ? '本课上过 ' + LOG.allPlayed[s.sid] + ' 次' : '还没上过台';
      d.appendChild(pn); d.appendChild(ps);
      d.onclick = function () { toggleSel(s); };
      box.appendChild(d);
    });
    var tip = $('arPicksTip');
    if (tip) tip.textContent = LOG.champ ? '点 1 人上台' : '第一场：点 2 人定擂主';
    $('arLeftInfo').textContent = '本轮还剩 ' + Math.max(0, AR.pool.length - AR.poolPos) + ' 人未候选';
    syncGo();
  }
  function toggleSel(s) {
    var at = AR.sel.indexOf(s);
    if (at !== -1) AR.sel.splice(at, 1);
    else {
      if (AR.sel.length >= needCount()) AR.sel.shift();
      AR.sel.push(s);
    }
    renderPicks();
  }
  function syncGo() {
    var go = $('arGo');
    if (!go) return;
    go.disabled = AR.running || AR.sel.length !== needCount();
    go.textContent = AR.running ? '⚔️ 这一场进行中…' : (LOG.champ ? '🥊 开始守擂' : '🥊 开始第一场（定擂主）');
  }

  /* ================= 横幅与计数 ================= */
  function renderBanner() {
    var b = $('arBanner'), tag = $('arChampTag');
    // 第一场台上还没有擂主：左席是「争擂者」而不是守擂者，名字必须用本局的左位
    var contesting = AR.running && !AR.defending;
    if (contesting) {
      b.innerHTML = '⚔️ 第一场争擂：<b>' + esc(AR.left.name) + '</b> vs <b>' + esc(AR.right.name) + '</b>';
      if (tag) tag.textContent = '⚔️ 争擂';
      $('arChampName').textContent = AR.left.name;
    } else if (LOG.champ) {
      b.innerHTML = '👑 擂主 <b>' + esc(LOG.champ.name) + '</b> · 已连胜 ' + LOG.streak + ' 场';
      if (tag) tag.textContent = '👑 擂主（连胜 ' + LOG.streak + '）';
      $('arChampName').textContent = LOG.champ.name;
    } else {
      b.textContent = '擂台空着 · 第一场先定擂主';
      if (tag) tag.textContent = '👑 擂主';
      $('arChampName').textContent = '虚位以待';
    }
    $('arRoundInfo').textContent = '第 ' + LOG.round + ' / ' + CFG.rounds + ' 场';
    $('arNote').textContent = '题量 ' + CFG.count + ' 题 · 每场 ' + CFG.minutes + ' 分钟 · ' +
      (LOG.champ || contesting ? '擂主在左、挑战者在右' : '第一场两位同学争夺擂主之位') +
      (AR.washedNote ? ' · ' + AR.washedNote : '');
  }

  /* ================= 一场 ================= */
  function startRound() {
    if (AR.running) { toast('这一场还在进行中'); return; }
    var need = needCount();
    if (roster().length < need) {
      toast('擂台赛至少需要 ' + need + ' 位不同的同学，请先在双人 PK 里导入花名册'); return;
    }
    if (AR.sel.length !== need) { toast(need === 1 ? '先从候选席点 1 位挑战者' : '第一场要从候选席点 2 位同学'); return; }
    normalizeMods();
    var qs;
    if (CFG.source === 'prep') {
      var pr = window.XK.resolvePrep(BANK, load('xkc.prep.v1', []) || []);
      qs = pr.list.slice(0, CFG.count);              // 备课夹：按勾选顺序出题
    } else {
      qs = window.XK.pickFromBank(BANK, CFG.mods, CFG.count);
    }
    if (!qs.length) { toast(CFG.source === 'prep' ? '备课夹是空的：先去首页「📋 备课夹」勾题，或把题源切回全库' : '没有勾中任何题目，请在「擂台设置」里勾上出题章节'); return; }
    if (qs.length < CFG.count) toast((CFG.source === 'prep' ? '备课夹只有 ' : '所选章节只有 ') + qs.length + ' 题，本场按 ' + qs.length + ' 题进行');

    var leftStu = LOG.champ ? LOG.champ : AR.sel[0];
    var rightStu = LOG.champ ? AR.sel[0] : AR.sel[1];
    // 旧候选卡可能还留着刚上台的擂主，教师点它就变成自己踢自己的馆
    if (rightStu && leftStu && rightStu.sid === leftStu.sid) { toast('这位就是当前擂主，换一位来踢馆'); return; }
    AR.defending = !!LOG.champ;              // 本局是不是「有擂主守擂」，横幅据此区分
    AR.left = sideObj('champ', leftStu);
    AR.right = sideObj('chal', rightStu);
    AR.left.seq = qs.slice();
    AR.right.seq = CFG.source === 'prep' ? qs.slice() : window.XK.shuffle(qs.slice());
    AR.running = true;
    AR.leftSec = Math.max(1, CFG.minutes) * 60;
    if (!AR.isExtra) LOG.round++;     // 加赛不占正式场次
    AR.isExtra = false;
    bumpPlayed(leftStu.sid); bumpPlayed(rightStu.sid);
    saveLog();

    $('arChalName').textContent = rightStu.name;
    renderSeat('champ'); renderSeat('chal');
    startTimer();
    renderBanner(); renderPicks();
    if (window.XKS) window.XKS.drum();
    tts(LOG.champ ? window.XKA.open(leftStu.name, rightStu.name, LOG.streak)
      : window.XKA.first(leftStu.name, rightStu.name));
  }
  function bumpPlayed(sid) {
    if (!sid) return;
    LOG.played[sid] = (LOG.played[sid] || 0) + 1;
    LOG.allPlayed[sid] = (LOG.allPlayed[sid] || 0) + 1;
  }

  /* ================= 面板渲染 ================= */
  function seatEl(key, suffix) { return $(key === 'champ' ? 'arChamp' + suffix : 'arChal' + suffix); }
  function renderSeat(key) {
    var S = key === 'champ' ? AR.left : AR.right;
    var i = S.idx;
    seatEl(key, 'Name').textContent = S.name || '—';
    seatEl(key, 'Score').textContent = S.score;
    seatEl(key, 'Prog').style.width = (S.seq.length ? Math.round(i / S.seq.length * 100) : 0) + '%';
    seatEl(key, 'ProgText').textContent = '已完成 ' + i + ' / ' + S.seq.length + ' 题';
    var body = seatEl(key, 'Body');
    if (i >= S.seq.length) { body.innerHTML = '<div class="ar-wait">🎉 答完啦，等另一边收尾。</div>'; fitSeat(key); return; }
    var q = S.seq[i];
    seatEl(key, 'Meta').innerHTML = '<span class="artype">' + esc(q.qt || '') + '</span><span>第 ' + (i + 1) + ' / ' + S.seq.length + ' 题</span>' +
      (q.kd ? '<span>' + esc(q.kd) + '</span>' : '');
    body.innerHTML = '';
    var stem = document.createElement('div'); stem.className = 'ar-qstem'; stem.textContent = window.XK.cleanStem(q.s); body.appendChild(stem);
    var opts = document.createElement('div'); opts.className = 'ar-opts';
    var selNow = S.answered[i] ? S.answered[i].sel : [];
    q.o.forEach(function (o) {
      var d = document.createElement('div'); d.className = 'ar-opt';
      var k = document.createElement('div'); k.className = 'k'; k.textContent = o[0];
      var v = document.createElement('div'); v.className = 'v'; v.textContent = (o[1] && o[1] !== o[0]) ? o[0] + '. ' + o[1] : o[0];
      d.appendChild(k); d.appendChild(v);
      if (selNow.indexOf(o[0]) !== -1) d.classList.add('sel');
      d.setAttribute('data-key', o[0]);
      d.tabIndex = 0; d.setAttribute('role', 'button');
      d.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); d.click(); } };
      d.onclick = function () { pickOpt(key, o[0]); };
      opts.appendChild(d);
    });
    body.appendChild(opts);
    var fb = document.createElement('div'); fb.className = 'ar-fb'; fb.id = key === 'champ' ? 'arChampFb' : 'arChalFb'; body.appendChild(fb);
    var btn = document.createElement('button'); btn.className = 'ar-submit'; btn.id = key === 'champ' ? 'arChampSubmit' : 'arChalSubmit';
    btn.textContent = selNow.length ? '提交本题' : '选择答案后提交';
    btn.disabled = S.locked || S.done || !selNow.length;
    btn.onclick = function () { submitSeat(key); };
    body.appendChild(btn);
    fitSeat(key);
  }
  function pickOpt(key, k) {
    var S = key === 'champ' ? AR.left : AR.right;
    if (S.locked || S.done || !AR.running) return;
    var q = S.seq[S.idx];
    if (q.qt === '多选') {
      if (!S.answered[S.idx]) S.answered[S.idx] = { sel: [] };
      var arr = S.answered[S.idx].sel, at = arr.indexOf(k);
      if (at === -1) arr.push(k); else arr.splice(at, 1);
    } else S.answered[S.idx] = { sel: [k] };
    var selNow = S.answered[S.idx] ? S.answered[S.idx].sel : [];
    seatEl(key, 'Body').querySelectorAll('.ar-opt').forEach(function (o) {
      o.classList.toggle('sel', selNow.indexOf(o.getAttribute('data-key')) !== -1);
    });
    var btn = seatEl(key, 'Submit');
    btn.disabled = !selNow.length; btn.textContent = '提交本题';
  }
  function submitSeat(key) {
    var S = key === 'champ' ? AR.left : AR.right;
    if (S.locked || S.done || !AR.running) return;
    var q = S.seq[S.idx];
    var sel = (S.answered[S.idx] || { sel: [] }).sel.slice();
    if (!sel.length) return;
    var right = window.XK.judge(q, sel);
    S.locked = true;
    S.answered[S.idx] = { sel: sel, right: right };
    if (right) S.score++;
    seatEl(key, 'Body').querySelectorAll('.ar-opt').forEach(function (o) {
      var k = o.getAttribute('data-key');
      var isAns = (q.qt === '多选') ? String(q.a).indexOf(k) !== -1 : (k === String(q.a).trim());
      if (isAns) { o.classList.remove('dim'); o.classList.add('correct'); }
      else if (sel.indexOf(k) !== -1) { o.classList.remove('dim'); o.classList.add('wrong'); }
      else o.classList.add('dim');
    });
    var fb = seatEl(key, 'Fb');
    fb.className = 'ar-fb show ' + (right ? 'ok' : 'err');
    fb.textContent = right ? '✅ 答对！' : '❌ 答错咯，正确答案：' + q.a;
    if (window.XKS) { if (right) window.XKS.correct(); else window.XKS.wrong(); }
    if (window.XKP) tts(right ? window.XKP.pickPraise(S.name, S.score) : window.XKP.pickEncourage(S.name));
    var btn = seatEl(key, 'Submit');
    btn.disabled = true; btn.textContent = '已提交';
    setTimeout(function () {
      btn.disabled = false; btn.textContent = '下一题 →';
      btn.onclick = function () { nextSeat(key); };
      fitSeat(key);
    }, 400);
    seatEl(key, 'Score').textContent = S.score;
    seatEl(key, 'Prog').style.width = (S.seq.length ? Math.round(S.idx / S.seq.length * 100) : 0) + '%';
    seatEl(key, 'ProgText').textContent = '已完成 ' + S.idx + ' / ' + S.seq.length + ' 题';
  }
  function nextSeat(key) {
    var S = key === 'champ' ? AR.left : AR.right;
    S.locked = false; S.idx++;
    renderSeat(key);
    if (AR.left.idx >= AR.left.seq.length && AR.right.idx >= AR.right.seq.length) endRound('both');
  }

  /* ================= 计时 ================= */
  function startTimer() {
    stopTimer();
    AR.timerId = setInterval(function () {
      AR.leftSec--;
      if (AR.leftSec <= 0) { stopTimer(); endRound('timeup'); }
    }, 1000);
  }
  function stopTimer() { if (AR.timerId) { clearInterval(AR.timerId); AR.timerId = null; } }

  /* ================= 判定 ================= */
  function endRound(reason) {
    if (!AR.running) return;
    AR.running = false; stopTimer();
    AR.left.locked = true; AR.right.locked = true;
    var L = AR.left.score, R = AR.right.score;
    var hadChamp = !!LOG.champ;
    var winner;                       // 'champ' | 'chal'
    if (L > R) winner = 'champ';
    else if (R > L) winner = 'chal';
    else winner = hadChamp ? 'champ' : null;   // 平局：有擂主→擂主守住；第一场→加赛

    if (!hadChamp && winner === null && !AR.isExtra) {
      // 第一场打平：同批题加赛，加赛不占正式场次
      saveLog();
      toast('第一场打平，同批题再加赛一场');
      tts('第一场打平，加赛一场，定出第一位擂主！');
      AR.sel = [sideStudent('champ'), sideStudent('chal')];
      AR.isExtra = true;
      setTimeout(function () { startRound(); }, 900);
      return;
    }
    if (!hadChamp && winner === null) winner = 'champ';   // 加赛仍平局：按左判，避免死循环

    var champStu = sideStudent('champ'), chalStu = sideStudent('chal');
    LOG.results.push({ n: LOG.round, ts: Date.now(), champSid: champStu.sid, champName: champStu.name,
      chalSid: chalStu.sid, chalName: chalStu.name, champScore: L, chalScore: R,
      winner: winner, draw: L === R, reason: reason, qcount: AR.left.seq.length });

    if (winner === 'champ') {
      LOG.streak = (LOG.streak || 0) + 1;
      LOG.champ = { sid: champStu.sid, name: champStu.name };
      if (!LOG.best || LOG.streak > LOG.best.streak) LOG.best = { sid: champStu.sid, name: champStu.name, streak: LOG.streak };
      tts(window.XKA.hold(champStu.name, LOG.streak));
      toast('👑 ' + champStu.name + ' 守住擂台（连胜 ' + LOG.streak + ' 场）');
      if (hadChamp) tts(window.XKA.fall(chalStu.name));
    } else {
      LOG.champ = { sid: chalStu.sid, name: chalStu.name };
      LOG.streak = 1;
      if (!LOG.best || LOG.streak > LOG.best.streak) LOG.best = { sid: chalStu.sid, name: chalStu.name, streak: LOG.streak };
      if (window.XKS) window.XKS.oust();
      tts(window.XKA.oust(champStu.name, chalStu.name));
      toast('🥊 擂台易主！新擂主 ' + chalStu.name);
    }
    saveLog();
    // 台上只演「现在这一场」：打完就把名字和分数从座位上撤下。
    // 不清的话，挑战者赢了之后左席（新擂主）和右席显示同一个人，投屏上看着像坏了。
    $('arChalName').textContent = '虚位以待';
    seatEl('champ', 'Score').textContent = '0';
    seatEl('chal', 'Score').textContent = '0';
    seatEl('champ', 'ProgText').textContent = '等下一场开始';
    seatEl('chal', 'ProgText').textContent = '等下一位上台';
    seatEl('champ', 'Meta').innerHTML = '';
    seatEl('chal', 'Meta').innerHTML = '';
    seatEl('champ', 'Body').innerHTML = '<div class="ar-wait">👑 擂主在座位上等挑战。</div>';
    seatEl('chal', 'Body').innerHTML = '<div class="ar-wait">🥊 从下面卡片挑一位上台踢馆（或点「直接随机」）。</div>';
    AR.sel = []; AR.picks = [];      // 下一场重新给 3 个候选
    renderBanner(); renderPicks();
    if (LOG.round >= CFG.rounds) finish();
  }
  function sideStudent(key) {
    var S = key === 'champ' ? AR.left : AR.right;
    return { sid: S.sid, name: S.name };
  }

  /* ================= 结算 ================= */
  function finish() {
    var rs = roster();
    var rows = rs.map(function (s) {
      var wins = 0, games = 0;
      LOG.results.forEach(function (r) {
        if (r.champSid === s.sid) { games++; if (r.winner === 'champ') wins++; }
        if (r.chalSid === s.sid) { games++; if (r.winner === 'chal') wins++; }
      });
      return { sid: s.sid, name: s.name, games: games, wins: wins };
    }).filter(function (x) { return x.games > 0; }).sort(function (a, b) { return b.wins - a.wins || b.games - a.games; });

    var never = rs.filter(function (s) { return !LOG.allPlayed[s.sid]; });
    var champ = LOG.champ;
    $('arResMain').innerHTML = champ
      ? '本场擂台结束：最终擂主 <b>' + esc(champ.name) + '</b>，连胜 ' + LOG.streak + ' 场，共打 ' + LOG.results.length + ' 场。'
      : '本场擂台结束，没能定出擂主（' + LOG.results.length + ' 场）。';
    var tb = $('arResTable'); tb.innerHTML = '';
    if (!rows.length) tb.innerHTML = '<div class="muted">还没有战绩</div>';
    rows.forEach(function (x, i) {
      var d = document.createElement('div'); d.className = 'ar-row';
      d.innerHTML = '<span>' + (i + 1) + '. ' + esc(x.name) + '</span><span>上场 <b>' + x.games + '</b> · 赢 <b>' + x.wins + '</b></span>';
      tb.appendChild(d);
    });
    var nv = $('arResNever');
    nv.innerHTML = never.length
      ? never.map(function (s) { return esc(s.name); }).join('、') + '<br><span class="muted">共 ' + never.length + ' 人。下一轮擂台优先安排他们。</span>'
      : '<span class="muted">全班都上过台了 👍</span>';
    $('arResultMask').classList.remove('hidden');
    if (window.XKS) window.XKS.fanfare();
    if (champ) tts(window.XKA.final(champ.name, LOG.streak));
    else tts('本场擂台结束，没能定出擂主，下一节课继续。');
  }

  /* ================= 一屏自适应（复用 engine 纯函数） ================= */
  function fitSeat(key) {
    var root = seatEl(key, 'Seat');
    if (!root || !root.scrollHeight) return;
    root.style.removeProperty('--arfs');
    root.classList.remove('ar-pkfit-scroll');
    var base = parseFloat(getComputedStyle(root).getPropertyValue('--arfs')) || 22;
    var res = window.XK.fitToBox(base, function (fs) {
      root.style.setProperty('--arfs', fs + 'px');
      return { h: root.scrollHeight, avail: root.clientHeight };
    }, ARFS_MIN);
    root.style.setProperty('--arfs', res.fs + 'px');
    root.classList.toggle('ar-pkfit-scroll', res.scroll);
  }

  /* ================= 设置弹窗 ================= */
  function renderCfgMods() {
    normalizeMods();
    var box = $('arCfgMods'); if (!box) return;
    box.innerHTML = '';
    var codes = modCodes();
    if (!codes.length) {
      var tip = document.createElement('div'); tip.className = 'ar-empty';
      tip.textContent = '当前题库没有章节信息，按整个题库抽题。';
      box.appendChild(tip);
    }
    codes.forEach(function (code) {
      var meta = (window.BANK_META || []).filter(function (m) { return m.code === code; })[0] || {};
      var d = document.createElement('div');
      d.className = 'ar-mod' + (CFG.mods[code] ? ' on' : '');
      d.setAttribute('data-code', code);
      var nm = document.createElement('span'); nm.className = 'mn'; nm.textContent = meta.disp || meta.name || code;
      var mi = document.createElement('span'); mi.className = 'mi'; mi.textContent = modCountOf(code) + ' 题';
      var ck = document.createElement('span'); ck.className = 'ck';
      d.appendChild(nm); d.appendChild(mi); d.appendChild(ck);
      d.onclick = function () { normalizeMods(); CFG.mods[code] = !CFG.mods[code]; saveCfg(); renderCfgMods(); };
      box.appendChild(d);
    });
    var pool = window.XK.bankPool(BANK, CFG.mods);
    $('arCfgModsCount').textContent = '已选 ' + (function () { var n = 0; for (var k in CFG.mods) if (CFG.mods[k]) n++; return n; })() +
      ' 章 · 可抽 ' + pool.length + ' 题' + (pool.length === BANK.length ? '（＝全库）' : '');
  }

  /* ================= 事件绑定 ================= */
  function bind() {
    $('arGo').onclick = startRound;
    $('arChangeQ').onclick = changeArenaQ;
    $('arSrcBank').onclick = function () { CFG.source = 'bank'; saveCfg(); renderArSource(); };
    $('arSrcPrep').onclick = function () { CFG.source = 'prep'; saveCfg(); renderArSource(); if (!(load('xkc.prep.v1', []) || []).length) toast('备课夹还是空的：先去首页「📋 备课夹」勾题'); };
    document.addEventListener('keydown', arenaKeys);
    $('arRandPick').onclick = function () {
      var cs = ensurePicks();
      if (cs.length < needCount()) { toast('擂台赛至少需要 2 人名单，请先在双人 PK 里导入花名册'); return; }
      AR.sel = cs.slice(0, needCount());
      renderPicks();
    };
    $('arBack').onclick = function () { if (window.__ARENA_LEAVE) window.__ARENA_LEAVE(); };
    var ah = $('arHome');
    if (ah) {
      if (window.__ARENA_GO_HOME) { ah.style.display = ''; ah.onclick = function () { window.__ARENA_GO_HOME(); }; }
      else ah.style.display = 'none';
    }
    $('arRestart').onclick = function () {
      if (AR.running && !confirm('这一场还在进行中，确定重开一轮擂台？')) return;
      LOG = blankLog(); saveLog();
      AR.sel = []; AR.picks = []; AR.pool = null; AR.poolPos = 0;
      AR.running = false; stopTimer();
      $('arChampBody').innerHTML = '<div class="ar-wait">擂台已重置。挑两位同学打第一场。</div>';
      $('arChalBody').innerHTML = '<div class="ar-wait">等待上台。</div>';
      $('arChampScore').textContent = '0'; $('arChalScore').textContent = '0';
      renderBanner(); renderPicks();
      toast('已重开一轮擂台（本课累计上场次数保留统计）');
    };
    $('arStop').onclick = function () {
      if (AR.running) { toast('请先打完或重开这一场，再结算'); return; }
      if (!LOG.results.length) { toast('还没打过任何一场，没有可结算的战绩'); return; }
      finish();
    };
    $('arResClose').onclick = function () { $('arResultMask').classList.add('hidden'); };
    $('arResAgain').onclick = function () {
      $('arResultMask').classList.add('hidden');
      LOG = blankLog(); saveLog();
      AR.sel = []; AR.picks = []; AR.pool = null; AR.poolPos = 0;
      renderBanner(); renderPicks();
    };
    $('arCfg').onclick = function () {
      $('arCfgCount').value = CFG.count; $('arCfgMinutes').value = CFG.minutes; $('arCfgRounds').value = CFG.rounds;
      renderArSource();
      renderCfgMods();
      $('arCfgMask').classList.remove('hidden');
    };
    $('arCfgClose').onclick = function () { $('arCfgMask').classList.add('hidden'); };
    $('arCfgModsAll').onclick = function () { normalizeMods(); for (var k in CFG.mods) CFG.mods[k] = true; saveCfg(); renderCfgMods(); };
    $('arCfgModsNone').onclick = function () { normalizeMods(); for (var k in CFG.mods) CFG.mods[k] = false; saveCfg(); renderCfgMods(); };
    $('arCfgSave').onclick = function () {
      CFG.count = Math.max(1, Math.min(20, parseInt($('arCfgCount').value, 10) || 5));
      CFG.minutes = Math.max(1, Math.min(30, parseInt($('arCfgMinutes').value, 10) || 2));
      CFG.rounds = Math.max(3, Math.min(40, parseInt($('arCfgRounds').value, 10) || 10));
      saveCfg(); renderBanner(); renderPicks();
      $('arCfgMask').classList.add('hidden');
      toast('已保存：每场 ' + CFG.count + ' 题 / ' + CFG.minutes + ' 分钟，一轮 ' + CFG.rounds + ' 场');
    };
    $('arSnd').onclick = function () {
      var v = !sndOn();
      save(K_SND, v);
      $('arSnd').textContent = v ? '🔊 音效开' : '🔇 音效关';
      toast(v ? '音效已打开' : '音效已关闭（擂台与双人 PK 共用这个开关）');
    };
    $('arSnd').textContent = sndOn() ? '🔊 音效开' : '🔇 音效关';
  }

  /* 单测钩子：只读快照 + 纯函数出口 */
  window.__ARENA_TEST = {
    cfg: function () { return CFG; },
    log: function () { return LOG; },
    ar: function () { return AR; },
    bank: function () { return BANK; },
    pool: function () { normalizeMods(); return window.XK.bankPool(BANK, CFG.mods); },
    candidates: function () { return AR.picks; },
    needCount: needCount,
    endRound: function (reason) { endRound(reason || 'both'); },
    // 供 tools/gate-fit.js 用真实渲染路径逐题量高度（不是重新实现一遍 fitSeat）
    render: function (key) { renderSeat(key); },
    select: function (a, b) {
      var cs = ensurePicks();
      AR.sel = b === undefined ? [cs[a]] : [cs[a], cs[b]];
      renderPicks();
      return AR.sel.map(function (s) { return s.name; });
    },
    answerAll: function (key, right) {
      var S = key === 'champ' ? AR.left : AR.right;
      for (var i = S.idx; i < S.seq.length; i++) {
        var q = S.seq[i];
        var k = right ? q.a.charAt(0) : (q.o.filter(function (o) { return o[0] !== q.a; })[0] || q.o[0])[0];
        S.answered[i] = { sel: [k], right: window.XK.judge(q, [k]) };
        if (window.XK.judge(q, [k])) S.score++;
        S.idx = i + 1;
      }
      S.done = true;
      return S.score;
    }
  };

  /* ================= 启动 ================= */
  window.__ARENA_REFRESH = function () {
    try { renderBanner(); renderPicks(); } catch (e) { if (window.console) console.error('[ARENA] refresh:', e); }
  };
  window.__ARENA_LEAVE = function () { if (window.__ARENA_ONLEAVE) window.__ARENA_ONLEAVE(); };

  document.addEventListener('click', function () { if (window.XKS) { try { window.XKS.click(); } catch (e) { } } }, { once: true });
  try { renderBanner(); } catch (e) { if (window.console) console.error('[ARENA] init banner:', e); }
  try { renderPicks(); } catch (e) { if (window.console) console.error('[ARENA] init picks:', e); }
  try { bind(); } catch (e) { if (window.console) console.error('[ARENA] bind:', e); }
};
