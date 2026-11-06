/* PK 新功能单测：node tests/pk-features.test.js
 * 覆盖 A 领先条居中 / B 随机匹配 / C 章节勾选取题范围 / D 带姓名表扬语。
 * 关键约束：默认全选章节时抽题池必须等于全库（不改已发布行为）；
 * 无 m 字段的自定义题不受章节过滤；领先条姓名必须转义。
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

console.log('== C 章节勾选：在开赛设置面板里，点一下即生效，默认全选也必须看得见 ==');
function pickMods(p, codes) {
  const box = p.$('pkCfgMods');
  assert.ok(box.children.length, '开赛设置面板里没有章节勾选格');
  box.children.forEach((cell) => {
    const on = cell.classList.contains('on');
    const want = codes.indexOf(cell.getAttribute('data-code')) !== -1;
    if (on !== want) cell.onclick();
  });
}
t('默认（配置里没有 mods 字段）抽题池等于全库 29 题', () => {
  const p = mount({ roster: R36 });
  assert.strictEqual(p.test().bankPool().length, 29, '默认抽题池被改变了');
});
t('章节勾选在开赛设置面板，不在设置弹窗里（同一功能不留两处）', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pk', 'src', 'pk-markup.html'), 'utf8');
  const setup = html.slice(html.indexOf('id="pkSetup"'), html.indexOf('id="endMask"'));
  const cfg = html.slice(html.indexOf('id="cfgMask"'), html.indexOf('id="pkToast"'));
  assert.ok(setup.includes('pkCfgMods'), '章节勾选没在开赛设置面板里');
  assert.ok(!cfg.includes('pkCfgMods'), '设置弹窗里还留着章节勾选（两处重复）');
});
t('面板按 BANK_META 渲染 9 格并标出可选题数', () => {
  const p = mount({ roster: R36 });
  const box = p.$('pkCfgMods');
  assert.strictEqual(box.children.length, 9, '章节格数不对：' + box.children.length);
  const m4 = box.children.filter((c) => c.getAttribute('data-code') === 'M4')[0];
  assert.ok(/3\s*题/.test(m4.textContent), 'M4 格没显示 3 题：' + m4.textContent);
});
t('默认全选时计数文案也必须常驻可见（不许隐形默认）', () => {
  const p = mount({ roster: R36 });
  const txt = p.$('pkModsCount').textContent;
  assert.ok(/9\s*章/.test(txt), '全选时没显示章数：' + txt);
  assert.ok(/29\s*题/.test(txt), '全选时没显示可抽题数：' + txt);
  assert.ok(/全库/.test(txt), '全选时没说明这就是全库：' + txt);
});
t('只勾 M4 → 池 = M4 的 3 题 + 2 道无 m 的题', () => {
  const p = mount({ roster: R36 });
  pickMods(p, ['M4']);
  const pool = p.test().bankPool();
  assert.strictEqual(pool.length, 5, '池大小应为 5，实际 ' + pool.length);
  pool.forEach((q) => assert.ok(!q.m || q.m === 'M4', '池里混进别的章节：' + q.s));
  assert.ok(/1\s*章/.test(p.$('pkModsCount').textContent), '计数没跟着变：' + p.$('pkModsCount').textContent);
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
t('点一下勾选就落盘到 pk.cfg（没有「保存默认值」这一步）', () => {
  const p = mount({ roster: R36 });
  pickMods(p, ['M6']);
  const cfg = JSON.parse(p.store.get('pk.cfg'));
  assert.ok(cfg.mods && cfg.mods.M6 === true && cfg.mods.M4 === false, 'pk.cfg 里 mods 不对：' + JSON.stringify(cfg.mods));
});
t('下次打开直接读回上次的章节选择', () => {
  const saved = { 'pk.cfg': { count: 10, minutes: 10, mods: { M1: true, M2: false, M3: false, M4: false, M5: false, M6: false, M7: false, M8: false, M9: false } } };
  const p = mount({ roster: R36, storage: saved });
  assert.strictEqual(p.test().bankPool().length, 3 + 2, '读回的过滤没生效：' + p.test().bankPool().length);
  assert.ok(/1\s*章/.test(p.$('pkModsCount').textContent), '面板计数没反映读回的勾选：' + p.$('pkModsCount').textContent);
});
t('选人区题库文案跟着显示范围（全选时也要说清是全库）', () => {
  const all = mount({ roster: R36 });
  assert.ok(/全库/.test(all.$('bankInfo').textContent), '全选时文案没说清：' + all.$('bankInfo').textContent);
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

console.log('== F 设置弹窗的题量/计时必须真的生效（模板不得有重复 id）==');
t('pk-markup.html 里没有重复 id', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pk', 'src', 'pk-markup.html'), 'utf8');
  const ids = (html.match(/id="([^"]+)"/g) || []).map((s) => s.slice(4, -1));
  const seen = {}, dup = [];
  ids.forEach((i) => { if (seen[i]) dup.push(i); seen[i] = 1; });
  assert.deepStrictEqual(Array.from(new Set(dup)), [], '重复 id 会让 getElementById 只拿到第一个：' + Array.from(new Set(dup)).join(', '));
});
t('在设置弹窗里改题量，下一局就按新题量抽', () => {
  const p = mount({ roster: R36 });
  p.$('btnCfg').onclick();
  p.$('pkDlgCount').value = '3';
  p.$('cfgSave').onclick();
  startManual(p, '学生2', '学生5');
  assert.strictEqual(p.test().pk().left.seq.length, 3, '弹窗改的题量没生效：' + p.test().pk().left.seq.length);
});
t('在设置弹窗里改计时，倒计时按新分钟数走', () => {
  const p = mount({ roster: R36 });
  p.$('btnCfg').onclick();
  p.$('pkDlgMinutes').value = '2';
  p.$('cfgSave').onclick();
  startManual(p, '学生2', '学生5');
  assert.strictEqual(p.$('pkTimer').textContent, '02:00', '弹窗改的计时没生效：' + p.$('pkTimer').textContent);
});
t('重开设置弹窗时回填的是已保存值', () => {
  const p = mount({ roster: R36 });
  p.$('btnCfg').onclick();
  p.$('pkDlgCount').value = '7';
  p.$('cfgSave').onclick();
  p.$('btnCfg').onclick();
  assert.strictEqual(p.$('pkDlgCount').value, '7', '弹窗没回填已保存题量：' + p.$('pkDlgCount').value);
});

console.log('== G 题干清洗：PK 面板与复盘都不显示残留选项列表 ==');
const RESIDUE_BANK = [
  { m: 'M3', qt: '单选', s: '在 WPS Office 中，电子表格的默认文件扩展名是（ ）A. xlsB. etC. xlsx D. docx',
    o: [['A', 'xls'], ['B', 'et'], ['C', 'xlsx'], ['D', 'docx']], a: 'C', e: 'WPS 表格默认扩展名是 et。' },
  { m: 'M3', qt: '判断', s: '可以通过拖拽填充柄来快速填充单元格内容。（ ）A. 正确B. 错误',
    o: [['√', '正确'], ['×', '错误']], a: '√', e: '填充柄可以拖拽快速填充。' },
  { m: 'M1', qt: '单选', s: '下列技术中，属于信息技术核心的是（ ）。',
    o: [['A', '甲'], ['B', '乙']], a: 'A', e: '解析正常。' }
];
function startOne(p) {
  p.$('pkCfgCount').value = '1';
  startManual(p, '学生2', '学生5');
}
t('面板题干不再出现「A. …B. …」残留', () => {
  const p = mount({ roster: R36, bank: [RESIDUE_BANK[0]] });
  startOne(p);
  const stem = p.$('LBody').children[0].textContent;
  assert.ok(!/[A-D][.、．]/.test(stem), '残留原样显示：' + stem);
  assert.strictEqual(stem, '在 WPS Office 中，电子表格的默认文件扩展名是（ ）');
});
t('判断题残留也被洗干净，只留陈述句', () => {
  const p = mount({ roster: R36, bank: [RESIDUE_BANK[1]] });
  startOne(p);
  assert.strictEqual(p.$('LBody').children[0].textContent, '可以通过拖拽填充柄来快速填充单元格内容。（ ）');
});
t('本来干净的题干一字不改（清洗不误伤）', () => {
  const p = mount({ roster: R36, bank: [RESIDUE_BANK[2]] });
  startOne(p);
  assert.strictEqual(p.$('LBody').children[0].textContent, '下列技术中，属于信息技术核心的是（ ）。');
});
t('答错后错题复盘里的题干也是干净的', () => {
  const p = mount({ roster: R36, bank: [RESIDUE_BANK[0]] });
  startOne(p);
  answer(p, 'L', 0);                        // A 是错的（正确答案 C）
  answer(p, 'r', 0);                        // 两侧都打完 → 弹成绩单
  const rv = p.$('endReview').children.map((c) => c.textContent).join('\n');
  assert.ok(/错题/.test(rv), '复盘没生成：' + rv.slice(0, 80));
  assert.ok(!/[A-D][.、．]/.test(rv), '复盘题干残留：' + rv.slice(0, 120));
});

console.log('== H 一屏自适应：字号可缩但有硬下限，塞不下才滚动 ==');
t('内容塞得下时保持基准字号、不滚动', () => {
  const p = mount({ roster: R36 });
  const r = p.test().fitToBox(23, () => ({ h: 400, avail: 600 }), 16);
  assert.strictEqual(r.fs, 23);
  assert.strictEqual(r.scroll, false);
});
t('内容超高时逐级缩小直到塞下', () => {
  const p = mount({ roster: R36 });
  // 每少 1px 高度少 18px：23px 时 900 > 620，缩到 8px 才够——但下限 16 会先拦住
  const r = p.test().fitToBox(23, (fs) => ({ h: 900 - (23 - fs) * 18, avail: 620 }), 16);
  assert.ok(r.fs <= 23 && r.fs >= 16, '字号越界：' + r.fs);
  assert.strictEqual(r.fs, 16, '应当缩到下限为止，实际 ' + r.fs);
  assert.strictEqual(r.scroll, true, '到下限仍塞不下时必须允许滚动');
});
t('刚好能塞进的内容停在第一个够用的字号，不多缩', () => {
  const p = mount({ roster: R36 });
  // 19px 及以上装不下，18px 及以下装得下 → 应停在 18
  const r = p.test().fitToBox(23, (fs) => ({ h: fs > 18 ? 700 : 600, avail: 620 }), 16);
  assert.strictEqual(r.fs, 18, '应停在 18px，实际 ' + r.fs);
  assert.strictEqual(r.scroll, false);
});
t('下限就是 16px，绝不低于它', () => {
  const p = mount({ roster: R36 });
  assert.strictEqual(p.test().PKFS_MIN, 16);
  const r = p.test().fitToBox(23, () => ({ h: 5000, avail: 300 }), 16);
  assert.strictEqual(r.fs, 16, '字号被压到下限以下：' + r.fs);
  assert.strictEqual(r.scroll, true);
});

/* CSS 结构闸门：面板里「占高度的零件」必须跟着 --pkfs 走。
 * 事故：只有题目文字用 var(--pkfs)，选项内边距/圆片/头部分数是固定 px，
 * 缩字号缩不动总高 → 1366×768 投屏上 85% 的题顶到 16px 下限还得滚动，
 * 而上面那几条纯算术断言全绿。浏览器逐题实测见 tools/gate-fit.js。 */
