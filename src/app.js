/* =====================================================================
 * 学考冲刺通 · 应用层（依赖同页内嵌的 engine.js 与 data.js）
 * ===================================================================== */
(function () {
  'use strict';
  var XK = window.XK, BANK = window.BANK || [], META = window.BANK_META || [];
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 档案 ---------- */
  /* ---------- 主题（默认浅色） ---------- */
  var THEME_KEY = 'xkc.theme';
  function currentTheme() {
    try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { }
    var ic = t === 'dark' ? '☀️' : '🌙';
    var lb = t === 'dark' ? '浅色' : '深色';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.innerHTML = '<span class="tb-ic">' + ic + '</span><span class="tb-lb">' + lb + '</span>';
      b.setAttribute('title', '切换到' + lb + '模式');
    });
  }
  function toggleTheme() { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }

  /* ---------- 默认题量闸门：按钮行为统一在 bank-gate.js，这里启动时刷新一次文案 ---------- */
  function renderBankGateBtn() {
    var G = window.XK_BANK_GATE;
    if (G && G.renderButton) G.renderButton();
  }

  var PKEY = 'xkc.profile.v1';
  var P = load();
  function load() {
    try {
      var raw = localStorage.getItem(PKEY);
      if (!raw) return XK.newProfile();
      var p = XK.validateProfile(JSON.parse(raw));
      return p || XK.newProfile();
    } catch (e) { return XK.newProfile(); }
  }
  function save() { try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) { } }
  function totalAnswered() {
    var n = 0; Object.keys(P.answers).forEach(function (k) { n += P.answers[k].a + P.answers[k].w; });
    return n;
  }
  function refreshBadges() {
    var wq = XK.wrongQueue(BANK, P).length;
    var wk = XK.weakSpots(BANK, META, P, 8).weak.length;
    var bw = $('badgeWrong'); if (bw) bw.textContent = wq > 0 ? wq : '';
    var bd = $('badgeDiag'); if (bd) bd.textContent = wk > 0 ? wk : '';
  }

  /* ---------- 语音朗读（多音色） ---------- */
  var speaking = false;
  var TTS_PREF = { voiceURI: '', rate: 1.1, rand: true };
  function loadTtsPref() {
    try {
      TTS_PREF.voiceURI = localStorage.getItem('xkc.tts.voice') || '';
      TTS_PREF.rate = parseFloat(localStorage.getItem('xkc.tts.rate')) || 1.1;
      TTS_PREF.rand = localStorage.getItem('xkc.tts.rand') !== '0';
    } catch (e) { }
  }
  function saveTtsPref() {
    try {
      localStorage.setItem('xkc.tts.voice', TTS_PREF.voiceURI);
      localStorage.setItem('xkc.tts.rate', String(TTS_PREF.rate));
      localStorage.setItem('xkc.tts.rand', TTS_PREF.rand ? '1' : '0');
    } catch (e) { }
  }
  function zhVoices() {
    if (!('speechSynthesis' in window)) return [];
    return speechSynthesis.getVoices().filter(function (v) { return /^zh/i.test(v.lang); });
  }
  function currentVoice() {
    var vs = zhVoices();
    if (!vs.length) return null;
    for (var i = 0; i < vs.length; i++) if (vs[i].voiceURI === TTS_PREF.voiceURI) return vs[i];
    return vs[0];
  }
  // 通用朗读入口（表扬/读题/试听共用）：返回 utterance 或 null
  function speak(text, opts) {
    opts = opts || {};
    if (!('speechSynthesis' in window)) return null;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var vs = zhVoices();
    var v;
    if (TTS_PREF.rand && vs.length > 1) {
      v = vs[Math.floor(Math.random() * vs.length)]; // 每次随机音色（表扬/读题更有课堂氛围）
    } else {
      v = currentVoice();
    }
    if (v) u.voice = v;
    u.lang = 'zh-CN';
    u.rate = opts.rate || TTS_PREF.rate || 1;
    u.pitch = opts.pitch || 1;
    if (opts.onend) u.onend = opts.onend;
    if (opts.onerror) u.onerror = opts.onerror;
    speechSynthesis.speak(u);
    return u;
  }
  function stopSpeak() { if ('speechSynthesis' in window) { speechSynthesis.cancel(); speaking = false; syncSpeakBtn(); } }
  function speakCurrent() {
    if (!('speechSynthesis' in window)) { alert('当前浏览器不支持朗读'); return; }
    if (speaking) { stopSpeak(); return; }
    var q = S.list[S.idx]; if (!q) return;
    var parts = [XK.cleanStem(q.s)];
    q.o.forEach(function (op) { parts.push(op[0] + '，' + (op[1] || op[0])); });
    speaking = true; syncSpeakBtn();
    speak(parts.join('。'), {
      onend: function () { speaking = false; syncSpeakBtn(); },
      onerror: function () { speaking = false; syncSpeakBtn(); }
    });
  }
  function syncSpeakBtn() {
    var b = $('speakBtn'); if (b) b.classList.toggle('on', speaking);
  }

  /* ---------- 课堂互动：名单 / 点名 / 表扬 ---------- */
  var ROSTER = { list: [] };              // [{sid, name}]
  var PICK = { name: '', sid: '' };       // 当前题被点学生
  var DRAW = { queue: [], rolling: null, speaking: false, noRepeat: true }; // 不重复抽取袋

  function rosterHash() {
    return ROSTER.list.map(function (s) { return s.name + (s.sid ? ':' + s.sid : ''); }).join('|');
  }
  function loadRoster() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem('xkc.roster') || 'null'); } catch (e) { }
    if (Array.isArray(raw && raw.list)) {
      ROSTER.list = raw.list;
    } else if (raw === null) {
      // 名单缺省：沿用 PK 内置班级花名册（36 人）——首次运行种子一次；
      // 「🗑 清空名单」会写入空列表（键存在），不会被本逻辑再次覆盖
      var seedTries = 0;
      (function seedTry() {
        try {
          // 页面还在解析时（readyState=loading）pk-app 尚未执行：等它就绪再种子
          if ((!window.XK_DEFAULT_ROSTER || !window.XK_DEFAULT_ROSTER.length) && seedTries < 40) {
            seedTries++;
            setTimeout(seedTry, 50);
            return;
          }
          var pkRoster = null;
          try { pkRoster = JSON.parse(localStorage.getItem('pk.roster') || 'null'); } catch (e) { }
          var src = (Array.isArray(pkRoster) && pkRoster.length) ? pkRoster : window.XK_DEFAULT_ROSTER;
          if (Array.isArray(src) && src.length) {
            ROSTER.list = src.map(function (s) {
              return { sid: s.sid || '', name: s.name || '' };
            }).filter(function (s) { return s.name; });
            saveRoster();
            try { renderClassroom(); } catch (e) { }
          }
        } catch (e) { }
      })();
    }
    try {
      var bag = JSON.parse(localStorage.getItem('xkc.drawbag') || '{}');
      if (bag.hash === rosterHash() && Array.isArray(bag.queue)) DRAW.queue = bag.queue;
    } catch (e) { }
  }
  function saveRoster() {
    try { localStorage.setItem('xkc.roster', JSON.stringify({ list: ROSTER.list, savedAt: Date.now() })); } catch (e) { }
    saveBag();
  }
  function saveBag() {
    try { localStorage.setItem('xkc.drawbag', JSON.stringify({ hash: rosterHash(), queue: DRAW.queue })); } catch (e) { }
  }
  // 名单文本解析：每行「姓名」或「学号,姓名」或「学号␣姓名」，# 开头为注释
  function parseRoster(text) {
    var out = [], seen = {};
    String(text || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      var parts = line.split(/[,，\t ]+/);
      var name = parts[parts.length - 1], sid = parts.length > 1 ? parts.slice(0, parts.length - 1).join('') : '';
      name = name.trim(); sid = sid.trim();
      if (!name || name.length > 24) return;
      if (seen[name]) return;
      seen[name] = 1;
      out.push({ sid: sid, name: name });
    });
    return out;
  }
  // 不重复抽取：袋子空了重洗（reshuffled=true 提示一轮结束）；关闭开关则纯随机
  function drawStudent() {
    var names = ROSTER.list.map(function (s) { return s.name; });
    if (!names.length) return null;
    if (DRAW.noRepeat === false) {
      return { name: names[Math.floor(Math.random() * names.length)], reshuffled: false };
    }
    if (!DRAW.queue.length) {
      DRAW.queue = XK_SHUFFLE(names.slice());
      var pick = DRAW.queue.shift();
      saveBag();
      return { name: pick, reshuffled: true };
    }
    var name = DRAW.queue.shift();
    saveBag();
    return { name: name, reshuffled: false };
  }
  function XK_SHUFFLE(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  // 点名动画：全屏遮罩滚动 1.4s → 减速定格 → 号角
  function runDraw() {
    if (!ROSTER.list.length) { alert('先在首页「课堂互动」里导入学生名单'); return; }
    if (DRAW.rolling) return;
    var mask = $('drawMask'), nameEl = $('drawName'), tipEl = $('drawTip');
    mask.classList.remove('hidden');
    tipEl.textContent = '';
    var names = ROSTER.list.map(function (s) { return s.name; });
    var ticks = 0, total = 18;
    XKS.unlock();
    DRAW.rolling = setInterval(function () {
      ticks++;
      nameEl.textContent = names[Math.floor(Math.random() * names.length)];
      if (ticks % 3 === 0) XKS.tick();
      if (ticks >= total) {
        clearInterval(DRAW.rolling); DRAW.rolling = null;
        var res = drawStudent();
        nameEl.textContent = res.name;
        PICK.name = res.name;
        PICK.sid = (ROSTER.list.filter(function (s) { return s.name === res.name; })[0] || {}).sid || '';
        PICK.qIdx = S.idx;
        XKS.fanfare();
        tipEl.textContent = (res.reshuffled ? '🔄 全班轮完一轮，重新开始！　' : '') + '请 ' + res.name + ' 同学上来答题！';
        renderQuestion(); // 刷新作答学生徽章
        setTimeout(function () { speak('恭喜' + res.name + '同学，被抽中！请上台答题！'); }, 350);
      }
    }, 78);
  }
  function closeDraw() {
    $('drawMask').classList.add('hidden');
  }
  // 课堂互动设置卡渲染
  function renderClassroom() {
    var n = ROSTER.list.length;
    var sidN = ROSTER.list.filter(function (s) { return s.sid; }).length;
    var rc = $('rosterCount');
    if (rc) rc.textContent = n ? ('已存 ' + n + ' 人（含学号 ' + sidN + ' 人）· 剩余未点 ' + (DRAW.queue.length || n) + ' 人') : '尚未导入名单';
    var ta = $('rosterText');
    if (ta && !ta.value && n) {
      ta.value = ROSTER.list.map(function (s) { return (s.sid ? s.sid + ',' : '') + s.name; }).join('\n');
    }
    var sw = $('sfxSw'); if (sw) sw.classList.toggle('on', XKS.isEnabled());
    var dt = $('drawToggle'); if (dt) dt.classList.toggle('on', DRAW.noRepeat !== false);
    // 音色下拉
    var sel = $('ttsVoice');
    if (sel) {
      var vs = zhVoices();
      if (vs.length) {
        sel.innerHTML = '';
        vs.forEach(function (v) {
          var o = document.createElement('option');
          o.value = v.voiceURI;
          o.textContent = v.name.replace(/Microsoft |Online \(Natural\)|- /g, '') + (v.localService ? '' : '（在线）');
          sel.appendChild(o);
        });
      }
      if (!sel.options.length) {
        var o0 = document.createElement('option');
        o0.value = ''; o0.textContent = '系统默认音色';
        sel.appendChild(o0);
      }
      sel.value = TTS_PREF.voiceURI || (sel.options[0] ? sel.options[0].value : '');
    }
    var rv = $('ttsRateVal'); if (rv) rv.textContent = (TTS_PREF.rate || 1).toFixed(1) + 'x';
    var tr = $('ttsRand'); if (tr) tr.classList.toggle('on', TTS_PREF.rand === true);
  }
  // 从云端班级拉名单（需教师密钥；支持 ?teacherkey= 一次性参数）
  function fetchCloudRoster(key, silent) {
    key = (key || '').trim();
    if (!key) {
      if (typeof window.prompt === 'function') {
        key = window.prompt('输入教师密钥（见部署者 cloud/keys.json 的 teacherKey）', '') || '';
      }
      key = (key || '').trim();
    }
    if (!key) return;
    fetch('/api/students?key=' + encodeURIComponent(key)).then(function (r) {
      if (r.status === 403) throw new Error('密钥不对');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var st = (j && j.students) || [];
      if (!st.length) throw new Error('云端还没有学生数据');
      ROSTER.list = st.map(function (s) { return { sid: s.sid || '', name: s.name || s.sid }; });
      DRAW.queue = [];
      saveRoster();
      if ($('rosterText')) $('rosterText').value = '';
      renderClassroom();
      if (!silent) alert('已从云端拉取 ' + ROSTER.list.length + ' 名学生');
    }).catch(function (e) {
      alert('云端拉取失败：' + e.message);
    });
  }
  // 表扬/鼓励横幅：插入答题页顶部（投屏醒目），自动朗读
  function banner(text, kind) {
    var body = $('qbody');
    var old = body.querySelector('.cheer'); if (old) old.remove();
    var d = document.createElement('div');
    d.className = 'cheer ' + (kind === 'praise' ? 'cheer-praise' : 'cheer-encourage');
    d.textContent = text;
    body.insertBefore(d, body.firstChild);
    body.scrollTop = 0;
  }

  /* ---------- 面板切换 ---------- */
  var TABS = ['home', 'setup', 'wrong', 'diag', 'pk'];
  function markTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (el) {
      el.classList.toggle('on', el.getAttribute('data-t') === name);
    });
  }

  function showPanel(name) {
    // PK / 擂台赛要占满整屏（投屏两侧各一半），其余页保持 760px 居中列
    document.body.classList.toggle('pk-mode', name === 'pk');
    document.body.classList.toggle('arena-mode', name === 'arena');
    TABS.forEach(function (t) {
      if (t === 'pk') return; // PK 容器 id 为 pkPage，单独处理
      var el = $(t); if (el) el.classList.add('hidden');
    });
    var pkEl = document.getElementById('pkPage');
    if (pkEl) pkEl.classList.add('hidden');
    var arEl = document.getElementById('arenaPage');
    if (arEl) arEl.classList.add('hidden');
    ['prep', 'class', 'honor'].forEach(function (t) {
      var el = document.getElementById(t + 'Page');
      if (el) el.classList.add('hidden');
    });
    var npEl = document.getElementById(name + 'Page');
    if (npEl) npEl.classList.remove('hidden');
    markTab(name);
    if (name === 'arena') {
      if (arEl) arEl.classList.remove('hidden');
      if (window.__ARENA_MOUNT) window.__ARENA_MOUNT();
      if (window.__ARENA_REFRESH) window.__ARENA_REFRESH();
      var tbA = document.getElementById('tabs'); if (tbA) tbA.classList.remove('hidden');
      var nbA = document.getElementById('navbar'); if (nbA) nbA.classList.add('hidden');
      // 擂台赛不是底部页签：让所有页签都不高亮，避免和 PK 混淆
      document.querySelectorAll('.tab').forEach(function (el) { el.classList.remove('on'); });
      window.scrollTo(0, 0);
      return;
    }
    if (name === 'pk') {
      if (pkEl) { pkEl.classList.remove('hidden'); }
      if (window.__PK_MOUNT) window.__PK_MOUNT();
      if (window.__PK_REFRESH) window.__PK_REFRESH();
      var tb = document.getElementById('tabs'); if (tb) tb.classList.remove('hidden');
      var nb = document.getElementById('navbar'); if (nb) nb.classList.add('hidden');
      document.querySelectorAll('.tab').forEach(function (el) { el.classList.toggle('on', el.getAttribute('data-t') === 'pk'); });
      window.scrollTo(0, 0);
      return;
    }
    ['quiz', 'result'].forEach(function (t) { var el = $(t); if (el) el.classList.add('hidden'); });
    var target = $(name); if (target) target.classList.remove('hidden');
    var inQuiz = (name === 'quiz' || name === 'result');
    $('tabs').classList.toggle('hidden', inQuiz);
    $('navbar').classList.toggle('hidden', !inQuiz);
    document.querySelectorAll('.tab').forEach(function (el) {
      el.classList.toggle('on', el.getAttribute('data-t') === name);
    });
    window.scrollTo(0, 0);
  }
  /* ---------- 客户端模式（?client=1，启动器专用） ---------- */
  var IS_CLIENT = false;
  try {
    if (location.search.indexOf('client=1') !== -1 || localStorage.getItem('xkc.client') === '1') {
      IS_CLIENT = true;
      localStorage.setItem('xkc.client', '1');
      document.body.classList.add('client');
    }
  } catch (e) { }
  function renderTabs() {
    var bar = $('tabs');
    if (!bar) return;
    var defs = IS_CLIENT
      ? [['home', '🏠', '首页'], ['pk', '⚔️', 'PK'], ['arena', '🥊', '擂台'], ['honor', '🏆', '排行榜'], ['prep', '📋', '备课夹'], ['class', '🎲', '点名台']]
      : [['home', '🏠', '首页'], ['setup', '📝', '刷题'], ['wrong', '📕', '错题', '<span id="badgeWrong" style="color:#dc2626;font-weight:800"></span>'], ['diag', '📊', '诊断', '<span id="badgeDiag" style="color:#d97706;font-weight:800"></span>'], ['pk', '⚔️', 'PK']];
    bar.innerHTML = defs.map(function (d) {
      return '<button class="tab" data-t="' + d[0] + '"><span class="ti">' + d[1] + '</span>' + d[2] + (d[3] || '') + '</button>';
    }).join('');
    Array.prototype.forEach.call(bar.querySelectorAll('.tab'), function (el) {
      el.onclick = function () { switchTab(el.getAttribute('data-t')); };
    });
  }

  /* ---------- 前进/后退导航（hash 路由：#/home #/setup #/wrong #/diag #/pk #/arena #/quiz #/result） ---------- */
  var NAV = { routing: false, cur: null };
  function navPush(name) {
    if (NAV.routing) { NAV.routing = false; return; }   // 路由驱动的切换不再入栈
    var h = '#/' + name;
    if (location.hash === h) return;
    try { history.pushState({ nav: true }, '', h); } catch (e) { }
    NAV.cur = h;
  }
  function sessionAlive() {
    try {
      var qz = $('quiz');
      if (qz && qz.offsetParent !== null && S.list && S.list.length) return true;
      if (window.__PK_TEST && window.__PK_TEST.pk().state === 'running') return true;
      if (window.__ARENA_TEST && window.__ARENA_TEST.ar().running) return true;
    } catch (e) { }
    return false;
  }
  function routeTo(h) {
    var name = (h || '#/home').replace('#/', '') || 'home';
    if (name === 'quiz') {
      if (S.list && S.list.length) { showPanel('quiz'); try { renderQuestion(); } catch (e) { } }
      else { try { history.replaceState({ nav: true }, '', '#/home'); } catch (e) { } switchTab('home'); }
      return;
    }
    var tabsAvail = IS_CLIENT ? ['home', 'pk', 'arena', 'honor', 'prep', 'class'] : TABS;
    if (tabsAvail.indexOf(name) !== -1) switchTab(name);
    else { try { history.replaceState({ nav: true }, '', '#/home'); } catch (e) { } switchTab('home'); }
  }
  function navBack() { try { history.back(); } catch (e) { } }
  function navFwd() { try { history.forward(); } catch (e) { } }
  window.XKNav = { back: navBack, forward: navFwd, rehash: routeTo };
  window.addEventListener('popstate', function () {
    var h = location.hash || '#/home';
    if (sessionAlive() && h !== NAV.cur) {
      if (!confirm('答题或对局还在进行中，确定退出并返回？')) {
        try { history.pushState({ nav: true }, '', NAV.cur); } catch (e) { }
        return;                                            // 留在原视图
      }
      stopSpeak();
    }
    NAV.routing = true;
    routeTo(h);
  });

  function switchTab(name) {
    navPush(name);
    stopSpeak();
    refreshBadges();
    if (name === 'home') renderHome();
    if (name === 'wrong') renderWrong();
    if (name === 'diag') renderDiag();
    if (name === 'honor') { try { renderHonorPage(); } catch (e) { } }
    if (name === 'prep') { try { renderPrepMgr(); } catch (e) { } }
    if (name === 'class') { try { renderClassPage(); } catch (e) { } }
    showPanel(name);
  }

  /* ---------- 首页 ---------- */
  /* ---------- 备课夹（课前挑题 → PK/擂台按勾选顺序出） ---------- */
  var PREP_KEY = 'xkc.prep.v1', prepPage = 0;
  var prepFilter = { m: '', qt: '', kw: '' };
  function prepIds() { try { var v = JSON.parse(localStorage.getItem(PREP_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function prepSave(ids) {
    try { localStorage.setItem(PREP_KEY, JSON.stringify(ids)); } catch (e) { }
    try { window.__CLASSROOM_SYNC && window.__CLASSROOM_SYNC.mark('prep'); } catch (e) { }
  }
  function prepToggle(qid) {
    var ids = prepIds(), i = ids.indexOf(qid);
    if (i === -1) ids.push(qid); else ids.splice(i, 1);
    prepSave(ids);
  }
  function prepFiltered() {
    var mod = prepFilter.m, qt = prepFilter.qt, kw = prepFilter.kw;
    return BANK.filter(function (q) {
      if (mod && q.m !== mod) return false;
      if (qt && q.qt !== qt) return false;
      if (kw && String(q.s).toLowerCase().indexOf(kw) === -1) return false;
      return true;
    });
  }
  function renderPrepMgr() {
    var modSels = document.querySelectorAll('.j-prepMod');
    Array.prototype.forEach.call(modSels, function (modSel) {
      if (!modSel.options.length) {
        var o0 = document.createElement('option'); o0.value = ''; o0.textContent = '全部模块';
        modSel.appendChild(o0);
        (window.BANK_META || []).forEach(function (m) {
          var op = document.createElement('option'); op.value = m.code; op.textContent = m.disp;
          modSel.appendChild(op);
        });
        modSel.value = prepFilter.m;
      }
    });
    var ids = prepIds(), chosen = new Set(ids);
    var list = prepFiltered();
    var PER = 30, pages = Math.max(1, Math.ceil(list.length / PER));
    if (prepPage >= pages) prepPage = pages - 1;
    if (prepPage < 0) prepPage = 0;
    Array.prototype.forEach.call(document.querySelectorAll('.j-prepList'), function (box) {
      var html = '';
      list.slice(prepPage * PER, prepPage * PER + PER).forEach(function (q) {
        var id = XK.qidOf(q), on = chosen.has(id);
        html += '<div class="prep-item' + (on ? ' on' : '') + '" data-qid="' + id + '">' +
          '<span class="ptag">[' + esc(q.qt) + ']</span><span class="pt">' + esc(String(q.s).slice(0, 46)) + '</span>' +
          '<span class="pact">' + (on ? '✓ 已夹' : '＋ 加入') + '</span></div>';
      });
      box.innerHTML = html || '<div class="empty">没有符合条件的题目</div>';
      Array.prototype.forEach.call(box.querySelectorAll('.prep-item'), function (el) {
        el.onclick = function () { prepToggle(el.getAttribute('data-qid')); renderPrepMgr(); };
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.j-prepPage'), function (pg) {
      pg.textContent = '第 ' + (prepPage + 1) + '/' + pages + ' 页 · 符合 ' + list.length + ' 题';
    });
    Array.prototype.forEach.call(document.querySelectorAll('.j-prepStat'), function (st) {
      st.textContent = '已夹 ' + ids.length + ' 题';
    });
    Array.prototype.forEach.call(document.querySelectorAll('.j-prepChosen'), function (ch) {
      var r = XK.resolvePrep(BANK, ids);
      var chips = r.list.map(function (q, i) {
        return '<span class="chip">' + (i + 1) + '. ' + esc(String(q.s).slice(0, 18)) + '</span>';
      }).join('');
      ch.innerHTML = '出题顺序（勾选顺序）：<br>' +
        (chips || '<span class="muted">还没挑题——点上面列表里的题目加入备课夹</span>') +
        (r.missing ? '<br><span class="muted">（' + r.missing + ' 题因题库更新已失效，自动跳过）</span>' : '');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.j-prepMod'), function (sel) {
      if (prepFilter.m !== undefined && sel.value !== prepFilter.m) sel.value = prepFilter.m;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.j-prepQt'), function (sel) {
      if (prepFilter.qt !== undefined && sel.value !== prepFilter.qt) sel.value = prepFilter.qt;
    });
  }
  function renderClassPage() {
    var el = $('classRosterStat');
    if (!el) return;
    var n = ROSTER.list.length;
    el.textContent = n
      ? ('名单已就绪：' + n + ' 人（剩余未点 ' + (DRAW.queue.length || n) + ' 人）——点下方按钮开始随机点名')
      : '名单为空——回首页「课堂互动」导入名单后再点名';
  }
  function syncPrepBtn() {
    try {
      var b = $('prepBtn');
      if (!b || !S.list || !S.list.length) return;
      var q = S.list[S.idx];
      if (!q) return;
      var on = prepIds().indexOf(XK.qidOf(q)) !== -1;
      b.textContent = on ? '📋 已夹' : '📋 备课';
      b.classList.toggle('on', on);
    } catch (e) { }
  }
  function renderHonor() {
    var body = $('honorBody');
    if (!body) return;
    try { renderHonorPage(); } catch (e) { }
    var matches = [], arenaLog = {};
    try { matches = JSON.parse(localStorage.getItem('pk.matches') || '[]') || []; } catch (e) { }
    try { arenaLog = JSON.parse(localStorage.getItem('pk.arena.v1') || '{}') || {}; } catch (e) { }
    // 数据以合并后的 localStorage 为准（CSYNC 已在页面加载时从服务端恢复）
    var h = XK.aggregateHonor(matches, arenaLog);
    var king = h.pkTop[0];
    var html = '<div class="hb-king">👑 班级擂王：<b>' + esc(king ? king.name : '虚位以待') + '</b>' +
      '<span class="muted">（累计获胜 ' + (king ? king.wins : 0) + ' 场）</span></div>';
    html += '<div>📅 今日：' + (h.today.games ? h.today.games + ' 场 PK，胜者 ' + esc(h.today.winners.join('、')) : '还没开打') +
      ' ｜ 🥊 本周擂主：' + esc(h.weekly.length ? h.weekly[0].name : '虚位以待') + '</div>';
    html += '<details><summary>📋 展开完整榜单</summary>' +
      '<div class="h-sec">⚔️ PK 获胜 Top10</div>';
    if (h.pkTop.length) {
      html += '<table><tr><th>#</th><th>姓名</th><th>胜场</th><th>参赛</th></tr>';
      h.pkTop.forEach(function (e, i) {
        html += '<tr><td class="rank' + (i + 1) + '">' + (i + 1) + '</td><td>' + esc(e.name) + '</td><td>' + e.wins + '</td><td>' + e.games + '</td></tr>';
      });
      html += '</table>';
    } else html += '<div class="empty">还没打过 PK——打一场就有榜了</div>';
    html += '<div class="h-sec">🥊 周擂主（每周一算一周）</div>';
    if (h.weekly.length) {
      html += '<table><tr><th>周（周一起算）</th><th>擂主</th><th>连胜</th></tr>';
      h.weekly.forEach(function (w) {
        html += '<tr><td>' + w.week + '</td><td>' + esc(w.name) + '</td><td>' + w.streak + '</td></tr>';
      });
      html += '</table>';
    } else html += '<div class="empty">还没打过擂台赛</div>';
    html += '</details>';
    body.innerHTML = html;
  }

  /* ---------- 排行榜页（客户端 tab，投屏荣誉墙大字版） ---------- */
  function renderHonorPage() {
    var body = $('honorPageBody');
    if (!body) return;
    var matches = [], arenaLog = {};
    try { matches = JSON.parse(localStorage.getItem('pk.matches') || '[]') || []; } catch (e) { }
    try { arenaLog = JSON.parse(localStorage.getItem('pk.arena.v1') || '{}') || {}; } catch (e) { }
    var h = XK.aggregateHonor(matches, arenaLog);
    var king = h.pkTop[0];
    var html = '';

    /* 顶部横幅 */
    html += '<div class="honor-hero"><h2>🏆 排行榜 · 荣誉墙</h2><div class="h-sub">⚔️ 擂台竞技，强者登场！每一场 PK，都是向更高段位发起挑战！</div></div>';

    /* 班级擂王 · 至尊卡 */
    html += '<div class="hb-king"><div class="k-title">👑 至尊 · 班级擂王</div>';
    html += '<div class="k-name">' + esc(king ? king.name : '虚位以待') + '</div>';
    html += '<div class="k-stat">累计获胜 ' + (king ? king.wins : 0) + ' 场 · 参赛 ' + (king ? king.games : 0) + ' 场</div>';
    if (king && king.wins > 0) html += '<div class="k-badge">全胜战神！守住王座，谁来挑战！</div>';
    html += '</div>';

    /* 周擂主 + 月擂主并排 */
    var wk = h.weekly[0], mo = h.monthly[0];
    html += '<div class="hb-pair">';
    html += '<div class="hb-week"><div class="hb-t">🔥 周擂主 · 烈焰王座</div><div class="hb-sub">周期自周一计算</div>';
    html += '<div class="hb-name">' + esc(wk ? wk.name : '虚位以待') + '</div>';
    html += '<div class="hb-streak">' + (wk ? wk.streak : 0) + '</div>';
    html += '<div class="hb-tag">⏱️ 限时王座 · 本周有效</div></div>';
    html += '<div class="hb-month"><div class="hb-t">🌙 月擂主 · 史诗星月王座</div><div class="hb-sub">自然月结算 · 稀有段位</div>';
    html += '<div class="hb-name">' + esc(mo ? mo.name : '虚位以待') + '</div>';
    html += '<div class="hb-streak">' + (mo ? mo.streak : 0) + '</div>';
    html += '<div class="hb-tag">✨ 史诗称号，含金量更高！</div></div></div>';

    /* 今日战况 */
    html += '<div class="honor-sec"><div class="h-sec">⚡ 今日擂台战况</div>';
    if (h.today.games > 0) {
      html += '<div>今天一共开启 <b>' + h.today.games + '</b> 场 PK，胜者名单：<br><b>' + esc(h.today.winners.join('、')) + '</b></div>';
    } else {
      html += '<div class="empty">今天还没开打——下面的历史战绩继续有效</div>';
    }
    html += '<div class="muted" style="margin-top:8px;font-size:13px">敢于上台就是勇士！下一场胜利说不定就是你的！</div></div>';

    /* 本周 PK 段位榜 */
    html += '<div class="honor-sec"><div class="h-sec">📈 本周 PK 段位榜</div>';
    if (h.weekWins.length) {
      html += '<table><tr><th>段位</th><th>选手</th><th>本周胜场</th></tr>';
      var medals = ['🥇', '🥈', '🥉'];
      h.weekWins.forEach(function (e, i) {
        html += '<tr><td>' + (medals[i] || (i + 1)) + '</td><td>' + esc(e.name) + '</td><td><b>' + e.wins + '</b></td></tr>';
      });
      html += '</table>';
    } else html += '<div class="empty">本周还没有 PK 记录</div>';
    html += '</div>';

    /* 总榜 Top10 */
    html += '<div class="honor-sec"><div class="h-sec">🏅 全服总榜 Top10（截至当前）</div>';
    if (h.pkTop.length) {
      html += '<table><tr><th>名次</th><th>选手</th><th>胜场</th><th>参赛</th></tr>';
      h.pkTop.forEach(function (e, i) {
        html += '<tr><td>' + (i === 0 ? '👑' : i + 1) + '</td><td>' + esc(e.name) + '</td><td><b>' + e.wins + '</b></td><td>' + e.games + '</td></tr>';
      });
      html += '</table>';
    } else html += '<div class="empty">还没打过 PK——打一场就有榜了</div>';
    html += '<div class="muted" style="margin-top:10px;font-size:13px">哪怕暂时没有胜利，敢于报名登上擂台，本身就是一位勇敢挑战者！坚持下去，胜利终会到来！</div>';
    html += '</div>';

    html += '<div style="text-align:center;margin:14px 0;color:var(--pri);font-size:16px;font-weight:700">⚔️ 勇者擂台，王座轮流坐！下一个擂主，会是你吗？ ⚔️</div>';

    body.innerHTML = html;
  }
  function renderHome() {
    try { renderTabs(); } catch (e) { }
    try { renderPrepMgr(); } catch (e) { }
    try { renderHonor(); } catch (e) { }
    var est = XK.estimateScore(BANK, META, P);
    $('estScore').textContent = est.score;
    $('estCap').textContent = est.tested > 0
      ? ('考纲加权预估 · 已覆盖 ' + est.tested + ' / 150 分，练得越多越准')
      : '刷题后自动按 9 模块考纲分值预估你的学考分';
    $('sparkBox').innerHTML = sparkline(P.history);
    var done = Object.keys(P.answers).length;
    $('hsStreak').textContent = XK.streakDays(P.days);
    $('hsToday').textContent = P.days[XK.todayStr()] || 0;
    $('hsCover').textContent = done + '/' + BANK.length;
    $('entWrong').textContent = XK.wrongQueue(BANK, P).length > 0 ? XK.wrongQueue(BANK, P).length + ' 题待重练' : '暂无错题';
    $('entWrong').className = 'bd' + (XK.wrongQueue(BANK, P).length > 0 ? ' hot' : '');
    $('entSim').textContent = '150 分 · 仿真卷';
    var eb = $('entBankN'); if (eb) eb.textContent = BANK.length + ' 题';
    var wk = XK.weakSpots(BANK, META, P, 8).weak.length;
    $('entDiag').textContent = wk > 0 ? wk + ' 个薄弱考点' : '刷题后生成';
  }

  function sparkline(hist) {
    if (!hist || hist.length < 2) {
      return '<div class="empty" style="padding:10px"><span class="e-ic">📈</span>刷完第一组题，这里会出现你的提分曲线</div>';
    }
    var h = hist.slice(-30);
    var w = 640, ht = 54, pad = 6;
    var pts = h.map(function (p, i) {
      var x = pad + i * (w - 2 * pad) / (h.length - 1);
      var y = ht - pad - (Math.max(0, Math.min(150, p.score)) / 150) * (ht - 2 * pad);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var last = h[h.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + ht + '" preserveAspectRatio="none">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg><div class="muted" style="text-align:center">最近成绩：' + last.score + ' 分' +
      (last.mode === 'sim' ? '（模拟考卷面分）' : '（练习预估）') + ' · 共 ' + h.length + ' 次记录</div>';
  }

  /* ---------- 刷题设置 ---------- */
  var state = {
    mods: {}, qts: { '单选': true, '判断': true, '多选': true },
    qnum: 20, shuffle: true
  };
  META.forEach(function (m) { state.mods[m.code] = true; });

  function renderSetup() {
    var box = $('mods'); box.innerHTML = '';
    META.forEach(function (m) {
      var d = document.createElement('div');
      d.className = 'mod' + (state.mods[m.code] ? ' on' : '');
      d.innerHTML = '<div class="ck">✓</div><div class="mn">' + esc(m.disp) + '</div>' +
        '<div class="mi">' + m.grp + ' · 考纲 ' + m.score + ' 分</div>';
      d.onclick = function () { state.mods[m.code] = !state.mods[m.code]; d.className = 'mod' + (state.mods[m.code] ? ' on' : ''); };
      box.appendChild(d);
    });
  }
  // 容错绑定：模板缺元素时只告警不中断（避免一处失配瘫痪整个启动）
  function on(id, ev, fn) {
    var el = $(id);
    if (!el) { if (window.console && console.error) console.error('[学考冲刺通] 模板缺少 #' + id); return; }
    el[ev] = fn;
  }
  function bindSetup() {
    // 模式
    document.querySelectorAll('.qt').forEach(function (el) {
      el.onclick = function () {
        var t = el.getAttribute('data-qt');
        state.qts[t] = !state.qts[t];
        el.classList.toggle('on', state.qts[t]);
      };
    });
    document.querySelectorAll('.qn').forEach(function (el) {
      el.onclick = function () {
        document.querySelectorAll('.qn').forEach(function (x) { x.classList.remove('on'); });
        el.classList.add('on');
        state.qnum = parseInt(el.getAttribute('data-n'), 10);
      };
    });
    on('shuffleSw', 'onclick', function () { state.shuffle = !state.shuffle; this.classList.toggle('on', state.shuffle); });
    on('startBtn', 'onclick', function () { startSession({ kind: 'practice' }); });
    on('entCardPractice', 'onclick', function () { switchTab('setup'); });
    on('entCardWrong', 'onclick', function () { switchTab('wrong'); });
    on('entCardDiag', 'onclick', function () { switchTab('diag'); });
    on('entCardSim', 'onclick', function () { startSession({ kind: 'sim' }); });
    on('entCardPk', 'onclick', function () { switchTab('pk'); });
    on('entCardArena', 'onclick', function () { switchTab('arena'); });
    window.__ARENA_ONLEAVE = function () { switchTab('pk'); };
    // 投屏模式（PK / 擂台）把底部页签整条让给题面，退出入口在这两个模块的顶栏里
    window.__PK_ONLEAVE = function () { switchTab('home'); };
    window.__ARENA_GO_HOME = function () { switchTab('home'); };
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) { b.onclick = toggleTheme; });
    applyTheme(currentTheme());
    on('wrongStartBtn', 'onclick', function () { startSession({ kind: 'wrong' }); });
    on('weakTrainBtn', 'onclick', function () { startSession({ kind: 'weak' }); });
    // 学号弹窗（班级模式）
    on('dlgCancel', 'onclick', closeSidDialog);
    on('dlgOk', 'onclick', submitSidDialog);
    on('dlgMask', 'onclick', function (ev) { if (ev.target === this) closeSidDialog(); });
    $('dlgSid') && ($('dlgSid').onkeydown = function (e) { if (e.key === 'Enter') submitSidDialog(); });
    // 课堂投屏：三个入口统一 toggle（含首页，修漏绑）
    ['bigBtnHome', 'bigBtn', 'bigBtn2'].forEach(function (id) {
      on(id, 'onclick', toggleBig);
    });
    // 课堂互动
    on('drawBtn', 'onclick', runDraw);
    on('drawClose', 'onclick', function () { stopSpeak(); closeDraw(); });
    on('drawGo', 'onclick', closeDraw);
    on('drawRead', 'onclick', function () { closeDraw(); speakCurrent(); });
    // 备课夹
    document.querySelectorAll('.j-prepMod').forEach(function (el) { el.onchange = function () { prepFilter.m = this.value; prepPage = 0; renderPrepMgr(); }; });
    document.querySelectorAll('.j-prepQt').forEach(function (el) { el.onchange = function () { prepFilter.qt = this.value; prepPage = 0; renderPrepMgr(); }; });
    document.querySelectorAll('.j-prepKw').forEach(function (el) { el.oninput = function () { prepFilter.kw = this.value.trim().toLowerCase(); prepPage = 0; renderPrepMgr(); }; });
    document.querySelectorAll('.j-prepPrev').forEach(function (el) { el.onclick = function () { prepPage--; renderPrepMgr(); }; });
    document.querySelectorAll('.j-prepNext').forEach(function (el) { el.onclick = function () { prepPage++; renderPrepMgr(); }; });
    document.querySelectorAll('.j-prepClear').forEach(function (el) {
      el.onclick = function () {
        if (!prepIds().length) { renderPrepMgr(); return; }
        if (confirm('清空备课夹？（不影响题库与成绩）')) { prepSave([]); renderPrepMgr(); }
      };
    });
    on('clsDrawBtn', 'onclick', function () { runDraw(); });
    on('qrBtn', 'onclick', function () { $('qrMask').classList.remove('hidden'); });
    on('qrClose', 'onclick', function () { $('qrMask').classList.add('hidden'); });
    on('qrMask', 'onclick', function (ev) { if (ev.target === this) this.classList.add('hidden'); });
    on('honorNavBack', 'onclick', navBack);
    on('honorNavFwd', 'onclick', navFwd);
    on('prepNavBack', 'onclick', navBack);
    on('prepNavFwd', 'onclick', navFwd);
    on('classNavBack', 'onclick', navBack);
    on('classNavFwd', 'onclick', navFwd);
    on('prepBtn', 'onclick', function () {
      if (!S.list || !S.list.length) return;
      var q = S.list[S.idx];
      if (!q) return;
      prepToggle(XK.qidOf(q));
      syncPrepBtn();
    });
    // 前进/后退导航按钮 + 初始路由
    on('navBack', 'onclick', navBack);
    on('navFwd', 'onclick', navFwd);
    on('navBackQ', 'onclick', navBack);
    on('navFwdQ', 'onclick', navFwd);
    try {
      history.replaceState({ nav: true }, '', location.hash || '#/home');
      NAV.cur = location.hash || '#/home';
      if (location.hash && location.hash !== '#/home') routeTo(location.hash);
    } catch (e) { }
    on('rosterSave', 'onclick', function () {
      var list = parseRoster($('rosterText').value);
      if (!list.length) { alert('没有解析出有效名单。每行一个姓名，或「学号,姓名」'); return; }
      ROSTER.list = list;
      DRAW.queue = []; // 名单变更重置抽取袋
      saveRoster();
      renderClassroom();
      alert('已保存 ' + list.length + ' 名学生');
    });
    on('rosterClear', 'onclick', function () {
      if (!confirm('清空学生名单？（不影响成绩档案）')) return;
      ROSTER.list = []; DRAW.queue = [];
      $('rosterText').value = '';
      saveRoster(); renderClassroom();
    });
    on('rosterFile', 'onchange', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { $('rosterText').value = String(fr.result || ''); $('rosterSave').click(); };
      fr.readAsText(f);
      ev.target.value = '';
    });
    on('rosterFetch', 'onclick', fetchCloudRoster);
    on('sfxSw', 'onclick', function () {
      var v = !XKS.isEnabled();
      XKS.setEnabled(v);
      if (v) { XKS.unlock(); XKS.correct(); }
      renderClassroom();
    });
    on('ttsVoice', 'onchange', function () {
      TTS_PREF.voiceURI = this.value; saveTtsPref();
    });
    on('ttsRate', 'oninput', function () {
      TTS_PREF.rate = parseFloat(this.value) || 1;
      $('ttsRateVal').textContent = TTS_PREF.rate.toFixed(1) + 'x';
      saveTtsPref();
    });
    on('ttsRand', 'onclick', function () {
      TTS_PREF.rand = !TTS_PREF.rand;
      saveTtsPref();
      renderClassroom();
    });
    on('ttsTest', 'onclick', function () {
      XKS.unlock();
      speak('你好，我是学考冲刺通的朗读音色，马上开始读题。', { rate: TTS_PREF.rate });
    });
    on('drawToggle', 'onclick', function () {
      DRAW.noRepeat = !DRAW.noRepeat;
      try { localStorage.setItem('xkc.draw.norepeat', DRAW.noRepeat ? '1' : '0'); } catch (e) { }
      renderClassroom();
    });
    // 档案
    on('exportBtn', 'onclick', exportProfile);
    on('importBtn', 'onclick', function () { $('importFile').click(); });
    on('importFile', 'onchange', importProfile);
    on('resetBtn', 'onclick', resetProfile);
  }

  function startSession(opt) {
    stopSpeak();
    $('setupErr').textContent = '';
    var kind = opt.kind || 'practice';
    var list;
    if (kind === 'sim') {
      list = XK.buildSimPaper(BANK, META);
    } else if (kind === 'wrong') {
      list = XK.wrongQueue(BANK, P);
      if (!list.length) { alert('错题本是空的，先去刷题吧！'); return; }
    } else if (kind === 'weak') {
      list = XK.weakTraining(BANK, META, P, 50);
      if (!list.length) { alert('目前没有检测到薄弱考点，太棒了！'); return; }
    } else {
      var selMods = Object.keys(state.mods).filter(function (k) { return state.mods[k]; });
      var selQts = Object.keys(state.qts).filter(function (k) { return state.qts[k]; });
      if (!selMods.length) { $('setupErr').textContent = '请至少选择一个章节。'; return; }
      if (!selQts.length) { $('setupErr').textContent = '请至少选择一种题型。'; return; }
      var pool = BANK.filter(function (q) { return selMods.indexOf(q.m) !== -1 && selQts.indexOf(q.qt) !== -1; });
      if (!pool.length) { $('setupErr').textContent = '该组合下暂无题目，请调整选择。'; return; }
      if (state.shuffle) XK.shuffle(pool);
      list = pool.slice(0, Math.min(state.qnum, pool.length));
    }
    S.kind = kind; S.mode = (kind === 'sim') ? 'exam' : 'practice';
    S.list = list; S.idx = 0;
    S.answers = new Array(list.length).fill(null);
    S.curSel = []; S.judged = false;
    S.simScores = {};
    $('quizTitle').textContent =
      kind === 'sim' ? '模拟考 · 150分' :
      kind === 'wrong' ? '错题重练' :
      kind === 'weak' ? '弱项特训' : '自由练习';
    navPush('quiz');
    showPanel('quiz');
    renderQuestion();
  }

  /* ---------- 课堂投屏模式 ---------- */
  // 三个按钮共用：切换 body.big + 同步所有按钮的 on 态（点击即见反馈）
  function toggleBig() {
    var on = document.body.classList.toggle('big');
    ['bigBtnHome', 'bigBtn', 'bigBtn2'].forEach(function (id) {
      var b = $(id);
      if (b) b.classList.toggle('on', on);
    });
    saveBig(on);
  }
  function saveBig(v) { try { localStorage.setItem('xkc.big', v ? '1' : '0'); } catch (e) { } }
  function loadBig() {
    try {
      if (localStorage.getItem('xkc.big') === '1') {
        document.body.classList.add('big');
        ['bigBtnHome', 'bigBtn', 'bigBtn2'].forEach(function (id) { var b = $(id); if (b) b.classList.add('on'); });
      }
    } catch (e) { }
  }

  /* ---------- 答题 ---------- */
  var S = { list: [], idx: 0, answers: [], curSel: [], judged: false, kind: 'practice', mode: 'practice', simScores: {} };

  function renderQuestion() {
    var q = S.list[S.idx], total = S.list.length;
    var mod = META.filter(function (m) { return m.code === q.m; })[0] || {};
    $('badge').textContent = q.qt;
    $('qIdx').textContent = '第 ' + (S.idx + 1) + ' / ' + total + ' 题';
    $('qKd').textContent = (mod.disp || '') + ' · ' + q.kd;
    var diffEl = $('diffBadge');
    if (diffEl) {
      diffEl.classList.toggle('hidden', !q.difficulty);
      diffEl.textContent = q.difficulty ? '⚡ ' + q.difficulty : '';
    }
    $('progBar').style.width = ((S.idx + 1) / total * 100) + '%';
    // 点名学生绑定题号：翻到别的题自动失效
    if (PICK.qIdx !== S.idx) { PICK.name = ''; PICK.sid = ''; }
    var pickBadge = $('pickBadge');
    if (pickBadge) {
      pickBadge.classList.toggle('hidden', !PICK.name);
      pickBadge.textContent = '🎓 本题由 ' + PICK.name + ' 同学作答';
    }
    var drawBtn = $('drawBtn');
    if (drawBtn) drawBtn.classList.toggle('hidden', !ROSTER.list.length);
    var saved = S.answers[S.idx];
    S.curSel = saved ? saved.sel.slice() : [];
    S.judged = !!(saved && saved.judged);

    var body = $('qbody'); body.innerHTML = '';
    var stem = document.createElement('div'); stem.className = 'qstem'; stem.textContent = XK.cleanStem(q.s); body.appendChild(stem);
    var opts = document.createElement('div');
    opts.className = 'opts' + (q.qt === '判断' ? ' judge' : '');
    q.o.forEach(function (op) {
      var o = document.createElement('div'); o.className = 'opt';
      var key = document.createElement('div'); key.className = 'ok'; key.textContent = op[0];
      var val = document.createElement('div'); val.className = 'ov'; val.textContent = (op[1] && op[1] !== op[0]) ? op[0] + '. ' + op[1] : op[0];
      o.appendChild(key); o.appendChild(val);
      o.onclick = function () { onPick(q, op[0], o); };
      o.setAttribute('data-key', op[0]);
      o.tabIndex = 0; o.setAttribute('role', 'button');
      o.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); o.click(); } };
      opts.appendChild(o);
    });
    body.appendChild(opts);
    if (S.judged) showFeedback(q);
    $('prevBtn').disabled = S.idx === 0;
    var isLast = S.idx === total - 1;
    $('nextBtn').textContent = isLast ? ((S.mode === 'exam') ? '交卷 🏁' : '查看报告 📊') : '下一题 →';
    var old = body.querySelector('.submit-row'); if (old) old.remove();
    if (q.qt === '多选' && !S.judged) {
      var row = document.createElement('div'); row.className = 'submit-row';
      var b = document.createElement('button'); b.className = 'btn sm'; b.textContent = '确定提交';
      b.onclick = function () { submitMulti(q); };
      row.appendChild(b); body.appendChild(row);
    }
    syncSpeakBtn();
    try { syncPrepBtn(); } catch (e) { }
    body.scrollTop = 0;
  }

  function onPick(q, key, el) {
    if (S.judged) return;
    if (q.qt === '多选') {
      var i = S.curSel.indexOf(key);
      if (i === -1) S.curSel.push(key); else S.curSel.splice(i, 1);
      el.classList.toggle('sel');
      return;
    }
    S.curSel = [key];
    if (S.mode !== 'practice') S.answers[S.idx] = { sel: S.curSel.slice(), judged: false };
    var all = $('qbody').querySelectorAll('.opt');
    all.forEach(function (o) { o.classList.remove('sel'); });
    el.classList.add('sel');
    if (S.mode === 'practice') commitJudge(q);
  }
  function submitMulti(q) {
    if (!S.curSel.length) { alert('请至少选择一个选项'); return; }
    if (S.mode === 'practice') commitJudge(q);
    else { S.answers[S.idx] = { sel: S.curSel.slice(), judged: false }; }
  }
  function commitJudge(q) {
    var right = XK.judge(q, S.curSel);
    S.judged = true;
    S.answers[S.idx] = { sel: S.curSel.slice(), judged: true, right: right };
    XK.recordAnswer(P, q, right);
    save();
    syncNow(false); // 班级/云端模式：静默同步
    showFeedback(q);
    // 短暂震动反馈（支持的设备）
    if (navigator.vibrate) navigator.vibrate(right ? 15 : [40, 40, 40]);
    // 音效 + 课堂表扬/鼓励（点名题带姓名横幅与 TTS）
    var streak = (P.answers[XK.qidOf(q)] || {}).k || 0;
    if (right) {
      XKS.correct();
      if (PICK.name) {
        var praise = XKP.pickPraise(PICK.name, streak);
        banner(praise, 'praise');
        setTimeout(function () { XKS.fanfare(); }, 420);
        stopSpeak();
        speak(praise);
      }
    } else {
      XKS.wrong();
      if (PICK.name) {
        var enc = XKP.pickEncourage(PICK.name);
        banner(enc, 'encourage');
        stopSpeak();
        speak(enc);
      }
    }
  }
  function showFeedback(q) {
    var right = S.answers[S.idx] && S.answers[S.idx].right;
    var correct = XK.normalizeAns(q.a);
    var mine = S.curSel.slice().map(function (x) { return XK.normalizeAns(x); }).sort().join('');
    var isRight = (mine === correct) || right === true;
    var all = $('qbody').querySelectorAll('.opt');
    all.forEach(function (o) {
      var k = o.getAttribute('data-key');
      o.classList.add('dim');
      if (correct.indexOf(k) !== -1) o.classList.add('correct');
      else if (S.curSel.indexOf(k) !== -1 && !isRight) o.classList.add('wrong');
    });
    var fb = document.createElement('div');
    fb.className = 'feedback ' + (isRight ? 'ok' : 'err');
    var ft = document.createElement('div'); ft.className = 'ft';
    ft.textContent = isRight ? '✓ 回答正确' : '✗ 回答错误';
    fb.appendChild(ft);
    var fe = document.createElement('div'); fe.className = 'fe';
    fe.innerHTML = '正确答案：<b>' + esc(q.a) + '</b>　' + (mine ? ('你的选择：' + esc(mine)) : '（未作答）');
    fb.appendChild(fe);
    if (q.e) { var e1 = document.createElement('div'); e1.className = 'fe'; e1.style.marginTop = '6px'; e1.textContent = '解析：' + q.e; fb.appendChild(e1); }
    $('qbody').appendChild(fb);
    if (q.an) { var a = document.createElement('div'); a.className = 'ana'; a.innerHTML = '<b>💡 生活类比：</b>' + esc(q.an); $('qbody').appendChild(a); }
    if (q.t) { var t = document.createElement('div'); t.className = 'tip'; t.innerHTML = '<b>⚠ 易错提醒：</b>' + esc(q.t); $('qbody').appendChild(t); }
  }

  $('prevBtn').onclick = function () { if (S.idx > 0) { S.idx--; renderQuestion(); } };
  $('nextBtn').onclick = function () {
    var total = S.list.length, isLast = S.idx === total - 1;
    if (S.mode === 'exam' && !S.answers[S.idx] && S.list[S.idx].qt !== '多选' && !S.curSel.length) {
      if (!confirm('本题还未作答，确定跳过？')) return;
    }
    if (isLast) { finishSession(); }
    else { S.idx++; renderQuestion(); }
  };
  $('exitBtn').onclick = function () {
    if (confirm('退出本次答题并返回？\n（已答题目会正常记入档案，未答的不记录）')) {
      stopSpeak();
      switchTab('home');
    }
  };
  $('speakBtn').onclick = speakCurrent;

  /* ---------- 结束与成绩 ---------- */
  function finishSession() {
    stopSpeak();
    var right = 0, wrong = 0, unans = 0, wrongs = [];
    var perMod = {};
    S.list.forEach(function (q, i) {
      var ans = S.answers[i];
      var mine = ans && ans.sel ? ans.sel.slice().map(function (x) { return XK.normalizeAns(x); }).sort().join('') : '';
      var isRight = mine && mine === XK.normalizeAns(q.a);
      var pm = perMod[q.m]; if (!pm) pm = perMod[q.m] = { n: 0, a: 0 };
      pm.n++;
      if (!mine) { unans++; }
      else if (isRight) { right++; pm.a++; }
      else { wrong++; wrongs.push({ q: q, mine: mine }); }
      XK.recordAnswer(P, q, !!isRight); // 模拟考成绩同样计入档案（未答记错，驱动错题本/诊断/预估分）
    });

    // 预估分曲线：模拟考记卷面分；练习记当次会话结束后的档案预估分
    var est = XK.estimateScore(BANK, META, P);
    var rec = {
      t: Date.now(),
      mode: S.kind === 'sim' ? 'sim' : 'pr',
      score: S.kind === 'sim' ? right : est.score,
      tested: S.kind === 'sim' ? 150 : est.tested
    };
    P.history.push(rec);
    if (P.history.length > 500) P.history = P.history.slice(-500);
    save();
    syncNow(false); // 班级模式：交卷即同步到老师电脑（静默）

    renderResult({ right: right, wrong: wrong, unans: unans, total: S.list.length, wrongs: wrongs, perMod: perMod, rec: rec });
  }

  function renderResult(r) {
    var body = $('resultBody'); body.innerHTML = '';
    var isSim = S.kind === 'sim';
    var title = isSim ? '模拟考卷面分' : (S.kind === 'wrong' ? '错题重练报告' : (S.kind === 'weak' ? '弱项特训报告' : '练习报告'));
    var pct = r.total ? Math.round(r.right / r.total * 100) : 0;
    var color = pct >= 80 ? '#16a34a' : (pct >= 60 ? '#d97706' : '#dc2626');

    var h = document.createElement('div');
    h.innerHTML = '<div style="font-size:20px;font-weight:800;">' + title + '</div>';
    body.appendChild(h);

    var rg = document.createElement('div'); rg.className = 'ring';
    rg.innerHTML = ringSVG(isSim ? Math.round(r.right / 150 * 100) : pct, color,
      isSim ? (r.right + '分') : (pct + '%'));
    body.appendChild(rg);
    var sb = document.createElement('div'); sb.className = 'score-big';
    sb.textContent = isSim
      ? ('卷面 ' + r.right + ' / 150 分 · 答对 ' + r.right + ' / ' + r.total + ' 题（每题1分，按考纲加权组卷）')
      : ('正确率 ' + pct + '% · 答对 ' + r.right + ' / ' + r.total + ' 题 · 档案预估 ' + r.rec.score + ' 分');
    body.appendChild(sb);

    var stats = document.createElement('div'); stats.className = 'stat-row';
    stats.innerHTML =
      '<div class="stat"><div class="v" style="color:#16a34a">' + r.right + '</div><div class="l">答对</div></div>' +
      '<div class="stat"><div class="v" style="color:#dc2626">' + r.wrong + '</div><div class="l">答错</div></div>' +
      '<div class="stat"><div class="v" style="color:#9aa0b0">' + r.unans + '</div><div class="l">未答</div></div>';
    body.appendChild(stats);

    // 本次各模块小计
    var mods = Object.keys(r.perMod);
    if (mods.length > 1) {
      var ml = document.createElement('div'); ml.className = 'mod-list';
      ml.innerHTML = '<div class="sec-t"><span class="dot"></span>本次分模块表现</div>';
      mods.forEach(function (code) {
        var m = META.filter(function (x) { return x.code === code; })[0] || {};
        var pm = r.perMod[code];
        var acc = pm.n ? pm.a / pm.n : 0;
        var cls = acc >= 0.8 ? 'ok' : (acc >= 0.6 ? 'warn' : 'err');
        var it = document.createElement('div'); it.className = 'mod-item';
        it.innerHTML = '<div class="mh"><b>' + esc(m.disp || code) + '</b><span>' + pm.a + '/' + pm.n + ' 题</span></div>' +
          '<div class="bar"><i class="' + cls + '" style="width:' + Math.round(acc * 100) + '%"></i></div>';
        ml.appendChild(it);
      });
      body.appendChild(ml);
    }

    if (r.wrongs.length) {
      var wl = document.createElement('div'); wl.className = 'wrong-list';
      wl.innerHTML = '<div class="sec-t" style="margin-top:6px;"><span class="dot"></span>本次错题（' + r.wrongs.length + ' 道，已自动进错题本）</div>';
      r.wrongs.slice(0, 30).forEach(function (w) {
        var it = document.createElement('div'); it.className = 'wrong-item';
        it.innerHTML =
          '<div class="ws">' + esc(XK.cleanStem(w.q.s)) + '</div>' +
          (w.mine ? '<div class="wa">你的答案：<span class="mine">' + esc(w.mine) + '</span></div>' : '<div class="wa">你的答案：<span class="mine">（未作答）</span></div>') +
          '<div class="wa">正确答案：<span class="right">' + esc(w.q.a) + '</span></div>' +
          (w.q.e ? '<div class="we">解析：' + esc(w.q.e) + '</div>' : '');
        wl.appendChild(it);
      });
      body.appendChild(wl);
    } else if (r.total > 0) {
      var pf = document.createElement('div'); pf.className = 'card';
      pf.innerHTML = '🎉 全部答对，太棒了！错题本里可以有意识地毕业几题了';
      body.appendChild(pf);
    }

    var acts = document.createElement('div'); acts.style.marginTop = '16px';
    acts.innerHTML =
      '<button class="btn" id="weakBtn">' + (r.wrongs.length ? '🎯 针对弱项再来一组' : '📊 查看考点诊断') + '</button>' +
      '<button class="btn ghost" id="againBtn" style="margin-top:11px;">🔄 再来一组</button>' +
      '<button class="btn ghost" id="homeBtn" style="margin-top:11px;">🏠 返回首页</button>';
    body.appendChild(acts);
    $('weakBtn').onclick = function () {
      if (r.wrongs.length) startSession({ kind: 'weak' });
      else switchTab('diag');
    };
    $('againBtn').onclick = function () { startSession({ kind: S.kind }); };
    $('homeBtn').onclick = function () { switchTab('home'); };
    navPush('result');
    showPanel('result');
  }

  function ringSVG(pct, color, label) {
    var r = 68, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return '<svg viewBox="0 0 170 170" width="170" height="170">' +
      '<circle cx="85" cy="85" r="' + r + '" fill="none" stroke="#e5e1f0" stroke-width="13"/>' +
      '<circle cx="85" cy="85" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="13" stroke-linecap="round" ' +
      'stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" transform="rotate(-90 85 85)"/>' +
      '<text x="85" y="82" text-anchor="middle" font-size="38" font-weight="800" fill="' + color + '">' + esc(label) + '</text>' +
      '<text x="85" y="110" text-anchor="middle" font-size="13" fill="#6b7280">' + (S.kind === 'sim' ? '卷面得分率' : '正确率') + '</text></svg>';
  }

  /* ---------- 错题本 ---------- */
  function renderWrong() {
    var wq = XK.wrongQueue(BANK, P);
    var grad = XK.graduatedCount(BANK, P);
    $('wrongStats').innerHTML =
      '<div class="stat-row" style="margin:0 0 12px">' +
      '<div class="stat"><div class="v" style="color:#dc2626">' + wq.length + '</div><div class="l">待重练</div></div>' +
      '<div class="stat"><div class="v" style="color:#16a34a">' + grad + '</div><div class="l">已毕业</div></div>' +
      '<div class="stat"><div class="v">2</div><div class="l">连对2次毕业</div></div></div>';
    $('wrongStartBtn').disabled = !wq.length;
    var box = $('wrongList'); box.innerHTML = '';
    if (!wq.length) {
      box.innerHTML = '<div class="empty"><span class="e-ic">🎉</span>错题全部毕业！<br>继续刷题保持手感</div>';
      return;
    }
    wq.slice(0, 50).forEach(function (q) {
      var rec = P.answers[XK.qidOf(q)];
      var it = document.createElement('div'); it.className = 'wrong-item';
      it.innerHTML =
        '<div class="ws">' + esc(XK.cleanStem(q.s)) + '</div>' +
        '<div class="wa">正确答案：<span class="right">' + esc(q.a) + '</span>' +
        '<span class="pill warn">连对 ' + (rec ? rec.k : 0) + '/2</span></div>' +
        (q.t ? '<div class="we">⚠ ' + esc(q.t) + '</div>' : '');
      box.appendChild(it);
    });
    if (wq.length > 50) {
      var more = document.createElement('div'); more.className = 'muted'; more.style.textAlign = 'center';
      more.textContent = '… 还有 ' + (wq.length - 50) + ' 题未展示，重练时全部覆盖';
      box.appendChild(more);
    }
  }

  /* ---------- 考点诊断 ---------- */
  function renderDiag() {
    var est = XK.estimateScore(BANK, META, P);
    var wk = XK.weakSpots(BANK, META, P, 8);
    $('diagRadar').innerHTML = radarSVG(est.per);
    var box = $('modList'); box.innerHTML = '';
    est.per.forEach(function (s) {
      var cls = s.acc == null ? '' : (s.acc >= 0.8 ? 'ok' : (s.acc >= 0.6 ? 'warn' : 'err'));
      var it = document.createElement('div'); it.className = 'mod-item';
      it.innerHTML =
        '<div class="mh"><b>' + esc(s.name) + '</b><span>' +
        (s.acc == null ? '未开始' : ('正确率 ' + Math.round(s.acc * 100) + '%')) + '</span></div>' +
        '<div class="bar"><i class="' + cls + '" style="width:' + (s.acc == null ? 0 : Math.round(s.acc * 100)) + '%"></i></div>' +
        '<div class="ms"><span>作答 ' + s.n + ' 次</span><span>考纲 ' + s.score + ' 分</span></div>';
      box.appendChild(it);
    });
    var wbox = $('weakList');
    if (!wk.weak.length) {
      wbox.innerHTML = '<div class="empty" style="padding:14px"><span class="e-ic">🧭</span>' +
        (est.tested === 0 ? '先去刷一组题，我会帮你找出薄弱考点' : '暂无薄弱考点（正确率≥70%）· 继续保持') + '</div>';
    } else {
      wbox.innerHTML = '';
      wk.weak.forEach(function (s) {
        var it = document.createElement('div'); it.className = 'spot-item';
        it.innerHTML = '<div class="sh"><b>' + esc(s.disp) + '</b><span class="sa">' + Math.round(s.acc * 100) + '%</span></div>' +
          '<div class="sn">作答 ' + s.n + ' 次 · 错 ' + s.w + ' 次</div>';
        wbox.appendChild(it);
      });
    }
    $('weakTrainBtn').style.display = wk.weak.length ? '' : 'none';
    $('unknownNote').textContent = wk.unknownCount > 0 ? ('还有 ' + wk.unknownCount + ' 个考点没刷到，全部探明后预估分才完整') : '';
  }

  function radarSVG(per) {
    var cx = 130, cy = 118, R = 78, n = per.length;
    function pt(i, rad) {
      var ang = (-90 + i * 360 / n) * Math.PI / 180;
      return (cx + rad * Math.cos(ang)).toFixed(1) + ',' + (cy + rad * Math.sin(ang)).toFixed(1);
    }
    var svg = '<svg viewBox="0 0 260 236" width="100%" style="max-width:340px">';
    [0.33, 0.66, 1].forEach(function (f) {
      var ps = []; for (var i = 0; i < n; i++) ps.push(pt(i, R * f));
      svg += '<polygon points="' + ps.join(' ') + '" fill="none" stroke="#e5e1f0" stroke-width="1"/>';
    });
    for (var i = 0; i < n; i++) svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + pt(i, R).split(',')[0] + '" y2="' + pt(i, R).split(',')[1] + '" stroke="#e5e1f0" stroke-width="1"/>';
    var dps = [], lab = [];
    per.forEach(function (s, i) {
      var v = s.acc == null ? 0 : s.acc;
      dps.push(pt(i, 8 + v * (R - 8)));
    });
    svg += '<polygon points="' + dps.join(' ') + '" fill="rgba(124,58,237,.25)" stroke="#7c3aed" stroke-width="2" stroke-linejoin="round"/>';
    per.forEach(function (s, i) {
      var xy = pt(i, R + 14).split(',');
      svg += '<text x="' + xy[0] + '" y="' + xy[1] + '" text-anchor="middle" font-size="10.5" fill="#6b7280">' + esc(s.code) + '</text>';
    });
    svg += '</svg>';
    return svg;
  }

  /* ---------- 班级同步（渐进增强） ---------- */
  // 班级版服务存在 → 学号身份 + 档案同步到老师电脑；file:// 或线上版 → 静默本机模式
  var CLS = { mode: 'local', sid: '', name: '', code: '' };
  var SKEY = 'xkc.class.v1';
  function loadCls() {
    try {
      var raw = JSON.parse(localStorage.getItem(SKEY) || '{}');
      CLS.sid = String(raw.sid || '').slice(0, 32);
      CLS.name = String(raw.name || '').slice(0, 24);
      CLS.code = String(raw.code || '').slice(0, 32);
    } catch (e) { }
  }
  function saveCls() { try { localStorage.setItem(SKEY, JSON.stringify({ sid: CLS.sid, name: CLS.name, code: CLS.code })); } catch (e) { } }
  function detectClassMode() {
    if (location.protocol === 'file:') { renderClsBar(); return; }
    fetch('/api/hello', { method: 'GET' }).then(function (r) {
      if (!r.ok) throw 0;
      return r.json();
    }).then(function (j) {
      if (j && j.mode === 'class') {
        CLS.mode = 'class';
        CLS.label = j.label === 'cloud' ? 'cloud' : 'lan';
        renderClsBar();
        if (!CLS.sid) setTimeout(function () {
          // 课堂屏（双人 PK / 擂台赛 / 课堂投屏）不是学生机：
          // 老师正讲着课，中途弹「输入学号」会把擂台候选席整个盖住。
          var bd = document.body.classList;
          if (bd.contains('pk-mode') || bd.contains('arena-mode') || bd.contains('big')) return;
          promptSid();
        }, 600);
      } else { renderClsBar(); }
    }).catch(function () { renderClsBar(); });
  }
  function renderClsBar() {
    var bar = $('clsBar'); if (!bar) return;
    if (CLS.mode !== 'class') {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    var where = CLS.label === 'cloud' ? '云端班级库' : '老师电脑';
    if (CLS.sid) {
      bar.innerHTML = '🎓 ' + (CLS.label === 'cloud' ? '云端同步' : '班级模式') + ' · 学号 <b>' + esc(CLS.sid) + '</b>' + (CLS.name ? '（' + esc(CLS.name) + '）' : '') +
        ' · 刷题成绩实时同步到' + where + ' <span class="clsLink" id="clsEdit">更换学号</span>';
      $('clsEdit').onclick = promptSid;
    } else {
      bar.innerHTML = '🎓 ' + (CLS.label === 'cloud' ? '云端同步' : '班级模式') + ' · <span class="clsLink" id="clsEdit">点这里输入学号</span>，成绩才能长久记录';
      $('clsEdit').onclick = promptSid;
    }
  }
  function promptSid() {
    var mask = $('dlgMask');
    $('dlgSid').value = CLS.sid || '';
    $('dlgName').value = CLS.name || '';
    $('dlgCode').value = CLS.code || '';
    $('dlgErr').textContent = '';
    mask.classList.remove('hidden');
    setTimeout(function () { try { $('dlgSid').focus(); } catch (e) { } }, 60);
  }
  function closeSidDialog() { $('dlgMask').classList.add('hidden'); }
  function submitSidDialog() {
    var sid = $('dlgSid').value.trim().slice(0, 32);
    var name = $('dlgName').value.trim().slice(0, 24);
    var code = $('dlgCode').value.trim().slice(0, 32);
    if (!sid) { $('dlgErr').textContent = '学号不能为空'; return; }
    if (!/^[0-9A-Za-z_\-\u4e00-\u9fa5]{1,32}$/.test(sid)) { $('dlgErr').textContent = '学号只能包含中文、字母、数字、- 和 _'; return; }
    CLS.sid = sid; CLS.name = name; CLS.code = code;
    saveCls(); closeSidDialog(); renderClsBar(); syncNow(false);
  }
  function syncNow(silent) {
    if (CLS.mode !== 'class' || !CLS.sid) return;
    try {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sid: CLS.sid, name: CLS.name, code: CLS.code, profile: P })
      }).then(function (r) {
        if (r.status === 401) {
          // 班级码错误：每次页面会话只提醒一次，之后静默（避免刷题时反复弹窗）
          if (!CLS.codeWarned) {
            CLS.codeWarned = true;
            if (silent) promptSid();
            else alert('班级码不对：请点同步条上的「更换学号」重新填写（学号+班级码都要对）\n（本次会话不再重复提醒）');
          }
          return;
        }
        if (!r.ok && !silent) alert('同步失败（' + r.status + '），成绩仍保存在本机');
      }).catch(function () {
        if (!silent) alert('同步失败（网络），成绩仍保存在本机');
      });
    } catch (e) { }
  }

  /* ---------- 档案导入导出 ---------- */
  function exportProfile() {
    var blob = new Blob([JSON.stringify(P)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '学考冲刺通档案_' + XK.todayStr() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function importProfile(ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var p = null;
      try { p = XK.validateProfile(JSON.parse(fr.result)); } catch (e) { p = null; }
      if (!p) { alert('导入失败：不是有效的学考冲刺通档案文件'); return; }
      if (!confirm('导入将覆盖当前学习档案（本次预估分/错题本等以导入文件为准）。确定继续？')) return;
      P = p; save(); switchTab('home');
      alert('导入成功！已载入 ' + Object.keys(P.answers).length + ' 题的学习记录');
    };
    fr.readAsText(f);
    ev.target.value = '';
  }
  function resetProfile() {
    if (!confirm('确定清空全部学习记录？此操作不可恢复（建议先导出备份）。')) return;
    if (!confirm('再次确认：真的要清空吗？')) return;
    P = XK.newProfile(); save(); switchTab('home');
  }

  /* ---------- 启动 ---------- */
  // 题库已就绪（脚本是顺序阻塞加载），先撤掉首屏「正在加载题库」提示
  try { var bootTip = document.getElementById('bootTip'); if (bootTip && bootTip.parentNode) bootTip.parentNode.removeChild(bootTip); } catch (e) { }
  // 启动失败时兜底显示首页 + 错误横幅（不静默白屏）
  try {
    document.querySelectorAll('.tab').forEach(function (el) {
      el.onclick = function () { switchTab(el.getAttribute('data-t')); };
    });
    renderSetup();
    bindSetup();
    renderHome();
    refreshBadges();
    // 启动 hash 直达（如门户跳 #/pk）时：前段 routeTo 已切目标面板，
    // 这里不能再 showPanel('home') 覆盖回去；非 home 直达交给构建尾段统一 rehash
    if (!(location.hash && location.hash !== '#/home')) showPanel('home');
    var ver = window.XK_APP_VER || 'v1.2';
    var G = window.XK_BANK_GATE;
    var tierLabel = (G && G.labels && G.labels[G.tier()]) ? G.labels[G.tier()] : ('基础档 ' + BANK.length + ' 题');
    $('verTag').textContent = '当前 ' + tierLabel + ' / 全库 ' + (window.BANK_ALL || BANK).length + ' 题 · 版本 ' + ver + '（client-' + ver + '）· 考纲 150 分制 · 表扬语库 ' + XKP.praiseCount() + ' 条';
    applyTheme(currentTheme());
    renderBankGateBtn();
    loadBig();
    loadTtsPref();
    try { DRAW.noRepeat = localStorage.getItem('xkc.draw.norepeat') !== '0'; } catch (e) { }
    loadRoster();
    renderClassroom();
    if ('speechSynthesis' in window) {
      speechSynthesis.onvoiceschanged = function () { renderClassroom(); };
      setTimeout(renderClassroom, 600);
      setTimeout(renderClassroom, 1800);
    }
    // 教师页「把名单导入学生端」跳转：?teacherkey= 一次性消费
    try {
      var qm = location.search.match(/[?&]teacherkey=([^&]+)/);
      if (qm) {
        fetchCloudRoster(decodeURIComponent(qm[1]), true);
        history.replaceState(null, '', location.pathname);
      }
    } catch (e) { }
    loadCls();
    detectClassMode();
  } catch (e) {
    document.querySelectorAll('.panel').forEach(function (el) { el.classList.add('hidden'); });
    document.getElementById('home').classList.remove('hidden');
    var banner = document.createElement('div');
    banner.style.cssText = 'background:#fee2e2;color:#991b1b;padding:10px 14px;font-size:13px';
    banner.textContent = '启动出错：' + (e && e.message ? e.message : e);
    document.body.insertBefore(banner, document.body.firstChild);
    if (window.console && console.error) console.error(e);
  }
})();
