import os
import json
from PIL import Image, ImageChops

EVIDENCE_DIR = "evidence/hall-coverage-v2"
HALLS = [
    "compact",
    "standard",
    "large_curved",
    "premium_direct_view",
    "boutique",
    "panoramic_wrap",
    "4dx",
    "motion_seat"
]

results = {}

for hall in HALLS:
    print(f"\n--- Analyzing Hall: {hall} ---")
    t1_path = os.path.join(EVIDENCE_DIR, f"{hall}_trailer_t1.png")
    t2_path = os.path.join(EVIDENCE_DIR, f"{hall}_trailer_t2.png")
    
    # 1. Pixel Diff Analysis
    diff_stat = None
    if os.path.exists(t1_path) and os.path.exists(t2_path):
        im1 = Image.open(t1_path).convert("RGB")
        im2 = Image.open(t2_path).convert("RGB")
        diff = ImageChops.difference(im1, im2)
        diff_path = os.path.join(EVIDENCE_DIR, f"{hall}_pixel_diff.png")
        diff.save(diff_path)
        
        hist = diff.histogram()
        total_pixels = im1.width * im1.height
        sum_diff = 0
        for i, count in enumerate(hist):
            channel_val = i % 256
            sum_diff += channel_val * count
        mean_diff = sum_diff / (total_pixels * 3)
        bbox = diff.getbbox()
        max_diff = max([v for v in diff.getextrema()[0]])
        print(f"Motion Pixel Diff: Mean={mean_diff:.2f}, Max={max_diff}, BBox={bbox}")
        diff_stat = {
            "mean_pixel_diff": round(mean_diff, 2),
            "max_pixel_diff": max_diff,
            "has_motion": mean_diff > 0.3,
            "diff_image": diff_path
        }
    
    # 2. Orientation Analysis (Center, Left, Right views)
    orientation_checks = {}
    for view in ["center", "left", "right"]:
        tc_path = os.path.join(EVIDENCE_DIR, f"{hall}_testcard_{view}.png")
        if os.path.exists(tc_path):
            tc_im = Image.open(tc_path).convert("RGB")
            w, h = tc_im.size
            
            cyan_xs = []
            yellow_xs = []
            
            for y in range(int(h * 0.1), int(h * 0.7)):
                for x in range(w):
                    r, g, b = tc_im.getpixel((x, y))
                    if b > 90 and g > 80 and r < 80:
                        cyan_xs.append(x)
                    if r > 110 and g > 90 and b < 70:
                        yellow_xs.append(x)
            
            avg_c = sum(cyan_xs) / len(cyan_xs) if cyan_xs else None
            avg_y = sum(yellow_xs) / len(yellow_xs) if yellow_xs else None
            
            unmirrored = False
            if avg_c is not None and avg_y is not None:
                unmirrored = avg_c < avg_y
            
            orientation_checks[view] = {
                "cyan_count": len(cyan_xs),
                "cyan_avg_x": round(avg_c, 1) if avg_c else None,
                "yellow_count": len(yellow_xs),
                "yellow_avg_x": round(avg_y, 1) if avg_y else None,
                "unmirrored": unmirrored
            }
            print(f"Orientation [{view}]: Cyan avg X = {avg_c}, Yellow avg X = {avg_y} -> Unmirrored: {unmirrored}")
    
    results[hall] = {
        "motion": diff_stat,
        "orientation": orientation_checks
    }

out_path = os.path.join(EVIDENCE_DIR, "eight_halls_analysis.json")
with open(out_path, "w") as f:
    json.dump(results, f, indent=2)

print(f"\nSaved 8-hall analysis results to: {out_path}")