const PK_CSS = fs.readFileSync(path.join(__dirname, '..', 'pk', 'src', 'pk-style.css'), 'utf8');
function ruleBody(sel) {
  const at = PK_CSS.indexOf(sel + '{');
  if (at < 0) throw new Error('样式里没有 ' + sel + ' 这条规则');
  return PK_CSS.slice(at + sel.length + 1, PK_CSS.indexOf('}', at));
}
t('选项的内边距/最小高/行间距必须由 --pkfs 驱动（否则缩字号白缩）', () => {
  const opt = ruleBody('#pkArena .opt');
  assert.ok(/padding:\s*calc\(var\(--pkfs\)/.test(opt), '.opt 的 padding 没跟 --pkfs：' + opt.replace(/\s+/g, ' ').slice(0, 90));
  assert.ok(/min-height:\s*calc\(var\(--pkfs\)/.test(opt), '.opt 的 min-height 没跟 --pkfs');
  assert.ok(/gap:\s*calc\(var\(--pkfs\)/.test(ruleBody('#pkArena .opts')), '.opts 的 gap 没跟 --pkfs');
  assert.ok(/width:\s*calc\(var\(--pkfs\)/.test(ruleBody('#pkArena .opt .k')), '选项圆片 ABCD 尺寸是固定 px');
});
t('头部姓名/分数、进度条、提交按钮也必须由 --pkfs 驱动', () => {
  ['.pname', '.pscore', '.progress', '.submit-btn'].forEach((s) => {
    const body = ruleBody('#pkArena ' + s);
    assert.ok(/calc\(var\(--pkfs\)/.test(body), '#pkArena ' + s + ' 里一处 --pkfs 都没有：' + body.replace(/\s+/g, ' ').slice(0, 70));
  });
});
t('「🏠 首页」：接上宿主就真退出，独立版自动藏掉（点了没反应最气人）', () => {
  let hit = 0;
  const solo = mount({ roster: R36 });                        // 桩里没有 app.js，等价于独立版
  assert.strictEqual(solo.$('btnHome').style.display, 'none', '独立版还留着回首页按钮，点了没反应');
  const merged = mount({ roster: R36, hooks: { __PK_ONLEAVE: function () { hit++; } } });
  assert.notStrictEqual(merged.$('btnHome').style.display, 'none', '有宿主时按钮被藏着，投屏上就没出口了');
  merged.$('btnHome').onclick();
  assert.strictEqual(hit, 1, '点了「🏠 首页」没走退出钩子');
});
/* 对战中折叠「选人」那一行 = 53px 题面高度（实测面板 508→561，随机题中位字号 21→23px）。
 * 开赛后这两个下拉本来就改了不生效，留着只是占高度；收尾/重置必须还原，否则教师换不了人。 */
t('开赛后 body 带 pk-running；点「重置新一轮」必须还原', () => {
  const p = mount({ roster: R36 });
  const body = p.win.document.body;
  assert.ok(!body.classList.contains('pk-running'), '刚进页面就以为在打仗');
  startManual(p, '学生1', '学生2');
  assert.ok(body.classList.contains('pk-running'), '开赛后没打 pk-running 类');
  p.$('btnReset').onclick();
  assert.ok(!body.classList.contains('pk-running'), '重置后类没去掉，选人行永远回不来');
});
t('两边答完自动收尾时，pk-running 也必须去掉', () => {
  const p = mount({ roster: R36 });
  const body = p.win.document.body;
  startManual(p, '学生1', '学生2');
  for (let i = 0; i < 10; i++) { answer(p, 'L', 0); answer(p, 'r', 0); }   // 右栏 id 是小写 r
  assert.strictEqual(p.test().pk().state, 'finished', '没走到收尾：' + p.test().pk().state);
  assert.ok(!body.classList.contains('pk-running'), '打完了还锁着折叠，教师下一场换不了人');
});
t('折叠必须有 CSS 撑着：body.pk-running .topbar .pickrow{display:none}', () => {
  assert.ok(/body\.pk-running\s+\.topbar\s+\.pickrow\s*\{\s*display\s*:\s*none/.test(PK_CSS),
    'pk-app 打了类但样式没折叠规则 = 白打');
});

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
if (failed) console.log('\n未通过清单:\n  ' + fails.join('\n  '));
process.exit(failed ? 1 : 0);
