// 一次性补丁：清洗顺序修正（用后即删）
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'gen-variants.js');
let s = fs.readFileSync(p, 'utf8');

const washBlock = /BANK\.forEach\(q => \{\n  if \(q\.qt === '判断'\) q\.s = q\.s\.replace\(\/\\s\*A\[\.、．\]\\s\*正确\\s\*B\[\.、．\]\\s\*错误\.\*\$/, ''\)\.trim\(\);\n\}\);\n/;
if (!washBlock.test(s)) throw new Error('wash block not found at assembly');
s = s.replace(washBlock, '');

const anchor = '/* ---------- 陈述池 ---------- */';
if (!s.includes(anchor)) throw new Error('pool anchor missing');
const wash = [
  "/* ---------- 原库清洗：判断题尾巴残留（必须在查重集构建之前） ---------- */",
  "BANK.forEach(q => {",
  "  if (q.qt === '判断') q.s = q.s.replace(/\\s*A[.、．]\\s*正确\\s*B[.、．]\\s*错误.*$/, '').trim();",
  "});",
  ""
].join('\n');
s = s.replace(anchor, wash + anchor);
fs.writeFileSync(p, s);
console.log('wash order fixed:', s.indexOf('原库清洗') < s.indexOf('usedStems = new Set'));
