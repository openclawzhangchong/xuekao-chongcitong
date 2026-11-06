/* PK 新功能单测：node tests/pk-features.test.js
 * 覆盖 A 领先条居中 / B 随机匹配 / C 章节勾选取题范围 / D 带姓名表扬语。
 * 关键约束：默认全选章节时抽题池必须等于全库（不改已发布行为）；
 * 无 m 字段的自定义题不受章节过滤；领先条姓名必须转义。
 */
'use strict';
const assert = require('assert');
const { mount, choose, answer, sampleBank, sampleRoster, fakeXKP } = require('./dom-stub');

let passed = 0, failed = 0;
const fails = [];
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; fails.push(name + ' → ' + e.message); console.log('  ✗ ' + name + '\n    ' + e.message); }
}

const R36 = sampleRoster(36);

/* 开好一局：随机匹配或手动选人后点开始 */
function startManual(p, leftText, rightText) {
  choose(p.$('pkSelL'), leftText);
  choose(p.$('pkSelR'), rightText);
  p.$('btnStart').onclick();
}

console.log('== A 领先条：居中一行 + 姓名转义 ==');
t('答对一题后领先条含领先者姓名与比分', () => {
  const p = mount({ roster: R36 });
  startManual(p, '学生2', '学生5');
  answer(p, 'L', 0);
  const html = p.$('pkLeadTag').innerHTML;
  assert.ok(/学生2/.test(html), '领先条没有领先者姓名：' + JSON.stringify(html));
  assert.ok(/1[:：]0/.test(html), '领先条没有比分 1:0：' + JSON.stringify(html));
});
t('领先条姓名走 HTML 转义（花名册是教师输入的数据）', () => {
  const roster = [{ sid: 'a1', name: '<img src=x onerror=alert(1)>' }, { sid: 'a2', name: '正常同学' }];
  const p = mount({ roster });
  startManual(p, 'img', '正常同学');
  answer(p, 'L', 0);
  const html = p.$('pkLeadTag').innerHTML;
  assert.ok(!/<(img|onerror)/i.test(html), '领先条把姓名当 HTML 插进去了：' + html);
  assert.ok(html.includes('&lt;img'), '姓名未转义成 &lt;img：' + html);
});
t('比分相同走平局样式（tie）', () => {
  const p = mount({ roster: R36 });
  startManual(p, '学生2', '学生5');
  const cls = p.$('pkLeadTag').className;
  assert.ok(/tie/.test(cls), '平局未加 tie 样式：' + cls);
  assert.ok(/平局/.test(p.$('pkLeadTag').innerHTML + p.$('pkLeadTag').textContent), '平局文案缺失');
});

console.log('== B 随机匹配：只填名字 + 播报，不自动开赛 ==');
t('点「🎲 随机匹配」左右各填上一名不同学生', () => {
  const p = mount({ roster: R36 });
  p.$('btnRand').onclick();
  const L = p.$('pkSelL'), R = p.$('pkSelR');
  assert.ok(L.value !== '', '左下拉没填上');
  assert.ok(R.value !== '', '右下拉没填上');
  assert.notStrictEqual(L.value, R.value, '左右填到了同一个人');
  assert.ok(L.textContent !== R.textContent, '左右显示同名：' + L.textContent);
});
t('随机匹配不自动开赛（分屏仍隐藏，等教师点开始）', () => {
  const p = mount({ roster: R36 });
  p.$('btnRand').onclick();
  assert.ok(p.$('pkArena').classList.contains('hidden'), '随机匹配直接把 PK 开起来了');
  assert.strictEqual(p.test().pk().state, 'idle', 'state 应为 idle，实际 ' + p.test().pk().state);
});
t('随机匹配播报两名学生姓名', () => {
  const p = mount({ roster: R36, speech: true });
  p.$('btnRand').onclick();
  const L = p.$('pkSelL').textContent.split(' · ').pop();
  const R = p.$('pkSelR').textContent.split(' · ').pop();
  const line = p.spoke.join('\n');
  assert.ok(line.includes(L) && line.includes(R), '播报缺姓名 [' + L + ',' + R + ']：' + line);
});
t('随机匹配后教师点开始能正常开赛', () => {
  const p = mount({ roster: R36 });
  p.$('btnRand').onclick();
  const L = p.$('pkSelL').textContent.split(' · ').pop();
  const R = p.$('pkSelR').textContent.split(' · ').pop();
  p.$('btnStart').onclick();
  assert.ok(!p.$('pkArena').classList.contains('hidden'), '随机匹配后开不了赛');
  assert.ok(p.$('LName').textContent.includes(L), '左面板姓名不符：' + p.$('LName').textContent);
  assert.ok(p.$('rName').textContent.includes(R), '右面板姓名不符：' + p.$('rName').textContent);
});
t('连点 20 次随机匹配，每次左右都不是同一人', () => {
  const p = mount({ roster: R36 });
  for (let i = 0; i < 20; i++) {
    p.$('btnRand').onclick();
    assert.notStrictEqual(p.$('pkSelL').value, p.$('pkSelR').value, '第 ' + (i + 1) + ' 次抽到同一人');
    assert.ok(p.$('pkSelL').value !== '' && p.$('pkSelR').value !== '', '第 ' + (i + 1) + ' 次没填满两侧');
  }
});
t('名单只有 1 人时给出提示且不填人', () => {
  const p = mount({ roster: [{ sid: 'x', name: '独苗' }] });
  p.$('btnRand').onclick();
  assert.strictEqual(p.$('pkSelL').value, '', '单人名单也被填上了');
  assert.ok(p.$('pkToast').textContent.includes('至少'), '提示文案缺失：' + p.$('pkToast').textContent);
});
t('名单为空时点随机匹配不抛异常', () => {
  const p = mount({ roster: [] });
  p.$('btnRand').onclick();
  assert.strictEqual(p.$('pkSelL').value, '');
});

