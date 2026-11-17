from PIL import Image

for name in ["full_sit_testcard.png", "full_walk_testcard.png", "full_lookaround_testcard.png"]:
    im = Image.open(f"scripts/{name}").convert("RGB")
    w, h = im.size
    # Count bright pixels in the center 60%
    bright = 0
    for y in range(int(h * 0.2), int(h * 0.8)):
        for x in range(int(w * 0.2), int(w * 0.8)):
            r, g, b = im.getpixel((x, y))
            if (r + g + b) / 3 > 60:
                bright += 1
    print(f"{name}: bright pixels = {bright}")
