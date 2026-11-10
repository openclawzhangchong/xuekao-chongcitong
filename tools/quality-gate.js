/* 题库质量闸门（只读）：node tools/quality-gate.js [--json]
 * ---------------------------------------------------------------------
 * 三态判定，全部基于「字段位置 + 结构」，不做主观语义判断：
 *   DELETE 结构性损坏（排除出白名单，绝不物理删题）
 *   CLEAN  格式瑕疵（洗掉即可用，绝不能删题）
 *   KEEP   正常
 * 只输出报告 docs/题库质检报告.json；不改题库、不改白名单、不部署。
 * 规则与 docs/AI质检规则提示词.md 的 R1~R8 一一对应。
 * 用法：node tools/quality-gate.js            # 摘要 + 写报告
 *       node tools/quality-gate.js --json     # 纯 JSON 到 stdout
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'src', 'engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'src', 'whitelist-data.js'), 'utf8'));
const BANK = window.BANK, XK = window.XK, TIERS = window.XK_TIER_INDEX;

// 判定规则单一真源：禁止在此处复制正则，避免各工具结论互相打架
const { classify, optText, optKey, isTrusted, RULES } = require('./quality-rules');

// 库内「选项集合相同」的题（供 R8 判断清洗后是否为冗余副本）
const byOpts = Object.create(null);
BANK.forEach(q => {
  const k = optKey(q);
  (byOpts[k] = byOpts[k] || []).push(XK.qidOf(q));
});

const qids = BANK.map(XK.qidOf);
const byStemDir = Object.create(null);
BANK.forEach(q => {
  if (q.qt !== '单选') return;
  const nk = optKey(q);
  const norm = String(q.s || '').trim().replace(/^【[^】]{1,24}】/, '').replace(/s+/g, '');
  const dir = /(错误的是|不正确|不属于|有误)/.test(norm) ? 'neg' : 'pos';
  (byStemDir[nk] = byStemDir[nk] || new Set()).add(dir + ':' + String(q.a || '').trim());
});
const verdicts = BANK.map((q, i) => classify(q, { qid: qids[i], byOpts: byOpts, byStemDir: byStemDir }));
const states = { DELETE: 0, CLEAN: 0, KEEP: 0 };
verdicts.forEach(v => { states[v.state]++; });
const byRule = {};
verdicts.forEach(v => v.rules.forEach(r => { byRule[r] = (byRule[r] || 0) + 1; }));

const bySource = {};
BANK.forEach((q, i) => {
  const s = String(q.src || '(无)').split(':')[0];
  const g = bySource[s] = bySource[s] || { total: 0, DELETE: 0, CLEAN: 0, KEEP: 0, trusted: isTrusted({ src: s }) };
  g.total++; g[verdicts[i].state]++;
});

const byTier = {};
Object.keys(TIERS).forEach(t => {
  const idx = TIERS[t];
  byTier[t] = { total: idx.length, DELETE: idx.filter(i => verdicts[i].state === 'DELETE').length,
                CLEAN: idx.filter(i => verdicts[i].state === 'CLEAN').length };
});

// 干净池 = KEEP + CLEAN（CLEAN 洗完可用）
const cleanIdx = [];
verdicts.forEach((v, i) => { if (v.state !== 'DELETE') cleanIdx.push(i); });
const cleanSet = new Set(cleanIdx);
const quotas = {};
['1000', '2000', '3000'].forEach(t => {
  const f = path.join(ROOT, 'docs', '题库精简配额-' + t + '题.json');
  if (!fs.existsSync(f)) return;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const m = {};
  (j.modules || j.by_module || []).forEach(x => { m[x.code] = x.quota || x.target || 0; });
  quotas[t] = m;
});
const feasibility = {};
BANK.forEach((q, i) => {
  const g = feasibility[q.m] = feasibility[q.m] || { total: 0, clean: 0 };
  g.total++; if (cleanSet.has(i)) g.clean++;
});
Object.keys(feasibility).forEach(m => {
  feasibility[m].by_tier = {};
  Object.keys(quotas).forEach(t => {
    const need = quotas[t][m] || 0;
    feasibility[m].by_tier[t] = { quota: need, ok: feasibility[m].clean >= need };
  });
});

function sample(state, n) {
  const out = [];
  for (let i = 0; i < BANK.length && out.length < n; i++) {
    if (verdicts[i].state !== state) continue;
    out.push({ qid: qids[i], rules: verdicts[i].rules, reason: verdicts[i].reason,
      stem: String(BANK[i].s || '').slice(0, 90), options: optText(BANK[i]).map(s => s.slice(0, 70)),
      answer: BANK[i].a, src: String(BANK[i].src || '').slice(0, 40) });
  }
  return out;
}

const report = {
  generated_at: new Date().toISOString(),
  note: '只读扫描：一题未删、白名单未改、未部署。DELETE 表示「排除出候选白名单」，不是物理删除。',
  summary: {
    total: BANK.length, DELETE: states.DELETE, CLEAN: states.CLEAN, KEEP: states.KEEP,
    clean_pool: cleanIdx.length,
    cleanable_duplicate: verdicts.filter(v => v.dup).length,
    delete_rate: +(states.DELETE / BANK.length * 100).toFixed(1)
  },
  by_rule: byRule,
  by_source: bySource,
  by_tier: byTier,
  feasibility: feasibility,
  samples: { DELETE: sample('DELETE', 4), CLEAN: sample('CLEAN', 4), KEEP: sample('KEEP', 2) },
  delete_qids: BANK.filter((q, i) => verdicts[i].state === 'DELETE').map(XK.qidOf)
};

if (!process.argv.includes('--json')) {
  const out = path.join(ROOT, 'docs', '题库质检报告.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log('REPORT →', out);
  console.log('全库', BANK.length, '｜DELETE', states.DELETE, '｜CLEAN', states.CLEAN,
    '｜KEEP', states.KEEP, '｜干净池', cleanIdx.length);
  console.log('规则命中', JSON.stringify(byRule));
  console.log('可清洗但洗完与已有题重复（删掉零损失）', report.summary.cleanable_duplicate);
  Object.keys(byTier).forEach(t => console.log('  ' + t + ' 档含 DELETE', byTier[t].DELETE, '/', byTier[t].total));
  Object.keys(feasibility).sort().forEach(m => {
    const f = feasibility[m];
    console.log('  ' + m + ' 干净', f.clean, '｜配额 1000/2000/3000:',
      Object.keys(f.by_tier).map(t => t + '=' + f.by_tier[t].quota + (f.by_tier[t].ok ? '✓' : '✗')).join(' '));
  });
} else {
  console.log(JSON.stringify(report, null, 2));
}
