"""
3D models for the geography lessons, built from code:

  volcanoes/kazbegi-relief(.glb, -lod1.glb)    real relief round Mt Kazbek, heights ×1.5
  volcanoes/javakheti-relief(.glb, -lod1.glb)  the Javakheti volcanic upland (Abul, Samsari, Lake Paravani), heights ×2
  hazards/mudflow(.glb, -lod1.glb)             a mudflow: catchment, gorge, a fan of mud and boulders over a village edge
  hazards/avalanche(.glb, -lod1.glb)           an avalanche: release zone, track through the forest, deposit, powder cloud

Elevation: Copernicus DEM GLO-30 (Kazbegi) and GLO-90 (Javakheti — its GLO-30 tile is not public), AWS open data
registry. © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the
European Union and ESA; all rights reserved. The mudflow and avalanche are made up (typical shapes, no real place).

Run (needs numpy, scipy and tifffile; the Draco step needs @gltf-transform/cli):
  python3 scripts/build-geo-heroes.py <download cache dir> [reliefs|slopes]

Meshes carry POSITION and COLOR_0 (vertex colours, linear); flat-shaded parts (houses) also carry NORMAL.
Units: kilometres for the reliefs, hectometres for the made-up slopes; Y up, north = −Z.
"""
import json, math, os, struct, subprocess, sys, urllib.request, zlib

import numpy as np
import tifffile
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/models/geography")
CACHE = sys.argv[1]
GLTF_TRANSFORM = os.environ.get("GLTF_TRANSFORM", "npx --yes @gltf-transform/cli").split()
os.makedirs(CACHE, exist_ok=True)


# ---- Colours ----------------------------------------------------------------------------------------------------

