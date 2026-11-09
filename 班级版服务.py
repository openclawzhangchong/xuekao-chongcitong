# -*- coding: utf-8 -*-
"""
学考冲刺通 · 班级版服务
只干一件事：学生刷题档案长久存到老师电脑，老师看全班学情。
- 学生：连教室 WiFi 扫码 → 输学号 → 刷题，每次交卷自动同步
- 老师：本机打开 /teacher 看榜单、导出 CSV（仅本机可开，学生够不着）
安全边界：不上公网、不连外网；学生只能上传自己的档案，看不了别人的。
依赖：仅 Python 标准库（二维码可选 qrcode 库，没装也能跑）。
"""
import json
import os
import re
import socket
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

BASE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(BASE, 'site')
DATA = os.path.join(BASE, 'data')
INDEX = os.path.join(SITE, 'index.html')
CLASSROOM_FILE = os.path.join(DATA, 'classroom.json')  # 课堂数据本地库（PK战绩/擂台/备课夹）
PORT = 8953

# 考纲分值（与前端 BANK_META 一致；qid 前缀即模块码）
MOD_SCORE = {'M1': 15, 'M2': 15, 'M3': 15, 'M4': 7, 'M5': 30,
             'M6': 30, 'M7': 15, 'M8': 8, 'M9': 15}
MOD_NAME = {'M1': '信息技术应用基础', 'M2': '图文编辑', 'M3': '电子表格',
            'M4': '演示文稿', 'M5': '网络应用', 'M6': 'Python',
            'M7': '信息安全', 'M8': '人工智能', 'M9': '大数据'}

SID_RE = re.compile(r'[0-9A-Za-z_\-\u4e00-\u9fa5]{1,32}')
NAME_RE = re.compile(r'[0-9A-Za-z_\-\u4e00-\u9fa5]{0,24}')


def safe_sid(s):
    """学号白名单：字母数字下划线短横线中文，防路径穿越"""
    if not isinstance(s, str):
        return None
    s = s.strip()
    return s if SID_RE.fullmatch(s) else None


def merge_classroom(stored, incoming):
    """课堂数据按 section 合并：
    - matches：并集去重（ts+双方学号+比分），按 ts 降序，上限 5000 —— 旧端点的新战绩也能并入
    - arena / prep：整段替换，时间戳新者胜
    容错：任何畸形输入都不抛错，只按缺省处理。"""
    def _as_dict(x):
        return x if isinstance(x, dict) else {}

    out = dict(_as_dict(stored))
    old_sec = _as_dict(out.get('sections'))
    new_sec = _as_dict(_as_dict(incoming).get('sections'))
    merged = dict(old_sec)

    def _mkey(m):
        left = m.get('left') or {}
        right = m.get('right') or {}
        return '|'.join(str(m.get('ts') or 0), ) + '|' + '|'.join([
            str(left.get('sid') or ''), str(right.get('sid') or ''),
            str(left.get('score') or 0), str(right.get('score') or 0),
            str(m.get('qcount') or 0)])

    try:
        old_m = (old_sec.get('matches') or {}).get('data') or []
        new_m = (new_sec.get('matches') or {}).get('data') or []
        if not isinstance(old_m, list):
            old_m = []
        if not isinstance(new_m, list):
            new_m = []
        seen, allm = set(), []
        for m in list(new_m) + list(old_m):
            if not isinstance(m, dict):
                continue
            k = _mkey(m)
            if k in seen:
                continue
            seen.add(k)
            allm.append(m)
        allm.sort(key=lambda m: m.get('ts') or 0, reverse=True)
        ts_old = (old_sec.get('matches') or {}).get('ts') or 0
        ts_new = (new_sec.get('matches') or {}).get('ts') or 0
        if allm or ts_old or ts_new:      # 空进空出，不制造空 section
            merged['matches'] = {'ts': max(ts_old, ts_new), 'data': allm[:5000]}
    except Exception:
        pass
    for name in ('arena', 'prep'):
        try:
            inc = new_sec.get(name)
            if isinstance(inc, dict) and 'ts' in inc and 'data' in inc:
                prev = old_sec.get(name) or {}
                if int(inc.get('ts') or 0) >= int(prev.get('ts') or -1):
                    merged[name] = inc
        except Exception:
            pass
    try:
        out['sections'] = merged
        out['updated'] = max(int(out.get('updated') or 0), int((incoming or {}).get('updated') or 0))
    except Exception:
        out['sections'] = merged
    return out


