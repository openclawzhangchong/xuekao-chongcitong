/* =====================================================================
 * 默认题量闸门（在 data.js 之后、app.js / pk-app.js / arena-app.js 之前执行）
 * ---------------------------------------------------------------------
 * 铁律：一题都不删。src/data.js 的 3982 题仍是唯一真源，题干一字未改，
 *       所以 qid=djb2(m|qt|s) 不变，学生档案 / 错题本 / 班级版战绩零断链。
 * 做法：window.BANK_ALL 保存全库；window.BANK 指向「当前可练题库」——
 *       默认按 XK_BANK_INDEX 映射成 2000 题白名单视图；释放开关打开时指回全库。
 *       所有业务代码（刷题/模拟考/诊断/PK/擂台/备课夹）都读 window.BANK，
 *       因此一处闸门即可覆盖全站，无需逐个模块改抽题逻辑。
 * 服务端：/api/bank 同样按 XK_BANK_INDEX 过滤，只有 ?full=1 才返回全库。
 * 开关：localStorage['xkc.bank.release'] === '1'（默认关=白名单，fail-closed）；
 *       地址栏 ?full=1 为无 localStorage 环境的兜底。
 * ===================================================================== */
(function () {
  'use strict';
  var root = window;
  var RELEASE_KEY = 'xkc.bank.release';
  // 应用版本号：与 GitHub tag client-v1.1 对齐；改发版只改这一处
  root.XK_APP_VER = 'v1.1';
  root.BANK_ALL = root.BANK || [];
  var INDEX = root.XK_BANK_INDEX || [];

  function isReleased() {
    try {
      if (root.localStorage && localStorage.getItem(RELEASE_KEY) === '1') return true;
    } catch (e) { }
    try {
      return /(?:^|[?&])full=1(?:&|$)/.test(root.location.search || '');
    } catch (e) { return false; }
  }
  function setReleased(v) {
    try {
      localStorage.setItem(RELEASE_KEY, v ? '1' : '0');
      return true;
    } catch (e) { return false; }
  }
  function whitelistBank() {
    // 构建期守卫保证 INDEX 一定存在且为 2000 项；真缺失时保持全库，避免白屏
    if (!INDEX.length) return root.BANK_ALL;
    return INDEX.map(function (i) { return root.BANK_ALL[i]; });
  }
  function apply() {
    root.BANK = isReleased() ? root.BANK_ALL : whitelistBank();
  }
  // 供 PK 远程拉取 / 粘贴题库兜底：未释放且拿到的是本项目全库时，压回白名单；
  // 教师自定义题库（题数或首题题干不同）原样保留，不破坏导入功能。
  function guard(arr) {
    if (isReleased() || !Array.isArray(arr) || !root.BANK_ALL.length) return arr;
    if (arr.length !== root.BANK_ALL.length) return arr;
    if (arr[0] && root.BANK_ALL[0] && arr[0].s === root.BANK_ALL[0].s) return whitelistBank();
    return arr;
  }

  // 按钮：主站首页 header 与 PK 独立版共用这一套行为（点一下才释放，随时可收回）
  function toggle() {
    var toRelease = !isReleased();
    var msg = toRelease
      ? '释放全部题库？\n\n当前：精选 ' + INDEX.length + ' 题；释放后：全部 ' + root.BANK_ALL.length + ' 题（刷题、模拟考、诊断、PK、擂台）。\n题库一题不删、学生档案不受影响；设置只存本机，再点一次即可收回。'
      : '收回全部题库？\n\n将恢复默认：只开放 ' + INDEX.length + ' 题精选白名单；已作答记录不受影响。';
    if (typeof root.confirm === 'function' && !root.confirm(msg)) return;
    if (setReleased(toRelease)) { root.location.reload(); return; }
    // localStorage 不可用（隐私模式等）时，用地址栏 ?full=1 兜底，保留其余参数
    try {
      var u = new URL(root.location.href);
      if (toRelease) u.searchParams.set('full', '1'); else u.searchParams.delete('full');
      root.location.href = u.toString();
    } catch (e) {
      if (typeof root.alert === 'function') root.alert('本机无法保存设置；请在地址栏末尾加 ?full=1 后回车以释放全部题库');
    }
  }
  function renderButton() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    // 主站首页 header、PK/擂台顶栏、PK 独立版顶栏都可以放按钮，用 data-bank-gate 统一挂
    var list = document.querySelectorAll('[data-bank-gate]');
    Array.prototype.forEach.call(list, function (b) {
      var released = isReleased();
      b.textContent = released ? '🔓 全库 ' + root.BANK_ALL.length + ' 题' : '🔒 精选 ' + INDEX.length + ' 题';
      b.setAttribute('title', released
        ? '当前已释放全部 ' + root.BANK_ALL.length + ' 题；点击收回为精选 ' + INDEX.length + ' 题'
        : '当前默认只开放精选 ' + INDEX.length + ' 题；点击释放全部 ' + root.BANK_ALL.length + ' 题');
      b.onclick = toggle;
    });
  }

  root.XK_BANK_GATE = {
    isReleased: isReleased,
    setReleased: setReleased,
    apply: apply,
    guard: guard,
    toggle: toggle,
    renderButton: renderButton,
    fullCount: function () { return root.BANK_ALL.length; },
    whitelistCount: function () { return INDEX.length; },
    activeCount: function () { return (root.BANK || []).length; }
  };
  apply();
  renderButton();
  // 脚本若被放在 head（PK 独立版），按钮此时尚未解析，DOM 就绪后再刷一次
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', renderButton);
  }
})();
