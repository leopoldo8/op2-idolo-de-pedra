"""Generate the replacement technical-hack handouts for Ato I (SVG, then PNG via headless Chrome).

- computador.svg: messy desktop; exactly one icon has a readable name.
- painel-N-fios.svg: tangled wires from breakers to lettered terminals; one breaker is marked with red tape.
"""

import json
import math
import random
import subprocess
import sys
from pathlib import Path

OUT = Path(sys.argv[1]).resolve()
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
W, H = 1600, 1000

READABLE_NAME = "Documentos importantes"
READABLE_SLOTS = {"": (2, 6), "-v2": (8, 1)}


def gibberish_names(count, rng):
    bases = ["dasadasdads", "dasadasdad", "dasdasdas", "asdasd", "asdasdasd", "sdfsdf", "dsadsa",
             "dasdsadas", "qweqwe", "asdsad", "dasadas", "sadasd", "fdsfds", "dasadasdadss", "asdaasd"]
    suffixes = ["123", "1234", "12", "123 (2)", "123 (3)", "", "1", "321", "_2", "__", "123123", "(2)", "11", "2"]
    names = set()
    while len(names) < count:
        names.add(rng.choice(bases) + rng.choice(suffixes))
    out = sorted(names)
    rng.shuffle(out)
    return out


def wrap_label(name, width=13):
    if len(name) <= width:
        return [name]
    if " " in name:
        first, rest = name.split(" ", 1)
        return [first, rest]
    return [name[:width], name[width:]]


def folder_icon(x, y):
    return (
        f'<g transform="translate({x},{y})">'
        '<path d="M2 10 h18 l6 6 h30 v34 h-54 z" fill="#d9a52b" stroke="#8a6512" stroke-width="1.5"/>'
        '<path d="M2 20 h54 v30 h-54 z" fill="#f2c94c" stroke="#8a6512" stroke-width="1.5"/>'
        "</g>"
    )


def file_icon(x, y):
    return (
        f'<g transform="translate({x},{y})">'
        '<path d="M12 4 h24 l10 10 v38 h-34 z" fill="#f4f4f4" stroke="#6b6b6b" stroke-width="1.5"/>'
        '<path d="M36 4 v10 h10" fill="none" stroke="#6b6b6b" stroke-width="1.5"/>'
        '<path d="M18 24 h22 M18 31 h22 M18 38 h16" stroke="#9a9a9a" stroke-width="2"/>'
        "</g>"
    )


def build_desktop(rng, readable_slot):
    cols, rows = 11, 8
    cell_w, cell_h = 140, 112
    x0, y0 = 22, 14
    names = gibberish_names(cols * rows - 1, rng)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        '<defs><linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">'
        '<stop offset="0" stop-color="#1f5f86"/><stop offset="1" stop-color="#0d3550"/></linearGradient>'
        '<filter id="sh"><feDropShadow dx="1" dy="1" stdDeviation="0.6" flood-color="#000" flood-opacity="0.9"/></filter></defs>',
        f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',
    ]
    idx = 0
    for c in range(cols):
        for r in range(rows):
            if (c, r) == readable_slot:
                name, is_folder = READABLE_NAME, True
            else:
                name = names[idx]
                idx += 1
                is_folder = rng.random() < 0.8
            cx = x0 + c * cell_w + cell_w / 2
            cy = y0 + r * cell_h
            parts.append(folder_icon(cx - 29, cy) if is_folder else file_icon(cx - 29, cy))
            label = name if is_folder else name + rng.choice([".txt", ".docx", ".zip"])
            for i, line in enumerate(wrap_label(label)):
                parts.append(
                    f'<text x="{cx}" y="{cy + 70 + i * 17}" text-anchor="middle" font-family="Tahoma, Verdana, sans-serif" '
                    f'font-size="14" fill="#fff" filter="url(#sh)">{line}</text>'
                )
    tb = H - 44
    parts += [
        f'<rect y="{tb}" width="{W}" height="44" fill="#1b1b1b"/>',
        f'<rect x="6" y="{tb + 6}" width="96" height="32" rx="4" fill="#2f6b2f"/>',
        f'<text x="54" y="{tb + 27}" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="15" fill="#fff">Iniciar</text>',
        f'<text x="{W - 16}" y="{tb + 19}" text-anchor="end" font-family="Tahoma, sans-serif" font-size="13" fill="#ddd">03:12</text>',
        f'<text x="{W - 16}" y="{tb + 36}" text-anchor="end" font-family="Tahoma, sans-serif" font-size="13" fill="#ddd">13/10/2022</text>',
        "</svg>",
    ]
    return "\n".join(parts)


