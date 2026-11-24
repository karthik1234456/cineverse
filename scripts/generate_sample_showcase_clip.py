import subprocess
import os

FFMPEG = os.path.abspath('frontend/node_modules/ffmpeg-static/ffmpeg.exe')
OUT_FILE = os.path.abspath('frontend/public/trailers/sample-showcase.mp4')
FONT_FILE = "C\\\\:/Windows/Fonts/arialbd.ttf"
FONT_REG = "C\\\\:/Windows/Fonts/arial.ttf"

# Generate 20s unique high-quality trailer clip
cmd = [
    FFMPEG, "-y",
    "-f", "lavfi", "-i", "testsrc2=duration=20:size=1280x720:rate=24",
    "-f", "lavfi", "-i", "aevalsrc=sin(523.25*2*PI*t)*0.15*exp(-mod(t\\,2))+sin(659.25*2*PI*t)*0.1*exp(-mod(t\\,2)):s=44100:d=20",
    "-vf", (
        f"drawbox=y=0:color=black@0.4:width=iw:height=90:t=fill,"
        f"drawtext=fontfile='{FONT_FILE}':text='SAMPLE TRAILER':fontcolor=yellow:fontsize=36:x=(w-text_w)/2:y=25,"
        f"drawbox=y=(h-120)/2:color=black@0.6:width=iw:height=120:t=fill,"
        f"drawtext=fontfile='{FONT_FILE}':text='SAMPLE SHOWCASE':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=(h-text_h)/2 - 15,"
        f"drawtext=fontfile='{FONT_REG}':text='CineVerse Open Media • Audio-Visual Calibration Reel':fontcolor=cyan:fontsize=22:x=(w-text_w)/2:y=(h/2)+25,"
        f"drawbox=y=h-70:color=black@0.5:width=iw:height=70:t=fill,"
        f"drawtext=fontfile='{FONT_REG}':text='Timecode %{{pts\\:hms}} • 1280x720 24fps • CC-BY-4.0':fontcolor=white:fontsize=20:x=(w-text_w)/2:y=h-48"
    ),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-b:v", "500k",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    OUT_FILE
]

print("Generating unique Sample Showcase clip...")
res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode != 0:
    print("FFmpeg error:", res.stderr)
else:
    print("Successfully generated unique clip:", OUT_FILE)
    print("Size:", os.path.getsize(OUT_FILE), "bytes")
