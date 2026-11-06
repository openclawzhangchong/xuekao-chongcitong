/* 擂台赛单测：node tests/arena.test.js
 * 两组职责：
 *   A 防混淆闸门 —— 证明擂台赛不可能被看成双人 PK（id/配色/图标/主操作位置/存档隔离）
 *   B 状态机 —— 争擂、守擂、平局判擂主、第一场平局加赛、候选袋不重复、满场结算
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { mountArena, sampleRoster } = require('./dom-stub');

let passed = 0, failed = 0;
const fails = [];
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; fails.push(name + ' → ' + e.message); console.log('  ✗ ' + name + '\n    ' + e.message); }
}

const R36 = sampleRoster(36);
const PK_MARKUP = fs.readFileSync(path.join(__dirname, '..', 'pk', 'src', 'pk-markup.html'), 'utf8');
const AR_MARKUP = fs.readFileSync(path.join(__dirname, '..', 'pk', 'src', 'arena-markup.html'), 'utf8');
const AR_CSS = fs.readFileSync(path.join(__dirname, '..', 'pk', 'src', 'arena-style.css'), 'utf8');
const BUILD = fs.readFileSync(path.join(__dirname, '..', 'src', 'build.js'), 'utf8');
const idsOf = (s) => (s.match(/id="([^"]+)"/g) || []).map((x) => x.slice(4, -1));

/* 打完一场：champRight/chalRight 决定两侧对错 */
function play(p, a, b, champRight, chalRight) {
  const T = p.test();
  if (a === undefined) T.select(0); else if (b === undefined) T.select(a); else T.select(a, b);
  p.$('arGo').onclick();
  const c = T.answerAll('champ', champRight);
  const r = T.answerAll('chal', chalRight);
  T.endRound();
  return { c, r };
}

console.log('== A 防混淆闸门：擂台赛不能被看成双人 PK ==');
t('A1 两套 markup 的 id 交集为空', () => {
  const pk = idsOf(PK_MARKUP), ar = idsOf(AR_MARKUP);
  const inter = pk.filter((i) => ar.indexOf(i) !== -1);
  assert.deepStrictEqual(inter, [], '两边共用了 id：' + inter.join(', '));
});
t('A2 擂台 markup 内部无重复 id', () => {
  const ar = idsOf(AR_MARKUP);
  const dup = ar.filter((v, i) => ar.indexOf(v) !== i);
  assert.deepStrictEqual(Array.from(new Set(dup)), [], '重复 id：' + dup.join(', '));
});
t('A3 擂台样式不用双人 PK 的蓝红变量', () => {
  assert.ok(!/var\(--l[-)]|var\(--r[-)]/.test(AR_CSS), 'arena-style.css 里出现了 --l/--r');
  assert.ok((AR_CSS.match(/--ar-/g) || []).length >= 20, '擂台变量用得太少：' + (AR_CSS.match(/--ar-/g) || []).length);
});
t('A4 两个入口图标不同（⚔️ vs 🥊）', () => {
  assert.ok(/id="entCardPk"[\s\S]{0,120}⚔️/.test(BUILD), '双人 PK 入口图标变了');
  assert.ok(/id="entCardArena"[\s\S]{0,120}🥊/.test(BUILD), '擂台入口图标不是 🥊');
});
t('A5 主操作位置不同：PK 在顶部按钮行，擂台在底部区', () => {
  const pkTop = PK_MARKUP.slice(PK_MARKUP.indexOf('class="toprow"'), PK_MARKUP.indexOf('class="scorebar"'));
  assert.ok(pkTop.includes('id="btnStart"'), '双人 PK 的开始按钮不在顶部行');
  const arBottom = AR_MARKUP.slice(AR_MARKUP.indexOf('class="ar-bottom"'));
  assert.ok(arBottom.includes('id="arGo"'), '擂台的开始按钮不在底部区');
  assert.ok(!AR_MARKUP.slice(0, AR_MARKUP.indexOf('class="ar-bottom"')).includes('id="arGo"'), '擂台按钮跑回顶部了');
});
t('A6 打完三场擂台，双人 PK 的存档一个字节都没被写', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);
  play(p, undefined, undefined, false, true);
  play(p, undefined, undefined, true, false);
  assert.strictEqual(p.store.get('pk.cfg'), undefined, '擂台写了 pk.cfg');
  assert.strictEqual(p.store.get('pk.matches'), undefined, '擂台写了 pk.matches');
  assert.strictEqual(p.store.get('pk.roster'), JSON.stringify(R36), '擂台写了 pk.roster');
  assert.ok(p.store.get('pk.arena.v1'), '擂台没写自己的战绩');
});
/* CSS 结构闸门：席位里「占高度的零件」必须跟着 --arfs 走。
 * 双人 PK 踩过一次（只有题目文字用变量，选项内边距/头部分数固定 px），
 * 结果 1366×768 投屏上 85% 的题顶到 16px 下限还要滚动，纯算术断言却全绿。
 * 浏览器逐题实测见 tools/gate-fit.js。 */
