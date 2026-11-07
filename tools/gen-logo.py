# -*- coding: utf-8 -*-
"""生成客户端 logo：深紫渐变圆角方块 + 白色「课」字 + 右下角 zc 角标
产出：src/assets/logo.png（256）、src/assets/icon.ico（多尺寸）、site/favicon.svg
用法：python -I tools/gen-logo.py"""
import io, os

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit('需要 Pillow：pip install pillow')

S = 256
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
grad = Image.new('RGBA', (S, S))
gd = ImageDraw.Draw(grad)
top, bot = (0x6D, 0x28, 0xD8), (0x4C, 0x1D, 0x95)   # 深紫渐变（呼应全站主色）
for y in range(S):
    t = y / (S - 1)
    gd.line([(0, y), (S, y)], fill=(int(top[0] + (bot[0] - top[0]) * t),
                                   int(top[1] + (bot[1] - top[1]) * t),
                                   int(top[2] + (bot[2] - top[2]) * t), 255))
mask = Image.new('L', (S, S), 0)
md = ImageDraw.Draw(mask)
try:
    md.rounded_rectangle([0, 0, S - 1, S - 1], radius=44, fill=255)
except AttributeError:
    md.rectangle([0, 0, S - 1, S - 1], fill=255)
img.paste(grad, (0, 0), mask)

font_paths = [r'C:\Windows\Fonts\msyhbd.ttc', r'C:\Windows\Fonts\msyh.ttc',
              r'C:\Windows\Fonts\simhei.ttf', r'C:\Windows\Fonts\arial.ttf']
font = None
for fp in font_paths:
    if os.path.exists(fp):
        font = ImageFont.truetype(fp, 148)
        break
d = ImageDraw.Draw(img)
if font:
    bb = d.textbbox((0, 0), '课', font=font)
    d.text(((S - (bb[2] - bb[0])) / 2 - bb[0], (S - (bb[3] - bb[1])) / 2 - bb[1] - 8),
           '课', font=font, fill=(255, 255, 255, 255))

zfont = None
for fp in font_paths:
    if os.path.exists(fp):
        zfont = ImageFont.truetype(fp, 26)
        break
if zfont:
    d.text((S - 48, S - 36), 'zc', font=zfont, fill=(255, 255, 255, 165))

os.makedirs('src/assets', exist_ok=True)
img.save('src/assets/logo.png')
img.save('src/assets/icon.ico', sizes=[(256, 256), (64, 64), (48, 48), (32, 32), (16, 16)])

# 同步产出矢量 favicon.svg（同构：渐变圆角 + 课 + zc）
svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
       '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
       '<stop offset="0" stop-color="#6D28D8"/><stop offset="1" stop-color="#4C1D95"/>'
       '</linearGradient></defs>'
       '<rect width="64" height="64" rx="11" fill="url(#g)"/>'
       '<text x="32" y="41" font-family="Microsoft YaHei,SimHei,sans-serif" font-size="37" '
       'font-weight="700" fill="#fff" text-anchor="middle">课</text>'
       '<text x="57" y="58" font-family="Arial,sans-serif" font-size="9" '
       'fill="#ffffff" fill-opacity="0.65" text-anchor="end">zc</text></svg>')
os.makedirs('site', exist_ok=True)
io.open('site/favicon.svg', 'w', encoding='utf-8', newline='').write(svg)
print('logo OK -> src/assets/logo.png + icon.ico + site/favicon.svg')
