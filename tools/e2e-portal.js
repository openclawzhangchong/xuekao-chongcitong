/* 三方案整合客户端 E2E：对每个方案的免安装文件夹起真实服务 → 无头 Edge 验证门户链路
 * 用法：node tools/e2e-portal.js
 * 验证项（每方案）：
 *   1. /portal.html?client=1 可打开且标题/方案徽标正确
 *   2. 课件链接真实可达（点第一章 → 页面有内容）
 *   3. 功能卡跳转 hash 路由正确（PK 卡 → /#/pk 视图）
 *   4. 黑板可达
 * 退出码：有 FAIL → 1
 * 证据：evidence/portal-variants/*.png + results.json
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

function requirePlaywright() {
  for (const m of ['playwright-core', 'playwright', 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright-core']) {
    try { return require(m); } catch (e) { /* 换下一个 */ }
  }
  throw new Error('找不到 playwright-core');
}

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist-client');
const OUT = path.join(ROOT, 'evidence', 'portal-variants');
const PORT = 8953;
const BASE = 'http://127.0.0.1:' + PORT;
fs.mkdirSync(OUT, { recursive: true });

const RESULTS = [];
function check(name, ok, note) {
  RESULTS.push({ name, ok: !!ok, note: note || '' });
  console.log((ok ? '  ✓ ' : '  ✗ FAIL ') + name + (note ? ' —— ' + note : ''));
  return !!ok;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killPort() {
  try {
    const out = execSync('netstat -ano | findstr :' + PORT + ' | findstr LISTENING', { encoding: 'utf8' });
    const pids = [...new Set(out.split('\n').map(l => l.trim().split(/\s+/)[4]).filter(Boolean))];
    pids.forEach(pid => { try { execSync('taskkill /F /T /PID ' + pid); } catch (e) { } });
    if (pids.length) console.log('  已停旧服务 PID: ' + pids.join(','));
  } catch (e) { /* 无监听 */ }
}

function startServer(dir) {
  const py = path.join(dir, 'python', 'pythonw.exe');
  const usePy = fs.existsSync(py) ? py : 'python';
  const srv = spawn(usePy, ['-I', path.join(dir, 'server.py')], { cwd: dir, stdio: 'ignore', shell: false });
  for (let i = 0; i < 40; i++) {
    try {
      execSync('netstat -ano | findstr :' + PORT + ' | findstr LISTENING', { encoding: 'utf8' });
      return srv;
    } catch (e) { sleep(250); }
  }
  throw new Error('服务 8s 内未监听 ' + PORT);
}

(async () => {
  const pw = requirePlaywright();
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const variants = ['A', 'B', 'C'];
  let shotN = 0;

  for (const V of variants) {
    const dir = path.join(DIST, '学考冲刺通课堂版-方案' + V);
    if (!fs.existsSync(dir)) { check('方案' + V + ' 免安装文件夹存在', false, dir); continue; }
    console.log('\n== 方案' + V + ' ==');
    killPort();
    startServer(dir);

    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();

    // 1. 门户打开 + 方案徽标
    await page.goto(BASE + '/portal.html?client=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(400);
    const body = await page.content();
    check('方案' + V + ' 门户打开含徽标', body.includes('方案' + V), 'title=' + (await page.title()));
    await page.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-portal-' + V.toLowerCase() + '.png') });

    // 1b. 黑板入口（须在门户首页 DOM 上查）
    const bb = page.locator('[onclick*="黑板"], a[href*="黑板"]');
    check('方案' + V + ' 黑板入口存在', (await bb.count()) > 0);

    // 2. 课件链接可达（点第一章）
    const chapLink = page.locator('a[href*="第一章"]');
    if (await chapLink.count()) {
      await chapLink.first().click();
      await sleep(1200);
      const u = page.url();
      const html = await page.content();
      check('方案' + V + ' 课件跳转第一章', /第一章.*\.html$/.test(decodeURIComponent(u.split('/').pop())) && html.length > 5000, u.slice(-40));
      await page.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-courseware-' + V.toLowerCase() + '.png') });
      await page.goBack(); await sleep(400);
    } else check('方案' + V + ' 课件链接存在', false, '找不到 a[href*="第一章"]');

    // 3. 功能卡 hash 路由（PK 卡）
    const pkOk = await page.evaluate(() => new Promise(res => {
      const links = [...document.querySelectorAll('[onclick*="#/pk"]')];
      res(links.length > 0);
    }));
    check('方案' + V + ' PK 卡片路由指向 #/pk', pkOk);
    await page.evaluate(() => { const el = document.querySelector('[onclick*="#/pk"]'); if (el) el.click(); });
    await sleep(900);
    check('方案' + V + ' PK 页打开', page.url().includes('#/pk'), page.url());
    await page.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-pk-route-' + V.toLowerCase() + '.png') });

    await ctx.close();
  }

  killPort();
  await browser.close();

  const pass = RESULTS.filter(r => r.ok).length;
  const fail = RESULTS.length - pass;
  console.log('\n== 汇总: ' + pass + ' PASS / ' + fail + ' FAIL ==');
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results: RESULTS }, null, 2));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E-PORTAL FAIL:', e); process.exit(1); });
