/* 三方案 here.now 线上走查：真点真看 + console 报错收集
 * 用法：node tools/e2e-online-variants.js
 * 站点：A/B/C 三个 24h 匿名部署（/portal.html=门户, /=刷题, /courseware/=课件）
 * 退出码：有 FAIL → 1 */
'use strict';
const path = require('path');
const fs = require('fs');

function requirePlaywright() {
  for (const m of ['playwright-core', 'playwright', 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright-core']) {
    try { return require(m); } catch (e) { /* 换下一个 */ }
  }
  throw new Error('找不到 playwright-core');
}

const OUT = path.join(__dirname, '..', 'evidence', 'portal-online');
fs.mkdirSync(OUT, { recursive: true });
const SITES = [
  ['A', 'https://distant-rapids-9a9f.here.now/'],
  ['B', 'https://keen-bonnet-z3gh.here.now/'],
  ['C', 'https://frosty-halo-y92q.here.now/'],
];
const RESULTS = [];
let shotN = 0;
function check(name, ok, note) {
  RESULTS.push({ name, ok: !!ok, note: note || '' });
  console.log((ok ? '  ✓ ' : '  ✗ FAIL ') + name + (note ? ' —— ' + String(note).slice(0, 120) : ''));
  return !!ok;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const pw = requirePlaywright();
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });

  for (const [V, BASE] of SITES) {
    console.log('\n== 方案' + V + ' ' + BASE + ' ==');
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    // 1. 门户
    await page.goto(BASE + 'portal.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(600);
    const body = await page.content();
    check('P1 门户打开含徽标', body.includes('方案' + V), 'title=' + (await page.title()));
    check('P2 黑板入口存在', (await page.locator('[onclick*="黑板"], a[href*="黑板"]').count()) > 0);
    await page.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-portal-' + V.toLowerCase() + '.png') });

    // 2. 课件（真实网络加载中文文件名）
    const cw = page.locator('a[href*="第一章"]');
    if (await cw.count()) {
      await cw.first().click();
      try { await page.waitForLoadState('domcontentloaded', { timeout: 20000 }); } catch (e) { }
      await sleep(1500);
      const u = decodeURIComponent(page.url());
      const html = await page.content();
      check('P3 课件第一章加载', /第一章.*\.html/.test(u) && html.length > 5000, u.split('/').pop().slice(0, 40) + ' len=' + html.length);
      await page.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-courseware-' + V.toLowerCase() + '.png') });
    } else check('P3 课件第一章加载', false, '门户上找不到第一章链接');

    // 3. PK 直达（client 模式）
    await page.goto(BASE + '?client=1#/pk', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2200);
    const st = await page.evaluate(() => {
      const pk = document.getElementById('pkPage');
      const home = document.getElementById('home');
      return {
        pkOn: !!pk && !pk.classList.contains('hidden') && pk.offsetParent !== null,
        homeOff: !home || home.classList.contains('hidden') || home.offsetParent === null,
        pkMode: document.body.classList.contains('pk-mode'),
        client: document.body.classList.contains('client'),
        bank: (window.BANK || []).length,
        bankAll: (window.BANK_ALL || window.BANK || []).length,
      };
    });
    check('P4 PK 直达真实呈现', st.pkOn && st.homeOff && st.pkMode, 'pkOn=' + st.pkOn + ' homeOff=' + st.homeOff + ' pkMode=' + st.pkMode);
    check('P5 client 模式生效', st.client, 'body.client=' + st.client);
    check('P6 题库加载（全库 3982 + 四档闸门）', st.bankAll === 3982 && ([1000, 2000, 3000].includes(st.bank) || st.bank >= 3982), 'BANK=' + st.bank + ' 全库=' + st.bankAll);
    await page.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-pk-' + V.toLowerCase() + '.png') });

    // 4. 排行榜
    await page.goto(BASE + '?client=1#/honor', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1800);
    const honorTxt = await page.evaluate(() => {
      const el = document.getElementById('honorPage');
      return el && !el.classList.contains('hidden') ? (el.textContent || '').slice(0, 80) : '';
    });
    check('P7 排行榜打开', honorTxt.length > 0, honorTxt.slice(0, 40));
    await page.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-honor-' + V.toLowerCase() + '.png') });

    // 5. 擂台
    await page.goto(BASE + '?client=1#/arena', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1800);
    const arenaOn = await page.evaluate(() => {
      const el = document.getElementById('arenaPage');
      return !!el && !el.classList.contains('hidden');
    });
    check('P8 擂台打开', arenaOn);
    await page.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-arena-' + V.toLowerCase() + '.png') });

    // 6. 首页（刷题面板）
    await page.goto(BASE + '?client=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1800);
    const homeTxt = await page.evaluate(() => {
      const el = document.getElementById('home');
      return el && !el.classList.contains('hidden') ? (el.textContent || '').slice(0, 200) : '';
    });
    check('P9 刷题首页呈现', homeTxt.includes('刷题') || homeTxt.includes('模拟考'), homeTxt.slice(0, 50));
    await page.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-home-' + V.toLowerCase() + '.png') });

    // 7. 黑板直开
    await page.goto(BASE + 'courseware/' + encodeURIComponent('黑板.html'), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(900);
    check('P10 黑板加载', (await page.content()).length > 3000);

    // console 报错（过滤静态托管必然的 /api/* 404 —— 班级同步/学情接口在云端不存在属预期）
    const hard = errors.filter(e => !/api\/hello|api\/classroom|api\/bank|404|Failed to load resource/i.test(e));
    check('P11 无硬报错（/api 404 属静态托管预期）', hard.length === 0, hard.slice(0, 3).join(' | ') || 'clean，全部报错 ' + errors.length + ' 条: ' + errors.slice(0, 5).join(' § '));

    await ctx.close();
  }

  await browser.close();
  const pass = RESULTS.filter(r => r.ok).length;
  const fail = RESULTS.length - pass;
  console.log('\n== 汇总: ' + pass + ' PASS / ' + fail + ' FAIL ==');
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results: RESULTS }, null, 2));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E-ONLINE FAIL:', e); process.exit(1); });