def rgb(hex_):
    """sRGB hex → linear RGB (glTF vertex colours are linear)."""
    c = np.array([int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def mix(a, b, t):
    t = np.asarray(t)[..., None]
    return a * (1 - t) + b * t


def smooth(x, a, b):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---- Noise ------------------------------------------------------------------------------------------------------

_LATTICE = np.random.default_rng(11).random((8, 257, 257))


def noise(x, z, scale, layer=0):
    u, v = np.asarray(x) * scale + 37.1 * layer, np.asarray(z) * scale + 11.3 * layer
    i, j = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = u - i, v - j
    i, j = i % 256, j % 256
    g = _LATTICE[layer % 8]
    s = lambda t: t * t * (3 - 2 * t)
    top = g[j, i] * (1 - s(fu)) + g[j, i + 1] * s(fu)
    bot = g[j + 1, i] * (1 - s(fu)) + g[j + 1, i + 1] * s(fu)
    return (top * (1 - s(fv)) + bot * s(fv)) * 2 - 1


def fbm(x, z, scale, octaves=4, layer=0):
    total, amp, norm = 0.0, 1.0, 0.0
    for k in range(octaves):
        total = total + amp * noise(x, z, scale * 2 ** k, layer + k)
        norm += amp
        amp *= 0.5
    return total / norm


# ---- glTF ---------------------------------------------------------------------------------------------------------

class Model:
    """Named meshes → a .glb (one primitive each)."""

    def __init__(self):
        self.meshes = []

    def add(self, name, pos, idx, col, material=None, normals=None):
        if len(pos) == 0:
            return
        self.meshes.append((name, np.asarray(pos, np.float32), np.asarray(idx, np.uint32).reshape(-1), np.clip(np.asarray(col, np.float32), 0, 1), material or {}, normals))

    def write(self, path):
        blob = bytearray()
        views, accessors, meshes, materials, nodes = [], [], [], [], []

        def push(arr, target, comp, kind, minmax=False):
            while len(blob) % 4:
                blob.append(0)
            views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": arr.nbytes, "target": target})
            blob.extend(arr.tobytes())
            acc = {"bufferView": len(views) - 1, "componentType": comp, "count": len(arr), "type": kind}
            if minmax:
                acc["min"] = arr.min(0).tolist()
                acc["max"] = arr.max(0).tolist()
            accessors.append(acc)
            return len(accessors) - 1

        for name, pos, idx, col, mat, nrm in self.meshes:
            attrs = {"POSITION": push(pos, 34962, 5126, "VEC3", True), "COLOR_0": push(col, 34962, 5126, "VEC3")}
            if nrm is not None:
                attrs["NORMAL"] = push(np.asarray(nrm, np.float32), 34962, 5126, "VEC3")
            ind = push(idx, 34963, 5125, "SCALAR")
            pbr = {"baseColorFactor": mat.get("color", [1, 1, 1, 1]), "metallicFactor": 0, "roughnessFactor": mat.get("rough", 0.92)}
            m = {"name": name, "pbrMetallicRoughness": pbr}
            if mat.get("color", [1, 1, 1, 1])[3] < 1:
                m["alphaMode"] = "BLEND"
            materials.append(m)
            meshes.append({"name": name, "primitives": [{"attributes": attrs, "indices": ind, "material": len(materials) - 1}]})
            nodes.append({"name": name, "mesh": len(meshes) - 1})
        gltf = {
            "asset": {"version": "2.0", "generator": "school-atlas scripts/build-geo-heroes.py"},
            "scene": 0,
            "scenes": [{"nodes": list(range(len(nodes)))}],
            "nodes": nodes,
            "meshes": meshes,
            "materials": materials,
            "buffers": [{"byteLength": len(blob)}],
            "bufferViews": views,
            "accessors": accessors,
        }
        js = json.dumps(gltf, separators=(",", ":")).encode()
        js += b" " * (-len(js) % 4)
        blob.extend(b"\0" * (-len(blob) % 4))
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
            f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
            f.write(struct.pack("<II", len(blob), 0x004E4942) + bytes(blob))


def compress(raw, out):
    subprocess.run([*GLTF_TRANSFORM, "draco", raw, out], check=True, stdout=subprocess.DEVNULL)
    os.remove(raw)
    print(f"  {os.path.relpath(out, ROOT)}  {os.path.getsize(out) // 1024} KB")


# ---- Mesh pieces ------------------------------------------------------------------------------------------------------

def grid_faces(nz, nx):
    r, c = np.meshgrid(np.arange(nz - 1), np.arange(nx - 1), indexing="ij")
    a = (r * nx + c).ravel()
    b, cc, d = a + 1, a + nx, a + nx + 1
    return np.stack([a, cc, b, b, cc, d], 1).reshape(-1, 3)


def heightfield(X, Y, Z, col):
    """Grid surface (rows along +Z) → positions, faces, colours."""
    nz, nx = Y.shape
    return np.stack([X, Y, Z], -1).reshape(-1, 3), grid_faces(nz, nx), col.reshape(-1, 3)


def plinth(X, Y, Z, top, bottom, floor=0.0):
    """Side walls of the block, from the surface edge down to `floor`, earth-coloured with strata."""
    nz, nx = Y.shape
    ring = [(0, c) for c in range(nx)] + [(r, nx - 1) for r in range(1, nz)] + [(nz - 1, c) for c in range(nx - 2, -1, -1)] + [(r, 0) for r in range(nz - 2, 0, -1)]
    ring.append(ring[0])
    pos, col, faces = [], [], []
    ymax = Y.max()
    for k, (r, c) in enumerate(ring):
        x, y, z = X[r, c], Y[r, c], Z[r, c]
        for yy in (y, floor):
            pos.append((x, yy, z))
            t = (yy - floor) / max(1e-6, ymax - floor)
            band = 0.06 * math.sin(yy * 23.0)
            col.append(mix(bottom, top, min(1, t * 1.4 + band)))
        if k:
            a = 2 * (k - 1)
            faces += [(a, a + 1, a + 3), (a, a + 3, a + 2)]
    pos, faces = np.array(pos), np.array(faces)
    # Face outwards: the first wall's normal against the direction away from the middle.
    p0, p1, p2 = pos[faces[0]]
    n = np.cross(p1 - p0, p2 - p0)
    if np.dot(n, p0 - np.array([X.mean(), p0[1], Z.mean()])) < 0:
        faces = faces[:, ::-1]
    return pos, faces, np.array(col)


def icosphere(sub=1):
    t = (1 + 5 ** 0.5) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    v = [np.array(p, float) / np.linalg.norm(p) for p in v]
    for _ in range(sub):
        cache, nf = {}, []

        def mid(a, b):
            key = (min(a, b), max(a, b))
            if key not in cache:
                m = v[a] + v[b]
                v.append(m / np.linalg.norm(m))
                cache[key] = len(v) - 1
            return cache[key]

        for a, b, c in f:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        f = nf
    return np.array(v), np.array(f)


class Parts:
    """Many small objects merged into one mesh."""

    def __init__(self):
        self.pos, self.faces, self.col, self.nrm = [], [], [], []
        self.n = 0

    def put(self, pos, faces, col, nrm=None):
        self.pos.append(pos)
        self.faces.append(faces + self.n)
        self.col.append(np.broadcast_to(col, pos.shape) if np.ndim(col) == 1 else col)
        if nrm is not None:
            self.nrm.append(nrm)
        self.n += len(pos)

    def arrays(self):
        if not self.pos:
            return np.zeros((0, 3)), np.zeros((0, 3), int), np.zeros((0, 3)), None
        return np.concatenate(self.pos), np.concatenate(self.faces), np.concatenate(self.col), (np.concatenate(self.nrm) if self.nrm else None)


def rock(parts, rng, x, y, z, size, colour, sub=1):
    v, f = icosphere(sub)
    v = v * (1 + rng.normal(0, 0.16, (len(v), 1)))
    v = v * np.array([1.0, 0.62, 0.85]) * size
    a = rng.uniform(0, math.tau)
    rot = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    v = v @ rot.T + (x, y + size * 0.25, z)
    shade = colour * rng.uniform(0.82, 1.12)
    parts.put(v, f, np.clip(shade, 0, 1))


def cone(parts, x, y, z, radius, height, colour, seg=7, tip=None):
    ang = np.linspace(0, math.tau, seg, endpoint=False)
    ring = np.stack([x + radius * np.cos(ang), np.full(seg, y), z + radius * np.sin(ang)], 1)
    pos = np.vstack([ring, (x, y + height, z), (x, y, z)])
    faces = [(k, seg, (k + 1) % seg) for k in range(seg)] + [(k, (k + 1) % seg, seg + 1) for k in range(seg)]
    col = np.tile(colour, (seg + 2, 1))
    if tip is not None:
        col[seg] = tip
    parts.put(pos, np.array(faces), col)


def house(parts, x, y, z, w, d, h, angle, wall, roof, sink=0.0):
    """A cottage with a gabled roof; flat-shaded (own vertices and normals per face)."""
    c, s = math.cos(angle), math.sin(angle)
    loc = lambda px, py, pz: (x + px * c - pz * s, y + py - sink, z + px * s + pz * c)
    hw, hd, rh = w / 2, d / 2, h * 0.55
    quads = [
        ([(-hw, 0, hd), (hw, 0, hd), (hw, h, hd), (-hw, h, hd)], wall),
        ([(hw, 0, -hd), (-hw, 0, -hd), (-hw, h, -hd), (hw, h, -hd)], wall),
        ([(hw, 0, hd), (hw, 0, -hd), (hw, h, -hd), (hw, h, hd)], wall),
        ([(-hw, 0, -hd), (-hw, 0, hd), (-hw, h, hd), (-hw, h, -hd)], wall),
        ([(-hw * 1.12, h - 0.02, hd * 1.1), (hw * 1.12, h - 0.02, hd * 1.1), (hw * 1.12, h + rh, 0), (-hw * 1.12, h + rh, 0)], roof),
        ([(hw * 1.12, h - 0.02, -hd * 1.1), (-hw * 1.12, h - 0.02, -hd * 1.1), (-hw * 1.12, h + rh, 0), (hw * 1.12, h + rh, 0)], roof),
    ]
    tris = [([(hw, h, hd), (hw, h, -hd), (hw, h + rh, 0)], wall), ([(-hw, h, -hd), (-hw, h, hd), (-hw, h + rh, 0)], wall)]
    pos, faces, col, nrm = [], [], [], []
    for pts, colour in quads + tris:
        p = np.array([loc(*q) for q in pts])
        n = np.cross(p[1] - p[0], p[2] - p[0])
        n /= np.linalg.norm(n)
        base = len(pos)
        pos += list(p)
        col += [colour] * len(p)
        nrm += [n] * len(p)
        faces += [(base, base + 1, base + 2)] + ([(base, base + 2, base + 3)] if len(p) == 4 else [])
    parts.put(np.array(pos), np.array(faces), np.array(col), np.array(nrm))


# ---- Copernicus DEM ---------------------------------------------------------------------------------------------------

def fetch_dem(name, bucket):
    path = os.path.join(CACHE, name + ".tif")
    if not os.path.exists(path):
        url = f"https://{bucket}.s3.amazonaws.com/{name}/{name}.tif"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "school-atlas/1.0"}), timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def read_dem(path):
    """Copernicus COG: float32 tiles, DEFLATE with the floating-point predictor (decoded here, no imagecodecs)."""
    with tifffile.TiffFile(path) as tf:
        pg = tf.pages[0]
        height, width = pg.shape
        tw, th = pg.tilewidth, pg.tilelength
        across = (width + tw - 1) // tw
        out = np.zeros((height, width), np.float32)
        fh = tf.filehandle
        for i, (offset, count) in enumerate(zip(pg.dataoffsets, pg.databytecounts)):
            fh.seek(offset)
            b = np.frombuffer(zlib.decompress(fh.read(count)), np.uint8).reshape(th, 4 * tw)
            b = np.cumsum(b, axis=1, dtype=np.uint8)  # undo the byte differencing (wraps mod 256)
            vals = np.ascontiguousarray(b.reshape(th, 4, tw).transpose(0, 2, 1)).view(">f4").reshape(th, tw)
            ty, tx = divmod(i, across)
            y0, x0 = ty * th, tx * tw
            out[y0:y0 + th, x0:x0 + tw] = vals[: min(th, height - y0), : min(tw, width - x0)]
        tie = pg.tags["ModelTiepointTag"].value
        scale = pg.tags["ModelPixelScaleTag"].value
    return out, tie[3], tie[4], scale[0], scale[1]


