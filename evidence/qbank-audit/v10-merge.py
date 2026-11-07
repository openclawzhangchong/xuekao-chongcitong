# -*- coding: utf-8 -*-
"""合并 v10-fix-p*.json → 结构校验 → 产出 v10-all.json"""
import json, io, glob, os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
all_fixes = []
for f in sorted(glob.glob('evidence/qbank-audit/v10-fix-p*.json')):
    try:
        data = json.load(io.open(f, encoding='utf-8'))
        all_fixes.extend(data)
    except Exception as e:
        print('跳过', f, e)

print('合并总数:', len(all_fixes))
bad = 0
seen = set()
global.window = {}
for f in all_fixes:
    i = f.get('i')
    field = f.get('field')
    key = str(i) + '|' + str(field)
    if key in seen:
        print('重复:', key); bad += 1
    seen.add(key)
    if field not in ('a', 'e', 'o', 's', 'SKIP'):
        print('非法 field:', key); bad += 1
    if field == 'o':
        try:
            arr = json.loads(f['fix'])
            if not isinstance(arr, list) or len(arr) < 2:
                print('o-fix 非法数组: i=' + str(i)); bad += 1
        except Exception:
            print('o-fix JSON 解析失败: i=' + str(i)); bad += 1

if bad:
    print('校验失败', bad, '条')
    exit(1)
io.open('evidence/qbank-audit/v10-all.json', 'w', encoding='utf-8').write(json.dumps(all_fixes, ensure_ascii=False, indent=1))
print('写出 v10-all.json（' + str(len(all_fixes)) + ' 条，涉及 ' + str(len(set(f.get("i") for f in all_fixes))) + ' 题）')
