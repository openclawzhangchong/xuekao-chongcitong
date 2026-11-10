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

/* 预检：只做「文本形态」类硬伤，答案对错、知识性错误交给审查 AI 判断。
 * 刻意不放宽到「选项短」「有 {}」等正常题也常见的特征，避免误报淹没真问题。 */
function flagsOf(q) {
  const f = [];
  const os = (q.o || []).map(x => String(x[1] == null ? '' : x[1]));
  const all = (q.s || '') + '\n' + os.join('\n');
  if (/【(拔高|基础|提升|拓展|变式|易错|强化|进阶|生成)】/.test(all)) f.push('批次/难度标签');
  if (os.some(s => /下列|下列说法|以下说法|以下哪|错误的是|正确的是|不正确的是/.test(s))) f.push('题干套话混入选项');
  if (os.some(s => /^\s*[A-D][\.、．]\s/.test(s) && !/^[A-Z]:\\/.test(s))) f.push('选项自带字母序号');
  const norm = os.map(s => s.replace(/^\s*[A-D][\.、．]\s*/, '').trim());
  if (norm.length > 1 && new Set(norm).size < norm.length) f.push('选项重复');
  if (os.some(s => /TODO|XX{2,}|下列\?|下列\？/.test(s))) f.push('占位符残留');
  const keys = (q.o || []).map(x => String(x[0]));
  const ans = String(q.a || '').split('');
  if (ans.length && ans.some(k => keys.indexOf(k) < 0)) f.push('答案不在选项中');
  if ((q.qt === '单选' || q.qt === '判断') && ans.length > 1) f.push('单选题多个答案');
  if (q.qt !== '判断' && os.length > 0 && os.length < 3) f.push('选项数异常');
  return f;
}

const items = BANK.map((q, i) => ({
  n: i + 1,
  qid: XK.qidOf(q),
  m: q.m, kd: q.kd || '', qt: q.qt, s: q.s || '',
  o: (q.o || []).map(x => [String(x[0]), String(x[1] == null ? '' : x[1])]),
  a: q.a || '', e: q.e || '', t: q.t || '',
  flags: flagsOf(q)
}));

const flagCounts = {};
items.forEach(x => (x.flags || []).forEach(f => { flagCounts[f] = (flagCounts[f] || 0) + 1; }));
const suspect = items.filter(x => x.flags && x.flags.length).length;

const payload = {
  generated: new Date().toLocaleString('zh-CN', { hour12: false }),
  bank: BANK.length,
  suspect: suspect,
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
  '题 | 预检可疑', suspect, '题 (' + (suspect / BANK.length * 100).toFixed(1) + '%)');
console.log('预检分布:', JSON.stringify(flagCounts));
console.log('提示词字数:', promptText.length, '｜题库真源未改动');
