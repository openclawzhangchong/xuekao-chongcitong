/* =====================================================================
 * 学考冲刺通 · 云端 Worker
 * 同源托管学生端静态页 + 档案同步 API + 教师学情页
 * 存储：Cloudflare D1（students 表，一学号一行，profile 为 JSON）
 * 鉴权：学生 sync 需班级码(CLASS_CODE)；教师页/导出需教师密钥(TEACHER_KEY)
 * ===================================================================== */

/* ---------- 纯逻辑（导出供 Node 单测，与本地班级版 Python 同语义） ---------- */

export function safeSid(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return /^[0-9A-Za-z_\-\u4e00-\u9fa5]{1,32}$/.test(t) ? t : null;
}
export function safeName(s) {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  return /^[0-9A-Za-z_\-\u4e00-\u9fa5]{0,24}$/.test(t) ? t : '';
}
function num(x) {
  const n = parseInt(x, 10);
  return isFinite(n) && n > 0 ? Math.min(n, 999) : 0;
}

// 档案合并：逐题/逐日取 max（多设备不倒退），history 按 t 去重取最近 500
export function mergeProfile(oldP, newP) {
  oldP = oldP && typeof oldP === 'object' ? oldP : {};
  newP = newP && typeof newP === 'object' ? newP : {};
  const out = { v: 1, answers: {}, days: {}, history: [] };
  const oc = Number(oldP.created) || 0, nc = Number(newP.created) || 0;
  out.created = oc && nc ? Math.min(oc, nc) : (oc || nc || Date.now());

  const keys = new Set([...Object.keys(oldP.answers || {}), ...Object.keys(newP.answers || {})]);
  for (const k of keys) {
    const o = (oldP.answers || {})[k] || {}, n = (newP.answers || {})[k] || {};
    const rec = { a: Math.max(num(o.a), num(n.a)), w: Math.max(num(o.w), num(n.w)), k: Math.max(num(o.k), num(n.k)), t: Math.max(num(o.t), num(n.t)) };
    if (rec.a + rec.w > 0) out.answers[k] = rec;
  }
  const days = new Set([...Object.keys(oldP.days || {}), ...Object.keys(newP.days || {})]);
  for (const d of days) {
    const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!mm) continue;
    // 语义校验（拒绝 2026-13-99 这类假日期，与本地版同口径）
    const y = +mm[1], mo = +mm[2], da = +mm[3];
    const dt = new Date(y, mo - 1, da);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) continue;
    const v = Math.max(num((oldP.days || {})[d]), num((newP.days || {})[d]));
    if (v > 0) out.days[d] = v;
  }
  const hist = [...(oldP.history || []), ...(newP.history || [])]
    .filter(h => h && typeof h === 'object' && isFinite(Number(h.t)))
    .sort((a, b) => a.t - b.t);
  const seen = new Set();
  for (const h of hist) {
    const key = h.t + '|' + h.score;
    if (!seen.has(key)) { seen.add(key); out.history.push({ t: Number(h.t), score: Math.max(0, Math.min(150, +h.score || 0)), tested: Math.max(0, Math.min(150, +h.tested || 0)), mode: String(h.mode || '').slice(0, 16) }); }
  }
  out.history = out.history.slice(-500);
  return out;
}

// 150 分制预估分（qid 前缀聚合模块，与前端/班级版同口径）
export const MOD_SCORE = { M1: 15, M2: 15, M3: 15, M4: 7, M5: 30, M6: 30, M7: 15, M8: 8, M9: 15 };
export const MOD_NAME = { M1: '信息技术应用基础', M2: '图文编辑', M3: '电子表格', M4: '演示文稿', M5: '网络应用', M6: 'Python', M7: '信息安全', M8: '人工智能', M9: '大数据' };

