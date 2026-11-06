/* 审题修正应用器 v2：读 evidence/qbank-audit/fix-*.json → 应用 → 质检 → 写出
 * 用法：node tools/apply-fixes.js */
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = window.BANK;
const META = window.BANK_META;

// 汇总修正文件
const dir = path.join(__dirname, '..', 'evidence', 'qbank-audit');
const fixFiles = fs.readdirSync(dir).filter(f => /^fix-.*\.json$/.test(f));
let fixes = [];
for (const f of fixFiles) {
  try {
    const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (Array.isArray(arr)) fixes = fixes.concat(arr);
  } catch (e) { console.error('跳过损坏文件', f); }
}
console.log('修正文件:', fixFiles.join(', '), '| 修正条数:', fixes.length);

// 旧库映射：fix 的 i 基于 data-3714.js（v5 重构前的库），通过题面映射到当前库
let oldBank = null;
try { global.window = {}; eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data-3714.js'), 'utf8')); oldBank = window.BANK; } catch (e) {}
function locate(fixIdx) {
  if (!oldBank || !oldBank[fixIdx]) return { q: BANK[fixIdx], via: 'index' };
  const oq = oldBank[fixIdx];
  const key = oq.m + '|' + oq.qt + '|' + oq.s;
  const ni = BANK.findIndex(x => (x.m + '|' + x.qt + '|' + x.s) === key);
  if (ni !== -1) return { q: BANK[ni], via: 'stem', realI: ni };
  return { q: null, via: 'gone' };
}

// 题面 key 索引（O(1) 冲突预检）
const stemKeyOwner = {};
BANK.forEach((o, oi) => { stemKeyOwner[o.m + '|' + o.qt + '|' + o.s] = oi; });

let applied = 0, clashSkipped = 0;
const log = [];
for (const fx of fixes) {
  const loc = locate(fx.i);
  const q = loc.q;
  if (!q || !['a', 'e', 's', 'o'].includes(fx.field)) { log.push('跳过 i=' + fx.i + '（' + loc.via + '）'); continue; }
  const before = q[fx.field];
  q[fx.field] = fx.fix;
  if (fx.field === 'o') {
    let arr;
    try { arr = JSON.parse(fx.fix); } catch (e) { log.push('跳过 i=' + fx.i + '（o 非法 JSON）'); continue; }
    if (!Array.isArray(arr) || arr.length < 2) { log.push('跳过 i=' + fx.i + '（o 数组异常）'); continue; }
    const okFmt = arr.every(o => Array.isArray(o) && o.length >= 1 && o[0]);
    if (!okFmt) { log.push('跳过 i=' + fx.i + '（o 选项格式异常）'); continue; }
    q.o = arr.map(o => [o[0], o[1] === undefined ? '' : o[1]]);
    applied++;
    log.push('o@' + fx.i + ' 选项数组替换（' + arr.length + ' 项）');
    continue;
  }
  // s 修正冲突预检：新题面与库内其他题相同 → 回退（教辅不允许同题面两道题）
  if (fx.field === 's') {
    const nk = q.m + '|' + q.qt + '|' + q.s;
    if (stemKeyOwner[nk] !== undefined && stemKeyOwner[nk] !== fx.i) {
      q[fx.field] = before;
      clashSkipped++;
      log.push('冲突跳过 i=' + fx.i + '（新题面与 #' + stemKeyOwner[nk] + ' 相同）');
      continue;
    }
    stemKeyOwner[nk] = fx.i;
  }
  applied++;
  log.push('应用 i=' + fx.i + ' [' + fx.field + '] ' + String(fx.issue || '').slice(0, 46));
}
console.log('应用:', applied, '| 冲突跳过:', clashSkipped);

// 质检
function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
const ids = new Set(); let dupId = 0, noE = 0, badAns = 0;
BANK.forEach(q => {
  const id = q.m + '-' + djb2(q.m + '|' + q.qt + '|' + q.s);
  if (ids.has(id)) dupId++; ids.add(id);
  const ansOk = q.qt === '多选' ? q.a.split('').every(ch => q.o.some(o => o[0] === ch)) : q.o.some(o => o[0] === q.a);
  if (!ansOk) badAns++;
  if (!q.e || !q.e.trim()) noE++;
});
console.log('质检 → 重复ID:', dupId, '| 答案异常:', badAns, '| 缺解析:', noE);
if (dupId || badAns || noE) {
  console.error('!! 质检未通过，不写入。');
  log.slice(0, 20).forEach(l => console.log('  ' + l));
  process.exit(2);
}

const out = '// 学考冲刺通题库 ' + BANK.length + ' 题（含审题修正 applied=' + applied + ' clash=' + clashSkipped + '，见 evidence/qbank-audit/）\n'
  + 'window.BANK_VER=\'20261106\';\n'
  + 'window.BANK_META=' + JSON.stringify(META) + ';\n'
  + 'window.BANK=' + JSON.stringify(BANK) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data.js'), out, 'utf8');
console.log('WROTE src/data.js');
log.slice(0, 8).forEach(l => console.log('  ' + l));
