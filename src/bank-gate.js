/* =====================================================================
 * 题量档位闸门（在 data.js 之后、app.js / pk-app.js / arena-app.js 之前执行）
 * ---------------------------------------------------------------------
 * 铁律：一题都不删。src/data.js 的 3982 题仍是唯一真源，题干一字未改，
 *       qid=djb2(m|qt|s) 不变，学生档案 / 错题本 / 班级版战绩零断链。
 * 档位：1000 基础（默认）⊂ 2000 高级 ⊂ 3000 终极 ⊂ 3982 全库。
 *       三份白名单是严格嵌套子集，升档时学生做过的题不会跑出题池。
 *       window.BANK_ALL 保存全库；window.BANK 指向当前档题目视图。
 * 开关：localStorage['xkc.bank.tier'] = 1000|2000|3000|full（默认 1000，fail-closed）；
 *       兼容旧 xkc.bank.release==='1'（等价于 full）；地址栏 ?tier= / ?full=1 兜底。
 * 服务端：/api/bank 按 XK_DEFAULT_TIER 与 XK_TIER_INDEX 同构过滤，?tier= 切档、?full=1 给全库。
 * ===================================================================== */
(function () {
  'use strict';
  var root = window;
  var TIER_KEY = 'xkc.bank.tier';
  var RELEASE_KEY = 'xkc.bank.release';
  // 应用版本号：与 GitHub tag client-v1.1 对齐；改发版只改这一处
  root.XK_APP_VER = 'v1.2';
  root.BANK_ALL = root.BANK || [];
  var TIERS = root.XK_TIER_INDEX || {};
  var DEFAULT_TIER = root.XK_DEFAULT_TIER || '1000';
  var ORDER = ['1000', '2000', '3000', 'full'];
  var LABELS = {
    '1000': '基础档 1000 题', '2000': '高级档 2000 题',
    '3000': '终极档 3000 题', 'full': '全库 ' + root.BANK_ALL.length + ' 题'
  };

  function qs(name) {
    try {
      var m = new RegExp('[?&]' + name + '=([^&]*)').exec(root.location.search || '');
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }
  function normalize(v) { return ORDER.indexOf(v) >= 0 ? v : null; }
  function tier() {
    var t = null;
    try { if (root.localStorage) t = normalize(localStorage.getItem(TIER_KEY)); } catch (e) { }
    if (t) return t;
    // 兼容上一版的「释放全部题量」开关
    try { if (root.localStorage && localStorage.getItem(RELEASE_KEY) === '1') return 'full'; } catch (e) { }
    var q = normalize(qs('tier'));
    if (q) return q;
    if (qs('full') === '1') return 'full';
    return DEFAULT_TIER;
  }
  function countOf(t) {
    return t === 'full' ? root.BANK_ALL.length : ((TIERS[t] || []).length);
  }
  function setTier(v) {
    var t = normalize(v) || DEFAULT_TIER;
    try {
      localStorage.setItem(TIER_KEY, t);
      localStorage.removeItem(RELEASE_KEY);
      return true;
    } catch (e) { return false; }
  }
  function bankOf(t) {
    if (t === 'full') return root.BANK_ALL;
    var idx = TIERS[t];
    // 构建期守卫保证三档都存在；真缺失时保持全库避免白屏
    if (!idx || !idx.length) return root.BANK_ALL;
    return idx.map(function (i) { return root.BANK_ALL[i]; });
  }
  function apply() { root.BANK = bankOf(tier()); }
  // 供 PK 远程拉取 / 粘贴题库兜底：拿到本项目全库时压回当前档；教师自定义题库原样保留。
  // 末尾统一交给 XK_QOVER.applyTo，保证远程题库也带上教师修正（按原 qid 匹配）。
  function guard(arr) {
    if (!Array.isArray(arr)) return arr;
    var t = tier(), out = arr;
    if (t !== 'full' && root.BANK_ALL.length && arr.length === root.BANK_ALL.length && arr[0] && root.BANK_ALL[0]) {
      var same = arr[0].s === root.BANK_ALL[0].s;
      if (!same && root.XK && root.XK.qidOf) {
        try { same = root.XK.qidOf(arr[0]) === root.XK.qidOf(root.BANK_ALL[0]); } catch (e) { }
      }
      if (same) out = bankOf(t);
    }
    return (root.XK_QOVER && root.XK_QOVER.applyTo) ? root.XK_QOVER.applyTo(out) : out;
  }
  function switchTier(v) {
    var t = normalize(v);
    if (!t) return;
    var cur = tier();
    if (t === cur) return;
    var msg = '切换题量档位？\n\n当前：' + LABELS[cur] + '\n切换后：' + LABELS[t] +
      '\n\n刷题、模拟考、诊断、PK、擂台都会使用新题池；题库一题不删、学生档案不受影响，随时可以切回。';
    if (t === 'full') msg += '\n\n注意：全库档包含全部 ' + root.BANK_ALL.length + ' 题（含 86 道跨考点综合卷）。';
    if (typeof root.confirm === 'function' && !root.confirm(msg)) return;
    if (setTier(t)) { root.location.reload(); return; }
    // localStorage 不可用（隐私模式等）时，用地址栏 ?tier= 兜底，保留其余参数
    try {
      var u = new URL(root.location.href);
      u.searchParams.set('tier', t);
      root.location.href = u.toString();
    } catch (e) {
      if (typeof root.alert === 'function') root.alert('本机无法保存设置；请在地址栏末尾加 ?tier=' + t + ' 后回车切换档位');
    }
  }
  function renderButton() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    var cur = tier();
    // 档位按钮组（首页「教师选项」卡片 / PK 设置弹窗）
    var btns = document.querySelectorAll('[data-bank-tier]');
    Array.prototype.forEach.call(btns, function (b) {
      var t = b.getAttribute('data-bank-tier'), on = (t === cur);
      if (b.classList) { b.classList.toggle('on', on); b.classList.toggle('tier-on', on); }
      b.style.opacity = on ? '1' : '0.62';
      b.style.outline = on ? '2px solid var(--color-text-primary, #333)' : 'none';
      b.style.outlineOffset = '2px';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('title', LABELS[t] + (on ? '（当前档）' : ' · 点击切换'));
      b.onclick = function () { switchTier(t); };
    });
    // 容器只显示状态，不覆盖里面的按钮
    var boxes = document.querySelectorAll('[data-bank-gate]');
    Array.prototype.forEach.call(boxes, function (b) { b.setAttribute('data-current-tier', cur); });
    var statuses = document.querySelectorAll('[data-tier-status]');
    Array.prototype.forEach.call(statuses, function (s) {
      s.textContent = '当前：' + LABELS[cur] + '（默认 ' + LABELS[DEFAULT_TIER] + '）';
    });
  }

  root.XK_BANK_GATE = {
    tier: tier,
    setTier: setTier,
    switchTier: switchTier,
    apply: apply,
    guard: guard,
    renderButton: renderButton,
    countOf: countOf,
    labels: LABELS,
    defaultTier: DEFAULT_TIER,
    isReleased: function () { return tier() === 'full'; },
    setReleased: function (v) { return setTier(v ? 'full' : DEFAULT_TIER); },
    toggle: function () { switchTier(tier() === 'full' ? DEFAULT_TIER : 'full'); },
    fullCount: function () { return root.BANK_ALL.length; },
    whitelistCount: function () { return countOf(DEFAULT_TIER); },
    activeCount: function () { return (root.BANK || []).length; }
  };
  apply();
  renderButton();
  // 脚本若被放在 head（PK 独立版），按钮此时尚未解析，DOM 就绪后再刷一次
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', renderButton);
  }
})();
