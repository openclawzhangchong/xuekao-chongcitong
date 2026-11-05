/* gen4 修正应用器（核验二产出 → 核验三前置）
 * s 类：多段「KEY：新选项文本」（；分隔）→ 替换 o 数组对应项
 * a 类：多段「X改为：新文本」→ 改写选项极性使答案唯一（答案字母不变）
 * e 类：整条替换
 * 用法：node tools/apply-gen4.js */
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = window.BANK;
const META = window.BANK_META;

const fixes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evidence', 'qbank-audit', 'fix-gen4.json'), 'utf8'));
console.log('gen4 修正条数:', fixes.length);

let applied = 0, skipped = [];
const log = [];

// 解析多段改写：「A：xxx；B：yyy」→ [{k:'A',v:'xxx'},...]
function parseKV(fix) {
  return fix.split(/；/).map(seg => {
    const m = /^([A-D])\s*[：:]\s*([\s\S]+)$/.exec(seg.trim());
    return m ? { k: m[1], v: m[2].trim() } : null;
  }).filter(Boolean);
}

fixes.forEach(fx => {
  const q = BANK[fx.i];
  if (!q) { skipped.push('i=' + fx.i + ' 越界'); return; }
  if (fx.field === 'e') {
    if (fx.fix && fx.fix.trim()) { q.e = fx.fix; applied++; log.push('e@' + fx.i + ' 重写'); }
    else skipped.push('e@' + fx.i + ' 空修正');
    return;
  }
  if (fx.field === 's' || fx.field === 'a') {
    // 两种格式统一按「KEY：文本」多段解析（a 类「X改为：文本」同构）
    const norm = fx.field === 'a' ? fx.fix.replace(/改为：/g, '：') : fx.fix;
    const kvs = parseKV(norm);
    if (!kvs.length) { skipped.push('i=' + fx.i + ' ' + fx.field + ' 无法解析'); return; }
    let ok = true;
    kvs.forEach(({ k, v }) => {
      const o = q.o.find(x => x[0] === k);
      if (!o) { ok = false; return; }
      o[1] = v;
      if (o[1] === o[0]) o[1] = o[0]; // 保持原样（判断题短语）
    });
    if (!ok) { skipped.push('i=' + fx.i + ' 选项键不存在'); return; }
    // a 类：改写后若原答案指向的选项被改写，答案字母保持（agent 设计为「改写该项使其符合/不符合」）
    applied++;
    log.push((fx.field === 'a' ? 'a' : 's') + '@' + fx.i + ' 改写 ' + kvs.map(x => x.k).join(','));
    return;
  }
  skipped.push('i=' + fx.i + ' 未知字段');
});
console.log('应用:', applied, '| 跳过:', skipped.length);
skipped.slice(0, 8).forEach(x => console.log('  skip:', x));

// 质检
function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
const ids = new Set(); let dupId = 0, noE = 0, badAns = 0, dupOpt = 0;
BANK.forEach(q => {
  const id = q.m + '-' + djb2(q.m + '|' + q.qt + '|' + q.s);
  if (ids.has(id)) dupId++; ids.add(id);
  const ansOk = q.qt === '多选' ? q.a.split('').every(ch => q.o.some(o => o[0] === ch)) : q.o.some(o => o[0] === q.a);
  if (!ansOk) badAns++;
  if (!q.e || !q.e.trim()) noE++;
  if (q.o.length >= 3 && new Set(q.o.map(o => o[1])).size !== q.o.map(o => o[1]).length) dupOpt++;
});
console.log('质检 → 重复ID:', dupId, '| 答案异常:', badAns, '| 缺解析:', noE, '| 重复选项题:', dupOpt);
if (dupId || badAns || noE) {
  console.error('!! 质检未通过，不写入');
  process.exit(2);
}

const out = '// 学考冲刺通题库 ' + BANK.length + ' 题（gen4 核验修正 applied=' + applied + '）\n'
  + 'window.BANK_VER=\'20261106\';\n'
  + 'window.BANK_META=' + JSON.stringify(META) + ';\n'
  + 'window.BANK=' + JSON.stringify(BANK) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data.js'), out, 'utf8');
console.log('WROTE src/data.js');
log.slice(0, 6).forEach(l => console.log('  ' + l));
