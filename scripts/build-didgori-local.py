"""
Close-up battlefield of Didgori (≈ 11 × 7.4 km round the Didgori field) for the battle simulation.
Run: python3 scripts/build-didgori-local.py <tile cache dir>

Elevation: AWS Terrain Tiles (terrarium, zoom 14), resampled to a 15 m lon/lat grid, 16-bit metres.
Imagery: EOxCloudless 2024 (Sentinel-2 mosaic, WGS84 tiles, zoom 13 ≈ 7 m), CC BY-NC-SA 4.0 (non-commercial,
education); attribution "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified
Copernicus Sentinel data 2024)". Modern roads and buildings (grey, bright pixels) are painted out.
Trees: positions where the picture shows forest (dark green), ≈ one per 30 m, with size and shade.

Writes public/history/didgori-local.json, didgori-local.bin.gz (heights), didgori-local.jpg, didgori-trees.bin.gz.
"""
import colorsys, concurrent.futures, gzip, json, math, os, random, struct, sys, urllib.request
from PIL import Image, ImageFilter

CACHE = sys.argv[1]
# Window around the memorial (44.508121 E, 41.760839 N), not the village to the south.
LON0, LON1, LAT_N, LAT_S = 44.445, 44.58, 41.786, 41.719
STEP_M = 15
MID = math.radians((LAT_N + LAT_S) / 2)
W_M = (LON1 - LON0) * 111320 * math.cos(MID)
H_M = (LAT_N - LAT_S) * 110570
GW, GH = round(W_M / STEP_M) + 1, round(H_M / STEP_M) + 1
OUT = "public/history"
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)
print(f"window {W_M:.0f} x {H_M:.0f} m, grid {GW} x {GH}")


def get(url, path):
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "school-atlas/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


