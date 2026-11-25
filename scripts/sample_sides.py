from PIL import Image

im = Image.open("scripts/canvas_clipped.png").convert("RGB")
w, h = im.size

# Sample a box on the left around x=194 and on the right around x=700
print("Left side samples (around x=194):")
for y in range(150, 250, 15):
    print(f"y={y}:", [im.getpixel((x, y)) for x in range(180, 220, 10)])

print("\nRight side samples (around x=700):")
for y in range(150, 250, 15):
    print(f"y={y}:", [im.getpixel((x, y)) for x in range(680, 720, 10)])
