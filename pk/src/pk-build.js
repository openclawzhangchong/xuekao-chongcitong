/* PK 单文件构建：内嵌 engine.js + sfx.js + praise.js + 题库 data.js + pk-app.js
 * 用法：node pk/src/pk-build.js（产物 pk/dist/双人PK答题.html → 复制桌面）
 * engine.js 必须嵌：pk-app.js 显示题干要用 XK.cleanStem 剥离残留的选项列表。
 * praise.js 必须嵌：答对/答错播报用 window.XKP 的带姓名表扬语。 */
'use strict';
const fs = require('fs');
const path = require('path');

const PK = path.join(__dirname);
const ROOT = path.join(PK, '..', '..');

const tpl = fs.readFileSync(path.join(PK, 'template.html'), 'utf8');
const markup = fs.readFileSync(path.join(PK, 'pk-markup.html'), 'utf8');
const themeCss = fs.readFileSync(path.join(ROOT, 'src', 'theme.css'), 'utf8');
const engineJs = fs.readFileSync(path.join(ROOT, 'src', 'engine.js'), 'utf8');
const sfxJs = fs.readFileSync(path.join(ROOT, 'src', 'sfx.js'), 'utf8');
const praiseJs = fs.readFileSync(path.join(ROOT, 'src', 'praise.js'), 'utf8');
const dataJs = fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8');
const whitelistData = fs.readFileSync(path.join(ROOT, 'src', 'whitelist-data.js'), 'utf8');
const bankGateJs = fs.readFileSync(path.join(ROOT, 'src', 'bank-gate.js'), 'utf8');
const qoverJs = fs.readFileSync(path.join(ROOT, 'src', 'question-override.js'), 'utf8');
const bankJsWithIndex = dataJs + '\n' + whitelistData;
const pkAppJs = fs.readFileSync(path.join(PK, 'pk-app.js'), 'utf8');

// 破坏性序列校验
[bankJsWithIndex, bankGateJs, qoverJs, engineJs, sfxJs, praiseJs, pkAppJs].forEach((code, i) => {
  if (/<\/script/i.test(code)) throw new Error('脚本 #' + i + ' 含 </script>，会破坏 HTML');
});

let out = tpl
  .replace('${pkStyle}', themeCss + '\n' + fs.readFileSync(path.join(PK, 'pk-style.css'), 'utf8'))
  .replace('${pkMarkup}', markup)
  .replace('${engineJs}', engineJs)
  .replace('${sfxJs}', sfxJs)
  .replace('${praiseJs}', praiseJs)
  .replace('${bankJs}', bankJsWithIndex)
  .replace('${gateJs}', bankGateJs)
  .replace('${qoverJs}', qoverJs)
  .replace('${pkAppJs}', pkAppJs);

// 产物守卫：占位符漏替换 = 页面完全没有界面（曾踩过：${pkMarkup} 原样留在 body 里）
const unreplaced = out.match(/\$\{[a-zA-Z]+\}/g);
if (unreplaced) throw new Error('PK 构建有未替换的占位符：' + Array.from(new Set(unreplaced)).join(', '));
if (!/class="pickrow"/.test(out) || !/id="pkSelL"/.test(out)) throw new Error('PK 构建产物缺少选人界面');
// 独立版没有主站 app.js 帮它挂载，缺这行就是一片不动的静态界面
if (!/__PK_MOUNT\(\)/.test(out)) throw new Error('PK 独立版缺少 __PK_MOUNT() 调用，界面不会初始化');

const outPath = path.join(PK, '..', 'dist', '双人PK答题.html');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');

// 校验：按页面里的顺序执行一遍，缺依赖直接失败（播报与题干清洗会在线上报错）
global.window = {};
eval(engineJs);
eval(sfxJs);
eval(praiseJs);
eval(bankJsWithIndex);
eval(bankGateJs); // 无 document 环境下闸门仍应把 window.BANK 压成默认档
eval(qoverJs);    // 教师修正层：改题干不改 qid，独立版也应用本机修正
if (!window.XK_TIER_INDEX || ['1000', '2000', '3000'].some(k => window.XK_TIER_INDEX[k].length !== Number(k))) {
  throw new Error('PK 独立版缺少 1000/2000/3000 三档白名单下标');
}
if (window.BANK.length !== 1000) throw new Error('PK 独立版默认题库不是 1000 题基础档: ' + window.BANK.length);
if (window.BANK_ALL.length !== 3982) throw new Error('PK 独立版全库题数异常: ' + window.BANK_ALL.length);
if (typeof window.XK !== 'object' || typeof window.XK.cleanStem !== 'function') {
  throw new Error('独立版 PK 缺少引擎 XK.cleanStem，题干残留会原样显示');
}
if (typeof window.XKP !== 'object' || typeof window.XKP.pickPraise !== 'function') {
  throw new Error('独立版 PK 没有可用的表扬语库 XKP，答对播报会报错');
}
eval(pkAppJs.replace(/\(function \(\) \{/, '(function () { return;')); // app 层依赖 DOM，跳过执行
console.log('PK BUILD OK →', outPath);
console.log('大小:', (fs.statSync(outPath).size / 1024).toFixed(0), 'KB | 默认基础档:', window.BANK.length, '题 | 档位 1000/2000/3000:', Object.keys(window.XK_TIER_INDEX).join('/'), '| 全库:', window.BANK_ALL.length, '题 | 表扬语:', window.XKP.praiseCount(), '条');
