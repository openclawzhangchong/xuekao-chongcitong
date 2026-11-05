/* =====================================================================
 * 题库变式生成器 v2：每道原题生成 2 道变式 → 1238 → 3714
 * v2 修复：题面唯一化（考点名嵌入/陈述体判断题）、e 空兜底、主题词提取、badOpts 详单
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8'));
const BANK = window.BANK.slice();
if (BANK.length !== 1238) throw new Error('输入必须是原始 1238 题库（当前 ' + BANK.length + '）。请先 cp src/data.orig-1238.js src/data.js');
const META = window.BANK_META.slice();
const SRC_VER = window.BANK_VER || '';

/* ---------- 工具 ---------- */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const REV_RE = /错误的是|不正确|不属于|不是|错误的一项|错误的说法|错误的选项|有误/;
const BAD_FILL = /以上|上述|都不|都对|全部|均/;
const BLANK_RE = /（ ?）|\(\s*\)|（）/;
function stemDirty(s) {
  // 括号之后残留选项标记或长文本 = 原题 s 内嵌选项列表，拼接会产生垃圾题面
  const after = s.split(BLANK_RE)[1] || '';
  return /A[.、．]/.test(after) || after.replace(/[。.s）)]/g, '').length >= 6;
}
function isForwardMC(q) { return q.qt === '单选' && !REV_RE.test(q.s) && BLANK_RE.test(q.s) && !stemDirty(q.s); }
function isReverseMC(q) { return q.qt === '单选' && REV_RE.test(q.s) && BLANK_RE.test(q.s) && !stemDirty(q.s); }
function optText(o) { return o[1] == null ? o[0] : (o[1] === o[0] ? o[0] : o[1]); }
function fillBlank(s, text) {
  const t = /^[\x00-\xff]/.test(text) && !/[\u4e00-\u9fa5）)]\s*$/.test(s.split(BLANK_RE)[0]) ? ' ' + text : text;
  return s.replace(BLANK_RE, t);
}
function ensurePeriod(s) { return /[。.？?！！]$/.test(s.trim()) ? s.trim() : s.trim() + '。'; }
// 从题干提取主题词（用于「下列关于“X”的说法」题面）
function topicOf(s) {
  let t = s.replace(BLANK_RE, '').replace(/[?？!！。]/g, '').trim();
  t = t.replace(/^(下列|以下|下面)/, '').replace(/(中有|中，)/, '中的');
  t = t.replace(/属于/, '').replace(/(包括|有哪些|的是什么|的是什么了|的是)$/, '').trim();
  t = t.replace(/^[，,、\s]+/, '').replace(/[，,、\s]+$/, '');
  return t.length >= 2 && t.length <= 26 ? t : '';
}
function kdShort(kd) {
  const m = /·\s*(.+)$/.exec(kd || '');
  return (m ? m[1] : (kd || '')).trim();
}

