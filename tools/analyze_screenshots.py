import os
import sys
import math
from PIL import Image

evidence_dir = os.path.join(os.path.dirname(__file__), '..', 'docs', 'evidence', 'phase-2b')
seated_img_path = os.path.join(evidence_dir, '03_seated_a05.png')

if not os.path.exists(seated_img_path):
    print(f"Error: {seated_img_path} not found")
    sys.exit(1)

img = Image.open(seated_img_path).convert('RGB')
w, h = img.size

print(f"Loaded {seated_img_path}: {w}x{h}")

# In seated A05 view, the cinema screen occupies roughly the upper central region:
# y: 15% to 65%, x: 20% to 80%
box = (int(w * 0.20), int(h * 0.15), int(w * 0.80), int(h * 0.65))
screen_crop = img.crop(box)
screen_pixels = list(screen_crop.getdata())
total_screen_pixels = len(screen_pixels)

pure_white_count = 0
luminances = []

for r, g, b in screen_pixels:
    if r >= 254 and g >= 254 and b >= 254:
        pure_white_count += 1
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    luminances.append(lum)

pure_white_pct = (pure_white_count / total_screen_pixels) * 100.0
mean_screen_lum = sum(luminances) / total_screen_pixels
variance = sum((x - mean_screen_lum) ** 2 for x in luminances) / total_screen_pixels
std_screen_lum = math.sqrt(variance)

print(f"Screen Region ({screen_crop.width}x{screen_crop.height}):")
print(f"  Total pixels: {total_screen_pixels}")
print(f"  Clipped pure-white pixels (>= 254): {pure_white_count} ({pure_white_pct:.3f}%)")
print(f"  Mean luminance: {mean_screen_lum:.2f} (scale 0-255)")
print(f"  Std dev luminance: {std_screen_lum:.2f} (shows rich dynamic range/contrast)")

# Check seat/auditorium region (lower portion of the image: y: 70% to 100%, x: 10% to 90%)
aud_box = (int(w * 0.10), int(h * 0.70), int(w * 0.90), h)
aud_crop = img.crop(aud_box)
aud_pixels = list(aud_crop.getdata())
aud_lum = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in aud_pixels]
mean_aud_lum = sum(aud_lum) / len(aud_pixels)
crushed_black_count = sum(1 for r, g, b in aud_pixels if r <= 2 and g <= 2 and b <= 2)
crushed_black_pct = (crushed_black_count / len(aud_pixels)) * 100.0

print(f"Auditorium/Floor Region:")
print(f"  Mean luminance: {mean_aud_lum:.2f}")
print(f"  Crushed black pixels (<= 2): {crushed_black_pct:.3f}%")

# Verifications
assert pure_white_pct < 2.0, f"Screen pure white clipping exceeded 2.0%: {pure_white_pct:.2f}%"
assert std_screen_lum > 15.0, f"Screen detail is too flat (std dev {std_screen_lum:.2f} <= 15.0)"
assert mean_screen_lum < 240.0, f"Screen is blown out: mean luminance {mean_screen_lum:.2f} >= 240"
print("\n>>> ALL IMAGE METRICS PASS PHASE 2B CRITERIA! <<<")
