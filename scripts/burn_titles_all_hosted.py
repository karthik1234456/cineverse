import os
import sqlite3
import cv2
import shutil

ROOT = os.path.abspath('.')
DB_PATH = os.path.join(ROOT, 'cineverse.db')
TRAILERS_DIR = os.path.join(ROOT, 'frontend', 'public', 'trailers')
OCR_FRAMES_DIR = os.path.join(ROOT, 'evidence', 'ocr_frames')
os.makedirs(OCR_FRAMES_DIR, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("SELECT id, title, slug, trailer_url FROM movies WHERE trailer_source_type = 'hosted' ORDER BY id ASC")
movies = cursor.fetchall()
conn.close()

print(f"Processing and burning title cards into all {len(movies)} hosted movies...")

for idx, (mid, title, slug, trailer_url) in enumerate(movies, start=1):
    src_path = os.path.join(TRAILERS_DIR, f"{slug}.mp4")
    if not os.path.exists(src_path):
        print(f"[{idx}/{len(movies)}] MISSING: {src_path}")
        continue

    tmp_path = os.path.join(TRAILERS_DIR, f"{slug}_temp_titled.mp4")
    
    cap = cv2.VideoCapture(src_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')

    out = cv2.VideoWriter(tmp_path, fourcc, fps, (width, height))
    title_duration_frames = int(fps * 6.0)

    f_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if f_idx < title_duration_frames:
            overlay = frame.copy()
            cy = height // 2
            cv2.rectangle(overlay, (width // 10, cy - 80), (width * 9 // 10, cy + 80), (12, 12, 12), -1)
            cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

            font = cv2.FONT_HERSHEY_DUPLEX
            title_text = title.upper()
            scale = 1.1 if len(title_text) < 32 else (0.85 if len(title_text) < 45 else 0.7)
            thickness = 2

            # Header
            cv2.putText(frame, "CINEVERSE SHOWCASE", (width // 4, cy - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (220, 190, 50), 2, cv2.LINE_AA)

            # Title with shadow
            text_size = cv2.getTextSize(title_text, font, scale, thickness)[0]
            tx = max(40, (width - text_size[0]) // 2)
            cv2.putText(frame, title_text, (tx + 2, cy + 16), font, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
            cv2.putText(frame, title_text, (tx, cy + 14), font, scale, (255, 255, 255), thickness, cv2.LINE_AA)

            # Sub-label
            cv2.putText(frame, "SAMPLE TRAILER - RIGHTS CLEARED FOR EXHIBITION", (width // 4, cy + 55), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1, cv2.LINE_AA)

        out.write(frame)
        f_idx += 1

    cap.release()
    out.release()

    # Replace original file with titled file
    shutil.move(tmp_path, src_path)

    # Extract 3 frames at 1s, 3s, 5s for OCR
    cap2 = cv2.VideoCapture(src_path)
    sample_frames = [int(fps * 1.0), int(fps * 3.0), int(fps * 5.0)]
    for f_i, target_f in enumerate(sample_frames, start=1):
        cap2.set(cv2.CAP_PROP_POS_FRAMES, min(target_f, total_frames - 1))
        ret, f_img = cap2.read()
        if ret:
            cv2.imwrite(os.path.join(OCR_FRAMES_DIR, f"{slug}_f{f_i}.png"), f_img)
    cap2.release()

    print(f"[{idx}/{len(movies)}] Burned title & extracted 3 frames for: {title}")

print("Completed burning titles and extracting 3 frames for all hosted movies.")
