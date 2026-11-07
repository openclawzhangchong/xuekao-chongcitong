/* qid 迁移专项测试（题干根治 + 学生档案零断链的回归闸门）
 * 跑法：node tests/qid-migrate.test.js */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8'));
const XK = global.window.XK;
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = window.BANK;
const MAP = window.XK_QID_MIGRATE || {};

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
function qidOf(q) { return XK.qidOf(q); }

console.log('== 1. migrateProfileKeys 单元行为 ==');
t('旧键整体搬到新键（记录原样保留）', () => {
  const p = { answers: { 'M1-old': { a: 3, w: 1, k: 0, t: 100 } } };
  XK.migrateProfileKeys({ 'M1-old': 'M1-new' }, p);
  assert.deepStrictEqual(p.answers, { 'M1-new': { a: 3, w: 1, k: 0, t: 100 } });
});
t('新键已有记录 → 逐字段 max 合并（与云端同口径）', () => {
  const p = { answers: { 'M1-old': { a: 5, w: 0, k: 2, t: 200 }, 'M1-new': { a: 2, w: 3, k: 1, t: 300 } } };
  XK.migrateProfileKeys({ 'M1-old': 'M1-new' }, p);
  assert.deepStrictEqual(p.answers, { 'M1-new': { a: 5, w: 3, k: 2, t: 300 } });
});
t('幂等：跑两遍结果一致，不重复累计', () => {
  const p = { answers: { 'M1-old': { a: 3, w: 1, k: 0, t: 100 }, 'M1-new': { a: 1, w: 2, k: 1, t: 90 } } };
  XK.migrateProfileKeys({ 'M1-old': 'M1-new' }, p);
  const once = JSON.stringify(p.answers);
  XK.migrateProfileKeys({ 'M1-old': 'M1-new' }, p);
  assert.strictEqual(JSON.stringify(p.answers), once);
  assert.ok(!('M1-old' in p.answers));
});
t('档案里没有旧键 → 不动任何数据；map 为空 → 原样返回', () => {
  const p = { answers: { 'M9-real': { a: 1, w: 0, k: 1, t: 1 } } };
  const before = JSON.stringify(p);
  XK.migrateProfileKeys({ 'M1-old': 'M1-new' }, p);
  assert.strictEqual(JSON.stringify(p), before);
  XK.migrateProfileKeys(null, p);
  assert.strictEqual(JSON.stringify(p), before);
});

console.log('== 2. validateProfile 自动迁移（读档咽喉） ==');
t('含旧 qid 的档案经 validateProfile 后自动搬到新 qid', () => {
  const oldId = Object.keys(MAP)[0];
  const p = XK.validateProfile({ v: 1, answers: { [oldId]: { a: 2, w: 1, k: 0, t: 555 } }, days: {}, history: [] });
  assert.ok(!p.answers[oldId], '旧键应被搬走');
  assert.ok(p.answers[MAP[oldId]], '新键应存在');
  assert.strictEqual(p.answers[MAP[oldId]].t, 555);
});

console.log('== 3. 真库 + 真映射完整性回归 ==');
t('映射规模：本轮 64 条（47 清洗 + 17 并入）+ 考古链 ≥ 200', () => {
  assert.ok(Object.keys(MAP).length >= 200, '实际 ' + Object.keys(MAP).length);
});
t('映射键全部不在当前库（都是已改名的旧 qid）', () => {
  const cur = new Set(BANK.map(qidOf));
  Object.keys(MAP).forEach((k) => assert.ok(!cur.has(k), '映射键不应在当前库: ' + k));
});
t('映射值全部在当前库（每条旧记录都有新家）', () => {
  const cur = new Set(BANK.map(qidOf));
  Object.keys(MAP).forEach((k) => assert.ok(cur.has(MAP[k]), '映射值不在库: ' + k + ' → ' + MAP[k]));
});
t('映射无链式断链（值不再作为键出现，单遍迁移即到位）', () => {
  const keys = new Set(Object.keys(MAP));
  Object.keys(MAP).forEach((k) => assert.ok(!keys.has(MAP[k]), '链式断链: ' + k + ' → ' + MAP[k]));
});
t('题面残留已根治：cleanStem(s) === s 全库成立', () => {
  BANK.forEach((q) => assert.strictEqual(XK.cleanStem(q.s), q.s, '残留题干: ' + q.m + ' ' + q.s.slice(0, 30)));
});
t('去重后 3982 题：(m|qt|s) 全库唯一', () => {
  assert.strictEqual(BANK.length, 3982);
  const seen = new Set();
  BANK.forEach((q) => {
    const k = q.m + '|' + q.qt + '|' + q.s;
    assert.ok(!seen.has(k), '题面撞库: ' + k.slice(0, 40));
    seen.add(k);
  });
});
t('四零：qid 唯一 / 答案在选项中 / 解析非空', () => {
  const ids = new Set();
  BANK.forEach((q) => {
    const id = qidOf(q);
    assert.ok(!ids.has(id), 'qid 重复: ' + id);
    ids.add(id);
    const ansOk = q.qt === '多选' ? q.a.split('').every((ch) => q.o.some((o) => o[0] === ch)) : q.o.some((o) => o[0] === q.a);
    assert.ok(ansOk, '答案不在选项: ' + id);
    assert.ok(q.e && q.e.trim(), '解析为空: ' + id);
  });
});
t('野外真实学生的 2 个 qid 不受本轮影响（仍在库且不在映射键中）', () => {
  const cur = new Set(BANK.map(qidOf));
  ['M7-3mpb3l', 'M9-c86y0e'].forEach((w) => {
    assert.ok(cur.has(w), '野外 qid 丢失: ' + w);
    assert.ok(!(w in MAP), '野外 qid 不应进入迁移映射: ' + w);
  });
});
t('解析契约：/api/bank 的「行内提取 window.BANK=」在含 MIGRATE 行的新格式下照常工作', () => {
  // 班级版服务.py 与 cloud/worker.js 都按「window.BANK= 所在那一行」截取——
  // data.js 尾部追加 XK_QID_MIGRATE 后若退回「全文最后一个分号」的老写法就会 500。
  const site = fs.readFileSync(path.join(__dirname, '..', 'site', 'data.js'), 'utf8');
  assert.ok(/window\.XK_QID_MIGRATE=/.test(site), 'site/data.js 应含迁移映射');
  const s = site.indexOf('window.BANK=');
  let line = site.slice(s, site.indexOf(String.fromCharCode(10), s)).trim();
  if (line.endsWith(';')) line = line.slice(0, -1);
  const bank = JSON.parse(line.slice('window.BANK='.length));
  assert.strictEqual(bank.length, 3982);
  const s2 = fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8');
  const a = s2.indexOf('window.BANK='), b = s2.indexOf(String.fromCharCode(10), a);
  assert.strictEqual(JSON.parse(s2.slice(a + 12, b).trim().replace(/;$/, '')).length, 3982);
});

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
process.exit(failed ? 1 : 0);
