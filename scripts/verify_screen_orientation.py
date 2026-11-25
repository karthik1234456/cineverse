from PIL import Image

im = Image.open("scripts/screen_rect.png").convert("RGB")
w, h = im.size

# Check top half of screen_rect.png where [LEFT] (cyan) and [RIGHT] (yellow) blocks are!
# On the canvas (1024x476):
# Left Cyan block is at x=32, y=32, w=200, h=85
# Right Yellow block is at x=1024-232=792, y=32, w=200, h=85
# Let's inspect the colors in the top 30% of the image

cyan_hits = []
yellow_hits = []

for y in range(int(h * 0.1), int(h * 0.5)):
    for x in range(w):
        r, g, b = im.getpixel((x, y))
        # Cyan block #06b6d4: B > G > R, specifically B > 120, G > 100, R < 60
        if b > 100 and g > 90 and r < 60:
            cyan_hits.append((x, y, r, g, b))
        # Yellow block #eab308: R > 130, G > 100, B < 60
        if r > 120 and g > 90 and b < 60:
            yellow_hits.append((x, y, r, g, b))

print(f"Cyan hits: {len(cyan_hits)}")
if cyan_hits:
    xs = [p[0] for p in cyan_hits]
    print(f"Cyan X: min={min(xs)}, max={max(xs)}, avg={sum(xs)/len(xs):.1f}")

print(f"Yellow hits: {len(yellow_hits)}")
if yellow_hits:
    xs = [p[0] for p in yellow_hits]
    print(f"Yellow X: min={min(xs)}, max={max(xs)}, avg={sum(yellow_hits)/len(yellow_hits):.1f}")

if cyan_hits and yellow_hits:
    avg_c = sum(xs)/len(xs)
    avg_y = sum([p[0] for p in yellow_hits])/len(yellow_hits)
    print(f"DELTA (Yellow - Cyan): {avg_y - avg_c:.1f}")
    if avg_c < avg_y:
        print("CONFIRMED: NORMAL / UNMIRRORED! Cyan [LEFT] is on Left, Yellow [RIGHT] is on Right!")
    else:
        print("WARNING: MIRRORED!")
