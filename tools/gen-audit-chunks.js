/* 审读快照生成器：把题库指定区间导出为审读代理可用的分块快照
 * 用法：
 *   node tools/gen-audit-chunks.js                          # 全库，250 题/块
 *   node tools/gen-audit-chunks.js 1250 2000 250            # i=1250~1999，250 题/块
 *   node tools/gen-audit-chunks.js 0 1000 250 evidence/qbank-audit/chunks-xxx
 * 产出（输出目录，默认 evidence/qbank-audit/chunks-<MMDD>-<起始>-<结束>）：
 *   all.json      整段快照单文件（紧凑 JSON，存档用）
 *   part0.json…  分块 pretty JSON（给审读/修复代理用 Read 逐块读，250 题/块 ≈ 140KB）
 * 每题字段：{i, m, kd, qt, s, o, a, e}（i = 当前题库下标，发现项必须原样引用）
 * 配套流程见 docs/题库审读修复手册.md
 */
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = global.window.BANK;

const lo = parseInt(process.argv[2] || '0', 10);
const hi = Math.min(parseInt(process.argv[3] || String(BANK.length), 10), BANK.length);
const PER = parseInt(process.argv[4] || '250', 10);
const outDir = process.argv[5] ||
  path.join(__dirname, '..', 'evidence', 'qbank-audit',
    'chunks-' + new Date().toISOString().slice(5, 10).replace('-', '') + '-' + lo + '-' + hi);
if (!(lo >= 0 && hi > lo && PER > 0 && PER <= 1000)) throw new Error('参数不合法：0 ≤ 起始 < 结束 ≤ ' + BANK.length + '，每块 1~1000');

fs.mkdirSync(outDir, { recursive: true });
const qs = [];
for (let i = lo; i < hi; i++) {
  const q = BANK[i];
  qs.push({ i, m: q.m, kd: q.kd, qt: q.qt, s: q.s, o: q.o, a: q.a, e: q.e });
}
fs.writeFileSync(path.join(outDir, 'all.json'), JSON.stringify(qs));
const nChunks = Math.ceil(qs.length / PER);
for (let c = 0; c < nChunks; c++) {
  const part = qs.slice(c * PER, (c + 1) * PER);
  fs.writeFileSync(path.join(outDir, 'part' + c + '.json'), JSON.stringify(part, null, 1));
}
console.log('快照 ' + qs.length + ' 题（i=' + lo + '~' + (hi - 1) + '）→ ' + path.relative(process.cwd(), outDir));
console.log('分块: ' + nChunks + ' 块 × ≤' + PER + ' 题（part0.json ~ part' + (nChunks - 1) + '.json）');
console.log('下一步：按 docs/题库审读修复手册.md 派并发审读/修复代理，发现项引用本快照的 i');