function arRule(sel) {
  const at = AR_CSS.indexOf(sel + '{');
  if (at < 0) throw new Error('样式里没有 ' + sel + ' 这条规则');
  return AR_CSS.slice(at + sel.length + 1, AR_CSS.indexOf('}', at));
}
t('A7 席位内所有占高度的零件都由 --arfs 驱动（缩字号必须真的能缩下高度）', () => {
  const opt = arRule('.ar-opt');
  assert.ok(/padding:\s*calc\(var\(--arfs\)/.test(opt), '.ar-opt 的 padding 是固定 px：' + opt.replace(/\s+/g, ' ').slice(0, 90));
  assert.ok(/min-height:\s*calc\(var\(--arfs\)/.test(opt), '.ar-opt 的 min-height 是固定 px');
  ['.ar-seat', '.ar-head', '.ar-name', '.ar-score', '.ar-opts', '.ar-opt .k', '.ar-submit'].forEach((s) => {
    assert.ok(/calc\(var\(--arfs\)/.test(arRule(s)), s + ' 里一处 --arfs 都没有');
  });
});

console.log('== B 状态机 ==');
t('B1 第一场要选满 2 人才能开赛', () => {
  const p = mountArena({ roster: R36 });
  p.test().select(0);
  p.$('arGo').onclick();
  assert.strictEqual(p.test().ar().running, false, '只选 1 人也能开赛');
  assert.ok(/点 2 位/.test(p.$('arToast').textContent), '提示没说要选 2 人：' + p.$('arToast').textContent);
});
t('B2 第一场胜者坐上擂主位，连胜从 1 起算', () => {
  const p = mountArena({ roster: R36 });
  const names = p.test().select(0, 1);
  play(p, 0, 1, true, false);
  const L = p.test().log();
  assert.ok(L.champ, '没定出擂主');
  assert.strictEqual(L.champ.name, names[0], '擂主不是赢的那位：' + L.champ.name);
  assert.strictEqual(L.streak, 1);
  assert.strictEqual(L.round, 1);
});
t('B3 第二场只需点 1 位挑战者，横幅改成守擂', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);
  assert.strictEqual(p.test().needCount(), 1, '已有擂主却还要选 2 人');
  play(p, undefined, undefined, true, false);
  assert.ok(/连胜/.test(p.$('arBanner').textContent), '横幅没显示连胜：' + p.$('arBanner').textContent);
  assert.ok(/连胜/.test(p.$('arChampTag').textContent), '擂主席位没标连胜：' + p.$('arChampTag').textContent);
});
t('B4 平局算擂主守住，连胜继续累加', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);                       // 定擂主 streak=1
  const champ = p.test().log().champ.name;
  play(p, undefined, undefined, false, false);      // 0:0 平局
  const L = p.test().log();
  assert.strictEqual(L.champ.name, champ, '平局把擂主换了');
  assert.strictEqual(L.streak, 2, '平局后连胜没加：' + L.streak);
  assert.ok(L.results[L.results.length - 1].draw, '战绩没记录这是平局');
});
t('B5 挑战者赢了就易主，连胜重置为 1', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);
  const old = p.test().log().champ.name;
  play(p, undefined, undefined, false, true);
  const L = p.test().log();
  assert.notStrictEqual(L.champ.name, old, '擂主没被换掉');
  assert.strictEqual(L.streak, 1, '新擂主连胜应为 1，实际 ' + L.streak);
});
t('B6 第一场平局 → 加赛一场，且不占正式场次', () => {
  const p = mountArena({ roster: R36 });
  p.test().select(0, 1);
  p.$('arGo').onclick();
  const T = p.test();
  T.answerAll('champ', false); T.answerAll('chal', false);
  T.endRound();                                     // 第一场平局 → 自动加赛
  assert.strictEqual(T.log().round, 1, '加赛把场次推到了 ' + T.log().round + '，应为 1');
  assert.strictEqual(T.ar().running, true, '加赛没自动开起来');
  T.answerAll('champ', true); T.answerAll('chal', false);
  T.endRound();
  assert.ok(T.log().champ, '加赛后仍没定出擂主');
  assert.strictEqual(T.log().round, 1, '加赛结束后场次应为 1，实际 ' + T.log().round);
});
t('B7 候选袋点选后不换人（曾每次重洗导致另外两张卡当场变脸）', () => {
  const p = mountArena({ roster: R36 });
  const before = p.test().candidates().map((s) => s.name).join(',');
  p.$('arPickList').children[0].onclick();          // 真实点一张卡 → 会重渲染
  const after = p.test().candidates().map((s) => s.name).join(',');
  assert.strictEqual(after, before, '点选后候选换了人：' + before + ' → ' + after);
});
t('B8 一轮内挑战者不重复，擂主不会出现在候选席', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);
  const champ = p.test().log().champ.name;
  const seen = [];
  for (let i = 0; i < 10; i++) {
    const c = p.test().candidates();
    assert.ok(c.every((s) => s.name !== champ), '擂主 ' + champ + ' 又出现在候选席');
    seen.push(c.map((s) => s.name).join(','));
    play(p, undefined, undefined, true, false);
  }
  const all = [];
  seen.forEach((s) => s.split(',').forEach((n) => all.push(n)));
  const dup = all.filter((v, i) => all.indexOf(v) !== i);
  assert.strictEqual(dup.length, 0, '一轮内有人重复当挑战者：' + Array.from(new Set(dup)).join(','));
});
t('B9 满 N 场自动结算，并列出没上过台的同学', () => {
  const p = mountArena({ roster: R36, storage: { 'pk.arena.cfg': { count: 2, minutes: 1, rounds: 3, mods: null } } });
  play(p, 0, 1, true, false);
  play(p, undefined, undefined, true, false);
  play(p, undefined, undefined, false, true);
  assert.ok(!p.$('arResultMask').classList.contains('hidden'), '打满 3 场没弹结算');
  assert.ok(/最终擂主/.test(p.$('arResMain').textContent), '结算主句缺失：' + p.$('arResMain').textContent);
  assert.ok(p.$('arResTable').children.length >= 3, '战绩表行数不对：' + p.$('arResTable').children.length);
  assert.ok(/没上过台|共 \d+ 人/.test(p.$('arResNever').textContent), '没列出未上场名单：' + p.$('arResNever').textContent);
});
t('B10 擂主连守时播报连胜数，易主时播报新擂主', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);
  const champ = p.test().log().champ.name;
  p.spoke.length = 0;
  play(p, undefined, undefined, true, false);
  const line = p.spoke.join('\n');
  assert.ok(line.includes(champ), '守擂播报没提擂主姓名：' + line);
  assert.ok(/1|2/.test(line) && /连胜|守/.test(line), '守擂播报没提连胜：' + line);
});
t('B11 擂台用固定男声 Kangkang + 低沉慢速（与 PK 的随机声区分）', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);
  const m = p.spoken.filter((x) => x.voice);
  assert.ok(m.length, '没有播报记录');
  m.forEach((x) => {
    assert.ok(/Kangkang/i.test(x.voice), '擂台用了别的音色：' + x.voice);
    assert.ok(Math.abs(x.pitch - 0.8) < 0.01, 'pitch 应为 0.8，实际 ' + x.pitch);
    assert.ok(Math.abs(x.rate - 0.92) < 0.01, 'rate 应为 0.92，实际 ' + x.rate);
  });
});
t('B12 投屏机没有 Kangkang 时仍要出声（兜底不哑）', () => {
  const p = mountArena({ roster: R36, voices: [{ name: 'Microsoft Huihui - Chinese (Simplified, PRC)', lang: 'zh-CN' }] });
  play(p, 0, 1, true, false);
  assert.ok(p.spoken.length, '只剩一个女声时擂台不出声了');
  assert.ok(/Huihui/.test(p.spoken[0].voice), '兜底没选到现有中文声：' + p.spoken[0].voice);
});
t('B13 擂台播报文案是擂台口吻，不是双人 PK 的', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);
  play(p, undefined, undefined, true, false);
  const line = p.spoke.join('\n');
  assert.ok(/擂主|守擂|踢馆|上台/.test(line), '播报里没有擂台用语：' + line);
});
t('B14 XKA 语料：条数够、模板带姓名占位、全库零重复', () => {
  const p = mountArena({ roster: R36 });
  const XKA = p.win.XKA;
  assert.ok(XKA.count() >= 30, '语料太少：' + XKA.count());
  const all = XKA.allTemplates();
  assert.strictEqual(new Set(all).size, all.length, '语料有重复');
  all.forEach((tpl) => assert.ok(/\{[ch]\}/.test(tpl), '模板不含姓名占位：' + tpl));
  assert.ok(/林泽豪|学生\d+/.test(XKA.hold('学生7', 3)), '守擂语没替换姓名');
  assert.ok(XKA.hold('学生7', 3).includes('学生7'), '播报里丢了姓名');
});
t('B15 章节过滤在擂台同样生效', () => {
  const p = mountArena({ roster: R36, storage: { 'pk.arena.cfg': { count: 3, minutes: 1, rounds: 3, mods: { M1: true, M2: false, M3: false, M4: false, M5: false, M6: false, M7: false, M8: false, M9: false } } } });
  assert.strictEqual(p.test().pool().length, 3 + 2, '池大小不对：' + p.test().pool().length);
  play(p, 0, 1, true, false);
  p.test().ar().left.seq.forEach((q) => assert.ok(!q.m || q.m === 'M1', '抽到别的章节：' + q.s));
});
t('B16 擂台默认 5 题 / 2 分钟 / 10 场（新浏览器）', () => {
  const p = mountArena({ roster: R36 });
  const c = p.test().cfg();
  assert.strictEqual(c.count, 5);
  assert.strictEqual(c.minutes, 2);
  assert.strictEqual(c.rounds, 10);
});
t('B17 题干残留不会被念出来（擂台同样走 cleanStem）', () => {
  const bank = [{ m: 'M3', qt: '单选', s: '在 WPS 电子表格中，合并单元格的作用是（ ）A. 增加数据量B. 将多个单元格合并为一个C. 自动计算D. 隐藏数据',
    o: [['A', '增加数据量'], ['B', '将多个单元格合并为一个'], ['C', '自动计算'], ['D', '隐藏数据']], a: 'B', e: '合并单元格把若干格合成一格。' }];
  const p = mountArena({ roster: R36, bank, meta: [] });
  p.test().select(0, 1);
  p.$('arGo').onclick();                 // 只看开赛前那一屏：答完会被 endRound 撤下席位
  const stem = p.$('arChampBody').children[0].textContent;
  assert.ok(!/[A-D][.、．]/.test(stem), '擂台面板残留选项列表：' + stem);
});
t('B18 名单不足 2 人时给提示，不崩', () => {
  const p = mountArena({ roster: [{ sid: 'a', name: '独苗' }] });
  p.$('arRandPick').onclick();
  p.$('arGo').onclick();
  assert.strictEqual(p.test().ar().running, false);
  assert.ok(/至少/.test(p.$('arToast').textContent), '提示缺失：' + p.$('arToast').textContent);
});
t('B19 5 人小班连打 12 场：候选席一屏内绝不重复同一个人', () => {
  const p = mountArena({ roster: sampleRoster(5) });
  play(p, 0, 1, true, false);
  for (let i = 0; i < 12; i++) {
    const names = p.test().candidates().map((s) => s.name);
    assert.strictEqual(new Set(names).size, names.length, '候选席出现同一个人：' + names.join(','));
    const champ = p.test().log().champ;
    if (champ) assert.ok(names.indexOf(champ.name) === -1, '擂主又回到候选席：' + names.join(','));
    play(p, undefined, undefined, true, false);
  }
});
t('B20 擂主还挂在旧候选卡上时，点它不能开赛（自己踢自己的馆）', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);
  const champ = p.test().log().champ;
  p.test().ar().sel = [champ];                        // 教师点了上一屏遗留的擂主卡片
  p.$('arGo').onclick();
  assert.strictEqual(p.test().ar().running, false, '擂主自己踢自己还开起来了');
  assert.ok(/擂主|换一位/.test(p.$('arToast').textContent), '提示缺失：' + p.$('arToast').textContent);
});
t('B21 打完一场后挑战者席位要撤人，不能左席右席同名', () => {
  const p = mountArena({ roster: R36 });
  play(p, 0, 1, true, false);                       // 第一场：左胜 → 左当擂主
  play(p, undefined, undefined, false, true);       // 第二场：挑战者赢 → 他升擂主
  const champName = p.$('arChampName').textContent;
  const chalName = p.$('arChalName').textContent;
  assert.ok(champName, '擂主名字丢了');
  assert.notStrictEqual(chalName, champName, '两个席位同名（看着像 bug）：' + champName);
  assert.ok(/虚位以待/.test(chalName), '挑战者席位没撤人：' + chalName);
  assert.strictEqual(p.$('arChampScore').textContent, '0', '上一场分数还挂在擂主席位上');
  assert.strictEqual(p.$('arChalScore').textContent, '0', '上一场分数还挂在挑战者席位上');
  assert.strictEqual(p.$('arChampMeta').textContent, '', '上一题的题型/考点还挂在擂主席位上');
});

