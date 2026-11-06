/* 一屏装得下的机器闸门：node tools/gate-fit.js [宽 高 抽样数]
 * 默认 1366 768 200 —— 就是教室投屏那台电脑的分辨率。
 *
 * 做法：无头 Edge 打开线上拆分版，真点进双人 PK 和擂台赛并各开一局，
 *       然后把真实题目逐题塞进面板，调用页面自己的 renderSide / renderSeat
 *       （也就是 fitSide / fitSeat 本身），读自适应后的字号和「是否还得滚动」。
 * 两组：① 随机抽样（看整体率，设闸）② 全库最长的 20 题（看最坏情况，只观察不设闸）。
 * 退出码 1：随机样本滚动率 > GATE_SCROLL_MAX(默认 2%)，或中位字号 < GATE_FS_MIN(默认 20px)。
 *
 * 为什么要这个闸门：单元测试只能证明 fitToBox 的算术对，证明不了「CSS 里那些
 * 不跟字号走的零件」没把高度吃光。曾经 120 题全部顶到 16px 下限并开始滚动，六套测试却全绿。
 */
'use strict';
const path = require('path');

function requirePlaywright() {
  for (const m of ['playwright-core', 'playwright', 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright-core']) {
    try { return require(m); } catch (e) { /* 换下一个 */ }
  }
  throw new Error('找不到 playwright-core（本机 npm 全局目录）');
}

const W = parseInt(process.argv[2] || '1366', 10);
const H = parseInt(process.argv[3] || '768', 10);
const N = parseInt(process.argv[4] || '200', 10);
const SCROLL_MAX = parseFloat(process.env.GATE_SCROLL_MAX || '2');
const FS_MIN_MEDIAN = parseFloat(process.env.GATE_FS_MIN || '20');
const PAGE = 'file:///' + path.join(__dirname, '..', 'site', 'index.html').replace(/\\/g, '/');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 页面内执行：[which, 题目数组] → 逐题走真实渲染路径量一遍 */
function measurePage(arg) {
  var which = arg[0], qs = arg[1];
  var AR = which === 'arena';
  var rootId = AR ? 'arChalSeat' : 'pkPanelL';
  var bodyId = AR ? 'arChalBody' : 'LBody';
  var T = AR ? window.__ARENA_TEST : window.__PK_TEST;
  var sideObj = AR ? T.ar().right : T.pk().left;
  var out = { n: 0, hist: {}, scroll: 0, worst: [], box: { w: 0, h: 0, bodyTop: 0, need: 0 } };
  qs.forEach(function (q) {
    var root = document.getElementById(rootId);
    var body = document.getElementById(bodyId);
    if (!root || !body) return;
    sideObj.seq = [q];
    sideObj.idx = 0;
    sideObj.answered = {};
    sideObj.locked = false;
    sideObj.done = false;
    T.render(AR ? 'chal' : 'L');            // 真代码：renderSeat / renderSide → fitSeat / fitSide
    out.n++;
    var fs = parseFloat(getComputedStyle(root).getPropertyValue(AR ? '--arfs' : '--pkfs'));
    var scrolled = root.classList.contains(AR ? 'ar-pkfit-scroll' : 'pkfit-scroll');
    if (scrolled) {
      out.scroll++;
      out.worst.push(q.qt + ' 题干' + String(q.s).length + '字/' + q.o.length + '选项 → ' +
        fs + 'px 仍溢出 ' + (root.scrollHeight - root.clientHeight) + 'px');
    } else {
      out.hist[fs] = (out.hist[fs] || 0) + 1;
    }
    out.box = { w: Math.round(root.getBoundingClientRect().width), h: root.clientHeight,
      bodyTop: Math.round(body.offsetTop), need: Math.max(out.box.need, root.scrollHeight) };
  });
  return out;
}

function summarize(label, r) {
  var sizes = [];
  Object.keys(r.hist).forEach(function (fs) { for (var i = 0; i < r.hist[fs]; i++) sizes.push(+fs); });
  sizes.sort(function (a, b) { return a - b; });
  var med = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  var min = sizes.length ? sizes[0] : 0;
  var rate = r.n ? (r.scroll / r.n * 100) : 0;
  console.log(label.padEnd(21) + ' 面板 ' + r.box.w + '×' + r.box.h + 'px（题目区从 ' + r.box.bodyTop +
    'px 起，最高内容 ' + r.box.need + 'px） 样本 ' + r.n + ' 题  中位 ' + med + 'px  最小 ' + min +
    'px  需滚动 ' + r.scroll + ' 题 = ' + rate.toFixed(1) + '%');
  if (r.worst.length) console.log('  溢出明细（前 4）：' + r.worst.slice(0, 4).join(' | '));
  return { med: med, min: min, rate: rate };
}

(async () => {
  const pw = requirePlaywright();
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(PAGE);
  await page.waitForFunction('window.BANK && window.BANK.length');

  // 页面里先备好两组题：随机 N 题 + 全库「题干+选项总字数」最长的 20 题
  const sets = await page.evaluate(function (n) {
    function len(q) { return String(q.s).length + q.o.reduce(function (a, o) { return a + String(o[1] || '').length + 3; }, 0); }
    var rnd = window.XK.shuffle(window.BANK.slice()).slice(0, n);
    var worst = window.BANK.slice().sort(function (a, b) { return len(b) - len(a); }).slice(0, 20);
    return { rnd: rnd, worst: worst };
  }, N);

  /* ---------- 双人 PK ---------- */
  await page.click('#entCardPk'); await sleep(300);
  await page.click('#btnRand'); await sleep(200);
  await page.click('#btnStart'); await sleep(500);
  const pkRnd = await page.evaluate(measurePage, ['pk', sets.rnd]);
  const pkWorst = await page.evaluate(measurePage, ['pk', sets.worst]);

  /* ---------- 擂台赛 ---------- */
  await page.evaluate(function () { document.querySelector('.tab[data-t="home"]').click(); });
  await sleep(300);
  await page.click('#entCardArena'); await sleep(300);
  const cards = page.locator('#arPickList .ar-pick');
  await cards.nth(0).click(); await cards.nth(1).click();
  await page.click('#arGo'); await sleep(500);
  const arRnd = await page.evaluate(measurePage, ['arena', sets.rnd]);
  const arWorst = await page.evaluate(measurePage, ['arena', sets.worst]);

  console.log('视口 ' + W + '×' + H + '（教室投屏）  题库 ' + (await page.evaluate(() => window.BANK.length)) + ' 题');
  const s = [summarize('PK 左栏·随机', pkRnd), summarize('PK 左栏·最长 20', pkWorst),
    summarize('擂台挑战者席·随机', arRnd), summarize('擂台挑战者席·最长 20', arWorst)];

  const bad = [];
  if (s[0].rate > SCROLL_MAX) bad.push('双人 PK 随机样本滚动率 ' + s[0].rate.toFixed(1) + '% > ' + SCROLL_MAX + '%');
  if (s[2].rate > SCROLL_MAX) bad.push('擂台随机样本滚动率 ' + s[2].rate.toFixed(1) + '% > ' + SCROLL_MAX + '%');
  if (s[0].med < FS_MIN_MEDIAN) bad.push('双人 PK 中位字号 ' + s[0].med + 'px < ' + FS_MIN_MEDIAN + 'px');
  if (s[2].med < FS_MIN_MEDIAN) bad.push('擂台中位字号 ' + s[2].med + 'px < ' + FS_MIN_MEDIAN + 'px');
  if (errors.length) bad.push('页面报错 ' + errors.length + ' 条：' + errors[0]);
  await browser.close();
  if (bad.length) { console.error('\n!! 一屏装不下：\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log('\n✓ 随机题在投屏分辨率下一屏装得下（滚动率 ≤ ' + SCROLL_MAX + '%、中位字号 ≥ ' + FS_MIN_MEDIAN +
    'px）；最长 20 题只观察不设闸');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
