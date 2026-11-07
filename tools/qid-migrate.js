/* qid 迁移考古 + 题干残留根治（学生记录零断链）
 * ============================================================
 * 背景：qid = djb2(m|qt|s)，题干参与计算。历史上多轮审读修正改过题干
 * （apply-v5fix 的 s 字段不留映射），加上本轮根治的题面残留题
 * （cleanStem 截断），都会让 qid 变化 → 学生 answers 里旧 qid 对不上新题。
 *
 * 本工具做三件事（可反复重跑，映射从 git 历史自动重建，自我维护）：
 *   1. git 考古：逐版本提取每版题库 qid 全集，相邻版本间把「消失的 qid」
 *      匹配到「新增的 qid」。四重门槛防误配（误配会把学生记录挂到别的题上，
 *      比 不映射 更危险）：签名(m|qt|a|o)一致 + 题干相似(前缀包含率或双字
 *      重合率) + 候选唯一 + 目标确实新鲜（前两版都没有）。
 *   2. 根治残留：当前库所有 cleanStem(s) !== s 的题干直接清洗落库，
 *      旧 qid → 新 qid 并入映射（渲染层剥离方案的根治版）。
 *   3. 写出：data.js 追加 window.XK_QID_MIGRATE；详情落
 *      evidence/qbank-audit/qid-migrate-map.json。
 *
 * 迁移语义（engine.js migrateProfileKeys）：档案 answers 旧 qid 键重命名到
 * 新 qid，冲突逐字段 max 合并（与云端「逐题取 max」同口径），幂等。
 *
 * 用法：node tools/qid-migrate.js               # 考古 + 清洗 + 写库
 *       node tools/qid-migrate.js --map-only    # 只重建映射不写题干（校验用）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const XK = require(path.join(__dirname, '..', 'src', 'engine.js'));

const ROOT = path.join(__dirname, '..');
const MAP_ONLY = process.argv.includes('--map-only');

function loadBankFromSource(src) {
  global.window = {};
  eval(src);
  return { BANK: global.window.BANK, META: global.window.BANK_META, EXISTING_MAP: global.window.XK_QID_MIGRATE || null };
}
function loadCurrent() {
  return loadBankFromSource(fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8'));
}
function loadCommitted() {
  const last = execSync('git log -1 --format=%H -- src/data.js', { cwd: ROOT }).toString().trim();
  return loadBankFromSource(execSync(`git show ${last}:src/data.js`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString());
}
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const qidOf = (q) => (q.m || 'M') + '-' + djb2((q.m || '') + '|' + (q.qt || '') + '|' + (q.s || ''));
const sigOf = (q) => (q.m || '') + '|' + (q.qt || '') + '|' + (q.a || '') + '|' + JSON.stringify(q.o || []);

/* 题干相似度：新题干的老双字（bigram）在旧题干中的占比（包含率），
 * 或双向 Dice——容住「截掉尾巴」「改错别字」两类改动 */
