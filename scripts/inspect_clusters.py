from PIL import Image

im = Image.open(r"C:\Users\KARTHIK\.gemini\antigravity\brain\b126ff79-e052-4efd-9d46-663877753dee\evidence\orientation\testcard_screen_crop.png").convert("RGB")
w, h = im.size

cyan_pixels = []
yellow_pixels = []

for y in range(h):
    for x in range(w):
        r, g, b = im.getpixel((x, y))
        if b > 140 and g > 120 and r < 50:
            cyan_pixels.append((x, y, r, g, b))
        if r > 180 and g > 140 and b < 50:
            yellow_pixels.append((x, y, r, g, b))

cyan_pixels.sort(key=lambda p: p[0])
yellow_pixels.sort(key=lambda p: p[0])

print("Cyan pixels (first 10):", cyan_pixels[:10])
print("Cyan pixels (last 10):", cyan_pixels[-10:])

print("Yellow pixels (first 10):", yellow_pixels[:10])
print("Yellow pixels (last 10):", yellow_pixels[-10:])