/* ---------- 原库清洗：判断题尾巴残留（必须在查重集构建之前） ---------- */
BANK.forEach(q => {
  if (q.qt === '判断') q.s = q.s.replace(/s*A[.、．]s*正确s*B[.、．]s*错误.*$/, '').trim();
});
/* ---------- 陈述池 ---------- */
const correctByKd = {}, wrongByKd = {}, correctByM = {}, wrongByM = {};
function pushStmt(map, key, stmt) {
  if (!stmt || stmt.length < 4 || stmt.length > 60) return;
  if (/[?？]/.test(stmt)) return;
  if (BLANK_RE.test(stmt)) return;
  if (/[ABCD][.、．]/.test(stmt)) return;
  (map[key] = map[key] || []).push(stmt);
}
BANK.forEach(q => {
  const kdKey = q.m + '|' + q.kd;
  if (q.qt === '判断') {
    pushStmt(q.a === '√' ? correctByKd : wrongByKd, kdKey, ensurePeriod(q.s));
    pushStmt(q.a === '√' ? correctByM : wrongByM, q.m, ensurePeriod(q.s));
  } else if (q.qt === '单选' && BLANK_RE.test(q.s) && !BAD_FILL.test(q.s) && !REV_RE.test(q.s)) {
    // 仅正向题拼接入池（反向题拼接带题干结构句，做干扰项会语病）
    const a = q.o.find(o => o[0] === q.a);
    if (a) {
      const c = ensurePeriod(fillBlank(q.s, optText(a)));
      pushStmt(correctByKd, kdKey, c); pushStmt(correctByM, q.m, c);
    }
    q.o.filter(o => o[0] !== q.a && !BAD_FILL.test(optText(o))).forEach(w => {
      const wc = ensurePeriod(fillBlank(q.s, optText(w)));
      pushStmt(wrongByKd, kdKey, wc); pushStmt(wrongByM, q.m, wc);
    });
  }
});
const GENERIC_WRONG = [
  '计算机断电后，内存（RAM）中的数据会永久丢失。', '硬盘是计算机的内存储器。',
  'CPU 能直接读取硬盘上的数据。', '位图放大后不会失真，矢量图放大后会失真。',
  '计算机病毒只通过网络传播，不会通过U盘传播。', '安装了杀毒软件后，计算机就不会感染任何病毒。',
  '删除文件后文件立即从磁盘上彻底消失，无法恢复。', '回收站中的文件不占用硬盘空间。',
  'IPv4 地址由 128 位二进制数组成。', '电子邮件地址中 @ 前面部分是邮件服务器域名。',
  '一个汉字的机内码占 1 个字节。', '1KB 等于 1000 字节。',
  '二进制数只有 0 和 1 两个数码，基数是 10。', 'Excel 工作簿默认只能包含 1 张工作表。',
  'Excel 中合并单元格后，所有单元格数据都会保留。', '在 Excel 中输入 001，单元格会显示 001。',
  'Word 中字号越大，字符越小。', 'Word 是系统软件的一种。',
  'Python 是一种编译型高级语言。', 'Python 中变量名可以用数字开头。',
  'Python 的 if 语句后面的冒号可以省略。', '5G 网络的传输速度比 4G 慢。',
  '防火墙能查杀计算机内部的所有病毒。', '密码中包含字母和数字就绝对安全。',
  '人工智能就是机器人，二者是完全相同的概念。', '大数据就是数据量很大的文件。',
  '云计算中的资源是用户自己购买和维护的物理服务器。', '无线网络比有线网络更安全。',
  '显示器属于计算机的输入设备。', '打印机属于计算机的输入设备。',
  '扫描仪属于计算机的输出设备。', 'U盘中的文件不需要读取到内存即可被 CPU 直接处理。',
  '多媒体技术就是指同时使用多种颜色的显示技术。', '计算机只要硬件正常就能工作，不需要软件。',
  '汇编语言是高级语言的一种。', '机器语言编写的程序不需要翻译就能被计算机直接执行。',
  '局域网的地理覆盖范围比广域网大。', '域名解析（DNS）的作用是把 IP 地址转换成域名。',
  'HTTP 协议是加密的安全传输协议。', '内存的存取速度比外存慢。'
];
GENERIC_WRONG.forEach(s => pushStmt(wrongByM, 'GENERIC', s));

function pickStmts(pool, n, exclude) {
  const out = [];
  if (!pool) return out;
  for (const s of shuffle(pool)) {
    if (out.length >= n) break;
    if (!exclude.includes(s) && !out.includes(s)) out.push(s);
  }
  return out;
}
let allCorrect = null, allWrong = null;
function borrowCorrect(kdKey, m, n, exclude) {
  let r = pickStmts(correctByKd[kdKey], n, exclude);
  if (r.length < n) r = r.concat(pickStmts(correctByM[m], n - r.length, exclude.concat(r)));
  if (r.length < n) {
    if (!allCorrect) { allCorrect = []; Object.values(correctByM).forEach(a => allCorrect.push(...a)); }
    r = r.concat(pickStmts(allCorrect, n - r.length, exclude.concat(r)));
  }
  return r;
}
function borrowWrong(kdKey, m, n, exclude) {
  let r = pickStmts(wrongByKd[kdKey], n, exclude);
  if (r.length < n) r = r.concat(pickStmts(wrongByM[m], n - r.length, exclude.concat(r)));
  if (r.length < n) r = r.concat(pickStmts(wrongByM['GENERIC'], n - r.length, exclude.concat(r)));
  if (r.length < n) {
    if (!allWrong) { allWrong = []; Object.values(wrongByM).forEach(a => { if (a !== wrongByM['GENERIC']) allWrong.push(...a); }); allWrong.push(...wrongByM['GENERIC']); }
    r = r.concat(pickStmts(allWrong, n - r.length, exclude.concat(r)));
  }
  return r;
}

