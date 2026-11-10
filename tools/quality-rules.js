/* 题库质检规则【单一真源】：R1~R8 三态判定
 * ---------------------------------------------------------------------
 * 所有质检工具（quality-gate.js / build-review.js / 未来的构建闸门）
 * 必须 require 本文件，禁止各自复制正则——规则一漂移，结论就会互相打架。
 * 纯函数、无副作用、只读题目对象，不修改任何题库数据。
 */
'use strict';

const TAG_HEAD = /^【(拔高|基础|提升|拓展|变式|易错|强化|进阶|生成)】/;
const TAG_ANY = /【(拔高|基础|提升|拓展|变式|易错|强化|进阶|生成)】/;
const CLICHE = /下列|下列说法|以下说法|以下哪/;
const TRUSTED = /习题册_终版|习题册|福州抽测|综合模拟卷|复习手册·例题|章节测试卷/;
const TEMPLATE = /^(下列[^，。]{0,24}(?:中|里)?[，,][^。]{0,28}?的是)(.+?)。?$/;

const RULES = {
  R1: '选项文本以批次/难度标签开头（串台铁证）',
  R2: '选项混入「下列/下列说法」等题干套话',
  R3: '题干含批次/难度标签（只洗标签，不删题）',
  R4: '去掉字母前缀后选项重复',
  R5: '答案字符不在选项字母集合里',
  R6: '单选/判断题却有多个答案',
  R7: 'src 属于正式资料来源（仅降低复核优先级，不豁免结构规则）',
  R8: '四选项共享同一「下列…的是X」前缀，剥离后与库内已有题重复（删除零损失）',
  R9: '解析给出的结论答案（因此/故/所以/答案/应选 X）与 a 字段矛盾，数据不可信'
};

/* 从解析里提取 AI 给出的结论答案：「因此选X」「故选X」「答案是X」「应选X」等。
 * 只认这些明确措辞，避免把「不选B」「选A则…」误当成结论。 */
function saidAnswer(e) {
  const s = String(e || '');
  const re = /(?:因此|故|所以)\s*(?:应|答案是|正确答案是)?\s*选\s*([A-D])|答案\s*(?:应|是|为)?\s*选?\s*([A-D])|应\s*选\s*([A-D])|正确答案\s*(?:是|为)\s*([A-D])/g;
  let m, last = null;
  while ((m = re.exec(s))) last = (m[1] || m[2] || m[3] || m[4] || '').toUpperCase();
  return last;
}

function optText(q) { return (q.o || []).map(x => String(x[1] == null ? '' : x[1]).trim()); }
function optKey(q) { return optText(q).slice().sort().join('|'); }

/* R8：四个选项共享同一模板前缀，剥离后互不相同 → 可清洗救回 */
function cleanable(q) {
  const os = optText(q);
  if (os.length < 3) return null;
  const m = os.map(s => s.match(TEMPLATE));
  if (m.some(x => !x) || new Set(m.map(x => x[1])).size !== 1) return null;
  const vals = m.map(x => x[2].trim());
  if (vals.some(v => !v) || new Set(vals).size !== vals.length) return null;
  return { prefix: m[0][1], values: vals };
}

/* ctx（可选）: { qid, byOpts } —— byOpts 为「选项集合 -> qid 数组」索引，用于 R8 重复检测 */
function classify(q, ctx) {
  ctx = ctx || {};
  const os = optText(q), keys = (q.o || []).map(x => String(x[0]));
  const ans = String(q.a || '').split('');
  const qid = ctx.qid || '';
  const hits = [];

  if (os.some(s => TAG_HEAD.test(s))) hits.push('R1');
  if (q.qt !== '判断' && os.length > 1 &&
      new Set(os.map(s => s.replace(/^\s*[A-D][\.、．]\s*/, ''))).size !== os.length) hits.push('R4');
  if (ans.length && ans.some(k => keys.indexOf(k) < 0)) hits.push('R5');
  if ((q.qt === '单选' || q.qt === '判断') && ans.length > 1) hits.push('R6');
  // R9：解析明确写「因此选X」但 a 不是 X —— 解析与答案自相矛盾，数据整体不可信
  if (q.qt === '单选') {
    const said = saidAnswer(q.e);
    if (said && String(q.a || '').toUpperCase() !== said) hits.push('R9');
  }

  const cliche = os.some(s => CLICHE.test(s));
  const clean = cliche ? cleanable(q) : null;
  let dup = false;
  if (clean && ctx.byOpts) {
    const k = clean.values.slice().sort().join('|');
    dup = (ctx.byOpts[k] || []).some(id => id !== qid);
  }

  const structural = hits.slice();
  if (cliche && !clean) structural.push('R2');
  if (structural.length) return { state: 'DELETE', rules: structural, reason: '结构性损坏', clean: null, dup: false };
  if (clean && dup) return { state: 'DELETE', rules: ['R8'], reason: '清洗后与库内已有正常题选项完全相同，删除零知识点损失', clean: clean, dup: true };
  if (clean) return { state: 'CLEAN', rules: ['R2'], reason: '剥离选项模板前缀后可用（需去重）', clean: clean, dup: false };
  if (TAG_ANY.test(q.s || '')) return { state: 'CLEAN', rules: ['R3'], reason: '题干含批次/难度标签，仅洗标签、不删题', clean: null, dup: false };
  return { state: 'KEEP', rules: [], reason: '', clean: null, dup: false };
}

function isTrusted(q) { return TRUSTED.test(String(q.src || '')); }

module.exports = { classify, cleanable, optText, optKey, isTrusted, saidAnswer, RULES };
