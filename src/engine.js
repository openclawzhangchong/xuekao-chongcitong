/* =====================================================================
 * 学考冲刺通 · 核心引擎（纯逻辑，无 DOM 依赖，Node 可直接测试）
 * 口径：福建省中职《信息技术基础》学考 150 分制（9 模块考纲分值加权）
 * ===================================================================== */
(function (root) {
  'use strict';

  /* ---------- 工具 ---------- */

  // 答案规范化：大写 + 字母排序；判断题(√/×)原样保留
  function normalizeAns(a) {
    var s = (a == null ? '' : String(a)).trim().toUpperCase();
    if (s === '√' || s === '×') return s;
    return s.split('').sort().join('');
  }

  // 判分：sel(选项数组) 与标准答案严格一致才算对
  function judge(q, sel) {
    if (!sel || !sel.length) return false;
    var mine = sel.slice().map(normalizeAns).sort().join('');
    return mine === normalizeAns(q.a);
  }

  // 稳定题目 ID：djb2(m|qt|s)，重建题库时题干不变则 ID 不变
  function qidOf(q) {
    var str = (q.m || '') + '|' + (q.qt || '') + '|' + (q.s || '');
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
    return (q.m || 'M') + '-' + h.toString(36);
  }

  /* 题面残留清洗：M3 有 64 题被生成器把整段「A. 选项B. 选项…」混写进了题干。
   * 只用于显示——题库数据与 qid 都按原题干算，学生历史作答记录不断链。
   * 保守规则：必须 A 标记之后还能看到 B 标记才截断，免得误伤「Ctrl+A」这类正文。 */
  function cleanStem(s) {
    if (!s) return '';
    var txt = String(s);
    var at = txt.search(/A[.、．]/);
    if (at < 0) return txt;
    if (!/B[.、．]/.test(txt.slice(at + 2))) return txt;
    return txt.slice(0, at).replace(/\s+$/, '');
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function todayStr(d) {
    var t = d ? new Date(d) : new Date();
    var m = t.getMonth() + 1, day = t.getDate();
    return t.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /* ---------- 学习档案 ---------- */

  function newProfile() {
    return { v: 1, answers: {}, days: {}, history: [], created: Date.now() };
  }

  // 记录一次作答：对 → 连对 +1（达到 2 毕业错题本）；错 → 连对清零
  function recordAnswer(profile, q, correct, when) {
    var id = qidOf(q);
    var rec = profile.answers[id];
    if (!rec) { rec = profile.answers[id] = { a: 0, w: 0, k: 0, t: 0 }; }
    if (correct) { rec.a++; rec.k++; } else { rec.w++; rec.k = 0; }
    rec.t = when || Date.now();
    var d = todayStr(rec.t);
    profile.days[d] = (profile.days[d] || 0) + 1;
    return rec;
  }

  // 连续打卡天数（今天或昨天截止；断档即断签）
  function streakDays(days) {
    var best = 0;
    var d = new Date();
    if (!days[todayStr(d)]) d.setDate(d.getDate() - 1); // 今天还没刷，从昨天起算
    while (days[todayStr(d)]) {
      best++;
      d.setDate(d.getDate() - 1);
    }
    return best;
  }

  // 错题本：错过的、且连对未满 2 次（毕业）的题
  function isGraduated(rec) { return !!rec && rec.k >= 2; }
  function wrongQueue(BANK, profile) {
    var out = [];
    BANK.forEach(function (q) {
      var rec = profile.answers[qidOf(q)];
      if (rec && rec.w > 0 && rec.k < 2) out.push(q);
    });
    return out;
  }
  function graduatedCount(BANK, profile) {
    var n = 0;
    BANK.forEach(function (q) {
      var rec = profile.answers[qidOf(q)];
      if (rec && rec.w > 0 && rec.k >= 2) n++;
    });
    return n;
  }

  /* ---------- 预估学考分（150 分制） ---------- */

  // 模块正确率 × 考纲分值；未测模块不计入「已覆盖」
  function moduleStats(BANK, META, profile) {
    return META.map(function (m) {
      var a = 0, w = 0;
      BANK.forEach(function (q) {
        if (q.m !== m.code) return;
        var rec = profile.answers[qidOf(q)];
        if (rec) { a += rec.a; w += rec.w; }
      });
      var n = a + w;
      return { code: m.code, name: m.disp, score: m.score, n: n, a: a, w: w, acc: n ? a / n : null };
    });
  }

  function estimateScore(BANK, META, profile) {
    var stats = moduleStats(BANK, META, profile);
    var score = 0, tested = 0;
    stats.forEach(function (s) {
      if (s.n > 0) { score += s.acc * s.score; tested += s.score; }
    });
    return {
      score: Math.round(score * 10) / 10,
      tested: tested,
      total: META.reduce(function (x, m) { return x + m.score; }, 0),
      per: stats
    };
  }

  /* ---------- 考点诊断 ---------- */

  // 考点粒度 (模块|考点) 统计
  function spotStats(BANK, profile) {
    var map = {};
    BANK.forEach(function (q) {
      var key = q.m + '|' + q.kd;
      var s = map[key];
      if (!s) { s = map[key] = { m: q.m, kd: q.kd, n: 0, a: 0, w: 0, qids: [] }; }
      s.qids.push(qidOf(q));
      var rec = profile.answers[qidOf(q)];
      if (rec) { s.a += rec.a; s.w += rec.w; s.n = s.a + s.w; }
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  // 薄弱考点排序：正确率升序 × 样本量权重；完全没刷过的标记 null
  function weakSpots(BANK, META, profile, topN) {
    var modName = {};
    META.forEach(function (m) { modName[m.code] = m.disp; });
    var list = spotStats(BANK, profile).map(function (s) {
      return {
        m: s.m, kd: s.kd, disp: (modName[s.m] || '') + ' · ' + s.kd,
        n: s.n, a: s.a, w: s.w, acc: s.n ? s.a / s.n : null, qids: s.qids
      };
    });
    // 弱 = 刷过且正确率 < 0.7；没刷过 = 未探明（单独区分）
    var weak = list.filter(function (s) { return s.n >= 2 && s.acc < 0.7; })
      .sort(function (x, y) { return x.acc - y.acc || y.n - x.n; });
    var unknown = list.filter(function (s) { return s.n === 0; });
    return { weak: weak.slice(0, topN || 8), unknownCount: unknown.length, all: list };
  }

  // 弱项特训组题：错题本优先，再补薄弱考点的题，去重洗牌
  function weakTraining(BANK, META, profile, n) {
    var seen = {}, out = [];
    wrongQueue(BANK, profile).forEach(function (q) {
      var id = qidOf(q);
      if (!seen[id]) { seen[id] = 1; out.push(q); }
    });
    weakSpots(BANK, META, profile, 20).weak.forEach(function (s) {
      BANK.forEach(function (q) {
        if (out.length >= n) return;
        var id = qidOf(q);
        if (!seen[id] && s.qids.indexOf(id) !== -1) { seen[id] = 1; out.push(q); }
      });
    });
    shuffle(out);
    return out.slice(0, n);
  }

  /* ---------- 模拟卷（150 分制考纲加权组卷） ---------- */

  // 每模块按考纲分值抽同数量题（每题 1 分）：M1×15 … M8×8 … 共 150 题 150 分
  // scale<1 出半卷等；用累进分配保证总题数精确等于 round(150×scale)
  function buildSimPaper(BANK, META, opts) {
    opts = opts || {};
    var scale = opts.scale || 1; // scale<1 出半卷等
    var paper = [];
    var cumBefore = 0, cumAll = META.reduce(function (x, m) { return x + m.score; }, 0);
    META.forEach(function (m) {
      cumBefore += m.score;
      var want = Math.round(cumBefore * scale) - Math.round((cumBefore - m.score) * scale);
      if (want <= 0) return;
      var pool = BANK.filter(function (q) { return q.m === m.code; });
      shuffle(pool);
      paper = paper.concat(pool.slice(0, Math.min(want, pool.length)));
    });
    return paper;
  }

  /* ---------- 档案导入导出校验 ---------- */

  function validateProfile(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var p = newProfile();
    if (obj.answers && typeof obj.answers === 'object') {
      Object.keys(obj.answers).forEach(function (k) {
        var r = obj.answers[k];
        if (!r || typeof r !== 'object') return;
        var a = Math.max(0, Math.min(999, parseInt(r.a, 10) || 0));
        var w = Math.max(0, Math.min(999, parseInt(r.w, 10) || 0));
        var kk = Math.max(0, Math.min(2, parseInt(r.k, 10) || 0));
        if (!a && !w) return;
        p.answers[String(k).slice(0, 64)] = { a: a, w: w, k: kk, t: Number(r.t) || 0 };
      });
    }
    if (obj.days && typeof obj.days === 'object') {
      Object.keys(obj.days).forEach(function (d) {
        // 格式 + 语义双重校验（拒绝 2026-13-99 这类假日期）
        var mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
        if (mm) {
          var y = +mm[1], mo = +mm[2], da = +mm[3];
          var dt = new Date(y, mo - 1, da);
          if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === da) {
            var n = parseInt(obj.days[d], 10);
            if (n > 0) p.days[d] = Math.min(9999, n);
          }
        }
      });
    }
    if (Array.isArray(obj.history)) {
      p.history = obj.history.slice(-500).filter(function (h) {
        return h && typeof h === 'object' && isFinite(h.score);
      }).map(function (h) {
        return { t: Number(h.t) || 0, score: Math.max(0, Math.min(150, +h.score)), tested: Math.max(0, Math.min(150, +h.tested || 0)), mode: String(h.mode || '').slice(0, 16) };
      });
    }
    if (obj.created) p.created = Number(obj.created) || Date.now();
    return p;
  }

  /* ---------- 导出 ---------- */
  var XK = {
    normalizeAns: normalizeAns,
    judge: judge,
    qidOf: qidOf,
    cleanStem: cleanStem,
    shuffle: shuffle,
    todayStr: todayStr,
    newProfile: newProfile,
    recordAnswer: recordAnswer,
    streakDays: streakDays,
    isGraduated: isGraduated,
    wrongQueue: wrongQueue,
    graduatedCount: graduatedCount,
    moduleStats: moduleStats,
    estimateScore: estimateScore,
    spotStats: spotStats,
    weakSpots: weakSpots,
    weakTraining: weakTraining,
    buildSimPaper: buildSimPaper,
    validateProfile: validateProfile
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = XK;
  root.XK = XK;
})(typeof window !== 'undefined' ? window : globalThis);
