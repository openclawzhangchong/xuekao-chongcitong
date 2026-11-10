/* 生成三方案介绍 HTML（截图 base64 内嵌，双击即看）到桌面
 * 用法：node tools/gen-variant-pages.js
 * 产物：桌面/学考冲刺通-方案A介绍.html 等 3 件 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'evidence', 'portal-variants');
const DESKTOP = 'C:/Users/Administrator/Desktop';
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64');

const DATA = {
  A: {
    file: '学考冲刺通-方案A介绍.html',
    title: '方案A · 分页式门户（紫色）',
    tag: '最稳 · 和网页版习惯一致',
    accent: '#7C3AED', accentD: '#5B21B6', bg: '#F5F3FF',
    shots: [
      ['01-portal-a.png', '门户首屏：6 个功能大卡 + 十章课件按钮，一屏看全'],
      ['02-courseware-a.png', '点「第一章」直达课件（181 页 · 考点覆盖 · 全屏投影）'],
      ['03-pk-route-a.png', '点「双人 PK」直达对战台（选手/题量/章节全可配）'],
    ],
    why: [
      '布局和你已经用了很久的网页版一样是「卡片+页签」习惯，第一次打开零学习成本——明天上课直接用，不用适应。',
      '所有入口平铺在一屏：刷题、PK、擂台、黑板、课堂互动、排行榜全是大按钮，投屏时学生也能看清你去哪了。',
      '课件按十章排布在下半屏，讲到哪章点哪章，和你的教学顺序完全对齐。',
    ],
    pros: ['零学习成本，习惯无缝衔接', '入口最全，一屏看尽', '浅色背景在明亮教室更清晰'],
    cons: ['视觉上最朴素，仪式感一般'],
    fit: '想「今天就能直接上课、不折腾」——选 A。',
  },
  B: {
    file: '学考冲刺通-方案B介绍.html',
    title: '方案B · 投影大师（深蓝金）',
    tag: '最燃 · 为大屏而生',
    accent: '#D4A017', accentD: '#F0C24B', bg: '#14263F',
    dark: true,
    shots: [
      ['04-portal-b.png', '门户首屏：全屏课件墙 + 右下三枚浮动圆按钮（课件/冲刺/对战）'],
      ['05-courseware-b.png', '课件直达，深色边框聚焦感强'],
      ['06-pk-route-b.png', 'PK 直达：浮动按钮切换不遮内容，随时换模式'],
    ],
    why: [
      '深蓝底+金字在教室投影和希沃大屏上对比度最高、反光最弱——后排学生看大字最清楚，这是三个方案里唯一为「投屏距离」优化的。',
      '右下角三枚半透明圆按钮切换「课件讲解 / 冲刺题库 / 课堂对战」三种模式，不占正文一寸空间；讲课时点一下就换场景，节奏不断。',
      '游戏感强（深蓝金配色接近电竞比分屏）：PK、擂台、排行榜这类荣誉环节的「燃」感最足，配合你说的缺内驱力群体。',
    ],
    pros: ['大屏可读性最佳', '模式切换最利落', '对战环节氛围最燃'],
    cons: ['深色底在强光教室稍吃环境光', '和网页版观感差异大，需要半节课适应'],
    fit: '想「投影效果炸裂、PK 环节有仪式感」——选 B。',
  },
  C: {
    file: '学考冲刺通-方案C介绍.html',
    title: '方案C · 讲练双栏（墨绿米白）',
    tag: '最实用 · 讲完就练',
    accent: '#2D5A3D', accentD: '#1F3F2B', bg: '#FFF8F0',
    shots: [
      ['07-portal-c.png', '门户首屏：左 60% 十章课件列表，右 40% 练习快捷面板'],
      ['08-courseware-c.png', '左栏点章节开课件讲解'],
      ['09-pk-route-c.png', '右栏点「双人 PK」直达对战台'],
    ],
    why: [
      '左讲右练同屏：讲完一个知识点，右手边立刻点「当堂刷题/错题特训」，不用来回切页面——最贴合「讲练结合」的课堂节奏。',
      '左栏章节列表按你实际教学顺序编号（1-7 章，讲解/练习分开），像课程表一样照着走；黑板和教师学情页固定在左下，板书不找入口。',
      '米白暖色调长时间看不累眼，上午连堂课舒服。',
    ],
    pros: ['讲练切换最快（同一屏内）', '结构像课程表，备课思路清晰', '暖色调护眼'],
    cons: ['入口比 A 少（次要功能收进「更多入口」）', '双栏在低分屏会压缩成一栏'],
    fit: '想「一节课讲练循环跑、节奏快」——选 C。',
  },
};

const myPick = '已选定方案A（2026-11-10）：默认构建即方案A（门户A+课件，标准命名）。B/C 作为备选保留在仓库 dist-client/ 可随时重打。三个方案功能 100% 一致（同一套题库/对战/课件/数据），只差门户样式。';

function page(v) {
  const d = DATA[v];
  const txt = d.dark ? '#EAE6DA' : '#233328';
  const card = d.dark ? 'rgba(255,255,255,.06)' : '#fff';
  const line = d.dark ? 'rgba(212,160,23,.35)' : '#DDD8C9';
  const mut = d.dark ? '#8FA3BC' : '#7A8A7E';
  const shots = d.shots.map(([f, cap]) =>
    '<figure><img src="' + b64(f) + '"><figcaption>' + cap + '</figcaption></figure>').join('\n');
  const why = d.why.map(w => '<li>' + w + '</li>').join('\n');
  const pros = d.pros.map(p => '<span class="pill good">✓ ' + p + '</span>').join('');
  const cons = d.cons.map(p => '<span class="pill bad">△ ' + p + '</span>').join('');
  const pick = myPick.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${d.title} · 介绍与真实截图</title>
<style>
:root{--acc:${d.accent};--accD:${d.accentD};--bg:${d.bg};--ink:${txt};--mut:${mut};--card:${card};--line:${line}}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,"Microsoft YaHei",sans-serif;background:var(--bg);color:var(--ink);line-height:1.7}
.wrap{max-width:960px;margin:0 auto;padding:36px 20px 60px}
.badge{display:inline-block;background:var(--acc);color:${d.dark ? '#14263F' : '#fff'};padding:3px 14px;border-radius:999px;font-size:14px}
h1{font-size:30px;margin:12px 0 4px}
h1 .tag{font-size:15px;color:var(--mut);font-weight:normal;margin-left:12px}
h2{font-size:20px;color:var(--accD);margin:30px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--acc)}
ul.why{padding-left:22px}
ul.why li{margin:10px 0;font-size:15px}
figure{margin:16px 0 26px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;box-shadow:0 3px 14px rgba(0,0,0,.08)}
figure img{width:100%;border-radius:8px;display:block}
figcaption{margin-top:10px;font-size:14px;color:var(--mut);text-align:center}
.pill{display:inline-block;padding:7px 14px;border-radius:999px;font-size:14px;margin:0 8px 8px 0}
.good{background:rgba(5,150,105,.12);color:#047857;border:1px solid rgba(5,150,105,.4)}
.bad{background:rgba(217,119,6,.12);color:#B45309;border:1px solid rgba(217,119,6,.4)}
.fitbox{background:var(--card);border:2px solid var(--acc);border-radius:14px;padding:18px 22px;margin-top:10px;font-size:16px}
.use{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 22px;font-size:14px;color:var(--mut)}
.use code{background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:1px 8px;color:var(--ink)}
.pick{margin-top:14px;padding:14px 18px;border-left:4px solid var(--acc);background:var(--card);border-radius:0 12px 12px 0;font-size:15px}
.foot{text-align:center;margin-top:34px;font-size:12px;color:var(--mut)}
</style>
</head>
<body>
<div class="wrap">
  <span class="badge">${v} 方案</span>
  <h1>${d.title}<span class="tag">${d.tag}</span></h1>
  <p style="color:var(--mut)">以下截图全部来自真实运行（E2E 18/18 通过后抓取），不是设计稿。</p>

  <h2>为什么这样设计</h2>
  <ul class="why">${why}</ul>

  <h2>真实运行截图</h2>
  ${shots}

  <h2>优缺点</h2>
  <div>${pros}${cons}</div>

  <div class="fitbox"><b>适合谁：</b>${d.fit}</div>

  <h2>怎么试用（都已在你桌面）</h2>
  <div class="use">
    免安装试：解压桌面 <code>学考冲刺通课堂版-方案${v}-免安装.zip</code> → 双击文件夹里的 <code>学考冲刺通.exe</code>（自动起服务并开门户）。<br>
    正式安装：双击 <code>学考冲刺通安装包-方案${v}.exe</code> → 装到 C:\\学考冲刺通（会覆盖旧版，学生数据不受影响）。<br>
    想直接对比门户页：本文件下方图片即三方案门户实际样子；也可以三个都装了试，选中的告诉我，我把它设为默认版。
  </div>

  <div class="pick">${pick}</div>

  <div class="foot">学考冲刺通 · 整合课堂版 · 3982 题 · E2E 18/18 通过 · 2026-11-10</div>
</div>
</body>
</html>`;
}

['A', 'B', 'C'].forEach(v => {
  const p = path.join(DESKTOP, DATA[v].file);
  fs.writeFileSync(p, page(v));
  console.log('OK ' + p + '  ' + Math.round(fs.statSync(p).size / 1024) + ' KB');
});
