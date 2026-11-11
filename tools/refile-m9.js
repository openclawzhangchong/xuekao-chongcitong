/* M9 考点11 错挂题改挂器：把挂在「大数据处理核心技术」名下的安全/AI 题改挂回 M7/M8
 * - 改 m + kd → qid 变化 → 自动登记 XK_QID_MIGRATE（学生记录零断链）
 * - 与 M7/M8 完全重复的副本不改挂（已在 docs/人工审阅排除.json 里排除出白名单）
 * 用法：node tools/refile-m9.js [--dry]
 * 铁律：只改 m/kd 两个字段，不动 s/o/a/e；每题必须有明确的考点映射，映射不到的留在原地并报告 */
'use strict';
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = window.BANK;
const META = window.BANK_META;
const EXISTING_MAP = window.XK_QID_MIGRATE || {};
if (BANK.length < 3900) throw new Error('题库规模异常，拒绝执行');

function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
function qidOfQ(q) { return (q.m || 'M') + '-' + djb2((q.m || '') + '|' + (q.qt || '') + '|' + (q.s || '')); }

/* 与 M7/M8/M1 完全重复（规范化题干+选项集合 都相同）的 M9 副本 → 不改挂，已在排除清单 */
function optKeyOf(q) { return (q.o || []).map(o => String(o[1]).trim()).sort().join('|'); }
const dupKey = new Set();
BANK.forEach(q => {
  if (q.m === 'M7' || q.m === 'M8' || q.m === 'M1') {
    dupKey.add(String(q.s).trim().replace(/^【[^】]{1,24}】/, '').replace(/\s+/g, '') + '§' + optKeyOf(q));
  }
});

/* 考点映射规则：大数据主题护栏最先判（命中的留在 M9 不动）；先具体后一般 */
const M9GUARD = /大数据|HDFS|MapReduce|Spark|流处理|数据挖掘|可视化|数据采集|预处理|NoSQL|Hive|数据清洗|数据类型|Block/;
const RULES = [
  [/防火墙|IDS|IPS|WAF|DMZ|UTM|入侵|串联|旁路/, 'M7', '考点 4 · 常用网络安全设备'],
  [/密码|钓鱼|欺诈|诈骗|刷单|短信|社会工程/, 'M7', '考点 1 · 信息安全意识与常见网络欺诈'],
  [/加密|身份认证|数字证书|动态口令|生物特征/, 'M7', '考点 3 · 信息安全技术与常见威胁防御'],
  [/CIA|保密性|完整性|可用性|可控性|不可否认|安全的基本要素|等级保护|信息安全的基本概念/, 'M7', '考点 2 · 信息安全基本概念'],
  [/TensorFlow|PyTorch|Keras|scikit|框架|高层 ?API|Python ?库|模块名/, 'M8', '考点 8 · AI开发工具与框架'],
  [/图灵|AlphaGo|AIGC|人脸识别|语音助手|ChatGPT|医疗|英文缩写是|学科正式诞生|行业的应用|典型应用/, 'M8', '考点 6 · 人工智能发展历程与典型应用'],
  [/机器学习|神经网络|计算机视觉|自然语言|知识图谱|K-Means|监督|无监督|人工智能的关键技术|深度学习的主要任务/, 'M8', '考点 7 · 人工智能关键技术'],
];

const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', '考点目录.json'), 'utf8'));
const kdMap = cat.kd_label_map;

let moved = 0, kept = 0, unmapped = [], autoExcl = [];
const renames = {};
const detail = [];
BANK.forEach((q, i) => {
  if (q.m !== 'M9' || !/考点\s*11/.test(String(q.kd || ''))) return;
  const s = String(q.s).trim();
  if (M9GUARD.test(s)) { kept++; return; }  // 大数据主题护栏：留在 M9
  const norm = s.replace(/^【[^】]{1,24}】/, '').replace(/\s+/g, '');
  if (dupKey.has(norm + '§' + optKeyOf(q))) {
    // 干+选项与 M7/M8/M1 完全相同（全库真矛盾=0 ⇒ 答案必同 ⇒ 完全重复）→ 排除
    autoExcl.push({ qid: qidOfQ(q), i, reason: 'M9考点11错挂且与M7/M8题完全重复（同题干同选项），保留原模块版', });
    return;
  }
  const rule = RULES.find(([re]) => re.test(s));
  if (!rule) { unmapped.push({ i, qid: qidOfQ(q), s: s.slice(0, 36) }); return; }
  const [, nm, nkd] = rule;
  if (!kdMap[nm + '|' + nkd]) throw new Error('考点映射表无此键: ' + nm + '|' + nkd);
  const oldQid = qidOfQ(q);
  const oldM = q.m, oldKd = q.kd;
  q.m = nm; q.kd = nkd;
  const newQid = qidOfQ(q);
  // 新 qid 不得与库内已有题冲突（同模块同题型同题干 = 同干题已存在，M9 版冗余 → 排除）
  const clash = BANK.some((o, j) => j !== i && o.m === q.m && o.qt === q.qt && o.s === q.s);
  if (clash) {
    q.m = oldM; q.kd = oldKd;
    autoExcl.push({ qid: oldQid, i, reason: 'M9考点11错挂题，M7/M8 已存在同题干题（新qid冲突），M9 版冗余排除', });
    return;
  }
  renames[oldQid] = newQid;
  moved++;
  detail.push('i=' + i + ' ' + oldQid + ' → ' + newQid + ' [' + nkd + '] ' + s.slice(0, 24));
});

