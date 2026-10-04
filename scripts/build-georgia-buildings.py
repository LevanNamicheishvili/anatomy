"""
3D buildings for the centres of Georgia's cities, from OpenStreetMap (© OpenStreetMap contributors, ODbL).
Run: python3 scripts/build-georgia-buildings.py <cache dir>

For every city in src/components/geography/georgia-data.ts: building footprints within a radius of its
centre, with their height (OSM height, or levels × 3 m, or a typical height for the building type).
Writes public/geo/buildings/<city>.json: {"c": [lon, lat], "b": [[height, x0, y0, x1, y1, ...], ...]} with
x/y in metres east/north of the centre (rounded to 0.5 m), outer ring only.
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request

CACHE = sys.argv[1]
os.makedirs(CACHE, exist_ok=True)
os.makedirs("public/geo/buildings", exist_ok=True)
MIRRORS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter"]
RADIUS = {"tbilisi": 2600, "batumi": 1800, "kutaisi": 1600, "rustavi": 1400}
DEFAULT_RADIUS = 1000
TYPE_HEIGHT = {"house": 7, "detached": 7, "garage": 3, "garages": 3, "shed": 3, "roof": 4, "church": 16, "cathedral": 30,
               "apartments": 15, "commercial": 12, "retail": 6, "industrial": 9, "school": 12, "hospital": 15, "hut": 3}

src = open("src/components/geography/georgia-data.ts", encoding="utf-8").read()
cities = re.findall(r'\{ id: "([a-z-]+)", name: "[^"]+", region: "[^"]+", lon: ([\d.]+), lat: ([\d.]+)', src)

def overpass(query, key):
    path = os.path.join(CACHE, key + ".json")
    if os.path.exists(path):
        return json.load(open(path))
    for attempt in range(8):
        url = MIRRORS[attempt % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": "school-atlas/1.0 (education)"})
            with urllib.request.urlopen(req, timeout=240) as r:
                data = json.loads(r.read())
            json.dump(data, open(path, "w"))
            return data
        except Exception as e:
            print(f"  {key}: {e}; retrying")
            time.sleep(6 + attempt * 6)
    raise RuntimeError(key)

def height(tags):
    for k in ("height", "building:height"):
        v = tags.get(k)
        if v:
            m = re.match(r"[\d.]+", v.replace(",", "."))
            if m:
                return min(300.0, float(m.group()))
    lv = tags.get("building:levels")
    if lv:
        m = re.match(r"[\d.]+", lv)
        if m:
            return min(300.0, float(m.group()) * 3 + 1)
    return TYPE_HEIGHT.get(tags.get("building", ""), 9)

for cid, lon, lat in cities:
    lon, lat = float(lon), float(lat)
    r = RADIUS.get(cid, DEFAULT_RADIUS)
    d = overpass(f'[out:json][timeout:220];way["building"](around:{r},{lat},{lon});out tags geom;', f"b-{cid}-{r}")
    kx = 111320 * math.cos(math.radians(lat))
    ky = 110540
    out = []
    for e in d["elements"]:
        g = e.get("geometry")
        if not g or len(g) < 4:
            continue
        pts = [(round((p["lon"] - lon) * kx * 2) / 2, round((p["lat"] - lat) * ky * 2) / 2) for p in g]
        if pts[0] == pts[-1]:
            pts = pts[:-1]
        row = [round(height(e.get("tags", {})), 1)]
        for x, y in pts:
            row += [x, y]
        out.append(row)
    path = f"public/geo/buildings/{cid}.json"
    json.dump({"c": [lon, lat], "r": r, "b": out}, open(path, "w"), separators=(",", ":"))
    print(f"{cid}: {len(out)} buildings, {os.path.getsize(path) // 1024} KB")
