"""Draws sla/logo.png (1024x1024): a balance with a coin on one pan and a clock on the other. Pure Pillow, no external assets."""
import math, sys
from PIL import Image, ImageDraw
S = 2048
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((0, 0, S - 1, S - 1), radius=420, fill=(26, 31, 58, 255))
AM, CR = (242, 169, 59, 255), (245, 240, 228, 255)
cx = S // 2
d.rectangle((cx - 40, 430, cx + 40, 1560), fill=AM)            # post
d.rounded_rectangle((cx - 330, 1560, cx + 330, 1650), radius=40, fill=AM)  # base
d.ellipse((cx - 90, 340, cx + 90, 520), fill=AM)                # pivot
d.line([(cx - 640, 600), (cx + 640, 600)], fill=AM, width=70)   # beam
for sx in (-640, 640):                                          # hangers and pans
    x = cx + sx
    d.line([(x, 600), (x - 230, 1130)], fill=AM, width=26)
    d.line([(x, 600), (x + 230, 1130)], fill=AM, width=26)
    d.pieslice((x - 300, 880, x + 300, 1380), 0, 180, fill=AM)
# coin on the left pan
lx = cx - 640
d.ellipse((lx - 150, 770, lx + 150, 1070), fill=CR)
d.ellipse((lx - 100, 820, lx + 100, 1020), outline=(26, 31, 58, 255), width=26)
# clock on the right pan
rx = cx + 640
d.ellipse((rx - 150, 770, rx + 150, 1070), fill=CR)
d.line([(rx, 920), (rx, 810)], fill=(26, 31, 58, 255), width=30)
d.line([(rx, 920), (rx + 80, 960)], fill=(26, 31, 58, 255), width=30)
d.ellipse((rx - 22, 898, rx + 22, 942), fill=(26, 31, 58, 255))
out = img.resize((1024, 1024), Image.LANCZOS)
out.save(sys.argv[1] if len(sys.argv) > 1 else "sla/logo.png", optimize=True)
print(out.size)