def sample(dem, lon, lat):
    data, lon0, lat0, dx, dy = dem
    px = (lon - lon0) / dx - 0.5
    py = (lat0 - lat) / dy - 0.5
    return ndimage.map_coordinates(data, [py, px], order=1, mode="nearest")


def relief(dem, lon0, lon1, lat0, lat1, cell, exaggerate):
    """Heights (m) on a metric grid over the window; returns X, Z (km), H (m), slope (degrees)."""
    latc, lonc = (lat0 + lat1) / 2, (lon0 + lon1) / 2
    kx, kz = 111.32 * math.cos(math.radians(latc)), 110.57
    w, h = (lon1 - lon0) * kx, (lat1 - lat0) * kz
    nx, nz = int(round(w / cell)) + 1, int(round(h / cell)) + 1
    xs = np.linspace(-w / 2, w / 2, nx)
    zs = np.linspace(-h / 2, h / 2, nz)
    X, Z = np.meshgrid(xs, zs)
    H = sample(dem, lonc + X / kx, latc - Z / kz)
    gz, gx = np.gradient(H, zs[1] - zs[0], xs[1] - xs[0])
    slope = np.degrees(np.arctan(np.hypot(gx, gz) / 1000))
    return X, Z, H, slope, (lonc, latc, kx, kz)