# ---- Elevation ---------------------------------------------------------------------------------------------
ZE = 14
n = 2 ** ZE
def tile_xy(lon, lat):
    r = math.radians(lat)
    return (lon + 180) / 360 * n, (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n

x0, y0 = tile_xy(LON0, LAT_N)
x1, y1 = tile_xy(LON1, LAT_S)
tiles = [(tx, ty) for tx in range(int(x0), int(x1) + 2) for ty in range(int(y0), int(y1) + 2)]
def fetch_e(t):
    tx, ty = t
    p = get(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZE}/{tx}/{ty}.png", os.path.join(CACHE, f"e{ZE}_{tx}_{ty}.png"))
    return t, Image.open(p).convert("RGB").load()
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    et = dict(ex.map(fetch_e, tiles))

def raw(gx, gy):
    tx, ty = gx // 256, gy // 256
    r, g, b = et[(tx, ty)][gx % 256, gy % 256]
    return r * 256 + g + b / 256 - 32768

def elev(lon, lat):
    x, y = tile_xy(lon, lat)
    px, py = x * 256, y * 256
    ix, iy = int(px), int(py)
    fx, fy = px - ix, py - iy
    return (raw(ix, iy) * (1 - fx) + raw(ix + 1, iy) * fx) * (1 - fy) + (raw(ix, iy + 1) * (1 - fx) + raw(ix + 1, iy + 1) * fx) * fy

heights = []
for j in range(GH):
    lat = LAT_N + (LAT_S - LAT_N) * j / (GH - 1)
    for i in range(GW):
        lon = LON0 + (LON1 - LON0) * i / (GW - 1)
        heights.append(int(round(elev(lon, lat))))
print("heights", min(heights), max(heights))
with gzip.open(os.path.join(OUT, "didgori-local.bin.gz"), "wb", 9) as f:
    f.write(struct.pack(f"<{len(heights)}h", *heights))

# ---- Imagery -------------------------------------------------------------------------------------------------
ZI = 13
span = 180 / 2 ** ZI
c0, c1 = int((LON0 + 180) // span), int((LON1 + 180) // span)
r0, r1 = int((90 - LAT_N) // span), int((90 - LAT_S) // span)
jobs = [(r, c) for r in range(r0, r1 + 1) for c in range(c0, c1 + 1)]
def fetch_i(rc):
    r, c = rc
    return rc, get(f"https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024/default/WGS84/{ZI}/{r}/{c}.jpg", os.path.join(CACHE, f"i{ZI}_{r}_{c}.jpg"))
mosaic = Image.new("RGB", ((c1 - c0 + 1) * 256, (r1 - r0 + 1) * 256))
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for (r, c), p in ex.map(fetch_i, jobs):
        mosaic.paste(Image.open(p).convert("RGB"), ((c - c0) * 256, (r - r0) * 256))
px = lambda lon: (lon + 180 - c0 * span) / span * 256
py = lambda lat: (90 - lat - r0 * span) / span * 256
img = mosaic.crop((round(px(LON0)), round(py(LAT_N)), round(px(LON1)), round(py(LAT_S))))
OW = 3072
OH = round(OW * H_M / W_M)
img = img.resize((OW, OH), Image.LANCZOS)

# Paint out modern roads, villages and buildings: pixels much brighter than their surroundings (thin light
# lines and spots), plus grey ones; filled with the blurred surroundings.
lum = img.convert("L")
lum_blur = lum.filter(ImageFilter.GaussianBlur(7))
src = img.load()
lp, bp = lum.load(), lum_blur.load()
mask = Image.new("L", img.size)
mp = mask.load()
for y in range(OH):
    for x in range(OW):
        r, g, b = src[x, y]
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if lp[x, y] - bp[x, y] > 14 or (s < 0.16 and v > 0.34) or v > 0.62:
            mp[x, y] = 255
mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2))
# Fill colour: surroundings blurred with the masked pixels left out (normalised blur).
weight = Image.eval(mask, lambda m: 255 - m)
masked = Image.composite(img, Image.new("RGB", img.size), weight)
num = masked.filter(ImageFilter.GaussianBlur(9)).load()
den = weight.filter(ImageFilter.GaussianBlur(9)).load()
fill = Image.new("RGB", img.size)
fp = fill.load()
for y in range(OH):
    for x in range(OW):
        d = max(den[x, y], 8) / 255
        r, g, b = num[x, y]
        fp[x, y] = (min(255, int(r / d)), min(255, int(g / d)), min(255, int(b / d)))
img = Image.composite(fill, img, mask)
img.save(os.path.join(OUT, "didgori-local.jpg"), quality=84)
print("imagery", img.size)

# ---- Trees: where the picture is dark green ---------------------------------------------------------------------
# The mosaic is dark overall (median value ≈ 0.17): forest is the darkest, most saturated green (the ravines
# and north slopes); the lighter, yellower ground on the ridges is meadow.
random.seed(1121)
small = img.resize((OW // 4, OH // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
sp = small.load()
SW, SH = small.size
trees = []
CELL = 42
for zm in range(0, int(H_M), CELL):
    for xm in range(0, int(W_M), CELL):
        x = xm + random.uniform(0, CELL)
        z = zm + random.uniform(0, CELL)
        r, g, b = sp[min(SW - 1, int(x / W_M * SW)), min(SH - 1, int(z / H_M * SH))]
        v = max(r, g, b) / 255
        green = (g - r) / max(1, g)
        forest = v < 0.16 and green > 0.22
        edge = v < 0.185 and green > 0.3 and random.random() < 0.12
        if forest or edge:
            trees.append((x, z, random.uniform(0.75, 1.3), random.random()))
print("trees", len(trees))
with gzip.open(os.path.join(OUT, "didgori-trees.bin.gz"), "wb", 9) as f:
    for x, z, s, c in trees:
        f.write(struct.pack("<HHBB", min(65535, int(x / W_M * 65535)), min(65535, int(z / H_M * 65535)), int(s * 100), int(c * 255)))

json.dump({"width": GW, "height": GH, "lon": [LON0, LON1], "lat": [LAT_N, LAT_S], "metres": [W_M, H_M], "trees": len(trees),
           "source": "Elevation: AWS Terrain Tiles; imagery: EOxCloudless 2024 (CC BY-NC-SA 4.0)"}, open(os.path.join(OUT, "didgori-local.json"), "w"))
