/* 题库缺陷复扫（长期闸门）：node tools/scan-defects.js
 *
 * 四类可自动判定的缺陷 + 一类只能出候选的缺陷，计数写入 evidence/defect-baseline.json。
 * 默认模式与基线对比：任何「可自动判定」类计数上升 → 退出码 1（闸门）。
 *
 *   node tools/scan-defects.js                 # 扫描 + 对比基线
 *   node tools/scan-defects.js --save-baseline # 把当前计数存为新基线
 *   node tools/scan-defects.js --json          # 机器可读输出
 *
 * 关于「选项截断」：复扫证明它无法靠启发式判定——两种启发式分别命中 97 / 374 题，
 * 抽样几乎全是正常干扰项（如「信息技术只有积极影响，没有消极影响」），
 * 而交接文档举的唯一实例「最基本的系统软件是办公」其实选项完整。
 * 所以这里只列候选、不计入闸门，需要逐题人工/AI 复核。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(ROOT, 'evidence', 'defect-baseline.json');

global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'src', 'engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8'));
const XK = window.XK, BANK = window.BANK;

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '').trim();

/* ① 题面残留：题干里混进了整段「A. 选项B. 选项…」（运行时由 cleanStem 剥离） */
const residue = BANK.filter((q) => XK.cleanStem(q.s) !== q.s);

/* ② 重复选项：同题两个选项文本一模一样（判断题固定 正确/错误，排除）。
 *    只 trim，绝不折叠空格——「1 2 3」和「123」在屏幕上是两个不同选项，
 *    折叠空格会把它们误判成重复（实测假阳性 2 题）。 */
const optKey = (o) => String(o[1] == null ? '' : o[1]).trim();
const dupOpt = BANK.filter((q) => q.qt !== '判断' && new Set(q.o.map(optKey)).size !== q.o.length);

/* ③ 过短解析：<20 字基本等于没解释 */
const shortExp = BANK.filter((q) => norm(q.e).length < 20);

/* ④ 纯模板解析：整条解析只剩一句「（注意：本题说法错误。）」 */
const tmplExp = BANK.filter((q) => /^（注意：.*）[。.]?$/.test(norm(q.e)));

/* ⑤ 截断候选（仅参考，不计入闸门）：某选项是全库另一条更长选项的前缀且 ≥6 字 */
const truncCand = BANK.filter((q) => q.o.some((o) => {
  const v = norm(o[1]);
  if (v.length < 6 || /[）)】。」？！?]$/.test(v)) return false;
  return BANK.some((r) => r !== q && r.o.some((x) => {
    const w = norm(x[1]);
    return w !== v && w.startsWith(v);
  }));
}));

const counts = {
  题面残留: residue.length,
  重复选项: dupOpt.length,
  过短解析: shortExp.length,
  纯模板解析: tmplExp.length
};
const GATED = Object.keys(counts);

const report = { at: new Date().toISOString(), total: BANK.length, counts, 截断候选仅参考: truncCand.length };

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 1));
} else {
  console.log('题库 ' + BANK.length + ' 题 缺陷复扫 @ ' + report.at.slice(0, 19).replace('T', ' '));
  console.log('─'.repeat(58));
  GATED.forEach((k) => console.log('  ' + k.padEnd(8) + String(counts[k]).padStart(5) + ' 题'));
  console.log('  截断候选  ' + String(truncCand.length).padStart(5) + ' 题（启发式，误报极多，不计入闸门、需逐题复核）');
  console.log('─'.repeat(58));
  if (dupOpt.length) {
    console.log('重复选项明细（可直接改 o 字段，不动题干 → qid 不变）：');
    dupOpt.forEach((q) => {
      const i = BANK.indexOf(q);
      console.log('  i=' + i + ' ' + q.m + ' ' + q.s.slice(0, 34) + ' || ' + q.o.map((o) => o[0] + '.' + norm(o[1])).join(' / '));
    });
  }
  if (tmplExp.length) {
    console.log('纯模板解析明细：');
    tmplExp.forEach((q) => console.log('  i=' + BANK.indexOf(q) + ' ' + q.m + ' ' + JSON.stringify(q.e)));
  }
}

if (process.argv.includes('--save-baseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify(report, null, 1), 'utf8');
  console.log('\n基线已写入 ' + path.relative(ROOT, BASELINE));
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.log('\n尚无基线，先跑：node tools/scan-defects.js --save-baseline');
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
let worse = 0;
console.log('\n与基线（' + base.at.slice(0, 10) + '，题库 ' + base.total + ' 题）对比：');
GATED.forEach((k) => {
  const d = counts[k] - base.counts[k];
  if (d > 0) { worse++; console.log('  ✗ ' + k + ' ' + base.counts[k] + ' → ' + counts[k] + '（+' + d + '，不允许）'); }
  else if (d < 0) console.log('  ✓ ' + k + ' ' + base.counts[k] + ' → ' + counts[k] + '（' + d + '）');
  else console.log('  = ' + k + ' ' + counts[k]);
});
if (worse) { console.log('\n✗ 有 ' + worse + ' 类缺陷计数上升'); process.exit(1); }
console.log('\n✓ 计数未上升');
