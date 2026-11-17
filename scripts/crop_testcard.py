from PIL import Image

im = Image.open(r"C:\Users\KARTHIK\.gemini\antigravity\brain\b126ff79-e052-4efd-9d46-663877753dee\evidence\orientation\testcard_lookaround.png")
print("Image size:", im.size)

# Let's crop just the middle region where the 3D screen is (e.g. x: 300 to 980, y: 150 to 600)
# and save it to check visually
cropped = im.crop((200, 150, 1080, 650))
cropped.save(r"C:\Users\KARTHIK\.gemini\antigravity\brain\b126ff79-e052-4efd-9d46-663877753dee\evidence\orientation\testcard_screen_crop.png")
print("Saved cropped screen")
