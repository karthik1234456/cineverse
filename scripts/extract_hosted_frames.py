import os
import sqlite3
import cv2

ROOT = os.path.abspath('.')
DB_PATH = os.path.join(ROOT, 'cineverse.db')
TRAILERS_DIR = os.path.join(ROOT, 'frontend', 'public', 'trailers')
OUT_DIR = os.path.join(ROOT, 'evidence', 'ocr_frames')
os.makedirs(OUT_DIR, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("SELECT id, title, slug, trailer_url FROM movies WHERE trailer_source_type = 'hosted' ORDER BY id ASC")
movies = cursor.fetchall()
conn.close()

print(f"Extracting 3 frames each for {len(movies)} hosted movies...")

extracted = 0
for mid, title, slug, trailer_url in movies:
    mp4_path = os.path.join(TRAILERS_DIR, f"{slug}.mp4")
    if not os.path.exists(mp4_path):
        print(f"MISSING FILE: {mp4_path}")
        continue

    cap = cv2.VideoCapture(mp4_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 100

    # sample frames at 1s, 3s, 5s (or frame 24, 72, 120)
    frame_indices = [int(fps * 1.0), int(fps * 3.0), int(fps * 5.0)]
    for idx, f_num in enumerate(frame_indices, start=1):
        target_f = min(f_num, int(total_frames - 1))
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_f)
        ret, frame = cap.read()
        if ret:
            out_name = f"{slug}_f{idx}.png"
            out_path = os.path.join(OUT_DIR, out_name)
            cv2.imwrite(out_path, frame)
    cap.release()
    extracted += 1

print(f"Extracted 3 frames each for {extracted} / {len(movies)} hosted movies into {OUT_DIR}")