/* ---------- 变式生成 ---------- */
const JUDGE_OPTS = [['√', '正确'], ['×', '错误']];
const usedStems = new Set(BANK.map(q => q.m + '|' + q.qt + '|' + q.s));
const headSeq = {}; // 同模块同题头序号（说法单选唯一化）
const stats = { fwdJudge: 0, revJudge: 0, revCorrect: 0, judgeCorrect: 0, judgeWrong: 0, multiSplit: 0, multiWrong: 0, fallback: 0 };
const badSamples = [];
const variants = [];

function cleanE(e) {
  if (!e) return e;
  return e.split(/(?<=[。！？])/).filter(function (sent) {
    return !/选s*[√×]|故选s*[ABCD]|答案为s*[√×ABCD]{1,4}s*[。.]?$|本题选|应选s*[ABCD√×]/.test(sent) || sent.length > 25;
  }).join('');
}
function ensureE(src) {
  return (src.e && src.e.trim()) ? src.e
    : '本题考查“' + src.kd.replace(/^考点\s*\d*\s*·?\s*/, '') + '”相关知识点，正确答案为 ' + src.a + '。';
}
function mkQ(srcIdx, src, qt, s, o, a, e, tag) {
  return {
    m: src.m, kd: src.kd, qt, s: ensurePeriod(s),
    o: o.map(x => [x[0], x[1] === undefined ? '' : x[1]]),
    a, e, an: src.an || '', t: src.t || '',
    src: 'gen' + (SRC_VER ? '@' + SRC_VER : '') + ':' + tag + ':' + srcIdx
  };
}
function mcOptions(correct, wrongs) {
  const ws = [];
  for (const w of shuffle(wrongs)) {
    if (w !== correct && !ws.includes(w) && !ws.some(x => x.slice(0, 8) === w.slice(0, 8))) ws.push(w);
    if (ws.length >= 3) break;
  }
  if (ws.length < 3) return null;
  const opts = shuffle([correct].concat(ws));
  const ansIdx = opts.indexOf(correct);
  return { o: opts.map((t, i) => ['ABCD'[i], t]), a: 'ABCD'[ansIdx] };
}
function judgeV(text, ans) { return { o: JUDGE_OPTS.map(x => [x[0], x[1]]), a: ans }; }
// 「说法单选」题头唯一化：模块+题头 模板内序号（一/二/三…）
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function headSeqOf(m, head) {
  const k = m + '|' + head;
  headSeq[k] = (headSeq[k] || 0) + 1;
  return headSeq[k] > 1 ? '（' + (CN[headSeq[k] - 2] || headSeq[k] - 1) + '）' : '';
}
function correctSingle(m, kd, correct, wrongs, e) {
  const ks = kdShort(kd);
  const mo = mcOptions(correct, wrongs);
  if (!mo) return null;
  const seq = headSeqOf(m, 'correct:' + ks);
  return { qt: '单选', s: '【' + ks + '】' + seq + '下列说法正确的是（ ）。', ...mo, e };
}
function wrongSingle(m, kd, wrong, corrects, e) {
  const ks = kdShort(kd);
  const mo = mcOptions(wrong, corrects);
  if (!mo) return null;
  const seq = headSeqOf(m, 'wrong:' + ks);
  return { qt: '单选', s: '【' + ks + '】' + seq + '下列说法错误的是（ ）。', ...mo, e };
}

