import subprocess
import os
import shutil
import cv2

FFMPEG = os.path.abspath('frontend/node_modules/ffmpeg-static/ffmpeg.exe')
FONT = "C\\:/Windows/Fonts/arialbd.ttf"
in_file = os.path.abspath('frontend/public/trailers/babus-big-idea.mp4')
out_file = os.path.abspath('frontend/public/trailers/babus-big-idea_titled.mp4')

vf = (
    f"drawtext=fontfile='{FONT}':text='SAMPLE\\ TRAILER':fontcolor=yellow:fontsize=24:box=1:boxcolor=black@0.9:boxborderw=8:x=(w-text_w)/2:y=(h/2)-60:enable='between(t,0,6)',"
    f"drawtext=fontfile='{FONT}':text='BABU\\ BIG\\ IDEA\\:\\ NIZAM\\ COMEDY':fontcolor=white:fontsize=36:box=1:boxcolor=black@0.9:boxborderw=12:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,6)'"
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
    print("Error:", res.stderr[-300:])
else:
    shutil.move(out_file, in_file)
    cap = cv2.VideoCapture(in_file)
    for i, s in enumerate([1.0, 2.5, 4.0], start=1):
        cap.set(cv2.CAP_PROP_POS_MSEC, int(s * 1000))
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(f'evidence/ocr_frames/babus-big-idea_f{i}.png', frame)
    cap.release()
    print("Successfully titled Babu's Big Idea!")
