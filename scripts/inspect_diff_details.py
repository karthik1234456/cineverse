from PIL import Image, ImageChops, ImageStat

def inspect_pair(name, p1, p2):
    im1 = Image.open(p1).convert('RGB')
    im2 = Image.open(p2).convert('RGB')
    diff = ImageChops.difference(im1, im2)
    stat = ImageStat.Stat(diff)
    bbox = diff.getbbox()
    print(f"=== {name} ===")
    print(f"Image 1 size: {im1.size}, mode: {im1.mode}")
    print(f"Diff bbox: {bbox}")
    print(f"Mean diff (RGB): {stat.mean}, Average across channels: {sum(stat.mean)/3.0:.3f}")
    print(f"Extrema per channel: {stat.extrema}")
    # Sample a thumbnail of difference or check colors
    # Where are the differences concentrated?
    # Center crop (the theatre modal or screen)
    center = (200, 100, 1080, 620)
    c_diff = ImageChops.difference(im1.crop(center), im2.crop(center))
    c_stat = ImageStat.Stat(c_diff)
    print(f"Center crop ({center}) mean: {sum(c_stat.mean)/3.0:.3f}")

inspect_pair("Wildwood", "evidence/raw_measurements/screenshots/wildwood-791523_ss1.png", "evidence/raw_measurements/screenshots/wildwood-791523_ss2.png")
inspect_pair("Kochi", "evidence/raw_measurements/screenshots/kochi-harbor-noir_ss1.png", "evidence/raw_measurements/screenshots/kochi-harbor-noir_ss2.png")
inspect_pair("Udta Teer (No Trailer)", "evidence/raw_measurements/screenshots/udta-teer-1375156_ss1.png", "evidence/raw_measurements/screenshots/udta-teer-1375156_ss2.png")
