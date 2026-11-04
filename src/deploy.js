/* here.now 部署脚本：首次发布或更新已有站点（适配真实 API 结构）
 * 用法: node src/deploy.js <目录> [slug]
 *   无 slug → 创建新站点（slug 服务端随机生成）
 *   有 slug → PUT 更新该站点（带 baseVersionId 乐观锁，线上被他人改过会报 version_conflict） */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = 'https://here.now';
const key = fs.readFileSync(path.join(os.homedir(), '.herenow', 'credentials'), 'utf8').trim();

const target = process.argv[2];
const slug = process.argv[3] || null;
if (!target) { console.error('用法: node src/deploy.js <目录> [slug]'); process.exit(1); }

const files = [];
(function collect(p, rel) {
  const st = fs.statSync(p);
  if (st.isDirectory()) for (const n of fs.readdirSync(p)) collect(path.join(p, n), rel ? rel + '/' + n : n);
  else files.push({ abs: p, rel: rel.replace(/\\/g, '/'), size: st.size });
})(target, '');

function api(method, url, body) {
  return fetch(url, {
    method,
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
    body: body === undefined ? undefined : JSON.stringify(body)
  }).then(async r => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('API FAIL', method, r.status, JSON.stringify(j).slice(0, 400)); process.exit(1); }
    return j;
  });
}

(async () => {
  const payload = { files: files.map(f => ({ path: f.rel, size: f.size })) };
  const res = slug
    ? await api('PUT', ROOT + '/api/v1/publish/' + slug, payload)
    : await api('POST', ROOT + '/api/v1/publish', payload);
  const info = res.publishStatus ? res : (res.result || res);
  const up = res.upload || info.upload;
  console.log((slug ? 'UPDATE' : 'CREATE') + ' OK slug=' + (res.slug || slug));
  for (const f of files) {
    const u = up.uploads.find(x => x.path === f.rel);
    if (!u) { console.error('NO UPLOAD TARGET for ' + f.rel); process.exit(1); }
    const put = await fetch(u.url, { method: u.method || 'PUT', headers: u.headers || {}, body: fs.readFileSync(f.abs) });
    if (!put.ok) { console.error('UPLOAD FAIL', f.rel, put.status, await put.text()); process.exit(1); }
    console.log('UPLOAD OK', f.rel, f.size + 'B');
  }
  const fin = await api('POST', up.finalizeUrl, { versionId: up.versionId });
  console.log('LIVE:', fin.siteUrl || fin.primaryUrl || ('https://' + (res.slug || slug) + '.here.now/'));
  console.log('version:', fin.currentVersionId || up.versionId);
})().catch(e => { console.error('ERR', e); process.exit(1); });
