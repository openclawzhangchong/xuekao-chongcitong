/* =====================================================================
 * 题库扩容 v4：3714 → 3999（+285 道选择题）
 * 策略：按 9 模块考纲分值配额，从「说法陈述池」出难度分级的说法单选
 * 每道新题：{m,kd,qt:'单选',s,o,a,e,an,t,src,difficulty:'基础|进阶|拔高'}
 * 质检：qid/题面唯一、答案存在、解析非空、难度合法、模块配额、目标总数
 * 用法：node tools/gen-more.js（输入必须是 3714 题库）
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = window.BANK;
const META = window.BANK_META;
if (BANK.length !== 3714) throw new Error('输入必须是 3714 题库（当前 ' + BANK.length + '）');

const TARGET = 3999, NEED = TARGET - BANK.length;
const BLANK_RE = /（ ?）|\(\s*\)|（）/;
const REV_RE = /错误的是|不正确|不属于|不是|错误的一项|错误的说法|有误/;
const BAD_FILL = /以上|上述|都不|都对|全部|均/;

function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function ensurePeriod(s) { return /[。.？?！！]$/.test(s.trim()) ? s.trim() : s.trim() + '。'; }
function kdShort(kd) { const m = /·\s*(.+)$/.exec(kd || ''); return (m ? m[1] : (kd || '')).trim(); }
function cleanE(e) {
  if (!e) return e;
  const parts = e.split(/(?<=[。！？])/).filter(s => !/选\s*[√×]|故选\s*[ABCD]|答案为\s*[√×ABCD]{1,4}\s*[。.]?$|本题选|应选\s*[ABCD√×]/.test(s) || s.length > 25);
  return parts.join('');
}

/* ---------- 陈述池（带难度与来源） ---------- */
// 难度口径：判断题陈述→基础；单选拼接陈述→进阶；多选选项陈述→拔高
const pool = { correct: {}, wrong: {} }; // key = m → [{t:陈述, diff, srcIdx}]
function push(map, m, item) {
  const t = item.t;
  if (!t || t.length < 6 || t.length > 60) return;
  if (/[?？]/.test(t) || BLANK_RE.test(t) || /[ABCD][.、．]/.test(t)) return;
  if (BAD_FILL.test(t)) return;
  (map[m] = map[m] || []).push(item);
}
BANK.forEach((q, idx) => {
  if (q.qt === '判断') {
    const diff = '基础';
    push(q.a === '√' ? pool.correct : pool.wrong, q.m, { t: ensurePeriod0(q.s), diff, srcIdx: idx });
  } else if (q.qt === '单选' && BLANK_RE.test(q.s) && !REV_RE.test(q.s) && !BAD_FILL.test(q.s)) {
    const a = q.o.find(o => o[0] === q.a);
    if (a && optT(a).length <= 34) {
      const c = ensurePeriod0(fillB(q.s, optT(a)));
      push(pool.correct, q.m, { t: c, diff: '进阶', srcIdx: idx });
    }
    q.o.filter(o => o[0] !== q.a && !BAD_FILL.test(optT(o)) && optT(o).length <= 34).forEach(w => {
      push(pool.wrong, q.m, { t: ensurePeriod0(fillB(q.s, optT(w))), diff: '进阶', srcIdx: idx });
    });
  } else if (q.qt === '多选') {
    q.o.forEach(o => {
      const isAns = q.a.includes(o[0]);
      push(isAns ? pool.correct : pool.wrong, q.m, { t: ensurePeriod0(optT(o)), diff: '拔高', srcIdx: idx });
    });
  }
});
function ensurePeriod0(s) { return /[。.？?！！]$/.test(s.trim()) ? s.trim() : s.trim() + '。'; }
function optT(o) { return o[1] == null ? o[0] : (o[1] === o[0] ? o[0] : o[1]); }
function fillB(s, t) {
  const tt = /^[\x00-\xff]/.test(t) && !/[\u4e00-\u9fa5）)]\s*$/.test(s.split(BLANK_RE)[0]) ? ' ' + t : t;
  return s.replace(BLANK_RE, tt);
}

// 模块池就绪统计
const ready = {};
META.forEach(m => { ready[m.code] = { c: (pool.correct[m.code] || []).length, w: (pool.wrong[m.code] || []).length }; });
console.log('模块陈述池:', JSON.stringify(ready));

/* ---------- 模块配额（按考纲分值） ---------- */
const total150 = META.reduce((x, m) => x + m.score, 0);
const quota = {};
let assigned = 0;
META.forEach(m => { quota[m.code] = Math.floor(NEED * m.score / total150); assigned += quota[m.code]; });
// 余数按分值大到小补
let rem = NEED - assigned;
const byScore = META.slice().sort((a, b) => b.score - a.score);
for (let i = 0; rem > 0; i++, rem--) quota[byScore[i % byScore.length].code]++;