console.log('== C 投屏一屏（CSS 结构）==');
t('C1 宽屏投屏时底部页签整条让位，不能压在候选席/提交按钮上', () => {
  const ar = AR_CSS.replace(/\s+/g, ' ');
  const pk = fs.readFileSync(path.join(__dirname, '..', 'pk', 'src', 'pk-style.css'), 'utf8').replace(/\s+/g, ' ');
  assert.ok(/body\.arena-mode \.tabs\{display:none\}/.test(ar), '擂台模式下底部页签没让位');
  assert.ok(/body\.pk-mode \.tabs\{display:none\}/.test(pk), 'PK 模式下底部页签没让位');
});
t('C2 页签让位后两个模式都得留退出入口（🏠 首页）', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.ok(AR_MARKUP.includes('id="arHome"'), '擂台横幅里没有「🏠 首页」按钮');
  assert.ok(PK_MARKUP.includes('id="btnHome"'), 'PK 顶栏里没有「🏠 首页」按钮');
  assert.ok(/__ARENA_GO_HOME = function \(\) \{ switchTab\('home'\)/.test(app), 'app.js 没接擂台的回首页');
  assert.ok(/__PK_ONLEAVE = function \(\) \{ switchTab\('home'\)/.test(app), 'app.js 没接 PK 的回首页');
});
t('C3 擂台「🏠 首页」：接上宿主就真退出，没宿主就藏掉', () => {
  let hit = 0;
  const solo = mountArena({ roster: R36 });
  assert.strictEqual(solo.$('arHome').style.display, 'none', '没有退出钩子时按钮还挂着');
  const merged = mountArena({ roster: R36, hooks: { __ARENA_GO_HOME: function () { hit++; } } });
  assert.notStrictEqual(merged.$('arHome').style.display, 'none', '有宿主时按钮被藏着，投屏上就没出口了');
  merged.$('arHome').onclick();
  assert.strictEqual(hit, 1, '点了「🏠 首页」没走退出钩子');
});

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
if (failed) console.log('\n未通过清单:\n  ' + fails.join('\n  '));
process.exit(failed ? 1 : 0);
