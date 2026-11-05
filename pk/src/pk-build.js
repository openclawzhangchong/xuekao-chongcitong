/* PK 单文件构建：内嵌 sfx.js + 题库 data.js + pk-app.js
 * 用法：node pk/src/pk-build.js（产物 pk/dist/双人PK答题.html → 复制桌面） */
'use strict';
const fs = require('fs');
const path = require('path');

const PK = path.join(__dirname);
const ROOT = path.join(PK, '..', '..');

const tpl = fs.readFileSync(path.join(PK, 'template.html'), 'utf8');
const sfxJs = fs.readFileSync(path.join(ROOT, 'src', 'sfx.js'), 'utf8');
const dataJs = fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8');
const pkAppJs = fs.readFileSync(path.join(PK, 'pk-app.js'), 'utf8');

// 破坏性序列校验
[dataJs, sfxJs, pkAppJs].forEach((code, i) => {
  if (/<\/script/i.test(code)) throw new Error('脚本 #' + i + ' 含 </script>，会破坏 HTML');
});

let out = tpl
  .replace('${pkStyle}', fs.readFileSync(path.join(PK, 'pk-style.css'), 'utf8'))
  .replace('${sfxJs}', sfxJs)
  .replace('${bankJs}', dataJs)
  .replace('${pkAppJs}', pkAppJs);

const outPath = path.join(PK, '..', 'dist', '双人PK答题.html');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');

// 校验
global.window = {};
eval(sfxJs);
eval(dataJs);
eval(pkAppJs.replace(/\(function \(\) \{/, '(function () { return;')); // app 层依赖 DOM，跳过执行
console.log('PK BUILD OK →', outPath);
console.log('大小:', (fs.statSync(outPath).size / 1024).toFixed(0), 'KB | 题库:', window.BANK.length, '题');
