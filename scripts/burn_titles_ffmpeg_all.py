import os
import sqlite3
import subprocess
import shutil
import cv2

ROOT = os.path.abspath('.')
FFMPEG = os.path.abspath('frontend/node_modules/ffmpeg-static/ffmpeg.exe')
FONT = "C\\:/Windows/Fonts/arialbd.ttf"
TRAILERS_DIR = os.path.join(ROOT, 'frontend', 'public', 'trailers')
OCR_FRAMES_DIR = os.path.join(ROOT, 'evidence', 'ocr_frames')
os.makedirs(OCR_FRAMES_DIR, exist_ok=True)

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()
cur.execute("SELECT id, title, slug, trailer_url FROM movies WHERE trailer_source_type = 'hosted' ORDER BY id ASC")
movies = cur.fetchall()
conn.close()

print(f"Applying FFmpeg title card overlay to {len(movies)} hosted movies...")

for idx, (mid, title, slug, vurl) in enumerate(movies, start=1):
    in_file = os.path.join(TRAILERS_DIR, f"{slug}.mp4")
    if not os.path.exists(in_file):
        print(f"[{idx}/{len(movies)}] MISSING: {in_file}")
        continue

    # Escape title for FFmpeg drawtext: replace : with \:, ' with \', and spaces with \ 
    # Take the main title (before subtitle if too long) or full title
    clean_title = title.upper().replace(":", "\\:").replace("'", "\\'").replace(",", "\\,").replace(" ", "\\ ")
    title_len = len(title)
    font_size = 46 if title_len < 28 else (36 if title_len < 40 else 28)

    out_file = os.path.join(TRAILERS_DIR, f"{slug}_titled.mp4")

    vf = (
        f"drawtext=fontfile='{FONT}':text='SAMPLE\\ TRAILER':fontcolor=yellow:fontsize=24:box=1:boxcolor=black@0.9:boxborderw=8:x=(w-text_w)/2:y=(h/2)-60:enable='between(t,0,6)',"
        f"drawtext=fontfile='{FONT}':text='{clean_title}':fontcolor=white:fontsize={font_size}:box=1:boxcolor=black@0.9:boxborderw=12:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,6)'"
    )

    cmd = [
        FFMPEG, "-y",
        "-i", in_file,
        "-vf", vf,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-b:v", "1500k",
        "-c:a", "copy",
        "-movflags", "+faststart",
        out_file
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[{idx}/{len(movies)}] Error for {title}: {res.stderr[-300:]}")
        continue

    # Replace original file
    shutil.move(out_file, in_file)

    # Extract 3 frames at 1s, 2.5s, 4s
    cap = cv2.VideoCapture(in_file)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    for f_idx, sec in enumerate([1.0, 2.5, 4.0], start=1):
        cap.set(cv2.CAP_PROP_POS_MSEC, int(sec * 1000))
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(os.path.join(OCR_FRAMES_DIR, f"{slug}_f{f_idx}.png"), frame)
    cap.release()

    print(f"[{idx}/{len(movies)}] Titled: {title}")

print("Completed processing all 51 hosted titles.")
