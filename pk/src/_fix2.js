// 一次性：用变量方式修复 dataTag（用后即删）
const fs = require('s' + 's'.replace('s', '') === 's' ? 'fs' : 'fs');
const path = require('path');
const p = path.join(process.cwd(), 'src', 'build.js');
let b = fs.readFileSync(p, 'utf8');

// 1) 把模板里损坏的表达式整行替换为占位变量
const lines = b.split('\n');
let idx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('${splitMode ? SPLIT_HEAD')) { idx = i; break; }
}
if (idx === -1) throw new Error('damaged line not found');
lines[idx] = '${DATA_TAG}';
b = lines.join('\n');

// 2) 在 tpl 定义前插入 DATA_TAG 变量
if (!b.includes('const DATA_TAG')) {
  b = b.replace(
    'const tpl = `',
    "const DATA_TAG = splitMode\n" +
    "  ? SPLIT_HEAD\n" +
    "  : ['<script>', data, '</script>'].join('\\n');\n" +
    "const tpl = `"
  );
}
fs.writeFileSync(p, b);
console.log('DATA_TAG 变量注入:', b.includes('${DATA_TAG}') && b.includes('const DATA_TAG'));
