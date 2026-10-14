"""
Keeps the lung lobes inside the rib cage (run: `python3 scripts/fit-lungs-to-ribcage.py`, needs numpy).

The lobes come from Z-Anatomy (scripts/import-lungs.mjs) and were placed by matching the airways, so in places
their surface ran through the ribs and bulged out between them. Here the chest wall is found slice by slice
(every 2 mm of height, for each side): the inner surface of the ribs, costal cartilages, sternum and thoracic
vertebrae, seen from the middle of that lung. Small gaps (between ribs) are bridged and the wall is evened out
across slices; the side facing the heart, and the apex above the first ribs, are left free. Every lung vertex
beyond the wall minus MARGIN is pushed in, the push spread smoothly over the surface round it, so the lung is
reshaped rather than dented.

The fit is made at full breath (see breathe_in below). Only positions and normals change — vertex count and order stay — so the baked skinning weights (skin.json) still
fit. Writes the lung chunk and atlas.json in place; bump MODEL_VERSION in atlas-data.ts afterwards.
"""
import gzip, json, math, os, re, warnings

import numpy as np
from scipy import sparse

warnings.simplefilter("ignore", RuntimeWarning)  # means of empty columns (no wall there) are expected

DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public/sites/human-atlas-co-f41dd540/shared/models")
MARGIN = 0.003      # pleura and intercostal muscle between lung and bone (m)
SLICE = 0.002       # slice step (m)
SLAB = 0.005        # bone points within this height of a slice count for it (m)
BINS = 144          # directions round the lung's middle (2.5° each)
GAP = 8             # bridge gaps of up to this many directions (between ribs)
COVER = 0.4         # a slice is fitted only where bone surrounds at least this share of the lung
TAPER = 10          # free directions this close to the wall slope away from it
WALL = re.compile(r"\brib\b|costal cartilage|sternum|manubrium|xiphoid|thoracic vertebra")

M = json.load(open(os.path.join(DIR, "atlas.json")))
# Front ends of the first ribs (top of the first costal cartilages): above, the apex is narrowed as a whole.
APEX = max(p["bounds"][1][1] for p in M["parts"] if p["name"].lower().endswith("first costal cartilage"))
raw = {}


def chunk(i):
    if i not in raw:
        raw[i] = bytearray(gzip.open(os.path.join(DIR, M["chunks"][i]["gzip"].split("/")[-1])).read())
    return raw[i]


def mesh(p):
    b = chunk(p["chunk"])
    v = np.frombuffer(b, np.float32, p["vertexCount"] * 3, p["positions"]).reshape(-1, 3).astype(np.float64)
    f = np.frombuffer(b, np.uint32, p["indexCount"], p["indices"]).reshape(-1, 3).astype(np.int64)
    return v, f


# The atlas breathes (anatomy-viewer.ts, ANIM_GROUP 3 and 5): at full breath the lungs grow about their bronchi
# (×1.08, 1.06, 1.09) and the rib cage widens about the chest (×1.035, raised 7 mm). The lungs are fitted at full
# breath, so they stay inside the ribs all the way through.
RIBCAGE = re.compile(r"\brib\b|costal cartilage|sternum|manubrium|xiphoid")
GROW = np.array([1.08, 1.06, 1.09])


def centre(parts):
    return np.mean([(np.array(p["bounds"][0]) + np.array(p["bounds"][1])) / 2 for p in parts], 0)


bronchi = [p for p in M["parts"] if p["system"] == "respiratory" and re.search("bronch", p["name"], re.I)]
LUNG_L = centre([p for p in bronchi if (p["bounds"][0][0] + p["bounds"][1][0]) / 2 > 0])
LUNG_R = centre([p for p in bronchi if (p["bounds"][0][0] + p["bounds"][1][0]) / 2 <= 0])
cage = [p for p in M["parts"] if p["system"] in ("skeletal", "connective") and RIBCAGE.search(p["name"].lower())]
CHEST = centre(cage)


def breathe_in(v):
    c = np.where(v[:, :1] > 0, LUNG_L, LUNG_R)
    return c + (v - c) * GROW


def breathe_out(v):
    c = np.where(v[:, :1] > 0, LUNG_L, LUNG_R)
    return c + (v - c) / GROW


def widen(p, v):
    if p not in cage:
        return v
    w = v.copy()
    w[:, [0, 2]] = CHEST[[0, 2]] + (v[:, [0, 2]] - CHEST[[0, 2]]) * 1.035
    w[:, 1] += 0.007
    return w


bone = np.concatenate([widen(p, mesh(p)[0]) for p in M["parts"] if WALL.search(p["name"].lower())])
lobes = [p for p in M["parts"] if p["id"].startswith("LUNG-")]
meshes = {p["id"]: (breathe_in(mesh(p)[0]), mesh(p)[1]) for p in lobes}


