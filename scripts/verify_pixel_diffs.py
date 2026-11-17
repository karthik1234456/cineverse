import os
import json
from PIL import Image, ImageChops, ImageStat

EVIDENCE_DIR = 'evidence/real-screen-trailers'
BENCH_FILE = os.path.join(EVIDENCE_DIR, 'real_movies_bench_results.json')

with open(BENCH_FILE, 'r') as f:
    bench = json.load(f)

print('=== COMPUTING SCREEN REGION PIXEL DIFFERENCE DELTAS ===')

for item in bench:
    t0_path = item['t0Screenshot']
    t1_path = item['t1Screenshot']
    t2_path = item['t2Screenshot']

    im0 = Image.open(t0_path).convert('RGB')
    im1 = Image.open(t1_path).convert('RGB')
    im2 = Image.open(t2_path).convert('RGB')

    # Screen bounding box in 1280x800 viewport:
    # Screen is centered vertically/horizontally: box (200, 100, 1080, 550)
    screen_box = (200, 100, 1080, 550)
    crop0 = im0.crop(screen_box)
    crop1 = im1.crop(screen_box)
    crop2 = im2.crop(screen_box)

    # Pixel diff between t0 (ready with play button) and t1 (video playing)
    diff_t0_t1 = ImageChops.difference(crop0, crop1)
    stat_01 = ImageStat.Stat(diff_t0_t1)
    mean_diff_01 = sum(stat_01.mean) / 3.0

    # Pixel diff between t1 and t2 (two seconds apart while playing)
    diff_t1_t2 = ImageChops.difference(crop1, crop2)
    stat_12 = ImageStat.Stat(diff_t1_t2)
    mean_diff_12 = sum(stat_12.mean) / 3.0
    max_diff_12 = max(stat_12.extrema[0][1], stat_12.extrema[1][1], stat_12.extrema[2][1])

    item['pixelDiff_t0_t1_mean'] = round(mean_diff_01, 2)
    item['pixelDiff_t1_t2_mean'] = round(mean_diff_12, 2)
    item['pixelDiff_t1_t2_max'] = max_diff_12
    item['pixelMovementProven'] = mean_diff_12 > 1.0

    # Save visual diff image
    diff_path = os.path.join(EVIDENCE_DIR, f"{item['title'].lower().replace(' ', '_')}_diff_t1_t2.png")
    diff_t1_t2.save(diff_path)
    item['diffScreenshot'] = diff_path

    print(f"\nMovie: {item['title']} (ID {item['movieId']})")
    print(f"  t0 -> t1 Mean Diff: {mean_diff_01:.2f} (Play button disappeared & video appeared)")
    print(f"  t1 -> t2 Mean Diff: {mean_diff_12:.2f} (Movement between frames 2.5s apart)")
    print(f"  t1 -> t2 Max Diff:  {max_diff_12}")
    print(f"  Visual Diff Saved:  {diff_path}")
    print(f"  Result: {'PASS (Video Motion Verified)' if mean_diff_12 > 1.0 else 'FAIL'}")

with open(BENCH_FILE, 'w') as f:
    json.dump(bench, f, indent=2)

print('\nUpdated benchmark results with pixel diff measurements successfully!')
