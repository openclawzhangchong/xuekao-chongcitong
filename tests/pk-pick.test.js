/* PK 选人回归测试：node tests/pk-pick.test.js
 * 用最小 DOM 桩加载真实 pk/src/pk-app.js，钉住「下拉能选中学生姓名」这条行为。
 * 覆盖两类历史缺陷：change 后重建下拉把选择抹掉；无编号学生因 value='' 消失。
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------------- 最小 DOM 桩 ---------------- */
const OPT_RE = /<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g;

function makeOption(text, value) {
  const el = makeElement('option');
  el.textContent = text;
  el.value = value;
  return el;
}

function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    style: {},
    attrs: {},
    className: '',
    textContent: '',
    disabled: false,
    value: '',
    _set: new Set(),
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null; },
    appendChild(n) { el.children.push(n); if (el.tagName === 'SELECT') el.options.push(n); return n; },
    addEventListener() {},
    querySelectorAll() { return []; },
    classList: {
      add() { [].forEach.call(arguments, (c) => el._set.add(c)); },
      remove() { [].forEach.call(arguments, (c) => el._set.delete(c)); },
      contains(c) { return el._set.has(c); },
      toggle(c, on) {
        const next = on === undefined ? !el._set.has(c) : !!on;
        if (next) el._set.add(c); else el._set.delete(c);
        return next;
      }
    }
  };
  if (el.tagName === 'SELECT') {
    el.options = [];
    el._sel = -1;
    Object.defineProperty(el, 'innerHTML', {
      get() { return ''; },
      set(v) {
        el.children = [];
        el.options = [];
        el._sel = -1;
        String(v).replace(OPT_RE, (m, val, text) => { el.appendChild(makeOption(text, val)); });
        el._sel = 0;
      }
    });
    Object.defineProperty(el, 'selectedIndex', {
      get() { return el._sel; },
      set(i) { el._sel = i; }
    });
    Object.defineProperty(el, 'value', {
      get() { return el._sel >= 0 && el.options[el._sel] ? el.options[el._sel].value : ''; },
      set(v) {
        const at = el.options.findIndex((o) => o.value === String(v));
        el._sel = at;
      }
    });
    Object.defineProperty(el, 'textContent', {
      get() { return el._sel >= 0 && el.options[el._sel] ? el.options[el._sel].textContent : ''; },
      set(v) { el._text = String(v); }
    });
  }
  return el;
}

const BANK = [
  { qt: '单选', s: '第 1 题', o: [['A', '甲'], ['B', '乙']], a: 'A', e: '解析1' },
  { qt: '单选', s: '第 2 题', o: [['A', '甲'], ['B', '乙']], a: 'B', e: '解析2' },
  { qt: '多选', s: '第 3 题', o: [['A', '甲'], ['B', '乙'], ['C', '丙']], a: 'ABC', e: '解析3' }
];

function newContext(roster) {
  const store = new Map();
  if (roster !== undefined) store.set('pk.roster', JSON.stringify(roster));
  const byId = new Map();
  const tags = { pkSelL: 'select', pkSelR: 'select' };
  // 复刻 pk-markup.html 的初始 class（尤其 hidden），否则「是否显示」断言不成立
  const seedCls = {
    pkArena: 'arena hidden', pkSetup: 'arena',
    endMask: 'mask hidden', lbMask: 'mask hidden', pkRosterMask: 'mask hidden', cfgMask: 'mask hidden',
    pkPanelL: 'panel left', pkPanelR: 'panel right'
  };
  const document = {
    createElement: (t) => makeElement(t),
    getElementById(id) {
      if (!byId.has(id)) {
        const el = makeElement(tags[id] || 'div');
        if (seedCls[id]) seedCls[id].split(' ').forEach((c) => el.classList.add(c));
        byId.set(id, el);
      }
      return byId.get(id);
    },
    addEventListener() {},
    body: makeElement('div')
  };
  const win = { BANK: BANK.slice() };
  const timers = [];
  const ctx = {
    window: win,
    document,
    console,
    location: { protocol: 'file:', origin: 'file://', href: 'file:///x' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    setTimeout: (fn, ms) => { timers.push(fn); return timers.length; },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    confirm: () => true,
    Date,
    Math,
    JSON
  };
  win.document = document;
  win.localStorage = ctx.localStorage;
  win.location = ctx.location;
  win.setTimeout = ctx.setTimeout;
  win.setInterval = ctx.setInterval;
  win.clearInterval = ctx.clearInterval;
  win.confirm = ctx.confirm;
  vm.createContext(ctx);
  const code = fs.readFileSync(path.join(__dirname, '..', 'pk', 'src', 'pk-app.js'), 'utf8');
  vm.runInContext(code, ctx, { filename: 'pk-app.js' });
  ctx.__pk = { win, document, byId, store };
  return ctx;
}

function mount(roster) {
  const ctx = newContext(roster);
  ctx.window.__PK_MOUNT();
  return ctx;
}

function fire(el, type) {
  const h = el['on' + type];
  if (typeof h === 'function') h.call(el, { type });
}

let passed = 0, failed = 0;
const fails = [];
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; fails.push(name + ' → ' + e.message); console.log('  ✗ ' + name + '\n    ' + e.message); }
}

const DEFAULT36 = [];
for (let i = 1; i <= 36; i++) DEFAULT36.push({ sid: '2025' + String(i).padStart(3, '0'), name: '学生' + i });

