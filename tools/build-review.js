/* 生成「题库逐题审阅」离线单文件 HTML
 * 用法：node tools/build-review.js
 * 输入：src/engine.js + src/data.js（题库真源）、tools/review-template.html、docs/AI审题提示词.md
 * 输出：docs/题目逐题审阅.html
 *
 * 说明：只读题库，绝不修改 src/data.js。生成的 HTML 内嵌全库题目（精简字段），
 *      可离线逐题截屏给审查 AI；AI 的 DELETE 结果可一键导出成主程序
 *      xkc.qdeleted.v1 格式的删除清单（本机隐藏、可恢复）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'src', 'engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8'));
const BANK = window.BANK, XK = window.XK, META = window.BANK_META;

// 判定规则单一真源（与 quality-gate.js 共用），避免审阅页与闸门结论打架
const { classify, optKey, RULES } = require('./quality-rules');
const qids = BANK.map(XK.qidOf);
const byOpts = Object.create(null);
BANK.forEach(q => { const k = optKey(q); (byOpts[k] = byOpts[k] || []).push(XK.qidOf(q)); });
const verdicts = BANK.map((q, i) => classify(q, { qid: qids[i], byOpts: byOpts }));

function flagsOf(i) {
  const v = verdicts[i];
  if (v.state === 'KEEP') return [];
  return v.rules.map(r => v.state + ' · ' + r + ' · ' + RULES[r]);
}

const items = BANK.map((q, i) => ({
  n: i + 1,
  qid: qids[i],
  m: q.m, kd: q.kd || '', qt: q.qt, s: q.s || '',
  o: (q.o || []).map(x => [String(x[0]), String(x[1] == null ? '' : x[1])]),
  a: q.a || '', e: q.e || '', t: q.t || '',
  flags: flagsOf(i), verdict: verdicts[i].state, reason: verdicts[i].reason
}));

const flagCounts = {};
items.forEach(x => (x.flags || []).forEach(f => { flagCounts[f.split(' · ')[1]] = (flagCounts[f.split(' · ')[1]] || 0) + 1; }));
const states = { DELETE: 0, CLEAN: 0, KEEP: 0 };
verdicts.forEach(v => { states[v.state]++; });
const suspect = states.DELETE;   // 「只看可疑题」只筛 DELETE，CLEAN 不该被当成要删的题

const payload = {
  generated: new Date().toLocaleString('zh-CN', { hour12: false }),
  bank: BANK.length,
  suspect: suspect,
  states: states,
  rules: RULES,
  modules: META.map(m => ({ code: m.code, name: m.name, disp: m.disp, score: m.score })),
  items: items
};

// JSON 内嵌进 <script> 时必须转义 <，否则题目里的 </script> 会截断页面
function safe(v) {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
const promptText = fs.readFileSync(path.join(ROOT, 'docs', 'AI审题提示词.md'), 'utf8');
const tpl = fs.readFileSync(path.join(ROOT, 'tools', 'review-template.html'), 'utf8');
if (tpl.indexOf('__PAYLOAD__') < 0 || tpl.indexOf('__PROMPT_JSON__') < 0) {
  throw new Error('模板缺少占位符 __PAYLOAD__ / __PROMPT_JSON__');
}
// 只校验注入的数据（模板自身的 </script> 结束标签是合法的）
const dataJson = safe(payload), promptJson = safe(promptText);
if (/<\/script/i.test(dataJson) || /<\/script/i.test(promptJson)) {
  throw new Error('注入数据里出现未转义的 </script>');
}
// 用函数形式替换，避免 JSON 里的 $& / $1 被当成替换模式
const html = tpl
  .replace('__PAYLOAD__', () => dataJson)
  .replace('__PROMPT_JSON__', () => promptJson);

const out = path.join(ROOT, 'docs', '题目逐题审阅.html');
fs.writeFileSync(out, html, 'utf8');
console.log('BUILD OK →', out);
console.log('大小:', (fs.statSync(out).size / 1024 / 1024).toFixed(2), 'MB | 题目', BANK.length,
  '题 | DELETE', states.DELETE, '｜CLEAN', states.CLEAN, '｜KEEP', states.KEEP,
  '｜只看可疑题', suspect, '题 (' + (suspect / BANK.length * 100).toFixed(1) + '%)');
console.log('规则命中:', JSON.stringify(flagCounts));
console.log('提示词字数:', promptText.length, '｜题库真源未改动');
