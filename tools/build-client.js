/* Windows 客户端打包器：产出 免安装 zip + 安装包 setup.exe
 * ============================================================
 * 用法：node tools/build-client.js [--bgm <mp3路径>] [--skip-build]
 * 产物（dist-client/）：
 *   学考冲刺通课堂版/                     免安装文件夹（可直接用/直接分发）
 *   学考冲刺通课堂版-免安装.zip            上面文件夹的压缩包
 *   学考冲刺通安装包.exe                   安装向导（内嵌全部内容，双击安装到 C:\学考冲刺通）
 * 前置：
 *   - src/assets/icon.ico 已生成（python -I tools/gen-logo.py）
 *   - tools/client/python-embed.zip（缺失自动从 python.org 下载，版本固定 3.14.0）
 * 内容白名单（绝不打包密钥与学生真实数据）：
 *   site/{index.html,data.js,favicon.svg} + server.py + python/（内嵌运行时）
 *   + music/（默认 BGM mp3 + 说明） + data/README.txt + icon.ico + 学考冲刺通.exe + 说明
 * 计划文档：docs/Windows客户端升级计划-20261107.md */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist-client');
const STAGE = path.join(DIST, 'stage');
const CLIENT = path.join(__dirname, 'client');
const PYTHON_ZIP = path.join(CLIENT, 'python-embed.zip');
const PYTHON_URL = 'https://www.python.org/ftp/python/3.14.0/python-3.14.0-embed-amd64.zip';
const DEFAULT_BGM = 'C:/Users/Administrator/Downloads/直播PK 决战超燃BGM - 纯音世界.mp3';
const CSC = 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
const CRLF = String.fromCharCode(13, 10);

function sh(cmd, opts) {
  console.log('  $ ' + cmd.slice(0, 110));
  return execSync(cmd, Object.assign({ cwd: ROOT, stdio: 'inherit', maxBuffer: 64 * 1024 * 1024 }, opts));
}
function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const n of fs.readdirSync(src)) {
    const s = path.join(src, n), d = path.join(dest, n);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : copy(s, d);
  }
}

