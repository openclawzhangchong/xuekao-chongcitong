/* PK 选人回归测试：node tests/pk-pick.test.js
 * 钉住「下拉能选中学生姓名」这条行为（DOM 桩见 tests/dom-stub.js）。
 * 覆盖两类历史缺陷：change 后重建下拉把选择抹掉；无编号学生因 value='' 消失。
 */
'use strict';
const assert = require('assert');
const { mount, fire, choose, sampleRoster } = require('./dom-stub');

let passed = 0, failed = 0;
const fails = [];
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; fails.push(name + ' → ' + e.message); console.log('  ✗ ' + name + '\n    ' + e.message); }
}

const DEFAULT36 = sampleRoster(36);

console.log('== 1. 下拉填充 ==');
t('默认班级 36 人进入左下拉（占位符 + 36）', () => {
  const p = mount({ roster: DEFAULT36 });
  assert.strictEqual(p.$('pkSelL').options.length, 37);
});
t('无编号学生（sid 为空）也必须出现在下拉里', () => {
  const p = mount({ roster: [{ sid: '', name: '王五' }, { sid: '', name: '赵六' }, { sid: '2025001', name: '陈博杰' }] });
  const texts = p.$('pkSelL').options.map((o) => o.textContent).join('|');
  assert.ok(texts.includes('王五'), '王五 不在下拉：' + texts);
  assert.ok(texts.includes('赵六'), '赵六 不在下拉：' + texts);
});

console.log('== 2. 选中之后不能被打回占位符（核心缺陷）==');
t('左下拉选中后 value 保持不变', () => {
  const p = mount({ roster: DEFAULT36 });
  const L = p.$('pkSelL');
  const want = L.options[13].value;
  assert.ok(want, '选项 value 为空，无法选中');
  L.value = want;
  fire(L, 'change');
  assert.strictEqual(L.value, want, 'change 后选择被抹掉，value 变成 ' + JSON.stringify(L.value));
});
t('左下拉选中后显示的是姓名而不是「— 选择选手 —」', () => {
  const p = mount({ roster: DEFAULT36 });
  const L = p.$('pkSelL');
  const name = L.options[13].textContent;
  L.value = L.options[13].value;
  fire(L, 'change');
  assert.strictEqual(L.textContent, name, '显示回退为：' + L.textContent);
});
t('右下拉同样能保持选中', () => {
  const p = mount({ roster: DEFAULT36 });
  const R = p.$('pkSelR');
  const want = R.options[5].value;
  R.value = want;
  fire(R, 'change');
  assert.strictEqual(R.value, want, '右下拉 change 后被抹掉');
});
t('无编号学生可选中（value 不得等于占位符空串）', () => {
  const p = mount({ roster: [{ sid: '', name: '王五' }, { sid: '', name: '赵六' }] });
  const L = p.$('pkSelL');
  const at = L.options.findIndex((o) => o.textContent.includes('王五'));
  assert.ok(at > 0, '王五 不在列表中');
  assert.ok(L.options[at].value !== '', '王五 的 option value 是空串，选中等于没选');
  L.value = L.options[at].value;
  fire(L, 'change');
  assert.strictEqual(L.value, L.options[at].value, '王五 选中后被打回');
});

console.log('== 3. 左右互斥 ==');
t('左已选的人不出现在右下拉', () => {
  const p = mount({ roster: DEFAULT36 });
  const L = p.$('pkSelL'), R = p.$('pkSelR');
  choose(L, L.options[3].textContent);
  const picked = L.textContent;
  const rTexts = R.options.map((o) => o.textContent);
  assert.ok(!rTexts.includes(picked), '右下拉仍可重复选到 ' + picked);
  assert.strictEqual(R.options.length, 36, '右下拉应少 1 人，实际 ' + R.options.length);
});
t('选右不会把左清空', () => {
  const p = mount({ roster: DEFAULT36 });
  const L = p.$('pkSelL'), R = p.$('pkSelR');
  choose(L, L.options[3].textContent);
  const lWant = L.value;
  choose(R, R.options[1].textContent);
  assert.strictEqual(L.value, lWant, '选右之后左被清空');
});

console.log('== 4. 选人后能开赛 ==');
t('选好两人点「开始 PK」→ 分屏出现、面板显示两侧姓名', () => {
  const p = mount({ roster: DEFAULT36 });
  const L = p.$('pkSelL'), R = p.$('pkSelR');
  choose(L, L.options[2].textContent);
  choose(R, R.options[2].textContent);
  const lName = L.textContent.split(' · ').pop(), rName = R.textContent.split(' · ').pop();
  assert.notStrictEqual(lName, rName, '用例前提不成立：两侧选到了同一个人');
  p.$('btnStart').onclick();
  assert.ok(!p.$('pkArena').classList.contains('hidden'), '分屏仍隐藏，PK 没开始');
  assert.ok(p.$('LName').textContent.includes(lName), '左面板姓名错：' + p.$('LName').textContent);
  assert.ok(p.$('rName').textContent.includes(rName), '右面板姓名错：' + p.$('rName').textContent);
});
t('没选人点「开始 PK」→ 分屏保持隐藏并提示', () => {
  const p = mount({ roster: DEFAULT36 });
  p.$('btnStart').onclick();
  assert.ok(p.$('pkArena').classList.contains('hidden'), '未选人也能开赛');
  assert.ok(p.$('pkToast').textContent.includes('选手'), '提示文案缺失：' + p.$('pkToast').textContent);
});
t('花名册为空时挂载不抛异常，下拉只剩占位符', () => {
  const p = mount({ roster: [] });
  assert.strictEqual(p.$('pkSelL').options.length, 1);
});

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
if (failed) console.log('\n未通过清单:\n  ' + fails.join('\n  '));
process.exit(failed ? 1 : 0);
