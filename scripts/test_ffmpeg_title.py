import subprocess
import os

FFMPEG = os.path.abspath('frontend/node_modules/ffmpeg-static/ffmpeg.exe')
FONT = "C\\:/Windows/Fonts/arialbd.ttf"
in_file = os.path.abspath('frontend/public/trailers/quantum-odyssey.mp4')
out_file = os.path.abspath('test_qo_out.mp4')

vf = (
    f"drawtext=fontfile='{FONT}':text='SAMPLE\\ TRAILER':fontcolor=yellow:fontsize=28:box=1:boxcolor=black@0.9:boxborderw=8:x=(w-text_w)/2:y=(h/2)-65:enable='between(t,0,6)',"
    f"drawtext=fontfile='{FONT}':text='QUANTUM\\ ODYSSEY':fontcolor=white:fontsize=50:box=1:boxcolor=black@0.9:boxborderw=12:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,6)'"
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

print("Running FFmpeg title overlay test...")
res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode != 0:
    print("FFmpeg error:", res.stderr[-500:])
else:
    print("Success! Output file size:", os.path.getsize(out_file))
