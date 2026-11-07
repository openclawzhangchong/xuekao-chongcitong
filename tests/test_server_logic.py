# -*- coding: utf-8 -*-
"""班级版服务端逻辑单测：python tests/test_server_logic.py（零依赖）"""
import importlib.util
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location(
    "cls", os.path.join(BASE, "班级版服务.py"))
cls = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cls)

from datetime import date as _date
TODAY = _date.today().isoformat()
passed = failed = 0


def assert_eq(got, want):
    assert got == want, "got=%r want=%r" % (got, want)


def t(name, fn):
    global passed, failed
    try:
        fn()
        passed += 1
        print("  [OK] " + name)
    except AssertionError as e:
        failed += 1
        print("  [FAIL] " + name + " :: " + str(e))


print("== 1. 学号白名单 ==")
t("正常学号 2025001 通过", lambda: assert_eq(cls.safe_sid("2025001"), "2025001"))
t("中文学号允许", lambda: assert_eq(cls.safe_sid("张三03"), "张三03"))
t("路径穿越拒绝: ../evil", lambda: assert_eq(cls.safe_sid("../evil"), None))
t("路径穿越拒绝: a/b", lambda: assert_eq(cls.safe_sid("a/b"), None))
t("反斜杠拒绝: a\\b", lambda: assert_eq(cls.safe_sid("a\\b"), None))
t("超长截断拒绝(>32)", lambda: assert_eq(cls.safe_sid("a" * 33), None))
t("非字符串拒绝", lambda: assert_eq(cls.safe_sid(123), None))
t("空拒绝", lambda: assert_eq(cls.safe_sid("   "), None))

print("== 2. 档案合并（多设备不倒退） ==")
old = {"created": 1000,
       "answers": {"M1-x": {"a": 3, "w": 1, "k": 1, "t": 5}, "M2-y": {"a": 0, "w": 2, "k": 0, "t": 6}},
       "days": {"2026-11-04": 10}, "history": [{"t": 5, "score": 80, "tested": 100, "mode": "pr"}]}
new = {"created": 2000,
       "answers": {"M1-x": {"a": 1, "w": 0, "k": 0, "t": 3}, "M3-z": {"a": 2, "w": 0, "k": 2, "t": 7}},
       "days": {"2026-11-05": 20}, "history": [{"t": 9, "score": 90, "tested": 120, "mode": "pr"}]}
m = cls.merge_profile(old, new)
t("created 取更早", lambda: assert_eq(m["created"], 1000))
t("a 取 max(3,1)=3", lambda: assert_eq(m["answers"]["M1-x"]["a"], 3))
t("w 取 max(1,0)=1", lambda: assert_eq(m["answers"]["M1-x"]["w"], 1))
t("新题 M3-z 进入", lambda: assert_eq(m["answers"]["M3-z"]["a"], 2))
t("days 并集", lambda: assert_eq((m["days"]["2026-11-04"], m["days"]["2026-11-05"]), (10, 20)))
t("history 按 t 排序合并去重", lambda: assert_eq([h["t"] for h in m["history"]], [5, 9]))
t("max 合并保住旧进度：old a=1 vs new a=0 → 保留1", lambda: assert_eq("M9-bad" in cls.merge_profile(
    {"answers": {"M9-bad": {"a": 1}}}, {"answers": {"M9-bad": {"a": 0, "w": 0}}})["answers"], True))
t("两边全零才丢弃", lambda: assert_eq("M9-bad" in cls.merge_profile(
    {"answers": {"M9-bad": {"a": 0, "w": 0}}}, {"answers": {"M9-bad": {"a": 0, "w": 0}}})["answers"], False))
t("非数字字段不炸", lambda: cls.merge_profile({"answers": {"x": {"a": "abc"}}}, {"answers": {}}))

print("== 3. 预估分（服务端口径对账） ==")
t("M1 全对 → 15 分/覆盖15", lambda: assert_eq(cls.estimate({"M1-abc": {"a": 5, "w": 0}}), (15.0, 15)))
t("M1 对错各半 → 7.5", lambda: assert_eq(cls.estimate({"M1-abc": {"a": 1, "w": 1}}), (7.5, 15)))
t("M8 考纲8分 → 全对8分", lambda: assert_eq(cls.estimate({"M8-q": {"a": 2}}), (8.0, 8)))
t("空档案 → (0,0)", lambda: assert_eq(cls.estimate({}), (0, 0)))
t("脏 qid 忽略", lambda: assert_eq(cls.estimate({"XX-1": {"a": 9}}), (0, 0)))

print("== 4. 学生统计行 ==")
doc = {"name": "林静静", "updated": 1700000000000, "profile": {
    "answers": {"M1-a": {"a": 10, "w": 0, "k": 2}, "M1-b": {"a": 0, "w": 3, "k": 0}, "M2-c": {"a": 4, "w": 1, "k": 1}},
    "days": {TODAY: 12, "2026-11-04": 8}, "history": []}}
s = cls.student_stats("2025011", doc)
t("预估分 = M1 (10/13)×15=11.5 + M2 (4/5)×15=12 → 23.5", lambda: assert_eq(s["score"], 23.5))
t("待重练错题 = M1-b(连对0) + M2-c(连对1未满2) → 2", lambda: assert_eq(s["wrongPend"], 2))
t("今日 = 12", lambda: assert_eq(s["today"], 12))
t("覆盖题数 = 3", lambda: assert_eq(s["covered"], 3))
t("累计作答 = 18", lambda: assert_eq(s["answered"], 18))
t("活跃天数 = 2", lambda: assert_eq(s["days"], 2))

