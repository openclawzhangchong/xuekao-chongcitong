'use strict';
/* 生成三档白名单 1000 / 2000 / 3000（干净池版：严格嵌套、可复现、确定性）
 * ---------------------------------------------------------------------
 * 候选池 = 三态判定为 KEEP 的题。
 *   DELETE（结构性损坏）排除；
 *   CLEAN（格式瑕疵：题干带【拔高】、选项可剥离模板前缀）也不进白名单——
 *         因为清洗会改题干/选项文本，进而改 qid=djb2(m|qt|s)，学生档案会断链。
 *         这些题仍留在全库（BANK_ALL）里，可在全库档查看、后续人工处置。
 * 模块配额 = 考纲分值比例（最大余数法）+ 干净题容量封顶 + 缺口按比例重分配。
 * 考点配额 = 能力层级加权 + 保底，受该考点干净题数封顶。
 * 嵌套：先选 3000，2000 从 3000 的考点列表取前缀，1000 从 2000 取前缀 → 天然严格嵌套。
 * 铁律：不删题、不改题干、只产出下标清单；qid 不变。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s, 'utf8');
const { classify, optKey } = require('./quality-rules');

global.window = {};
eval(read('src/engine.js'));
eval(read('src/data.js'));
const BANK = window.BANK, META = window.BANK_META, qidOf = window.XK.qidOf;
const cat = JSON.parse(read('docs/考点目录.json'));
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
const byHash = (a, b) => (djb2(a.qid) - djb2(b.qid)) || (a.index - b.index);

/* ---------- 1. 三态判定，只留 KEEP ---------- */
const qids = BANK.map(qidOf);
const byOpts = Object.create(null);
BANK.forEach(q => { const k = optKey(q); (byOpts[k] = byOpts[k] || []).push(qidOf(q)); });
const verdicts = BANK.map((q, i) => classify(q, { qid: qids[i], byOpts: byOpts }));
const stateCount = { DELETE: 0, CLEAN: 0, KEEP: 0 };
verdicts.forEach(v => { stateCount[v.state]++; });

const usable = [];
let noPoint = 0, mislabeled = 0;
const mislabeledList = [];
BANK.forEach((q, i) => {
  if (verdicts[i].state !== 'KEEP') return;
  const e = cat.kd_label_map[q.m + '|' + q.kd];
  // 86 道跨考点综合卷没有 point_id，不参与配平，只在全库档出现
  if (!e || !e.point_id) { noPoint++; return; }
  // 跨模块错挂（如 M7 的题被标成考点 5·人工智能 → M8-01）：分类本身是错的，
  // 进精选池会让学生按模块刷到时看到别模块内容、诊断也错位，因此排除并记录。
  if (e.point_id.split('-')[0] !== q.m) {
    mislabeled++; mislabeledList.push({ qid: qids[i], module: q.m, point_id: e.point_id, kd: q.kd });
    return;
  }
  usable.push({ index: i, qid: qids[i], point_id: e.point_id, module: q.m, kd: q.kd, qt: q.qt, stem: q.s.slice(0, 46) });
});

const buckets = Object.create(null);
usable.forEach(x => { (buckets[x.point_id] = buckets[x.point_id] || []).push(x); });
Object.keys(buckets).forEach(k => buckets[k].sort(byHash));

const modCap = Object.create(null);
MODULES.forEach(m => { modCap[m.code] = 0; });
usable.forEach(x => { modCap[x.module] = (modCap[x.module] || 0) + 1; });

/* ---------- 2. 模块配额：按分值比例，受干净题容量封顶 ---------- */
function pureQuota(target) {
  const raw = MODULES.map(m => ({ code: m.code, raw: target * m.score / 150 }));
  const q = {};
  raw.forEach(r => { q[r.code] = Math.floor(r.raw); });
  const rest = target - Object.values(q).reduce((a, b) => a + b, 0);
  raw.slice().sort((a, b) => (b.raw - Math.floor(b.raw)) - (a.raw - Math.floor(a.raw)))
    .slice(0, rest).forEach(r => { q[r.code]++; });
  return q;
}
function quotaCapped(target, cap) {
  const q = {};
  MODULES.forEach(m => { q[m.code] = 0; });
  let left = target, guard = 0;
  while (left > 0 && guard++ < 100000) {
    const act = MODULES.filter(m => q[m.code] < (cap[m.code] || 0));
    if (!act.length) break;
    const totalScore = act.reduce((s, m) => s + m.score, 0);
    const want = act.map(m => ({ code: m.code, v: left * m.score / totalScore }));
    let added = 0;
    want.forEach(w => {
      const give = Math.min(Math.floor(w.v), (cap[w.code] || 0) - q[w.code], left);
      if (give > 0) { q[w.code] += give; left -= give; added += give; }
    });
    if (added === 0) {
      const best = want.slice()
        .sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)))
        .find(w => q[w.code] < (cap[w.code] || 0));
      if (!best) break;
      q[best.code]++; left--;
    }
  }
  return { q: q, shortage: left };
}

