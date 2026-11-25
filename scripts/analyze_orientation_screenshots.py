import os
import json
from PIL import Image

EVIDENCE_DIR = r"C:\Users\KARTHIK\.gemini\antigravity\brain\b126ff79-e052-4efd-9d46-663877753dee\evidence\orientation"

def analyze_testcard(img_path):
    im = Image.open(img_path).convert('RGB')
    w, h = im.size
    
    # We want to find:
    # Cyan pixels (high G & B, low R): R < 80, G > 140, B > 160
    # Yellow pixels (high R & G, low B): R > 180, G > 140, B < 80
    cyan_xs = []
    cyan_ys = []
    yellow_xs = []
    yellow_ys = []
    
    for y in range(int(h * 0.15), int(h * 0.85)):
        for x in range(int(w * 0.1), int(w * 0.9)):
            r, g, b = im.getpixel((x, y))
            if r < 80 and g > 140 and b > 160:
                cyan_xs.append(x)
                cyan_ys.append(y)
            elif r > 180 and g > 140 and b < 80:
                yellow_xs.append(x)
                yellow_ys.append(y)
                
    if not cyan_xs or not yellow_xs:
        return {
            "error": "Markers not found",
            "cyan_count": len(cyan_xs),
            "yellow_count": len(yellow_xs)
        }
        
    avg_cyan_x = sum(cyan_xs) / len(cyan_xs)
    avg_yellow_x = sum(yellow_xs) / len(yellow_xs)
    
    return {
        "cyan_count": len(cyan_xs),
        "yellow_count": len(yellow_xs),
        "cyan_x_range": [min(cyan_xs), max(cyan_xs)],
        "yellow_x_range": [min(yellow_xs), max(yellow_xs)],
        "avg_cyan_x": round(avg_cyan_x, 2),
        "avg_yellow_x": round(avg_yellow_x, 2),
        "delta_x (yellow - cyan)": round(avg_yellow_x - avg_cyan_x, 2),
        "is_unmirrored": avg_cyan_x < avg_yellow_x,
        "orientation": "NORMAL (Audience Left is Left, Audience Right is Right)" if avg_cyan_x < avg_yellow_x else "MIRRORED"
    }

views = ["lookaround", "walk", "sit"]
analysis = {}

for v in views:
    path = os.path.join(EVIDENCE_DIR, f"testcard_{v}.png")
    if os.path.exists(path):
        res = analyze_testcard(path)
        analysis[v] = res
        print(f"[{v.upper()}] Test Card Result:")
        print(json.dumps(res, indent=2))
        
out_json = os.path.join(EVIDENCE_DIR, "pixel_analysis_testcard.json")
with open(out_json, "w") as f:
    json.dump(analysis, f, indent=2)
print("Saved to", out_json)
