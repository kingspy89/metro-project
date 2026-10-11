"""Build the lightweight looping hero video from the bundled hero artwork."""

from pathlib import Path
import math

import cv2
import imageio_ffmpeg
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "images" / "ahmedabad-metro-hero.jpg"
OUTPUT = ROOT / "public" / "videos" / "ahmedabad-metro-hero.mp4"
WIDTH, HEIGHT = 1280, 720
FPS, SECONDS = 24, 10


def main():
    image = cv2.imread(str(SOURCE), cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(SOURCE)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    writer = imageio_ffmpeg.write_frames(
        str(OUTPUT),
        (WIDTH, HEIGHT),
        fps=FPS,
        codec="libx264",
        quality=4,
        output_params=["-preset", "veryfast", "-movflags", "+faststart"],
    )
    writer.send(None)

    for frame_no in range(FPS * SECONDS):
        phase = 2 * math.pi * frame_no / (FPS * SECONDS)
        zoom = 1.04 + 0.035 * (1 - math.cos(phase)) / 2
        pan_x = 0.018 * math.sin(phase)
        pan_y = 0.008 * math.sin(phase * 2)
        scaled_w, scaled_h = int(WIDTH * zoom), int(HEIGHT * zoom)
        scaled = cv2.resize(image, (scaled_w, scaled_h), interpolation=cv2.INTER_CUBIC)
        max_x, max_y = scaled_w - WIDTH, scaled_h - HEIGHT
        left = int((max_x / 2) + pan_x * max_x)
        top = int((max_y / 2) + pan_y * max_y)
        frame = scaled[top : top + HEIGHT, left : left + WIDTH]
        writer.send(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB).tobytes())

    writer.close()
    print(f"Created {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
