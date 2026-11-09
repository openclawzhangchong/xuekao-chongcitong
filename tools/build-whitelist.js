'use strict';
/* 生成 2000 题白名单（可复现、确定性）
 * 输入：src/data.js（3982 题真源，只读）、docs/考点目录.json（kd → point_id 归并）、
 *       docs/题库精简配额-2000题.json（58 个考点的配额）
 * 输出：docs/白名单-2000题.json（人读/审计）、src/whitelist-data.js（构建内嵌的下标数组）
 * 铁律：不删题、不改题干、只产出下标清单；qid 由 djb2(m|qt|s) 计算，保持不变。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

global.window = {};
eval(read('src/engine.js'));
eval(read('src/data.js'));
const BANK = window.BANK;
const qidOf = window.XK.qidOf;
const cat = JSON.parse(read('docs/考点目录.json'));
const quota = JSON.parse(read('docs/题库精简配额-2000题.json'));

function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// 按考点分桶：kd_label_map 里 point_id 为 null 的（86 道跨考点综合卷）不参与配额
const buckets = Object.create(null);
let skipped = 0;
BANK.forEach((q, i) => {
  const e = cat.kd_label_map[q.m + '|' + q.kd];
  if (!e || !e.point_id) { skipped++; return; }
  const qid = qidOf(q);
  (buckets[e.point_id] = buckets[e.point_id] || []).push({ index: i, q: q, qid: qid });
});

// 固定顺序：按 qid 的 djb2 哈希排序，保证每次生成结果完全一致且分散在各来源
Object.keys(buckets).forEach(k => {
  buckets[k].sort((a, b) => (djb2(a.qid) - djb2(b.qid)) || (a.index - b.index));
});

const picked = [];
const detail = [];
quota.points.forEach(p => {
  const arr = buckets[p.id] || [];
  if (arr.length < p.a) throw new Error('考点 ' + p.id + ' 现有 ' + arr.length + ' 题，不足配额 ' + p.a);
  for (let j = 0; j < p.a; j++) {
    const x = arr[j];
    picked.push({ index: x.index, qid: x.qid, point_id: p.id, module: x.q.m,
      kd: x.q.kd, qt: x.q.qt, stem: x.q.s.slice(0, 46) });
  }
  detail.push({ point_id: p.id, quota: p.a, available: arr.length, picked: p.a });
});

// 四零质检：总数 / 下标唯一 / qid 唯一 / 下标有效
if (quota.target !== 2000) throw new Error('配额目标不是 2000');
if (picked.length !== 2000) throw new Error('白名单题数 ' + picked.length + ' != 2000');
if (new Set(picked.map(x => x.index)).size !== 2000) throw new Error('下标重复');
if (new Set(picked.map(x => x.qid)).size !== 2000) throw new Error('qid 重复');
picked.forEach(x => { if (!BANK[x.index] || qidOf(BANK[x.index]) !== x.qid) throw new Error('下标/qid 对不上: ' + x.index); });

picked.sort((a, b) => a.index - b.index);
const byModule = {};
picked.forEach(x => { byModule[x.module] = (byModule[x.module] || 0) + 1; });
Object.keys(byModule).forEach(m => {
  const want = quota.modules.filter(x => x.code === m)[0].quota;
  if (byModule[m] !== want) throw new Error('模块 ' + m + ' 题数 ' + byModule[m] + ' != 配额 ' + want);
});

const out = {
  schema_version: '1.0',
  title: '学考冲刺通 · 默认题量白名单（2000 题）',
  generated_by: 'tools/build-whitelist.js',
  source_bank: 'src/data.js（3982 题，未删改）',
  quota_source: 'docs/题库精简配额-2000题.json',
  catalog_source: 'docs/考点目录.json',
  method: '按 58 个考点配额，从每个考点的题目中按 qid 哈希确定性取样；86 道跨考点综合卷不参与，另作模拟卷题源',
  total_bank: BANK.length,
  excluded_composite: skipped,
  count: picked.length,
  by_module: byModule,
  validation: { unique_index: true, unique_qid: true, module_quota_match: true, point_quota_match: true },
  items: picked
};
fs.writeFileSync(path.join(ROOT, 'docs', '白名单-2000题.json'), JSON.stringify(out, null, 2), 'utf8');
fs.writeFileSync(path.join(ROOT, 'src', 'whitelist-data.js'),
  '/* 构建期生成，勿手改；由 tools/build-whitelist.js 重建 */\n' +
  'window.XK_BANK_INDEX=' + JSON.stringify(picked.map(x => x.index)) + ';\n', 'utf8');
console.log('WHITELIST OK → docs/白名单-2000题.json + src/whitelist-data.js');
console.log('count', picked.length, '| excluded composite', skipped, '| by module', JSON.stringify(byModule));
console.log('point quota checked', detail.length, 'points');
