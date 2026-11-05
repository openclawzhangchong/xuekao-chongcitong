/* 构建脚本：把 style.css + engine.js + data.js + app.js 内嵌进单文件 HTML
 * 用法：node src/build.js [输出路径]
 * 构建时校验：题库 ID 唯一性、内嵌脚本无 </script> 破坏 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname);
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

const css = read('style.css');
const engine = read('engine.js');
const data = read('data.js');
const app = read('app.js');
const praise = read('praise.js');
const sfx = read('sfx.js');

// ---- 构建期校验 ----
global.window = {};
eval(engine);
eval(data);
const ids = new Set(window.BANK.map(q => window.XK.qidOf(q)));
if (ids.size !== window.BANK.length) throw new Error('题库 ID 冲突: ' + ids.size + ' != ' + window.BANK.length);
if (window.BANK_META.length !== 9) throw new Error('模块数异常');
const total150 = window.BANK_META.reduce((x, m) => x + m.score, 0);
if (total150 !== 150) throw new Error('考纲总分异常: ' + total150);

[engine, data, app].forEach((code, i) => {
  if (/<\/script/i.test(code)) throw new Error('内嵌脚本含 </script>，会破坏 HTML（脚本#' + i + '）');
});

const splitMode = process.argv.includes('--split');
const outArg = process.argv.slice(2).find(a => !a.startsWith('--'));
const out = outArg || path.join(SRC, '..', 'dist', '学考冲刺通.html');
const SPLIT_HEAD = '<' + 'script>window.BANK_VER=\'20261106\';<' + '/script>\n' +
  '<' + 'script src="data.js"><' + '/script>';
const dataBlock = '<' + 'script>\n${data}\n<' + '/script>';
const dataTag = splitMode ? SPLIT_HEAD : dataBlock;
const bankVerJson = splitMode ? JSON.stringify('20261106') : '';
const metaJson = splitMode ? JSON.stringify(window.BANK_META) : '';
const tpl = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>学考冲刺通 · 信息技术基础（福建中职学考）</title>
<style>
${css}
</style>
</head>
<body>
<div class="app">

  <!-- ============ 首页 ============ -->
  <div id="home" class="panel hidden">
    <header>
      <div style="flex:1">
        <div class="h-title">🎯 学考冲刺通</div>
        <div class="h-sub">信息技术基础 · 福建中职学考 150 分制</div>
      </div>
      <button class="h-btn" id="bigBtnHome">🖥 课堂投屏</button>
    </header>
    <div class="wrap">
      <div id="clsBar" class="clsbar hidden"></div>
      <div class="card hero-grad score-hero">
        <div class="big"><span id="estScore">0</span><small> / 150</small></div>
        <div class="cap" id="estCap">刷题后自动按 9 模块考纲分值预估你的学考分</div>
        <div id="sparkBox"></div>
        <div class="hero-stats">
          <div class="hstat"><div class="v" id="hsStreak">0</div><div class="l">连续打卡(天)</div></div>
          <div class="hstat"><div class="v" id="hsToday">0</div><div class="l">今日已刷(题)</div></div>
          <div class="hstat"><div class="v" id="hsCover">0</div><div class="l">题库覆盖</div></div>
        </div>
      </div>

      <div class="grid4">
        <div class="entry" id="entCardPractice">
          <div class="ic">📝</div><div class="nm">开始刷题</div>
          <div class="ds">选章节题型 · 即时判分</div>
          <span class="bd">1238 题</span>
        </div>
        <div class="entry" id="entCardSim">
          <div class="ic">🎯</div><div class="nm">模拟考</div>
          <div class="ds">按考纲分值智能组卷</div>
          <span class="bd" id="entSim">150 分 · 仿真卷</span>
        </div>
        <div class="entry" id="entCardWrong">
          <div class="ic">📕</div><div class="nm">错题本</div>
          <div class="ds">连对 2 次自动毕业</div>
          <span class="bd" id="entWrong">…</span>
        </div>
        <div class="entry" id="entCardDiag">
          <div class="ic">📊</div><div class="nm">考点诊断</div>
          <div class="ds">133 个考点掌握度</div>
          <span class="bd" id="entDiag">…</span>
        </div>
      </div>

      <div class="card" style="margin-top:13px">
        <div class="sec-t"><span class="dot"></span>🎓 课堂互动（投屏上课用）</div>
        <div class="muted" id="rosterCount">尚未导入名单</div>
        <textarea class="roster-box" id="rosterText" placeholder="每行一个学生，支持两种格式：
张三
2025001,李四
2025002 王五
# 号开头是注释">
        </textarea>
        <div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">
          <button class="mini-btn" id="rosterSave">💾 保存名单</button>
          <button class="mini-btn" id="rosterClear">🗑 清空</button>
          <label class="mini-btn" style="display:inline-block">📄 导入TXT/CSV<input type="file" id="rosterFile" accept=".txt,.csv" class="hidden"></label>
          <button class="mini-btn" id="rosterFetch">☁️ 从云端班级拉取</button>
        </div>
        <div class="hint">云端拉取需教师密钥；也可从教师学情页点「📋 名单导入学生端」一键带过去。</div>
        <div class="tts-row">
          <select id="ttsVoice"></select>
          <button class="mini-btn" id="ttsTest">🔊 试听</button>
        </div>
        <div class="tts-row">
          <span class="muted" style="flex:none">语速</span>
          <input type="range" id="ttsRate" min="0.6" max="1.6" step="0.1" value="1">
          <span class="muted" id="ttsRateVal" style="flex:none">1.0x</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
          <div class="switch" style="flex:1;min-width:140px"><span style="font-size:13px;font-weight:700">音效</span><div class="sw" id="sfxSw"></div></div>
          <div class="switch" style="flex:1;min-width:170px"><span style="font-size:13px;font-weight:700">不重复点名</span><div class="sw" id="drawToggle"></div></div>
        </div>
        <div class="hint">答题页每题都有「🎲 点名」：滚动抽取→请学生上台→可读题（当前音色）→答对自动播报带姓名的表扬（语库 ${320} 条）。</div>
      </div>
      <div class="card" style="margin-top:13px">
        <div class="sec-t"><span class="dot"></span>学习档案（只存本机，不上传）</div>
        <div style="display:flex;gap:9px">
          <button class="btn ghost sm" id="exportBtn">⬆ 导出档案</button>
          <button class="btn ghost sm" id="importBtn">⬇ 导入档案</button>
          <button class="btn warn sm" id="resetBtn">🗑 清空</button>
        </div>
        <input type="file" id="importFile" accept=".json,application/json" class="hidden">
        <div class="hint">换手机/换电脑：先「导出档案」得到 JSON 文件，再到新设备「导入档案」。学习记录、错题本、预估分曲线都会跟着走。</div>
      </div>
      <div class="ver-tag" id="verTag"></div>
    </div>
  </div>

  <!-- ============ 刷题设置 ============ -->
  <div id="setup" class="panel hidden">
    <header><div class="h-title">📝 自由练习</div></header>
    <div class="wrap">
      <div class="card">
        <div class="sec-t"><span class="dot"></span>选择章节（考纲模块）</div>
        <div class="mods" id="mods"></div>
        <div class="hint">默认全选；点按可勾选 / 取消。</div>
      </div>
      <div class="card">
        <div class="sec-t"><span class="dot"></span>题型</div>
        <div class="qts" id="qts">
          <div class="qt on" data-qt="单选">单选题</div>
          <div class="qt on" data-qt="判断">判断题</div>
          <div class="qt on" data-qt="多选">多选题</div>
        </div>
      </div>
      <div class="card">
        <div class="sec-t"><span class="dot"></span>题目数量</div>
        <div class="qnum">
          <div class="qn on" data-n="20">20</div>
          <div class="qn" data-n="50">50</div>
          <div class="qn" data-n="100">100</div>
          <div class="qn" data-n="200">200</div>
        </div>
      </div>
      <div class="card">
        <div class="switch">
          <div><div style="font-weight:700">随机抽题</div><div class="hint" style="margin:0">关闭则按题库顺序抽取</div></div>
          <div class="sw on" id="shuffleSw"></div>
        </div>
      </div>
      <div class="err-msg" id="setupErr"></div>
      <button class="btn" id="startBtn">开始刷题 →</button>
    </div>
  </div>

  <!-- ============ 错题本 ============ -->
  <div id="wrong" class="panel hidden">
    <header><div class="h-title">📕 错题本</div></header>
    <div class="wrap">
      <div class="card" id="wrongStats"></div>
      <button class="btn" id="wrongStartBtn">🔁 开始错题重练 →</button>
      <div style="height:13px"></div>
      <div id="wrongList"></div>
    </div>
  </div>

  <!-- ============ 考点诊断 ============ -->
  <div id="diag" class="panel hidden">
    <header><div class="h-title">📊 考点诊断</div></header>
    <div class="wrap">
      <div class="card">
        <div class="sec-t"><span class="dot"></span>九大模块掌握度</div>
        <div class="radar-box" id="diagRadar"></div>
      </div>
      <div class="card">
        <div class="sec-t"><span class="dot"></span>薄弱考点（正确率 &lt; 70%）</div>
        <div id="weakList"></div>
        <button class="btn sm" id="weakTrainBtn" style="margin-top:6px">🎯 开始弱项特训（智能组题 50 题）→</button>
        <div class="hint" id="unknownNote"></div>
      </div>
      <div class="card">
        <div class="sec-t"><span class="dot"></span>分模块正确率</div>
        <div class="mod-list" id="modList"></div>
      </div>
    </div>
  </div>

  <!-- ============ 答题页 ============ -->
  <div id="quiz" class="hidden">
    <header>
      <button class="h-btn" id="exitBtn">✕</button>
      <div class="h-title" id="quizTitle" style="font-size:16px">练习</div>
      <button class="speak-btn" id="speakBtn">🔊 朗读</button>
      <button class="speak-btn hidden" id="drawBtn">🎲 点名</button>
      <button class="h-btn" id="bigBtn">🖥 课堂</button>
    </header>
    <div class="qhead">
      <div class="qmeta">
        <span class="qbadge" id="badge">单选</span>
        <span id="qIdx">第 1 / 20 题</span>
        <span class="kd" id="qKd"></span>
        <span class="pick-badge hidden" id="pickBadge"></span>
      </div>
      <div class="progress"><i id="progBar"></i></div>
    </div>
    <div class="qbody" id="qbody"></div>
    <div class="navbar hidden" id="navbar">
      <button id="prevBtn">← 上一题</button>
      <button class="primary" id="nextBtn">下一题 →</button>
    </div>
  </div>

  <!-- ============ 成绩页 ============ -->
  <div id="result" class="hidden">
    <header><div class="h-title">答题报告</div><button class="h-btn" id="bigBtn2">🖥 课堂</button></header>
    <div class="wrap result" id="resultBody"></div>
  </div>

  <!-- ============ 底部导航 ============ -->
  <div class="tabs" id="tabs">
    <button class="tab on" data-t="home"><span class="ti">🏠</span>首页</button>
    <button class="tab" data-t="setup"><span class="ti">📝</span>刷题</button>
    <button class="tab" data-t="wrong"><span class="ti">📕</span>错题<span id="badgeWrong" style="color:#dc2626;font-weight:800"></span></button>
    <button class="tab" data-t="diag"><span class="ti">📊</span>诊断<span id="badgeDiag" style="color:#d97706;font-weight:800"></span></button>
  </div>

  <!-- ============ 学号弹窗（班级模式） ============ -->
  <div class="dlg-mask hidden" id="dlgMask">
    <div class="dlg">
      <div class="dlg-t">🎓 输入学号</div>
      <input id="dlgSid" placeholder="老师发的学号，如 2025001" maxlength="32">
      <input id="dlgName" placeholder="姓名（选填）" maxlength="24">
      <input id="dlgCode" placeholder="班级码（老师发的 6 位数字；本机/局域网版可留空）" maxlength="32" inputmode="numeric">
      <div class="dlg-err" id="dlgErr"></div>
      <div style="display:flex;gap:9px">
        <button class="btn ghost sm" id="dlgCancel">取消</button>
        <button class="btn sm" id="dlgOk">保存并同步 →</button>
      </div>
    </div>
  </div>

  <!-- ============ 点名遮罩 ============ -->
  <div class="draw-mask hidden" id="drawMask">
    <div class="draw-title">随 机 点 名</div>
    <div class="draw-name" id="drawName">？</div>
    <div class="draw-tip" id="drawTip"></div>
    <div class="draw-actions">
      <button class="btn ghost" id="drawRead">🔊 用当前音色读题</button>
      <button class="btn" id="drawGo">开始作答 →</button>
      <button class="h-btn" id="drawClose">✕</button>
    </div>
  </div>

</div>
<script>
${engine}
${engine}
</script>
<script>
${praise}
</script>
<script>
${sfx}
</script>
${dataTag}
<script>
${app}
</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
if (splitMode) {
  fs.writeFileSync(path.join(path.dirname(out), 'data.js'), data, 'utf8');
  fs.writeFileSync(out, tpl, 'utf8');
} else {
  fs.writeFileSync(out, tpl, 'utf8');
}
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log('BUILD OK →', out);
console.log('大小:', kb, 'KB | 题库', window.BANK.length, '题 | ID唯一 ✓ | 考纲总分', total150, '✓');
