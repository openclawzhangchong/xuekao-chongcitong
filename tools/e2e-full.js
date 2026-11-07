/* 全站 E2E：无头 Edge 真点真答，把学生/老师会走的路全部走一遍
 * 用法：
 *   node tools/e2e-full.js                              # 本地拆分版 file://（含全部深度流程）
 *   node tools/e2e-full.js http://127.0.0.1:8953/       # 班级版服务（追加：学号登录/同步/教师页/课堂弹窗不遮擂台）
 *   node tools/e2e-full.js https://xuekao.jiuyeke.cn    # 线上冒烟（同深度流程，跳过会写数据的班级同步）
 * 环境变量：
 *   E2E_VIEWPORT=1366x768   视口（默认教室投屏分辨率；手机回归用 390x844）
 *   E2E_OUT=evidence/e2e2   截图与结果 JSON 的输出目录
 * 退出码：有 FAIL → 1；全部 PASS → 0
 * 依赖：playwright-core（本机 npm 全局目录，与 gate-fit.js 同一套）
 */
'use strict';
const path = require('path');
const fs = require('fs');

function requirePlaywright() {
  for (const m of ['playwright-core', 'playwright', 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright-core']) {
    try { return require(m); } catch (e) { /* 换下一个 */ }
  }
  throw new Error('找不到 playwright-core（本机 npm 全局目录）');
}

const ARG_PAGE = process.argv[2] || '';
const IS_HTTP = /^https?:\/\//.test(ARG_PAGE);
const PAGE = ARG_PAGE || 'file:///' + path.join(__dirname, '..', 'site', 'index.html').replace(/\\/g, '/');
const IS_CLASS = IS_HTTP && /127\.0\.0\.1:8953|localhost:8953/.test(PAGE); // 班级版服务（可写测试数据）
const OUT = path.join(__dirname, '..', process.env.E2E_OUT || 'evidence', 'e2e2');
const VP = (process.env.E2E_VIEWPORT || '1366x768').split('x').map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

const RESULTS = [];
const ERRORS = [];
let shotN = 0;
function check(name, ok, note) {
  RESULTS.push({ name, ok: !!ok, note: note || '' });
  console.log((ok ? '  ✓ ' : '  ✗ FAIL ') + name + (note ? ' —— ' + note : ''));
  return !!ok;
}
async function shot(page, name) {
  shotN++;
  const file = path.join(OUT, String(shotN).padStart(2, '0') + '-' + name + '.png');
  await page.screenshot({ path: file });
  console.log('    📷 ' + path.relative(path.join(__dirname, '..'), file));
  return file;
}
/* 容器里按字母点选项；letters 如 ['A'] 或 ['B','C']（多选） */
async function pickLetters(page, rootSel, letters) {
  for (const k of letters) {
    await page.evaluate(([sel, key]) => {
      const el = document.querySelector(sel + ' .opt[data-key="' + key + '"]') ||
        document.querySelector(sel + ' .ar-opt[data-key="' + key + '"]');
      if (el) el.click();
    }, [rootSel, k]);
  }
}

(async () => {
  const pw = requirePlaywright();
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: VP[0], height: VP[1] } });
  page.on('pageerror', (e) => ERRORS.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') ERRORS.push('console: ' + m.text().slice(0, 200)); });
  page.on('dialog', (d) => d.accept().catch(() => {}));

  console.log('== 全站 E2E ==\n   地址 ' + PAGE + '\n   视口 ' + VP[0] + '×' + VP[1] + (IS_CLASS ? '（班级版服务）' : IS_HTTP ? '（线上冒烟）' : '（本地文件）'));

  /* ---------- A. 载入与首页 ---------- */
  const t0 = Date.now();
  await page.goto(PAGE);
  await page.waitForFunction('window.BANK && window.BANK.length>0', { timeout: 60000 });
  const loadMs = Date.now() - t0;
  const bankN = await page.evaluate(() => window.BANK.length);
  check('A1 题库载入', bankN >= 3900, 'BANK=' + bankN + '，就绪耗时 ' + loadMs + 'ms');
  const cards = await page.evaluate(() =>
    ['entCardPractice', 'entCardWrong', 'entCardDiag', 'entCardSim', 'entCardPk', 'entCardArena']
      .filter((i) => !document.getElementById(i)));
  check('A2 首页六张入口卡', cards.length === 0, cards.length ? '缺 ' + cards.join(',') : '6/6');
  check('A3 底部页签 5 个', (await page.evaluate(() => document.querySelectorAll('.tab').length)) === 5);
  const scoreTxt = await page.evaluate(() => (document.getElementById('home') || {}).innerText || '');
  check('A4 首页有预估分卡', /预估/.test(scoreTxt));

  /* ---------- A+. 班级/云端模式先处理学号弹窗（会挡住一切） ---------- */
  if (IS_HTTP) {
    const dlgShown = await page.waitForFunction(
      () => { const m = document.getElementById('dlgMask'); return m && !m.classList.contains('hidden'); },
      { timeout: IS_CLASS ? 10000 : 8000 }
    ).then(() => true).catch(() => false);
    if (IS_CLASS) {
      check('L1 班级模式弹学号登录', dlgShown, '');
      const keys = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cloud', 'keys.json'), 'utf8'));
      await page.evaluate((code) => {
        document.getElementById('dlgSid').value = '99001';
        document.getElementById('dlgName').value = '测试同学';
        document.getElementById('dlgCode').value = code;
        document.getElementById('dlgOk').click();
      }, keys.classCode);
      await sleep(1200); // 留足时间：越过探测里的 600ms 二次弹窗计时器
      const dlgClosed = await page.evaluate(() => { const m = document.getElementById('dlgMask'); return m ? m.classList.contains('hidden') : true; });
      const bodyTxt = await page.evaluate(() => document.body.innerText);
      check('L2 学号登录成功（弹窗关闭+同步条出现）', dlgClosed && /99001|测试同学/.test(bodyTxt), '弹窗已关=' + dlgClosed);
    } else {
      // 线上站：只取消弹窗继续冒烟 —— 绝不往真实云端写测试数据（sid 为空时前端不会发起同步）
      if (dlgShown) {
        await page.evaluate(() => { const b = document.getElementById('dlgCancel'); if (b) b.click(); });
        await sleep(300);
      }
      console.log(dlgShown ? '  ℹ 线上弹学号登录已取消（不写云端数据）' : '  ℹ 线上未弹学号登录');
    }
  }

  /* ---------- B. 主题切换 ---------- */
  const th0 = await page.evaluate(() => localStorage.getItem('xkc.theme'));
  await page.click('.theme-btn'); await sleep(200);
  const th1 = await page.evaluate(() => localStorage.getItem('xkc.theme'));
  check('B1 主题切换落盘', th0 !== th1, th0 + ' → ' + th1);
  await shot(page, 'theme-dark');
  await page.click('.theme-btn'); await sleep(150);
  check('B2 切回浅色', (await page.evaluate(() => localStorage.getItem('xkc.theme'))) === th0);

  /* ---------- C. 答题流（练习 3 题） ---------- */
  await page.evaluate(() => document.querySelector('.tab[data-t="setup"]').click()); await sleep(150);
  await page.click('#startBtn'); await sleep(400);
  const q1 = await page.evaluate(() => ({ body: !!document.getElementById('qbody'), opts: document.querySelectorAll('#qbody .opt').length }));
  check('C1 出题面板渲染', q1.body && q1.opts >= 2, q1.opts + ' 个选项');
  // 答完本组全部题（单选/判断点选项即判，多选点「确定提交」），到最后一题出报告
  for (let guard = 0; guard < 80; guard++) {
    const st = await page.evaluate(() => {
      const b = document.querySelector('#qbody .submit-row .btn');
      if (b) { b.click(); return 'multi'; }
      const o = document.querySelector('#qbody .opt'); if (o) o.click(); return 'single';
    });
    await sleep(90);
    const last = await page.evaluate(() => {
      const n = document.getElementById('nextBtn');
      return n ? /查看报告|交卷/.test(n.textContent) : false;
    });
    await page.evaluate(() => { const n = document.getElementById('nextBtn'); if (n) n.click(); });
    await sleep(120);
    if (last) break;
  }
  await shot(page, 'quiz-report');
  const reportTxt = await page.evaluate(() => document.body.innerText);
  check('C2 全组答完出报告', /正确率|查看报告|本次|成绩/.test(reportTxt) || /报告/.test(reportTxt), '');
  await page.evaluate(() => document.querySelector('.tab[data-t="home"]').click()); await sleep(150);

  /* ---------- D. 模拟考入口（不真交卷，只验证组卷面板） ---------- */
  await page.click('#entCardSim'); await sleep(250);
  const simTxt = await page.evaluate(() => document.body.innerText);
  check('D1 模拟考入口可用', /模拟|组卷|150/.test(simTxt));
  await page.evaluate(() => document.querySelector('.tab[data-t="home"]').click()); await sleep(120);

  /* ---------- E. 错题本（新档案为空态） ---------- */
  await page.evaluate(() => document.querySelector('.tab[data-t="wrong"]').click()); await sleep(200);
  const wrongTxt = await page.evaluate(() => document.body.innerText);
  check('E1 错题本空态文案', /错题|空|还/.test(wrongTxt));
  const errBefore = ERRORS.length;
  await page.click('#wrongStartBtn'); await sleep(250);
  check('E2 空错题点重练不崩', ERRORS.length === errBefore, ERRORS.length > errBefore ? ERRORS[ERRORS.length - 1] : '无新报错');
  await page.evaluate(() => document.querySelector('.tab[data-t="home"]').click()); await sleep(120);

  /* ---------- F. 诊断（雷达图 canvas） ---------- */
  await page.evaluate(() => document.querySelector('.tab[data-t="diag"]').click()); await sleep(300);
  const diag = await page.evaluate(() => ({
    canvas: document.querySelectorAll('#diag canvas, canvas').length,
    txt: document.body.innerText,
  }));
  check('F1 诊断页渲染', diag.canvas >= 1 || /诊断|考点/.test(diag.txt), 'canvas=' + diag.canvas);
  await shot(page, 'diag-radar');

  /* ---------- G. 课堂投屏模式 ---------- */
  await page.evaluate(() => document.querySelector('.tab[data-t="home"]').click()); await sleep(120);
  const cls0 = await page.evaluate(() => document.body.className);
  await page.click('#bigBtnHome'); await sleep(300);
  const cls1 = await page.evaluate(() => document.body.className);
  check('G1 投屏模式切换', cls0 !== cls1, cls1.slice(0, 40));
  await shot(page, 'bigscreen');
  await page.click('#bigBtnHome'); await sleep(200);
  check('G2 退出投屏', (await page.evaluate(() => document.body.className)) === cls0);

  /* ---------- H. 课堂互动控件 ---------- */
  const ttsOpts = await page.evaluate(() => document.querySelectorAll('#ttsVoice option').length);
  check('H1 TTS 音色列表非空', ttsOpts >= 1, ttsOpts + ' 个音色');
  await page.click('#rosterClear'); await sleep(150);
  const rosterAfterClear = await page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('xkc.roster') || '{"list":[]}').list || []).length; }
    catch (e) { return -1; }
  });
  check('H2 名单清空生效', rosterAfterClear === 0, '剩余 ' + rosterAfterClear + ' 人');
  await page.click('#rosterSave'); await sleep(120);

  /* ---------- I. 双人 PK 全流程（选人对战 10 题） ---------- */
  // 提交后按钮 0.5s 变「下一题」，再点才推进 —— 状态机驱动
  async function pkDriveSide(left, rightAns) {
    const rootSel = left ? '#LBody' : '#rBody';
    const subId = left ? 'LSubmit' : 'rSubmit';
    for (let guard = 0; guard < 60; guard++) {
      const st = await page.evaluate(([lf, ra]) => {
        const P = window.__PK_TEST.pk()[lf ? 'left' : 'right'];
        const btn = document.getElementById(lf ? 'LSubmit' : 'rSubmit');
        if (P.done || P.idx >= P.seq.length) return { done: true, score: P.score, n: P.seq.length };
        if (/下一题/.test(btn ? btn.textContent : '')) return { next: true };
        const q = P.seq[P.idx];
        const L = q.qt === '多选' ? q.a.split('') : [q.a.charAt(0)];
        if (!ra) { const w = q.o.filter((o) => o[0] !== q.a.charAt(0))[0]; if (w) L[0] = w[0]; }
        return { pick: L };
      }, [left, rightAns]);
      if (st.done) return st;
      if (st.next) { await page.evaluate((id) => { const b = document.getElementById(id); if (b) b.click(); }, subId); await sleep(220); continue; }
      await pickLetters(page, rootSel, st.pick);
      await page.evaluate((id) => { const b = document.getElementById(id); if (b) b.click(); }, subId);
      await sleep(650);
    }
    return null;
  }
  await page.evaluate(() => document.querySelector('.tab[data-t="pk"]').click()); await sleep(250);
  await page.evaluate(() => {
    const L = document.getElementById('pkSelL'), R = document.getElementById('pkSelR');
    L.selectedIndex = 1; L.dispatchEvent(new Event('change'));
    R.selectedIndex = 2; R.dispatchEvent(new Event('change'));
  }); await sleep(200);
  await page.click('#btnStart'); await sleep(500);
  const inBattle = await page.evaluate(() => !!document.getElementById('LBody') && !!document.querySelector('#pkPanelL .opt'));
  check('I1 开赛出题', inBattle, '');
  const stL = await pkDriveSide(true, true);
  const stR = await pkDriveSide(false, false);
  check('I2 左侧全对 ' + (stL && stL.score) + '/' + (stL && stL.n), stL && stL.done && stL.score === stL.n, '');
  check('I3 右侧低于左侧', stR && stL && stR.score < stL.score, 'R=' + (stR && stR.score));
  const maskShown = await page.evaluate(() => { const m = document.getElementById('endMask'); return m ? !m.classList.contains('hidden') : false; });
  check('I4 结算弹层出现', maskShown, '');
  await shot(page, 'pk-end');
  await page.evaluate(() => { const b = document.getElementById('endClose'); if (b) b.click(); }); await sleep(200);
  await page.evaluate(() => { const b = document.getElementById('btnLb'); if (b) b.click(); }); await sleep(250);
  const lbRows = await page.evaluate(() => document.querySelectorAll('#lbMask table tr, #lbMask .lb-row, #lbMask tbody tr').length);
  check('I5 排行榜有参赛记录', lbRows >= 1, lbRows + ' 行');
  await shot(page, 'pk-leaderboard');
  await page.evaluate(() => { const m = document.getElementById('lbMask'); if (m) m.classList.add('hidden'); });

  /* ---------- J. 擂台赛全流程（预设打 3 场，真实点选+提交） ---------- */
  async function arenaDriveSeat(key, subId, rootSel, rightAns) {
    for (let guard = 0; guard < 60; guard++) {
      const st = await page.evaluate(([k, ra]) => {
        const T = window.__ARENA_TEST; if (!T) return { err: 'no-hook' };
        const S = k === 'champ' ? T.ar().left : T.ar().right;
        if (!S) return { err: 'no-seat' };
        if (S.done || S.idx >= (S.seq ? S.seq.length : 0)) return { done: true, score: S.score, n: S.seq ? S.seq.length : 0 };
        const btn = document.getElementById(k === 'champ' ? 'arChampSubmit' : 'arChalSubmit');
        const bt = btn ? btn.textContent : '';
        if (/下一题/.test(bt)) return { next: true };
        if (/已提交/.test(bt)) return { wait: true };
        const q = S.seq[S.idx];
        if (!q) return { done: true, score: S.score, n: 0 };
        const L = q.qt === '多选' ? q.a.split('') : [q.a.charAt(0)];
        if (!ra) { const w = q.o.filter((o) => o[0] !== q.a.charAt(0))[0]; if (w) L[0] = w[0]; }
        return { pick: L };
      }, [key, rightAns]);
      if (st.err) return st;
      if (st.done) return st;
      if (st.next) { await page.evaluate((id) => { const b = document.getElementById(id); if (b) b.click(); }, subId); await sleep(220); continue; }
      if (st.wait) { await sleep(300); continue; }
      await pickLetters(page, rootSel, st.pick);
      await page.evaluate((id) => { const b = document.getElementById(id); if (b) b.click(); }, subId);
      await sleep(650);
    }
    return null;
  }
  await page.evaluate(() => {
    localStorage.setItem('pk.arena.cfg', JSON.stringify({ count: 3, minutes: 2, rounds: 3 }));
    localStorage.removeItem('pk.arena.v1');
  });
  await page.reload(); await page.waitForFunction('window.BANK && window.BANK.length>0'); await sleep(300);
  await page.evaluate(() => document.querySelector('.tab[data-t="home"]').click()); await sleep(120);
  await page.click('#entCardArena'); await sleep(350);
  const arenaOpen = await page.evaluate(() => { const p = document.getElementById('arenaPage'); return p ? (p.offsetParent !== null || !p.classList.contains('hidden')) : false; });
  check('J1 擂台页打开', arenaOpen, '');
  // 第一场：真实点选两位争擂
  await page.evaluate(() => {
    const cards = document.querySelectorAll('#arPickList .ar-pick');
    if (cards[0]) cards[0].click(); if (cards[1]) cards[1].click();
  }); await sleep(150);
  await page.click('#arGo'); await sleep(450);
  for (let r = 1; r <= 3; r++) {
    await arenaDriveSeat('champ', 'arChampSubmit', '#arChampBody', true);
    await arenaDriveSeat('chal', 'arChalSubmit', '#arChalBody', r === 1 ? false : true);
    // 等本场结束收尾（running=false），打满 3 场会自动 finish() 出结算
    await page.waitForFunction('window.__ARENA_TEST && !window.__ARENA_TEST.ar().running', { timeout: 20000 }).catch(() => {});
    await sleep(500);
    if (r === 1) await shot(page, 'arena-defending');
    if (r < 3) {
      const started = await page.evaluate(() => {
        const cards = document.querySelectorAll('#arPickList .ar-pick');
        if (!cards.length) return false;
        cards[0].click();
        return true;
      });
      if (!started) break;
      await page.click('#arGo'); await sleep(500);
    }
  }
  const arenaState = await page.evaluate(() => {
    const T = window.__ARENA_TEST || {};
    const lg = T.log ? T.log() : JSON.parse(localStorage.getItem('pk.arena.v1') || '{}');
    const resMask = document.getElementById('arResultMask');
    return {
      played: (lg.results || []).length,
      round: lg.round,
      champ: (lg.champ || {}).name || '',
      settle: resMask ? !resMask.classList.contains('hidden') : false,
      body: document.body.innerText,
    };
  });
  check('J2 打满 3 场（results=3）', arenaState.played === 3, '实际 ' + arenaState.played + '，round=' + arenaState.round);
  check('J3 结算页出现且含擂主', arenaState.settle && /擂主/.test(arenaState.body), 'settle=' + arenaState.settle);
  check('J4 结算含未上台名单', /没上过台|未上台|尚未上场|还没上/.test(arenaState.body), '');
  await shot(page, 'arena-settle');

  /* ---------- K. 刷新持久化 ---------- */
  await page.reload(); await page.waitForFunction('window.BANK && window.BANK.length>0');
  const persist = await page.evaluate(() => ({
    matches: JSON.parse(localStorage.getItem('pk.matches') || '[]').length,
    arena: JSON.parse(localStorage.getItem('pk.arena.v1') || '{}'),
  }));
  check('K1 PK 战绩持久化', persist.matches >= 1, persist.matches + ' 场');
  check('K2 擂台 3 场持久化', (persist.arena.results || []).length === 3, 'results=' + (persist.arena.results || []).length + ' 擂主=' + ((persist.arena.champ || {}).name || ''));

  /* ---------- L. 班级版专属（只在本机 8953 服务跑，绝不碰线上真实数据；登录已在 A+ 完成） ---------- */
  if (IS_CLASS) {
    // 课堂屏中途开擂台：登录弹窗不得盖住候选席（另一 AI 刚修的点，回归盯住）
    await page.evaluate(() => document.querySelector('.tab[data-t="home"]').click()); await sleep(120);
    await page.click('#entCardArena'); await sleep(300);
    const dlgCover = await page.evaluate(() => {
      const m = document.getElementById('dlgMask');
      if (!m || m.classList.contains('hidden')) return false;
      const r = m.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(m).zIndex !== '-1';
    });
    const arenaVis = await page.evaluate(() => { const p = document.getElementById('arenaPage'); return p && (p.offsetParent !== null || !p.classList.contains('hidden')); });
    check('L3 擂台页不被学号弹窗盖住', arenaVis && !dlgCover, '擂台可见=' + arenaVis + ' 弹窗遮挡=' + dlgCover);
    await shot(page, 'class-arena');
    // 教师页：本机版按「来源 IP」把守（设计如此），密钥闸门在云端 Worker
    const keys = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cloud', 'keys.json'), 'utf8'));
    const os = require('os');
    const nets = os.networkInterfaces();
    let lanIp = '';
    for (const k of Object.keys(nets)) for (const n of nets[k] || []) if (n.family === 'IPv4' && !n.internal) lanIp = lanIp || n.address;
    const tRes = await page.evaluate(async () => {
      const ok = await fetch('/teacher').then((r) => r.status).catch(() => 0);
      const csv = await fetch('/teacher.csv').then((r) => r.status).catch(() => 0);
      const hello = await fetch('/api/hello').then((r) => r.json()).catch(() => null);
      return { ok, csv, hello };
    });
    const lanRes = lanIp ? await new Promise((resolve) => {
      require('http').get({ host: lanIp, port: 8953, path: '/teacher', timeout: 4000 }, (res) => { res.resume(); resolve(res.statusCode); })
        .on('error', () => resolve(-1)).on('timeout', function () { this.destroy(); resolve(-1); });
    }) : -1;
    check('L4 教师页本机可开、非本机 403', tRes.ok === 200 && lanRes === 403, '本机=' + tRes.ok + ' LAN(' + lanIp + ')=' + lanRes);
    check('L5 CSV 导出 200', tRes.csv === 200, '');
    check('L6 /api/hello 班级模式', tRes.hello && tRes.hello.mode === 'class', JSON.stringify(tRes.hello));
  }

  /* ---------- M. 汇总 ---------- */
  const pass = RESULTS.filter((r) => r.ok).length;
  const fail = RESULTS.length - pass;
  console.log('\n== 结果 == ' + pass + ' 通过 / ' + fail + ' 失败 / 截图 ' + shotN + ' 张');
  if (ERRORS.length) console.log('页面报错 ' + ERRORS.length + ' 条（首条）：' + ERRORS[0]);
  fs.writeFileSync(path.join(OUT, 'results' + (IS_HTTP ? '-online' : '') + '.json'),
    JSON.stringify({ page: PAGE, viewport: VP.join('x'), loadMs, results: RESULTS, errors: ERRORS }, null, 2));
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('E2E 中断：', e); process.exit(1); });