def load_classroom():
    """读课堂数据本地库；不存在/损坏返回空骨架（.bak 在写入时滚动）"""
    try:
        with open(CLASSROOM_FILE, encoding='utf-8') as f:
            doc = json.load(f)
        if isinstance(doc, dict) and 'sections' in doc:
            return doc
    except (OSError, ValueError):
        pass
    return {'sections': {}}


def save_classroom(doc):
    """写入课堂数据本地库；旧内容滚动到 .bak（单份备份，够教师机场景）"""
    os.makedirs(DATA, exist_ok=True)
    try:
        if os.path.exists(CLASSROOM_FILE):
            with open(CLASSROOM_FILE, encoding='utf-8') as f:
                old = f.read()
            with open(CLASSROOM_FILE + '.bak', 'w', encoding='utf-8') as f:
                f.write(old)
    except OSError:
        pass
    tmp = CLASSROOM_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False)
    os.replace(tmp, CLASSROOM_FILE)


def merge_profile(old, new):
    """合并学生档案：逐题取较大值（宽松策略，防多设备互相倒退）"""
    def num(x):
        try:
            return max(0, min(999, int(x)))
        except (TypeError, ValueError):
            return 0

    prof = {'v': 1, 'answers': {}, 'days': {}, 'history': [],
            'created': min(int(old.get('created') or time.time() * 1000),
                           int(new.get('created') or time.time() * 1000))}
    keys = set(old.get('answers') or {}) | set(new.get('answers') or {})
    for k in keys:
        o = (old.get('answers') or {}).get(k) or {}
        n = (new.get('answers') or {}).get(k) or {}
        prof['answers'][k] = {
            'a': max(num(o.get('a')), num(n.get('a'))),
            'w': max(num(o.get('w')), num(n.get('w'))),
            'k': max(num(o.get('k')), num(n.get('k'))),
            't': max(num(o.get('t')), num(n.get('t'))),
        }
        if prof['answers'][k]['a'] + prof['answers'][k]['w'] == 0:
            del prof['answers'][k]
    for d in set(old.get('days') or {}) | set(new.get('days') or {}):
        prof['days'][d] = max(num((old.get('days') or {}).get(d)),
                              num((new.get('days') or {}).get(d)))
    hist = [h for h in (old.get('history') or []) + (new.get('history') or [])
            if isinstance(h, dict) and isinstance(h.get('t'), (int, float))]
    hist.sort(key=lambda h: h['t'])
    seen, merged = set(), []
    for h in hist:
        key = (h['t'], h.get('score'))
        if key not in seen:
            seen.add(key)
            merged.append({'t': h['t'], 'score': h.get('score'),
                           'tested': h.get('tested'), 'mode': str(h.get('mode') or '')[:16]})
    prof['history'] = merged[-500:]
    return prof


def estimate(answers):
    """与服务端口径一致的 150 分制预估分（按 qid 前缀聚合模块）"""
    agg = {}
    for qid, rec in (answers or {}).items():
        m = str(qid).split('-', 1)[0]
        if m not in MOD_SCORE:
            continue
        a = agg.setdefault(m, [0, 0])
        try:
            a[0] += max(0, int(rec.get('a', 0)))
            a[1] += max(0, int(rec.get('w', 0)))
        except (TypeError, ValueError, AttributeError):
            pass
    score, tested = 0.0, 0
    for m, (a, w) in agg.items():
        n = a + w
        if n > 0:
            score += MOD_SCORE[m] * a / n
            tested += MOD_SCORE[m]
    return round(score, 1), tested


