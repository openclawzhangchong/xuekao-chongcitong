/* 单题渲染截图器：node tools/review-render.js <逗号分隔的题号(1起)或qid列表> [输出目录]
 * 每题独立渲染 HTML → 截图，零状态机依赖，绝不串题 */
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
global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8'));
require(path.join(ROOT, 'src', 'engine.js'));
const BANK = window.BANK, XK = window.XK;

const targets = (process.argv[2] || '').split(',').map(s => s.trim()).filter(Boolean);
const OUT = process.argv[3] || 'C:/Users/Administrator/Desktop/题目审阅-不确定';
fs.mkdirSync(OUT, { recursive: true });

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderHTML(q, idx) {
  const ans = String(q.a || '').trim();
  const optHtml = (q.o || []).map(o => {
    const key = String(o[0]);
    const hit = ans.includes(key);
    return '<div class="opt' + (hit ? ' hit' : '') + '"><span class="k">' + esc(key) + '</span><span>' + esc(o[1]) + '</span>' + (hit ? '<em>标答</em>' : '') + '</div>';
  }).join('');
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>' +
    'body{font-family:"Microsoft YaHei",system-ui;margin:0;padding:22px;background:#f4f6fb;color:#1e2430}' +
    '.card{background:#fff;border:1px solid #e2e6f0;border-radius:14px;padding:20px 24px;max-width:860px}' +
    '.meta{font-size:13px;color:#6b7280;margin-bottom:10px}.meta b{color:#6d5bd0}' +
    '.stem{font-size:19px;line-height:1.6;margin:12px 0 16px;white-space:pre-wrap}' +
    '.opt{display:flex;gap:10px;padding:9px 13px;border:1px solid #e2e6f0;border-radius:9px;margin:7px 0;font-size:15px;line-height:1.5;background:#fafbff}' +
    '.opt.hit{background:#eef7ee;border-color:#3ba55c}.opt.hit em{margin-left:auto;color:#3ba55c;font-style:normal;font-size:12px;font-weight:700}' +
    '.k{font-weight:700;color:#6d5bd0;flex:0 0 18px}' +
    '.ans{margin-top:14px;padding:10px 14px;background:#eef4ff;border-left:4px solid #6d5bd0;border-radius:8px;font-size:15px}' +
    '.exp{margin-top:10px;font-size:13.5px;color:#4b5563;line-height:1.7}' +
    '</style></head><body><div class="card">' +
    '<div class="meta">#' + (idx + 1) + ' · qid <b>' + esc(XK.qidOf(q)) + '</b> · ' + esc(q.m) + ' ' + esc(q.kd) + ' · ' + esc(q.qt) + (q.src ? ' · ' + esc(String(q.src).slice(0, 14)) : '') + '</div>' +
    '<div class="stem">' + esc(q.s) + '</div>' + optHtml +
    '<div class="ans">正确答案：<b>' + esc(ans) + '</b></div>' +
    '<div class="exp">解析：' + esc(q.e || '(无解析)') + '</div>' +
    '</div></body></html>';
}

(async () => {
  const pw = requirePlaywright();
  const b = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const pg = await b.newPage({ viewport: { width: 920, height: 720 } });
  const tmp = path.join(OUT, '_render.html');
  let ok = 0;
  for (const t of targets) {
    let q, idx;
    if (/^\d+$/.test(t)) { idx = parseInt(t, 10) - 1; q = BANK[idx]; }
    else { idx = BANK.findIndex(x => XK.qidOf(x) === t); q = BANK[idx]; }
    if (!q) { console.log('找不到:', t); continue; }
    const qid = XK.qidOf(q);
    fs.writeFileSync(tmp, renderHTML(q, idx), 'utf8');
    await pg.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pg.waitForTimeout(150);
    const fp = path.join(OUT, '审-' + String(idx + 1).padStart(4, '0') + '-' + qid + '.png');
    await pg.screenshot({ path: fp, fullPage: true });
    ok++;
    console.log('✓', path.basename(fp));
  }
  fs.unlinkSync(tmp);
  await b.close();
  console.log('完成:', ok, '张 →', OUT);
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
