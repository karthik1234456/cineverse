import os
import json
from PIL import Image, ImageChops, ImageStat

RAW_DIR = os.path.abspath('evidence/raw_measurements')
SS_DIR = os.path.join(RAW_DIR, 'screenshots')

if not os.path.exists(RAW_DIR):
    print("No raw measurements directory found.")
    exit(0)

json_files = [f for f in os.listdir(RAW_DIR) if f.endswith('.json') and not f.startswith('seeded_15_')]
print(f"Calculating empirical screenshot pixel differences for {len(json_files)} titles...")

for jf in json_files:
    jpath = os.path.join(RAW_DIR, jf)
    with open(jpath, 'r') as f:
        data = json.load(f)

    slug = data.get('slug')
    ss1 = os.path.join(SS_DIR, f"{slug}_ss1.png")
    ss2 = os.path.join(SS_DIR, f"{slug}_ss2.png")

    if os.path.exists(ss1) and os.path.exists(ss2):
        with Image.open(ss1) as im1, Image.open(ss2) as im2:
            # Crop to player / center screen region (e.g. 200, 100 to 1080, 620)
            crop_box = (150, 100, 1130, 620)
            c1 = im1.crop(crop_box)
            c2 = im2.crop(crop_box)

            diff = ImageChops.difference(c1, c2)
            stat = ImageStat.Stat(diff)
            # Average mean difference across R, G, B channels
            mean_diff = sum(stat.mean) / len(stat.mean)
            data['frame_diff_pixel_sum'] = round(mean_diff, 2)
            data['screenshot_1']['file_path'] = ss1
            data['screenshot_2']['file_path'] = ss2

            with open(jpath, 'w') as f_out:
                json.dump(data, f_out, indent=2)

            print(f"  [{slug}] Δ px/ch: {mean_diff:.2f}")

# Also update seeded_15_summary.json
summary_path = os.path.join(RAW_DIR, 'seeded_15_summary.json')
if os.path.exists(summary_path):
    summary_data = []
    for jf in sorted(json_files):
        with open(os.path.join(RAW_DIR, jf), 'r') as f:
            summary_data.append(json.load(f))
    with open(summary_path, 'w') as f:
        json.dump(summary_data, f, indent=2)
    print("Updated seeded_15_summary.json with measured pixel differences.")
