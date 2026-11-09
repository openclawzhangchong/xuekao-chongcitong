'use strict';
/* 生成三档白名单 1000 / 2000 / 3000（严格嵌套子集、可复现、确定性）
 * ---------------------------------------------------------------------
 * 输入：src/data.js（3982 题真源，只读）、docs/考点目录.json（kd → point_id 归并）、
 *       docs/白名单-2000题.json（已上线的 2000 档基座，保持不变）
 * 输出：docs/白名单-1000题.json / -3000题.json、docs/题库精简配额-1000题.json / -3000题.json、
 *       src/whitelist-data.js（XK_BANK_INDEX 兼容 + XK_TIER_INDEX 三档下标 + 默认档）
 * 设计：1000 ⊂ 2000 ⊂ 3000。升档时学生做过的题不会跑出题池，档案覆盖度连续。
 *       模块题量按考纲分值比例（最大余数法精确到目标数），考点内按 qid 哈希确定性取样。
 * 铁律：不删题、不改题干、只产出下标清单；qid=djb2(m|qt|s) 保持不变。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s, 'utf8');

global.window = {};
eval(read('src/engine.js'));
eval(read('src/data.js'));
const BANK = window.BANK;
const META = window.BANK_META;
const qidOf = window.XK.qidOf;
const cat = JSON.parse(read('docs/考点目录.json'));
const WL2000 = JSON.parse(read('docs/白名单-2000题.json'));
const MODULES = cat.modules;
const W = { '了解': 0.8, '熟悉': 1.0, '理解': 1.2, '掌握': 1.4 };

function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}
function wOf(level) {
  const p = String(level).split('/').map(x => W[x.trim()] || 1);
  return p.reduce((a, b) => a + b, 0) / p.length;
}
const hashOf = x => djb2(x.qid);
const byHash = (a, b) => (hashOf(a) - hashOf(b)) || (a.index - b.index);

// 模块配额：按考纲分值比例 + 最大余数法，合计精确等于 target
function moduleQuota(target) {
  const raw = MODULES.map(m => ({ code: m.code, raw: target * m.score / 150 }));
  const q = {};
  raw.forEach(r => { q[r.code] = Math.floor(r.raw); });
  let rest = target - Object.values(q).reduce((a, b) => a + b, 0);
  raw.slice().sort((a, b) => (b.raw - Math.floor(b.raw)) - (a.raw - Math.floor(a.raw)))
    .slice(0, rest).forEach(r => { q[r.code]++; });
  return q;
}
// 逐题加权公平分配：每次给 a/w 最小且未达 cap 的桶 +1，自动处理 cap 回流
function distribute(n, weights, caps) {
  const a = weights.map(() => 0);
  const w = weights.map(x => Math.max(0.0001, x));
  for (let k = 0; k < n; k++) {
    let best = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] >= caps[i]) continue;
      if (best < 0 || a[i] / w[i] < a[best] / w[best]) best = i;
    }
    if (best < 0) throw new Error('名额无法分配：该模块剩余题不足');
    a[best]++;
  }
  return a;
}
// 理想考点配额（与 2000 档同一套加权算法）：保底 + 能力层级权重
function idealPointQuota(mod, Q, capOf) {
  const base = Math.floor(Q / mod.points.length * 0.5);
  const items = mod.points.map(p => ({ id: p.id, cap: capOf(p.id), w: wOf(p.level), a: Math.min(base, capOf(p.id)) }));
  let R = Q - items.reduce((s, x) => s + x.a, 0);
  while (R > 0) {
    let best = null;
    items.forEach(x => { if (x.a < x.cap && (!best || x.a / x.w < best.a / best.w)) best = x; });
    if (!best) break;
    best.a++; R--;
  }
  return Object.fromEntries(items.map(x => [x.id, x.a]));
}

// 全库按考点分桶（86 道跨考点综合卷不参与配平，只在全库档出现）
const buckets = Object.create(null);
let skipped = 0;
BANK.forEach((q, i) => {
  const e = cat.kd_label_map[q.m + '|' + q.kd];
  if (!e || !e.point_id) { skipped++; return; }
  (buckets[e.point_id] = buckets[e.point_id] || []).push({
    index: i, qid: qidOf(q), point_id: e.point_id, module: q.m, kd: q.kd, qt: q.qt,
    stem: q.s.slice(0, 46)
  });
});
Object.keys(buckets).forEach(k => buckets[k].sort(byHash));

// ---- 2000 档：以已上线白名单为基座，逐项校验后原样保留 ----
if (WL2000.count !== 2000 || WL2000.items.length !== 2000) throw new Error('2000 档基座异常');
const set2000 = new Set(WL2000.items.map(x => x.index));
WL2000.items.forEach(x => {
  if (!BANK[x.index] || qidOf(BANK[x.index]) !== x.qid) throw new Error('2000 档 qid 对不上: ' + x.index);
});
const c2ByPoint = Object.create(null);
WL2000.items.forEach(x => { c2ByPoint[x.point_id] = (c2ByPoint[x.point_id] || 0) + 1; });
const c2ByModule = Object.create(null);
WL2000.items.forEach(x => { c2ByModule[x.module] = (c2ByModule[x.module] || 0) + 1; });

function itemsOfPoint(list, id) {
  return list.filter(x => x.point_id === id).slice().sort(byHash);
}

// ---- 1000 档：2000 档每模块内部按考点比例取子集 ----
const Q1000 = moduleQuota(1000);
const tier1000 = [];
MODULES.forEach(mod => {
  const ids = mod.points.map(p => p.id);
  const caps = ids.map(id => c2ByPoint[id] || 0);
  const alloc = distribute(Q1000[mod.code], caps, caps);
  ids.forEach((id, i) => {
    const pool = itemsOfPoint(WL2000.items, id);
    for (let j = 0; j < alloc[i]; j++) tier1000.push(pool[j]);
  });
});

// ---- 3000 档：以 2000 为基座，按 3000 档理想配额的缺口从剩余题补 1000 道 ----
const Q3000 = moduleQuota(3000);
const tier3000 = WL2000.items.slice();
MODULES.forEach(mod => {
  const ids = mod.points.map(p => p.id);
  const need = Q3000[mod.code] - (c2ByModule[mod.code] || 0);
  const ideal = idealPointQuota(mod, Q3000[mod.code], id => (buckets[id] || []).length);
  const gaps = ids.map(id => Math.max(0, (ideal[id] || 0) - (c2ByPoint[id] || 0)));
  const caps = ids.map(id => (buckets[id] || []).length - (c2ByPoint[id] || 0));
  const weights = gaps.map((g, i) => g > 0 ? g : (caps[i] > 0 ? 0.001 : 0));
  const add = distribute(need, weights, caps);
  ids.forEach((id, i) => {
    const pool = (buckets[id] || []).filter(x => !set2000.has(x.index));
    for (let j = 0; j < add[i]; j++) tier3000.push(pool[j]);
  });
});

// ---- 四零质检 + 嵌套校验 + 业务兼容 ----
function validate(tier, target, Q, label) {
  if (tier.length !== target) throw new Error(label + ' 题数 ' + tier.length + ' != ' + target);
  const idx = tier.map(x => x.index), qids = tier.map(x => x.qid);
  if (new Set(idx).size !== target) throw new Error(label + ' 下标重复');
  if (new Set(qids).size !== target) throw new Error(label + ' qid 重复');
  tier.forEach(x => { if (!BANK[x.index] || qidOf(BANK[x.index]) !== x.qid) throw new Error(label + ' 下标/qid 对不上: ' + x.index); });
  const byMod = {};
  tier.forEach(x => { byMod[x.module] = (byMod[x.module] || 0) + 1; });
  MODULES.forEach(m => { if ((byMod[m.code] || 0) !== Q[m.code]) throw new Error(label + ' 模块 ' + m.code + ' 配额不符'); });
  const paper = window.XK.buildSimPaper(tier.map(x => BANK[x.index]), META);
  if (paper.length !== 150) throw new Error(label + ' 模拟考只能组 ' + paper.length + ' 题');
  return byMod;
}
const m1000 = validate(tier1000, 1000, Q1000, '1000 档');
const m3000 = validate(tier3000, 3000, Q3000, '3000 档');
const set1000 = new Set(tier1000.map(x => x.index));
const set3000 = new Set(tier3000.map(x => x.index));
tier1000.forEach(x => { if (!set2000.has(x.index)) throw new Error('1000 档不是 2000 档子集'); });
WL2000.items.forEach(x => { if (!set3000.has(x.index)) throw new Error('2000 档不是 3000 档子集'); });

// ---- 落地 ----
function dump(tier, target, Q, byMod, label) {
  const byPoint = {};
  tier.forEach(x => { byPoint[x.point_id] = (byPoint[x.point_id] || 0) + 1; });
  tier.sort((a, b) => a.index - b.index);
  const doc = {
    schema_version: '1.0', title: '学考冲刺通 · ' + label + '白名单（' + target + ' 题）',
    generated_by: 'tools/build-whitelist.js', source_bank: 'src/data.js（3982 题，未删改）',
    tier: String(target), total_bank: BANK.length, count: tier.length,
    excluded_composite: skipped, nested: '1000 ⊂ 2000 ⊂ 3000', by_module: byMod, by_point: byPoint,
    validation: { unique_index: true, unique_qid: true, module_quota_match: true, sim_paper_150: true },
    items: tier
  };
  write('docs/白名单-' + target + '题.json', JSON.stringify(doc, null, 2));
  const quotaDoc = {
    target: target, method: '模块按考纲分值比例（最大余数法）；考点按 2000 档比例/3000 档理想缺口加权分配，且不超过该考点现有题数',
    modules: MODULES.map(m => ({ code: m.code, score: m.score, quota: Q[m.code], actual: byMod[m.code] || 0 })),
    points: Object.keys(byPoint).sort().map(id => ({ id: id, quota: byPoint[id], base2000: c2ByPoint[id] || 0 }))
  };
  write('docs/题库精简配额-' + target + '题.json', JSON.stringify(quotaDoc, null, 2));
  return tier.map(x => x.index);
}
const idx1000 = dump(tier1000, 1000, Q1000, m1000, '基础档');
const idx2000 = WL2000.items.map(x => x.index);
const idx3000 = dump(tier3000, 3000, Q3000, m3000, '终极档');

write('src/whitelist-data.js',
  '/* 构建期生成，勿手改；由 tools/build-whitelist.js 重建。每行独立，服务端按行解析 */\n' +
  'window.XK_BANK_INDEX=' + JSON.stringify(idx2000) + ';\n' +
  'window.XK_TIER_INDEX=' + JSON.stringify({ '1000': idx1000, '2000': idx2000, '3000': idx3000 }) + ';\n' +
  "window.XK_DEFAULT_TIER='1000';\n");

console.log('TIERS OK → docs/白名单-{1000,3000}题.json + src/whitelist-data.js');
console.log('excluded composite', skipped, '| 1000:', idx1000.length, '2000:', idx2000.length, '3000:', idx3000.length);
console.log('modules', JSON.stringify({ 1000: m1000, 2000: c2ByModule, 3000: m3000 }));
console.log('nested 1000⊂2000⊂3000 ✓ | sim paper 150 ✓ | 2000 基座未改动 ✓');
