'use strict';
const path = require('path');
function requirePlaywright() {
  for (const m of ['playwright-core', 'playwright', 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright-core']) {
    try { return require(m); } catch (e) {}
  }
  throw new Error('no playwright-core');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const pw = requirePlaywright();
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const reqs = [];
  page.on('request', (r) => { if (r.url().includes('/api/classroom')) reqs.push(r.method() + ' ' + r.url()); });
  page.on('pageerror', (e) => console.log('pageerror:', String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console-err:', m.text().slice(0, 160)); });
  await page.goto('http://127.0.0.1:8953/');
  await page.waitForFunction('window.BANK && window.BANK.length');
  await sleep(1200);
  const st1 = await page.evaluate(() => ({
    hasSync: !!window.__CLASSROOM_SYNC,
    pkInit: !!window.__PK_TEST,
    hello: null,
  }));
  st1.hello = await page.evaluate(async () => { try { return await (await fetch('/api/hello')).json(); } catch (e) { return 'ERR ' + e.message; } });
  console.log('初始状态:', JSON.stringify(st1));
  // 直接测 push
  await page.evaluate(() => {
    localStorage.setItem('pk.matches', JSON.stringify([{ ts: 1, left: { sid: 'T1', name: '甲', score: 3 }, right: { sid: 'T2', name: '乙', score: 1 }, qcount: 3, winner: 'L' }]));
    window.__CLASSROOM_SYNC.mark('matches');
  });
  await sleep(2200);
  const srv = await page.evaluate(async () => { try { return await (await fetch('/api/classroom')).json(); } catch (e) { return { err: e.message }; } });
  console.log('服务端 classroom:', JSON.stringify(srv).slice(0, 200));
  console.log('捕获请求:', JSON.stringify(reqs));
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
