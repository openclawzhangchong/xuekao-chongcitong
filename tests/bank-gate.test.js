/* 默认题量闸门单测（Node 零依赖，node tests/bank-gate.test.js）
 * 覆盖：白名单四零、默认 2000 / 释放 3982、URL 兜底、guard 防绕过、
 *       服务端解析契约、模拟考在白名单下仍可组 150 题、构建产物含闸门。
 * 需要已执行过 node src/build.js 与 node src/build.js --split site/index.html。
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const engine = read('src/engine.js');
const data = read('src/data.js');
const whitelistLine = read('src/whitelist-data.js');
const gate = read('src/bank-gate.js');
const wl = JSON.parse(read('docs/白名单-2000题.json'));
const quota = JSON.parse(read('docs/题库精简配额-2000题.json'));

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
function fresh(opts) {
  opts = opts || {};
  const w = {};
  global.window = w;
  if (opts.release) {
    const stub = { getItem: k => k === 'xkc.bank.release' ? '1' : null, setItem: () => {} };
    w.localStorage = stub; global.localStorage = stub;
  } else {
    delete global.localStorage;
  }
  if (opts.search) w.location = { search: opts.search, href: 'http://local/', reload: () => {} };
  eval(engine + '\n' + data + '\n' + whitelistLine + '\n' + gate);
  return w;
}

console.log('== 1. 白名单数据四零 ==');
t('白名单正好 2000 题，86 道综合卷被排除', () => {
  assert.strictEqual(wl.count, 2000);
  assert.strictEqual(wl.items.length, 2000);
  assert.strictEqual(wl.excluded_composite, 86);
});
t('下标唯一、qid 唯一、均落在全库范围内', () => {
  const idx = wl.items.map(x => x.index), qids = wl.items.map(x => x.qid);
  assert.strictEqual(new Set(idx).size, 2000);
  assert.strictEqual(new Set(qids).size, 2000);
  assert.ok(idx.every(i => Number.isInteger(i) && i >= 0 && i < 3982));
});
t('9 模块配额与 58 考点配额逐项吻合', () => {
  const byMod = {};
  wl.items.forEach(x => { byMod[x.module] = (byMod[x.module] || 0) + 1; });
  quota.modules.forEach(m => assert.strictEqual(byMod[m.code], m.quota, m.code + ' 模块配额'));
  const byPoint = {};
  wl.items.forEach(x => { byPoint[x.point_id] = (byPoint[x.point_id] || 0) + 1; });
  quota.points.forEach(p => assert.strictEqual(byPoint[p.id] || 0, p.a, p.id + ' 考点配额'));
  assert.strictEqual(quota.points.length, 58);
});
t('src/whitelist-data.js 与白名单 JSON 完全一致', () => {
  const m = whitelistLine.match(/window\.XK_BANK_INDEX=(\[[\s\S]*?\]);/);
  assert.ok(m, '缺 window.XK_BANK_INDEX 行');
  assert.deepStrictEqual(JSON.parse(m[1]), wl.items.map(x => x.index));
});

console.log('== 2. 闸门默认与释放 ==');
t('默认（无开关）：window.BANK = 2000 题，BANK_ALL = 3982 题', () => {
  const w = fresh();
  assert.strictEqual(w.BANK_ALL.length, 3982);
  assert.strictEqual(w.BANK.length, 2000);
  assert.strictEqual(w.XK_BANK_GATE.isReleased(), false);
  assert.strictEqual(w.XK_BANK_GATE.activeCount(), 2000);
  assert.strictEqual(w.XK_BANK_GATE.whitelistCount(), 2000);
});
t('默认题库的 qid 集合与白名单 JSON 完全一致', () => {
  const w = fresh();
  const got = new Set(w.BANK.map(q => w.XK.qidOf(q)));
  const want = new Set(wl.items.map(x => x.qid));
  assert.strictEqual(got.size, want.size);
  want.forEach(q => assert.ok(got.has(q), '白名单题缺失: ' + q));
});
t('题库真源一题未删：BANK_ALL 的 qid 与 src/data.js 一致', () => {
  const w = fresh();
  const saved = global.window, rawWin = {};
  global.window = rawWin;
  eval(engine + '\n' + data);
  global.window = saved;
  const a = new Set(rawWin.BANK.map(q => rawWin.XK.qidOf(q)));
  const b = new Set(w.BANK_ALL.map(q => w.XK.qidOf(q)));
  assert.strictEqual(a.size, 3982);
  assert.strictEqual(b.size, 3982);
  a.forEach(q => assert.ok(b.has(q), '真源题缺失: ' + q));
});
t('localStorage 释放后 window.BANK = 3982 题', () => {
  const w = fresh({ release: true });
  assert.strictEqual(w.XK_BANK_GATE.isReleased(), true);
  assert.strictEqual(w.BANK.length, 3982);
  assert.strictEqual(w.BANK, w.BANK_ALL);
});
t('?full=1 兜底也能释放（无 localStorage 环境）', () => {
  const w = fresh({ search: '?client=1&full=1' });
  assert.strictEqual(w.BANK.length, 3982);
});
t('?full=0 / 无关参数不会误释放', () => {
  assert.strictEqual(fresh({ search: '?client=1' }).BANK.length, 2000);
  assert.strictEqual(fresh({ search: '?full=0' }).BANK.length, 2000);
});

console.log('== 3. 防绕过与业务兼容 ==');
t('guard：未释放时把远程全库压回 2000 题', () => {
  const w = fresh();
  assert.strictEqual(w.XK_BANK_GATE.guard(w.BANK_ALL).length, 2000);
});
t('guard：教师自定义题库原样保留（不误伤）', () => {
  const w = fresh();
  const custom = [{ s: '自定义题1', o: [['A', 'a']], a: 'A' }, { s: '自定义题2', o: [['A', 'a']], a: 'A' }];
  assert.strictEqual(w.XK_BANK_GATE.guard(custom), custom);
});
t('guard：释放后全库原样放行', () => {
  const w = fresh({ release: true });
  assert.strictEqual(w.XK_BANK_GATE.guard(w.BANK_ALL).length, 3982);
});
t('白名单下模拟考仍能精确组 150 题', () => {
  const w = fresh();
  const paper = w.XK.buildSimPaper(w.BANK, w.BANK_META);
  assert.strictEqual(paper.length, 150);
});
t('白名单下预估分 / 错题队列 / 弱项诊断不报错', () => {
  const w = fresh();
  const p = w.XK.newProfile();
  assert.strictEqual(w.XK.estimateScore(w.BANK, w.BANK_META, p).total, 150);
  assert.ok(Array.isArray(w.XK.wrongQueue(w.BANK, p)));
  assert.ok(w.XK.weakSpots(w.BANK, w.BANK_META, p, 8));
});

console.log('== 4. 服务端与构建产物契约 ==');
t('site/data.js：window.BANK= 行仍是可直接 JSON.parse 的全库 3982 题', () => {
  const s = read('site/data.js');
  const a = s.indexOf('window.BANK=');
  assert.ok(a >= 0);
  const line = s.slice(a + 'window.BANK='.length, s.indexOf('\n', a)).trim().replace(/;$/, '');
  assert.strictEqual(JSON.parse(line).length, 3982);
});
t('site/data.js：window.XK_BANK_INDEX= 行可解析出 2000 个下标', () => {
  const s = read('site/data.js');
  const m = s.match(/window\.XK_BANK_INDEX=(\[[^\n]*?\]);/);
  assert.ok(m, '缺 index 行');
  assert.deepStrictEqual(JSON.parse(m[1]), wl.items.map(x => x.index));
});
t('cloud/worker.js 与 班级版服务.py 都实现了服务端白名单过滤', () => {
  assert.ok(/XK_BANK_INDEX/.test(read('cloud/worker.js')));
  assert.ok(/full=1/.test(read('cloud/worker.js')));
  assert.ok(/XK_BANK_INDEX/.test(read('班级版服务.py')));
  assert.ok(/full=1/.test(read('班级版服务.py')));
});
t('单文件 / 拆分版 / 独立 PK 产物都内嵌闸门与按钮', () => {
  const one = read('dist/学考冲刺通.html');
  const idx = read('site/index.html');
  assert.ok(/XK_BANK_GATE/.test(one) && /data-bank-gate/.test(one));
  assert.ok(/XK_BANK_GATE/.test(idx) && /data-bank-gate/.test(idx));
  assert.ok(/XK_BANK_GATE/.test(read('pk/dist/双人PK答题.html')));
});
t('PK 抽题入口在释放时才向 /api/bank 要 ?full=1', () => {
  const s = read('pk/src/pk-app.js');
  assert.ok(/BANK_FULL_SUFFIX/.test(s));
  assert.ok(/XK_BANK_GATE\.guard/.test(s));
});

console.log('\n结果: ' + passed + ' 通过 / ' + failed + ' 失败');
if (failed) process.exit(1);