function stemSimilar(a, b) {
  const s = String(a).replace(/\s+/g, ''), t = String(b).replace(/\s+/g, '');
  if (!s || !t) return 0;
  const bigrams = (x) => { const m = new Map(); for (let i = 0; i < x.length - 1; i++) { const g = x.substr(i, 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const bs = bigrams(s), bt = bigrams(t);
  let inter = 0, totalT = 0;
  bt.forEach((n, g) => { totalT += n; if (bs.has(g)) inter += Math.min(n, bs.get(g)); });
  const totalS = [...bs.values()].reduce((x, y) => x + y, 0);
  const contain = totalT ? inter / totalT : 0;
  const dice = (totalS + totalT) ? (2 * inter) / (totalS + totalT) : 0;
  return Math.max(contain, dice);
}

/* ---------- 1. git 考古 ---------- */
function archaeology() {
  const revs = execSync('git log --reverse --format=%H -- src/data.js', { cwd: ROOT })
    .toString().trim().split('\n').filter(Boolean);
  console.log('git 版本数:', revs.length);
  const map = {};
  let renamed = 0, dropped = 0;
  let prev = null, prev2 = null;
  for (const rev of revs) {
    const src = execSync(`git show ${rev}:src/data.js`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();
    const { BANK } = loadBankFromSource(src);
    const byQid = new Map(), bySig = new Map();
    BANK.forEach((q) => {
      const id = qidOf(q);
      byQid.set(id, q);
      const s = sigOf(q);
      if (!bySig.has(s)) bySig.set(s, []);
      bySig.get(s).push(id);
    });
    if (prev) {
      const gone = [...prev.byQid.keys()].filter((id) => !byQid.has(id));
      for (const oldId of gone) {
        const oldQ = prev.byQid.get(oldId);
        const cands = (bySig.get(sigOf(oldQ)) || []).filter((id) => !byQidHas(id, prev) && !byQidHas(id, prev2));
        const good = cands.filter((id) => stemSimilar(oldQ.s, byQid.get(id).s) >= 0.55);
        if (good.length === 1) {
          const newId = good[0];
          for (const k of Object.keys(map)) if (map[k] === oldId) map[k] = newId; // 链式收敛
          map[oldId] = newId;
          renamed++;
        } else {
          dropped++;
          if (good.length > 1) console.log('  ? 多候选放弃:', oldId, '→', good.join(','));
        }
      }
    }
    prev2 = prev; prev = { byQid, bySig };
  }
  console.log('考古确认改名:', renamed, '| 放弃(证据不足):', dropped);
  return { map, renamed, dropped };
}
function byQidHas(id, v) { return !!(v && v.byQid && v.byQid.has(id)); }

/* ---------- 2. 当前库残留分诊 ----------
 *  a) 清洗后与库内任何题都不撞 → 直接清洗改名（旧 qid→新 qid 进映射）
 *  b) 清洗后与某题 (m|qt|s) 完全相同 → 同题双版本：残留版更优的 o/e 并入
 *     干净版、删除残留版；旧 qid→干净版 qid 进映射（学生记录跟着搬家） */
function triage(BANK) {
  const owners = new Map();
  BANK.forEach((q, i) => { const id = qidOf(q); if (!owners.has(id)) owners.set(id, []); owners.get(id).push(i); });
  const fixes = [], merges = [];
  BANK.forEach((q, i) => {
    const c = XK.cleanStem(q.s);
    if (c === q.s || !c || c.length < 6) return;
    const twin = (owners.get(qidOf({ m: q.m, qt: q.qt, s: c })) || []).filter((x) => x !== i)[0];
    if (twin !== undefined) merges.push({ residual: i, twin, oldQid: qidOf(q) });
    else fixes.push({ i, newS: c, oldQid: qidOf(q) });
  });
  return { fixes, merges };
}

/* ---------- 主流程 ---------- */
const { map: histMap, renamed, dropped } = archaeology();
const cur = loadCurrent();
const { BANK, META } = cur;
/* 接续既有映射：data.js 里已带 XK_QID_MIGRATE（本工具上一轮写入）且本轮无新残留时，
 * 以已入库映射为底，保证重跑不丢条目（考古链会再接续一遍）。 */
const committed = loadCommitted();
const existingMap = cur.EXISTING_MAP && Object.keys(cur.EXISTING_MAP).length ? cur.EXISTING_MAP : null;
let stemMap = {}, stemList = [], merges = [], fixes = [];
let bankDirty = false, metaDirty = false;
if (!MAP_ONLY) {
  const t = triage(BANK);
  fixes = t.fixes; merges = t.merges;
  console.log('残留分诊: 可直接清洗', fixes.length, '题 | 同题双版本并入', merges.length, '题');
  if (!fixes.length && !merges.length && existingMap) {
    /* 接续既有映射：先自检清洗（键不得在当前库、值必须在当前库），
     * 再把链解析到终值——失效/回摆条目直接丢弃，考古会重新推导有效项 */
    const curIdsPre = new Set(BANK.map(qidOf));
    const adopted = {};
    Object.keys(existingMap).forEach((k) => {
      if (curIdsPre.has(k) || !curIdsPre.has(existingMap[k])) return;
      adopted[k] = existingMap[k];
    });
    Object.keys(adopted).forEach((k) => {
      let v = adopted[k];
      while (adopted[v]) v = adopted[v];
      adopted[k] = v;
    });
    stemMap = adopted;
    console.log('沿用既有映射（自检后）:', Object.keys(stemMap).length, '/', Object.keys(existingMap).length, '条');
  } else {
    const taken = new Set(BANK.map(qidOf));
    // ① 直接清洗改名
    fixes.forEach((f) => taken.delete(f.oldQid));
    fixes.forEach((f) => {
      const q = BANK[f.i];
      const newQid = qidOf({ m: q.m, qt: q.qt, s: f.newS });
      if (taken.has(newQid)) throw new Error('新 qid 撞库: ' + newQid + ' @i=' + f.i);
      taken.add(newQid);
      stemMap[f.oldQid] = newQid;
      q.s = f.newS;
      stemList.push({ i: f.i, m: q.m, oldQid: f.oldQid, newQid, oldS: f.oldS, newS: f.newS });
    });
    // ② 同题双版本：并入干净版（选项取残留版——实测残留版选项更完整未被截断；
    //    解析取更长的一份），然后删除残留版
    merges.forEach((mg) => {
      const rq = BANK[mg.residual], tq = BANK[mg.twin];
      if (JSON.stringify(rq.o) !== JSON.stringify(tq.o)) tq.o = rq.o;
      if ((rq.e || '').length > (tq.e || '').length) tq.e = rq.e;
      const twinQid = qidOf(tq);
      stemMap[mg.oldQid] = twinQid;
      stemList.push({ i: mg.residual, m: rq.m, oldQid: mg.oldQid, newQid: twinQid, mergedIntoTwin: mg.twin, oldS: rq.s, newS: tq.s });
    });
    const delIdx = merges.map((mg) => mg.residual).sort((a, b) => b - a);
    delIdx.forEach((i) => BANK.splice(i, 1));
    bankDirty = true;
  }
  // 终检：残留 0、(m|qt|s) 全库唯一、四零
  const left = BANK.filter((q) => XK.cleanStem(q.s) !== q.s);
  if (left.length) throw new Error('清洗后仍残留 ' + left.length + ' 题');
  const stemOwners = new Set();
  BANK.forEach((q) => {
    const k = q.m + '|' + q.qt + '|' + q.s;
    if (stemOwners.has(k)) throw new Error('题面撞库: ' + k.slice(0, 40));
    stemOwners.add(k);
  });
  let bad = 0;
  BANK.forEach((q) => {
    const ansOk = q.qt === '多选' ? q.a.split('').every((ch) => q.o.some((o) => o[0] === ch)) : q.o.some((o) => o[0] === q.a);
    if (!ansOk || !q.e || !q.e.trim()) bad++;
  });
  if (bad) throw new Error('四零质检失败 ' + bad + ' 题');
  // META.n 与实际题数对齐（去重会改变各模块题数）
  const metaBefore = JSON.stringify(META);
  META.forEach((m) => { m.n = BANK.filter((q) => q.m === m.code).length; });
  metaDirty = JSON.stringify(META) !== metaBefore;
  if (bankDirty || metaDirty) {
    console.log('落库: 清洗 ' + fixes.length + ' + 并入删除 ' + merges.length + ' = ' + (fixes.length + merges.length) +
      ' 题根治；题库 ' + BANK.length + ' 题；复扫残留 0 / 撞库 0 / 四零全过；META.n ' + (metaDirty ? '已重算' : '一致'));
  } else {
    console.log('题库与 META 无需变更');
  }
} else if (existingMap) {
  // --map-only：沿用已入库映射，仅与考古链重新接续
  stemMap = existingMap;
  console.log('沿用 data.js 既有映射:', Object.keys(stemMap).length, '条');
}

/* 链式接续：考古终点若恰好是本轮改名/并入的旧 qid，续到本轮新终点 */
Object.keys(histMap).forEach((k) => { if (stemMap[histMap[k]]) histMap[k] = stemMap[histMap[k]]; });
const fullMap = Object.assign({}, histMap, stemMap);

/* 自检：键都不在当前库（已改名旧题）、值都在当前库。
 * 考古条目如有失败 → 丢弃并警告（宁缺勿错），但 stemMap 已覆盖的键除外
 * （本轮刚写入的正确终值优先）；残留清洗条目失败 → 致命。 */
const curIds = new Set(BANK.map(qidOf));
let droppedBad = 0;
Object.keys(histMap).forEach((k) => {
  if (stemMap[k]) return;
  if (curIds.has(k) || !curIds.has(fullMap[k])) { delete fullMap[k]; droppedBad++; }
});
if (droppedBad) console.log('考古条目自检淘汰:', droppedBad, '条（宁缺勿错）');
Object.keys(stemMap).forEach((k) => {
  if (curIds.has(k) || !curIds.has(stemMap[k])) throw new Error('残留映射自检失败: ' + k + '→' + stemMap[k]);
});

/* ---------- 3. 写出 ---------- */
const mapJson = JSON.stringify(fullMap);
/* 重跑（无新残留）时沿用上一次清单；清单丢失则从已提交版本重建（证据自愈） */
let stemListOut = stemList;
if (!stemListOut.length) {
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', 'qbank-audit', 'qid-migrate-map.json'), 'utf8'));
    if (Array.isArray(prev.stemList) && prev.stemList.length) stemListOut = prev.stemList;
  } catch (e) { /* 首跑无旧清单，忽略 */ }
}
if (!stemListOut.length && !MAP_ONLY) {
  /* 从已提交版本重建：committed 里的残留题逐题对账到当前库
   * （清洗→新 qid；同题双版本→干净版 qid），恢复根治清单证据 */
  const curByStem = new Map(BANK.map((q) => [q.m + '|' + q.qt + '|' + q.s, qidOf(q)]));
  const committedQids = new Set(committed.BANK.map(qidOf));
  committed.BANK.forEach((q, i) => {
    const c = XK.cleanStem(q.s);
    if (c === q.s || !c || c.length < 6) return;
    const oldQid = qidOf(q);
    const hit = curByStem.get(q.m + '|' + q.qt + '|' + c);
    if (!hit) throw new Error('重建清单失败：残留题无处安放 ' + oldQid);
    const wasTwin = committedQids.has(hit); // 干净版早已在库 = 同题双版本并入
    const curIdx = BANK.findIndex((q) => qidOf(q) === hit);
    stemListOut.push({ i, m: q.m, oldQid, newQid: hit, oldS: q.s, newS: c, mergedIntoTwin: wasTwin ? curIdx : undefined, rebuild: true });
  });
  console.log('清单从已提交版本重建:', stemListOut.length, '条');
}
const detail = {
  generated: new Date().toISOString(),
  archaeology: { renames: renamed, droppedForEvidence: dropped, kept: Object.keys(histMap).length - droppedBad },
  stemFixes: stemListOut.filter((e) => e.mergedIntoTwin === undefined).length,
  mergedDuplicates: stemListOut.filter((e) => e.mergedIntoTwin !== undefined).length,
  total: Object.keys(fullMap).length,
  stemList: stemListOut,
  map: fullMap,
};
fs.writeFileSync(path.join(ROOT, 'evidence', 'qbank-audit', 'qid-migrate-map.json'), JSON.stringify(detail, null, 1), 'utf8');
console.log('映射总条数:', detail.total, '(考古 ' + detail.archaeology.kept + ' + 本次残留 ' + detail.stemFixes + ')');

const mapDirty = !cur.EXISTING_MAP || Object.keys(cur.EXISTING_MAP).length !== Object.keys(fullMap).length || Object.keys(fullMap).some((k) => cur.EXISTING_MAP[k] !== fullMap[k]);
if (!MAP_ONLY && (bankDirty || metaDirty || mapDirty)) {
  const out = '// 学考冲刺通题库 ' + BANK.length + ' 题（题面残留根治：' + detail.stemFixes +
    ' 题题干清洗 + ' + detail.mergedDuplicates + ' 题同题去重；qid 迁移映射见 window.XK_QID_MIGRATE，工具 tools/qid-migrate.js 可重跑重建）\n'
    + 'window.BANK_VER=\'20261106\';\n'
    + 'window.BANK_META=' + JSON.stringify(META) + ';\n'
    + 'window.BANK=' + JSON.stringify(BANK) + ';\n'
    + 'window.XK_QID_MIGRATE=' + mapJson + ';\n';
  fs.writeFileSync(path.join(ROOT, 'src', 'data.js'), out, 'utf8');
  console.log('WROTE src/data.js（含 XK_QID_MIGRATE）');
}
