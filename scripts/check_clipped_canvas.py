from PIL import Image

im = Image.open("scripts/canvas_clipped.png").convert("RGB")
w, h = im.size
print(f"Clipped canvas dimensions: {w}x{h}")

cyan_xs = []
yellow_xs = []

for y in range(h):
    for x in range(w):
        r, g, b = im.getpixel((x, y))
        # Cyan block is #06b6d4 -> (6, 182, 212)
        if b > 140 and g > 120 and r < 50:
            cyan_xs.append(x)
        # Yellow block is #eab308 -> (234, 179, 8)
        if r > 180 and g > 140 and b < 50:
            yellow_xs.append(x)

print(f"Cyan count: {len(cyan_xs)}")
if cyan_xs:
    print(f"Cyan X range: {min(cyan_xs)} to {max(cyan_xs)}, avg: {sum(cyan_xs)/len(cyan_xs):.2f}")

print(f"Yellow count: {len(yellow_xs)}")
if yellow_xs:
    print(f"Yellow X range: {min(yellow_xs)} to {max(yellow_xs)}, avg: {sum(yellow_xs)/len(yellow_xs):.2f}")

if cyan_xs and yellow_xs:
    avg_c = sum(cyan_xs) / len(cyan_xs)
    avg_y = sum(yellow_xs) / len(yellow_xs)
    delta = avg_y - avg_c
    print(f"Delta X (Yellow - Cyan): {delta:.2f}")
    if avg_c < avg_y:
        print("RESULT: NORMAL / UNMIRRORED (Audience Left Cyan is on Left, Audience Right Yellow is on Right)")
    else:
        print("RESULT: MIRRORED (REVERSED)")
