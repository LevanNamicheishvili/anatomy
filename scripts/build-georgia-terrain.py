"""
Elevation and region grid for the 3D Georgia map (run: python3 scripts/build-georgia-terrain.py <tile dir>).

Elevation: AWS Terrain Tiles (terrarium encoding; get them with scripts/download-terrain-tiles.mjs,
zoom 10), resampled onto a regular longitude/latitude grid. Regions: geoBoundaries ADM1 polygons
rasterised onto the same grid (0 = outside Georgia).

Writes public/geo/georgia-terrain.bin.gz:
  - detail heights, (2W-1)×(2H-1) Int16 metres, each row delta-encoded (first value, then differences);
  - region index per cell of the W×H mesh grid (Uint8; grid point (i, j) = detail point (2i, 2j));
public/geo/georgia-terrain.json (sizes, bounds, region order) and public/geo/georgia-lines.json
(region borders, named rivers traced along the terrain's flow paths, smaller rivers).
Optional second argument: a PNG path for a debug picture of the rivers.
"""
import gzip, json, math, os, struct, sys
from PIL import Image, ImageDraw

TILES = sys.argv[1]
Z = int(next(f for f in os.listdir(TILES) if f.endswith(".png")).split("_")[0])
LON0, LON1 = 39.9, 46.8
LAT0, LAT1 = 43.7, 40.95  # north to south
W, H = 1024, 550
DW, DH = 2 * W - 1, 2 * H - 1

# Stitch the tiles.
names = [f for f in os.listdir(TILES) if f.endswith(".png")]
xs = sorted({int(f.split("_")[1]) for f in names})
ys = sorted({int(f.split("_")[2].split(".")[0]) for f in names})
mosaic = Image.new("RGB", (len(xs) * 256, len(ys) * 256))
for x in xs:
    for y in ys:
        mosaic.paste(Image.open(os.path.join(TILES, f"{Z}_{x}_{y}.png")).convert("RGB"), ((x - xs[0]) * 256, (y - ys[0]) * 256))
px = mosaic.load()

def elev(ix, iy):
    r, g, b = px[min(max(ix, 0), mosaic.width - 1), min(max(iy, 0), mosaic.height - 1)]
    return r * 256 + g + b / 256 - 32768

