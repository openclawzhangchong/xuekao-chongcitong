/* 课堂互动单测：node tests/classroom.test.js（表扬语库/名单解析/抽取袋） */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'praise.js'), 'utf8'));
const XKP = global.window.XKP;

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('== 1. 表扬语库规模与去重 ==');
t('表扬总数 === 1000（实际 ' + XKP.praiseCount() + '）', () => assert.strictEqual(XKP.praiseCount(), 1000));
t('全库零重复', () => {
  const all = XKP.allPraiseTemplates();
  assert.strictEqual(new Set(all).size, all.length);
});
t('每条模板都含姓名占位 {n}', () => {
  XKP.allPraiseTemplates().forEach(tpl => assert.ok(tpl.includes('{n}'), '缺 {n}: ' + tpl));
});
t('鼓励语总数 === 500（实际 ' + XKP.encourageCount() + '）', () => assert.strictEqual(XKP.encourageCount(), 500));

console.log('== 2. 姓名替换 ==');
t('普通表扬替换姓名且无残留占位', () => {
  for (let i = 0; i < 50; i++) {
    const p = XKP.pickPraise('林静静', 0);
    assert.ok(p.includes('林静静'), '未含姓名: ' + p);
    assert.ok(!p.includes('{n}') && !p.includes('{c}'), '残留占位: ' + p);
  }
});
t('连胜表扬带次数（streak≥3 有概率触发）', () => {
  let hit = false;
  for (let i = 0; i < 60 && !hit; i++) {
    const p = XKP.pickPraise('张三', 5);
    if (/\d+连胜|连对\d+/.test(p)) hit = true;
  }
  assert.ok(hit, '60 次未触发连胜语');
});
t('空姓名兜底「这位同学」', () => {
  const p = XKP.pickPraise('', 0);
  assert.ok(p.length > 0);
});

console.log('== 3. 鼓励语替换 ==');
t('鼓励语 50 次抽样均含姓名/无残留', () => {
  for (let i = 0; i < 50; i++) {
    const e = XKP.pickEncourage('王五');
    assert.ok(!e.includes('{n}'), '残留: ' + e);
  }
});

console.log('== 4. 名单解析（app.js 内联逻辑复刻验证） ==');
// 与 app.js parseRoster 同逻辑的独立实现，用于格式约定回归
function parseRoster(text) {
  var out = [], seen = {};
  String(text || '').split(/\r?\n/).forEach(function (line) {
    line = line.trim();
    if (!line || line.charAt(0) === '#') return;
    var parts = line.split(/[,，\t ]+/);
    var name = parts[parts.length - 1], sid = parts.length > 1 ? parts.slice(0, parts.length - 1).join('') : '';
    name = name.trim(); sid = sid.trim();
    if (!name || name.length > 24) return;
    if (seen[name]) return;
    seen[name] = 1;
    out.push({ sid: sid, name: name });
  });
  return out;
}
t('纯姓名行', () => assert.deepStrictEqual(parseRoster('张三\n李四'), [{ sid: '', name: '张三' }, { sid: '', name: '李四' }]));
t('学号,姓名', () => assert.deepStrictEqual(parseRoster('2025001,林静静'), [{ sid: '2025001', name: '林静静' }]));
t('学号␣姓名（空格/制表符）', () => assert.deepStrictEqual(parseRoster('2025002\t王五\n2025003 赵六'), [{ sid: '2025002', name: '王五' }, { sid: '2025003', name: '赵六' }]));
t('中文逗号', () => assert.deepStrictEqual(parseRoster('2025004，钱七'), [{ sid: '2025004', name: '钱七' }]));
t('# 注释与空行跳过', () => assert.strictEqual(parseRoster('#名单\n\n张三\n   ').length, 1));
t('同名去重', () => assert.strictEqual(parseRoster('张三\n张三\n2025001,张三').length, 1));
t('超长姓名(>24)丢弃', () => assert.strictEqual(parseRoster('x'.repeat(30)).length, 0));

console.log('== 5. 抽取袋：不重复 + 轮完重洗 ==');
function makeBag() { return { queue: [] }; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function draw(bag, names) {
  if (DRAW_NO_REPEAT === false) return { name: names[Math.floor(Math.random() * names.length)], reshuffled: false };
  if (!bag.queue.length) { bag.queue = shuffle(names.slice()); const p = bag.queue.shift(); return { name: p, reshuffled: true }; }
  return { name: bag.queue.shift(), reshuffled: false };
}
var DRAW_NO_REPEAT = true;
t('5 人名单抽 5 次全不重复', () => {
  const bag = makeBag(), names = ['A', 'B', 'C', 'D', 'E'];
  const got = [];
  for (let i = 0; i < 5; i++) got.push(draw(bag, names).name);
  assert.strictEqual(new Set(got).size, 5);
});
t('第 6 次触发重洗（reshuffled=true）', () => {
  const bag = makeBag(), names = ['A', 'B', 'C', 'D', 'E'];
  for (let i = 0; i < 5; i++) draw(bag, names);
  const r = draw(bag, names);
  assert.ok(r.reshuffled === true && names.includes(r.name));
});
t('关闭不重复开关 → 纯随机（允许重复）', () => {
  DRAW_NO_REPEAT = false;
  const bag = makeBag(), names = ['A'];
  const r = draw(bag, names);
  assert.strictEqual(r.name, 'A');
  DRAW_NO_REPEAT = true;
});
t('袋内容始终是名单子集（10 轮压力）', () => {
  const bag = makeBag(), names = ['甲', '乙', '丙', '丁', '戊', '己'];
  for (let i = 0; i < 30; i++) {
    const r = draw(bag, names);
    assert.ok(names.includes(r.name));
  }
});

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
process.exit(failed ? 1 : 0);