export function estimate(answers) {
  const agg = {};
  for (const [qid, rec] of Object.entries(answers || {})) {
    const m = String(qid).split('-', 1)[0];
    if (!MOD_SCORE[m]) continue;
    const a = agg[m] || (agg[m] = [0, 0]);
    a[0] += num(rec && rec.a); a[1] += num(rec && rec.w);
  }
  let score = 0, tested = 0;
  for (const [m, [a, w]] of Object.entries(agg)) {
    const n = a + w;
    if (n > 0) { score += MOD_SCORE[m] * a / n; tested += MOD_SCORE[m]; }
  }
  return { score: Math.round(score * 10) / 10, tested };
}

export function studentStats(sid, name, profile, updated) {
  const answers = (profile && profile.answers) || {};
  const { score, tested } = estimate(answers);
  const days = (profile && profile.days) || {};
  // 「今日」按北京时间算（学生端 todayStr 用本机日期；服务端用 UTC 会差 8 小时）
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const todayKey = days[today] !== undefined ? today : Object.keys(days).sort().pop();
  return {
    sid, name: name || '',
    score, tested,
    covered: Object.keys(answers).length,
    answered: Object.values(answers).reduce((x, r) => x + ((r && r.a) || 0) + ((r && r.w) || 0), 0),
    wrongPend: Object.values(answers).filter(r => r && (r.w || 0) > 0 && (r.k || 0) < 2).length,
    today: (todayKey && days[todayKey]) || 0,
    daysCount: Object.keys(days).length,
    updated: Number(updated) || 0
  };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- 存储适配层：同一份代码支持 D1 或 KV（哪个有绑定用哪个） ---------- */

function makeStore(env) {
  if (env.DB) {
    return {
      kind: 'd1',
      async get(sid) {
        const { results } = await env.DB.prepare('SELECT profile FROM students WHERE sid = ?1').bind(sid).all();
        if (!results || !results[0]) return null;
        try { return JSON.parse(results[0].profile || '{}'); } catch { return {}; }
      },
      async put(sid, name, profDoc, updated) {
        const { results } = await env.DB.prepare('SELECT name FROM students WHERE sid = ?1').bind(sid).all();
        const oldName = results && results[0] ? results[0].name : '';
        await env.DB.prepare(
          `INSERT INTO students (sid, name, profile, updated) VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(sid) DO UPDATE SET name = excluded.name, profile = excluded.profile, updated = excluded.updated`
        ).bind(sid, name || oldName || '', JSON.stringify(profDoc), updated).run();
      },
      async listAll() {
        const { results } = await env.DB.prepare('SELECT sid, name, profile, updated FROM students').all();
        return (results || []).map(r => {
          let prof = {};
          try { prof = JSON.parse(r.profile || '{}'); } catch { }
          return { sid: r.sid, name: r.name, prof, updated: r.updated };
        });
      }
    };
  }
  if (env.KV) {
    return {
      kind: 'kv',
      async get(sid) {
        const doc = await env.KV.get('stu:' + sid, 'json');
        return doc && typeof doc === 'object' ? (doc.profile || {}) : null;
      },
      async put(sid, name, profDoc, updated) {
        const old = await env.KV.get('stu:' + sid, 'json');
        const doc = { name: name || (old && old.name) || '', profile: profDoc, updated };
        await env.KV.put('stu:' + sid, JSON.stringify(doc));
      },
      async listAll() {
        const out = [];
        let cursor;
        do {
          const page = await env.KV.list({ prefix: 'stu:', cursor });
          for (const k of page.keys) {
            const doc = await env.KV.get(k.name, 'json');
            if (doc && typeof doc === 'object') {
              out.push({ sid: k.name.slice(4), name: doc.name || '', prof: doc.profile || {}, updated: doc.updated || 0 });
            }
          }
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
        return out;
      }
    };
  }
  throw new Error('需要绑定 D1(DB) 或 KV(KV) 之一');
}

/* ---------- Worker 入口 ---------- */

const JSON_HDR = { 'content-type': 'application/json; charset=utf-8' };

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HDR });
}

