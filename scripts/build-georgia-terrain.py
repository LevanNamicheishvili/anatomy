"""
Elevation and region grid for the 3D Georgia map (run: python3 scripts/build-georgia-terrain.py <tile dir>).

Elevation: AWS Terrain Tiles (terrarium encoding, zoom 8), resampled onto a regular longitude/latitude
grid. Regions: geoBoundaries ADM1 polygons rasterised onto the same grid (0 = outside Georgia).
Writes public/geo/georgia-terrain.bin.gz (Int16 heights in metres, then Uint8 region index) and
public/geo/georgia-terrain.json (grid size, bounds, region order).
"""
import gzip, json, math, os, struct, sys
from PIL import Image, ImageDraw

TILES = sys.argv[1]
Z = 8
LON0, LON1 = 39.9, 46.8
LAT0, LAT1 = 43.7, 40.95  # north to south
W, H = 640, 344

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

heights = []
for j in range(H):
    lat = LAT0 + (LAT1 - LAT0) * j / (H - 1)
    for i in range(W):
        lon = LON0 + (LON1 - LON0) * i / (W - 1)
        heights.append(int(round(max(-500, min(6000, sample(lon, lat))))))

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
THRESHOLD = 900  # cells (~700 km² of catchment)
river = [acc[k] >= THRESHOLD and heights[k] > 0 for k in range(N)]
near = lambda k: any(regions[(k // W + dj) * W + (k % W + di)] for di in (-6, 0, 6) for dj in (-6, 0, 6)
                     if 0 <= k % W + di < W and 0 <= k // W + dj < H)
seen = bytearray(N)
lines = []
heads = [k for k in range(N) if river[k] and not any(down[u] == k and river[u] for u in [])]
# Heads: river cells no river cell flows into.
inflow = bytearray(N)
for k in range(N):
    if river[k] and down[k] >= 0:
        inflow[down[k]] = 1
for k in range(N):
    if not river[k] or inflow[k]:
        continue
    line = []
    c = k
    while c >= 0 and river[c]:
        line.append(c)
        if seen[c]:
            break
        seen[c] = 1
        c = down[c]
    if len(line) > 3 and any(near(x) for x in line[:: max(1, len(line) // 8)]):
        lonlat = lambda q: (round(LON0 + (LON1 - LON0) * (q % W) / (W - 1), 4), round(LAT0 + (LAT1 - LAT0) * (q // W) / (H - 1), 4))
        lines.append([[*lonlat(q), acc[q]] for q in line])
print(f"rivers: {len(lines)} lines, {sum(len(l) for l in lines)} points")

os.makedirs("public/geo", exist_ok=True)
borders = {}
for f in geo["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    borders[IDS[f["properties"]["shapeName"]]] = [[[round(x, 4), round(y, 4)] for x, y in poly[0]] for poly in polys]
json.dump({"borders": borders, "rivers": lines}, open("public/geo/georgia-lines.json", "w"), separators=(",", ":"))
raw = struct.pack(f"<{W * H}h", *heights) + bytes(regions)
with gzip.open("public/geo/georgia-terrain.bin.gz", "wb", 9) as fh:
    fh.write(raw)
json.dump({"width": W, "height": H, "lon": [LON0, LON1], "lat": [LAT0, LAT1], "regions": ORDER,
           "source": "Elevation: AWS Terrain Tiles (Mapzen); regions: geoBoundaries ADM1, CC BY 3.0"},
          open("public/geo/georgia-terrain.json", "w"))
inside = [h for h, r in zip(heights, regions) if r]
print(f"grid {W}x{H}, max {max(inside)} m, min {min(inside)} m, inside cells {len(inside)}",
      f"size {os.path.getsize('public/geo/georgia-terrain.bin.gz') // 1024} KB")
