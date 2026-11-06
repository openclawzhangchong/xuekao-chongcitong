/* v5fix 应用器：批 2-3 / 批 0-1 / 批 3-4 的 v5 全库验证修正（i 基于 git HEAD 3999 版）
 * 支持 field: a/e/s/o（o 为选项数组 JSON 串）
 * 用法：node tools/apply-v5fix.js v5fix-2-3.json */
'use strict';
const fs = require('fs');
const path = require('path');

const fname = process.argv[2];
if (!fname) throw new Error('用法: node tools/apply-v5fix.js <v5fix-*.json>');
const fixes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evidence', 'qbank-audit', fname), 'utf8'));
console.log('修正条数:', fixes.length);

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = window.BANK;
const META = window.BANK_META;
if (BANK.length !== 3999) throw new Error('输入必须是 3999 题库（当前 ' + BANK.length + '）');

function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
const stemOwner = {};
BANK.forEach((q, i) => { stemOwner[q.m + '|' + q.qt + '|' + q.s] = i; });

let applied = 0, clash = 0, skipped = 0;
const log = [];

fixes.forEach(fx => {
  const q = BANK[fx.i];
  if (!q || !['a', 'e', 's', 'o'].includes(fx.field)) { skipped++; return; }
  const before = q[fx.field];

  if (fx.field === 'o') {
    let arr;
    try { arr = JSON.parse(fx.fix); } catch (e) { skipped++; return; }
    if (!Array.isArray(arr) || arr.length < 2 || !arr.every(o => Array.isArray(o) && o[0])) { skipped++; return; }
    q.o = arr.map(o => [o[0], o[1] === undefined ? '' : o[1]]);
    applied++;
    log.push('o@' + fx.i);
    return;
  }
  if (fx.field === 's') {
    q.s = fx.fix;
    const nk = q.m + '|' + q.qt + '|' + q.s;
    if (stemOwner[nk] !== undefined && stemOwner[nk] !== fx.i) {
      q.s = before; clash++; log.push('s@' + fx.i + ' 冲突跳过');
      return;
    }
    stemOwner[nk] = fx.i;
    applied++;
    log.push('s@' + fx.i);
    return;
  }
  // a / e 直接替换
  if (fx.field === 'a') {
    const v = String(fx.fix).trim();
    const ok = q.qt === '多选' ? v.split('').every(ch => q.o.some(o => o[0] === ch)) : q.o.some(o => o[0] === v);
    if (!ok) { skipped++; log.push('a@' + fx.i + ' 修正后答案不在选项中，拒绝'); return; }
    q.a = v;
  } else {
    q.e = fx.fix;
  }
  applied++;
  log.push((fx.field) + '@' + fx.i);
});
console.log('应用:', applied, '| 冲突跳过:', clash, '| 拒绝/跳过:', skipped);

// 质检
const ids = new Set(); let dupId = 0, noE = 0, badAns = 0, badOpt = 0;
BANK.forEach(q => {
  const id = q.m + '-' + djb2(q.m + '|' + q.qt + '|' + q.s);
  if (ids.has(id)) dupId++; ids.add(id);
  const ansOk = q.qt === '多选' ? q.a.split('').every(ch => q.o.some(o => o[0] === ch)) : q.o.some(o => o[0] === q.a);
  const optOk = q.qt === '判断' ? q.o.length === 2 : (q.o.length >= 3 && q.o.length <= 6);
  if (!ansOk) badAns++;
  if (!optOk) badOpt++;
  if (!q.e || !q.e.trim()) noE++;
});
console.log('质检 → 重复ID:', dupId, '| 答案异常:', badAns, '| 选项异常:', badOpt, '| 缺解析:', noE);
if (dupId || badAns || badOpt || noE) { console.error('!! 质检未通过，不写入'); process.exit(2); }

const out = '// 学考冲刺通题库 ' + BANK.length + ' 题（v5 全库验证修正：' + fname + ' applied=' + applied + '）\n'
  + 'window.BANK_VER=\'20261106\';\n'
  + 'window.BANK_META=' + JSON.stringify(META) + ';\n'
  + 'window.BANK=' + JSON.stringify(BANK) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data.js'), out, 'utf8');
console.log('WROTE src/data.js');
log.slice(0, 8).forEach(l => console.log('  ' + l));