console.log(DRY ? '== DRY RUN ==' : '== 应用 ==');
console.log('改挂:', moved, '| 护栏留下:', kept, '| 自动排除(重复/冲突):', autoExcl.length, '| 映射不到:', unmapped.length);
detail.forEach(d => console.log('  ' + d));
unmapped.forEach(u => console.log('  ! 未映射:', JSON.stringify(u)));
autoExcl.forEach(u => console.log('  ⊖ 自动排除:', u.qid, '—', u.reason.slice(0, 40)));

if (DRY) process.exit(0);

/* 自动排除清单合并进 docs/人工审阅排除.json（按 qid 去重追加） */
if (autoExcl.length) {
  const exclPath = path.join(__dirname, '..', 'docs', '人工审阅排除.json');
  let list = [];
  try { list = JSON.parse(fs.readFileSync(exclPath, 'utf8')); } catch (e) { }
  const have = new Set(list.map(x => x.qid));
  autoExcl.forEach(x => { if (!have.has(x.qid)) { list.push({ qid: x.qid, i: x.i, reason: x.reason, source: 'refile-m9' }); have.add(x.qid); } });
  fs.writeFileSync(exclPath, JSON.stringify(list, null, 2), 'utf8');
  console.log('排除清单已更新:', exclPath, '（共', list.length, '条）');
}

/* 质检：重复ID / 答案 / 选项 / 缺解析 */
const ids = new Set(); let dupId = 0, noE = 0, badAns = 0, badOpt = 0;
BANK.forEach(q => {
  const id = q.m + '-' + djb2(q.m + '|' + q.qt + '|' + q.s);
  if (ids.has(id)) dupId++; ids.add(id);
  const ansOk = q.qt === '多选' ? q.a.split('').every(ch => q.o.some(o => o[0] === ch)) : q.o.some(o => o[0] === q.a);
  const optOk = q.qt === '判断' ? q.o.length === 2 : (q.o.length >= 3 && q.o.length <= 6);
  if (!ansOk) badAns++;
  if (!optOk) badOpt++;
  if (!q.e || !q.e.trim()) noE++;
});
console.log('质检 → 重复ID:', dupId, '| 答案异常:', badAns, '| 选项异常:', badOpt, '| 缺解析:', noE);
if (dupId || badAns || badOpt || noE) { console.error('!! 质检未通过，不写入'); process.exit(2); }

/* 迁移映射合并（链式接续既有映射） */
const mergedMap = Object.assign({}, EXISTING_MAP);
Object.keys(renames).forEach(oldQid => {
  const newQid = renames[oldQid];
  Object.keys(mergedMap).forEach(k => { if (mergedMap[k] === oldQid) mergedMap[k] = newQid; });
  delete mergedMap[newQid];
  mergedMap[oldQid] = newQid;
});

const out = '// 学考冲刺通题库 ' + BANK.length + ' 题（M9考点11错挂题改挂 M7/M8：moved=' + moved + '）\n'
  + 'window.BANK_VER=\'' + (window.BANK_VER || '20261111') + '\';\n'
  + 'window.BANK_META=' + JSON.stringify(META) + ';\n'
  + 'window.BANK=' + JSON.stringify(BANK) + ';\n'
  + 'window.XK_QID_MIGRATE=' + JSON.stringify(mergedMap) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data.js'), out, 'utf8');
console.log('WROTE src/data.js（迁移映射总数: ' + Object.keys(mergedMap).length + '）');
