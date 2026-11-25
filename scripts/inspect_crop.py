from PIL import Image

im = Image.open(r"C:\Users\KARTHIK\.gemini\antigravity\brain\b126ff79-e052-4efd-9d46-663877753dee\evidence\orientation\testcard_screen_crop.png").convert("RGB")
w, h = im.size

# Let's find distinct color clusters in the cropped image
# Print colors of interesting pixels
cyan_pixels = []
yellow_pixels = []

for y in range(h):
    for x in range(w):
        r, g, b = im.getpixel((x, y))
        # Cyan block is #06b6d4 -> (6, 182, 212)
        if b > 120 and g > 100 and r < 50:
            cyan_pixels.append((x, y, r, g, b))
        # Yellow block is #eab308 -> (234, 179, 8)
        if r > 150 and g > 110 and b < 50:
            yellow_pixels.append((x, y, r, g, b))

print(f"Cropped Cyan count: {len(cyan_pixels)}")
if cyan_pixels:
    xs = [p[0] for p in cyan_pixels]
    print(f"Cyan X range: {min(xs)} to {max(xs)}, avg: {sum(xs)/len(xs)}")

print(f"Cropped Yellow count: {len(yellow_pixels)}")
if yellow_pixels:
    xs = [p[0] for p in yellow_pixels]
    print(f"Yellow X range: {min(xs)} to {max(xs)}, avg: {sum(xs)/len(xs)}")
