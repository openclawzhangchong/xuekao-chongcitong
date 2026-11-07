const fs = require('fs');
global.window = {};
eval(fs.readFileSync('src/data.js', 'utf8'));
const XK = require(path.join(__dirname, '..', 'src', 'engine.js'));
const BANK = window.BANK;
let short = 0;
BANK.forEach(q => {
  if (q.qt === '判断') return;
  q.o.forEach(o => {
    const t = String(o[1]).trim();
    if (t.length <= 8 && /[。]$/.test(t) && !/[（(：:，]/.test(t)) {
      const lens = q.o.map(x => String(x[1]).trim().length);
      if (Math.max(...lens) >= 15) short++;
    }
  });
});
console.log('BANK:', BANK.length, '| 短碎片:', short, '| 迁移:', Object.keys(window.XK_QID_MIGRATE || {}).length);
