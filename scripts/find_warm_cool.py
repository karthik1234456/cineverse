from PIL import Image

im = Image.open("scripts/canvas_clipped.png").convert("RGB")
w, h = im.size

# Let's inspect the entire image for cyan-ish vs yellow-ish
cyan_list = []
yellow_list = []

for y in range(h):
    for x in range(w):
        r, g, b = im.getpixel((x, y))
        # Cyan block is Cyan: G > 100, B > 100, R < 80
        if b > 120 and g > 100 and r < 80 and (b - r) > 40:
            cyan_list.append((x, y, r, g, b))
        # Yellow block is Yellow: R > 120, G > 100, B < 80 and (r - b) > 40
        if r > 120 and g > 100 and b < 80 and (r - b) > 40:
            yellow_list.append((x, y, r, g, b))

print(f"Cyan candidates: {len(cyan_list)}")
if cyan_list:
    c_xs = [p[0] for p in cyan_list]
    print(f"Cyan X: min={min(c_xs)}, max={max(c_xs)}, avg={sum(c_xs)/len(c_xs):.2f}")

print(f"Yellow candidates: {len(yellow_list)}")
if yellow_list:
    y_xs = [p[0] for p in yellow_list]
    print(f"Yellow X: min={min(y_xs)}, max={max(y_xs)}, avg={sum(y_xs)/len(y_xs):.2f}")
