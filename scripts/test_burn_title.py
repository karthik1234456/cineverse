import os
import cv2
import numpy as np

def burn_title_into_video(src_path, dst_path, title):
    cap = cv2.VideoCapture(src_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') # or avc1

    out = cv2.VideoWriter(dst_path, fourcc, fps, (width, height))

    title_duration_frames = int(fps * 6.0) # Show title for first 6 seconds
    
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx < title_duration_frames:
            # Add subtle title card overlay
            overlay = frame.copy()
            # Bottom/Center banner: y from height//2 - 80 to height//2 + 80
            cy = height // 2
            cv2.rectangle(overlay, (width // 8, cy - 70), (width * 7 // 8, cy + 70), (10, 10, 10), -1)
            # Alpha blend banner (70% opacity)
            cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

            # Draw Movie Title
            font = cv2.FONT_HERSHEY_DUPLEX
            # Calculate font scale
            title_text = title.upper()
            scale = 1.2 if len(title_text) < 30 else 0.9
            thickness = 2
            
            # Subtitle header
            cv2.putText(frame, "CINEVERSE SHOWCASE", (width // 4, cy - 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 180, 50), 2, cv2.LINE_AA)
            
            # Title with shadow
            text_size = cv2.getTextSize(title_text, font, scale, thickness)[0]
            tx = max(50, (width - text_size[0]) // 2)
            # Shadow
            cv2.putText(frame, title_text, (tx + 2, cy + 18), font, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
            # Main white text
            cv2.putText(frame, title_text, (tx, cy + 16), font, scale, (255, 255, 255), thickness, cv2.LINE_AA)
            
            # Bottom watermark
            cv2.putText(frame, "SAMPLE TRAILER - RIGHTS CLEARED FOR EXHIBITION", (width // 4, cy + 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1, cv2.LINE_AA)

        out.write(frame)
        frame_idx += 1

    cap.release()
    out.release()
    print(f"Burned title '{title}' into {dst_path} ({frame_idx} frames)")

if __name__ == '__main__':
    src = 'frontend/public/trailers/astra-celestial-throne.mp4'
    tmp = 'frontend/public/trailers/astra-celestial-throne_titled.mp4'
    burn_title_into_video(src, tmp, 'Astra: Chronicles of the Celestial Throne')