console.log('== 1. 下拉填充 ==');
t('默认班级 36 人进入左下拉（占位符 + 36）', () => {
  const ctx = mount(DEFAULT36);
  const L = ctx.document.getElementById('pkSelL');
  assert.strictEqual(L.options.length, 37);
});
t('无编号学生（sid 为空）也必须出现在下拉里', () => {
  const ctx = mount([{ sid: '', name: '王五' }, { sid: '', name: '赵六' }, { sid: '2025001', name: '陈博杰' }]);
  const L = ctx.document.getElementById('pkSelL');
  const texts = L.options.map((o) => o.textContent).join('|');
  assert.ok(texts.includes('王五'), '王五 不在下拉：' + texts);
  assert.ok(texts.includes('赵六'), '赵六 不在下拉：' + texts);
});

console.log('== 2. 选中之后不能被打回占位符（核心缺陷）==');
t('左下拉选中后 value 保持不变', () => {
  const ctx = mount(DEFAULT36);
  const L = ctx.document.getElementById('pkSelL');
  const want = L.options[13].value;
  assert.ok(want, '选项 value 为空，无法选中');
  L.value = want;
  fire(L, 'change');
  assert.strictEqual(L.value, want, 'change 后选择被抹掉，value 变成 ' + JSON.stringify(L.value));
});
t('左下拉选中后显示的是姓名而不是「— 选择选手 —」', () => {
  const ctx = mount(DEFAULT36);
  const L = ctx.document.getElementById('pkSelL');
  const name = L.options[13].textContent;
  L.value = L.options[13].value;
  fire(L, 'change');
  assert.strictEqual(L.textContent, name, '显示回退为：' + L.textContent);
});
t('右下拉同样能保持选中', () => {
  const ctx = mount(DEFAULT36);
  const R = ctx.document.getElementById('pkSelR');
  const want = R.options[5].value;
  R.value = want;
  fire(R, 'change');
  assert.strictEqual(R.value, want, '右下拉 change 后被抹掉');
});
t('无编号学生可选中（value 不得等于占位符空串）', () => {
  const ctx = mount([{ sid: '', name: '王五' }, { sid: '', name: '赵六' }]);
  const L = ctx.document.getElementById('pkSelL');
  const at = L.options.findIndex((o) => o.textContent.includes('王五'));
  assert.ok(at > 0, '王五 不在列表中');
  assert.ok(L.options[at].value !== '', '王五 的 option value 是空串，选中等于没选');
  L.value = L.options[at].value;
  fire(L, 'change');
  assert.strictEqual(L.value, L.options[at].value, '王五 选中后被打回');
});

console.log('== 3. 左右互斥 ==');
t('左已选的人不出现在右下拉', () => {
  const ctx = mount(DEFAULT36);
  const L = ctx.document.getElementById('pkSelL');
  const R = ctx.document.getElementById('pkSelR');
  L.value = L.options[3].value;
  fire(L, 'change');
  const picked = L.textContent;
  const rTexts = R.options.map((o) => o.textContent);
  assert.ok(!rTexts.includes(picked), '右下拉仍可重复选到 ' + picked);
  assert.strictEqual(R.options.length, 36, '右下拉应少 1 人，实际 ' + R.options.length);
});
t('选右不会把左清空', () => {
  const ctx = mount(DEFAULT36);
  const L = ctx.document.getElementById('pkSelL');
  const R = ctx.document.getElementById('pkSelR');
  L.value = L.options[3].value;
  fire(L, 'change');
  const lWant = L.value;
  R.value = R.options[1].value;
  fire(R, 'change');
  assert.strictEqual(L.value, lWant, '选右之后左被清空');
});

console.log('== 4. 选人后能开赛 ==');
t('选好两人点「开始 PK」→ 分屏出现、面板显示两侧姓名', () => {
  const ctx = mount(DEFAULT36);
  const L = ctx.document.getElementById('pkSelL');
  const R = ctx.document.getElementById('pkSelR');
  L.value = L.options[2].value; fire(L, 'change');
  R.value = R.options[2].value; fire(R, 'change');
  const lName = L.textContent.split(' · ').pop(), rName = R.textContent.split(' · ').pop();
  assert.notStrictEqual(lName, rName, '用例前提不成立：两侧选到了同一个人');
  ctx.document.getElementById('btnStart').onclick();
  const arena = ctx.document.getElementById('pkArena');
  assert.ok(!arena.classList.contains('hidden'), '分屏仍隐藏，PK 没开始');
  assert.ok(ctx.document.getElementById('LName').textContent.includes(lName), '左面板姓名错：' + ctx.document.getElementById('LName').textContent);
  assert.ok(ctx.document.getElementById('rName').textContent.includes(rName), '右面板姓名错：' + ctx.document.getElementById('rName').textContent);
});
t('没选人点「开始 PK」→ 分屏保持隐藏并提示', () => {
  const ctx = mount(DEFAULT36);
  ctx.document.getElementById('btnStart').onclick();
  assert.ok(ctx.document.getElementById('pkArena').classList.contains('hidden'), '未选人也能开赛');
  assert.ok(ctx.document.getElementById('pkToast').textContent.includes('选手'), '提示文案缺失：' + ctx.document.getElementById('pkToast').textContent);
});
t('花名册为空时挂载不抛异常，下拉只剩占位符', () => {
  const ctx = mount([]);
  const L = ctx.document.getElementById('pkSelL');
  assert.strictEqual(L.options.length, 1);
});

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
if (failed) console.log('\n未通过清单:\n  ' + fails.join('\n  '));
process.exit(failed ? 1 : 0);
