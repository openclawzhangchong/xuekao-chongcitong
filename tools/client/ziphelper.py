# -*- coding: utf-8 -*-
"""zip 助手：打包目录 / 解压 zip（UTF-8 中文文件名安全）
用法：
  python -I tools/client/ziphelper.py <源目录> <输出.zip>     打包
  python -I tools/client/ziphelper.py --extract <zip> <目标>  解压"""
import os
import sys
from zipfile import ZipFile, ZIP_DEFLATED

if len(sys.argv) >= 2 and sys.argv[1] == '--extract':
    zpath, dest = sys.argv[2], sys.argv[3]
    os.makedirs(dest, exist_ok=True)
    with ZipFile(zpath) as zf:
        zf.extractall(dest)
    print('extracted %d entries -> %s' % (len(zf.namelist()), dest))
    sys.exit(0)

src, out = sys.argv[1], sys.argv[2]
n = 0
with ZipFile(out, 'w', ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        for f in files:
            p = os.path.join(root, f)
            arc = os.path.relpath(p, src).replace(os.sep, '/')
            z.write(p, arc)
            n += 1
print('zipped %d files -> %s' % (n, out))
