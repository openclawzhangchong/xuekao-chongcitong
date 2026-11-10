/* 教师删除题目层单测（Node 零依赖，node tests/question-delete.test.js）
 * 覆盖：密码、删除只过滤视图（BANK_ALL 下标绝不错位）、数组引用不断、四档一致、
 *       持久化、恢复、导出/导入、guard 远程题库、修正共存、模拟考不崩、非法输入、UI 契约。
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
const buildTpl = read('src/build.js');
const appJs = read('src/app.js');

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
  return { w: w, mem: mem, QD: w.XK_QDEL, QO: w.XK_QOVER, XK: w.XK, G: w.XK_BANK_GATE };
}

console.log('== 1. 密码与存储契约 ==');
t('教师密码校验通过，错误/空密码拒绝', () => {
  const { QD } = fresh();
  assert.strictEqual(QD.checkPwd('18596950010'), true);
  assert.strictEqual(QD.checkPwd('18596950011'), false);
  assert.strictEqual(QD.checkPwd(''), false);
  assert.strictEqual(QD.checkPwd(null), false);
});
t('源码不含密码明文，删除清单 key 独立于修正清单', () => {
  assert.ok(!/18596950010/.test(qover));
  assert.ok(!/18596950010/.test(buildTpl));
  assert.ok(/xkc\.qdeleted\.v1/.test(qover));
  assert.ok(/xkc\.qoverrides\.v1/.test(qover));
});
t('默认无删除：BANK 1000 / BANK_ALL 3982，且两数组不是同一引用', () => {
  const { w, QD } = fresh();
  assert.strictEqual(QD.count(), 0);
  assert.strictEqual(w.BANK.length, 1000);
  assert.strictEqual(w.BANK_ALL.length, 3982);
  assert.notStrictEqual(w.BANK, w.BANK_ALL);
});

console.log('== 2. 删除只过滤视图，BANK_ALL 下标绝不错位 ==');
t('删除后视图少 1 题，BANK_ALL 长度/首元素/原对象都不变', () => {
  const { w, QD, XK } = fresh();
  const q = w.BANK[0], id = QD.qid(q);
  const len = w.BANK_ALL.length, first = w.BANK_ALL[0], order = w.BANK_ALL.slice(0, 20);
  assert.strictEqual(QD.del(id, { s: q.s, m: q.m }), true);
  assert.strictEqual(w.BANK.length, 999);
  assert.ok(!w.BANK.some(x => XK.qidOf(x) === id), '删除后仍出现在题池');
  assert.strictEqual(w.BANK_ALL.length, len, 'BANK_ALL 长度被破坏');
  assert.strictEqual(w.BANK_ALL[0], first);
  assert.deepStrictEqual(w.BANK_ALL.slice(0, 20), order, 'BANK_ALL 顺序被破坏');
  assert.ok(w.BANK_ALL.some(x => XK.qidOf(x) === id), '原对象被物理删除');
  assert.strictEqual(QD.count(), 1);
  assert.strictEqual(QD.has(id), true);
  assert.strictEqual(XK.qidOf(q), id, '删除不改 qid');
});
t('apply 就地同步数组：删除后 window.BANK 引用不变（app.js 缓存不会失效）', () => {
  const { w, QD } = fresh();
  const ref = w.BANK, id = QD.qid(w.BANK[0]);
  QD.del(id, { s: w.BANK[0].s });
  assert.strictEqual(w.BANK, ref);
  assert.strictEqual(ref.length, 999);
});
t('白名单下标不错位：切到 2000 档仍是按下标取的正确题目（少被删那题）', () => {
  const a = fresh();
  const q = a.w.BANK[0], id = a.QD.qid(q);
  a.QD.del(id, { s: q.s, m: q.m });
  const b = fresh({ mem: a.mem, tier: '2000' });
  assert.strictEqual(b.w.BANK_ALL.length, 3982);
  assert.strictEqual(b.w.BANK.length, 1999);
  const idx = b.w.XK_TIER_INDEX['2000'];
  const expect = idx.map(i => b.w.BANK_ALL[i]).filter(x => b.XK.qidOf(x) !== id);
  assert.deepStrictEqual(
    b.w.BANK.map(x => b.XK.qidOf(x)),
    expect.map(x => b.XK.qidOf(x)),
    '切档后题目与白名单下标不一致'
  );
});
t('1000 / 2000 / 3000 / full 四档都过滤被删题，且全库长度不变', () => {
  const a = fresh();
  const q = a.w.BANK[0], id = a.QD.qid(q);
  a.QD.del(id, { s: q.s, m: q.m });
  [['1000', 999], ['2000', 1999], ['3000', 2999], ['full', 3981]].forEach(([tier, n]) => {
    const b = fresh({ mem: a.mem, tier: tier });
    assert.strictEqual(b.w.BANK.length, n, tier + ' 档题数');
    assert.ok(!b.w.BANK.some(x => b.XK.qidOf(x) === id), tier + ' 档仍出现被删题');
    assert.strictEqual(b.w.BANK_ALL.length, 3982, tier + ' 档全库被破坏');
  });
});

console.log('== 3. 持久化与恢复 ==');
t('删除写入 localStorage，重新加载（刷新页面）仍在', () => {
  const a = fresh();
  const q = a.w.BANK[0], id = a.QD.qid(q);
  a.QD.del(id, { s: q.s, m: q.m });
  assert.ok(a.mem['xkc.qdeleted.v1'].indexOf(id) >= 0);
  const b = fresh({ mem: a.mem });
  assert.strictEqual(b.QD.count(), 1);
  assert.strictEqual(b.w.BANK.length, 999);
  assert.ok(!b.w.BANK.some(x => b.XK.qidOf(x) === id));
  assert.strictEqual(b.w.BANK_ALL.length, 3982);
});
t('恢复后题目回到当前档，BANK_ALL 未变', () => {
  const { w, QD, XK } = fresh();
  const q = w.BANK[0], id = QD.qid(q);
  QD.del(id, { s: q.s });
  assert.strictEqual(w.BANK.length, 999);
  assert.strictEqual(QD.undel(id), true);
  assert.strictEqual(QD.count(), 0);
  assert.strictEqual(w.BANK.length, 1000);
  assert.ok(w.BANK.some(x => XK.qidOf(x) === id));
  assert.strictEqual(w.BANK_ALL.length, 3982);
  assert.strictEqual(QD.undel(id), false, '重复恢复应返回 false');
});
t('导出 → 导入后删除清单完整还原', () => {
  const a = fresh();
  const id = a.QD.qid(a.w.BANK[0]);
  a.QD.del(id, { s: '题干摘要', m: 'M1' });
  const text = a.QD.exportText(), j = JSON.parse(text);
  assert.strictEqual(j.count, 1);
  assert.ok(j.items[id]);
  assert.strictEqual(j.items[id].s, '题干摘要');
  const b = fresh();
  const r = b.QD.importText(text);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.count, 1);
  assert.strictEqual(b.w.BANK.length, 999);
  assert.strictEqual(b.QD.has(id), true);
  assert.strictEqual(b.QD.list()[0].m, 'M1');
});
t('损坏 JSON / 缺 items / 非法 qid 不崩且被过滤', () => {
  const { QD } = fresh();
  assert.strictEqual(QD.importText('not json').ok, false);
  assert.strictEqual(QD.importText('{}').ok, false);
  assert.strictEqual(QD.importText('{"items":{}}').ok, true);
  assert.strictEqual(QD.count(), 0);
  assert.strictEqual(QD.del('', {}), false);
  assert.strictEqual(QD.del('<script>', {}), false);
  const r = QD.importText(JSON.stringify({ items: { 'bad\nid': { s: 'x' }, 'ok-id': { s: 'y', hack: 1 } } }));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.count, 1);
  assert.strictEqual(QD.count(), 1);
  assert.strictEqual(QD.has('ok-id'), true);
  assert.strictEqual(QD.has('bad\nid'), false);
  assert.strictEqual(QD.list()[0].hack, undefined);
});

console.log('== 4. 全站一致性 ==');
t('guard 对远程拉取的题库也应用删除过滤', () => {
  const a = fresh();
  const q = a.w.BANK[0], id = a.QD.qid(q);
  a.QD.del(id, { s: q.s });
  const pos = a.w.BANK_ALL.findIndex(x => a.XK.qidOf(x) === id);
  assert.ok(pos >= 0);
  const remote = JSON.parse(JSON.stringify(a.w.BANK_ALL.slice(Math.max(0, pos - 1), pos + 2)));
  const guarded = a.G.guard(remote);
  assert.strictEqual(guarded.length, remote.length - 1);
  assert.ok(!guarded.some(x => a.XK.qidOf(x) === id));
});
t('先修正题干再删除，qid 仍稳定且恢复后修正仍在', () => {
  const { w, QD, QO, XK } = fresh();
  const q = w.BANK[0], id = QD.qid(q);
  QO.set(id, { s: '【修正】题干' });
  assert.strictEqual(XK.qidOf(q), id);
  QD.del(id, { s: q.s });
  assert.strictEqual(XK.qidOf(q), id, '删除后原 qid 仍不变');
  assert.strictEqual(w.BANK.length, 999);
  QD.undel(id);
  assert.strictEqual(w.BANK.length, 1000);
  const back = w.BANK.filter(x => XK.qidOf(x) === id)[0];
  assert.strictEqual(back.s, '【修正】题干');
});
t('删除若干题后模拟考 150 题组卷不崩，且组卷不含被删题', () => {
  const { w, QD, XK } = fresh({ tier: 'full' });
  for (let i = 0; i < 5; i++) QD.del(QD.qid(w.BANK_ALL[i]), { s: w.BANK_ALL[i].s });
  assert.strictEqual(w.BANK.length, 3977);
  const paper = XK.buildSimPaper(w.BANK, w.BANK_META);
  assert.ok(paper.length > 0 && paper.length <= 150);
  assert.ok(!paper.some(x => QD.has(XK.qidOf(x))));
  assert.strictEqual(w.BANK_ALL.length, 3982);
});
t('题库真源 data.js 未被写入删除标记或 _origQid', () => {
  assert.ok(!/xkc\.qdeleted/.test(data));
  assert.ok(!/_origQid/.test(data));
});

console.log('== 5. UI 契约 ==');
t('答题页有删除按钮、独立密码模态框与恢复清单入口', () => {
  ['delQBtn', 'qdelMask', 'qdelPwd', 'qdelUnlock', 'qdelDo', 'qdelList',
    'qdelExport', 'qdelImportFile', 'qdelClose'].forEach(id => {
      assert.ok(buildTpl.indexOf('id="' + id + '"') >= 0, '模板缺少 ' + id);
    });
  assert.ok(buildTpl.indexOf('id="editQBtn"') < buildTpl.indexOf('id="delQBtn"'));
});
t('每次打开都重置为未解锁，密码走统一校验，删除后同步跳过本次练习', () => {
  assert.ok(appJs.indexOf('QD.q = S.list[S.idx]; QD.unlocked = false') >= 0);
  assert.ok(appJs.indexOf("XK_QOVER.checkPwd($('qdelPwd').value)") >= 0);
  assert.ok(appJs.indexOf('S.list.splice(S.idx, 1)') >= 0);
  assert.ok(appJs.indexOf('S.answers.splice(S.idx, 1)') >= 0);
  assert.ok(appJs.indexOf('qdelRestore') >= 0);
});

console.log('\n结果: ' + passed + ' 通过 / ' + failed + ' 失败');
if (failed) process.exit(1);
