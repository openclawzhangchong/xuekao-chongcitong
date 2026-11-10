/* 教师题目修正层单测（Node 零依赖）
 * 覆盖：密码哈希、修正生效、改题干不改 qid（档案不断链）、恢复原题、
 *       本机持久化、导出/导入、各档位与全库生效、远程题库 guard、非法字段过滤。
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const engine = read('src/engine.js');
const data = read('src/data.js');
const whitelist = read('src/whitelist-data.js');
const gate = read('src/bank-gate.js');
const qover = read('src/question-override.js');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
function fresh(opts) {
  opts = opts || {};
  const w = {};
  global.window = w;
  const mem = Object.assign({}, opts.mem || {});
  if (opts.tier) mem['xkc.bank.tier'] = opts.tier;
  const stub = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; }
  };
  w.localStorage = stub; global.localStorage = stub;
  eval(engine + '\n' + data + '\n' + whitelist + '\n' + gate + '\n' + qover);
  return { w: w, mem: mem, QO: w.XK_QOVER, XK: w.XK };
}
const NEW_S = '【教师修正后】下列关于信息技术说法正确的是（ ）。';
const NEW_O = [['A', '甲选项'], ['B', '乙选项'], ['C', '丙选项'], ['D', '丁选项']];

console.log('== 1. 密码 ==');
t('教师密码校验通过，错误/空密码拒绝', () => {
  const { QO } = fresh();
  assert.strictEqual(QO.checkPwd('18596950010'), true);
  assert.strictEqual(QO.checkPwd('18596950011'), false);
  assert.strictEqual(QO.checkPwd(''), false);
  assert.strictEqual(QO.checkPwd(null), false);
});
t('源码里不含密码明文（只放哈希常量）', () => {
  assert.ok(!/18596950010/.test(qover));
  assert.ok(/PWD_HASH/.test(qover));
});

console.log('== 2. 修正生效与 qid 稳定 ==');
t('默认无修正，题目挂上原 qid，默认档仍是 1000 题', () => {
  const { w, QO } = fresh();
  assert.strictEqual(QO.count(), 0);
  assert.strictEqual(w.BANK.length, 1000);
  assert.ok(w.BANK[0]._origQid);
  assert.strictEqual(w.XK.qidOf(w.BANK[0]), w.BANK[0]._origQid);
});
t('修正题干/选项/答案/解析后立即生效，且 qid 一字不变', () => {
  const { w, QO, XK } = fresh();
  const q = w.BANK[0], id = QO.qid(q), oldS = q.s, oldA = q.a;
  assert.ok(QO.set(id, { s: NEW_S, o: NEW_O, a: 'B', e: '新解析' }));
  assert.strictEqual(q.s, NEW_S);
  assert.strictEqual(q.a, 'B');
  assert.strictEqual(q.o[1][1], '乙选项');
  assert.strictEqual(q.e, '新解析');
  assert.strictEqual(XK.qidOf(q), id, '改题干后 qid 必须不变');
  assert.strictEqual(q._origQid, id);
  assert.strictEqual(QO.count(), 1);
  assert.notStrictEqual(oldS, NEW_S);
  assert.notStrictEqual(oldA, 'B');
});
t('判分按修正后的答案走', () => {
  const { w, QO, XK } = fresh();
  const q = w.BANK[0];
  QO.set(QO.qid(q), { s: NEW_S, o: NEW_O, a: 'B' });
  assert.strictEqual(XK.judge(q, ['B']), true);
  assert.strictEqual(XK.judge(q, ['A']), false);
});
t('恢复原题后字段与 qid 都回到初始状态', () => {
  const { w, QO, XK } = fresh();
  const q = w.BANK[0], id = QO.qid(q), oldS = q.s, oldA = q.a, oldOpts = JSON.stringify(q.o);
  QO.set(id, { s: NEW_S, o: NEW_O, a: 'B' });
  assert.ok(QO.remove(id));
  assert.strictEqual(q.s, oldS);
  assert.strictEqual(q.a, oldA);
  assert.strictEqual(JSON.stringify(q.o), oldOpts);
  assert.strictEqual(XK.qidOf(q), id);
  assert.strictEqual(QO.count(), 0);
});
t('重复 set / refresh 幂等，不会叠加题干', () => {
  const { w, QO } = fresh();
  const id = QO.qid(w.BANK[0]);
  QO.set(id, { s: NEW_S });
  QO.set(id, { s: NEW_S });
  QO.refresh(); QO.refresh();
  assert.strictEqual(w.BANK[0].s, NEW_S);
  assert.strictEqual(QO.count(), 1);
});

console.log('== 3. 持久化与迁移 ==');
t('修正写入 localStorage，重新加载（刷新页面）仍在', () => {
  const a = fresh();
  const id = a.QO.qid(a.w.BANK[0]);
  a.QO.set(id, { s: NEW_S, o: NEW_O, a: 'C', e: '持久化解析' });
  assert.ok(a.mem['xkc.qoverrides.v1'].indexOf(id) >= 0);
  const b = fresh({ mem: a.mem });
  assert.strictEqual(b.QO.count(), 1);
  assert.strictEqual(b.w.BANK[0].s, NEW_S);
  assert.strictEqual(b.w.BANK[0].a, 'C');
  assert.strictEqual(b.w.XK.qidOf(b.w.BANK[0]), id);
});
t('导出 → 导入后修正完整还原', () => {
  const a = fresh();
  const id = a.QO.qid(a.w.BANK[0]);
  a.QO.set(id, { s: NEW_S, o: NEW_O, a: 'D' });
  const text = a.QO.exportText();
  const j = JSON.parse(text);
  assert.strictEqual(j.count, 1);
  assert.ok(j.items[id]);
  const b = fresh();
  const r = b.QO.importText(text);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.count, 1);
  assert.strictEqual(b.w.BANK[0].s, NEW_S);
  assert.strictEqual(b.w.BANK[0].a, 'D');
});
t('损坏 JSON / 缺 items / 非法字段不崩且被过滤', () => {
  const { QO } = fresh();
  assert.strictEqual(QO.importText('not json').ok, false);
  assert.strictEqual(QO.importText('{}').ok, false);
  assert.strictEqual(QO.importText('{"items":{}}').ok, true);
  assert.strictEqual(QO.count(), 0);
  const id = 'M1-test';
  assert.ok(QO.importText(JSON.stringify({ items: { [id]: { s: 'x', a: 'A', hack: 1, o: 'bad' } } })).ok);
  const p = QO.get(id);
  assert.ok(p && p.s === 'x' && p.a === 'A');
  assert.strictEqual(p.hack, undefined);
  assert.strictEqual(p.o, undefined);
});

console.log('== 4. 全站一致性 ==');
t('全库档与 2000/3000 档都能看到同一条修正', () => {
  const a = fresh();
  const id = a.QO.qid(a.w.BANK[0]);
  a.QO.set(id, { s: NEW_S, a: 'B' });
  ['2000', '3000', 'full'].forEach(tier => {
    const b = fresh({ mem: a.mem, tier: tier });
    const q = b.w.BANK.filter(x => b.w.XK.qidOf(x) === id)[0];
    assert.ok(q, tier + ' 档找不到该题');
    assert.strictEqual(q.s, NEW_S, tier + ' 档题干未修正');
    assert.strictEqual(q.a, 'B');
  });
});
t('BANK_ALL 里的原对象同步修正（PK/擂台/备课夹共享引用）', () => {
  const { w, QO } = fresh();
  const q = w.BANK[0], id = QO.qid(q);
  QO.set(id, { s: NEW_S });
  const all = w.BANK_ALL.filter(x => w.XK.qidOf(x) === id)[0];
  assert.ok(all && all.s === NEW_S);
});
t('guard 对远程拉取的题库也应用修正', () => {
  const a = fresh();
  const id = a.QO.qid(a.w.BANK[0]);
  a.QO.set(id, { s: NEW_S, a: 'B' });
  const remote = JSON.parse(JSON.stringify(a.w.BANK.slice(0, 3))); // 含被修正的当前档第 1 题
  const guarded = a.w.XK_BANK_GATE.guard(remote);
  assert.strictEqual(guarded[0].s, NEW_S);
  assert.strictEqual(guarded[0].a, 'B');
  assert.strictEqual(a.w.XK.qidOf(guarded[0]), id);
});
t('题库真源 JSON 未被写入任何修正', () => {
  assert.ok(data.indexOf(NEW_S) === -1);
  assert.ok(!/_origQid/.test(data));
});

console.log('\n结果: ' + passed + ' 通过 / ' + failed + ' 失败');
if (failed) process.exit(1);
