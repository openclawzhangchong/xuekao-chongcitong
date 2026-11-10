/* 题量档位闸门单测（Node 零依赖，node tests/bank-gate.test.js）
 * 覆盖：三档白名单四零与严格嵌套、默认 1000、四档切换、URL/旧开关兼容、
 *       guard 防绕过、每档模拟考 150 题、服务端解析契约、按钮位置与版本显示。
 * 需要先执行 node tools/build-whitelist.js → node src/build.js
 *       → node src/build.js --split site/index.html → node pk/src/pk-build.js
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
const WLS = {
  '1000': JSON.parse(read('docs/白名单-1000题.json')),
  '2000': JSON.parse(read('docs/白名单-2000题.json')),
  '3000': JSON.parse(read('docs/白名单-3000题.json'))
};
const quota2000 = JSON.parse(read('docs/题库精简配额-2000题.json'));

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
function fresh(opts) {
  opts = opts || {};
  const w = {};
  global.window = w;
  const store = {};
  if (opts.tier) store['xkc.bank.tier'] = opts.tier;
  if (opts.release) store['xkc.bank.release'] = '1';
  if (Object.keys(store).length) {
    const stub = {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    };
    w.localStorage = stub; global.localStorage = stub;
  } else {
    delete global.localStorage;
  }
  if (opts.search) w.location = { search: opts.search, href: 'http://local/', reload: () => {} };
  eval(engine + '\n' + data + '\n' + whitelistLine + '\n' + gate);
  return w;
}

console.log('== 1. 三档白名单四零与嵌套 ==');
t('三档数量精确 1000 / 2000 / 3000，综合卷与跨模块错挂题已排除', () => {
  assert.strictEqual(WLS['1000'].count, 1000);
  assert.strictEqual(WLS['2000'].count, 2000);
  assert.strictEqual(WLS['3000'].count, 3000);
  const pool = WLS['1000'].pool;
  assert.strictEqual(pool.total_bank, 3982);
  assert.strictEqual(pool.KEEP + pool.CLEAN + pool.DELETE, 3982, '三态之和应等于全库');
  assert.ok(pool.excluded_composite > 0, '跨考点综合卷应被排除');
  assert.ok(pool.excluded_mislabeled > 0, '跨模块错挂题应被排除');
  assert.strictEqual(pool.mislabeled_sample.length, Math.min(20, pool.excluded_mislabeled));
});
t('每档下标唯一、qid 唯一、均落在全库范围内', () => {
  ['1000', '2000', '3000'].forEach(k => {
    const idx = WLS[k].items.map(x => x.index), qids = WLS[k].items.map(x => x.qid);
    assert.strictEqual(new Set(idx).size, Number(k), k + ' 下标重复');
    assert.strictEqual(new Set(qids).size, Number(k), k + ' qid 重复');
    assert.ok(idx.every(i => Number.isInteger(i) && i >= 0 && i < 3982));
  });
});
t('严格嵌套：1000 ⊂ 2000 ⊂ 3000', () => {
  const a = new Set(WLS['1000'].items.map(x => x.index));
  const b = new Set(WLS['2000'].items.map(x => x.index));
  const c = new Set(WLS['3000'].items.map(x => x.index));
  a.forEach(i => assert.ok(b.has(i), '1000 档题不在 2000 档'));
  b.forEach(i => assert.ok(c.has(i), '2000 档题不在 3000 档'));
});
t('9 模块配额与 58 考点配额逐项吻合（干净池重配后）', () => {
  const byMod = {};
  WLS['2000'].items.forEach(x => { byMod[x.module] = (byMod[x.module] || 0) + 1; });
  quota2000.modules.forEach(m => assert.strictEqual(byMod[m.code], m.quota, m.code + ' 模块配额'));
  const byPoint = {};
  WLS['2000'].items.forEach(x => { byPoint[x.point_id] = (byPoint[x.point_id] || 0) + 1; });
  quota2000.points.forEach(p => assert.strictEqual(byPoint[p.id] || 0, p.quota, p.id + ' 考点配额'));
  assert.strictEqual(quota2000.points.length, 58);
});
t('三档白名单零 DELETE 题（干净池硬约束，规则来自 quality-rules.js）', () => {
  const { classify, optKey } = require('../tools/quality-rules');
  const w = {}; global.window = w;
  eval(engine + '\n' + data);
  const B = w.BANK;
  const ids = B.map(q => w.XK.qidOf(q));
  const byOpts = Object.create(null);
  B.forEach((q, i) => { const k = optKey(q); (byOpts[k] = byOpts[k] || []).push(ids[i]); });
  const V = B.map((q, i) => classify(q, { qid: ids[i], byOpts }));
  const at = Object.create(null);
  ids.forEach((id, i) => { at[id] = i; });
  ['1000', '2000', '3000'].forEach(k => {
    const bad = WLS[k].items.filter(x => at[x.qid] == null || V[at[x.qid]].state === 'DELETE');
    assert.strictEqual(bad.length, 0, k + ' 档含 DELETE 题：' + bad.slice(0, 3).map(x => x.qid).join(', '));
  });
});
t('src/whitelist-data.js 三档与可审计 JSON 完全一致，默认档为 1000', () => {
  const m = whitelistLine.match(/window\.XK_TIER_INDEX=(\{[^\n]*\});/);
  assert.ok(m, '缺 XK_TIER_INDEX 行');
  const tiers = JSON.parse(m[1]);
  ['1000', '2000', '3000'].forEach(k => {
    assert.deepStrictEqual(tiers[k], WLS[k].items.map(x => x.index));
  });
  assert.ok(/window\.XK_DEFAULT_TIER='1000';/.test(whitelistLine));
  const old = whitelistLine.match(/window\.XK_BANK_INDEX=(\[[^\n]*\]);/);
  assert.ok(old && JSON.parse(old[1]).length === 2000, '旧 XK_BANK_INDEX 兼容行');
});

console.log('== 2. 闸门四档与默认 ==');
t('默认（无开关）= 基础档 1000 题，全库仍 3982 题', () => {
  const w = fresh();
  assert.strictEqual(w.BANK_ALL.length, 3982);
  assert.strictEqual(w.BANK.length, 1000);
  assert.strictEqual(w.XK_BANK_GATE.tier(), '1000');
  assert.strictEqual(w.XK_BANK_GATE.defaultTier, '1000');
  assert.strictEqual(w.XK_BANK_GATE.whitelistCount(), 1000);
});
t('默认档 qid 集合与 1000 档白名单 JSON 完全一致', () => {
  const w = fresh();
  const got = new Set(w.BANK.map(q => w.XK.qidOf(q)));
  const want = new Set(WLS['1000'].items.map(x => x.qid));
  assert.strictEqual(got.size, want.size);
  want.forEach(q => assert.ok(got.has(q), '白名单题缺失: ' + q));
});
t('四档切换：1000 / 2000 / 3000 / full 题数精确', () => {
  [['1000', 1000], ['2000', 2000], ['3000', 3000], ['full', 3982]].forEach(([tier, n]) => {
    const w = fresh({ tier: tier });
    assert.strictEqual(w.XK_BANK_GATE.tier(), tier);
    assert.strictEqual(w.BANK.length, n, tier + ' 档题数');
    assert.strictEqual(w.XK_BANK_GATE.countOf(tier), n);
  });
});
t('URL 兜底 ?tier=3000 / ?full=1', () => {
  assert.strictEqual(fresh({ search: '?client=1&tier=3000' }).BANK.length, 3000);
  assert.strictEqual(fresh({ search: '?full=1' }).BANK.length, 3982);
  assert.strictEqual(fresh({ search: '?tier=999' }).BANK.length, 1000);
});
t('旧 release=1 开关兼容为全库档；tier 优先于 release', () => {
  assert.strictEqual(fresh({ release: true }).BANK.length, 3982);
  assert.strictEqual(fresh({ release: true, tier: '2000' }).BANK.length, 2000);
});
t('setTier 写盘并清除旧 release 标记', () => {
  const w = fresh({ release: true });
  assert.strictEqual(w.XK_BANK_GATE.setTier('3000'), true);
  assert.strictEqual(w.XK_BANK_GATE.tier(), '3000');
  w.XK_BANK_GATE.apply();
  assert.strictEqual(w.BANK.length, 3000);
});

console.log('== 3. 防绕过与业务兼容 ==');
t('guard：默认档拿到全库时压回 1000 题', () => {
  const w = fresh();
  assert.strictEqual(w.XK_BANK_GATE.guard(w.BANK_ALL).length, 1000);
});
t('guard：3000 档压回 3000 题，全库档放行', () => {
  const all = fresh().BANK_ALL;
  assert.strictEqual(fresh({ tier: '3000' }).XK_BANK_GATE.guard(all).length, 3000);
  const w = fresh({ tier: 'full' });
  assert.strictEqual(w.XK_BANK_GATE.guard(w.BANK_ALL).length, 3982);
});
t('guard：教师自定义题库原样保留', () => {
  const w = fresh();
  const custom = [{ s: '自定义题1', o: [['A', 'a']], a: 'A' }, { s: '自定义题2', o: [['A', 'a']], a: 'A' }];
  assert.strictEqual(w.XK_BANK_GATE.guard(custom), custom);
});
t('每一档模拟考都能精确组 150 题', () => {
  ['1000', '2000', '3000', 'full'].forEach(tier => {
    const w = fresh({ tier: tier });
    assert.strictEqual(w.XK.buildSimPaper(w.BANK, w.BANK_META).length, 150, tier + ' 档组卷');
  });
});
t('默认档预估分 / 错题队列 / 弱项诊断不报错', () => {
  const w = fresh();
  const p = w.XK.newProfile();
  assert.strictEqual(w.XK.estimateScore(w.BANK, w.BANK_META, p).total, 150);
  assert.ok(Array.isArray(w.XK.wrongQueue(w.BANK, p)));
  assert.ok(w.XK.weakSpots(w.BANK, w.BANK_META, p, 8));
});

console.log('== 4. 服务端与构建产物契约 ==');
t('site/data.js：window.BANK= 行仍是全库 3982 题（旧解析契约不变）', () => {
  const s = read('site/data.js');
  const a = s.indexOf('window.BANK=');
  assert.ok(a >= 0);
  const line = s.slice(a + 'window.BANK='.length, s.indexOf('\n', a)).trim().replace(/;$/, '');
  assert.strictEqual(JSON.parse(line).length, 3982);
});
t('site/data.js：XK_TIER_INDEX 行可解析三档，默认档 1000', () => {
  const s = read('site/data.js');
  const m = s.match(/window\.XK_TIER_INDEX=(\{[^\n]*\});/);
  assert.ok(m, '缺 index 行');
  const tiers = JSON.parse(m[1]);
  assert.deepStrictEqual(Object.keys(tiers).sort(), ['1000', '2000', '3000']);
  assert.ok(/window\.XK_DEFAULT_TIER='1000';/.test(s));
});
t('cloud/worker.js 与 班级版服务.py 都实现服务端档位过滤', () => {
  ['cloud/worker.js', '班级版服务.py'].forEach(f => {
    const s = read(f);
    assert.ok(/XK_TIER_INDEX/.test(s), f + ' 缺档位表');
    assert.ok(/tier=/.test(s), f + ' 缺 ?tier=');
    assert.ok(/full=1/.test(s), f + ' 缺 ?full=1');
  });
});
t('单文件 / 拆分版 / 独立 PK 产物都内嵌闸门与档位按钮', () => {
  const one = read('dist/学考冲刺通.html');
  const idx = read('site/index.html');
  const pk = read('pk/dist/双人PK答题.html');
  [one, idx, pk].forEach(s => {
    assert.ok(/XK_BANK_GATE/.test(s));
    assert.ok(/data-bank-tier="1000"/.test(s) && /data-bank-tier="3000"/.test(s));
  });
  assert.ok((one.match(/data-bank-tier="1000"/g) || []).length >= 2, '首页与 PK 设置都要有档位按钮');
});
t('按钮仍在学习档案下方、顶栏无按钮、页面显示版本号', () => {
  const s = read('dist/学考冲刺通.html');
  const home = s.indexOf('<div id="home"');
  const headerEnd = s.indexOf('</header>', home);
  assert.ok(!/data-bank-tier/.test(s.slice(home, headerEnd)), '首页顶栏不许有档位按钮');
  const learn = s.indexOf('学习档案（只存本机，不上传）');
  const btn = s.indexOf('data-bank-tier="1000"');
  assert.ok(learn >= 0 && btn > learn, '按钮必须在学习档案下面');
  assert.ok(/XK_APP_VER\s*=\s*'v\d+\.\d+'/.test(s) && /150 分制 · v\d+\.\d+/.test(s));
  const m = read('pk/src/pk-markup.html');
  const cfg = m.indexOf('id="cfgMask"');
  assert.ok(!/data-bank-tier/.test(m.slice(0, cfg)), 'PK 顶栏不许有档位按钮');
});
t('PK 抽题入口按当前档位请求 /api/bank', () => {
  const s = read('pk/src/pk-app.js');
  assert.ok(/BANK_TIER_QUERY/.test(s));
  assert.ok(/XK_BANK_GATE\.guard/.test(s));
});

console.log('\n结果: ' + passed + ' 通过 / ' + failed + ' 失败');
if (failed) process.exit(1);
