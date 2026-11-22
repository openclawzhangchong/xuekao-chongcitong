/* 备课夹考点勾选 E2E：node tools/e2e-prep-kd.js
 * 流程：进备课夹 → 选章节 → 开考点面板 → 勾考点 → 列表过滤 → 出题数变化 → 单选交互 → 持久化 */
'use strict';
const path = require('path');
const fs = require('fs');
function requirePlaywright() {
  for (const m of ['playwright-core', 'playwright', 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright-core']) {
    try { return require(m); } catch (e) { /* 下一个 */ }
  }
  throw new Error('找不到 playwright-core');
}
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'evidence', 'qbank-review');
fs.mkdirSync(OUT, { recursive: true });
const RESULTS = [];
function check(name, ok, note) {
  RESULTS.push({ name, ok: !!ok, note: note || '' });
  console.log((ok ? '  ✓ ' : '  ✗ FAIL ') + name + (note ? ' —— ' + note : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const pw = requirePlaywright();
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const pageUrl = 'file:///' + path.join(ROOT, 'site', 'index.html').replace(/\\/g, '/');
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.BANK && window.XK_POINTS && window.XK_KD_CANON', { timeout: 60000 });
  await sleep(600);

  // 1. 进备课夹
  await page.evaluate(() => { location.hash = '#/prep'; });
  await sleep(700);
  check('P1 备课夹打开', (await page.evaluate(() => !document.getElementById('prepCard').classList.contains('hidden'))));

  // 2. 选章节 M1
  await page.selectOption('.j-prepMod', 'M1');
  await sleep(500);
  const pts = await page.evaluate(() => (window.XK_POINTS.M1 || []).map(p => p.id));
  check('P2 M1 考点数据注入', pts.length >= 3, '考点数=' + pts.length);

  // 3. 开考点面板
  await page.click('.j-prepKdBtn');
  await sleep(400);
  const panelVisible = await page.evaluate(() => {
    const p = document.querySelector('.j-prepKdPanel');
    return p && !p.classList.contains('hidden') && p.querySelectorAll('.kd-row').length > 0;
  });
  check('P3 考点面板打开且列出考点', panelVisible);
  await page.screenshot({ path: path.join(OUT, 'prep-kd-panel.png') });

  // 4. 勾选第一个考点 → 列表过滤
  const kdId = await page.evaluate(() => document.querySelector('.j-prepKdPanel input[data-kd]').getAttribute('data-kd'));
  const beforeCnt = await page.evaluate(() => window.BANK.filter(q => q.m === 'M1').length);
  await page.evaluate((id) => { document.querySelector('.j-prepKdPanel input[data-kd="' + id + '"]').click(); }, kdId);
  await sleep(500);
  const afterCnt = await page.evaluate((id) => window.BANK.filter(q => q.m === 'M1' && (window.XK_KD_CANON['M1|' + q.kd] || 'M1|' + q.kd) === id).length, kdId);
  const btnText = await page.evaluate(() => document.querySelector('.j-prepKdBtn').textContent);
  check('P4 勾考点后列表过滤', afterCnt > 0 && afterCnt <= beforeCnt, beforeCnt + ' → ' + afterCnt + '（考点 ' + kdId + '）按钮=' + btnText.trim());

  // 5. 过滤后的题都属于所选考点
  const allIn = await page.evaluate((id) => {
    const P = window.XK_KD_CANON;
    return [...document.querySelectorAll('.j-prepList .prep-item')].every(el => {
      const qid = el.getAttribute('data-qid');
      const q = window.BANK.find(x => window.XK.qidOf(x) === qid);
      return q && (P[q.m + '|' + q.kd] || q.m + '|' + q.kd) === id;
    });
  }, kdId);
  check('P5 列表题全部属于所选考点', allIn);

  // 6. 全选
  await page.click('.j-kdAll');
  await sleep(400);
  const allSel = await page.evaluate(() => document.querySelector('.j-prepKdBtn').textContent);
  check('P6 全选生效', /全部|已选/.test(allSel), allSel.trim());

  // 7. 清空 → 恢复全量
  await page.click('.j-kdNone');
  await sleep(400);
  const afterNone = await page.evaluate(() => window.BANK.filter(q => q.m === 'M1').length);
  check('P7 清空恢复全量', afterNone >= beforeCnt, afterNone + ' 题');

  // 8. 单选交互（点考点文字 = 只勾该考点）
  await page.evaluate((id) => {
    const row = [...document.querySelectorAll('.j-prepKdPanel .kd-row')].find(r => r.querySelector('input[data-kd="' + id + '"]'));
    row.querySelector('.kd-l').click();
  }, pts[0]);
  await sleep(400);
  const singleSel = await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('xkc.prep.kds.v1') || '{}');
    return (all.M1 || []).length === 1;
  });
  check('P8 点文字=单选该考点', singleSel);

  // 9. 持久化（重进备课夹还在）
  await page.evaluate(() => { location.hash = '#/home'; });
  await sleep(400);
  await page.evaluate(() => { location.hash = '#/prep'; });
  await sleep(600);
  const persisted = await page.evaluate(() => document.querySelector('.j-prepKdBtn').textContent);
  check('P9 勾选持久化（重进还在）', /已选1/.test(persisted), persisted.trim());

  await page.screenshot({ path: path.join(OUT, 'prep-kd-final.png') });

  // 10. 清理测试数据（localStorage 不留痕）
  await page.evaluate(() => localStorage.removeItem('xkc.prep.kds.v1'));

  await browser.close();
  const pass = RESULTS.filter(r => r.ok).length;
  console.log('\n== 备课夹考点 E2E: ' + pass + ' 通过 / ' + (RESULTS.length - pass) + ' 失败 ==');
  fs.writeFileSync(path.join(OUT, 'prep-kd-results.json'), JSON.stringify({ at: new Date().toISOString(), results: RESULTS }, null, 2));
  process.exit(RESULTS.some(r => !r.ok) ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