def sample_spline(points, steps=24):
    pts = [points[0]] + points + [points[-1]]
    out = [points[0]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        for k in range(1, steps + 1):
            t = k / steps
            u = 1 - t
            out.append((u ** 3 * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p2[0],
                        u ** 3 * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p2[1]))
    return out


def split_by_length(poly, chunk_len):
    ranges, start, run = [], 0, 0.0
    for i in range(1, len(poly)):
        run += math.dist(poly[i - 1], poly[i])
        if run >= chunk_len:
            ranges.append((start, i))
            start, run = i, 0.0
    if start < len(poly) - 1:
        ranges.append((start, len(poly) - 1))
    return ranges


def segments_cross(p1, p2, q1, q2):
    def orient(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    d1, d2 = orient(q1, q2, p1), orient(q1, q2, p2)
    d3, d4 = orient(p1, p2, q1), orient(p1, p2, q2)
    return d1 * d2 < 0 and d3 * d4 < 0


def crossing_layers(target_chunks, other_chunks, z):
    over = under = 0
    for ti, tc in target_chunks:
        for oi, oc in other_chunks:
            for a, b in zip(tc, tc[1:]):
                for c, d in zip(oc, oc[1:]):
                    if segments_cross(a, b, c, d):
                        if z[ti] > z[oi]:
                            over += 1
                        else:
                            under += 1
    return over, under


def polyline_d(poly):
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in poly)


PANEL_LEVELS = {
    3: {"wide": 2, "knot": False, "stubs": 0, "halo": 15},
    4: {"wide": 2, "knot": True, "stubs": 0, "halo": 14},
    5: {"wide": 2, "knot": True, "stubs": 0, "halo": 13},
    6: {"wide": 2, "knot": True, "stubs": 1, "halo": 12},
}
PANEL_STATS = []
WIRE_COLORS = ["#1c1c1c", "#2a2420", "#232628", "#2b2b2b", "#1f1d22", "#262220", "#211f1c", "#29262a", "#1e2120"]


def middle_points(level, margin, top_y, bot_y, rng):
    count = level["wide"] + (1 if level["knot"] else 0)
    knot_index = count // 2 if level["knot"] else -1
    points = []
    for j in range(count):
        y = top_y + 130 + (bot_y - top_y - 260) * (j + 0.5) / count
        if j == knot_index:
            points.append((W / 2 + rng.uniform(-110, 110), y + rng.uniform(-30, 30)))
        else:
            points.append((rng.uniform(margin - 60, W - margin + 60), y + rng.uniform(-40, 40)))
    return points


def build_panel(n, rng):
    level = PANEL_LEVELS[n]
    letters = "ABCDEFGHI"[:n]
    margin = 260
    span = W - 2 * margin
    xs = [margin + span * i / (n - 1) for i in range(n)]
    top_y, bot_y = 250, 800
    marked = rng.randrange(1, n - 1)
    while True:
        perm = list(range(n))
        rng.shuffle(perm)
        if all(perm[i] != i for i in range(n)):
            break

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        '<defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#b9b6ad"/><stop offset="0.5" stop-color="#a19d93"/><stop offset="1" stop-color="#8d897f"/></linearGradient></defs>',
        f'<rect width="{W}" height="{H}" fill="#3a3732"/>',
        f'<rect x="40" y="30" width="{W - 80}" height="{H - 60}" rx="10" fill="url(#metal)" stroke="#5c5850" stroke-width="4"/>',
    ]
    for sx, sy in [(70, 60), (W - 70, 60), (70, H - 60), (W - 70, H - 60)]:
        parts.append(f'<circle cx="{sx}" cy="{sy}" r="10" fill="#7a766d" stroke="#4d4a44" stroke-width="2"/>'
                     f'<path d="M{sx - 6},{sy} h12" stroke="#4d4a44" stroke-width="2.5"/>')
    for _ in range(14):
        parts.append(f'<ellipse cx="{rng.uniform(80, W - 80):.0f}" cy="{rng.uniform(80, H - 80):.0f}" '
                     f'rx="{rng.uniform(15, 60):.0f}" ry="{rng.uniform(8, 30):.0f}" fill="#6b5a40" opacity="{rng.uniform(0.08, 0.2):.2f}"/>')

    polylines = []
    for i in range(n):
        pts = [(xs[i], top_y + 40), (xs[i], top_y + 90)]
        pts += middle_points(level, margin, top_y, bot_y, rng)
        pts += [(xs[perm[i]], bot_y - 90), (xs[perm[i]], bot_y - 30)]
        polylines.append((i, sample_spline(pts), None))
    for s_idx in range(level["stubs"]):
        a = (rng.uniform(margin, W - margin), rng.uniform(top_y + 120, top_y + 200))
        b = (rng.uniform(margin, W - margin), rng.uniform(bot_y - 200, bot_y - 120))
        pts = [a] + middle_points(level, margin, top_y, bot_y, rng) + [b]
        polylines.append((n + s_idx, sample_spline(pts), (a, b)))

    pieces = []
    for owner, poly, _ in polylines:
        ranges = split_by_length(poly, 130)
        first = len(pieces)
        for r, (a, b) in enumerate(ranges):
            prev_k = first + r - 1 if r > 0 else None
            next_k = first + r + 1 if r < len(ranges) - 1 else None
            pieces.append((owner, poly[a:b + 1], poly, a, b, prev_k, next_k))
    target = [(k, piece[1]) for k, piece in enumerate(pieces) if piece[0] == marked]
    others = [(k, piece[1]) for k, piece in enumerate(pieces) if piece[0] != marked]
    for _ in range(200):
        z = [rng.random() for _ in pieces]
        over, under = crossing_layers(target, others, z)
        total = over + under
        if total == 0 or 0.4 <= under / total <= 0.65:
            break
    PANEL_STATS.append((n, over, under))

    def halo_for(k):
        _, _, poly, a, b, prev_k, next_k = pieces[k]
        if prev_k is not None:
            a = a - 1 if z[k] < z[prev_k] else a + 1
        if next_k is not None:
            b = b + 1 if z[k] < z[next_k] else b - 1
        return poly[a:b + 1]

    for k in sorted(range(len(pieces)), key=lambda k: z[k]):
        owner, _, poly, a, b, _, _ = pieces[k]
        core = poly[max(a - 1, 0):b + 2]
        halo = halo_for(k)
        if len(halo) > 1:
            parts.append(f'<path d="{polyline_d(halo)}" fill="none" stroke="#c9c5bb" stroke-width="{level["halo"]}" stroke-linecap="butt" stroke-linejoin="round"/>')
        parts.append(f'<path d="{polyline_d(core)}" fill="none" stroke="{WIRE_COLORS[owner % len(WIRE_COLORS)]}" stroke-width="7" stroke-linecap="butt" stroke-linejoin="round"/>')
    for _, _, loose_ends in polylines:
        for ex, ey in loose_ends or ():
            parts.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="4.5" fill="#b87333"/>')

    for i, x in enumerate(xs):
        parts.append(f'<rect x="{x - 32}" y="{top_y - 70}" width="64" height="112" rx="5" fill="#2e2c29" stroke="#111" stroke-width="2"/>')
        parts.append(f'<rect x="{x - 12}" y="{top_y - 50}" width="24" height="44" rx="3" fill="#d8d3c8"/>')
        parts.append(f'<circle cx="{x}" cy="{top_y + 40}" r="8" fill="#9c8f6a" stroke="#3b3524" stroke-width="2"/>')
        if i == marked:
            parts.append(f'<rect x="{x - 44}" y="{top_y - 2}" width="88" height="22" fill="#b3201a" opacity="0.92" '
                         f'transform="rotate(-8 {x} {top_y + 9})"/>')
    for i, x in enumerate(xs):
        parts.append(f'<rect x="{x - 30}" y="{bot_y - 30}" width="60" height="60" rx="4" fill="#3d3a35" stroke="#111" stroke-width="2"/>')
        parts.append(f'<circle cx="{x}" cy="{bot_y}" r="12" fill="#a39770" stroke="#3b3524" stroke-width="2"/>')
        parts.append(f'<text x="{x}" y="{bot_y + 78}" text-anchor="middle" font-family="Courier New, monospace" font-weight="bold" '
                     f'font-size="44" fill="#2a2724">{letters[i]}</text>')
    parts.append("</svg>")
    return "\n".join(parts), letters[perm[marked]]


def render(svg_text, name):
    svg_path = OUT / f"{name}.svg"
    png_path = OUT / f"{name}.png"
    svg_path.write_text(svg_text, encoding="utf-8")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    f"--window-size={W},{H}", f"--screenshot={png_path}", svg_path.as_uri()],
                   check=True, capture_output=True)
    return png_path


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    answers = {}
    for variant, slot in READABLE_SLOTS.items():
        render(build_desktop(random.Random(160322 + len(variant)), slot), f"hack-computador{variant}")
        answers[f"hack-computador{variant}"] = f"{READABLE_NAME} (coluna {slot[0] + 1}, linha {slot[1] + 1})"
    for variant, seed_offset in (("", 1000), ("-v2", 3000)):
        for n in PANEL_LEVELS:
            svg, answer = build_panel(n, random.Random(seed_offset + n))
            render(svg, f"hack-painel-{n}-fios{variant}")
            answers[f"hack-painel-{n}-fios{variant}"] = answer
    (OUT / "gabarito.json").write_text(json.dumps(answers, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(answers, ensure_ascii=False, indent=2))
    print("marked wire crossings (wires, over, under):", PANEL_STATS)


if __name__ == "__main__":
    main()
