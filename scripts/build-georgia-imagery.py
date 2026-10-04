"""
Satellite picture of Georgia for the 3D map (run: python3 scripts/build-georgia-imagery.py <tile cache dir>).

Source: EOxCloudless 2024 (Sentinel-2 cloud-free mosaic), WGS84 tiles — the same longitude/latitude grid as
the map, so no reprojection is needed. Licence: CC BY-NC-SA 4.0 for non-commercial use (education included).
Attribution: "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus
Sentinel data 2024)". Commercial use needs EOX's commercial licence.

Writes public/geo/georgia-satellite.jpg covering exactly the map grid (lon 39.9–46.8, lat 43.7–40.95).
"""
import concurrent.futures, math, os, sys, urllib.request
from PIL import Image

CACHE = sys.argv[1]
LON0, LON1, LAT_N, LAT_S = 39.9, 46.8, 43.7, 40.95
Z = 9                      # tile span 180 / 2^Z degrees, 256 px
OUT_W = 4096
URL = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024/default/WGS84/{z}/{row}/{col}.jpg"

os.makedirs(CACHE, exist_ok=True)
span = 180 / 2 ** Z
col0, col1 = int((LON0 + 180) // span), int((LON1 + 180) // span)
row0, row1 = int((90 - LAT_N) // span), int((90 - LAT_S) // span)

def fetch(rc):
    row, col = rc
    path = os.path.join(CACHE, f"{Z}_{row}_{col}.jpg")
    if not os.path.exists(path):
        req = urllib.request.Request(URL.format(z=Z, row=row, col=col), headers={"User-Agent": "school-atlas/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return rc, path

jobs = [(r, c) for r in range(row0, row1 + 1) for c in range(col0, col1 + 1)]
mosaic = Image.new("RGB", ((col1 - col0 + 1) * 256, (row1 - row0 + 1) * 256))
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for (row, col), path in ex.map(fetch, jobs):
        mosaic.paste(Image.open(path).convert("RGB"), ((col - col0) * 256, (row - row0) * 256))
print(f"{len(jobs)} tiles, mosaic {mosaic.size}")

# Crop to the map's bounds and resize.
px = lambda lon: (lon + 180 - col0 * span) / span * 256
py = lambda lat: (90 - lat - row0 * span) / span * 256
box = (px(LON0), py(LAT_N), px(LON1), py(LAT_S))
out_h = round(OUT_W * (box[3] - box[1]) / (box[2] - box[0]))
img = mosaic.resize((OUT_W, out_h), Image.LANCZOS, box=box)
os.makedirs("public/geo", exist_ok=True)
img.save("public/geo/georgia-satellite.jpg", quality=84, optimize=True, progressive=True)
print(f"wrote public/geo/georgia-satellite.jpg {img.size}, {os.path.getsize('public/geo/georgia-satellite.jpg') // 1024} KB")