def lakes(dem, X, Z, H, frame, max_level):
    """Lakes: the DEM's water surfaces are perfectly flat; keep flat patches bigger than ~0.3 km²."""
    data, lon0, lat0, dx, dy = dem
    flat = (ndimage.maximum_filter(data, 3) - ndimage.minimum_filter(data, 3)) < 0.3
    lab, n = ndimage.label(flat)
    sizes = ndimage.sum(flat, lab, range(1, n + 1))
    cell_km2 = (dx * 111.32 * 0.75) * (dy * 110.57)
    keep = np.zeros(n + 1, bool)
    keep[1:] = (sizes * cell_km2 > 0.3)
    lvl = ndimage.mean(data, lab, range(1, n + 1))
    keep[1:] &= lvl < max_level
    water = keep[lab]
    lonc, latc, kx, kz = frame
    px = (lonc + X / kx - lon0) / dx - 0.5
    py = (lat0 - (latc - Z / kz)) / dy - 0.5
    return ndimage.map_coordinates(water.astype(np.float32), [py, px], order=1, mode="nearest") > 0.5


def relief_model(X, Z, H, slope, colours, exaggerate, water=None):
    model = Model()
    base = 0.35
    Y = (H - H.min()) / 1000 * exaggerate + base
    pos, faces, col = heightfield(X, Y, Z, colours)
    model.add("terrain", pos, faces, col)
    wp, wf, wc = plinth(X, Y, Z, rgb("#80664d"), rgb("#4a3a2c"))
    model.add("plinth", wp, wf, wc)
    if water is not None and water.any():
        # Water: the lake cells, a hair above the ground.
        nz, nx = Y.shape
        f = grid_faces(nz, nx)
        wmask = water.reshape(-1)
        f = f[wmask[f].all(1)]
        used = np.unique(f)
        remap = -np.ones(len(wmask), int)
        remap[used] = np.arange(len(used))
        p = pos[used].copy()
        p[:, 1] += 0.004
        model.add("water", p, remap[f], np.tile(rgb("#3d6f99"), (len(used), 1)), {"rough": 0.25})
    return model


def kazbegi_colours(X, Z, H, slope):
    n1 = fbm(X, Z, 0.9, 4, 1)
    n2 = fbm(X, Z, 3.0, 3, 3)
    h = H + n1 * 90
    meadow, alpine, dry = rgb("#5f8240"), rgb("#7d8e4c"), rgb("#958d62")
    forest, rock, scree = rgb("#3f5e2f"), rgb("#7a7066"), rgb("#958b80")
    snow, ice = rgb("#f1f5f8"), rgb("#d9e6f0")
    c = mix(meadow, alpine, smooth(h, 2000, 2500))
    c = mix(c, dry, smooth(h, 2500, 2950))
    c = mix(c, scree, smooth(h, 2900, 3250))
    # Birch groves on the valley sides.
    c = mix(c, forest, smooth(n2, 0.05, 0.35) * smooth(slope, 12, 22) * (1 - smooth(h, 2250, 2450)) * smooth(h, 1750, 1850))
    c = mix(c, rock, smooth(slope, 33, 45) * smooth(h, 1900, 2200))
    snowy = smooth(h, 3250, 3600) * (1 - smooth(slope, 38, 52)) + smooth(h, 4300, 4600) * 0.85
    c = mix(c, mix(snow, ice, smooth(n2, -0.2, 0.4) * (1 - smooth(h, 3900, 4300))), np.clip(snowy, 0, 1))
    return c * (0.93 + 0.07 * n2[..., None])


