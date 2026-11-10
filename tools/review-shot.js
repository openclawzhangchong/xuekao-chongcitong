/* 审阅页截图工具：node tools/review-shot.js [startIdx] [count] [moduleFilter]
 * 用 file:// 打开 docs/题目逐题审阅.html，逐题截图到 evidence/qbank-review/ */
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
const startIdx = parseInt(process.argv[2] || '0', 10);
const count = parseInt(process.argv[3] || '3', 10);
const modFilter = process.argv[4] || '';

(async () => {
  const pw = requirePlaywright();
  const b = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const pg = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const url = 'file:///' + path.join(ROOT, 'docs', '题目逐题审阅.html').replace(/\\/g, '/');
  await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await pg.waitForTimeout(4000);
  const ui = await pg.evaluate(() => {
    const ctrls = [...document.querySelectorAll('button,select,input')].slice(0, 24)
      .map(e => e.tagName + ':' + (e.textContent || e.placeholder || e.value || '').trim().slice(0, 14));
    return { title: document.title, ctrls, bodyLen: document.body.innerText.length };
  });
  console.log(JSON.stringify(ui, null, 1).slice(0, 1200));
  await pg.screenshot({ path: path.join(OUT, 'review-page-top.png') });
  await b.close();
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