/* ---------- 3. 考点配额：保底 + 能力层级加权，受可选题数封顶 ---------- */
function pointQuota(mod, Q, capOf) {
  const base = Math.floor(Q / mod.points.length * 0.5);
  const items = mod.points.map(p => ({
    id: p.id, cap: capOf(p.id), w: wOf(p.level), a: Math.min(base, capOf(p.id))
  }));
  let R = Q - items.reduce((s, x) => s + x.a, 0);
  while (R > 0) {
    let best = null;
    items.forEach(x => { if (x.a < x.cap && (!best || x.a / x.w < best.a / best.w)) best = x; });
    if (!best) break;
    best.a++; R--;
  }
  return Object.fromEntries(items.map(x => [x.id, x.a]));
}

/* ---------- 4. 先选 3000，再向下取子集 ---------- */
const cap3000 = quotaCapped(3000, modCap);
if (cap3000.shortage > 0) {
  throw new Error('KEEP 干净池不足 3000 题，缺 ' + cap3000.shortage + ' 道：' + JSON.stringify(modCap));
}
const Q3000 = cap3000.q;
const pure3000 = pureQuota(3000);
const sel3000 = Object.create(null);
const tier3000 = [];
MODULES.forEach(mod => {
  const pq = pointQuota(mod, Q3000[mod.code], id => (buckets[id] || []).length);
  mod.points.forEach(p => {
    const list = (buckets[p.id] || []).slice(0, pq[p.id] || 0);
    sel3000[p.id] = list;
    tier3000.push.apply(tier3000, list);
  });
});
if (tier3000.length !== 3000) {
  throw new Error('3000 档只选出 ' + tier3000.length + ' 题（考点池不足）');
}

function derive(parentSel, target) {
  const Q = pureQuota(target);
  const sel = Object.create(null);
  const tier = [];
  MODULES.forEach(mod => {
    const pq = pointQuota(mod, Q[mod.code], id => (parentSel[id] || []).length);
    mod.points.forEach(p => {
      const list = (parentSel[p.id] || []).slice(0, pq[p.id] || 0);
      sel[p.id] = list;
      tier.push.apply(tier, list);
    });
  });
  return { Q: Q, sel: sel, tier: tier };
}
const d2000 = derive(sel3000, 2000);
const d1000 = derive(d2000.sel, 1000);

/* ---------- 5. 校验 ---------- */
function validate(tier, target, Q, label) {
  if (tier.length !== target) throw new Error(label + ' 题数 ' + tier.length + ' != ' + target);
  const idx = tier.map(x => x.index), qs = tier.map(x => x.qid);
  if (new Set(idx).size !== target) throw new Error(label + ' 下标重复');
  if (new Set(qs).size !== target) throw new Error(label + ' qid 重复');
  tier.forEach(x => {
    if (!BANK[x.index] || qidOf(BANK[x.index]) !== x.qid) throw new Error(label + ' 下标/qid 对不上: ' + x.index);
    if (verdicts[x.index].state !== 'KEEP') throw new Error(label + ' 混入了非 KEEP 题: ' + x.qid);
  });
  const byMod = {};
  tier.forEach(x => { byMod[x.module] = (byMod[x.module] || 0) + 1; });
  MODULES.forEach(m => { if ((byMod[m.code] || 0) !== Q[m.code]) throw new Error(label + ' 模块 ' + m.code + ' 配额不符'); });
  const paper = window.XK.buildSimPaper(tier.map(x => BANK[x.index]), META);
  if (paper.length !== 150) throw new Error(label + ' 模拟考只能组 ' + paper.length + ' 题');
  return byMod;
}
const m1000 = validate(d1000.tier, 1000, d1000.Q, '1000 档');
const m2000 = validate(d2000.tier, 2000, d2000.Q, '2000 档');
const m3000 = validate(tier3000, 3000, Q3000, '3000 档');

