#!/usr/bin/env python3
"""Neutral event graphics in the Society's brand colours (no text, dates, emblems, flags or photographs).

Run:  python3 build/event-art.py        → writes src/assets/events/web/*.webp (1080px) and thumbs/*.webp (440px)
Replace any of these files with approved artwork of the same name whenever the committee has it.
"""
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter

NAVY, GREEN, GOLD, IVORY = (0, 33, 71), (20, 83, 45), (201, 154, 46), (246, 244, 237)
GOLD_LT = (227, 182, 92)
S = 2160  # drawn at 2× and reduced, for smooth edges
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'assets', 'events')


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def background(base):
    """Soft radial light on the base colour, darker towards the corners."""
    small = 270
    img = Image.new('RGB', (small, small))
    px = img.load()
    hi, lo = mix(base, IVORY, 0.14), mix(base, (0, 0, 0), 0.38)
    cx, cy, rmax = small * 0.5, small * 0.42, small * 0.86
    for y in range(small):
        for x in range(small):
            t = min(1.0, math.hypot(x - cx, y - cy) / rmax)
            px[x, y] = mix(hi, lo, t ** 1.25)
    return img.resize((S, S), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6)).convert('RGBA')


class Canvas:
    def __init__(self, base):
        self.img = background(base)

    def layer(self):
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        return im, ImageDraw.Draw(im)

    def put(self, layer):
        self.img = Image.alpha_composite(self.img, layer)

    def frame(self, color=GOLD_LT, alpha=150):
        im, d = self.layer()
        m = 108
        d.rounded_rectangle([m, m, S - m, S - m], radius=72, outline=color + (alpha,), width=5)
        self.put(im)


def rgba(c, a):
    return c + (int(a),)


def poly(cx, cy, r, n, rot=0.0):
    return [(cx + r * math.cos(rot + 2 * math.pi * k / n), cy + r * math.sin(rot + 2 * math.pi * k / n)) for k in range(n)]


def gathering(c, n, ring=GOLD_LT, fill=IVORY, accent=GOLD):
    """A ring of overlapping circles: people coming together."""
    cx = cy = S / 2
    R, r = S * 0.2, S * 0.17
    for k in range(n):
        a = 2 * math.pi * k / n - math.pi / 2
        x, y = cx + R * math.cos(a), cy + R * math.sin(a)
        im, d = c.layer()
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(fill, 16), outline=rgba(ring if k % 2 else fill, 190), width=6)
        c.put(im)
    im, d = c.layer()
    d.ellipse([cx - S * 0.045, cy - S * 0.045, cx + S * 0.045, cy + S * 0.045], fill=rgba(accent, 255))
    d.ellipse([cx - S * 0.39, cy - S * 0.39, cx + S * 0.39, cy + S * 0.39], outline=rgba(ring, 70), width=4)
    c.put(im)


def rosette(c, n, color=GOLD_LT, second=IVORY):
    """An n-fold geometric rosette."""
    cx = cy = S / 2
    for j, (rad, alpha, w) in enumerate([(S * 0.36, 215, 6), (S * 0.27, 150, 5), (S * 0.18, 120, 4)]):
        im, d = c.layer()
        for k in range(n):
            a = 2 * math.pi * k / n + (math.pi / n if j % 2 else 0)
            x, y = cx + rad * 0.5 * math.cos(a), cy + rad * 0.5 * math.sin(a)
            d.ellipse([x - rad * 0.5, y - rad * 0.5, x + rad * 0.5, y + rad * 0.5], outline=rgba(color if j != 1 else second, alpha), width=w)
        c.put(im)
    im, d = c.layer()
    d.ellipse([cx - S * 0.05, cy - S * 0.05, cx + S * 0.05, cy + S * 0.05], fill=rgba(GOLD, 255))
    c.put(im)


def stars(c, color=GOLD_LT, second=IVORY):
    """A lattice of eight-pointed stars (two squares turned against each other)."""
    step = S / 4.0
    im, d = c.layer()
    for iy in range(-1, 6):
        for ix in range(-1, 6):
            x, y = ix * step, iy * step
            centre = (ix, iy) == (2, 2)
            r = step * 0.46
            col, a, w = (GOLD, 255, 9) if centre else (color if (ix + iy) % 2 == 0 else second, 120 if (ix + iy) % 2 == 0 else 70, 5)
            for rot in (0, math.pi / 4):
                pts = poly(x, y, r, 4, rot)
                d.line(pts + [pts[0]], fill=rgba(col, a), width=w, joint='curve')
    c.put(im)
    im, d = c.layer()
    x = y = 2 * step
    for rot in (0, math.pi / 4):
        d.polygon(poly(x, y, step * 0.46, 4, rot), fill=rgba(GOLD, 70))
    c.put(im)


def octagons(c, color=GOLD_LT, second=IVORY):
    """Interlocking octagons and small squares."""
    step = S / 3.6
    im, d = c.layer()
    off = (S - step * 3) / 2 - step
    for iy in range(0, 6):
        for ix in range(0, 6):
            x, y = off + ix * step, off + iy * step
            pts = poly(x, y, step * 0.541, 8, math.pi / 8)
            d.line(pts + [pts[0]], fill=rgba(color, 150), width=6, joint='curve')
            sq = poly(x + step / 2, y + step / 2, step * 0.2, 4, 0)
            d.polygon(sq, fill=rgba(second, 34), outline=rgba(second, 120))
    c.put(im)
    im, d = c.layer()
    x = y = S / 2  # the small square at the centre of the lattice
    d.polygon(poly(x, y, step * 0.2, 4, 0), fill=rgba(GOLD, 255))
    d.polygon(poly(x, y, step * 0.34, 4, 0), outline=rgba(GOLD, 200))
    c.put(im)