def javakheti_colours(X, Z, H, slope):
    n1 = fbm(X, Z, 0.5, 4, 2)
    n2 = fbm(X, Z, 2.2, 3, 5)
    h = H + n1 * 70
    steppe, grass, alpine = rgb("#a2a565"), rgb("#7f9653"), rgb("#8e8c62")
    field, basalt, snow = rgb("#b4a46e"), rgb("#625a53"), rgb("#eef2f5")
    c = mix(steppe, grass, smooth(h, 2150, 2450))
    # Potato and hay fields on the plateau floor.
    c = mix(c, field, smooth(noise(X, Z, 1.6, 6), 0.2, 0.45) * (1 - smooth(slope, 3, 7)) * (1 - smooth(h, 2150, 2250)))
    c = mix(c, alpine, smooth(h, 2550, 2850))
    c = mix(c, basalt, np.clip(smooth(h, 2750, 3050) * 0.8 + smooth(slope, 24, 36) * smooth(h, 2200, 2500), 0, 1))
    c = mix(c, snow, smooth(h, 3120, 3260) * (1 - smooth(slope, 30, 42)))
    return c * (0.92 + 0.08 * n2[..., None])


def build_reliefs():
    kaz = read_dem(fetch_dem("Copernicus_DSM_COG_10_N42_00_E044_00_DEM", "copernicus-dem-30m"))
    jav = read_dem(fetch_dem("Copernicus_DSM_COG_30_N41_00_E043_00_DEM", "copernicus-dem-90m"))
    print("Kazbegi DEM max", float(kaz[0].max()), "· Javakheti DEM max", float(jav[0].max()))
    os.makedirs(os.path.join(OUT, "volcanoes"), exist_ok=True)
    for lod, (kc, jc) in enumerate([(0.09, 0.14), (0.18, 0.28)]):
        X, Z, H, s, _ = relief(kaz, 44.43, 44.68, 42.62, 42.78, kc, 1.5)
        m = relief_model(X, Z, H, s, kazbegi_colours(X, Z, H, s), 1.5)
        print(f"kazbegi lod{lod}: grid {H.shape}, {H.min():.0f}–{H.max():.0f} m")
        raw = os.path.join(CACHE, "kazbegi.raw.glb")
        m.write(raw)
        compress(raw, os.path.join(OUT, "volcanoes", "kazbegi-relief" + ("-lod1" if lod else "") + ".glb"))

        X, Z, H, s, frame = relief(jav, 43.58, 43.86, 41.36, 41.62, jc, 2.0)
        water = lakes(jav, X, Z, H, frame, 2300)
        m = relief_model(X, Z, H, s, javakheti_colours(X, Z, H, s), 2.0, water)
        print(f"javakheti lod{lod}: grid {H.shape}, {H.min():.0f}–{H.max():.0f} m, lake cells {int(water.sum())}")
        raw = os.path.join(CACHE, "javakheti.raw.glb")
        m.write(raw)
        compress(raw, os.path.join(OUT, "volcanoes", "javakheti-relief" + ("-lod1" if lod else "") + ".glb"))


# ---- Made-up slopes ------------------------------------------------------------------------------------------------------
# A block 12 × 14 hectometres: mountains at the back (−Z), the valley floor at the front (+Z).

def slope_grid(n):
    xs = np.linspace(-6, 6, n)
    zs = np.linspace(-7, 7, int(n * 14 / 12))
    return np.meshgrid(xs, zs)


