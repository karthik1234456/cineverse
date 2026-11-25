from PIL import Image

im = Image.open("scripts/canvas_clipped.png").convert("RGB")
w, h = im.size

bright_xs = []
bright_ys = []

for y in range(h):
    for x in range(w):
        r, g, b = im.getpixel((x, y))
        if (r + g + b) / 3 > 100:
            bright_xs.append(x)
            bright_ys.append(y)

print(f"Screen bounding box in canvas:")
print(f"X: {min(bright_xs)} to {max(bright_xs)} (center: {(min(bright_xs)+max(bright_xs))/2:.1f})")
print(f"Y: {min(bright_ys)} to {max(bright_ys)} (center: {(min(bright_ys)+max(bright_ys))/2:.1f})")

# Let's crop just this screen bounding box and save it to 'scripts/screen_rect.png'
crop_screen = im.crop((min(bright_xs), min(bright_ys), max(bright_xs), max(bright_ys)))
crop_screen.save("scripts/screen_rect.png")
print("Saved screen_rect.png")
