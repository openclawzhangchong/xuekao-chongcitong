/* 审阅页批量截图器（逐题审读流水线的视觉通道）
 * 用法：node tools/review-batch-shot.js <模块过滤，空=全部> [起题号] [止题号]
 * 产物：evidence/qbank-review/shot-NNNN.png（N=审阅页编号1起）
 * 交互：select 模块 → 跳号 → 截图 → 下一题，全键盘/控件驱动 */
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

(async () => {
  const modFilter = process.argv[2] || '';
  const from = parseInt(process.argv[3] || '1', 10);
  const to = parseInt(process.argv[4] || '0', 10);
  const pw = requirePlaywright();
  const b = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const pg = await b.newPage({ viewport: { width: 900, height: 780 } });
  const url = 'file:///' + path.join(ROOT, 'docs', '题目逐题审阅.html').replace(/\\/g, '/');
  await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await pg.waitForTimeout(4000);

  // 页面全局：找当前题号渲染函数或状态对象
  const api = await pg.evaluate(() => {
    const keys = Object.keys(window).filter(k => /q|render|cur|idx|state|jump|goto/i.test(k) && typeof window[k] !== 'undefined');
    return { keys: keys.slice(0, 50), total: (window.BANK || window.ALL || window.QUESTIONS || []).length };
  });
  console.log('window候选:', JSON.stringify(api).slice(0, 400));

  // 模块筛选
  if (modFilter) {
    const sel = await pg.$('select');
    const opts = await sel.evaluate(el => [...el.options].map(o => o.textContent.trim()));
    const hit = opts.findIndex(t => t.startsWith(modFilter));
    if (hit >= 0) { await sel.selectOption({ index: hit }); await pg.waitForTimeout(700); }
    console.log('模块筛选:', modFilter, '→', hit >= 0 ? opts[hit] : '未命中');
  }
  const total = await pg.evaluate(() => {
    const m = document.body.innerText.match(/当前筛选\s*(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  console.log('筛选后总数:', total);

  // 跳号优先用页面全局 jump()；失败自愈：reload 后再试
  async function gotoN(n) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await pg.evaluate((v) => { if (typeof window.jump === 'function') window.jump(v); else {
        const inp = document.querySelector('input[placeholder*="qid"]');
        if (inp) { inp.value = String(v); inp.dispatchEvent(new Event('input', { bubbles: true })); }
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('跳号'));
        if (btn) btn.click();
      } }, n);
      await pg.waitForTimeout(450);
      const ok = await pg.evaluate(() => {
        const t = document.body.innerText;
        return /qid[:：]\s*[A-Za-z0-9\-]/.test(t) && !t.includes('没有符合条件的题目');
      });
      if (ok) return true;
      await pg.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await pg.waitForTimeout(3500);
    }
    return false;
  }
  const end = to > 0 ? Math.min(to, total) : total;
  let shots = 0, fails = 0;
  for (let n = from; n <= end; n++) {
    const ok = await gotoN(n);
    if (!ok) { fails++; console.log('跳号失败:', n); if (fails > 8) { console.error('连续失败过多，中止'); break; } continue; }
    const qid = await pg.evaluate(() => {
      const m = document.body.innerText.match(/qid[:：]\s*([A-Za-z0-9\-]+)/);
      return m ? m[1] : 'q' + n;
    }, n);
    await pg.screenshot({ path: path.join(OUT, 'shot-' + String(n).padStart(4, '0') + '-' + qid + '.png') });
    shots++;
    if (shots % 25 === 0) console.log('进度:', shots, '/', end - from + 1);
  }
  console.log('完成截图:', shots, '张，失败跳号:', fails, '->', OUT);
  await b.close();
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