const set1000 = new Set(d1000.tier.map(x => x.index));
const set2000 = new Set(d2000.tier.map(x => x.index));
const set3000 = new Set(tier3000.map(x => x.index));
d1000.tier.forEach(x => { if (!set2000.has(x.index)) throw new Error('1000 档不是 2000 档子集'); });
d2000.tier.forEach(x => { if (!set3000.has(x.index)) throw new Error('2000 档不是 3000 档子集'); });

// 与纯分值配额的偏差（只可能出现在 3000 档受容量约束时）
const adjusted = MODULES.filter(m => Q3000[m.code] !== pure3000[m.code])
  .map(m => ({ module: m.code, score: m.score, quota: Q3000[m.code], pure: pure3000[m.code], diff: Q3000[m.code] - pure3000[m.code] }));

/* ---------- 6. 落地 ---------- */
function dump(tier, target, Q, byMod, label) {
  const byPoint = {};
  tier.forEach(x => { byPoint[x.point_id] = (byPoint[x.point_id] || 0) + 1; });
  const sorted = tier.slice().sort((a, b) => a.index - b.index);
  const doc = {
    schema_version: '2.0',
    title: '学考冲刺通 · ' + label + '白名单（' + target + ' 题，干净池）',
    generated_by: 'tools/build-whitelist.js',
    source_bank: 'src/data.js（' + BANK.length + ' 题，未删改）',
    pool: {
      rule: 'R1~R8 三态判定，仅 KEEP 入池（规则单一真源 tools/quality-rules.js）',
      total_bank: BANK.length, KEEP: stateCount.KEEP, CLEAN: stateCount.CLEAN, DELETE: stateCount.DELETE,
      usable_with_point: usable.length, excluded_composite: noPoint,
      excluded_mislabeled: mislabeled, mislabeled_sample: mislabeledList.slice(0, 20)
    },
    tier: String(target), count: sorted.length,
    nested: '1000 ⊂ 2000 ⊂ 3000',
    module_quota_adjusted: target === 3000 ? adjusted : [],
    by_module: byMod, by_point: byPoint,
    validation: {
      unique_index: true, unique_qid: true, module_quota_match: true,
      sim_paper_150: true, no_delete_question: true, nested: true
    },
    items: sorted
  };
  write('docs/白名单-' + target + '题.json', JSON.stringify(doc, null, 2));
  const quotaDoc = {
    target: target,
    method: '模块按考纲分值比例（最大余数法），受干净题容量封顶；考点按能力层级加权+保底，不超过该考点干净题数',
    modules: MODULES.map(m => ({ code: m.code, score: m.score, quota: Q[m.code], actual: byMod[m.code] || 0 })),
    points: Object.keys(byPoint).sort().map(id => ({ id: id, quota: byPoint[id] }))
  };
  write('docs/题库精简配额-' + target + '题.json', JSON.stringify(quotaDoc, null, 2));
  return sorted.map(x => x.index);
}
const idx1000 = dump(d1000.tier, 1000, d1000.Q, m1000, '基础档');
const idx2000 = dump(d2000.tier, 2000, d2000.Q, m2000, '高级档');
const idx3000 = dump(tier3000, 3000, Q3000, m3000, '终极档');

write('src/whitelist-data.js',
  '/* 构建期生成，勿手改；由 tools/build-whitelist.js 重建。每行独立，服务端按行解析 */\n' +
  'window.XK_BANK_INDEX=' + JSON.stringify(idx2000) + ';\n' +
  'window.XK_TIER_INDEX=' + JSON.stringify({ '1000': idx1000, '2000': idx2000, '3000': idx3000 }) + ';\n' +
  "window.XK_DEFAULT_TIER='1000';\n");

console.log('TIERS OK → docs/白名单-{1000,2000,3000}题.json + src/whitelist-data.js');
console.log('全库', BANK.length, '｜KEEP', stateCount.KEEP, '｜CLEAN', stateCount.CLEAN, '｜DELETE', stateCount.DELETE,
  '｜可用且有考点', usable.length, '｜综合卷排除', noPoint, '｜跨模块错挂排除', mislabeled);
console.log('1000:', idx1000.length, '2000:', idx2000.length, '3000:', idx3000.length);
console.log('modules 1000', JSON.stringify(m1000));
console.log('modules 2000', JSON.stringify(m2000));
console.log('modules 3000', JSON.stringify(m3000));
if (adjusted.length) console.log('3000 档受干净池容量约束的模块', JSON.stringify(adjusted));
console.log('nested 1000⊂2000⊂3000 ✓ | 无 DELETE 题 ✓ | sim paper 150 ✓ | qid 未变 ✓');
