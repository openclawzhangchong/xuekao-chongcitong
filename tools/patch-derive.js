/* 一次性补丁：build-whitelist.js 的 derive() 改为容量感知配平 */
'use strict';
const fs = require('fs');
const p = 'tools/build-whitelist.js';
let t = fs.readFileSync(p, 'utf8');
const start = t.indexOf('function derive(parentSel, target) {');
const endMark = 'return { Q: Q, sel: sel, tier: tier };\n}';
const end = t.indexOf(endMark, start);
if (start < 0 || end < 0) throw new Error('derive 函数定位失败');
const replacement = [
  'function derive(parentSel, target) {',
  '  /* 模块级容量感知配平：parentSel 里各模块可用题数不足理想配额时，',
  '   * 缺口由富余模块按分值比例补足（与 3000 档的 quotaCapped 同构）——',
  '   * 修复 M9 考点池被人工排除掏空后 2000/1000 档取不满的问题 */',
  '  const modCapP = Object.create(null);',
  '  MODULES.forEach(m => { modCapP[m.code] = 0; });',
  '  Object.entries(parentSel).forEach(([pid, list]) => {',
  "    const modCode = String(pid).split('-')[0];",
  '    if (modCapP[modCode] !== undefined) modCapP[modCode] += (list || []).length;',
  '  });',
  '  const Q = quotaCapped(target, modCapP).q;',
  '  const sel = Object.create(null);',
  '  const tier = [];',
  '  MODULES.forEach(mod => {',
  '    const pq = pointQuota(mod, Q[mod.code], id => (parentSel[id] || []).length);',
  '    mod.points.forEach(p => {',
  '      const list = (parentSel[p.id] || []).slice(0, pq[p.id] || 0);',
  '      sel[p.id] = list;',
  '      tier.push.apply(tier, list);',
  '    });',
  '  });',
  '  return { Q: Q, sel: sel, tier: tier };',
  '}',
].join('\n');
t = t.slice(0, start) + replacement + t.slice(end + endMark.length);
fs.writeFileSync(p, t);
console.log('derive 已替换为容量感知配平版');
