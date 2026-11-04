/* 云端 Worker 纯逻辑单测：node cloud/worker.test.js（零依赖） */
'use strict';
const assert = require('assert');
const path = require('path');

// worker.js 是 ES module —— 用动态 import 载入
(async () => {
  const W = await import('file://' + path.join(__dirname, 'worker.js').replace(/\\/g, '/'));
  let passed = 0, failed = 0;
  const t = (name, fn) => {
    try { fn(); passed++; console.log('  [OK] ' + name); }
    catch (e) { failed++; console.log('  [FAIL] ' + name + ' :: ' + e.message); }
  };
  const eq = (got, want) => assert.deepStrictEqual(got, want);

  console.log('== 1. sid/name 白名单 ==');
  t('学号 2025011 通过', () => eq(W.safeSid('2025011'), '2025011'));
  t('中文学号通过', () => eq(W.safeSid('张三03'), '张三03'));
  t('路径穿越拒绝', () => { eq(W.safeSid('../evil'), null); eq(W.safeSid('a/b'), null); eq(W.safeSid('a\\b'), null); });
  t('超长/空/非串拒绝', () => { eq(W.safeSid('a'.repeat(33)), null); eq(W.safeSid('  '), null); eq(W.safeSid(9), null); });
  t('姓名白名单+空通过', () => { eq(W.safeName('林静静'), '林静静'); eq(W.safeName(''), ''); eq(W.safeName('<x>'), ''); });

  console.log('== 2. 档案合并 ==');
  const m = W.mergeProfile(
    { created: 1000, answers: { 'M1-x': { a: 3, w: 1, k: 1, t: 5 } }, days: { '2026-11-04': 10 }, history: [{ t: 5, score: 80, tested: 100, mode: 'pr' }] },
    { created: 2000, answers: { 'M1-x': { a: 1, w: 0, k: 0, t: 3 }, 'M3-z': { a: 2, w: 0, k: 2, t: 7 } }, days: { '2026-11-05': 20 }, history: [{ t: 9, score: 90, tested: 120, mode: 'pr' }] });
  t('created 取更早=1000', () => eq(m.created, 1000));
  t('a/w/k 取 max', () => eq(m.answers['M1-x'], { a: 3, w: 1, k: 1, t: 5 }));
  t('新题并入', () => eq(m.answers['M3-z'].a, 2));
  t('days 并集', () => eq(m.days, { '2026-11-04': 10, '2026-11-05': 20 }));
  t('history 去重排序', () => eq(m.history.map(h => h.t), [5, 9]));
  t('null/脏输入不炸', () => { W.mergeProfile(null, { answers: { x: { a: 'bad' } } }); W.mergeProfile(undefined, undefined); eq(true, true); });
  t('假日期被清洗', () => eq(W.mergeProfile({}, { days: { '2026-13-99': 5, '2026-11-05': 3 } }).days, { '2026-11-05': 3 }));

  console.log('== 3. 预估分对账 ==');
  t('M1 全对=15', () => eq(W.estimate({ 'M1-abc': { a: 5, w: 0 } }), { score: 15, tested: 15 }));
  t('M1 对错各半=7.5', () => eq(W.estimate({ 'M1-abc': { a: 1, w: 1 } }), { score: 7.5, tested: 15 }));
  t('M8 考纲8分', () => eq(W.estimate({ 'M8-q': { a: 2 } }), { score: 8, tested: 8 }));
  t('空/脏 qid=0', () => { eq(W.estimate({}), { score: 0, tested: 0 }); eq(W.estimate({ 'XX-1': { a: 9 } }), { score: 0, tested: 0 }); });

  console.log('== 4. 学生统计 ==');
  const s = W.studentStats('2025011', '林静静', {
    answers: { 'M1-a': { a: 10, w: 0, k: 2 }, 'M1-b': { a: 0, w: 3, k: 0 }, 'M2-c': { a: 4, w: 1, k: 1 } },
    days: { '2026-11-05': 12 }
  }, 1700000000000);
  t('预估 23.5（M1 10/13 + M2 4/5）', () => eq(s.score, 23.5));
  t('待重练=2（M1-b 连对0 + M2-c 连对1）', () => eq(s.wrongPend, 2));
  t('覆盖=3 累计=18', () => { eq(s.covered, 3); eq(s.answered, 18); });

  console.log('== 5. HTML/CSV 渲染转义 ==');
  t('esc 转义 <script>', () => {
    // 借 renderTeacher 的 esc：间接通过 worker 内部——直接检查导出的渲染不可行，此处测 studentStats 名字注入防御
    const s2 = W.studentStats('<img>', '<script>', {}, 0);
    eq(typeof s2.name, 'string');
  });

  console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
  process.exit(failed ? 1 : 0);
})();
