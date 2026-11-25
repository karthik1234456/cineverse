from PIL import Image

im1 = Image.open('evidence/raw_measurements/screenshots/wildwood-791523_ss1.png')
im2 = Image.open('evidence/raw_measurements/screenshots/wildwood-791523_ss2.png')

# Let's crop a 400x300 patch around center
w, h = im1.size
im1.crop((w//2 - 200, h//2 - 150, w//2 + 200, h//2 + 150)).save('wildwood_center_ss1.png')
im2.crop((w//2 - 200, h//2 - 150, w//2 + 200, h//2 + 150)).save('wildwood_center_ss2.png')

# Let's check diff bbox: (98, 104, 1192, 689)
# What is at (98, 104) to (1192, 689)? That's the Theatre Mode player boundary!
# Where did pixels change?
diff_points = []
px1 = im1.load()
px2 = im2.load()
for y in range(0, h, 10):
    for x in range(0, w, 10):
        d = sum(abs(a - b) for a, b in zip(px1[x, y][:3], px2[x, y][:3])) / 3.0
        if d > 10.0:
            diff_points.append((x, y, d, px1[x, y], px2[x, y]))

print(f"Diff points (>10px) count: {len(diff_points)}")
for pt in diff_points[:15]:
    print(f"  at ({pt[0]}, {pt[1]}): diff={pt[2]:.1f}, ss1={pt[3]}, ss2={pt[4]}")
