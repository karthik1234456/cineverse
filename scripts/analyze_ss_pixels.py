from PIL import Image

def analyze_pixels(name, p1, p2):
    im1 = Image.open(p1).convert('RGB')
    im2 = Image.open(p2).convert('RGB')
    w, h = im1.size
    px1 = im1.load()
    px2 = im2.load()
    
    total_pixels = w * h
    changed_pixels = 0
    large_changes = 0 # diff > 20
    
    # check colors at center
    print(f"--- {name} ---")
    print(f"Center pixel (w//2, h//2): ss1={px1[w//2, h//2]}, ss2={px2[w//2, h//2]}")
    print(f"Top-left of modal (300, 200): ss1={px1[300, 200]}, ss2={px2[300, 200]}")
    
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r1, g1, b1 = px1[x, y]
            r2, g2, b2 = px2[x, y]
            d = (abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)) / 3.0
            if d > 1.0:
                changed_pixels += 1
            if d > 20.0:
                large_changes += 1
                
    sampled_total = (w // 2) * (h // 2)
    print(f"Fraction changed (>1 px): {changed_pixels / sampled_total * 100:.2f}%")
    print(f"Fraction with large change (>20 px): {large_changes / sampled_total * 100:.2f}%")

analyze_pixels("Wildwood", "evidence/raw_measurements/screenshots/wildwood-791523_ss1.png", "evidence/raw_measurements/screenshots/wildwood-791523_ss2.png")
analyze_pixels("Kochi", "evidence/raw_measurements/screenshots/kochi-harbor-noir_ss1.png", "evidence/raw_measurements/screenshots/kochi-harbor-noir_ss2.png")
analyze_pixels("Clayface", "evidence/raw_measurements/screenshots/clayface-1400940_ss1.png", "evidence/raw_measurements/screenshots/clayface-1400940_ss2.png")