console.log('== C 章节勾选：默认=全库，过滤只影响抽题池 ==');
function pickMods(p, codes) {
  p.$('btnCfg').onclick();
  const box = p.$('pkCfgMods');
  assert.ok(box.children.length, '设置弹窗里没有章节勾选格');
  box.children.forEach((cell) => {
    const on = cell.classList.contains('on');
    const want = codes.indexOf(cell.getAttribute('data-code')) !== -1;
    if (on !== want) cell.onclick();
  });
  p.$('cfgSave').onclick();
}
t('默认（配置里没有 mods 字段）抽题池等于全库 29 题', () => {
  const p = mount({ roster: R36 });
  assert.strictEqual(p.test().bankPool().length, 29, '默认抽题池被改变了');
});
t('设置弹窗按 BANK_META 渲染 9 格并标出可选题数', () => {
  const p = mount({ roster: R36 });
  p.$('btnCfg').onclick();
  const box = p.$('pkCfgMods');
  assert.strictEqual(box.children.length, 9, '章节格数不对：' + box.children.length);
  const m4 = box.children.filter((c) => c.getAttribute('data-code') === 'M4')[0];
  assert.ok(/3\s*题/.test(m4.textContent), 'M4 格没显示 3 题：' + m4.textContent);
});
t('只勾 M4 → 池 = M4 的 3 题 + 2 道无 m 的题', () => {
  const p = mount({ roster: R36 });
  pickMods(p, ['M4']);
  const pool = p.test().bankPool();
  assert.strictEqual(pool.length, 5, '池大小应为 5，实际 ' + pool.length);
  pool.forEach((q) => assert.ok(!q.m || q.m === 'M4', '池里混进别的章节：' + q.s));
});
t('教师粘贴的无 m 字段自定义题不受章节过滤影响', () => {
  const bank = [{ qt: '单选', s: '自定义 1', o: [['A', '甲']], a: 'A', e: 'x' }, { qt: '单选', s: '自定义 2', o: [['A', '甲']], a: 'A', e: 'x' }];
  const p = mount({ roster: R36, bank, meta: [] });
  pickMods(p, ['M4']);
  assert.strictEqual(p.test().bankPool().length, 2, '无章节标记的自定义题被过滤掉了');
});
t('题量 10 大于池 5 → 钳到 5 题并提示', () => {
  const p = mount({ roster: R36 });
  p.$('pkCfgCount').value = '10';
  pickMods(p, ['M4']);
  startManual(p, '学生2', '学生5');
  assert.ok(!p.$('pkArena').classList.contains('hidden'), '钳制后没能开赛');
  assert.strictEqual(p.test().pk().left.seq.length, 5, '实际抽到的题数不是 5：' + p.test().pk().left.seq.length);
  assert.ok(/不足|只有/.test(p.$('pkToast').textContent), '没有告知题量被钳制：' + p.$('pkToast').textContent);
});
t('全部取消勾选且题库全带章节 → 池为 0 时拒绝开赛', () => {
  const bank = sampleBank().filter((q) => q.m);
  const p = mount({ roster: R36, bank });
  pickMods(p, []);
  assert.strictEqual(p.test().bankPool().length, 0);
  startManual(p, '学生2', '学生5');
  assert.ok(p.$('pkArena').classList.contains('hidden'), '池为 0 也开赛了');
  assert.ok(/章节/.test(p.$('pkToast').textContent), '提示没提到章节：' + p.$('pkToast').textContent);
});
t('保存默认值把勾选写进 pk.cfg', () => {
  const p = mount({ roster: R36 });
  pickMods(p, ['M6']);
  const cfg = JSON.parse(p.store.get('pk.cfg'));
  assert.ok(cfg.mods && cfg.mods.M6 === true && cfg.mods.M4 === false, 'pk.cfg 里 mods 不对：' + JSON.stringify(cfg.mods));
});
t('下次打开直接读回上次的章节选择', () => {
  const saved = { 'pk.cfg': { count: 10, minutes: 10, mods: { M1: true, M2: false, M3: false, M4: false, M5: false, M6: false, M7: false, M8: false, M9: false } } };
  const p = mount({ roster: R36, storage: saved });
  assert.strictEqual(p.test().bankPool().length, 3 + 2, '读回的过滤没生效：' + p.test().bankPool().length);
});
t('选人区题库文案显示已选章节与可选题数', () => {
  const p = mount({ roster: R36 });
  pickMods(p, ['M4']);
  const info = p.$('bankInfo').textContent;
  assert.ok(/1\s*章/.test(info) && /5\s*题/.test(info), '文案缺少「1 章 / 5 题」：' + info);
});