def walls(side_ids):
    """Per slice: the lung's middle (x, z) and the wall radius in each direction (inf where free)."""
    v = np.concatenate([meshes[i][0] for i in side_ids])
    y0 = v[:, 1].min() - SLICE
    n = int((v[:, 1].max() - y0) / SLICE) + 2
    centres = []
    R = np.full((n, BINS), np.inf)
    for k in range(n):
        y = y0 + k * SLICE
        near = v[np.abs(v[:, 1] - y) < SLICE * 2]
        if len(near) < 20:
            centres.append(None)
            continue
        cx, cz = near[:, 0].mean(), near[:, 2].mean()
        centres.append((cx, cz))
        b = bone[np.abs(bone[:, 1] - y) < SLAB]
        if len(b):
            ang = np.arctan2(b[:, 2] - cz, b[:, 0] - cx)
            idx = ((ang + math.pi) / (2 * math.pi) * BINS).astype(int) % BINS
            np.minimum.at(R[k], idx, np.hypot(b[:, 0] - cx, b[:, 2] - cz))
        # Bridge short gaps (the spaces between ribs) by interpolating round the circle.
        r = R[k]
        pos = np.flatnonzero(np.isfinite(r))
        if len(pos) >= 3:
            for a, c in zip(pos, np.roll(pos, -1)):
                gap = (c - a) % BINS
                if 1 < gap <= GAP + 1:
                    for s in range(1, gap):
                        r[(a + s) % BINS] = r[a] + (r[c] - r[a]) * s / gap
        # Where bone surrounds only a small part of the lung it is left free; the apex is fitted on its own.
        if np.isfinite(r).mean() < COVER or y > APEX:
            r[:] = np.inf
    # Even out the wall: across neighbouring slices and round the circle, never outwards past the bone.
    F = np.where(np.isfinite(R), R, np.nan)
    lo = np.fmin(np.fmin(F, np.roll(F, 1, 0)), np.roll(F, -1, 0))
    for axis, reach in ((0, 2), (1, 2)):
        stack = np.stack([np.roll(lo, d, axis) for d in range(-reach, reach + 1)])
        lo = np.where(np.isnan(lo), np.nan, np.nanmean(stack, 0))
    R = np.where(np.isnan(lo), np.inf, np.minimum(lo, R))
    # Free directions next to the wall slope away from it gently instead of a step.
    for k in range(n):
        r = R[k]
        fin = np.flatnonzero(np.isfinite(r))
        if not len(fin) or len(fin) == BINS:
            continue
        for b in np.flatnonzero(~np.isfinite(r)):
            d = np.minimum((fin - b) % BINS, (b - fin) % BINS)
            j = d.argmin()
            if d[j] <= TAPER:
                r[b] = R[k, fin[j]] + 0.004 * d[j]
    return y0, centres, R


def fit_apex(side_ids):
    """
    Above the front ends of the first ribs the lung rises through the ring of the first ribs into the neck.
    There the dome is narrowed as a whole, slice by slice, just enough for it to pass inside the ribs, so it
    keeps its rounded shape instead of being pressed in at single points.
    """
    vs = [meshes[i][0] for i in side_ids]
    allv = np.concatenate(vs)
    ring = allv[np.abs(allv[:, 1] - APEX) < 0.003]
    if not len(ring):
        return
    cx, cz = ring[:, 0].mean(), ring[:, 2].mean()
    top = allv[:, 1].max()
    heights = np.arange(APEX, top + SLICE, SLICE)
    scale = np.ones(len(heights))
    for k, y in enumerate(heights):
        b = bone[np.abs(bone[:, 1] - y) < SLAB]
        here = allv[np.abs(allv[:, 1] - y) < SLICE]
        if not len(b) or not len(here):
            continue
        r = np.full(BINS, np.inf)
        idx = ((np.arctan2(b[:, 2] - cz, b[:, 0] - cx) + math.pi) / (2 * math.pi) * BINS).astype(int) % BINS
        np.minimum.at(r, idx, np.hypot(b[:, 0] - cx, b[:, 2] - cz))
        dx, dz = here[:, 0] - cx, here[:, 2] - cz
        d = np.hypot(dx, dz)
        bins = ((np.arctan2(dz, dx) + math.pi) / (2 * math.pi) * BINS).astype(int) % BINS
        wall = r[bins] - MARGIN
        ok = np.isfinite(wall) & (d > 1e-4)
        if ok.any():
            scale[k] = np.clip(np.percentile(wall[ok] / d[ok], 5), 0.55, 1.0)
    # Narrower going up, never wider; eased in from the first ribs.
    scale = np.minimum.accumulate(scale)
    scale = np.convolve(np.pad(scale, 3, mode="edge"), np.ones(7) / 7, mode="valid")
    scale = 1 - (1 - scale) * np.clip((heights - APEX) / 0.006, 0, 1)
    for v in vs:
        up = v[:, 1] > APEX
        s = np.interp(v[up, 1], heights, scale)
        v[up, 0] = cx + (v[up, 0] - cx) * s
        v[up, 2] = cz + (v[up, 2] - cz) * s
    print(f"apex {side_ids[0][5]}: narrowed to {scale.min():.2f} of its width at the top")