(async () => {
  if (!fs.existsSync(CSC)) throw new Error('找不到 csc.exe（.NET Framework 编译器），本机不满足打包条件');
  const args = process.argv.slice(2);
  const bgmIdx = args.indexOf('--bgm');
  const bgmSrc = bgmIdx !== -1 ? args[bgmIdx + 1] : DEFAULT_BGM;

  // 0. 前端构建（site/ 就绪）
  if (!args.includes('--skip-build')) sh('node src/build.js --split site/index.html');
  if (!fs.existsSync(path.join(ROOT, 'site', 'index.html'))) throw new Error('site/index.html 缺失');
  if (!fs.existsSync(path.join(ROOT, 'src', 'assets', 'icon.ico'))) sh('python -I tools/gen-logo.py');

  // 1. 内嵌 Python（缺失自动下载）
  if (!fs.existsSync(PYTHON_ZIP)) {
    console.log('下载内嵌 Python（一次，约12MB）...');
    const res = await fetch(PYTHON_URL);
    if (!res.ok) throw new Error('下载失败 HTTP ' + res.status);
    fs.writeFileSync(PYTHON_ZIP, Buffer.from(await res.arrayBuffer()));
  }

  // 2. stage 清空与组装
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });
  copy(path.join(ROOT, 'site', 'index.html'), path.join(STAGE, 'site', 'index.html'));
  copy(path.join(ROOT, 'site', 'data.js'), path.join(STAGE, 'site', 'data.js'));
  copy(path.join(ROOT, 'site', 'favicon.svg'), path.join(STAGE, 'site', 'favicon.svg'));
  copy(path.join(ROOT, '班级版服务.py'), path.join(STAGE, 'server.py'));
  copy(path.join(ROOT, 'src', 'assets', 'icon.ico'), path.join(STAGE, 'icon.ico'));
  console.log('解压内嵌 Python -> stage/python/ ...');
  fs.mkdirSync(path.join(STAGE, 'python'), { recursive: true });
  sh('python -I tools/client/ziphelper.py --extract "' + PYTHON_ZIP + '" "' + path.join(STAGE, 'python') + '"');

  // 3. music/（默认 BGM + 说明）
  fs.mkdirSync(path.join(STAGE, 'music'), { recursive: true });
  if (bgmSrc && fs.existsSync(bgmSrc)) {
    copy(bgmSrc, path.join(STAGE, 'music', '01-PK超燃BGM.mp3'));
    console.log('  背景 mp3 -> music/01-PK超燃BGM.mp3');
  } else {
    console.log('  ⚠ 未找到默认 BGM 文件，music/ 只有说明（可用 --bgm <路径> 指定）');
  }
  fs.writeFileSync(path.join(STAGE, 'music', '说明-把mp3放这里.txt'),
    '把 mp3/wav 音频文件放进本文件夹，客户端背景音乐就会自动加载并轮换播放。' + CRLF +
    '本文件夹自带的 01-PK超燃BGM.mp3 是默认背景音乐，可自行增删。' + CRLF +
    '音量在 PK 页「⚙️ 设置」里调整（默认 50%，TTS 播报时自动压低）。');

  // 4. data/ 骨架 + 根说明
  fs.mkdirSync(path.join(STAGE, 'data'), { recursive: true });
  fs.writeFileSync(path.join(STAGE, 'data', 'README-本地数据库.txt'),
    '本文件夹是课堂版的本地数据库：' + CRLF +
    '  classroom.json = PK/擂台/备课夹数据（程序自动维护，.bak 为上一版备份）' + CRLF +
    '  学号.json = 班级版学生档案（如有）' + CRLF +
    '备份：整个 data/ 文件夹拷走即可。');
  const readme = [
    '学考冲刺通 · 课堂版',
    '==================',
    '',
    '用法：双击「学考冲刺通.exe」（或桌面快捷方式）→ 自动启动并打开主界面。',
    '',
    '· 题库已内置（3982 题，离线可用）；联网时可在 PK 设置里一键拉取线上题库更新',
    '· 数据都在本文件夹 data/ 里（拷走=备份），浏览器清缓存不影响',
    '· 背景音乐：mp3/wav 放进 music/ 文件夹，PK 设置里开关与调音量',
    '· 教师学情页：托盘图标右键 →「教师学情页」',
    '· 前进/后退：顶栏 ← → 按钮，或 Alt+方向键',
    '',
    '停止服务：托盘图标右键 →「退出并停止服务」，或运行「停止课堂版服务.bat」'
  ].join(CRLF);
  fs.writeFileSync(path.join(STAGE, '说明（先看我）.txt'), readme);

  // 5. 启动/停止 bat（内容不含中文文件名，编码安全）
  fs.writeFileSync(path.join(STAGE, '启动课堂版.bat'),
    '@echo off' + CRLF +
    'rem 学考冲刺通课堂版 启动器（后台服务+应用窗口）' + CRLF +
    'for %%f in ("%~dp0*.exe") do start "" "%%f"' + CRLF);
  fs.writeFileSync(path.join(STAGE, '停止课堂版服务.bat'),
    '@echo off' + CRLF +
    'for /f "tokens=5" %%a in (\'netstat -ano ^| findstr :8953 ^| findstr LISTENING\') do taskkill /F /T /PID %%a >nul 2>&1' + CRLF +
    'echo 课堂版服务已停止。' + CRLF);

  // 6. 编译启动器 exe
  console.log('编译启动器 学考冲刺通.exe ...');
  sh('"' + CSC + '" /nologo /t:winexe /codepage:65001 /out:' +
     JSON.stringify(path.join(STAGE, '学考冲刺通.exe')) +
     ' /win32icon:' + JSON.stringify(path.join(ROOT, 'src', 'assets', 'icon.ico')) +
     ' /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll ' +
     JSON.stringify(path.join(CLIENT, 'launcher.cs')));

  // 7. payload.zip → 编译安装包
  console.log('组装 payload.zip ...');
  sh('python -I tools/client/ziphelper.py "' + STAGE + '" "' + path.join(DIST, 'payload.zip') + '"');
  console.log('编译安装包 ...');
  sh('"' + CSC + '" /nologo /t:winexe /codepage:65001 /out:' +
     JSON.stringify(path.join(DIST, '学考冲刺通安装包.exe')) +
     ' /win32icon:' + JSON.stringify(path.join(ROOT, 'src', 'assets', 'icon.ico')) +
     ' /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll ' +
     ' /resource:"' + path.join(DIST, 'payload.zip') + '"' +
     ' ' + JSON.stringify(path.join(CLIENT, 'setup.cs')));

  // 8. 免安装文件夹 + zip
  const portable = path.join(DIST, '学考冲刺通课堂版');
  fs.rmSync(portable, { recursive: true, force: true });
  copyDir(STAGE, portable);
  sh('python -I tools/client/ziphelper.py "' + portable + '" "' + path.join(DIST, '学考冲刺通课堂版-免安装.zip') + '"');

  // 9. 白名单断言（无密钥/无学生真实数据）
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p2 = path.join(d, e.name);
    return e.isDirectory() ? walk(p2) : [p2];
  });
  const all = walk(portable);
  const bad = all.filter(f => /keys\.json|classroom\.json|\.bak$/i.test(f));
  if (bad.length) throw new Error('打包白名单校验失败：' + bad.join(', '));
  fs.rmSync(path.join(DIST, 'payload.zip'), { force: true });

  // 10. 产物清单
  console.log('');
  console.log('== 产物 ==');
  [['学考冲刺通课堂版-免安装.zip'], ['学考冲刺通安装包.exe'], ['学考冲刺通课堂版/']].forEach(([n]) => {
    const p2 = path.join(DIST, n);
    const sz = fs.existsSync(p2) ? (fs.statSync(p2).isDirectory() ? '(文件夹)' : Math.round(fs.statSync(p2).size / 1024 / 1024 * 10) / 10 + ' MB') : '缺失';
    console.log('  dist-client/' + n + '  ' + sz);
  });
  console.log('文件数: ' + all.length + '（白名单校验通过：无密钥/无学生数据）');

  // Release 上传用 ASCII 名副本（gh 上传中文路径会被终端编码毁名）
  copy(path.join(DIST, '学考冲刺通课堂版-免安装.zip'), path.join(DIST, 'xuekao-classroom-portable.zip'));
  copy(path.join(DIST, '学考冲刺通安装包.exe'), path.join(DIST, 'xuekao-classroom-setup.exe'));
  console.log('  Release 上传副本: dist-client/xuekao-classroom-portable.zip + xuekao-classroom-setup.exe');
})().catch((e) => { console.error('BUILD FAIL:', e.message); process.exit(1); });
