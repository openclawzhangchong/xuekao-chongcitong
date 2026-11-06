/* v7 病态长选项修正生成器：node tools/gen-v7fix.js
 * 现场：9 道题的选项里被生成器塞进了整段案例（最长 126 字/项），
 *       四个选项只有结尾 2-6 字不同 → 投屏 1366×768 下面板缩到 16px 下限仍需滚动。
 * 修法：案例移进题干，选项只留区分点；混合题（案例尾 + 无关短语句）重做成四个平行说法。
 *       答案字母与语义一一对应，其中 1581 / 1583 原本有「两个都算错」的缺陷，一并修好。
 * 代价：题干变了 → 这 9 题 qid 变（djb2(m|qt|s)），旧→新映射写进 evidence 便于将来迁移。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// data.js 是浏览器脚本（window.BANK=...），用隔离上下文读，不在本进程作用域里执行
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'), sandbox, { filename: 'data.js' });
const BANK = sandbox.window.BANK;
if (BANK.length !== 3999) throw new Error('必须是 3999 题库，当前 ' + BANK.length);

const CASE_WANG = '小王在一个 APP 上注册了账号，不久接到电话，对方一语道破他的身份，让他登录短信中的网站填写身份证号码和银行卡等信息；他挂断电话后马上接到国家反诈中心来电，确认遭遇了网络诈骗';
const CASE_FISH = '收到陌生号码发来的短信："【安全中心】您的校园账号已被冻结，为避免影响成绩查询与选课，请立即登录 http://xxxxxx 解冻"';

// [i, 新题干, 新选项, 新解析(可省)]
const plan = [
  [1302,
    '【信息社会的特征和文化、道德、法律常识】（七）' + CASE_WANG + '。这一事件反映的负面影响是（ ）。',
    [['A', '信息犯罪'], ['B', '信息错误'], ['C', '信息不全'], ['D', '信息污染']]],
  [1580,
    '【信息安全意识与网络欺诈识别】' + CASE_WANG + '。这一事件反映的负面影响是（ ）。',
    [['A', '信息犯罪'], ['B', '信息污染'], ['C', '信息不全'], ['D', '信息错误']]],
  [1581,
    '【信息安全意识与网络欺诈识别】' + CASE_WANG + '。下列说法错误的是（ ）。',
    [['A', '这一事件属于信息犯罪'], ['B', '这一事件属于信息污染'],
     ['C', 'RSA 属于非对称加密算法'], ['D', '发送伪装成银行、运营商的虚假邮件或短信属于网络钓鱼']],
    '诈骗分子冒充身份、诱导小王填写银行卡等敏感信息，属于利用信息技术手段实施的违法犯罪行为，即信息犯罪，所以 A 正确。信息污染指虚假、有害信息的泛滥，与本案性质不符，B 是错误说法。C、D 本身表述正确且与本案无关。'],
  [1582,
    '【信息安全意识与网络欺诈识别】（一）' + CASE_FISH + '。最恰当的处理方式是（ ）。',
    [['A', '点击链接，输入学号和密码完成解冻'], ['B', '先在链接中只输入学号，不填密码'],
     ['C', '不点击链接，通过学校官网或教务处核实'], ['D', '转发到班级群，让同学帮忙操作']]],
  [1583,
    '【信息安全意识与网络欺诈识别】（一）' + CASE_FISH + '。下列说法错误的是（ ）。',
    [['A', '不应点击链接，可通过学校官网或教务处电话核实'],
     ['B', '病毒和蠕虫通过自我复制并传播到其他计算机，破坏系统功能或窃取数据'],
     ['C', '应直接点击链接，输入学号和密码完成解冻'],
     ['D', '发送伪装成银行、运营商的虚假邮件或短信是网络钓鱼的典型手段']],
    '这是典型的钓鱼短信——冒充"安全中心"诱导点击恶意链接。正确做法是不点链接，通过学校官网、教务处电话等已知可信渠道核实，因此 C「直接点击链接并输入学号密码」是错误说法。B、D 表述本身正确。'],
  [2762,
    '【常用网络命令】网络管理员排查网络故障时，通常按以下顺序使用命令：①查看本机网络配置 ②测试网络连通性 ③追踪数据包路径。对应的命令顺序是（ ）。',
    [['A', 'ipconfig、tracert、ping'], ['B', 'tracert、ping、ipconfig'],
     ['C', 'ping、ipconfig、tracert'], ['D', 'ipconfig、ping、tracert']]],
  [2763,
    '【常用网络命令】下列说法错误的是（ ）。',
    [['A', '排查故障宜先用 ipconfig 查看本机配置，再用 ping 测连通性，最后用 tracert 追踪路径'],
     ['B', '排查故障宜先用 ping 测试连通性，再用 ipconfig 查看本机配置，最后用 tracert 追踪路径'],
     ['C', '计算机网络共享的资源是计算机的软件、硬件与数据'],
     ['D', '广域网的英文简称是 WAN']],
    '排查网络故障的合理顺序是：先用 ipconfig 查看本机 IP 配置（确保有 IP 地址）→ 再用 ping 测试网络连通性（检查能否到达目标）→ 最后用 tracert 追踪数据包路径（定位故障节点）。B 把前两步颠倒，是错误说法；C、D 表述正确。'],
  [3082,
    '【5-3 常用网络协议】（七）Web 网站服务器所使用的 IP 地址是 192.168.50.12，TCP 端口号为 8080，访问该网站正确的 URL 是（ ）。',
    [['A', 'http://192.168.50.12'], ['B', 'https://192.168.50.12:443'],
     ['C', 'http://192.168.50.12:80'], ['D', 'http://192.168.50.12:8080']]],
  [3083,
    '【5-3 常用网络协议】（七）某 Web 服务器 IP 地址为 192.168.50.12，TCP 端口号为 8080。下列说法错误的是（ ）。',
    [['A', 'ipconfig /flushdns 的功能是刷新 DNS 缓存'], ['B', 'IP 属于 TCP/IP 体系结构中网络层的协议'],
     ['C', '访问该网站可用 http://192.168.50.12'], ['D', '访问该网站应使用 http://192.168.50.12:8080']],
    'URL 的标准格式是 协议://IP地址或域名:端口号/路径。服务器使用非默认端口 8080 时必须在 URL 中写明端口，浏览器不写端口默认走 80，因此 C 访问不到该网站，是错误说法；D 正确。A、B 表述本身正确。'],
];

function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }

const fixes = [], map = [];
plan.forEach(([i, s, o, e]) => {
  const q = BANK[i];
  if (!q) throw new Error('题号越界 i=' + i);
  const oldOptLen = Math.max.apply(null, q.o.map((x) => String(x[1] || '').length));
  if (oldOptLen < 80) throw new Error('i=' + i + ' 不是病态长选项题（最长选项 ' + oldOptLen + ' 字），别误改');
  // 答案字母必须在新选项里还在，且新选项必须互不相同
  const keys = o.map((x) => x[0]);
  if (new Set(keys).size !== keys.length) throw new Error('i=' + i + ' 新选项字母重复');
  if (keys.indexOf(q.a[0]) < 0) throw new Error('i=' + i + ' 答案字母 ' + q.a + ' 不在新选项里');
  if (new Set(o.map((x) => x[1])).size !== o.length) throw new Error('i=' + i + ' 新选项文本重复');
  const oldQid = q.m + '-' + djb2(q.m + '|' + q.qt + '|' + q.s);
  const newQid = q.m + '-' + djb2(q.m + '|' + q.qt + '|' + s);
  fixes.push({ i: i, field: 's', issue: '选项里重复整段案例（最长 ' + oldOptLen + ' 字/项），投屏一屏装不下', fix: s });
  fixes.push({ i: i, field: 'o', issue: '同上：选项只应保留区分点', fix: JSON.stringify(o) });
  if (e) fixes.push({ i: i, field: 'e', issue: '解析尾部粘着整段旧选项文本', fix: e });
  map.push({ i: i, m: q.m, qt: q.qt, ans: q.a, oldQid: oldQid, newQid: newQid, oldMaxOpt: oldOptLen,
    newMaxOpt: Math.max.apply(null, o.map((x) => x[1].length)), oldStem: q.s, newStem: s,
    oldOpts: q.o.map((x) => x[0] + '. ' + x[1]), newOpts: o.map((x) => x[0] + '. ' + x[1]),
    oldExp: q.e, newExp: e || q.e });
});

const outDir = path.join(__dirname, '..', 'evidence', 'qbank-audit');
fs.writeFileSync(path.join(outDir, 'v7-longopts.json'), JSON.stringify(fixes, null, 1), 'utf8');
let md = '# v7 病态长选项修正复核清单（9 题）\n\n'
  + '生成：`node tools/gen-v7fix.js` → 应用：`node tools/apply-v5fix.js v7-longopts.json`\n\n'
  + '为什么要改：这 9 题的四个选项里各塞了一整段案例（最长 126 字/项），只有结尾几个字不同。\n'
  + '1366×768 投屏下面板缩到 16px 下限仍然溢出，学生看不到 D 选项；且「四个选项读三遍同一段话」\n'
  + '本身不符合学考命题习惯。改法是把案例移进题干、选项只留区分点。\n\n'
  + '**代价（必须知道）**：题干变了 → 这 9 题的 qid（`djb2(m|qt|s)`）变了，\n'
  + '学生此前对这 9 题的作答记录会留在旧 qid 上（不再被抽到，不影响其余 3990 题）。\n'
  + '旧→新 qid 映射见本文末尾与 `v7-longopts-qidmap.json`。\n\n';
map.forEach((r, n) => {
  md += '## ' + (n + 1) + '. i=' + r.i + '　' + r.m + '　' + r.qt + '　答案 ' + r.ans + '\n\n';
  md += '- 最长选项：' + r.oldMaxOpt + ' 字 → ' + r.newMaxOpt + ' 字\n';
  md += '- 旧题干：' + r.oldStem + '\n- **新题干**：' + r.newStem + '\n\n';
  md += '| | 旧选项 | 新选项 |\n|---|---|---|\n';
  r.oldOpts.forEach((o, k) => {
    const onew = r.newOpts[k];
    md += '| ' + 'ABCD'[k] + ' | ' + o.slice(3) + ' | ' + onew.slice(3) + ' |\n';
  });
  if (r.oldExp !== r.newExp) md += '\n- 旧解析：' + r.oldExp + '\n- **新解析**：' + r.newExp + '\n';
  md += '\n- qid：`' + r.oldQid + '` → `' + r.newQid + '`\n\n';
});
fs.writeFileSync(path.join(outDir, 'v7-longopts-review.md'), md, 'utf8');
fs.writeFileSync(path.join(outDir, 'v7-longopts-qidmap.json'), JSON.stringify(map.map((r) => ({
  i: r.i, m: r.m, oldQid: r.oldQid, newQid: r.newQid, ans: r.ans
})), null, 1), 'utf8');
console.log('fixes:', fixes.length, '条（9 题）→ evidence/qbank-audit/v7-longopts.json');
console.log('复核清单 → v7-longopts-review.md，qid 映射 → v7-longopts-qidmap.json');
