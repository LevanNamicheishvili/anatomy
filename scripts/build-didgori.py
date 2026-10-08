"""
Terrain and satellite picture of the Didgori battlefield area for the history simulation.
Run: python3 scripts/build-didgori.py <tile cache dir>

Window: lon 44.25–44.85, lat 41.58–41.86 (Manglisi, Didgori, Tbilisi).
Elevation: AWS Terrain Tiles (terrarium, zoom 12, public dataset) resampled to a lon/lat grid, 16-bit metres.
Imagery: EOxCloudless 2024 (Sentinel-2 mosaic, WGS84 tiles, zoom 12). Licence: CC BY-NC-SA 4.0, non-commercial
(education); attribution "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified
Copernicus Sentinel data 2024)".

Writes public/history/didgori-terrain.json, didgori-terrain.bin.gz and didgori-satellite.jpg.
"""
import concurrent.futures, gzip, io, json, math, os, struct, sys, urllib.request
from PIL import Image

CACHE = sys.argv[1]
LON0, LON1, LAT_N, LAT_S = 44.25, 44.85, 41.86, 41.58
GW, GH = 481, 225                      # height grid: ~0.00125° (≈ 100 m) steps
OUT = "public/history"
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)


def get(url, path):
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "school-atlas/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


# ---- Elevation (web-mercator terrarium tiles) -----------------------------------------------------------
ZE = 12
n = 2 ** ZE
def tile_xy(lon, lat):
    x = (lon + 180) / 360 * n
    r = math.radians(lat)
    y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n
    return x, y

x0, y0 = tile_xy(LON0, LAT_N)
x1, y1 = tile_xy(LON1, LAT_S)
tiles = [(tx, ty) for tx in range(int(x0), int(x1) + 1) for ty in range(int(y0), int(y1) + 1)]
def fetch_e(t):
    tx, ty = t
    p = get(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZE}/{tx}/{ty}.png", os.path.join(CACHE, f"e{ZE}_{tx}_{ty}.png"))
    return t, Image.open(p).convert("RGB")
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    etiles = dict(ex.map(fetch_e, tiles))
print("elevation tiles", len(etiles))

def elev(lon, lat):
    x, y = tile_xy(lon, lat)
    tx, ty = int(x), int(y)
    px, py = (x - tx) * 256, (y - ty) * 256
    def at(ix, iy):
        ttx, tty = tx + ix // 256, ty + iy // 256
        im = etiles[(ttx, tty)]
        r, g, b = im.getpixel((ix % 256, iy % 256))
        return r * 256 + g + b / 256 - 32768
    ix, iy = int(px), int(py)
    fx, fy = px - ix, py - iy
    a = at(ix, iy); b = at(ix + 1, iy); c = at(ix, iy + 1); d = at(ix + 1, iy + 1)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

heights = []
for j in range(GH):
    lat = LAT_N + (LAT_S - LAT_N) * j / (GH - 1)
    for i in range(GW):
        lon = LON0 + (LON1 - LON0) * i / (GW - 1)
        heights.append(int(round(elev(lon, lat))))
print("height range", min(heights), max(heights))
with gzip.open(os.path.join(OUT, "didgori-terrain.bin.gz"), "wb", 9) as f:
    f.write(struct.pack(f"<{len(heights)}h", *heights))
json.dump({"width": GW, "height": GH, "lon": [LON0, LON1], "lat": [LAT_N, LAT_S], "source": "Elevation: AWS Terrain Tiles; imagery: EOxCloudless 2024 (CC BY-NC-SA 4.0)"}, open(os.path.join(OUT, "didgori-terrain.json"), "w"))

# ---- Imagery (WGS84 tiles, no reprojection) --------------------------------------------------------------
ZI = 12
span = 180 / 2 ** ZI
c0, c1 = int((LON0 + 180) // span), int((LON1 + 180) // span)
r0, r1 = int((90 - LAT_N) // span), int((90 - LAT_S) // span)
jobs = [(r, c) for r in range(r0, r1 + 1) for c in range(c0, c1 + 1)]
def fetch_i(rc):
    r, c = rc
    p = get(f"https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024/default/WGS84/{ZI}/{r}/{c}.jpg", os.path.join(CACHE, f"i{ZI}_{r}_{c}.jpg"))
    return rc, p
mosaic = Image.new("RGB", ((c1 - c0 + 1) * 256, (r1 - r0 + 1) * 256))
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for (r, c), p in ex.map(fetch_i, jobs):
        mosaic.paste(Image.open(p).convert("RGB"), ((c - c0) * 256, (r - r0) * 256))
# Crop exactly to the window.
px = lambda lon: (lon + 180 - c0 * span) / span * 256
py = lambda lat: (90 - lat - r0 * span) / span * 256
crop = mosaic.crop((round(px(LON0)), round(py(LAT_N)), round(px(LON1)), round(py(LAT_S))))
W = 2048
crop = crop.resize((W, round(W * crop.size[1] / crop.size[0])), Image.LANCZOS)
crop.save(os.path.join(OUT, "didgori-satellite.jpg"), quality=82)
print("imagery", len(jobs), "tiles ->", crop.size)