print("== 5. 教师页与 CSV ==")
import tempfile
real_data = cls.DATA
cls.DATA = tempfile.mkdtemp(prefix="xkc_empty_")
t("空数据教师页正常渲染", lambda: assert_eq("还没有学生数据" in cls.render_teacher(), True))
t("空数据 CSV 只有表头", lambda: assert_eq(cls.render_csv(), "\ufeff学号,姓名,预估分,已覆盖考纲分,覆盖题数,累计作答,今日题数,活跃天数,待重练错题,最后活跃"))
cls.DATA = real_data
import os as _os, json as _json, tempfile as _tf2
_fixdir = _tf2.mkdtemp(prefix="xkc_fix_")
_fixpath = _os.path.join(_fixdir, "2025099.json")
with open(_fixpath, "w", encoding="utf-8") as _f:
    _json.dump({"name": "测试学生", "updated": 1700000000000, "profile": {"answers": {"M1-a": {"a": 3, "w": 0, "k": 2}}, "days": {}, "history": []}}, _f, ensure_ascii=False)
_data_backup = cls.DATA
cls.DATA = _fixdir
t("fixture 学生出现在教师页", lambda: assert_eq("2025099" in cls.render_teacher(), True))
_os.remove(_fixpath)
cls.DATA = _data_backup
t("删除 fixture 后恢复", lambda: assert_eq("2025099" not in cls.render_teacher(), True))
print("== 6. fmt_time 毫秒时间戳回归（Windows strftime 溢出缺陷） ==")
import time as _t
now_ms = _t.time() * 1000
t("毫秒时间戳正常格式化", lambda: assert_eq(len(cls.fmt_time(now_ms)), 11))
t("秒级误传也能容错", lambda: assert_eq(len(cls.fmt_time(_t.time())), 11))
t("删除 fixture 后恢复", lambda: assert_eq("2025099" not in cls.render_teacher(), True))
t("非法值返回 -", lambda: assert_eq(cls.fmt_time("abc"), "-"))
t("负值返回 -", lambda: assert_eq(cls.fmt_time(-5), "-"))
t("0 返回 -", lambda: assert_eq(cls.fmt_time(0), "-"))

print("\n== 9. 课堂数据合并 merge_classroom ==")
t("matches 并集去重（新旧两端的新战绩都保留）", lambda: assert_eq(
    len(cls.merge_classroom(
        {'sections': {'matches': {'ts': 100, 'data': [{'ts': 100, 'left': {'sid': 'A'}, 'right': {'sid': 'B'}, 'score': ''}]}}},
        {'sections': {'matches': {'ts': 200, 'data': [
            {'ts': 100, 'left': {'sid': 'A'}, 'right': {'sid': 'B'}, 'score': ''},
            {'ts': 200, 'left': {'sid': 'C'}, 'right': {'sid': 'D'}, 'score': ''}]}}}
    ).get('sections', {}).get('matches', {}).get('data') or []), 2))
t("matches 完全相同的一条只保留一份", lambda: assert_eq(
    len(cls.merge_classroom(
        {'sections': {'matches': {'ts': 100, 'data': [{'ts': 100, 'left': {'sid': 'A'}, 'right': {'sid': 'B'}, 'score': ''}]}}},
        {'sections': {'matches': {'ts': 100, 'data': [{'ts': 100, 'left': {'sid': 'A'}, 'right': {'sid': 'B'}, 'score': ''}]}}}
    ).get('sections', {}).get('matches', {}).get('data') or []), 1))
t("arena 时间戳新者胜", lambda: assert_eq(
    cls.merge_classroom(
        {'sections': {'arena': {'ts': 100, 'data': {'round': 1}}}},
        {'sections': {'arena': {'ts': 200, 'data': {'round': 3}}}}
    ).get('sections', {}).get('arena', {}).get('data', {}).get('round'), 3))
t("arena 时间戳旧的不覆盖新的", lambda: assert_eq(
    cls.merge_classroom(
        {'sections': {'arena': {'ts': 200, 'data': {'round': 3}}}},
        {'sections': {'arena': {'ts': 100, 'data': {'round': 1}}}}
    ).get('sections', {}).get('arena', {}).get('data', {}).get('round'), 3))
t("畸形输入不抛错（sections 非 dict）", lambda: assert_eq(
    isinstance(cls.merge_classroom({'sections': {}}, {'sections': 'oops'}).get('sections'), dict), True))
t("空存储 + 空 incoming 返回空骨架", lambda: assert_eq(
    cls.merge_classroom(None, None).get('sections'), {}))
t("matches 上限 5000 条且按 ts 降序截断", lambda: assert_eq(
    (lambda doc: len(doc['sections']['matches']['data']) <= 5000 and doc['sections']['matches']['data'][0]['ts'] == 999999)(
        cls.merge_classroom({'sections': {}}, {'sections': {'matches': {'ts': 999999, 'data': [
            {'ts': i, 'left': {'sid': str(i)}, 'right': {'sid': 'x'}, 'score': ''} for i in range(999000, 1000000)]}}})
    ), True))

print("\n结果: %d 通过, %d 失败" % (passed, failed))
sys.exit(1 if failed else 0)
