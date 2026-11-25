from PIL import Image

im = Image.open("scripts/canvas_clipped.png").convert("RGB")
w, h = im.size

for y in range(h):
    r, g, b = im.getpixel((197, y))
    if b > 120 and g > 100:
        print(f"y={y}: RGB=({r},{g},{b})")
