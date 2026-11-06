// 一次性：修复 dataTag 未求值（用后即删）
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src', 'build.js');
let b = fs.readFileSync(p, 'utf8');

// 删除旧的 dataBlock / dataTag 定义
b = b.replace(/const dataBlock = [\s\S]*?;\n/, '');
b = b.replace(/const dataTag = splitMode \? SPLIT_HEAD : dataBlock;\n/, '');

// 模板里 ${dataTag} → 条件内联（data 变量在模板求值时可用）
if (b.includes('${dataTag}')) {
  b = b.replace('${dataTag}', '${splitMode ? SPLIT_HEAD : ("<scr" + "ipt>\\n" + data + "\\n</scr" + "ipt>")}');
}

// 清理遗留的空行/无用变量
b = b.replace(/const bankVerJson = splitMode \? JSON\.stringify\('20261106'\) : '';\n/g, '');
b = b.replace(/const metaJson = splitMode \? JSON\.stringify\(window\.BANK_META\) : '';\n/g, '');

fs.writeFileSync(p, b);
console.log('dataTag 修复:', !b.includes('${dataTag}'), '| 新表达式:', b.includes('splitMode ? SPLIT_HEAD :'));