def student_stats(sid, doc):
    """教师榜单单行统计"""
    prof = doc.get('profile') or {}
    answers = prof.get('answers') or {}
    score, tested = estimate(answers)
    wrong_pend = sum(1 for r in answers.values()
                     if isinstance(r, dict) and r.get('w', 0) > 0 and r.get('k', 0) < 2)
    total_ans = sum((r.get('a', 0) + r.get('w', 0)) for r in answers.values() if isinstance(r, dict))
    days = prof.get('days') or {}
    today = datetime.now().strftime('%Y-%m-%d')
    t = doc.get('updated') or 0
    return {
        'sid': sid,
        'name': doc.get('name') or '',
        'score': score, 'tested': tested,
        'covered': len(answers), 'answered': total_ans,
        'wrongPend': wrong_pend,
        'today': days.get(today, 0),
        'days': len(days),
        'last': t,
    }


def load_students():
    out = []
    if not os.path.isdir(DATA):
        return out
    for fn in os.listdir(DATA):
        if not fn.endswith('.json'):
            continue
        try:
            with open(os.path.join(DATA, fn), encoding='utf-8') as f:
                doc = json.load(f)
            sid = fn[:-5]
            st = student_stats(sid, doc)
            if st['answered'] > 0 or st['covered'] > 0:
                out.append(st)
        except (OSError, ValueError):
            continue
    out.sort(key=lambda s: (-s['score'], -s['answered']))
    return out


TEACHER_TPL = """<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>学考冲刺通 · 班级学情</title><style>
body{margin:0;padding:22px;background:#0b1120;color:#e6edf7;font:14px/1.6 "Microsoft YaHei",system-ui,sans-serif}
h1{font-size:20px;margin:0 0 2px}
.sub{color:#8a97b1;font-size:12px;margin-bottom:16px}
.btn{background:#1b2740;color:#e6edf7;border:1px solid #243049;border-radius:9px;padding:6px 12px;
font-size:12px;cursor:pointer;text-decoration:none;display:inline-block;margin-right:8px}
table{border-collapse:collapse;width:100%;margin-top:12px}
th,td{padding:8px 10px;border-bottom:1px solid #1d2941;text-align:left;white-space:nowrap}
th{color:#8a97b1;font-size:12px;font-weight:600}
tr:hover td{background:#111a2e}
.score{font-weight:800;color:#a5b4fc}
.warn{color:#fbbf24}.err{color:#f87171}
.empty{color:#8a97b1;padding:30px;text-align:center}
</style></head><body>
<h1>🎯 学考冲刺通 · 班级学情</h1>
<div class="sub">__SUB__</div>
<a class="btn" href="/teacher.csv">⬇ 导出 CSV（Excel 可开）</a>
<a class="btn" href="/">打开学生端</a>
<a class="btn" href="javascript:location.href='/?teacherkey='+location.search.split('key=')[1]">📋 名单导入学生端</a>
<table><thead><tr>
<th>#</th><th>学号</th><th>姓名</th><th>预估分</th><th>已覆盖(分)</th>
<th>覆盖题数</th><th>累计作答</th><th>今日</th><th>活跃天数</th>
<th>待重练错题</th><th>最后活跃</th></tr></thead><tbody>
__ROWS__
</tbody></table></body></html>"""


def fmt_time(ms):
    """毫秒时间戳 → 'MM-DD HH:MM'；非法返回 '-'（updated 存毫秒，需先转秒）"""
    try:
        ms = float(ms)
        if ms <= 0:
            return '-'
        return time.strftime('%m-%d %H:%M', time.localtime(ms / 1000))
    except (TypeError, ValueError, OSError, OverflowError):
        return '-'


