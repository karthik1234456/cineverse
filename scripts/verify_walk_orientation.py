from PIL import Image

im = Image.open("scripts/full_walk_testcard.png").convert("RGB")
w, h = im.size
print(f"full_walk_testcard size: {w}x{h}")

# The 3D canvas is on the left (x < 1440 - 384 = 1056)
# Inside the 3D viewport, screen is in the upper/middle area
cyan_xs = []
yellow_xs = []
green_xs = [] # arrow is #10b981

for y in range(int(h * 0.15), int(h * 0.70)):
    for x in range(int(w * 0.1), 1050):
        r, g, b = im.getpixel((x, y))
        # Cyan block is #06b6d4 -> (6, 182, 212)
        if b > 140 and g > 110 and r < 70 and (b - r) > 70:
            cyan_xs.append((x, y))
        # Yellow block is #eab308 -> (234, 179, 8)
        if r > 160 and g > 120 and b < 60 and (r - b) > 100:
            yellow_xs.append((x, y))
        # Green arrow #10b981 -> (16, 185, 129)
        if g > 130 and r < 80 and b < 120:
            green_xs.append((x, y))

print(f"Cyan hits: {len(cyan_xs)}")
if cyan_xs:
    c_x = [p[0] for p in cyan_xs]
    print(f"Cyan X: min={min(c_x)}, max={max(c_x)}, avg={sum(c_x)/len(c_x):.2f}")

print(f"Yellow hits: {len(yellow_xs)}")
if yellow_xs:
    y_x = [p[0] for p in yellow_xs]
    print(f"Yellow X: min={min(y_x)}, max={max(y_x)}, avg={sum(y_x)/len(y_x):.2f}")

print(f"Green hits: {len(green_xs)}")
if green_xs:
    g_x = [p[0] for p in green_xs]
    print(f"Green X: min={min(g_x)}, max={max(g_x)}, avg={sum(g_x)/len(g_x):.2f}")

if cyan_xs and yellow_xs:
    avg_c = sum([p[0] for p in cyan_xs]) / len(cyan_xs)
    avg_y = sum([p[0] for p in yellow_xs]) / len(yellow_xs)
    delta = avg_y - avg_c
    print(f"\nDelta X (Yellow - Cyan): {delta:.2f} pixels")
    if avg_c < avg_y:
        print(">>> PROVEN: NORMAL (UNMIRRORED) ORIENTATION! <<<")
        print(f">>> Cyan [LEFT] is at Audience Left (x={avg_c:.1f}), Yellow [RIGHT] is at Audience Right (x={avg_y:.1f}) <<<")
    else:
        print(">>> WARNING: MIRRORED! <<<")
