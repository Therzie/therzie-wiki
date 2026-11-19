"""Generate the Therzie wiki backdrop: an original painted night scene.

Style ("Ember & Aurora"): cool teal night sky with aurora ribbons, misty soft mountains,
a pine forest framing a clearing, and warm firelight rising from below. Painterly
brush texture, falling ash and embers. Everything is procedural.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter, map_coordinates

W, H = 2400, 1350
rng = np.random.default_rng(1207)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u, v = xx / W, yy / H


def noise(scale, octaves=4, seed=0, aniso=(1.0, 1.0)):
    r = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = scale / (2 ** o)
        n = r.standard_normal((H, W)).astype(np.float32)
        n = gaussian_filter(n, (s * aniso[0], s * aniso[1]))
        n /= n.std() + 1e-6
        out += amp * n
        tot += amp
        amp *= 0.5
    return out / tot


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


def col(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------- sky ----------
img = np.zeros((H, W, 3), np.float32)
img[:] = col('#06121a')
img = mix(img, col('#0d2a33'), smooth(0.0, 0.62, v))
img = mix(img, col('#16323a'), smooth(0.35, 0.7, v) * 0.6)
# faint stars
stars = (rng.random((H, W)) > 0.9997).astype(np.float32)
stars = gaussian_filter(stars, 0.7) * 6
img += stars[..., None] * col('#cfe8ee') * (1 - smooth(0.25, 0.55, v))[..., None]

# ---------- aurora ribbons ----------
def ribbon(c0, c1, amp, freq, phase, width, tint, strength, seed):
    centre = c0 + (c1 - c0) * u + amp * np.sin(u * freq + phase) + 0.012 * noise(220, 2, seed)
    d = (v - centre) / width
    core = np.exp(-d * d)
    # curtain hangs below the ribbon and fades out downward
    below = np.clip(d, 0, None)
    curtain = np.exp(-below * 0.55) * smooth(-1.2, 0.0, d)
    streak = 0.8 + 0.2 * noise(14, 2, seed + 1, aniso=(8, 1.2))
    a = (core * 0.55 + curtain * 0.45 * streak) * smooth(-2.5, -0.5, d)
    return a[..., None] * col(tint) * strength

img += ribbon(0.30, 0.06, 0.05, 4.0, 0.6, 0.045, '#38d1a8', 0.34, 11)
img += ribbon(0.20, 0.02, 0.04, 6.0, 2.4, 0.03, '#56bfe0', 0.20, 21)
img += ribbon(0.40, 0.22, 0.03, 3.0, 4.1, 0.03, '#9be6b0', 0.10, 31)
img = gaussian_filter(img, (3, 3, 0))

# ---------- mountains (soft, misty, painterly edges) ----------
def ridge(base, rough, seed, scale):
    r = np.random.default_rng(seed)
    x = np.linspace(0, 1, W)
    h = np.zeros(W)
    for k, a in [(2, .5), (5, .25), (11, .13), (23, .07), (47, .03)]:
        h += a * np.sin(x * k * np.pi * scale + r.random() * 6.28)
    h = base - rough * h
    return h[None, :]

def layer(base, rough, seed, scale, colour, edge, alpha=1.0):
    global img
    top = ridge(base, rough, seed, scale) + 0.008 * noise(30, 3, seed)
    m = smooth(top - edge, top + edge, v) * alpha
    img = mix(img, colour, m)
    return m

layer(0.52, 0.16, 3, 1.0, col('#24434d'), 0.006, 0.9)
# mist band
img = mix(img, col('#2a4a52'), np.exp(-((v - 0.57) / 0.06) ** 2) * (0.45 + 0.2 * noise(200, 3, 5)))
layer(0.62, 0.10, 7, 1.6, col('#183139'), 0.005, 0.95)
img = mix(img, col('#22404a'), np.exp(-((v - 0.66) / 0.05) ** 2) * (0.5 + 0.25 * noise(160, 3, 9)))

# ---------- warm firelight from below ----------
glow = np.exp(-(((u - 0.5) / 0.42) ** 2 + ((v - 1.08) / 0.38) ** 2))
img = mix(img, col('#b5552a'), glow * 0.6)
img = mix(img, col('#ffa94d'), np.exp(-(((u - 0.5) / 0.2) ** 2 + ((v - 1.04) / 0.16) ** 2)) * 0.5)

# ---------- pine forest framing the clearing ----------
from PIL import ImageDraw

SS = 2  # supersampling for smooth silhouettes


def draw_pine(d, cx, base, height, width, seed):
    """One spruce: a thin trunk with many drooping, tapered branches and ragged needle tips."""
    r = np.random.default_rng(seed)
    cx, base, height, width = cx * W * SS, base * H * SS, height * H * SS, width * W * SS
    top = base - height
    d.line([(cx, top), (cx, base + 40)], fill=255, width=max(2, int(width * 0.05)))
    # dense core so only the outer branch tips read as silhouette
    core_l, core_r = [], []
    for k in range(40):
        t = k / 39
        hw = width * 0.22 * (0.05 + 0.95 * t ** 0.85) * r.uniform(0.8, 1.0)
        yk = top + t * height
        core_l.append((cx - hw, yk)); core_r.append((cx + hw, yk))
    d.polygon(core_l + core_r[::-1] + [(cx, top)], fill=255)
    # branches grow in whorls: clusters at irregular heights
    levels = []
    y = 0.0
    while y < 1.0:
        y += r.uniform(0.008, 0.022) * (0.6 + y)
        for _ in range(r.integers(3, 7)):
            levels.append(min(1.0, y + r.normal(0, 0.006)))
    for t in levels:
        t = max(0.0, t)
        y = top + t * height
        reach = width * (0.06 + 0.94 * t ** 0.8) * r.uniform(0.55, 1.1)
        if r.random() < 0.08 and t > 0.3:
            reach *= 0.4                        # a broken or missing branch
        for side in ((-1,) if r.random() < 0.5 else (1,)) if r.random() < 0.35 else (-1, 1):
            L = reach * r.uniform(0.7, 1.15)
            droop = L * r.uniform(0.12, 0.5)
            lift = L * r.uniform(-0.05, 0.12)
            # branch as a tapered curved polygon (quadratic bezier)
            pts_top, pts_bot = [], []
            th0 = max(2.5, L * 0.16)
            for k in range(9):
                q = k / 8
                bx = cx + side * L * q
                by = y - lift * 4 * q * (1 - q) + droop * q * q
                th = th0 * (1 - q) + 1.0
                pts_top.append((bx, by - th * 0.6))
                pts_bot.append((bx, by + th))
            d.polygon(pts_top + pts_bot[::-1], fill=255)
            # needle clumps hanging along the branch
            for k in range(int(r.integers(2, 5) + L / 12)):
                q = r.uniform(0.25, 1.0)
                bx = cx + side * L * q
                by = y - lift * 4 * q * (1 - q) + droop * q * q
                ln = r.uniform(3, 12) + L * r.uniform(0.02, 0.09)
                ang = np.pi / 2 + side * r.uniform(-0.6, 0.2)
                d.line([(bx, by), (bx + np.cos(ang) * ln * side * 0.4, by + np.sin(ang) * ln)], fill=255, width=2)
    # leader at the very top
    d.polygon([(cx - width * 0.03, top + height * 0.05), (cx, top - height * 0.02), (cx + width * 0.03, top + height * 0.05)], fill=255)


def forest(side, n, seed, base_lo, base_hi, hmin, hmax, colour, rim, blur):
    global img
    r = np.random.default_rng(seed)
    m = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(m)
    for i in range(n):
        off = r.uniform(-0.03, 0.27)
        x0 = off if side == 'L' else 1 - off
        draw_pine(d, x0, r.uniform(base_lo, base_hi), r.uniform(hmin, hmax), r.uniform(0.045, 0.075), seed * 100 + i)
    mask = np.asarray(m.resize((W, H), Image.LANCZOS), np.float32) / 255
    if blur:
        mask = gaussian_filter(mask, blur)
    # warm rim light on the edges facing the fire
    outer = gaussian_filter(mask, 9)
    edge = np.clip(mask - gaussian_filter(mask, 2.5), 0, 1) * np.clip((0.75 - outer) * 3, 0, 1) * 1.6
    img = mix(img, colour, mask)
    img += (edge * glow * 0.75)[..., None] * col(rim)
    return mask

forest('L', 7, 41, 0.78, 0.92, 0.25, 0.42, col('#10222a'), '#ff9a4a', 1.6)
forest('R', 7, 43, 0.78, 0.92, 0.25, 0.42, col('#10222a'), '#ff9a4a', 1.6)
img = mix(img, col('#1a3640'), np.exp(-((v - 0.82) / 0.07) ** 2) * 0.35)  # low mist
forest('L', 4, 51, 1.05, 1.15, 0.75, 1.0, col('#070f13'), '#ffb066', 0)
forest('R', 4, 53, 1.05, 1.15, 0.75, 1.0, col('#070f13'), '#ffb066', 0)

# ---------- foreground ferns / grass ----------
gr = noise(3, 2, 61, aniso=(10, 0.5))
ground = 0.9 - 0.03 * np.sin(u * 9) - 0.02 * noise(60, 2, 62)
gmask = smooth(ground - 0.01, ground + 0.03, v + 0.025 * np.clip(gr, 0, None))
img = mix(img, col('#0a0f0f'), gmask)
img += (np.clip(gmask - gaussian_filter(gmask, 4), 0, 1) * 2 * glow)[..., None] * col('#ff9548') * 0.8

# ---------- painterly brush texture ----------
strokes = noise(9, 2, 71, aniso=(0.8, 5))  # horizontal strokes
strokes2 = noise(9, 2, 72, aniso=(5, 0.8))  # vertical strokes in the forest
fwt = np.clip((np.abs(u - 0.5) - 0.25) * 4, 0, 1) * smooth(0.3, 0.6, v)
tex = strokes * (1 - fwt) + strokes2 * fwt
img *= (1 + 0.035 * tex)[..., None]

# smear: displace pixels along the stroke direction
dx = noise(25, 2, 81) * 2.5
dy = noise(25, 2, 82) * 1.5
for c in range(3):
    img[..., c] = map_coordinates(img[..., c], [yy + dy, xx + dx], order=1, mode='reflect')

# ---------- ash and embers ----------
def specks(n, seed, rmin, rmax, colour, region):
    global img
    r = np.random.default_rng(seed)
    acc = np.zeros((H, W), np.float32)
    for _ in range(n):
        x = r.uniform(0, W)
        y = region(r)
        rad = r.uniform(rmin, rmax)
        x0, x1 = int(max(0, x - rad * 4)), int(min(W, x + rad * 4))
        y0, y1 = int(max(0, y - rad * 4)), int(min(H, y + rad * 4))
        if x1 <= x0 or y1 <= y0:
            continue
        sy, sx = np.mgrid[y0:y1, x0:x1]
        acc[y0:y1, x0:x1] += np.exp(-(((sx - x) / rad) ** 2 + ((sy - y) / (rad * 0.7)) ** 2)) * r.uniform(0.4, 1)
    img += np.clip(acc, 0, 1)[..., None] * colour

specks(110, 91, 0.8, 1.8, col('#bfd8de') * 0.35, lambda r: r.uniform(0, H * 0.8))
specks(140, 92, 1.0, 2.4, col('#ffb35a') * 1.1, lambda r: H * (1 - r.random() ** 2 * 0.55))

# ---------- vignette and grade ----------
vig = np.exp(-(((u - 0.5) / 0.75) ** 2 + ((v - 0.45) / 0.8) ** 2))
img *= (0.55 + 0.45 * vig)[..., None]
img = np.clip(img, 0, 1) ** 0.95

im = Image.fromarray((img * 255).astype(np.uint8))
im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=40, threshold=2))
out = sys.argv[1] if len(sys.argv) > 1 else 'backdrop'
im.save(out + '.webp', quality=78, method=6)
im.resize((1200, 675), Image.LANCZOS).save(out + '-preview.png')
print('ok')
