// 一次性补丁：清洗顺序修正（字符串定位，无正则；用后即删）
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'gen-variants.js');
let s = fs.readFileSync(p, 'utf8');

// 1) 删除组装段的清洗块（用 indexOf 定位）
const startMarker = "BANK.forEach(q => {\n  if (q.qt === '判断') q.s =";
const si = s.indexOf(startMarker);
if (si !== -1) {
  const endMarker = "}).trim();\n});\n";
  const ei = s.indexOf(endMarker, si);
  if (ei !== -1) {
    s = s.slice(0, si) + s.slice(ei + endMarker.length);
    console.log('组装段清洗块已删除');
  } else { console.log('end marker 未找到，跳过删除'); }
} else console.log('组装段无清洗块');

// 2) 在陈述池构建前插入清洗
const anchor = '/* ---------- 陈述池 ---------- */';
if (!s.includes(anchor)) throw new Error('pool anchor missing');
if (s.includes("原库清洗")) { console.log('已有清洗'); }
else {
  const wash = [
    "/* ---------- 原库清洗：判断题尾巴残留（必须在查重集构建之前） ---------- */",
    "BANK.forEach(q => {",
    "  if (q.qt === '判断') q.s = q.s.replace(/\\s*A[.、．]\\s*正确\\s*B[.、．]\\s*错误.*$/, '').trim();",
    "});",
    ""
  ].join('\n');
  s = s.replace(anchor, wash + anchor);
}
fs.writeFileSync(p, s);
console.log('wash before usedStems:', s.indexOf('原库清洗') < s.indexOf('usedStems = new Set'));
