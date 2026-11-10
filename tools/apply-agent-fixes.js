/* 把审读代理的 fix/delete 结果转成可应用清单
 * 用法：node tools/apply-agent-fixes.js evidence/qbank-review/agent-M1M3.json
 * 输出：evidence/qbank-review/fixes-ready.json（v5fix 格式，可直接 apply-v5fix.js）
 *       delete/uncertain 追加进 docs/人工审阅排除.json */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const srcFile = process.argv[2];
if (!srcFile) throw new Error('用法: node tools/apply-agent-fixes.js <agent-*.json>');
const items = JSON.parse(fs.readFileSync(path.join(ROOT, srcFile), 'utf8'));
global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8'));
const BANK = window.BANK;

function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
function qidOfQ(q) { return (q.m || 'M') + '-' + djb2((q.m || '') + '|' + (q.qt || '') + '|' + (q.s || '')); }

const fixes = [], deletes = [], skipped = [];
items.filter(x => x.verdict === 'fix').forEach(x => {
  const q = BANK[x.i];
  // 代理记录无 qid 字段，用 i 现算并用 m+qt 交叉校验下标正确性
  if (!q || (x.m && q.m !== x.m) || (x.qt && q.qt !== x.qt)) { skipped.push({ i: x.i, why: '下标/m/qt 不匹配（库已变化）' }); return; }
  const qid = qidOfQ(q);
  const fm = /^o\[(\d+)\]/.exec(x.field || '');
  if (fm) {
    const idx = parseInt(fm[1], 10);
    if (!q.o[idx]) { skipped.push({ i: x.i, qid, why: 'o[' + idx + '] 不存在' }); return; }
    const arr = q.o.map((o, k) => [o[0], k === idx ? String(x.fix) : String(o[1])]);
    fixes.push({ i: x.i, field: 'o', issue: (x.issue || '').slice(0, 120), fix: JSON.stringify(arr) });
  } else if (x.field === 'a' || x.field === 'e') {
    if (x.field === 'a') {
      const keys = q.o.map(o => String(o[0]));
      const ok = String(x.fix).split('').every(ch => keys.includes(ch));
      if (!ok) { skipped.push({ i: x.i, qid, why: '新答案 ' + x.fix + ' 不在选项集合' }); return; }
    }
    fixes.push({ i: x.i, field: x.field, issue: (x.issue || '').slice(0, 120), fix: String(x.fix) });
  } else if (x.field === 's') {
    fixes.push({ i: x.i, field: 's', issue: (x.issue || '').slice(0, 120), fix: String(x.fix) });
  } else {
    skipped.push({ i: x.i, qid, why: '未知 field: ' + x.field });
  }
});

items.filter(x => x.verdict === 'delete').forEach(x => {
  const q = BANK[x.i];
  if (!q || (x.m && q.m !== x.m) || (x.qt && q.qt !== x.qt)) { skipped.push({ i: x.i, why: 'delete 下标/m/qt 不匹配' }); return; }
  const qid = qidOfQ(q);
  deletes.push({ qid, i: x.i, reason: (x.issue || '').slice(0, 150), source: 'agent-M1M3' });
});

fs.writeFileSync(path.join(ROOT, 'evidence', 'qbank-audit', 'fixes-ready.json'), JSON.stringify(fixes, null, 1));
if (deletes.length) {
  const exclPath = path.join(ROOT, 'docs', '人工审阅排除.json');
  const list = JSON.parse(fs.readFileSync(exclPath, 'utf8'));
  const have = new Set(list.map(x => x.qid));
  deletes.forEach(d => { if (!have.has(d.qid)) { list.push(d); have.add(d.qid); } });
  fs.writeFileSync(exclPath, JSON.stringify(list, null, 2), 'utf8');
  console.log('排除清单追加', deletes.length, '条 → 总', list.length);
}
console.log('fix 就绪:', fixes.length, '| delete:', deletes.length, '| 跳过:', skipped.length);
skipped.forEach(s => console.log('  跳过:', s.qid, '—', s.why));
uncertain_note();
function uncertain_note() {
  const unc = items.filter(x => x.verdict === 'uncertain');
  if (!unc.length) return;
  fs.writeFileSync(path.join(ROOT, 'evidence', 'qbank-review', 'uncertain-m1m3.json'),
    JSON.stringify(unc.map(x => ({ qid: x.qid, i: x.i, m: BANK[x.i] && BANK[x.i].m, issue: x.issue })), null, 2));
  console.log('uncertain 留档:', unc.length, '条 → evidence/qbank-review/uncertain-m1m3.json');
}
