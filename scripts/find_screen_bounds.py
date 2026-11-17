from PIL import Image

im = Image.open("scripts/canvas_clipped.png").convert("RGB")
w, h = im.size

bright_pixels = []
for y in range(h):
    for x in range(w):
        r, g, b = im.getpixel((x, y))
        brightness = (r + g + b) / 3
        if brightness > 120:
            bright_pixels.append((x, y, r, g, b, brightness))

print(f"Total bright pixels: {len(bright_pixels)}")
if bright_pixels:
    bright_pixels.sort(key=lambda p: -p[5])
    print("Top 15 brightest pixels:")
    for p in bright_pixels[:15]:
        print(f"x={p[0]}, y={p[1]}, RGB=({p[2]},{p[3]},{p[4]}), brightness={p[5]:.1f}")
