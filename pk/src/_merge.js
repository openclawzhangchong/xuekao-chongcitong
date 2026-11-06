// 一次性：PK 模块合并进主站（用后即删）
const fs = require('fs');
const path = require('path');
const PK = __dirname;

// ① app IIFE → 可挂载
let a = fs.readFileSync(path.join(PK, 'pk-app.js'), 'utf8');
a = a.replace("(function () {\n  'use strict';", "window.__PK_MOUNT = function () {\n  'use strict';\n  if (window.__PK_MOUNTED) return;\n  window.__PK_MOUNTED = true;");
if (!a.includes('__PK_MOUNT')) throw new Error('mount failed');
a = a.trimEnd().replace(/\}\)\(\);\s*$/, '};');
fs.writeFileSync(path.join(PK, 'pk-app.js'), a);
console.log('① app 挂载化 OK');

// ② ID 冲突重命名（主站已有 timer/setup/tabs 等）
const MAP = {
  timer: 'pkTimer', setup: 'pkSetup', toast: 'pkToast',
  barL: 'pkBarL', barR: 'pkBarR',
  arena: 'pkArena', selL: 'pkSelL', selR: 'pkSelR',
  panelL: 'pkPanelL', panelR: 'pkPanelR',
  leadTag: 'pkLeadTag', cfgCount: 'pkCfgCount', cfgMinutes: 'pkCfgMinutes',
  newSid: 'pkNewSid', newName: 'pkNewName', rosterPaste: 'pkRosterPaste',
  rosterBody: 'pkRosterBody', rosterMask: 'pkRosterMask'
};
['pk-app.js', 'pk-markup.html'].forEach(f => {
  const p = path.join(PK, f);
  let s = fs.readFileSync(p, 'utf8');
  Object.keys(MAP).forEach(k => {
    const v = MAP[k];
    s = s.split('id="' + k + '"').join('id="' + v + '"');
    s = s.split("$('" + k + "')").join("$('" + v + "')");
    s = s.split('#' + k + ' ').join('#' + v + ' ');
    s = s.split("getElementById('" + k + "')").join("getElementById('" + v + "')");
  });
  fs.writeFileSync(p, s);
});
console.log('② ID 重命名 OK');

// ③ 主站构建脚本注入 PK（markup + style + app）
let b = fs.readFileSync(path.join(PK, '..', 'src', 'build.js'), 'utf8');
if (b.includes('pkMarkup')) { console.log('③ 已注入，跳过'); process.exit(0); }

// 读 PK 资产
b = b.replace(
  "const sfx = read('sfx.js');",
  "const sfx = read('sfx.js');\nconst pkMarkup = read(path.join('..', 'pk', 'src', 'pk-markup.html'));\nconst pkStyle = read(path.join('..', 'pk', 'src', 'pk-style.css'));\nconst pkApp = read(path.join('..', 'pk', 'src', 'pk-app.js'));"
);
// read() 只接受单参数？检查签名后按需替换
b = b.replace(
  "const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');",
  "const read = f => fs.readFileSync(path.isAbsolute(f) ? f : path.join(SRC, f), 'utf8');"
);
// CSS 追加
b = b.replace('${css}\n</style>', '${css}\n${pkStyle}\n</style>');
// 底部加 PK 容器 + 脚本
b = b.replace(
  '<div class="tabs" id="tabs">',
  '<div id="pkPage" class="hidden">\n${pkMarkup}\n</div>\n\n  <div class="tabs" id="tabs">'
);
b = b.replace(
  '<script>\n${app}\n</script>',
  '<script>\n${app}\n</script>\n<script>\n${pkApp}\n</script>'
);
fs.writeFileSync(path.join(PK, '..', 'src', 'build.js'), b);
console.log('③ 主站构建注入 OK');
