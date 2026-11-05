/* 学考冲刺通 · 引擎单元测试（Node 零依赖，node tests/engine.test.js 直接跑） */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8'));
const XK = global.window.XK;

// 载入真实题库（window.BANK 形式）
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = window.BANK;
const META = window.BANK_META;

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('== 1. 答案规范化与判分 ==');
t('单选规范化: 小写b → B', () => assert.strictEqual(XK.normalizeAns('b'), 'B'));
t('多选排序: cbd/DBC/BCD 全部归一为 BCD', () => {
  assert.strictEqual(XK.normalizeAns('cbd'), 'BCD');
  assert.strictEqual(XK.normalizeAns('DBC'), 'BCD');
  assert.strictEqual(XK.normalizeAns('BCD'), 'BCD');
});
t('判断题保留原样: √ / ×', () => {
  assert.strictEqual(XK.normalizeAns('√'), '√');
  assert.strictEqual(XK.normalizeAns('×'), '×');
});
t('judge: 单选答对/答错', () => {
  const q = { a: 'A' };
  assert.ok(XK.judge(q, ['A']));
  assert.ok(!XK.judge(q, ['B']));
});
t('judge: 多选乱序算对、漏选算错', () => {
  const q = { a: 'BCD' };
  assert.ok(XK.judge(q, ['D', 'C', 'B']));
  assert.ok(!XK.judge(q, ['B', 'C']));
  assert.ok(!XK.judge(q, []));
});
t('judge: 判断题', () => {
  const q = { a: '×' };
  assert.ok(XK.judge(q, ['×']));
  assert.ok(!XK.judge(q, ['√']));
});
t('judge: 空作答不算对', () => assert.ok(!XK.judge({ a: 'A' }, null)));

console.log('== 2. 题目 ID 稳定性与唯一性 ==');
t('同题两次计算 ID 一致', () => {
  assert.strictEqual(XK.qidOf(BANK[0]), XK.qidOf(BANK[0]));
});
t('全库 1238 题 ID 零冲突', () => {
  const ids = new Set();
  BANK.forEach(q => ids.add(XK.qidOf(q)));
  assert.strictEqual(ids.size, BANK.length);
});
t('题干不变 → ID 不变（重建题库不漂移）', () => {
  const q = { m: 'M1', qt: '单选', s: '信息技术的英文缩写是（ ）。' };
  const q2 = JSON.parse(JSON.stringify(q));
  assert.strictEqual(XK.qidOf(q), XK.qidOf(q2));
});

console.log('== 3. 错题本：进本 / 重练 / 连对2次毕业 ==');
t('首次答错 → 进错题本；连对1次仍在；连对2次毕业', () => {
  const p = XK.newProfile();
  const q = BANK[0];
  XK.recordAnswer(p, q, false);
  assert.strictEqual(XK.wrongQueue(BANK, p).length, 1, '答错应在错题本');
  XK.recordAnswer(p, q, true);
  assert.strictEqual(XK.wrongQueue(BANK, p).length, 1, '连对1次还没毕业');
  XK.recordAnswer(p, q, true);
  assert.strictEqual(XK.wrongQueue(BANK, p).length, 0, '连对2次应毕业');
  assert.strictEqual(XK.graduatedCount(BANK, p), 1);
});
t('毕业后又答错 → 重新回到错题本', () => {
  const p = XK.newProfile();
  const q = BANK[0];
  XK.recordAnswer(p, q, false);
  XK.recordAnswer(p, q, true);
  XK.recordAnswer(p, q, true);
  XK.recordAnswer(p, q, false);
  assert.strictEqual(XK.wrongQueue(BANK, p).length, 1);
});
t('只答对从不进错题本', () => {
  const p = XK.newProfile();
  XK.recordAnswer(p, BANK[1], true);
  assert.strictEqual(XK.wrongQueue(BANK, p).length, 0);
});