def sample(lon, lat):
    n = 2 ** Z * 256
    gx = (lon + 180) / 360 * n - xs[0] * 256
    gy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n - ys[0] * 256
    x0, y0 = int(gx), int(gy)
    fx, fy = gx - x0, gy - y0
    a = elev(x0, y0) * (1 - fx) + elev(x0 + 1, y0) * fx
    b = elev(x0, y0 + 1) * (1 - fx) + elev(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + b * fy

detail = []
for j in range(DH):
    lat = LAT0 + (LAT1 - LAT0) * j / (DH - 1)
    for i in range(DW):
        lon = LON0 + (LON1 - LON0) * i / (DW - 1)
        detail.append(int(round(max(-500, min(6000, sample(lon, lat))))))
heights = [detail[(2 * j) * DW + 2 * i] for j in range(H) for i in range(W)]

# Regions.
geo = json.load(open("scripts/data/georgia-adm1.geojson"))
ORDER = ["abkhazia", "samegrelo-zemo-svaneti", "guria", "adjara", "imereti", "racha-lechkhumi",
         "samtskhe-javakheti", "shida-kartli", "mtskheta-mtianeti", "kvemo-kartli", "kakheti", "tbilisi"]
IDS = {"Abkhazia": "abkhazia", "Kakheti": "kakheti", "Kvemo Kartli": "kvemo-kartli", "Tbilisi": "tbilisi",
       "Mtskheta-Mtianeti": "mtskheta-mtianeti", "Samtskhe–Javakheti": "samtskhe-javakheti", "Adjara": "adjara",
       "Guria": "guria", "Shida Kartli": "shida-kartli", "Imereti": "imereti",
       "Racha-Lechkhumi and Kvemo Svaneti": "racha-lechkhumi", "Samegrelo-Zemo Svaneti": "samegrelo-zemo-svaneti"}
mask = Image.new("L", (W, H), 0)
draw = ImageDraw.Draw(mask)
to_px = lambda lon, lat: ((lon - LON0) / (LON1 - LON0) * (W - 1), (lat - LAT0) / (LAT1 - LAT0) * (H - 1))
# Tbilisi last, so it is drawn on top of the regions around it.
features = sorted(geo["features"], key=lambda f: IDS[f["properties"]["shapeName"]] == "tbilisi")
for f in features:
    idx = ORDER.index(IDS[f["properties"]["shapeName"]]) + 1
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for poly in polys:
        draw.polygon([to_px(lon, lat) for lon, lat in poly[0]], fill=idx)
regions = list(mask.getdata())

# ---- Rivers from the terrain (how water would flow) ---------------------------------------------
# Priority-flood fills the pits, every cell drains to its lowest neighbour, and cells collecting the
# water of a large enough area become rivers.
import heapq
N = W * H
filled = list(heights)
done = bytearray(N)
pq = []
for j in range(H):
    for i in range(W):
        if i in (0, W - 1) or j in (0, H - 1):
            k = j * W + i
            heapq.heappush(pq, (filled[k], k))
            done[k] = 1
NB = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
order = []
while pq:
    h, k = heapq.heappop(pq)
    order.append(k)
    i, j = k % W, k // W
    for di, dj in NB:
        ni, nj = i + di, j + dj
        if 0 <= ni < W and 0 <= nj < H:
            n = nj * W + ni
            if not done[n]:
                done[n] = 1
                filled[n] = max(filled[n], h + 0.01)
                heapq.heappush(pq, (filled[n], n))
down = [-1] * N
for k in range(N):
    i, j = k % W, k // W
    best, bh = -1, filled[k]
    for di, dj in NB:
        ni, nj = i + di, j + dj
        if 0 <= ni < W and 0 <= nj < H:
            n = nj * W + ni
            d = (filled[k] - filled[n]) / (1.414 if di and dj else 1)
            if filled[n] < bh and (best < 0 or d > bdrop):
                best, bdrop = n, d
    down[k] = best
acc = [1] * N
for k in reversed(order):  # highest first
    if down[k] >= 0:
        acc[down[k]] += acc[k]
def lonlat(q):
    return (LON0 + (LON1 - LON0) * (q % W) / (W - 1), LAT0 + (LAT1 - LAT0) * (q // W) / (H - 1))

def cell(lon, lat):
    return round((lat - LAT0) / (LAT1 - LAT0) * (H - 1)) * W + round((lon - LON0) / (LON1 - LON0) * (W - 1))

def neighbours(k):
    i, j = k % W, k // W
    for di, dj in NB:
        ni, nj = i + di, j + dj
        if 0 <= ni < W and 0 <= nj < H:
            yield nj * W + ni

def smooth(cells):
    """Grid steps → natural curve (Chaikin, ends kept), as [lon, lat, catchment cells]."""
    pts = [[*lonlat(q), acc[q]] for q in cells]
    for _ in range(3):
        sm = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            sm.append([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2]])
            sm.append([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, b[2]])
        sm.append(pts[-1])
        pts = sm
    return [[round(x, 4), round(y, 4), a] for x, y, a in pts[::2]]

# ---- Named rivers ----------------------------------------------------------------------------------
# Each river is given by one point on its course. The point snaps to the cell with the largest
# catchment nearby that no bigger river has taken yet; from there the river is followed upstream (always
# the branch with the larger catchment) to its source, and downstream to the sea, the grid edge or the
# river it flows into. Bigger rivers go first, so tributaries end exactly where they join.
NAMED = [
    ("mtkvari", 44.80, 41.70, 0.05), ("rioni", 42.70, 42.27, 0.05), ("alazani", 45.60, 41.90, 0.09),
    ("iori", 45.80, 41.30, 0.12), ("enguri", 42.05, 42.72, 0.05), ("chorokhi", 41.75, 41.55, 0.05),
    ("tergi", 44.63, 42.66, 0.05), ("kodori", 41.35, 42.92, 0.06), ("bzipi", 40.40, 43.21, 0.06),
    ("khrami", 44.95, 41.33, 0.05), ("aragvi", 44.75, 42.05, 0.05), ("tskhenistskali", 42.77, 42.65, 0.05),
    ("kvirila", 43.05, 42.11, 0.04), ("liakhvi", 43.97, 42.22, 0.05), ("ksani", 44.47, 42.10, 0.05),
    ("supsa", 41.85, 42.02, 0.04), ("adjaristskali", 41.94, 41.60, 0.04), ("paravani", 43.45, 41.48, 0.04),
]
claimed = bytearray(N)
named = {}
for rid, lon, lat, r in NAMED:
    c0 = cell(lon, lat)
    rad = int(r / ((LON1 - LON0) / (W - 1)))
    best = -1
    for dj in range(-rad, rad + 1):
        for di in range(-rad, rad + 1):
            q = c0 + dj * W + di
            if 0 <= q < N and not claimed[q] and (best < 0 or acc[q] > acc[best]):
                best = q
    up, c = [], best
    while True:
        cands = [n for n in neighbours(c) if down[n] == c and not claimed[n]]
        if not cands:
            break
        n = max(cands, key=lambda x: acc[x])
        if acc[n] < 40:
            break
        up.append(n)
        c = n
    dn, c = [], down[best]
    while c >= 0:
        dn.append(c)
        if claimed[c] or (heights[c] <= 0 and not regions[c]):
            break
        c = down[c]
    path = list(reversed(up)) + [best] + dn
    for q in path[:-1]:
        claimed[q] = 1
    named[rid] = smooth(path)
    print(f"  {rid}: {len(path)} cells, catchment {acc[best] * 0.3:.0f} km² at anchor")

# ---- Smaller rivers -------------------------------------------------------------------------------
THRESHOLD = 700  # cells (~200 km² of catchment)
river = [acc[k] >= THRESHOLD and heights[k] > 0 and not claimed[k] for k in range(N)]
near = lambda k: any(regions[(k // W + dj) * W + (k % W + di)] for di in (-4, 0, 4) for dj in (-4, 0, 4)
                     if 0 <= k % W + di < W and 0 <= k // W + dj < H)
inflow = bytearray(N)
for k in range(N):
    if river[k] and down[k] >= 0:
        inflow[down[k]] = 1
seen = bytearray(N)
lines = []
for k in range(N):
    if not river[k] or inflow[k]:
        continue
    line, c = [], k
    while c >= 0:
        line.append(c)
        if not river[c] or seen[c]:
            break  # reached a named river (or one already drawn): end at the junction
        seen[c] = 1
        c = down[c]
    if len(line) > 5 and sum(1 for x in line if regions[x]) > len(line) // 2:
        lines.append(smooth(line))
print(f"rivers: {len(named)} named, {len(lines)} smaller")

if len(sys.argv) > 2:
    # Debug picture: shaded relief, named rivers in colour with their names, smaller rivers in grey.
    shade = Image.new("RGB", (W, H))
    sp = shade.load()
    for j in range(1, H - 1):
        for i in range(1, W - 1):
            k = j * W + i
            d = (heights[k - W - 1] - heights[k + W + 1]) / 60
            v = int(max(0, min(255, 170 + d * 40)))
            sp[i, j] = (v, v, v) if regions[k] else (v // 2 + 100, v // 2 + 100, v // 2 + 120)
    dr = ImageDraw.Draw(shade)
    to_xy = lambda p: ((p[0] - LON0) / (LON1 - LON0) * (W - 1), (p[1] - LAT0) / (LAT1 - LAT0) * (H - 1))
    for l in lines:
        dr.line([to_xy(p) for p in l], fill=(120, 150, 200), width=1)
    for n, (rid, pts) in enumerate(named.items()):
        col = [(220, 30, 40), (30, 90, 220), (20, 150, 60), (200, 120, 0), (150, 0, 180), (0, 150, 160)][n % 6]
        dr.line([to_xy(p) for p in pts], fill=col, width=2)
        dr.text(to_xy(pts[len(pts) // 2]), rid, fill=col)
    shade.save(sys.argv[2])

os.makedirs("public/geo", exist_ok=True)
borders = {}
for f in geo["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    borders[IDS[f["properties"]["shapeName"]]] = [[[round(x, 4), round(y, 4)] for x, y in poly[0]] for poly in polys]
json.dump({"borders": borders, "named": named, "rivers": lines}, open("public/geo/georgia-lines.json", "w"), separators=(",", ":"))
coded = []
for j in range(DH):
    row = detail[j * DW:(j + 1) * DW]
    coded.append(row[0])
    coded.extend(b - a for a, b in zip(row, row[1:]))
raw = struct.pack(f"<{DW * DH}h", *coded) + bytes(regions)
with gzip.open("public/geo/georgia-terrain.bin.gz", "wb", 9) as fh:
    fh.write(raw)
json.dump({"width": W, "height": H, "detail": [DW, DH], "lon": [LON0, LON1], "lat": [LAT0, LAT1], "regions": ORDER,
           "source": "Elevation: AWS Terrain Tiles (Mapzen); regions: geoBoundaries ADM1, CC BY 3.0"},
          open("public/geo/georgia-terrain.json", "w"))
inside = [h for h, r in zip(heights, regions) if r]
print(f"grid {W}x{H} (detail {DW}x{DH}), max {max(inside)} m, min {min(inside)} m",
      f"size {os.path.getsize('public/geo/georgia-terrain.bin.gz') // 1024} KB")
