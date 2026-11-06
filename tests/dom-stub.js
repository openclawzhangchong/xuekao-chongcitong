/* 共用最小 DOM 桩：在 vm 沙箱里加载真实 pk/src/pk-app.js 并驱动它。
 * 只实现 pk-app.js 用到的 DOM 语义，但按真实浏览器规则实现关键三条：
 *   1) select 赋一个不存在的 value 等于没选（selectedIndex=-1、value=''）
 *   2) innerHTML 赋值会清空原有子节点
 *   3) 带 id 的新节点覆盖注册（renderSide 每次重建提交按钮，旧的已废弃）
 * 用法：const { mount, choose } = require('./dom-stub'); const p = mount({ roster: [...] });
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// PK_APP_PATH 用于「同一套断言跑旧代码」，证明闸门在未修复时确实会红
const APP_PATH = process.env.PK_APP_PATH || path.join(__dirname, '..', 'pk', 'src', 'pk-app.js');

const OPT_RE = /<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g;

/* 复刻 pk-markup.html 里带 hidden 的容器，否则「是否显示」断言不成立 */
const SEED_CLASS = {
  pkArena: 'arena hidden', pkSetup: 'arena',
  endMask: 'mask hidden', lbMask: 'mask hidden', pkRosterMask: 'mask hidden', cfgMask: 'mask hidden',
  pkPanelL: 'panel left', pkPanelR: 'panel right'
};
const SELECT_IDS = { pkSelL: 1, pkSelR: 1 };

function queryAll(root, sel) {
  const cls = sel.startsWith('.') ? sel.slice(1) : null;
  const attr = /^\[.+\]$/.test(sel) ? sel.slice(1, -1) : null;
  const out = [];
  (function walk(el) {
    el.children.forEach((c) => {
      if (cls && c.classList.contains(cls)) out.push(c);
      else if (attr && c.getAttribute(attr) !== null) out.push(c);
      walk(c);
    });
  })(root);
  return out;
}

function makeElement(tag, reg) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [], style: {}, attrs: {}, disabled: false
  };
  const set = new Set();
  let _id = '', _html = '', _text = '', _value = '';

  if (reg) {
    Object.defineProperty(el, 'id', {
      get: () => _id,
      set(v) { _id = String(v); if (_id) reg.set(_id, el); }
    });
  } else {
    el.id = '';
  }
  Object.defineProperty(el, 'className', {
    get: () => Array.from(set).join(' '),
    set(v) { set.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => set.add(c)); }
  });
  Object.defineProperty(el, 'innerHTML', {
    get: () => _html,
    set(v) {
      _html = String(v);
      el.children = [];
      if (el.options) {
        el.options = [];
        el._sel = -1;
        _html.replace(OPT_RE, (m, val, text) => {
          const o = makeElement('option'); o.textContent = text; o.value = val;
          el.appendChild(o);
        });
        el._sel = 0;
      }
    }
  });
  if (!(el.tagName === 'SELECT')) {
    // 真实 input 的 value 永远是字符串：赋数字 7 读回来是 '7'
    Object.defineProperty(el, 'value', {
      get: () => _value,
      set(v) { _value = String(v); }
    });
    Object.defineProperty(el, 'textContent', {
      get: () => (el.children.length ? el.children.map((c) => c.textContent).join('') : _text),
      set(v) { _text = String(v); el.children = []; }
    });
  }
  el.setAttribute = (k, v) => { el.attrs[k] = String(v); };
  el.getAttribute = (k) => (Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null);
  el.appendChild = (n) => { el.children.push(n); if (el.options) el.options.push(n); return n; };
  el.addEventListener = () => {};
  el.querySelectorAll = (sel) => queryAll(el, sel);
  el.querySelector = (sel) => queryAll(el, sel)[0] || null;
  el.classList = {
    add: (...c) => c.forEach((x) => set.add(x)),
    remove: (...c) => c.forEach((x) => set.delete(x)),
    contains: (c) => set.has(c),
    toggle: (c, on) => { const next = on === undefined ? !set.has(c) : !!on; if (next) set.add(c); else set.delete(c); return next; }
  };
  if (el.tagName === 'SELECT') {
    el.options = [];
    el._sel = -1;
    Object.defineProperty(el, 'selectedIndex', { get: () => el._sel, set(i) { el._sel = i; } });
    Object.defineProperty(el, 'value', {
      get: () => (el._sel >= 0 && el.options[el._sel] ? el.options[el._sel].value : _value),
      set(v) {
        const at = el.options.findIndex((o) => o.value === String(v));
        el._sel = at;
        _value = at >= 0 ? String(v) : '';
      }
    });
    Object.defineProperty(el, 'textContent', {
      get: () => (el._sel >= 0 && el.options[el._sel] ? el.options[el._sel].textContent : _text),
      set(v) { _text = String(v); }
    });
  }
  return el;
}

/* 9 章 × 3 题 = 27 题，另加 2 道没有 m 字段的题（模拟教师粘贴的自定义题库） */
function sampleBank() {
  const bank = [];
  for (let i = 1; i <= 9; i++) {
    for (let j = 0; j < 3; j++) {
      bank.push({ m: 'M' + i, kd: '考点' + j, qt: '单选', s: 'M' + i + ' 第 ' + (j + 1) + ' 题',
        o: [['A', '甲'], ['B', '乙']], a: 'A', e: '解析' });
    }
  }
  bank.push({ qt: '单选', s: '无章节标记题 1', o: [['A', '甲'], ['B', '乙']], a: 'A', e: '解析' });
  bank.push({ qt: '单选', s: '无章节标记题 2', o: [['A', '甲'], ['B', '乙']], a: 'A', e: '解析' });
  return bank;
}