/* ---------- 生成 ---------- */
const usedStems = new Set(BANK.map(q => q.m + '|' + q.qt + '|' + q.s));
const headSeq = {};
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const out = [];
const usedSrcCount = {}; // 池条目消耗控制：同 srcIdx 的陈述最多用 1 次（保多样性）

function take(m, kind, excludeT) {
  const arr = shuffle((pool[kind][m] || []).filter(x => !excludeT.includes(x.t) && !usedSrcCount[x.t]));
  return arr[0] || null;
}
function makeSingle(m, kd, correct, wrongs, diff, e, tag) {
  const ws = [];
  for (const w of shuffle(wrongs)) {
    if (w !== correct && !ws.includes(w) && !ws.some(x => x.slice(0, 8) === w.slice(0, 8))) ws.push(w);
    if (ws.length >= 3) break;
  }
  if (ws.length < 3) return null;
  const opts = shuffle([correct].concat(ws));
  const ansIdx = opts.indexOf(correct);
  const ks = kdShort(kd);
  const hk = m + '|' + ks + '|' + diff;
  headSeq[hk] = (headSeq[hk] || 0) + 1;
  const seq = headSeq[hk] > 1 ? '（' + (CN[headSeq[hk] - 2] || headSeq[hk] - 1) + '）' : '';
  return {
    m, kd, qt: '单选',
    s: '【' + ks + ' · ' + diff + '】' + seq + '下列说法' + (tag === 'wrong' ? '错误' : '正确') + '的是（ ）。',
    o: opts.map((t, i) => ['ABCD'[i], t]), a: 'ABCD'[ansIdx], e: e,
    difficulty: diff, tag
  };
}

let dbg=0;
// 原库遗留修复：i=630 单选补全为标准 4 选项（借同库 COUNTIF 口径）
  BANK[630] = Object.assign(BANK[630], {
    s: '在 WPS 表格中，若要统计“A1”到“A10”范围内大于 50 的单元格数量，应使用的函数是（ ）。',
    o: [['A', '=COUNTIF(A1:A10," >50")'], ['B', '=SUM(A1:A10)'], ['C', '=AVERAGE(A1:A10)'], ['D', '=MAX(A1:A10)']],
    a: 'A',
    e: 'COUNTIF（条件计数函数）用于统计满足给定条件的单元格个数；=COUNTIF(A1:A10," >50") 即统计 A1:A10 中大于 50 的单元格数量。SUM 求和、AVERAGE 求平均值、MAX 求最大值，均不符合题意。'
  });

  META.forEach(m => {
  const want = quota[m.code];
  if (dbg<1) console.log("DEBUG enter loop: want="+want+" kdList="+"?");
  let made = 0, guard = 0;
  const kdList = [];
  BANK.forEach(q => { if (q.m === m.code && !kdList.includes(q.kd)) kdList.push(q.kd); });
  while (made < want && guard < want * 12 + 20) {
    guard++;
    if (dbg<1) console.log('DEBUG kdList.len='+kdList.length+' poolC='+(pool.correct[m.code]||[]).length+' poolW='+(pool.wrong[m.code]||[]).length); dbg=1;
    const kd = kdList[guard % kdList.length];
    const alt = guard % 2 === 1; // 正确/错误交替
    const kind = alt ? 'correct' : 'wrong';
    const item = take(m.code, kind, []);
    if (!item) continue;
    usedSrcCount[item.t] = 1;
    const e = (() => {
      const srcQ = BANK[item.srcIdx];
      const base = cleanE0(srcQ.e || '');
      const extra = base && base.trim() ? base : '本题考查“' + kdShort(kd) + '”相关知识点。';
      return extra + '（' + item.diff + '题）';
    })();
    let v;
    if (alt) {
      const ws = take(m.code, 'wrong', [item.t]);
      const more = [];
      let g2 = 0;
      while (more.length < 2 && g2 < 8) { const x = take(m.code, 'wrong', [item.t].concat(more)); if (x) more.push(x.t); g2++; }
      v = makeSingle(m.code, kd, item.t, [ws.t].concat(more.map(x => x)), item.diff, e, 'correct');
    } else {
      const cs = take(m.code, 'correct', [item.t]);
      const more = [];
      let g2 = 0;
      while (more.length < 2 && g2 < 8) { const x = take(m.code, 'correct', [item.t].concat(more)); if (x) more.push(x.t); g2++; }
      v = makeSingle(m.code, kd, item.t, [cs.t].concat(more.map(x => x)), item.diff, e, 'wrong');
    }
    if (!v) { if (dbg < 5) { console.log("DEBUG null v: guard="+guard+" alt="+alt+" kd="+kd+" made="+made+"/"+want); dbg++; } continue; }
    const key = m.code + '|' + v.qt + '|' + v.s;
    if (usedStems.has(key)) continue;
    usedStems.add(key);
    v.src = 'gen4:' + tag4(v.tag) + ':' + item.srcIdx;
    v.an = (BANK[item.srcIdx].an || '');
    v.t = (BANK[item.srcIdx].t || '');
    out.push(v);
    made++;
  }
});
function tag4(t) { return t === 'correct' ? 'posSingle' : 'negSingle'; }
function cleanE0(e) {
  if (!e) return '';
  return e.split(/(?<=[。！？])/).filter(x => !/选\s*[√×]|故选\s*[ABCD]|答案为\s*[√×ABCD]{1,4}\s*[。.]?$|本题选|应选\s*[ABCD√×]/.test(x) || x.length > 25).join('');
}

