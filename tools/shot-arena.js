/* 擂台赛 / 双人 PK 对比截图 + 布局数字取证（无头 Edge，1366×768 = 教室投屏分辨率）
 * 用法：node tools/shot-arena.js            默认 1366×768
 *      node tools/shot-arena.js 1920 1080  换分辨率再拍一组
 * 产物：evidence/arena-shots/*.png + 控制台打印两侧宽度占比、分割线、字号
 * 依赖：playwright-core（本机装在 npm 全局目录，脚本自己找）
 */
'use strict';
const path = require('path');
const fs = require('fs');

function requirePlaywright() {
  const tries = ['playwright-core', 'playwright',
    'C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright-core'];
  for (const m of tries) { try { return require(m); } catch (e) { /* 换下一个 */ } }
  throw new Error('找不到 playwright-core，本机 npm 全局目录里没有吗？');
}

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'evidence', 'arena-shots');
const PAGE = 'file:///' + path.join(ROOT, 'site', 'index.html').replace(/\\/g, '/');
const W = parseInt(process.argv[2] || '1366', 10);
const H = parseInt(process.argv[3] || '768', 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const pw = requirePlaywright();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(PAGE);
  await page.waitForFunction('window.BANK && window.BANK.length');
  // 干净的擂台存档，保证截图是「第一场」而不是上一轮的尾巴
  await page.evaluate(() => { localStorage.removeItem('pk.arena.v1'); localStorage.removeItem('pk.arena.cfg'); });
  await page.reload();
  await page.waitForFunction('window.BANK && window.BANK.length');

  const shot = async (name) => {
    const file = path.join(OUT, name);
    await page.screenshot({ path: file });
    console.log('  截图 → evidence/arena-shots/' + name);
    return file;
  };

  /* ---------- 1. 首页两个入口 ---------- */
  await page.evaluate(() => {
    const el = document.getElementById('entCardArena');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await sleep(200);
  await shot('1-home-entries.png');

  /* ---------- 2. 双人 PK 对战中 ---------- */
  await page.click('#entCardPk');
  await sleep(300);
  await page.click('#btnRand');
  await sleep(200);
  await page.click('#btnStart');
  await sleep(500);
  const pk = await page.evaluate(() => {
    const L = document.getElementById('pkPanelL'), R = document.getElementById('pkPanelR');
    const cs = getComputedStyle(document.getElementById('pkArena'));
    const before = getComputedStyle(document.getElementById('pkArena'), '::before');
    return {
      mode: document.body.className,
      leftW: Math.round(L.getBoundingClientRect().width),
      rightW: Math.round(R.getBoundingClientRect().width),
      gap: cs.gap,
      dividerW: before.width, dividerContent: before.content,
      pkfs: getComputedStyle(L).getPropertyValue('--pkfs').trim(),
      stem: ((L.querySelector('.pk-qstem, .qstem, .stem') || {}).textContent || '').slice(0, 40)
    };
  });
  await shot('2-pk-running.png');

  /* ---------- 3. 擂台第一场（争擂） ---------- */
  // 擂台的「← 回双人 PK」按字面回 PK，回首页要点底部「首页」页签
  await page.evaluate(() => { document.querySelector('.tab[data-t="home"]').click(); });
  await sleep(300);
  await page.click('#entCardArena');
  await sleep(300);
  // 候选卡每次渲染都重建，用 locator 现取现点，别攥着旧 handle
  const pickCards = page.locator('#arPickList .ar-pick');
  await pickCards.nth(0).click();
  await pickCards.nth(1).click();
  await sleep(150);
  await page.click('#arGo');
  await sleep(500);
  const ar1 = await page.evaluate(() => {
    const C = document.getElementById('arChampSeat'), X = document.getElementById('arChalSeat');
    return {
      mode: document.body.className,
      banner: document.getElementById('arBanner').textContent,
      champW: Math.round(C.getBoundingClientRect().width),
      chalW: Math.round(X.getBoundingClientRect().width),
      arfs: getComputedStyle(C).getPropertyValue('--arfs').trim(),
      stem: (document.querySelector('#arChampBody .ar-qstem') || {}).textContent || '',
      goText: document.getElementById('arGo').textContent
    };
  });
  console.log('  [争擂] ' + ar1.banner + ' | ' + ar1.goText + ' | 擂主席 ' + ar1.champW + 'px 挑战者席 ' + ar1.chalW + 'px');
  await shot('3-arena-round1-contest.png');

  /* ---------- 4. 打完第一场 → 守擂态 ---------- */
  // 面板按钮三态：选择答案后提交（禁用）→ 提交本题 → 下一题 →，逐态推进一步。
  // 擂主席点第一个选项、挑战者席点最后一个：两边答案不同才不会场场平局（第一场平局会加赛）。
  async function answerRound() {
    for (let i = 0; i < 90; i++) {
      const step = await page.evaluate(() => {
        let acted = false;
        ['Champ', 'Chal'].forEach(function (k) {
          const body = document.getElementById('ar' + k + 'Body');
          const btn = document.getElementById('ar' + k + 'Submit');
          if (!body || !btn) return;
          const t = btn.textContent;
          const all = body.querySelectorAll('.ar-opt');
          const opt = k === 'Champ' ? all[0] : all[all.length - 1];
          if (t.indexOf('选择答案后提交') !== -1 && opt) { opt.click(); acted = true; return; }
          if (!btn.disabled && (t.indexOf('提交本题') !== -1 || t.indexOf('下一题') !== -1)) { btn.click(); acted = true; }
        });
        return { acted: acted, idle: /开始/.test(document.getElementById('arGo').textContent) };
      });
      if (step.idle) return true;
      await sleep(520);
      if (!step.acted) await sleep(400);
    }
    return false;
  }
  const roundDone = await answerRound();
  await sleep(900);
  const ar2 = await page.evaluate(() => ({
    banner: document.getElementById('arBanner').textContent,
    champTag: document.getElementById('arChampTag').textContent,
    roundInfo: document.getElementById('arRoundInfo').textContent,
    note: document.getElementById('arNote').textContent,
    goText: document.getElementById('arGo').textContent,
    picks: Array.from(document.querySelectorAll('#arPickList .pn')).map((e) => e.textContent)
  }));
  console.log('  [守擂] 打完=' + roundDone + ' | ' + ar2.banner + ' | ' + ar2.roundInfo + ' | 候选 ' + ar2.picks.join('、'));
  await page.evaluate(() => { const c = document.querySelector('#arPickList .ar-pick'); if (c) c.click(); });
  await sleep(250);
  await shot('4-arena-defending.png');

  /* ---------- 5. 结算弹窗 ---------- */
  await page.click('#arStop');
  await sleep(500);
  const settle = await page.evaluate(() => ({
    toast: document.getElementById('arToast').textContent,
    hidden: document.getElementById('arResultMask').classList.contains('hidden'),
    main: document.getElementById('arResMain').textContent,
    rows: document.getElementById('arResTable').children.length,
    never: document.getElementById('arResNever').textContent.slice(0, 60)
  }));
  await shot('5-arena-settle.png');

  /* ---------- 6. 「← 回双人 PK」按标签走，不玩文字游戏 ---------- */
  if (!settle.hidden) { await page.click('#arResClose', { timeout: 8000 }); await sleep(200); }
  await page.click('#arBack', { timeout: 8000 });
  await sleep(300);
  const back = await page.evaluate(() => ({
    body: document.body.className,
    pkVisible: !document.getElementById('pkPage').classList.contains('hidden'),
    arVisible: !document.getElementById('arenaPage').classList.contains('hidden')
  }));

  console.log('\n视口 ' + W + '×' + H);
  console.log('双人 PK  body=' + pk.mode + '  左 ' + pk.leftW + 'px / 右 ' + pk.rightW + 'px（占视口 ' +
    (pk.leftW / W * 100).toFixed(1) + '% / ' + (pk.rightW / W * 100).toFixed(1) + '%）  gap=' + pk.gap +
    '  中缝分割线 width=' + pk.dividerW + '  --pkfs=' + pk.pkfs + '  题干：' + pk.stem);
  console.log('擂台第一场 body=' + ar1.mode + '  擂主席 ' + ar1.champW + 'px / 挑战者席 ' + ar1.chalW + 'px（占视口 ' +
    (ar1.champW / W * 100).toFixed(1) + '% / ' + (ar1.chalW / W * 100).toFixed(1) + '%）  --arfs=' + ar1.arfs);
  console.log('  横幅：' + ar1.banner);
  console.log('  按钮：' + ar1.goText + '   题干：' + (ar1.stem || '').slice(0, 40));
  console.log('擂台守擂  第一场打完=' + roundDone + '  横幅：' + ar2.banner + '  ' + ar2.roundInfo + '  席位标签：' + ar2.champTag);
  console.log('  底部：' + ar2.note + '  按钮：' + ar2.goText + '  候选：' + ar2.picks.join('、'));
  console.log('  [结算] toast=' + settle.toast + ' 主句=' + settle.main);
  console.log('结算弹窗  已弹出=' + (!settle.hidden) + '  主句：' + settle.main + '  战绩表 ' + settle.rows + ' 行');
  console.log('  未上场：' + settle.never);
  console.log('返回按钮  body=' + back.body + '  PK 页可见=' + back.pkVisible + '  擂台页可见=' + back.arVisible);
  console.log(errors.length ? ('!! 页面报错 ' + errors.length + ' 条：' + errors[0]) : '页面零报错 ✓');

  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