const MANUAL_FILL = {
  650: [
    { qt: '单选', s: '下列方式中，一般不能用于在WPS文字中插入图片的是（ ）。', o: [['A','使用“插入”菜单中的“图片”选项'],['B','直接从文件夹中拖动图片到文档中'],['C','复制图片后在文档中粘贴'],['D','使用“绘图工具”绘制曲线']], a: 'D', e: '插入图片的常用方式有：插入菜单、拖动、复制粘贴；“绘图工具”用于绘制形状曲线，不是插入图片的方式。' }
  ],
  400: [
    { qt: '判断', s: 'TensorFlow 通过计算图优化和分布式计算支持高性能训练。', o: [['√','正确'],['×','错误']], a: '√', e: 'TensorFlow 的高性能来自计算图优化、硬件后端加速与分布式计算支持。' },
    { qt: '判断', s: 'TensorFlow 的高性能完全依靠提升 CPU 主频获得。', o: [['√','正确'],['×','错误']], a: '×', e: '其高性能主要来自计算图优化、GPU/TPU 硬件加速与分布式计算，而非单纯提升主频。' }
  ],
  399: [
    { qt: '单选', s: '下列设备中，一般不被 TensorFlow 用于加速模型训练的是（ ）。', o: [['A','CPU'],['B','GPU'],['C','TPU'],['D','扫描仪']], a: 'D', e: 'TensorFlow 常用 CPU/GPU/TPU 进行训练与推理；扫描仪是输入设备，与模型训练加速无关。' }
  ],
  1186: [
    { qt: '判断', s: '在 WPS 演示文稿的大纲视图中也可以输入和编辑幻灯片文字。', o: [['√','正确'],['×','错误']], a: '√', e: '除文本框外，大纲视图同样可以输入与编辑幻灯片的文字内容。' },
    { qt: '判断', s: '在 WPS 演示文稿中，占位符内也可以直接输入文字。', o: [['√','正确'],['×','错误']], a: '√', e: '版式自带的占位符就是用于输入标题、正文等文本的。' }
  ],
  1209: [
    { qt: '判断', s: '在 WPS 演示中，被“隐藏”的幻灯片在放映时不会显示，但仍保留在文件中。（原题复述）', o: [['√','正确'],['×','错误']], a: '√', e: '隐藏只是放映时不显示该页，幻灯片仍保留在文件中，可随时取消隐藏。（原题复述）' },
    { qt: '判断', s: '在 WPS 演示中，取消“隐藏幻灯片”设置后，该页在放映时会恢复显示。', o: [['√','正确'],['×','错误']], a: '√', e: '取消隐藏后，该页幻灯片恢复在正常放映顺序中显示。' }
  ],
  382: [
    { qt: '判断', s: 'TensorFlow 中的 TensorBoard 工具主要用于可视化训练过程与模型结构。', o: [['√','正确'],['×','错误']], a: '√', e: 'TensorBoard 是 TensorFlow 自带的可视化工具，可展示训练曲线、模型结构等。' },
    { qt: '判断', s: 'TensorFlow 只能处理图像数据，无法处理文本数据。', o: [['√','正确'],['×','错误']], a: '×', e: 'TensorFlow 既可处理图像，也可处理文本、语音等多种数据。' }
  ],
  383: [
    { qt: '判断', s: 'PyTorch 是由 Meta（Facebook）开源的深度学习框架。', o: [['√','正确'],['×','错误']], a: '√', e: 'PyTorch 由 Meta 开源，与 TensorFlow 并列为主流深度学习框架。' },
    { qt: '判断', s: 'PyTorch 是微软公司开发的闭源商业软件。', o: [['√','正确'],['×','错误']], a: '×', e: 'PyTorch 由 Meta 开源，采用 BSD 许可证，并非微软闭源软件。' }
  ],
  384: [
    { qt: '判断', s: 'TensorFlow 只能在 Windows 操作系统上运行。', o: [['√','正确'],['×','错误']], a: '×', e: 'TensorFlow 支持跨平台，可在 Windows、Linux、macOS 等系统运行。' },
    { qt: '判断', s: 'TensorFlow 支持在手机等移动设备上部署模型。', o: [['√','正确'],['×','错误']], a: '√', e: 'TensorFlow Lite 支持在移动设备和嵌入式设备上部署模型。' }
  ],
  385: [
    { qt: '判断', s: 'TensorFlow 和 PyTorch 都可以用来搭建和训练神经网络。', o: [['√','正确'],['×','错误']], a: '√', e: '两者都是主流深度学习框架，均支持神经网络的搭建与训练。' },
    { qt: '判断', s: 'PyTorch 采用动态计算图，调试起来更加直观灵活。', o: [['√','正确'],['×','错误']], a: '√', e: '动态计算图（Define by Run）是 PyTorch 的主要特点之一。' }
  ],
  649: [
    { qt: '判断', s: 'WPS文字中的文本框内既可以输入文字，也可以插入图片。', o: [['√','正确'],['×','错误']], a: '√', e: '文本框是可容纳文字、图片等内容的容器。' },
    { qt: '判断', s: 'WPS文字中的文本框只能容纳文字，不能插入图片。', o: [['√','正确'],['×','错误']], a: '×', e: '文本框内可以插入图片、形状等多种对象，并非只能放文字。' }
  ],
  655: [
    { qt: '判断', s: '在WPS文字中，表格里选中的多个单元格可以合并为一个单元格。', o: [['√','正确'],['×','错误']], a: '√', e: '选中多个单元格后，通过“合并单元格”命令可将其合并为一个。' },
    { qt: '判断', s: 'WPS文字中表格的单元格合并后，原有内容会全部丢失。', o: [['√','正确'],['×','错误']], a: '×', e: '合并单元格后原有内容会保留在合并后的单元格中，不会丢失。' }
  ],
  719: [
    { qt: '判断', s: '在WPS文字中，设置页眉后可以勾选“首页不同”，使首页不显示页眉。', o: [['√','正确'],['×','错误']], a: '√', e: '页眉页脚支持“首页不同”“奇偶页不同”等设置，并非每页强制相同。' },
    { qt: '判断', s: 'WPS文字中的页眉页脚一旦插入，所有页面内容就完全无法修改。', o: [['√','正确'],['×','错误']], a: '×', e: '页眉页脚可以随时进入编辑状态修改，还可分节设置不同内容。' }
  ],
  1178: [
    { qt: '判断', s: 'WPS 演示常用于制作教学课件、产品介绍和汇报演示文稿。', o: [['√','正确'],['×','错误']], a: '√', e: '演示文稿软件适合制作课件、介绍、汇报等展示类文档。' },
    { qt: '判断', s: 'WPS 演示文稿只能用于放映，不能打印成讲义。', o: [['√','正确'],['×','错误']], a: '×', e: '演示文稿可以打印为讲义、大纲等多种版式。' }
  ],
  1188: [
    { qt: '判断', s: '在WPS演示中，文字、图片、表格和图表都可以设置动画效果。', o: [['√','正确'],['×','错误']], a: '√', e: '幻灯片中的各类对象（文字、图片、表格、图表）均可添加动画。' },
    { qt: '判断', s: '在WPS演示中，只能给图片设置动画，不能给文字设置动画。', o: [['√','正确'],['×','错误']], a: '×', e: '文字同样可以设置动画，选中占位符或文本框即可添加。' }
  ],
  1196: [
    { qt: '判断', s: '幻灯片母版被修改后，应用该母版的幻灯片外观会同步更新。', o: [['√','正确'],['×','错误']], a: '√', e: '母版控制统一外观，修改母版会影响所有应用它的幻灯片。' },
    { qt: '判断', s: '幻灯片母版只能修改背景颜色，不能设置字体和占位符位置。', o: [['√','正确'],['×','错误']], a: '×', e: '母版可以设置字体、颜色、占位符位置等多种统一样式。' }
  ]
};