def network(c, seed, color=IVORY, accent=GOLD_LT):
    """Points and connections: research, ideas, careers."""
    rnd = random.Random(seed)
    n = 7
    step = S / (n + 1)
    pts = [((ix + 1) * step + rnd.uniform(-0.28, 0.28) * step, (iy + 1) * step + rnd.uniform(-0.28, 0.28) * step) for iy in range(n) for ix in range(n)]
    im, d = c.layer()
    for i, p in enumerate(pts):
        for q in pts[i + 1:]:
            dist = math.hypot(p[0] - q[0], p[1] - q[1])
            if dist < step * 1.32:
                d.line([p, q], fill=rgba(color, 60), width=4)
    c.put(im)
    im, d = c.layer()
    hot = set(rnd.sample(range(len(pts)), 9))
    for i, (x, y) in enumerate(pts):
        r = S * (0.017 if i in hot else 0.008)
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(accent if i in hot else color, 255 if i in hot else 190))
        if i in hot:
            d.ellipse([x - r * 2.2, y - r * 2.2, x + r * 2.2, y + r * 2.2], outline=rgba(accent, 120), width=4)
    c.put(im)


def bands(c, color=IVORY, accent=GOLD):
    """Diagonal lanes and a disc: movement and play."""
    im, d = c.layer()
    for k in range(-6, 14):
        x = k * S * 0.13
        a = 105 if k % 3 == 0 else 38
        d.line([(x, S * 1.05), (x + S * 0.62, -S * 0.05)], fill=rgba(GOLD_LT if k % 3 == 0 else color, a), width=18 if k % 3 == 0 else 8)
    c.put(im)
    im, d = c.layer()
    cx, cy, r = S * 0.64, S * 0.38, S * 0.11
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(accent, 240))
    d.ellipse([cx - r * 1.45, cy - r * 1.45, cx + r * 1.45, cy + r * 1.45], outline=rgba(color, 150), width=6)
    d.ellipse([cx - r * 1.9, cy - r * 1.9, cx + r * 1.9, cy + r * 1.9], outline=rgba(color, 70), width=4)
    c.put(im)


def arcs(c, color=IVORY, accent=GOLD_LT):
    """Rising arcs: an open-air gathering."""
    im, d = c.layer()
    ox, oy = S * 0.16, S * 0.86
    for k in range(1, 11):
        r = k * S * 0.085
        d.arc([ox - r, oy - r, ox + r, oy + r], start=270, end=360, fill=rgba(accent if k % 3 == 0 else color, 205 if k % 3 == 0 else 95), width=9 if k % 3 == 0 else 5)
    d.ellipse([S * 0.66, S * 0.2, S * 0.8, S * 0.34], fill=rgba(GOLD, 240))
    c.put(im)


def rings(c, color=GOLD_LT, second=IVORY):
    """Concentric rings with places set around them: a shared table."""
    cx = cy = S / 2
    im, d = c.layer()
    for k, r in enumerate([0.12, 0.2, 0.3, 0.4]):
        rr = S * r
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=rgba(color if k % 2 == 0 else second, 215 - k * 38), width=7 - k)
    n = 12
    for k in range(n):
        a = 2 * math.pi * k / n
        x, y, r = cx + S * 0.3 * math.cos(a), cy + S * 0.3 * math.sin(a), S * 0.018
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(second, 235))
    d.ellipse([cx - S * 0.055, cy - S * 0.055, cx + S * 0.055, cy + S * 0.055], fill=rgba(GOLD, 255))
    c.put(im)


ART = [  # (file stem, base colour, drawing)
    ('event-01-winter-welcome-first-society-meeting', NAVY, lambda c: gathering(c, 7)),
    ('event-02-hilary-term-welcome-gathering', GREEN, lambda c: gathering(c, 9)),
    ('event-03-saudi-founding-day-ramadan-iftar', GREEN, lambda c: octagons(c)),
    ('event-04-eid-al-fitr-celebration', NAVY, lambda c: rosette(c, 12)),
    ('event-05-oxford-spring-gathering', GREEN, lambda c: arcs(c)),
    ('event-06-saudi-futures-research-ai-careers', NAVY, lambda c: network(c, 6)),
    ('event-07-eid-al-adha-celebration', GREEN, lambda c: rosette(c, 16)),
    ('event-08-summer-sports-games-gathering', GREEN, lambda c: bands(c)),
    ('event-09-saudi-national-day-97', GREEN, lambda c: stars(c)),
    ('event-10-michaelmas-term-welcome', NAVY, lambda c: gathering(c, 11)),
    ('event-11-annual-gathering-and-dinner', NAVY, lambda c: rings(c)),
]


def main():
    for stem, base, draw in ART:
        c = Canvas(base)
        draw(c)
        c.frame()
        full = c.img.convert('RGB').resize((1080, 1080), Image.LANCZOS)
        full.save(os.path.join(ROOT, 'web', stem + '.webp'), 'WEBP', quality=86, method=6)
        full.resize((440, 440), Image.LANCZOS).save(os.path.join(ROOT, 'thumbs', stem + '.webp'), 'WEBP', quality=84, method=6)
        print('wrote', stem)


if __name__ == '__main__':
    sys.exit(main())