/* ---------- 质检与写出 ---------- */
console.log('新题数:', out.length, '| 目标:', NEED);
const per = {};
out.forEach(v => { per[v.m] = (per[v.m] || 0) + 1; });
console.log('配额实际:', JSON.stringify(per), '| 配额目标:', JSON.stringify(quota));
const diffCnt = {};
out.forEach(v => { diffCnt[v.difficulty] = (diffCnt[v.difficulty] || 0) + 1; });
console.log('难度分布:', JSON.stringify(diffCnt));

if (out.length !== NEED) { console.error('!! 数量未达标'); process.exit(2); }

const NEW = BANK.concat(out);
const ids = new Set(); let dupId = 0, bad = 0;
NEW.forEach(q => {
  const id = q.m + '-' + djb2(q.m + '|' + q.qt + '|' + q.s);
  if (ids.has(id)) dupId++; ids.add(id);
  const ansOk = (q.qt === '多选')
    ? q.a.split('').every(ch => q.o.some(o => o[0] === ch))
    : q.o.some(o => o[0] === q.a);
  const optOk = (q.qt === '判断') ? q.o.length === 2 : (q.o.length >= 3 && q.o.length <= 6);
  if (!ansOk || !optOk || !q.e || !q.e.trim()) bad++;
  if (q.difficulty && !['基础', '进阶', '拔高'].includes(q.difficulty)) bad++;
});
console.log('质检 → 重复ID:', dupId, '异常:', bad, '| 总题数:', NEW.length);
if (dupId || bad || NEW.length !== TARGET) { console.error('!! 质检未通过');
  const badIdx=[];
  NEW.forEach((q,i)=>{ const aOk=(q.qt==='多选')?q.a.split('').every(ch=>q.o.some(o=>o[0]===ch)):q.o.some(o=>o[0]===q.a); const oOk=(q.qt==='判断')?q.o.length===2:(q.o.length>=3&&q.o.length<=6); if(!aOk||!oOk||!q.e||!q.e.trim()) badIdx.push({i,qt:q.qt,a:q.a,oLen:q.o.length,eLen:(q.e||'').length,diff:q.difficulty,s:q.s.slice(0,40)}); });
  console.log('异常明细(前8):', JSON.stringify(badIdx.slice(0,8),null,1));
  process.exit(2); }

META.forEach(m => { m.n = cnt(m.code); });
function cnt(code) { return NEW.filter(q => q.m === code).length; }

const bak = path.join(__dirname, '..', 'src', 'data-3714.js');
if (!fs.existsSync(bak)) fs.copyFileSync(path.join(__dirname, '..', 'src', 'data.js'), bak);
const outStr = '// 学考冲刺通题库 ' + NEW.length + ' 题（3714 + 选择题扩容 ' + out.length + '，难度分级），版本 20261106\n'
  + 'window.BANK_VER=\'20261106\';\n'
  + 'window.BANK_META=' + JSON.stringify(META) + ';\n'
  + 'window.BANK=' + JSON.stringify(NEW) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data.js'), outStr, 'utf8');
console.log('WROTE src/data.js（' + (outStr.length / 1024).toFixed(0) + ' KB），3714 版备份 src/data-3714.js');

/* 抽样 10 道 */
shuffle(out.slice()).slice(0, 10).forEach((q, i) => {
  console.log('--- 抽#' + (i + 1) + ' [' + q.difficulty + '/' + q.m + '] 答:' + q.a);
  console.log('  ' + q.s);
  q.o.forEach(o => console.log('    ' + o[0] + '. ' + (o[1] || o[0]).slice(0, 40)));
  console.log('    解析: ' + (q.e || '').slice(0, 80));
});