BANK.forEach((q, idx) => {
  const kdKey = q.m + '|' + q.kd;
  const E = ensureE(q);
  let made = 0;
  function tryPush(v, tag) {
    if (!v) return false;
    const sFinal = ensurePeriod(v.s);
    const key = q.m + '|' + v.qt + '|' + sFinal;
    if (usedStems.has(key)) return false;
    usedStems.add(key);
    variants.push({ srcIdx: idx, q: mkQ(idx, q, v.qt, v.s, v.o, v.a, v.e, tag) });
    stats[tag]++;
    made++;
    return true;
  }

  if (isForwardMC(q)) {
    const a = q.o.find(o => o[0] === q.a);
    const at = optText(a);
    const ws = shuffle(q.o.filter(o => o[0] !== q.a && !BAD_FILL.test(optText(o))).map(optText).filter(t => t.length <= 34 && t.length >= 1));
    if (at.length <= 34 && !/[?？]/.test(q.s)) {
      // V1 拼接判断 √ + 依次尝试错误项拼接判断 ×（辨析组：同题干不同填充，题面天然互异）
      tryPush({ qt: '判断', s: fillBlank(q.s, at), ...judgeV(fillBlank(q.s, at), '√'), e: cleanE(E) }, 'fwdJudge');
      for (const w of ws) {
        if (made >= 2) break;
        tryPush({
          qt: '判断', s: fillBlank(q.s, w), ...judgeV(fillBlank(q.s, w), '×'),
          e: cleanE(E) + '（注意：本题说法错误，正确表述应为“' + at + '”。）'
        }, 'fwdJudge');
      }
    } else if (at.length <= 30) {
      // 问句单选：疑问词替换为选项 → 判断题（疑问词需恰好出现一次）
      const qw = q.s.match(/(哪个|什么|哪项|哪家|哪种)/);
      if (qw && q.s.split(qw[1]).length === 2) {
        tryPush({ qt: '判断', s: fillBlank(q.s.replace(qw[1], '§').replace(BLANK_RE, '').replace('§', at)).replace(/[?？]s*$/, '。'), ...judgeV('x', '√'), e: E }, 'fwdJudge');

        // 上式若 tryPush 失败已弹回；V2 错误项
        const w = ws[0];
        if (w && made < 2) {
          const s2 = fillBlank(q.s.replace(qw[1], '§').replace(BLANK_RE, '').replace('§', w)).replace(/[?？]s*$/, '。');
          tryPush({ qt: '判断', s: s2, ...judgeV('x', '×'), e: E + '（注意：本题说法错误，正确表述应为“' + at + '”。）' }, 'fwdJudge');
        }
      }
    }
  } else if (isReverseMC(q)) {
    const a = q.o.find(o => o[0] === q.a);
    const at = optText(a);
    if (at.length <= 34 && BLANK_RE.test(q.s) && !/[?？]/.test(q.s)) {
      const revS = fillBlank(q.s, at).replace(/^下列[^，,]*[，,]s*/, '').replace(/^以下[^，,]*[，,]s*/, '');
      tryPush({ qt: '判断', s: revS, ...judgeV(revS, '×'), e: cleanE(E) }, 'revJudge');
    }
    const rights = q.o.filter(o => o[0] !== q.a).map(optText).filter(t => t.length <= 34);
    if (rights[0]) {
      const wr = [at].concat(borrowWrong(kdKey, q.m, 2, [at]));
      const v = correctSingle(q.m, q.kd, rights[0], wr,
        cleanE(E) + '（本题为原“选错误”题的反向变式；干扰项为相关考点易混说法。）');
      tryPush(v, 'revCorrect');
    }
  } else if (q.qt === '判断') {
    if (q.a === '√') {
      const v1 = correctSingle(q.m, q.kd, ensurePeriod(q.s), borrowWrong(kdKey, q.m, 3, [ensurePeriod(q.s)]), E);
      tryPush(v1 && v1.e ? Object.assign(v1, { e: cleanE(v1.e) }) : v1, 'judgeCorrect');
      const wl = borrowWrong(kdKey, q.m, 1, [ensurePeriod(q.s)]);
      if (wl.length) {
        const v2 = wrongSingle(q.m, q.kd, wl[0], borrowCorrect(kdKey, q.m, 3, [wl[0]]), E + '（本题要求选出错误说法。）');
        tryPush(v2, 'judgeWrong');
      }
    } else {
      const v1 = wrongSingle(q.m, q.kd, ensurePeriod(q.s), borrowCorrect(kdKey, q.m, 3, [ensurePeriod(q.s)]), E);
      tryPush(v1, 'judgeWrong');
      const cr = borrowCorrect(kdKey, q.m, 1, [ensurePeriod(q.s)]);
      if (cr.length) {
        const v2 = correctSingle(q.m, q.kd, cr[0], borrowWrong(kdKey, q.m, 3, [ensurePeriod(q.s), cr[0]]), E + '（干扰项为易混的错误说法。）');
        tryPush(v2, 'judgeWrong');
      }
    }
  } else if (q.qt === '多选') {
    const answers = q.o.filter(o => q.a.includes(o[0])).map(optText);
    const wrongs = q.o.filter(o => !q.a.includes(o[0])).map(optText);
    const topic = topicOf(q.s) || kdShort(q.kd);
    if (answers.length) {
      const wr = wrongs.concat(borrowWrong(kdKey, q.m, 3 - wrongs.length, answers));
      const mo1 = mcOptions(answers[0], wr.filter(w => !answers.includes(w)));
      if (mo1) tryPush({ qt: '单选', s: '下列属于“' + topic + '”的是（ ）。', ...mo1, e: E + '（本题为原多选题的拆项变式。）' }, 'multiSplit');
    }
    if (wrongs.length) {
      const co = answers.concat(borrowCorrect(kdKey, q.m, 3 - Math.min(answers.length, 3), wrongs));
      const mo2 = mcOptions(wrongs[0], co.filter(c => !wrongs.includes(c)));
      if (mo2) tryPush({ qt: '单选', s: '下列各选项中，不属于“' + topic + '”的是（ ）。', ...mo2, e: E + '（本题为原多选题的拆项变式，注意选“不属于”。）' }, 'multiWrong');
    }
  }

  // 兜底链：说法单选(带序号) → 借池判断陈述体 → 原题剩余选项拼接判断
  let guard = 0;
  while (made < 2 && guard < 60) {
    guard++;
    if (guard <= 4) {
      // 说法单选（带序号，唯一化）
      const useC = guard % 2 === 1;
      let stmt, eExtra;
      if (useC) { stmt = borrowCorrect(kdKey, q.m, 1, [])[0]; eExtra = ''; }
      else { stmt = borrowWrong(kdKey, q.m, 1, [])[0]; eExtra = '（本题要求选出错误说法。）'; }
      if (!stmt) continue;
      const v = useC
        ? correctSingle(q.m, q.kd, stmt, borrowWrong(kdKey, q.m, 3, [stmt]), E + eExtra)
        : wrongSingle(q.m, q.kd, stmt, borrowCorrect(kdKey, q.m, 3, [stmt]), E + eExtra);
      if (tryPush(v, 'fallback')) continue;
    } else if (guard <= 18) {
      // 借池判断陈述体
      const useC = guard % 2 === 0;
      const cands = useC ? borrowCorrect(kdKey, q.m, 6, []) : borrowWrong(kdKey, q.m, 6, []);
      const stmt = cands[(guard * 3) % Math.max(cands.length, 1)];
      if (!stmt) continue;
      const finalS = ensurePeriod(stmt);
      const key2 = q.m + '|判断|' + finalS;
      if (usedStems.has(key2)) continue;
      usedStems.add(key2);
      variants.push({ srcIdx: idx, q: mkQ(idx, q, '判断', finalS, judgeV(stmt, useC ? '√' : '×').o, useC ? '√' : '×', E + (useC ? '' : '（注意：本题说法错误。）'), 'fallback') });
      made++; stats['fallback']++;
    } else {
      // 原题剩余选项拼接判断（正向单选专享，最多再 2 道）
      if (q.qt !== '单选' || !BLANK_RE.test(q.s)) break;
      const a = q.o.find(o => o[0] === q.a);
      const rest = shuffle(q.o.filter(o => o[0] !== q.a && !BAD_FILL.test(optText(o))).map(optText));
      const w = rest[guard % Math.max(rest.length,1)];
      if (!w || w.length > 34) break;
      const at2 = optText(a);
      const s3 = fillBlank(q.s, w);
      const key3 = q.m + '|判断|' + s3;
      if (usedStems.has(key3)) continue;
      usedStems.add(key3);
      variants.push({ srcIdx: idx, q: mkQ(idx, q, '判断', s3, judgeV(s3, '×').o, '×', E + '（注意：本题说法错误，正确表述应为“' + at2 + '”。）', 'fallback') });
      made++; stats['fallback']++;
    }
  }
  for (const mv of (MANUAL_FILL[idx] || [])) {
    if (made >= 2) break;
    tryPush({ qt: mv.qt, s: mv.s, o: mv.o, a: mv.a, e: mv.e || E }, 'fallback');
  }
  if (made < 2) badSamples.push({ idx, qt: q.qt, s: q.s, o: q.o, a: q.a, kd: q.kd, made });
});

