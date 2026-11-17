from PIL import Image

im = Image.open("scripts/canvas_clipped.png").convert("RGB")
w, h = im.size

yellow_list = []
for y in range(h):
    for x in range(w):
        r, g, b = im.getpixel((x, y))
        if r > 120 and g > 100 and b < 80 and (r - b) > 40:
            yellow_list.append((x, y, r, g, b))

# Filter yellow pixels around the screen area (e.g. y between 50 and 300)
screen_yellow = [p for p in yellow_list if 50 < p[1] < 300]
print(f"Screen Yellow count: {len(screen_yellow)}")
if screen_yellow:
    y_xs = [p[0] for p in screen_yellow]
    print(f"Screen Yellow X: min={min(y_xs)}, max={max(y_xs)}, avg={sum(y_xs)/len(y_xs):.2f}")
