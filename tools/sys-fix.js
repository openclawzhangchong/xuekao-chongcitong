/* 系统性修复：revJudge 语义翻转 + 变式解析结论句清洗
 * 用法：node tools/sys-fix.js（在 apply-fixes.js 之前跑） */
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = window.BANK;
const META = window.BANK_META;

let flipped = 0, cleaned = 0;

// cleanE：剥除与当前答案冲突的结论句（长句保留，短结论句删除）
function cleanE(e) {
  if (!e) return e;
  return e.split(/(?<=[。！？])/).filter(function (sent) {
    return !/选\s*[√×]|故选\s*[ABCD]|答案为\s*[√×ABCD]{1,4}\s*[。.]?$|本题选|应选\s*[ABCD√×]/.test(sent) || sent.length > 25;
  }).join('');
}

BANK.forEach(q => {
  if (!(q.src || '').startsWith('gen')) return;
  // ① revJudge 语义翻转：反向题「不属于/错误的是 X」拼接后陈述为真 → √
  if (q.src.includes('revJudge') && q.a === '×') {
    q.a = '√';
    q.e = cleanE(q.e);
    if (!/本题说法正确/.test(q.e)) q.e += '（本题说法正确——该项确属原题所判定的类别。）';
    flipped++;
  }
  // ② 全变式解析清洗：剥残留结论句
  const before = q.e;
  const cleanedE = cleanE(q.e);
  if (cleanedE && cleanedE.trim()) { if (cleanedE !== before) { q.e = cleanedE; cleaned++; } }
  else if (before && before.trim()) { q.e = '本题考查“' + q.kd.replace(/^考点s*d*s*·?s*/, '') + '”相关知识点，正确答案为 ' + q.a + '。'; cleaned++; }
});

console.log('revJudge 翻转:', flipped, '| 解析清洗:', cleaned);

// 质检
function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
const ids = new Set(); let dupId = 0, noE = 0;
BANK.forEach(q => {
  const id = q.m + '-' + djb2(q.m + '|' + q.qt + '|' + q.s);
  if (ids.has(id)) dupId++; ids.add(id);
  if (!q.e || !q.e.trim()) noE++;
});
console.log('质检 → 重复ID:', dupId, '缺解析:', noE);
if (dupId || noE) { console.error('!! 质检未通过'); process.exit(2); }

const out = '// 学考冲刺通题库 ' + BANK.length + ' 题（含系统语义修复 revJudge×' + flipped + ' / 解析清洗 ' + cleaned + '）\n'
  + 'window.BANK_VER=\'20261106\';\n'
  + 'window.BANK_META=' + JSON.stringify(META) + ';\n'
  + 'window.BANK=' + JSON.stringify(BANK) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data.js'), out, 'utf8');
console.log('WROTE src/data.js');
