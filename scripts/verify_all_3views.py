from PIL import Image

def analyze_view(filename, label):
    im = Image.open(f"scripts/{filename}").convert("RGB")
    w, h = im.size
    
    cyan_xs = []
    yellow_xs = []

    for y in range(int(h * 0.10), int(h * 0.85)):
        for x in range(int(w * 0.1), 1050):
            r, g, b = im.getpixel((x, y))
            # Cyan block #06b6d4: B > 130, G > 100, R < 80, B - R > 50
            if b > 130 and g > 100 and r < 80 and (b - r) > 50:
                cyan_xs.append((x, y))
            # Yellow block #eab308: R > 150, G > 110, B < 70, R - B > 80
            if r > 150 and g > 110 and b < 70 and (r - b) > 80:
                yellow_xs.append((x, y))

    print(f"\n--- {label} ({filename}) ---")
    print(f"Cyan hits: {len(cyan_xs)}")
    if cyan_xs:
        c_x = [p[0] for p in cyan_xs]
        avg_c = sum(c_x) / len(c_x)
        print(f"Cyan X: min={min(c_x)}, max={max(c_x)}, avg={avg_c:.2f}")

    print(f"Yellow hits: {len(yellow_xs)}")
    if yellow_xs:
        y_x = [p[0] for p in yellow_xs]
        avg_y = sum(y_x) / len(y_x)
        print(f"Yellow X: min={min(y_x)}, max={max(y_x)}, avg={avg_y:.2f}")

    if cyan_xs and yellow_xs:
        avg_c = sum([p[0] for p in cyan_xs]) / len(cyan_xs)
        avg_y = sum([p[0] for p in yellow_xs]) / len(yellow_xs)
        delta = avg_y - avg_c
        print(f"Delta X (Yellow - Cyan): {delta:.2f} pixels")
        is_unmirrored = avg_c < avg_y
        print(f"STATUS: {'PASS (NORMAL/UNMIRRORED)' if is_unmirrored else 'FAIL (MIRRORED)'}")
        return {
            "view": label,
            "cyan_x": round(avg_c, 2),
            "yellow_x": round(avg_y, 2),
            "delta_x": round(delta, 2),
            "is_unmirrored": is_unmirrored,
            "status": "PASS" if is_unmirrored else "FAIL"
        }
    return {"view": label, "error": "insufficient pixels"}

results = [
    analyze_view("full_lookaround_testcard.png", "Look around (Overview)"),
    analyze_view("full_walk_testcard.png", "Walk (Row E)"),
    analyze_view("full_sit_testcard.png", "Sit (Sweet Spot F10)")
]

print("\nSUMMARY TABLE:")
for r in results:
    print(r)