console.log('== 4. 打卡 ==');
t('连续3天打卡 → streak=3；今天没刷从昨天起算', () => {
  const d = XK.todayStr();
  const y = XK.todayStr(Date.now() - 86400000);
  const y2 = XK.todayStr(Date.now() - 2 * 86400000);
  const p = XK.newProfile();
  p.days[y] = 5; p.days[y2] = 3;
  assert.strictEqual(XK.streakDays(p.days), 2, '今天未刷，按昨天止');
  p.days[d] = 1;
  assert.strictEqual(XK.streakDays(p.days), 3, '补上今天');
});
t('断档清零', () => {
  const p = XK.newProfile();
  p.days[XK.todayStr(Date.now() - 3 * 86400000)] = 1;
  assert.strictEqual(XK.streakDays(p.days), 0);
});

console.log('== 5. 预估学考分（150 分制对账） ==');
t('空档案 → 0 分 0 覆盖', () => {
  const e = XK.estimateScore(BANK, META, XK.newProfile());
  assert.strictEqual(e.score, 0);
  assert.strictEqual(e.tested, 0);
  assert.strictEqual(e.total, 150);
});
t('M1 答对答错各一半(20对10错) → 模块acc=2/3 → 贡献 15×2/3=10.0', () => {
  const p = XK.newProfile();
  const m1 = BANK.filter(q => q.m === 'M1');
  for (let i = 0; i < 20; i++) XK.recordAnswer(p, m1[i], true);
  for (let i = 20; i < 30; i++) XK.recordAnswer(p, m1[i], false);
  const e = XK.estimateScore(BANK, META, p);
  const m1s = e.per.find(s => s.code === 'M1');
  assert.strictEqual(m1s.n, 30);
  assert.ok(Math.abs(m1s.acc - 2 / 3) < 1e-9, 'acc=' + m1s.acc);
  assert.ok(Math.abs(e.score - 10) < 1e-9, 'score=' + e.score);
  assert.strictEqual(e.tested, 15);
});
t('全部刷完全对 → 150 分满分', () => {
  const p = XK.newProfile();
  BANK.forEach(q => XK.recordAnswer(p, q, true));
  const e = XK.estimateScore(BANK, META, p);
  assert.ok(Math.abs(e.score - 150) < 1e-9, 'score=' + e.score);
  assert.strictEqual(e.tested, 150);
});

console.log('== 6. 考点诊断与弱项特训 ==');
t('刷过某考点全错 → 该考点进入 weak 列表', () => {
  const p = XK.newProfile();
  const target = BANK.find(q => q.m === 'M1');
  for (let i = 0; i < 5; i++) XK.recordAnswer(p, BANK.filter(q => q.kd === target.kd)[i], false);
  const w = XK.weakSpots(BANK, META, p, 8);
  assert.ok(w.weak.length >= 1);
  assert.strictEqual(w.weak[0].acc, 0);
  assert.ok(w.unknownCount > 0, '应有未探明考点');
});
t('正确率≥0.7 的考点不判弱', () => {
  const p = XK.newProfile();
  const kd = BANK[3].kd;
  const qs = BANK.filter(q => q.kd === kd);
  for (let i = 0; i < Math.min(4, qs.length); i++) XK.recordAnswer(p, qs[i], i < 3); // 3对1错=0.75
  const w = XK.weakSpots(BANK, META, p, 50);
  assert.ok(!w.weak.some(s => s.kd === kd && s.n === 4), '0.75 不应在弱项列表');
});
t('弱项特训：有错题时优先返回错题', () => {
  const p = XK.newProfile();
  const q = BANK[0];
  XK.recordAnswer(p, q, false);
  const set = XK.weakTraining(BANK, META, p, 20);
  assert.ok(set.some(x => XK.qidOf(x) === XK.qidOf(q)));
});
t('弱项特训组卷无重复且不超过 n', () => {
  const p = XK.newProfile();
  for (let i = 0; i < 60; i++) XK.recordAnswer(p, BANK[i], i % 2 === 0);
  const set = XK.weakTraining(BANK, META, p, 30);
  const ids = new Set(set.map(q => XK.qidOf(q)));
  assert.strictEqual(ids.size, set.length);
  assert.ok(set.length <= 30);
});