def mudflow(n, lod):
    rng = np.random.default_rng(3)
    X, Z = slope_grid(n)
    back = smooth(Z, 3.4, -6.8) ** 1.25
    H = 0.6 + 6.4 * back + 0.9 * back * fbm(X, Z, 0.35, 4, 1) + 0.12 * fbm(X, Z, 1.5, 3, 4)
    # Spurs either side of the gully, and the gully itself: a bowl at the top, a gorge, open at the bottom.
    H += 1.1 * smooth(np.abs(X), 1.2, 3.6) * smooth(Z, 3.2, 0.5)
    width = 0.75 + 2.4 * smooth(Z, -1.0, -6.0)
    depth = 1.7 * smooth(Z, 3.2, 1.0) * (0.75 + 0.25 * smooth(Z, -6.5, -3.0))
    gully = np.exp(-((X + 0.35 * np.sin(Z * 0.7)) / width) ** 2)
    H -= depth * gully
    # The fan below the gorge mouth.
    r = np.hypot(X, Z - 2.4)
    fan = np.clip(1 - r / 4.8, 0, 1) ** 1.4 * smooth(Z, 1.6, 2.8)
    H += 0.95 * fan
    # A river along the valley.
    river_z = 5.7 + 0.25 * np.sin(X * 0.6)
    H -= 0.32 * np.exp(-((Z - river_z) / 0.32) ** 2)
    # The mud: down the gully bed, then a lobed sheet over the fan.
    lobes = 0.5 + 0.5 * fbm(X, Z, 0.9, 3, 7)
    channel = np.exp(-((X + 0.35 * np.sin(Z * 0.7)) / (0.42 * width)) ** 2) * smooth(Z, -5.2, -3.8) * (1 - smooth(Z, 2.4, 3.0))
    sheet = smooth(3.9 * (0.75 + 0.5 * lobes) - r, 0, 0.6) * smooth(Z, 2.0, 2.8) * (np.abs(np.arctan2(X, Z - 2.4)) < 1.15)
    mud = np.clip(np.maximum(channel, sheet), 0, 1)
    H += 0.14 * mud

    g = np.gradient(H, X[0, 1] - X[0, 0])
    slope = np.degrees(np.arctan(np.hypot(*g) / 1.0))
    n2 = fbm(X, Z, 1.8, 3, 9)
    grass, forest, stone, snow = rgb("#6a8b45"), rgb("#3f5f30"), rgb("#7b7168"), rgb("#eef2f5")
    wet, dry = rgb("#4f3a28"), rgb("#7a5b3d")
    c = mix(grass, forest, smooth(fbm(X, Z, 0.8, 3, 12), -0.15, 0.2) * smooth(H, 1.4, 2.2) * (1 - smooth(H, 4.8, 5.6)))
    c = mix(c, stone, np.clip(smooth(H, 5.3, 6.3) + smooth(slope, 42, 56), 0, 1))
    c = mix(c, snow, smooth(H, 6.6, 7.1) * (1 - smooth(slope, 40, 55)))
    road = np.exp(-((Z - (4.6 + 0.15 * np.sin(X * 0.9))) / 0.09) ** 2) * (1 - smooth(Z, 5.2, 5.4))
    c = mix(c, rgb("#a39783"), road * 0.85)
    c = mix(c, mix(dry, wet, smooth(mud, 0.45, 1.0) * (0.75 + 0.25 * n2)), smooth(mud, 0.05, 0.45))
    c = c * (0.93 + 0.07 * n2[..., None])
    Y = H
    model = Model()
    p, f, cc = heightfield(X, Y, Z, c)
    model.add("terrain", p, f, cc)
    wp, wf, wc = plinth(X, Y, Z, rgb("#80664d"), rgb("#4a3a2c"), floor=-0.6)
    model.add("plinth", wp, wf, wc)
    # The river's water, held back where the fan has pushed into it.
    wx = np.linspace(-6, 6, 60)
    rz = 5.7 + 0.25 * np.sin(wx * 0.6)
    level = 0.41
    wpos, wfac = [], []
    for k, (x, z) in enumerate(zip(wx, rz)):
        wpos += [(x, level, z - 0.28), (x, level, z + 0.28)]
        if k:
            a = 2 * (k - 1)
            wfac += [(a, a + 1, a + 2), (a + 2, a + 1, a + 3)]
    model.add("water", np.array(wpos), np.array(wfac), np.tile(rgb("#6c8a8f"), (len(wpos), 1)), {"rough": 0.3})

    def ground(x, z):
        return float(ndimage.map_coordinates(H, [[(z + 7) / 14 * (H.shape[0] - 1)], [(x + 6) / 12 * (H.shape[1] - 1)]], order=1)[0])

    # Boulders carried by the flow: big ones at the front of the lobe, smaller up the channel.
    rocks = Parts()
    count = 150 if lod == 0 else 60
    tries = 0
    while count and tries < 20000:
        tries += 1
        x, z = rng.uniform(-5, 5), rng.uniform(-5, 6)
        rr = math.hypot(x, z - 2.4)
        m = float(ndimage.map_coordinates(mud, [[(z + 7) / 14 * (mud.shape[0] - 1)], [(x + 6) / 12 * (mud.shape[1] - 1)]], order=1)[0])
        if rng.random() > m * 0.9:
            continue
        size = rng.uniform(0.05, 0.12) + (0.18 * rng.random() if rr > 2.2 else 0.0)
        rock(rocks, rng, x, ground(x, z) - size * 0.35, z, size, rgb("#6f665d"), 1 if lod == 0 else 0)
        count -= 1
    p, f, cc, _ = rocks.arrays()
    model.add("boulders", p, f, cc)

    # The village at the edge of the fan; one house is half buried.
    homes = Parts()
    for x, z, a, sink in [(-3.7, 4.2, 0.3, 0), (-4.6, 3.3, 0.1, 0), (3.6, 3.9, -0.4, 0), (4.4, 4.9, -0.2, 0), (1.5, 4.6, 0.15, 0.12), (-2.4, 5.0, 0.05, 0)]:
        house(homes, x, ground(x, z), z, 0.42, 0.32, 0.22, a, rgb("#d9cfbf"), rgb("#9b4a31"), sink)
    p, f, cc, nn = homes.arrays()
    model.add("houses", p, f, cc, normals=nn)

    # Trees on the slopes and by the river.
    trees = Parts()
    for _ in range(260 if lod == 0 else 110):
        x, z = rng.uniform(-5.8, 5.8), rng.uniform(-6.5, 6.5)
        hh = ground(x, z)
        m = float(ndimage.map_coordinates(mud, [[(z + 7) / 14 * (mud.shape[0] - 1)], [(x + 6) / 12 * (mud.shape[1] - 1)]], order=1)[0])
        if m > 0.05 or hh > 4.8 or abs(z - 5.7) < 0.45 or abs(z - 4.6) < 0.18:
            continue
        s = rng.uniform(0.7, 1.2)
        cone(trees, x, hh - 0.02, z, 0.12 * s, 0.42 * s, rgb("#31502a") * rng.uniform(0.85, 1.1), 6)
    p, f, cc, _ = trees.arrays()
    model.add("trees", p, f, cc)
    return model


