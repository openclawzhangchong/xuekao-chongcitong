/* here.now 匿名发布（24h 临时站点）：POST publish → PUT 上传 → POST finalize
 * 用法：node tools/herenow-publish.js <目录> [slug]
 * 临时闭环用：匿名站点，24 小时自动删除 */
'use strict';
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('用法: node tools/herenow-publish.js <目录> [slug]'); process.exit(1); }
const slug = process.argv[3] || null;
const ROOT = path.join(dir.replace(/\\/g, '/'), '/');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg' };

function walk(d, base) {
  let out = [];
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) out = out.concat(walk(p, base));
    else out.push({ abs: p, rel: path.relative(base, p).replace(/\\/g, '/') });
  }
  return out;
}

(async () => {
  const files = walk(dir, dir).map(f => ({ path: f.rel, size: fs.statSync(f.abs).size, abs: f.abs }));
  console.log('发布目录: ' + dir + '  文件数: ' + files.length);
  // 1. create
  const body = { files: files.map(f => ({ path: f.path, size: f.size })) };
  if (slug) body.slug = slug;
  const r1 = await fetch('https://here.now/api/v1/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j1 = await r1.json();
  if (!r1.ok) { console.error('CREATE FAIL', r1.status, JSON.stringify(j1).slice(0, 600)); process.exit(1); }
  const up = j1.upload || {};
  const uploads = up.uploads || j1.uploads || [];
  const finalizeUrl = up.finalizeUrl || j1.finalizeUrl;
  const versionId = up.versionId || j1.versionId;
  const siteUrl = j1.siteUrl || j1.url;
  console.log('siteUrl: ' + siteUrl + '  finalize: ' + (finalizeUrl ? 'yes' : 'MISSING'));
  if (!uploads.length || !finalizeUrl) { console.error('响应结构异常:', JSON.stringify(j1).slice(0, 1200)); process.exit(1); }

  // 2. upload（uploads 与请求 files 顺序对应，或按 path 匹配）
  const byPath = {};
  uploads.forEach(u => { byPath[u.path || u.filePath || ''] = u; });
  for (const f of files) {
    const u = byPath[f.path] || uploads[files.indexOf(f)];
    const url = u.uploadUrl || u.url || u.putUrl;
    if (!url) { console.error('文件缺 uploadUrl: ' + f.path); process.exit(1); }
    const ext = path.extname(f.path).toLowerCase();
    const rr = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': MIME[ext] || 'application/octet-stream' },
      body: fs.readFileSync(f.abs)
    });
    if (!rr.ok) { console.error('UPLOAD FAIL ' + f.path + ' HTTP ' + rr.status); process.exit(1); }
    console.log('  ↑ ' + f.path + ' (' + f.size + 'B)');
  }

  // 3. finalize
  const r3 = await fetch(finalizeUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ versionId })
  });
  const j3 = await r3.json().catch(() => ({}));
  if (!r3.ok && r3.status !== 200 && r3.status !== 201) { console.error('FINALIZE FAIL', r3.status, JSON.stringify(j3).slice(0, 600)); process.exit(1); }
  console.log('== LIVE ==');
  console.log(JSON.stringify(j3).slice(0, 800));
})().catch(e => { console.error('PUBLISH FAIL:', e.message); process.exit(1); });