def render_teacher():
    rows = load_students()
    today = datetime.now().strftime('%Y-%m-%d')
    sub = '%d 名学生 · %s · 学生入口见启动窗口二维码 · 教师页仅本机可开' % (
        len(rows), today)
    if not rows:
        body = '<tr><td colspan="11" class="empty">还没有学生数据 —— 等学生扫码刷完第一组题就会出现在这里</td></tr>'
    else:
        buf = []
        for i, s in enumerate(rows, 1):
            cls = 'score' if s['score'] >= 90 else ('warn' if s['score'] >= 60 else 'err')
            buf.append(
                '<tr><td>%d</td><td><b>%s</b></td><td>%s</td><td class="%s">%s</td><td>%d/150</td>'
                '<td>%d</td><td>%d</td><td>%d</td><td>%d</td><td>%s</td><td>%s</td></tr>'
                % (i, esc(s['sid']), esc(s['name']) or '-', cls,
                   s['score'], s['tested'], s['covered'], s['answered'],
                   s['today'], s['days'], s['wrongPend'] or '-',
                   esc(fmt_time(s['last']))))
        body = '\n'.join(buf)
    return TEACHER_TPL.replace('__SUB__', esc(sub)).replace('__ROWS__', body)


def esc(s):
    return (str(s) if s is not None else '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def render_csv():
    rows = load_students()
    lines = ['学号,姓名,预估分,已覆盖考纲分,覆盖题数,累计作答,今日题数,活跃天数,待重练错题,最后活跃']
    for s in rows:
        last = ''
        try:
            if s['last'] and float(s['last']) > 0:
                last = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(float(s['last']) / 1000))
        except (TypeError, ValueError, OSError, OverflowError):
            last = ''
        lines.append('%s,%s,%s,%s,%d,%d,%d,%d,%d,%s' % (
            s['sid'], s['name'], s['score'], s['tested'], s['covered'],
            s['answered'], s['today'], s['days'], s['wrongPend'], last))
    return '\ufeff' + '\n'.join(lines)  # BOM: Excel 双击即开不乱码


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return '127.0.0.1'