def avalanche(n, lod):
    rng = np.random.default_rng(5)
    X, Z = slope_grid(n)
    back = smooth(Z, 4.2, -6.8) ** 1.15
    H = 0.5 + 7.6 * back + 0.8 * back * fbm(X, Z, 0.4, 4, 2) + 0.1 * fbm(X, Z, 1.6, 3, 6)
    # The ridge with a summit, and the avalanche path: a bowl under it, a gully down through the forest.
    H += 0.9 * np.exp(-((X - 0.6) / 2.6) ** 2) * smooth(Z, -4.0, -6.5)
    path_x = 0.5 + 0.4 * np.sin(Z * 0.45)
    width = 0.9 + 1.6 * smooth(Z, -2.0, -5.0)
    H -= 0.75 * np.exp(-((X - path_x) / width) ** 2) * smooth(Z, 3.4, 1.0)
    # The deposit at the foot of the slope; a crown (the slab's broken top edge) in the release zone.
    r = np.hypot((X - 0.8) / 1.35, (Z - 3.6) / 1.0)
    deposit = np.clip(1 - r / 1.6, 0, 1)
    lumpy = 0.5 + 0.5 * noise(X, Z, 6.0, 3)
    H += deposit * (0.45 + 0.18 * lumpy)
    crown_z = -4.55 + 0.25 * np.cos((X - path_x) * 1.3)
    in_zone = np.exp(-((X - path_x) / 1.9) ** 4)
    released = in_zone * smooth(Z, crown_z - 0.02, crown_z + 0.06) * (1 - smooth(Z, -1.5, -0.8))
    H -= 0.09 * released
    # The flowing snow in the gully.
    flow = np.exp(-((X - path_x) / (0.55 * width)) ** 2) * smooth(Z, -3.0, -1.5) * (1 - smooth(Z, 2.4, 3.2))
    H += 0.12 * flow * (0.7 + 0.3 * noise(X, Z, 5.0, 4))

    g = np.gradient(H, X[0, 1] - X[0, 0])
    slope = np.degrees(np.arctan(np.hypot(*g)))
    n2 = fbm(X, Z, 2.0, 3, 8)
    snow, bed, stone = rgb("#f3f6f9"), rgb("#c9d6e2"), rgb("#5d5855")
    debris = rgb("#dfe5ea")
    c = np.broadcast_to(snow, H.shape + (3,)).copy()
    c = mix(c, stone, smooth(slope, 44, 56))
    c = mix(c, bed, released * 0.9)
    c = mix(c, debris, np.clip(np.maximum(deposit * 1.6, flow) * (0.6 + 0.4 * lumpy), 0, 1) * 0.8)
    road = np.exp(-((Z - (5.2 + 0.2 * np.sin(X * 0.5))) / 0.1) ** 2)
    c = mix(c, rgb("#8d8a86"), road * (1 - smooth(deposit, 0.0, 0.3)) * 0.8)
    c = c * (0.95 + 0.05 * n2[..., None])
    model = Model()
    p, f, cc = heightfield(X, H, Z, c)
    model.add("terrain", p, f, cc)
    wp, wf, wc = plinth(X, H, Z, rgb("#80664d"), rgb("#4a3a2c"), floor=-0.6)
    model.add("plinth", wp, wf, wc)

    def at(arr, x, z):
        return float(ndimage.map_coordinates(arr, [[(z + 7) / 14 * (arr.shape[0] - 1)], [(x + 6) / 12 * (arr.shape[1] - 1)]], order=1)[0])

    # Snow blocks in the deposit and the gully.
    blocks = Parts()
    count = 170 if lod == 0 else 70
    tries = 0
    while count and tries < 20000:
        tries += 1
        x, z = rng.uniform(-3, 4), rng.uniform(-3, 5.2)
        m = max(at(deposit, x, z) * 1.5, at(flow, x, z) * 0.6)
        if rng.random() > m:
            continue
        size = rng.uniform(0.05, 0.16)
        rock(blocks, rng, x, at(H, x, z) - size * 0.3, z, size, rgb("#e9eef2"), 1 if lod == 0 else 0)
        count -= 1
    p, f, cc, _ = blocks.arrays()
    model.add("snow_blocks", p, f, cc)

    # Forest either side of the path; snow on the tree tops. Broken trees are left in the deposit.
    trees = Parts()
    for _ in range(420 if lod == 0 else 160):
        x, z = rng.uniform(-5.8, 5.8), rng.uniform(-3.4, 6.6)
        hh = at(H, x, z)
        px = 0.5 + 0.4 * math.sin(z * 0.45)
        clear = 1.15 + 0.9 * smooth(-z, 2.0, 5.0)
        if abs(x - px) < clear * (1 if z < 2.4 else 0) or at(deposit, x, z) > 0.02 or abs(z - 5.2) < 0.25 or hh > 6.2:
            continue
        s = rng.uniform(0.7, 1.25)
        cone(trees, x, hh - 0.02, z, 0.13 * s, 0.5 * s, rgb("#24402b") * rng.uniform(0.85, 1.1), 6, tip=rgb("#e8eef3"))
    for _ in range(14):
        x, z = 0.8 + rng.normal(0, 0.6), 3.6 + rng.normal(0, 0.35)
        a = rng.uniform(0, math.tau)
        lo = np.array([x, at(H, x, z) + 0.04, z])
        d = np.array([math.cos(a), 0.05, math.sin(a)]) * 0.45
        v = np.array([lo - [0.02, 0, 0], lo + [0.02, 0, 0], lo + d + [0.02, 0, 0], lo + d - [0.02, 0, 0], lo + [0, 0.035, 0], lo + d + [0, 0.035, 0]])
        trees.put(v, np.array([(0, 1, 2), (0, 2, 3), (0, 4, 5), (0, 5, 3), (1, 2, 5), (1, 5, 4)]), rgb("#4b3a2c"))
    p, f, cc, _ = trees.arrays()
    model.add("trees", p, f, cc)

    # A hut by the road, just clear of the deposit.
    hut = Parts()
    for x, z, a in [(3.4, 4.6, -0.3), (-2.6, 5.7, 0.2)]:
        house(hut, x, at(H, x, z), z, 0.42, 0.32, 0.22, a, rgb("#cfc4b4"), rgb("#6f4b37"))
    p, f, cc, nn = hut.arrays()
    model.add("houses", p, f, cc, normals=nn)

    # The powder cloud billowing over the lower track.
    powder = Parts()
    for k in range(16 if lod == 0 else 8):
        t = rng.random()
        z = -0.8 + 3.2 * t
        x = 0.5 + 0.4 * math.sin(z * 0.45) + rng.normal(0, 0.45 + 0.3 * t)
        s = (0.3 + 0.45 * t) * rng.uniform(0.7, 1.2)
        v, f = icosphere(2 if lod == 0 else 1)
        v = v * (1 + rng.normal(0, 0.06, (len(v), 1)))
        v = v * s * np.array([1.3, 0.75, 1.15]) + (x, at(H, x, z) + s * 0.4 + 0.15 * t, z)
        powder.put(v, f, rgb("#ffffff"))
    p, f, cc, _ = powder.arrays()
    model.add("powder", p, f, cc, {"color": [1, 1, 1, 0.55], "rough": 1})
    return model


def build_slopes():
    os.makedirs(os.path.join(OUT, "hazards"), exist_ok=True)
    for name, make in [("mudflow", mudflow), ("avalanche", avalanche)]:
        for lod, n in enumerate([200, 100]):
            m = make(n, lod)
            raw = os.path.join(CACHE, f"{name}.raw.glb")
            m.write(raw)
            compress(raw, os.path.join(OUT, "hazards", name + ("-lod1" if lod else "") + ".glb"))


if __name__ == "__main__":
    only = sys.argv[2] if len(sys.argv) > 2 else ""
    if only != "slopes":
        build_reliefs()
    if only != "reliefs":
        build_slopes()