function sampleMeta() {
  const meta = [];
  for (let i = 1; i <= 9; i++) meta.push({ code: 'M' + i, name: '第' + i + '章', disp: '第' + i + '章 模块' + i, score: 15, n: 3 });
  return meta;
}

function sampleRoster(n) {
  const out = [];
  for (let i = 1; i <= (n || 36); i++) out.push({ sid: '2025' + String(i).padStart(3, '0'), name: '学生' + i });
  return out;
}

/* 假表扬语库：模板固定，便于断言「播报里有没有学生姓名」 */
function fakeXKP() {
  return {
    praiseCount: () => 1000,
    encourageCount: () => 500,
    pickPraise: (name, streak) => (streak >= 3 ? name + ' 连对 ' + streak + ' 题，太厉害了！' : name + '，这个思路很清晰！'),
    pickEncourage: (name) => name + '，再想想就能答对，加油！'
  };
}

function mount(opts) {
  opts = opts || {};
  const roster = opts.roster === undefined ? sampleRoster(36) : opts.roster;
  const bank = opts.bank || sampleBank();
  const meta = opts.meta === undefined ? sampleMeta() : opts.meta;
  const store = new Map();
  if (roster !== null) store.set('pk.roster', JSON.stringify(roster));
  Object.keys(opts.storage || {}).forEach((k) => store.set(k, JSON.stringify(opts.storage[k])));

  const byId = new Map();
  const document = {
    createElement: (t) => makeElement(t, byId),
    getElementById(id) {
      if (!byId.has(id)) {
        const el = makeElement(SELECT_IDS[id] ? 'select' : 'div', null);
        if (SEED_CLASS[id]) SEED_CLASS[id].split(' ').forEach((c) => el.classList.add(c));
        byId.set(id, el);
      }
      return byId.get(id);
    },
    addEventListener: () => {},
    body: makeElement('div', null)
  };

  const spoke = [];
  const win = { BANK: bank.slice() };
  if (meta) win.BANK_META = meta;
  // 真实页面里 praise.js 一定先于 pk-app.js 加载（两份构建都嵌了），桩默认就给 XKP
  win.XKP = opts.xkp || fakeXKP();
  // 浏览器里 speechSynthesis 既是 window 属性也是全局裸标识符，两边都要给
  const synth = { cancel: () => {}, getVoices: () => [], speak: (u) => spoke.push(u.text) };
  const Utter = function (t) { this.text = t; };
  win.speechSynthesis = synth;
  win.SpeechSynthesisUtterance = Utter;

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
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    confirm: () => true,
    speechSynthesis: synth,
    SpeechSynthesisUtterance: Utter,
    Date, Math, JSON
  };
  win.document = document;
  win.addEventListener = () => {};
  win.localStorage = ctx.localStorage;
  win.location = ctx.location;
  win.setTimeout = ctx.setTimeout;
  win.setInterval = ctx.setInterval;
  win.clearInterval = ctx.clearInterval;
  win.confirm = ctx.confirm;
  vm.createContext(ctx);
  // 真实 engine.js 先加载：pk-app.js 显示题干要用 XK.cleanStem（与线上同一份实现）
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8'), ctx, { filename: 'engine.js' });
  vm.runInContext(fs.readFileSync(APP_PATH, 'utf8'), ctx, { filename: 'pk-app.js' });
  win.__PK_MOUNT();

  ctx.$ = (id) => document.getElementById(id);
  ctx.spoke = spoke;
  ctx.store = store;
  ctx.bank = bank;
  ctx.test = () => win.__PK_TEST;
  return ctx;
}

/* 触发真实浏览器事件：change 会走 onchange 处理器 */
function fire(el, type) {
  const h = el['on' + type];
  if (typeof h === 'function') h.call(el, { type });
}

/* 选中下拉里的某一项（等价于用户在原生 select 里点它）：先精确匹配文本，再退化为包含 */
function choose(sel, text) {
  let at = sel.options.findIndex((o) => o.textContent === text);
  if (at < 0) at = sel.options.findIndex((o) => o.textContent.includes(text));
  if (at < 0) throw new Error('下拉里没有「' + text + '」，现有：' + sel.options.map((o) => o.textContent).join(' / '));
  sel.selectedIndex = at;
  fire(sel, 'change');
  return at;
}

/* 在某个面板里作答完一题：点第 n 个选项 → 提交 → 进入下一题（全走真实 onclick） */
function answer(p, side, optIndex) {
  const body = p.$(side + 'Body');
  const opts = body.querySelector('.opts');
  if (!opts) throw new Error(side + ' 面板没渲染出选项（可能已答完）');
  const opt = opts.children[optIndex];
  if (!opt) throw new Error(side + ' 面板选项不足 ' + (optIndex + 1) + ' 个');
  const key = opt.getAttribute('data-key');
  opt.onclick();
  const btn = p.$(side + 'Submit');
  if (typeof btn.onclick !== 'function') throw new Error(side + ' 提交按钮没有 onclick');
  btn.onclick();
  if (String(btn.textContent).indexOf('下一题') !== -1) btn.onclick();
  return key;
}

module.exports = { mount, fire, choose, answer, sampleBank, sampleMeta, sampleRoster, fakeXKP, makeElement };
