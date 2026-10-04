"""
Real outlines of lakes and reservoirs and real courses of the named rivers, from OpenStreetMap
(© OpenStreetMap contributors, ODbL). Run: python3 scripts/build-georgia-water.py <cache dir>

Writes public/geo/georgia-water.json: {"lakes": {id: [[ring of [lon, lat]], ...]}, "rivers": {id: [[line], ...]}}.
Lines are simplified (Douglas–Peucker, ~40 m) to keep the file small.
"""
import json, math, os, sys, time, urllib.parse, urllib.request

CACHE = sys.argv[1]
os.makedirs(CACHE, exist_ok=True)
MIRRORS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter"]
BBOX = "40.9,39.9,43.7,46.8"

# Lake id → (lon, lat) of a point inside it.
LAKES = {
    "paravani": (43.80, 41.45), "kartsakhi": (43.25, 41.22), "tabatskuri": (43.63, 41.65), "paliastomi": (41.70, 42.12),
    "ritsa": (40.53, 43.47), "tsalka": (44.08, 41.60), "zhinvali": (44.77, 42.13), "enguri": (42.05, 42.79),
    "tbilisi-sea": (44.84, 41.77),
}
# River id → its Georgian name in OSM.
RIVERS = {
    "mtkvari": "მტკვარი", "rioni": "რიონი", "alazani": "ალაზანი", "iori": "იორი", "enguri": "ენგური", "chorokhi": "ჭოროხი",
    "tergi": "თერგი", "kodori": "კოდორი", "bzipi": "ბზიფი", "khrami": "ხრამი", "aragvi": "არაგვი",
    "tskhenistskali": "ცხენისწყალი", "kvirila": "ყვირილა", "liakhvi": "დიდი ლიახვი", "ksani": "ქსანი", "supsa": "სუფსა",
    "adjaristskali": "აჭარისწყალი", "paravani": "ფარავანი",
}

def overpass(query, key):
    path = os.path.join(CACHE, key + ".json")
    if os.path.exists(path):
        return json.load(open(path))
    for attempt in range(6):
        url = MIRRORS[attempt % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": "school-atlas/1.0 (education)"})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read())
            json.dump(data, open(path, "w"))
            return data
        except Exception as e:  # busy server: wait and try the other mirror
            print(f"  {key}: {e}; retrying")
            time.sleep(5 + attempt * 5)
    raise RuntimeError(f"overpass failed for {key}")

def simplify(pts, eps=0.0004):
    """Douglas–Peucker on lon/lat points (eps in degrees, ~40 m). Closed rings are split at their farthest point."""
    if len(pts) < 3:
        return pts
    if pts[0] == pts[-1]:
        far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
        return simplify(pts[: far + 1], eps)[:-1] + simplify(pts[far:], eps)
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        n = math.hypot(dx, dy) or 1e-12
        best, idx = 0, -1
        for i in range(a + 1, b):
            d = abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / n
            if d > best:
                best, idx = d, i
        if best > eps:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [[round(x, 5), round(y, 5)] for (x, y), k in zip(pts, keep) if k]

def area(ring):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]))) / 2

def inside(ring, x, y):
    c = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c

def join(ways):
    """Joins way pieces of a multipolygon's outer border into closed rings."""
    ways = [w[:] for w in ways if len(w) > 1]
    rings = []
    while ways:
        ring = ways.pop()
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, w in enumerate(ways):
                if w[0] == ring[-1]:
                    ring += w[1:]
                elif w[-1] == ring[-1]:
                    ring += w[-2::-1]
                elif w[-1] == ring[0]:
                    ring = w[:-1] + ring
                elif w[0] == ring[0]:
                    ring = w[:0:-1] + ring
                else:
                    continue
                ways.pop(i)
                changed = True
                break
        rings.append(ring)
    return rings

lakes = {}
for lid, (lon, lat) in LAKES.items():
    d = overpass(f'[out:json][timeout:120];nwr["natural"="water"](around:2500,{lat},{lon});out geom;', f"lake-{lid}")
    cands = []
    for e in d["elements"]:
        if e["type"] == "way" and "geometry" in e:
            cands.append([[[p["lon"], p["lat"]] for p in e["geometry"]]])
        elif e["type"] == "relation":
            outer = [[[p["lon"], p["lat"]] for p in m["geometry"]] for m in e.get("members", []) if m.get("role") == "outer" and "geometry" in m]
            cands.append(join(outer))
    # The polygon that contains our point; otherwise the largest one nearby.
    best = None
    for rings in cands:
        if any(inside(r, lon, lat) for r in rings):
            best = rings if best is None or sum(map(area, rings)) > sum(map(area, best)) else best
    if best is None and cands:
        best = max(cands, key=lambda rs: sum(map(area, rs)))
    if best:
        lakes[lid] = [simplify(r, 0.00015) for r in best if len(r) > 3]
        km2 = sum(map(area, best)) * 111 * 111 * math.cos(math.radians(lat))
        print(f"lake {lid}: {sum(len(r) for r in lakes[lid])} points, ≈{km2:.1f} km²")
    else:
        print(f"lake {lid}: NOT FOUND")

rivers = {}
for rid, name in RIVERS.items():
    d = overpass(f'[out:json][timeout:170];(relation["waterway"="river"]["name"="{name}"]({BBOX});way["waterway"="river"]["name"="{name}"]({BBOX}););out geom;', f"river-{rid}")
    lines = []
    for e in d["elements"]:
        if e["type"] == "way" and "geometry" in e:
            lines.append([[p["lon"], p["lat"]] for p in e["geometry"]])
        elif e["type"] == "relation":
            for m in e.get("members", []):
                if m.get("type") == "way" and "geometry" in m and m.get("role") in ("", "main_stream", "side_stream"):
                    lines.append([[p["lon"], p["lat"]] for p in m["geometry"]])
    # The same way can come both alone and inside the relation.
    seen, uniq = set(), []
    for l in lines:
        k = (tuple(l[0]), tuple(l[-1]), len(l))
        if k not in seen:
            seen.add(k)
            uniq.append(l)
    merged = join(uniq) if uniq else []
    rivers[rid] = [simplify(l) for l in merged if len(l) > 1]
    print(f"river {rid}: {len(rivers[rid])} lines, {sum(len(l) for l in rivers[rid])} points")

json.dump({"source": "© OpenStreetMap contributors, ODbL", "lakes": lakes, "rivers": rivers}, open("public/geo/georgia-water.json", "w"), separators=(",", ":"))
print(f"wrote public/geo/georgia-water.json, {os.path.getsize('public/geo/georgia-water.json') // 1024} KB")
