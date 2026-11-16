"""Draws web/logo.png (1024x1024): five validators in a ring around one answer. Pure Pillow, no external assets."""
import math, sys
from PIL import Image, ImageDraw
S = 2048  # supersample, downscaled to 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((0, 0, S - 1, S - 1), radius=420, fill=(20, 49, 42, 255))
cx = cy = S // 2
R = 600
pts = [(cx + R * math.cos(math.radians(-90 + 72 * i)), cy + R * math.sin(math.radians(-90 + 72 * i))) for i in range(5)]
for p in pts:  # spokes to the centre
    d.line([p, (cx, cy)], fill=(127, 191, 169, 110), width=26)
for i in range(5):  # ring between neighbours
    d.line([pts[i], pts[(i + 1) % 5]], fill=(127, 191, 169, 190), width=34)
for (x, y) in pts:
    d.ellipse((x - 150, y - 150, x + 150, y + 150), fill=(127, 191, 169, 255))
    d.ellipse((x - 70, y - 70, x + 70, y + 70), fill=(20, 49, 42, 255))
d.ellipse((cx - 330, cy - 330, cx + 330, cy + 330), fill=(250, 250, 247, 255))
chk = [(cx - 170, cy + 10), (cx - 40, cy + 150), (cx + 190, cy - 140)]
d.line(chk, fill=(47, 93, 80, 255), width=96, joint="curve")
for (x, y) in (chk[0], chk[2]):
    d.ellipse((x - 48, y - 48, x + 48, y + 48), fill=(47, 93, 80, 255))
out = img.resize((1024, 1024), Image.LANCZOS)
out.save(sys.argv[1] if len(sys.argv) > 1 else "web/logo.png", optimize=True)
print(out.size)