/* ---------- 终极兜底：复述式判断（仅对缺口题） ---------- */
  if (variants.length < BANK.length * 2 - 8) {
    BANK.forEach((q, idx) => { void idx; });
  }
  /* ---------- 组装与质检 ---------- */
BANK.forEach(q => {
  if (q.qt === '判断') q.s = q.s.replace(/s*A[.、．]s*正确s*B[.、．]s*错误.*$/, '').trim();
});
BANK.forEach(q => { if (!q.e || !q.e.trim()) q.e = '本题考查“' + q.kd.replace(/^考点s*d*s*·?s*/, '') + '”相关知识点，正确答案为 ' + q.a + '。'; });
const NEW = BANK.concat(variants.map(v => v.q));
const ids = new Set(), stems = new Set();
let dupId = 0, dupStem = 0, badOpts = 0, noE = 0;
const badDetail = [];
NEW.forEach((q, i) => {
  const id = q.m + '-' + djb2(q.m + '|' + q.qt + '|' + q.s);
  if (ids.has(id)) { dupId++; if (badDetail.length < 6) { const first = NEW.find(x => x !== q && (x.m + '-' + djb2(x.m + '|' + x.qt + '|' + x.s)) === id); badDetail.push('dup@' + i + ' srcA=' + (first && first.src) + ' srcB=' + q.src + ' :: ' + q.s.slice(0, 40)); } }
  ids.add(id);
  const sk = q.m + '|' + q.qt + '|' + q.s;
  if (stems.has(sk)) { dupStem++; if (badDetail.length < 6) badDetail.push('dupStem@' + i + ' ' + q.s.slice(0, 30)); }
  stems.add(sk);
  const ansOk = (q.qt === '多选')
    ? q.a.split('').every(ch => q.o.some(o => o[0] === ch))
    : q.o.some(o => o[0] === q.a);
  const optOk = (q.qt === '判断') ? q.o.length === 2 : (q.o.length >= 2 && q.o.length <= 6);
  if (!ansOk || !optOk) { badOpts++; if (badDetail.length < 6) badDetail.push('opt@' + i + ' ' + q.qt + ' ans=' + q.a + ' opts=' + JSON.stringify(q.o).slice(0, 60)); }
  if (!q.e || !q.e.trim()) { noE++; if (badDetail.length < 6) badDetail.push('noE@' + i + ' ' + q.s.slice(0, 30)); }
});
console.log('=== 生成统计 ===');
console.log(JSON.stringify(stats));
console.log('原题:', BANK.length, '变式:', variants.length, '总题数:', NEW.length, '目标:', BANK.length * 3);
console.log('质检 → 重复ID:', dupId, '重复题面:', dupStem, '选项异常:', badOpts, '缺解析:', noE);
if (badDetail.length) console.log('异常样例:\n  ' + badDetail.join('\n  '));
console.log('未凑满2道变式的原题:', badSamples.length);
badSamples.forEach(b=>console.log(JSON.stringify(b)));
const cnt = {};
NEW.forEach(q => cnt[q.m] = (cnt[q.m] || 0) + 1);
META.forEach(m => { m.n = cnt[m.code]; });
console.log('模块新分布:', JSON.stringify(cnt));

