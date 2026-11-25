from PIL import Image

im = Image.open("scripts/full_sit_testcard.png").convert("RGB")
w, h = im.size
print(f"full_sit_testcard dimensions: {w}x{h}")

# Let's find any text or color blocks in the screen area
# Let's inspect rows around y=300 to 500 across x from 100 to 1000
for y in range(300, 500, 40):
    for x in range(200, 800, 100):
        print(f"({x}, {y}): {im.getpixel((x, y))}")
