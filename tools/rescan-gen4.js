/* 核验三：独立复扫（gen4 修正后跑）
 * node tools/rescan-gen4.js */
'use strict';
const fs = require('fs');
const path = require('path');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const B = window.BANK;
const gen4 = B.filter(q => (q.src || '').startsWith('gen4'));
console.log('gen4 数量:', gen4.length, '（应 285）');
let issues = 0;
// ① 题面/选项残留
gen4.forEach(q => {
  if (/[ABCD][.、．]/.test(q.s)) { issues++; console.log('RESIDUE@' + q.src + ':', q.s.slice(0, 50)); }
  if ((q.e || '').length < 10) { issues++; console.log('SHORT-E@' + q.src); }
  if (q.o.some(o => !o[1])) { issues++; console.log('EMPTYOPT@' + q.src); }
});
// ② 与全库题面唯一
const others = new Set(B.filter(q => !(q.src || '').startsWith('gen4')).map(q => q.m + '|' + q.s));
gen4.forEach(q => { if (others.has(q.m + '|' + q.s)) { issues++; console.log('CLASH@' + q.src); } });
// ③ 答案分布合理性（正确项不应全在 A）
const pos = gen4.filter(q => (q.e || '').includes('（基础）') || true);
const ansDist = { A: 0, B: 0, C: 0, D: 0 };
gen4.forEach(q => ansDist[q.a] = (ansDist[q.a] || 0) + 1);
console.log('答案分布:', JSON.stringify(ansDist));
if (ansDist.A / gen4.length > 0.45) { issues++; console.log('答案分布偏向 A（应随机落位）'); }
console.log(issues === 0 ? '✓ 核验三通过：0 问题' : '✗ 发现 ' + issues + ' 个问题');
process.exit(issues ? 1 : 0);
