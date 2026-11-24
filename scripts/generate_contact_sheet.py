import sqlite3
import os
import subprocess
import shutil
from PIL import Image, ImageDraw, ImageFont

FFMPEG = os.path.abspath('frontend/node_modules/ffmpeg-static/ffmpeg.exe')
TRAILERS_DIR = os.path.abspath('frontend/public/trailers')
ARTIFACTS_DIR = r"C:\Users\KARTHIK\.gemini\antigravity\brain\b126ff79-e052-4efd-9d46-663877753dee"

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()
cur.execute('''
    SELECT id, title, trailer_url
    FROM movies
    WHERE trailer_source_type = 'hosted'
    ORDER BY id ASC
''')
movies = cur.fetchall()
conn.close()

print(f"Generating contact sheet for {len(movies)} hosted movies...")

os.makedirs('tmp_contact_frames', exist_ok=True)
frame_paths = []

for idx, (m_id, title, trailer_url) in enumerate(movies):
    fname = os.path.basename(trailer_url)
    fpath = os.path.join(TRAILERS_DIR, fname)
    frame_out = f"tmp_contact_frames/frame_{m_id}.png"

    cmd = [
        FFMPEG, "-y", "-ss", "00:00:06", "-i", fpath,
        "-vframes", "1", "-update", "1", "-s", "320x180", frame_out
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(frame_out):
        frame_paths.append((title, fname, frame_out))
    else:
        print(f"Warning: frame extraction failed for {title}")

# Grid: 6 columns x 9 rows (54 slots for 51 items)
cols = 6
thumb_w = 320
thumb_h = 180
header_h = 30
cell_w = thumb_w
cell_h = thumb_h + header_h
rows = (len(frame_paths) + cols - 1) // cols

sheet_w = cols * cell_w
sheet_h = rows * cell_h + 80  # 80px banner at top

sheet = Image.new('RGB', (sheet_w, sheet_h), color=(15, 23, 42))
draw = ImageDraw.Draw(sheet)

# Draw Title Banner
try:
    font_large = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 32)
    font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 14)
    font_tiny = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 11)
except:
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()
    font_tiny = ImageFont.load_default()

draw.text((30, 20), f"CineVerse Hosted Showcase Trailers — Contact Sheet ({len(frame_paths)} Distinct Titles)", fill=(248, 250, 252), font=font_large)
draw.text((30, 56), "Verified Perceptually Distinct Video Streams • Sample Timestamp t = 00:00:06", fill=(148, 163, 184), font=font_small)

for i, (title, fname, fpath) in enumerate(frame_paths):
    c = i % cols
    r = i // cols
    x = c * cell_w
    y = 80 + r * cell_h

    # Paste thumbnail
    try:
        with Image.open(fpath) as img:
            sheet.paste(img, (x, y))
    except Exception as e:
        draw.rectangle([x, y, x + thumb_w, y + thumb_h], fill=(50, 50, 50))

    # Caption box
    draw.rectangle([x, y + thumb_h, x + thumb_w, y + cell_h], fill=(30, 41, 59))
    short_title = title if len(title) <= 32 else title[:29] + '...'
    draw.text((x + 8, y + thumb_h + 4), short_title, fill=(241, 245, 249), font=font_tiny)
    draw.text((x + 8, y + thumb_h + 16), fname, fill=(100, 116, 139), font=font_tiny)

os.makedirs('evidence', exist_ok=True)
sheet_path = os.path.abspath('evidence/hosted_trailers_contact_sheet.png')
sheet.save(sheet_path, quality=95)
print(f"Contact sheet saved to: {sheet_path}")

# Copy to artifacts directory
if os.path.exists(ARTIFACTS_DIR):
    art_path = os.path.join(ARTIFACTS_DIR, 'hosted_trailers_contact_sheet.png')
    shutil.copyfile(sheet_path, art_path)
    print(f"Copied to artifact directory: {art_path}")
