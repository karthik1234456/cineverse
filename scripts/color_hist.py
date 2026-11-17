from PIL import Image
from collections import Counter

im = Image.open("scripts/screen_rect.png").convert("RGB")
colors = Counter(im.getdata())
print("Top 20 most frequent colors:")
for c, count in colors.most_common(20):
    print(f"Color RGB={c}: {count} pixels")
