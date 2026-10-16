"""Grade the train clips and turn the opening's black doorway into a doorway of light.

Needs numpy + opencv-python-headless and an ffmpeg binary. Sources are the 1080p masters:

  python scripts/train-video-fx.py ffmpeg assets/video/train_doors_closed_loop_6s.mp4 assets/video/train_waiting_mobile.mp4 --mode loop
  python scripts/train-video-fx.py ffmpeg assets/video/train_doors_open_NO_CITY.mp4 assets/video/train_opening_mobile.mp4 --mode opening --audio <clip with the softened door audio>

--preview 3,4,5 writes a PNG contact sheet of those timestamps instead of a video.
The light timing pairs with OPENING_DISSOLVE_TIME in src/lib/loading-sequence.ts.
"""
import argparse, subprocess, sys
import numpy as np, cv2

W, H, FPS = 1920, 1080, 24
ap = argparse.ArgumentParser()
ap.add_argument('ffmpeg'); ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--mode', choices=['loop', 'opening'], required=True)
ap.add_argument('--audio'); ap.add_argument('--preview')
a = ap.parse_args()

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r2 = ((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2
VIGNETTE = (1 - 0.16 * np.clip(r2, 0, 2) ** 1.2)[..., None]

def grade(rgb):
    x = rgb.astype(np.float32) / 255
    blur = cv2.GaussianBlur(x, (0, 0), 1.6)
    x = np.clip(x + 0.45 * (x - blur), 0, 1)                 # gentle detail
    x = x ** 0.93                                            # open the shadows a touch
    x = 0.33 + (x - 0.33) * 1.10                             # contrast
    g = x.mean(2, keepdims=True); x = g + (x - g) * 1.14     # saturation
    x = x * np.array([1.015, 1.0, 0.985], np.float32)        # very slight warmth
    return np.clip(x * VIGNETTE, 0, 1)

def smooth(e0, e1, t):
    u = np.clip((t - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u)

CORE = np.array([1.00, 0.94, 0.86], np.float32)     # warm, not paper-white
EDGE = np.array([0.42, 0.40, 0.72], np.float32)     # dusky lavender, matches the lens flare
rng = np.random.default_rng(3)

def void_mask(rgb, t):
    if t < 2.3: return None
    small = cv2.resize(rgb, (W // 2, H // 2), interpolation=cv2.INTER_AREA).astype(np.int16)
    y = small.mean(2)
    m = ((np.abs(y - 7) <= 2.2) & (small.max(2) <= 20)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros(m.shape, np.float32)
    for i in range(1, n):
        x0, y0, w, h, area = stats[i]
        # Doorway/window voids are tall, solid blobs; seat shadows are thin slivers.
        if area < 1500 or h < 60 or area / (w * h) < 0.7: continue
        # Light fades toward the frame edges so windows drifting sideways dim
        # smoothly instead of popping off between frames.
        off = abs((x0 + w / 2) / m.shape[1] - 0.5)
        keep[lab == i] = 1.0 if area >= 0.15 * m.size else 1 - smooth(0.18, 0.32, off)
    if not keep.any(): return None
    soft = cv2.GaussianBlur(keep, (0, 0), 4.0)
    return cv2.resize(soft, (W, H), interpolation=cv2.INTER_LINEAR)

def light(rgb, graded, t):
    m = void_mask(rgb, t)
    if m is None: return graded
    k = smooth(2.4, 5.4, t)
    level = 0.22 + 0.63 * k                                  # dim glow -> soft light
    ys, xs = np.nonzero(m > 0.5)
    cx, cy = (xs.mean(), ys.mean()) if len(xs) else (W / 2, H / 2)
    d = np.sqrt(((xx - cx) / W) ** 2 + ((yy - cy) / H) ** 2)
    mix = np.clip(d / (0.16 + 0.50 * k), 0, 1)[..., None] ** 0.8
    col = CORE * (1 - mix) + EDGE * mix
    lit = col * level * m[..., None]
    out = graded * (1 - m[..., None]) + lit
    bloom = cv2.GaussianBlur(cv2.resize(lit, (W // 4, H // 4), interpolation=cv2.INTER_AREA), (0, 0), 18)
    bloom = cv2.resize(bloom, (W, H), interpolation=cv2.INTER_LINEAR) * (0.75 + 0.35 * k)
    out = 1 - (1 - out) * (1 - bloom)                         # screen
    out += rng.normal(0, 0.6 / 255, out.shape).astype(np.float32) * m[..., None]  # dither the gradient
    return np.clip(out, 0, 1)

dec = subprocess.Popen([a.ffmpeg, '-v', 'error', '-i', a.src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                       stdout=subprocess.PIPE)
preview = [float(v) for v in a.preview.split(',')] if a.preview else None
if preview is None:
    cmd = [a.ffmpeg, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-']
    if a.audio: cmd += ['-i', a.audio, '-map', '0:v', '-map', '1:a', '-c:a', 'copy']
    cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'film', '-x264-params', 'aq-mode=3',
            '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p', '-g', '48', '-movflags', '+faststart', a.out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
tiles, i = [], 0
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3: break
    t = i / FPS; i += 1
    if preview is not None and not any(abs(t - p) < 0.5 / FPS for p in preview): continue
    rgb = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    out = grade(rgb)
    if a.mode == 'opening': out = light(rgb, out, t)
    frame = (out * 255 + 0.5).astype(np.uint8)
    if preview is not None: tiles.append(cv2.resize(frame, (640, 360), interpolation=cv2.INTER_AREA))
    else: enc.stdin.write(frame.tobytes())
dec.wait()
if preview is not None:
    while len(tiles) % 3: tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[j:j + 3]) for j in range(0, len(tiles), 3)]
    cv2.imwrite(a.out, cv2.cvtColor(np.vstack(rows), cv2.COLOR_RGB2BGR))
else:
    enc.stdin.close(); sys.exit(enc.wait())