console.log('== 7. 模拟卷（150 分制组卷） ==');
t('默认卷：150 题，各模块题数=考纲分值', () => {
  const paper = XK.buildSimPaper(BANK, META);
  assert.strictEqual(paper.length, 150);
  const cnt = {};
  paper.forEach(q => cnt[q.m] = (cnt[q.m] || 0) + 1);
  META.forEach(m => assert.strictEqual(cnt[m.code], m.score, m.code + ' 应抽 ' + m.score + ' 题'));
});
t('半卷 scale=0.5 → 75 题', () => {
  assert.strictEqual(XK.buildSimPaper(BANK, META, { scale: 0.5 }).length, 75);
});
t('卷内题目无重复', () => {
  const paper = XK.buildSimPaper(BANK, META);
  const ids = new Set(paper.map(q => XK.qidOf(q)));
  assert.strictEqual(ids.size, paper.length);
});

console.log('== 8. 档案导入校验（防脏数据） ==');
t('合法档案往返一致', () => {
  const p = XK.newProfile();
  XK.recordAnswer(p, BANK[0], false);
  XK.recordAnswer(p, BANK[1], true);
  p.history.push({ t: Date.now(), score: 88.5, tested: 90, mode: 'sim' });
  const p2 = XK.validateProfile(JSON.parse(JSON.stringify(p)));
  assert.strictEqual(p2.answers[XK.qidOf(BANK[0])].w, 1);
  assert.strictEqual(p2.history[0].score, 88.5);
});
t('脏数据：负数/超界/非法键 全部清洗', () => {
  const dirty = {
    answers: { 'M1-x': { a: -5, w: 99999, k: 7 }, 'y!': { a: 0, w: 0 }, z: 'garbage' },
    days: { '2026-11-01': 3, 'bad-date': 5, '2026-13-99': 100 },
    history: [{ score: 999 }, null, { score: 'abc' }, { score: 60, tested: 70, mode: 'sim' }],
    created: 'x'
  };
  const p = XK.validateProfile(dirty);
  assert.strictEqual(p.answers['M1-x'].a, 0);
  assert.strictEqual(p.answers['M1-x'].w, 999);
  assert.strictEqual(p.answers['M1-x'].k, 2);
  assert.ok(!p.answers['y!'], '全零记录应丢弃');
  assert.ok(!p.answers['z']);
  assert.strictEqual(p.days['2026-11-01'], 3);
  assert.ok(!p.days['bad-date'] && !p.days['2026-13-99']);
  assert.strictEqual(p.history.length, 2, 'null与非法分数剔除，超界的钳制保留');
  assert.strictEqual(p.history[0].score, 150, '超界分数应钳到150');
  assert.strictEqual(p.history[1].score, 60);
  assert.ok(p.created > 0, 'created 非法时兜底为当前时间');
});
t('null/非对象输入 → 返回 null 表示拒绝导入（不抛异常）', () => {
  assert.strictEqual(XK.validateProfile(null), null);
  assert.strictEqual(XK.validateProfile('haha'), null);
  assert.strictEqual(XK.validateProfile(42), null);
});

console.log('== 9. 真实题库结构回归 ==');
t('题库 3714 题 / 9 模块 / 必填字段完整（解析/类比/提醒允许空串）', () => {
  assert.strictEqual(BANK.length, 3714); // 原 1238 + 变式 2476
  assert.strictEqual(META.length, 9);
  BANK.forEach(q => {
    ['m', 'kd', 'qt', 's', 'o', 'a'].forEach(k => assert.ok(q[k], '缺必填字段 ' + k));
    ['e', 'an', 't'].forEach(k => assert.ok(typeof q[k] === 'string' || q[k] == null, '字段类型异常 ' + k));
    assert.ok(q.o.length >= 2);
  });
});
t('模块总分合计 150', () => {
  assert.strictEqual(META.reduce((x, m) => x + m.score, 0), 150);
});
t('META 声明题数与实际一致', () => {
  META.forEach(m => {
    const n = BANK.filter(q => q.m === m.code).length;
    assert.strictEqual(n, m.n, m.code + ' META.n=' + m.n + ' 实际=' + n);
  });
});

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
process.exit(failed ? 1 : 0);