def required(v, side):
    """How far each vertex lies beyond the wall (0 inside) and its inward direction."""
    y0, centres, R = side
    k = np.clip(np.round((v[:, 1] - y0) / SLICE).astype(int), 0, len(centres) - 1)
    need = np.zeros(len(v))
    inward = np.zeros_like(v)
    for i in range(len(v)):
        c = centres[k[i]]
        if c is None:
            continue
        dx, dz = v[i, 0] - c[0], v[i, 2] - c[1]
        d = math.hypot(dx, dz)
        if d < 1e-6:
            continue
        inward[i] = (-dx / d, 0, -dz / d)
        b = int((math.atan2(dz, dx) + math.pi) / (2 * math.pi) * BINS) % BINS
        lim = R[k[i], b] - MARGIN
        if np.isfinite(lim) and d > lim:
            need[i] = d - lim
    return need, inward


def neighbours(f, n):
    """Row-normalised adjacency: A @ x is the mean of each vertex's neighbours."""
    a = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    a = np.unique(np.sort(a, 1), axis=0)
    rows, cols = np.concatenate([a[:, 0], a[:, 1]]), np.concatenate([a[:, 1], a[:, 0]])
    A = sparse.csr_matrix((np.ones(len(rows)), (rows, cols)), shape=(n, n))
    deg = np.asarray(A.sum(1)).ravel()
    return sparse.diags(1 / np.maximum(deg, 1)) @ A


def normals(v, f):
    n = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for j in range(3):
        np.add.at(n, f[:, j], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


originals = {p["id"]: meshes[p["id"]][0].copy() for p in lobes}
for s_ in "RL":
    fit_apex([p["id"] for p in lobes if p["id"].startswith(f"LUNG-{s_}")])
sides = {s: walls([p["id"] for p in lobes if p["id"].startswith(f"LUNG-{s}")]) for s in "RL"}
for p in lobes:
    v, f = meshes[p["id"]]
    side = sides[p["id"][5]]
    before = originals[p["id"]]
    nb = neighbours(f, len(v))
    moved = np.zeros(len(v), bool)
    for _ in range(4):
        need, inward = required(v, side)
        if need.max() < 1e-4:
            break
        moved |= need > 0
        # Spread each push over the surface round it, so the lung is reshaped smoothly, not dented.
        push = need.copy()
        for _ in range(25):
            push = np.maximum(need, nb @ push)
        v += push[:, None] * inward
    # Even the reshaped area a little, then make sure nothing is left beyond the wall.
    area = np.linalg.norm(v - before, axis=1) > 1e-5
    idx = np.flatnonzero(area)
    for _ in range(3):
        for lam in (0.5, -0.53):
            avg = nb @ v
            v[idx] += lam * (avg[idx] - v[idx])
    need, inward = required(v, side)
    v += need[:, None] * inward
    moved |= area
    v = breathe_out(v)
    before = breathe_out(before)
    shift = np.linalg.norm(v - before, axis=1)
    print(f"{p['name']}: moved {int(moved.sum())} of {len(v)} vertices, up to {shift.max() * 1000:.1f} mm (mean of moved {shift[moved].mean() * 1000 if moved.any() else 0:.1f} mm)")
    b = chunk(p["chunk"])
    b[p["positions"]:p["positions"] + v.size * 4] = v.astype(np.float32).tobytes()
    n16 = np.round(np.clip(normals(v, f), -1, 1) * 32767).astype(np.int16)
    b[p["normals"]:p["normals"] + n16.size * 2] = n16.tobytes()
    p["bounds"] = [v.min(0).tolist(), v.max(0).tolist()]

for i in {p["chunk"] for p in lobes}:
    data = raw[i]
    c = M["chunks"][i]
    gz = gzip.compress(bytes(data), 9, mtime=0)
    open(os.path.join(DIR, c["gzip"].split("/")[-1]), "wb").write(gz)
    c["gzipBytes"] = len(gz)
    print(f"wrote {c['gzip'].split('/')[-1]} ({len(gz) // 1024} KB)")
json.dump(M, open(os.path.join(DIR, "atlas.json"), "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