class Handler(BaseHTTPRequestHandler):
    server_version = 'XueKaoClass/1.0'

    def log_message(self, fmt, *args):
        # pythonw（无控制台）下 sys.stderr 为 None，写日志会让每个请求空回复
        try:
            if sys.stderr is None:
                return
            sys.stderr.write('[%s] %s' % (self.log_date_time_string(), fmt % args))
        except Exception:
            pass

    def _local_only(self):
        return self.client_address[0] in ('127.0.0.1', '::1')

    def _send(self, code, body, ctype='text/html; charset=utf-8'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _post_classroom(self):
        if not self._local_only():
            self._send(403, json.dumps({'ok': False, 'err': 'forbidden'}).encode('utf-8'), 'application/json')
            return
        try:
            length = min(int(self.headers.get('Content-Length') or 0), 8 * 1024 * 1024)
            incoming = json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError, OSError):
            self._send(400, json.dumps({'ok': False, 'err': 'bad json'}).encode('utf-8'), 'application/json')
            return
        if not isinstance(incoming, dict) or not isinstance(incoming.get('sections') or {}, dict):
            self._send(400, json.dumps({'ok': False, 'err': 'bad sections'}).encode('utf-8'), 'application/json')
            return
        merged = merge_classroom(load_classroom(), incoming)
        try:
            save_classroom(merged)
        except OSError as e:
            self._send(500, json.dumps({'ok': False, 'err': str(e)[:120]}).encode('utf-8'), 'application/json')
            return
        sec = merged.get('sections') or {}
        self._send(200, json.dumps({'ok': True,
                                    'matches': len((sec.get('matches') or {}).get('data') or [])},
                                   ensure_ascii=False).encode('utf-8'), 'application/json')

    def do_GET(self):
        path = self.path.split('?')[0]
        if path in ('/', '/index.html'):
            try:
                with open(INDEX, 'rb') as f:
                    self._send(200, f.read(), 'text/html; charset=utf-8')
            except OSError:
                self._send(500, '找不到 site/index.html，请先 node src/build.js 并复制产物'.encode('utf-8'))
        elif path == '/data.js':
            # 拆分版题库文件（site/data.js）
            p = os.path.join(SITE, 'data.js')
            try:
                with open(p, 'rb') as f:
                    self._send(200, f.read(), 'application/javascript; charset=utf-8')
            except OSError:
                self._send(500, '找不到 site/data.js'.encode('utf-8'))
        elif path == '/api/hello':
            self._send(200, json.dumps({'mode': 'class'}).encode('utf-8'), 'application/json')
        elif path == '/api/bank':
            # 题库 JSON（供 PK 模块 fetch；从 site/data.js 现剥）
            try:
                with open(os.path.join(SITE, 'data.js'), encoding='utf-8') as f:
                    text = f.read()
                start = text.index('window.BANK=')
                # 只取 window.BANK= 所在那一行（文件尾部还有 BANK_META/XK_QID_MIGRATE 语句）
                line = text[start:text.index(chr(10), start)].strip()
                if line.endswith(';'):
                    line = line[:-1]
                bank = json.loads(line[len('window.BANK='):])
                # 默认题量闸门：与云端 worker.js 同构，默认只吐 2000 题白名单，
                # 只有 ?full=1（页面「释放全部题量」按钮打开后）才返回全库。
                marker = 'window.XK_BANK_INDEX='
                if 'full=1' not in self.path and marker in text:
                    s2 = text.index(marker) + len(marker)
                    line2 = text[s2:text.index(chr(10), s2)].strip()
                    if line2.endswith(';'):
                        line2 = line2[:-1]
                    idx = json.loads(line2)
                    if isinstance(idx, list) and idx and len(idx) <= len(bank):
                        bank = [bank[i] for i in idx]
                ver = ''
                if "window.BANK_VER='" in text:
                    ver = text.split("window.BANK_VER='")[1].split("'")[0]
                payload = json.dumps({'ok': True, 'ver': ver, 'count': len(bank), 'bank': bank},
                                     ensure_ascii=False)
                self._send(200, payload.encode('utf-8'), 'application/json; charset=utf-8')
            except (OSError, ValueError) as e:
                self._send(500, json.dumps({'ok': False, 'err': str(e)[:120]}).encode('utf-8'), 'application/json')
        elif path == '/api/music':
            # 课堂背景音乐歌单：教师把 mp3/wav 放进本目录 music/ 文件夹即自动加载
            mdir = os.path.join(BASE, 'music')
            files = []
            try:
                if os.path.isdir(mdir):
                    for n in sorted(os.listdir(mdir)):
                        if n.lower().endswith(('.mp3', '.wav', '.m4a', '.ogg', '.flac')):
                            files.append(n)
            except OSError:
                pass
            self._send(200, json.dumps({'ok': True, 'files': files}, ensure_ascii=False).encode('utf-8'),
                       'application/json')
        elif path.startswith('/music/'):
            if not self._local_only():
                self._send(403, json.dumps({'ok': False, 'err': 'forbidden'}).encode('utf-8'), 'application/json')
                return
            name = os.path.basename(unquote(path[len('/music/'):]))
            exts = {'.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac'}
            ext = os.path.splitext(name)[1].lower()
            fp = os.path.join(BASE, 'music', name)
            try:
                with open(fp, 'rb') as f:
                    self._send(200, f.read(), exts.get(ext, 'application/octet-stream'))
            except OSError:
                self._send(404, '404'.encode('utf-8'))
        elif path == '/api/classroom':
            # 课堂数据本地库（PK战绩/擂台/备课夹）——教师机数据，仅本机可读写
            if not self._local_only():
                self._send(403, json.dumps({'ok': False, 'err': 'forbidden'}).encode('utf-8'), 'application/json')
                return
            doc = load_classroom()
            self._send(200, json.dumps({'ok': True, 'sections': doc.get('sections') or {}},
                                       ensure_ascii=False).encode('utf-8'), 'application/json')
        elif path == '/api/students':
            # 云端/局域网名单拉取（供学生端「课堂互动·从云端拉取」；仅本机，学生设备够不着）
            if not self._local_only():
                self._send(403, json.dumps({'ok': False, 'err': 'forbidden'}).encode('utf-8'), 'application/json')
                return
            students = [{'sid': s['sid'], 'name': s['name'] or s['sid']}
                        for s in load_students() if s['covered'] > 0 or s['answered'] > 0]
            students.sort(key=lambda s: s['sid'])
            self._send(200, json.dumps({'ok': True, 'count': len(students), 'students': students},
                                       ensure_ascii=False).encode('utf-8'), 'application/json')
        elif path == '/teacher':
            if not self._local_only():
                self._send(403, '教师页仅限老师电脑本机打开'.encode('utf-8'))
                return
            self._send(200, render_teacher().encode('utf-8'))
        elif path == '/teacher.csv':
            if not self._local_only():
                self._send(403, '成绩导出仅限老师电脑本机'.encode('utf-8'))
                return
            self._send(200, render_csv().encode('utf-8'),
                       'text/csv; charset=utf-8')
        else:
            self._send(404, '404'.encode('utf-8'))

    def do_POST(self):
        path = self.path.split('?')[0]
        if path == '/api/classroom':
            self._post_classroom()
            return
        if path != '/api/sync':
            self._send(404, '404'.encode('utf-8'))
            return
        try:
            length = min(int(self.headers.get('Content-Length') or 0), 2 * 1024 * 1024)
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError, OSError):
            self._send(400, json.dumps({'ok': False, 'err': 'bad json'}).encode('utf-8'), 'application/json')
            return
        sid = safe_sid(payload.get('sid') or '')
        name = payload.get('name') or ''
        name = name if NAME_RE.fullmatch(str(name)) else ''
        prof = payload.get('profile')
        if not sid or not isinstance(prof, dict):
            self._send(400, json.dumps({'ok': False, 'err': 'bad sid/profile'}).encode('utf-8'), 'application/json')
            return
        os.makedirs(DATA, exist_ok=True)
        fp = os.path.join(DATA, sid + '.json')
        old = {}
        try:
            with open(fp, encoding='utf-8') as f:
                old = json.load(f)
        except (OSError, ValueError):
            pass
        merged = merge_profile(old, prof)
        doc = {'name': name or old.get('name') or '', 'updated': time.time() * 1000, 'profile': merged}
        tmp = fp + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False)
        os.replace(tmp, fp)
        score, tested = estimate(merged.get('answers'))
        self._send(200, json.dumps({'ok': True, 'score': score, 'tested': tested}).encode('utf-8'),
                   'application/json')


def main():
    os.makedirs(DATA, exist_ok=True)
    ip = lan_ip()
    url = 'http://%s:%d/' % (ip, PORT)
    print('=' * 56)
    print('  学考冲刺通 · 班级版已启动')
    print('  学生入口（同一 WiFi 手机浏览器打开）:')
    print('    %s' % url)
    print('  教师学情页（仅本机）: http://127.0.0.1:%d/teacher' % PORT)
    print('  数据目录: %s' % DATA)
    print('  关闭本窗口即停止服务')
    print('=' * 56)
    try:
        import qrcode  # 可选
        img_dir = BASE
        qr_path = os.path.join(img_dir, '学生入口二维码.png')
        qrcode.make(url).save(qr_path)
        print('  学生入口二维码已生成: %s' % qr_path)
        try:
            os.startfile(qr_path)  # Windows 自动打开方便投屏
        except (AttributeError, OSError):
            pass
    except ImportError:
        print('  （未装 qrcode 库，跳过二维码；pip install qrcode 可启用）')
    httpd = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止')


if __name__ == '__main__':
    main()