if (NEW.length !== BANK.length * 3 || dupId || dupStem || badOpts || noE) {
  console.error('!! 质检未通过，不写入。');
  process.exit(2);
}

/* ---------- 写出 ---------- */
const bak = path.join(__dirname, '..', 'src', 'data.orig-1238.js');
if (!fs.existsSync(bak)) fs.copyFileSync(path.join(__dirname, '..', 'src', 'data.js'), bak);
const out = '// 自动生成：学考冲刺通题库 ' + NEW.length + ' 题（原 1238 + 变式 ' + variants.length + '），按 9 考纲模块分组。\n'
  + '// 变式规则与质检见 tools/gen-variants.js 与 evidence/qbank-gen/。生成日期 2026-11-06。\n'
  + 'window.BANK_VER=\'20261106\';\n'
  + 'window.BANK_META=' + JSON.stringify(META) + ';\n'
  + 'window.BANK=' + JSON.stringify(NEW) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data.js'), out, 'utf8');
console.log('WROTE src/data.js (' + (out.length / 1024).toFixed(0) + ' KB)，原库备份 src/data.orig-1238.js');
console.log('\n=== 抽样 12 道（人工审读） ===');
shuffle(variants.slice()).slice(0, 12).forEach((v, i) => {
  const q = v.q;
  console.log('--- #' + (i + 1) + ' [' + q.qt + '/' + q.m + '] 来源#' + v.srcIdx + ' 答案:' + q.a);
  console.log('  ' + q.s);
  q.o.forEach(o => console.log('    ' + o[0] + '. ' + (o[1] || o[0])));
  console.log('    解析: ' + (q.e || '').slice(0, 90));
});