const TEACHER_TPL = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>学考冲刺通 · 云端班级学情</title><style>
body{margin:0;padding:22px;background:#0b1120;color:#e6edf7;font:14px/1.6 "Microsoft YaHei",system-ui,sans-serif}
h1{font-size:20px;margin:0 0 2px}
.sub{color:#8a97b1;font-size:12px;margin-bottom:16px}
.btn{background:#1b2740;color:#e6edf7;border:1px solid #243049;border-radius:9px;padding:6px 12px;
font-size:12px;cursor:pointer;text-decoration:none;display:inline-block;margin-right:8px}
table{border-collapse:collapse;width:100%;margin-top:12px}
th,td{padding:8px 10px;border-bottom:1px solid #1d2941;text-align:left;white-space:nowrap}
th{color:#8a97b1;font-size:12px;font-weight:600}
tr:hover td{background:#111a2e}
.score{font-weight:800;color:#a5b4fc}.warn{color:#fbbf24}.err{color:#f87171}
.empty{color:#8a97b1;padding:30px;text-align:center}
@media(max-width:720px){body{padding:12px}.tblwrap{overflow-x:auto}}
</style></head><body>
<h1>🎯 学考冲刺通 · 云端班级学情</h1>
<div class="sub">__SUB__</div>
<a class="btn" href="/teacher.csv?__QS__">⬇ 导出 CSV</a>
<a class="btn" href="/">打开学生端</a>
<a class="btn" id="toStudent" href="javascript:void(0)">📋 名单导入学生端</a>
<div class="tblwrap"><table><thead><tr>
<th>#</th><th>学号</th><th>姓名</th><th>预估分</th><th>已覆盖(分)</th>
<th>覆盖题数</th><th>累计作答</th><th>今日</th><th>活跃天数</th>
<th>待重练错题</th><th>最后活跃</th></tr></thead><tbody>
__ROWS__
</tbody></table></div></body></html>`;

function renderTeacher(rows, qs) {
  const sub = `${rows.length} 名学生 · ${new Date().toISOString().slice(0, 10)} · 云端版`;
  const body = rows.length
    ? rows.map((s, i) => {
      const cls = s.score >= 90 ? 'score' : (s.score >= 60 ? 'warn' : 'err');
      const last = s.updated ? new Date(s.updated).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
      return `<tr><td>${i + 1}</td><td><b>${esc(s.sid)}</b></td><td>${esc(s.name) || '-'}</td><td class="${cls}">${s.score}</td><td>${s.tested}/150</td><td>${s.covered}</td><td>${s.answered}</td><td>${s.today}</td><td>${s.daysCount}</td><td>${s.wrongPend || '-'}</td><td>${esc(last)}</td></tr>`;
    }).join('\n')
    : '<tr><td colspan="11" class="empty">还没有学生数据 —— 学生端输学号+班级码刷题后出现在这里</td></tr>';
  return TEACHER_TPL.replace('__SUB__', esc(sub)).replace('__QS__', qs ? '?key=' + qs : '').replace('__ROWS__', body)
    .replace('</body>', '<script>document.getElementById("toStudent").onclick=function(){var k=new URLSearchParams(location.search).get("key")||"";location.href="/?teacherkey="+encodeURIComponent(k)};</' + 'script></body>');
}

function renderCsv(rows) {
  const lines = ['学号,姓名,预估分,已覆盖考纲分,覆盖题数,累计作答,今日题数,活跃天数,待重练错题,最后活跃'];
  for (const s of rows) {
    lines.push([s.sid, s.name, s.score, s.tested, s.covered, s.answered, s.today, s.daysCount, s.wrongPend,
      s.updated ? new Date(s.updated).toISOString().replace('T', ' ').slice(0, 19) : ''].join(','));
  }
  return '\ufeff' + lines.join('\r\n');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- 题库 JSON（供 PK 模块等外部客户端 fetch；从打包的 data.js 现剥） ----
    if (path === '/api/bank') {
      try {
        const res = await env.ASSETS.fetch(new Request(new URL('/data.js', url).toString(), request));
        const text = await res.text();
        const startIdx = text.indexOf('window.BANK=');
        if (startIdx === -1) return json({ ok: false, err: 'bank_not_found' }, 500);
        const from = startIdx + 'window.BANK='.length;
        const endIdx = text.lastIndexOf(';');
        const bank = JSON.parse(text.slice(from, endIdx));
        const vm = text.match(/window\.BANK_VER='([^']+)'/);
        const mm = text.match(/window\.BANK_META=(\[[^\n]*?\]);/);
        return new Response(JSON.stringify({
          ok: true,
          ver: vm ? vm[1] : '',
          count: bank.length,
          meta: mm ? JSON.parse(mm[1]) : [],
          bank: bank
        }), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
            'cache-control': 'public, max-age=3600'
          }
        });
      } catch (e) {
        return json({ ok: false, err: 'bank_parse_failed', detail: String(e).slice(0, 120) }, 500);
      }
    }

    // ---- 学生端探测 ----
    if (path === '/api/hello') {
      return json({ mode: 'class', label: 'cloud' });
    }

    // ---- 档案同步 ----
    if (path === '/api/sync' && request.method === 'POST') {
      let body;
      try {
        const raw = await request.text();
        if (raw.length > 2 * 1024 * 1024) return json({ ok: false, err: 'too_large' }, 413);
        body = JSON.parse(raw);
      } catch { return json({ ok: false, err: 'bad_json' }, 400); }

      const sid = safeSid(body.sid);
      const name = safeName(body.name);
      if (!sid) return json({ ok: false, err: 'bad_sid' }, 400);

      // 班级码：已配置则强制校验（学生首次与后续每次都要带）
      if (env.CLASS_CODE && String(body.code || '').trim() !== String(env.CLASS_CODE)) {
        return json({ ok: false, err: 'code' }, 401);
      }
      if (!body.profile || typeof body.profile !== 'object') return json({ ok: false, err: 'bad_profile' }, 400);

      const store = makeStore(env);
      const old = (await store.get(sid)) || {};
      const merged = mergeProfile(old, body.profile);
      const now = Date.now();
      await store.put(sid, name, merged, now);

      const est = estimate(merged.answers);
      return json({ ok: true, score: est.score, tested: est.tested });
    }

    // ---- 云端班级名单（教师密钥；供学生端「课堂互动·从云端拉取」） ----
    if (path === '/api/students') {
      const key = (url.searchParams.get('key') || '').trim();
      if (!env.TEACHER_KEY || key !== env.TEACHER_KEY) {
        return json({ ok: false, err: 'forbidden' }, 403);
      }
      const store = makeStore(env);
      const all = await store.listAll();
      const students = all
        .filter(s => s.prof && Object.keys(s.prof.answers || {}).length > 0)
        .map(s => ({ sid: s.sid, name: s.name || s.sid }))
        .sort((a, b) => a.sid.localeCompare(b.sid, 'zh'));
      return json({ ok: true, count: students.length, students });
    }

    // ---- 教师页 / 导出（密钥鉴权） ----
    if (path === '/teacher' || path === '/teacher.csv') {
      const key = (url.searchParams.get('key') || '').trim();
      if (!env.TEACHER_KEY || key !== env.TEACHER_KEY) {
        return new Response('403 需要教师密钥：/teacher?key=…', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
      const store = makeStore(env);
      const all = await store.listAll();
      const rows = all
        .map(r => studentStats(r.sid, r.name, r.prof, r.updated))
        .filter(s => s.answered > 0 || s.covered > 0)
        .sort((a, b) => b.score - a.score || b.answered - a.answered);
      if (path === '/teacher.csv') {
        return new Response(renderCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename=xuekao-class.csv' } });
      }
      return new Response(renderTeacher(rows, key), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    // ---- 其余交给学生端静态页 ----
    return env.ASSETS.fetch(request);
  }
};