console.log('== E 抽题：必须真随机、且落在池内（钉住「每局都做题库前 N 题」缺陷）==');
t('连续 6 局的首题不是同一道（旧代码恒等于题库第 1 题）', () => {
  const firsts = [];
  for (let i = 0; i < 6; i++) {
    const p = mount({ roster: R36 });
    startManual(p, '学生2', '学生5');
    firsts.push(p.test().pk().left.seq[0].s);
  }
  assert.ok(new Set(firsts).size > 1, '6 局首题完全相同：' + firsts[0]);
});
t('一局的 10 道题全部来自抽题池，且不等于题库前 10 题', () => {
  const p = mount({ roster: R36 });
  startManual(p, '学生2', '学生5');
  const seq = p.test().pk().left.seq;
  const pool = p.test().bankPool();
  assert.strictEqual(seq.length, 10, '抽到的题数不对：' + seq.length);
  seq.forEach((q) => assert.ok(pool.indexOf(q) !== -1, '抽到了池外的题：' + q.s));
  const head = p.bank.slice(0, 10).map((q) => q.s).join('|');
  assert.notStrictEqual(seq.map((q) => q.s).join('|'), head, '仍在按题库顺序出题');
});
t('左右两侧同一批题、各自乱序', () => {
  const p = mount({ roster: R36 });
  startManual(p, '学生2', '学生5');
  const PK = p.test().pk();
  const ls = PK.left.seq.map((q) => q.s).sort().join('|');
  const rs = PK.right.seq.map((q) => q.s).sort().join('|');
  assert.strictEqual(ls, rs, '两侧题目集合不同');
  assert.notStrictEqual(PK.left.seq.map((q) => q.s).join('|'), PK.right.seq.map((q) => q.s).join('|'), '两侧顺序完全一样，没乱序');
});
t('只勾 M4 时，整轮题目全部属于 M4 或无章节标记', () => {
  const p = mount({ roster: R36 });
  p.$('pkCfgCount').value = '10';
  pickMods(p, ['M4']);
  startManual(p, '学生2', '学生5');
  p.test().pk().left.seq.forEach((q) => assert.ok(!q.m || q.m === 'M4', '抽到别的章节：' + q.s));
});
t('面板渲染的题目就在本题序列里（seq 与界面一致）', () => {
  const p = mount({ roster: R36 });
  startManual(p, '学生2', '学生5');
  const shown = p.$('LBody').children[0].textContent;
  assert.strictEqual(shown, p.test().pk().left.seq[0].s, '界面首题与抽题结果不符：' + shown);
});
t('本轮进行中点随机匹配不换人', () => {
  const p = mount({ roster: R36 });
  startManual(p, '学生2', '学生5');
  const l = p.$('pkSelL').value;
  p.$('btnRand').onclick();
  assert.strictEqual(p.$('pkSelL').value, l, '比赛中被换人了');
  assert.ok(/重置/.test(p.$('pkToast').textContent), '提示缺失：' + p.$('pkToast').textContent);
});

console.log('== D 答对/答错播报带姓名表扬语 ==');
t('答对播报用的是含姓名的表扬语', () => {
  const p = mount({ roster: R36, speech: true, xkp: fakeXKP() });
  startManual(p, '学生2', '学生5');
  answer(p, 'L', 0);
  const line = p.spoke.join('\n');
  assert.ok(/学生2/.test(line) && /思路很清晰/.test(line), '答对播报不是带姓名表扬语：' + line);
});
t('答错播报用的是含姓名的鼓励语', () => {
  const p = mount({ roster: R36, speech: true, xkp: fakeXKP() });
  startManual(p, '学生2', '学生5');
  answer(p, 'L', 1);
  const line = p.spoke.join('\n');
  assert.ok(/学生2/.test(line) && /再想想/.test(line), '答错播报不是带姓名鼓励语：' + line);
});
t('连击时走连胜表扬语', () => {
  const p = mount({ roster: R36, speech: true, xkp: fakeXKP() });
  startManual(p, '学生2', '学生5');
  for (let i = 0; i < 3; i++) answer(p, 'L', 0);
  const line = p.spoke.join('\n');
  assert.ok(/连对 3 题|连胜/.test(line), '3 连击没触发连胜表扬语：' + line);
});

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
if (failed) console.log('\n未通过清单:\n  ' + fails.join('\n  '));
process.exit(failed ? 1 : 0);
