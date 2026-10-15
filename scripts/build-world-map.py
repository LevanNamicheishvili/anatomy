"""
The world map on the geography globes and the Earth's textures:

  public/geo/world-map.json    coasts, lakes, borders, Georgia's outline, and Georgian names (oceans, seas,
                               continents, countries, cities, lakes) with the zoom at which each may show
  public/geo/earth-2k.jpg      NASA Blue Marble Next Generation, topography and bathymetry, July 2004 (2048×1024)
  public/geo/earth-4k.jpg      the same, 4096×2048, for big screens
  public/geo/earth-water.jpg   roughness: water smooth (the sun glints on it), land rough
  public/geo/earth-night.jpg   city lights (NASA Black Marble 2016), for the night side

Sources, all public domain: Natural Earth 1:50m (naturalearthdata.com; GeoJSON from
github.com/nvkelso/natural-earth-vector), NASA Visible Earth (world.topo.bathy.200407.3x5400x2700.jpg,
BlackMarble_2016_01deg.jpg). Georgian names: Wikidata labels (CC0), cached in scripts/data/world-names-ka.json,
corrected below where school maps say it differently.

Borders follow Natural Earth's Ukrainian point of view (FCLASS_UA), which matches Georgia's on the questions that
come up: Crimea and the Donbas are Ukraine, Kosovo, Northern Cyprus and Somaliland are not drawn as states.
Natural Earth draws no line round Abkhazia or the Tskhinvali region, so Georgia is whole.

Run (needs numpy and Pillow):
  python3 scripts/build-world-map.py <natural-earth geojson dir> <blue marble jpg> <black marble jpg>
"""
import json, math, os, sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/geo")
NE, BLUE_MARBLE, BLACK_MARBLE = sys.argv[1:4]
NAMES = json.load(open(os.path.join(ROOT, "scripts/data/world-names-ka.json")))
Image.MAX_IMAGE_PIXELS = None

#: Coordinates are stored as integers in 1/Q of a degree (≈1 km).
Q = 100


def features(name):
    return json.load(open(os.path.join(NE, f"ne_50m_{name}.geojson")))["features"]


def parts(geom):
    """Lines of a geometry: line strings, or polygon rings (exterior first)."""
    t, c = geom["type"], geom["coordinates"]
    if t == "LineString":
        return [c]
    if t in ("MultiLineString", "Polygon"):
        return c
    if t == "MultiPolygon":
        return [r for p in c for r in p]
    return []


def polygons(geom):
    t, c = geom["type"], geom["coordinates"]
    return [c] if t == "Polygon" else c if t == "MultiPolygon" else []


def area_km2(ring):
    """Area of a lon/lat ring (equal-area cylindrical projection + shoelace)."""
    p = np.radians(np.asarray(ring, float))
    x, y = p[:, 0] * 6371, np.sin(p[:, 1]) * 6371
    return abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))) / 2


# ---- Lines -------------------------------------------------------------------------------------------------------

def simplify(pts, tol):
    """Douglas–Peucker in degrees (longitude scaled by cos latitude, so the tolerance is about the same everywhere)."""
    pts = np.asarray(pts, float)
    if len(pts) < 3:
        return pts
    xy = np.c_[pts[:, 0] * np.cos(np.radians(pts[:, 1])), pts[:, 1]]
    keep = np.zeros(len(pts), bool)
    keep[[0, -1]] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        s, d = xy[a], xy[b] - xy[a]
        p = xy[a + 1:b] - s
        n = math.hypot(*d)
        dist = np.abs(d[0] * p[:, 1] - d[1] * p[:, 0]) / n if n > 0 else np.hypot(p[:, 0], p[:, 1])
        i = int(np.argmax(dist))
        if dist[i] > tol:
            m = a + 1 + i
            keep[m] = True
            stack += [(a, m), (m, b)]
    return pts[keep]


def densify(pts, step=1.0):
    """Extra points on long straight runs (the 49th parallel is one segment), so the line follows the globe."""
    out = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) / step)
        for k in range(1, n + 1):
            out.append(a + (b - a) * k / (n + 1))
        out.append(b)
    return np.asarray(out)


def encode(pts):
    """[lon0, lat0, Δlon, Δlat, …] in 1/Q degree."""
    q = np.round(np.asarray(pts) * Q).astype(int)
    out = [int(q[0, 0]), int(q[0, 1])]
    for a, b in zip(q[:-1], q[1:]):
        d = b - a
        if d.any():
            out += [int(d[0]), int(d[1])]
    return out


def line_set(lines, tol, min_extent=0.0):
    out = []
    for line in lines:
        pts = np.asarray(line, float)
        if len(pts) < 2 or np.ptp(pts[:, 0]) + np.ptp(pts[:, 1]) < min_extent:
            continue
        pts = densify(simplify(pts, tol))
        if len(pts) >= 2:
            out.append(encode(pts))
    return out


def border_class(q):
    """Natural Earth's Ukrainian point of view: None = not drawn."""
    c = q.get("FCLASS_UA") or q["FEATURECLA"]
    if c.startswith("International"):
        return "border"
    if c.startswith("Unrecognized") or c.startswith("Admin-1"):
        return None
    return "disputed"


coast = [l for f in features("coastline") for l in parts(f["geometry"])]
# The Caspian is not in the coastline layer: it is a hole in the land.
for f in features("land"):
    for ring in parts(f["geometry"]):
        r = np.asarray(ring)
        if len(r) > 50 and r[:, 0].min() > 46 and r[:, 0].max() < 55.5 and r[:, 1].min() > 36 and r[:, 1].max() < 47.5:
            coast.append(ring)

lakes = []
for f in features("lakes"):
    for poly in polygons(f["geometry"]):
        if area_km2(poly[0]) > 2500:
            lakes.append(poly[0])

borders, disputed = [], []
for f in features("admin_0_boundary_lines_land"):
    c = border_class(f["properties"])
    if c:
        (borders if c == "border" else disputed).extend(parts(f["geometry"]))

countries = features("admin_0_countries")
georgia = next(f for f in countries if f["properties"]["ADM0_A3"] == "GEO")

LINES = {
    "coast": line_set(coast, 0.03, min_extent=0.12),
    "lake": line_set(lakes, 0.03),
    "border": line_set(borders, 0.02),
    "disputed": line_set(disputed, 0.02),
    "georgia": line_set([p[0] for p in polygons(georgia["geometry"])], 0.01),
}


# ---- Names -------------------------------------------------------------------------------------------------------
# Every label: t (kind), n (name), la/lo (where), z (smallest zoom, in screen pixels per degree, at which it may
# show), x (largest, for the continents that give way to countries), s (for countries: the size of the country in
# degrees; the page shows the name once it fits). The page shows labels in this order of priority and leaves out
# those that would overlap one shown earlier.

labels = []


def label(t, n, la, lo, **kw):
    labels.append({"t": t, "n": n, "la": round(la, 3), "lo": round(lo, 3), **kw})


OCEANS = [
    ("წყნარი ოკეანე", 6, -148), ("წყნარი ოკეანე", 22, 164), ("წყნარი ოკეანე", -30, -120),
    ("ატლანტის ოკეანე", 30, -42), ("ატლანტის ოკეანე", -22, -16),
    ("ინდოეთის ოკეანე", -18, 78),
    ("ჩრდილოეთ ყინულოვანი ოკეანე", 83, 60),
]
CONTINENTS = [
    ("ევროპა", 53.5, 26), ("აზია", 47, 92), ("აფრიკა", 6, 20),
    ("ჩრდილოეთ ამერიკა", 51, -103), ("სამხრეთ ამერიკა", -12, -58), ("ანტარქტიდა", -80, 40),
]
#: Seas, gulfs and lakes: Wikidata id (for the name), where the name goes, smallest zoom; the name only where
#: Wikidata's differs from the one school maps use.
WATERS = [
    ("Q166", 43.4, 34.2, 0), ("Q5484", 42.2, 50.9, 0),
    ("Q4918", 34.2, 18.5, 5), ("Q58705", 14, 64, 5), ("Q38684", 15, 88.5, 6), ("Q37660", 13, 114, 6),
    ("Q1247", 15, -75, 6), ("Q12630", 25, -90.5, 6), ("Q3040", 59.5, -85.5, 6), ("Q41602", 54, 149, 7),
    ("Q44725", 58, -178, 7), ("Q82931", -17, 154, 7), ("Q33254", -39, 160, 7), ("Q47545", 68, 3, 8),
    ("Q45823", 74, 40, 8), ("Q27092", 40.5, 135, 8), ("Q41430", 2, 3, 8), ("Q159183", 20, 132, 8),
    ("Q173343", -73, -45, 8), ("Q164466", -76, -175, 8), ("Q23406", 20.5, 38.3, 9), ("Q184189", 58, -55, 9),
    ("Q180531", 57, -145, 9), ("Q1693", 56, 3.2, 10), ("Q132868", 76, -5, 10), ("Q131274", 72, -140, 10),
    ("Q37040", 73, -65, 10), ("Q545", 58.2, 19.6, 12), ("Q33629", 76, 65, 12), ("Q34675", 27, 51.2, 12),
    ("Q45341", 29, 126, 12), ("Q165100", -18, 41.5, 12), ("Q47632", 11, 96, 12), ("Q128880", -9.5, 135, 12),
    ("Q7988", 76, 125, 12), ("Q37960", 36, 123.5, 14), ("Q41837", 12.5, 48, 14), ("Q41573", 45, -4.5, 14),
    ("Q13924", 42.8, 15.6, 16), ("Q44133", 65.8, 38.2, 16),
]
EXTRA_SEAS = [("აზოვის ზღვა", 46.1, 36.6, 18), ("ეგეოსის ზღვა", 38.6, 25.1, 16), ("მარმარილოს ზღვა", 40.75, 28.1, 34)]
LAKES = [
    ("Q5513", None, 53.5, 108.2, 8), ("Q5505", "ვიქტორიის ტბა", -1, 33, 10), ("Q134485", None, 46.3, 74.5, 12),
    (None, "არალის ზღვა", 45.4, 59.6, 12), ("Q5525", None, 66, -121, 12), ("Q5539", None, 61.6, -114, 12),
    ("Q1066", None, 47.7, -87.5, 12), ("Q5511", None, -6.5, 29.6, 14), ("Q15288", None, 60.8, 31.5, 14),
    ("Q3272", None, 52.5, -97.8, 14), ("Q5532", None, -11.8, 34.6, 16), ("Q35342", None, -15.8, -69.4, 16),
    ("Q125309", None, 13.3, 14.1, 16), ("Q1169", None, 43.8, -87, 16), ("Q1383", None, 44.8, -82.4, 16),
    ("Q166162", None, 61.7, 35.4, 18), ("Q42191", None, 42.4, 77.3, 18), ("Q5492", "ერი", 42.2, -81.2, 22),
    ("Q1062", None, 43.7, -77.9, 22), ("Q126307", "ვანის ტბა", 38.6, 42.9, 22), ("Q199551", None, 37.6, 45.5, 22),
    ("Q181932", None, 40.35, 45.3, 26), ("Q23883", None, 31.5, 35.5, 30),
]

#: Country names as Georgian school maps write them, where Wikidata's label is the formal or an old name.
COUNTRY_NAME = {
    "CHN": "ჩინეთი", "GBR": "დიდი ბრიტანეთი", "IRL": "ირლანდია", "COG": "კონგო", "KOR": "სამხრეთ კორეა",
    "PRK": "ჩრდილოეთ კორეა", "SDS": "სამხრეთ სუდანი", "TLS": "აღმოსავლეთ ტიმორი", "MKD": "ჩრდილოეთ მაკედონია",
    "SWZ": "ესვატინი", "DOM": "დომინიკის რესპუბლიკა", "COM": "კომორის კუნძულები", "SAH": "დასავლეთ საჰარა",
}
#: Dependencies big enough to name.
DEPENDENCIES = {"GRL", "PRI", "NCL", "PYF", "FLK"}
#: Russia and Canada are wide: a second name where the first is out of sight.
SECOND_LABEL = {"RUS": (62, 102), "CAN": (66, -78)}

CITY_NAME = {"Frankfurt": "ფრანკფურტი", "Tarawa": "ტარავა", "New Orleans": "ნიუ-ორლეანი", "Santa Cruz": "სანტა-კრუსი"}
CITY_DROP = {"Amaravati", "Jilin", "Sri Jayawardenepura Kotte", "Laayoune", "Lobamba", "Baguio", "Bir Lehlou"}
#: Natural Earth marks these as capitals; the capital is another city (or, for Jerusalem, contested).
NOT_CAPITAL = {"Johannesburg", "Abidjan", "Yangon", "Jerusalem", "Tel Aviv", "Colombo", "Dar es Salaam", "Cotonou",
               "Lagos", "Kyoto", "Valparaíso", "The Hague", "Putrajaya"}
CAPITAL = {"Dodoma", "Porto-Novo"}
#: Smallest zoom (px per degree) by rank: 0 the biggest cities … 8 the smallest.
RANK_ZOOM = [3.5, 6, 8.5, 12, 17, 24, 32, 40, 48]
#: Georgian cities (Natural Earth's 1:50m set has only three): name, lat, lon, rank.
GEORGIA_CITIES = [
    ("ქუთაისი", 42.2679, 42.6946, 2), ("ბათუმი", 41.6168, 41.6367, 2), ("სოხუმი", 43.0015, 41.0234, 3),
    ("რუსთავი", 41.5495, 44.9934, 4), ("ზუგდიდი", 42.5088, 41.8709, 4), ("ფოთი", 42.1462, 41.6719, 4),
    ("გორი", 41.9842, 44.1158, 4), ("თელავი", 41.9198, 45.4731, 4), ("ცხინვალი", 42.2257, 43.9701, 5),
    ("ახალციხე", 41.6390, 42.9826, 5), ("ოზურგეთი", 41.9244, 42.0068, 6), ("ამბროლაური", 42.5207, 43.1500, 6),
    ("მესტია", 43.0459, 42.7276, 6), ("მცხეთა", 41.8452, 44.7188, 6),
]


def country_ok(q):
    c = q.get("FCLASS_UA") or q["featurecla"]
    if c.startswith("Unrecognized") or c.startswith("Admin-1") or q["ADM0_A3"] == "ATA":
        return False
    return c == "Admin-0 country" or q["ADM0_A3"] in DEPENDENCIES


def country_size(f):
    """Size in degrees of arc of the country's biggest piece (France without its islands)."""
    biggest = max(area_km2(p[0]) for p in polygons(f["geometry"]))
    return round(math.sqrt(biggest) / 111.2, 2)


cities = []
for f in features("populated_places"):
    q = f["properties"]
    if q["NAME"] in CITY_DROP or q["ADM0_A3"] in ("SOL", "KOS") or q["ADM0_A3"] == "GEO":
        continue
    cap = (q["FEATURECLA"] == "Admin-0 capital" and q["NAME"] not in NOT_CAPITAL) or q["NAME"] in CAPITAL
    pop = q["POP_MAX"] or 0
    if not (cap or pop >= 2_000_000 or q["SCALERANK"] <= 2 or "Admin-0 capital" in q["FEATURECLA"]):
        continue
    name = CITY_NAME.get(q["NAME"]) or NAMES.get(q["WIKIDATAID"] or "")
    if not name:
        continue
    rank = q["SCALERANK"] - (1 if cap else 0)
    if pop >= 10_000_000:
        rank = 0
    cities.append((max(0, min(8, rank)), -pop, name, q["LATITUDE"], q["LONGITUDE"], cap))
cities.sort(key=lambda c: c[:2])

# Georgia first: these are Georgian lessons. Tbilisi and the big cities before the country's name, which sits
# north of them and moves a line or two when they need the room.
label("capital", "თბილისი", 41.7151, 44.8271, z=0, id="Tbilisi")
for n, la, lo, rank in GEORGIA_CITIES:
    if rank <= 3:
        label("city", n, la, lo, z=RANK_ZOOM[rank], id=n)
label("country", "საქართველო", 42.64, 43.6, z=0, id="GEO")
for n, la, lo in OCEANS:
    label("ocean", n, la, lo, z=0)
for n, la, lo in CONTINENTS:
    label("continent", n, la, lo, z=0, **({} if n == "ანტარქტიდა" else {"x": 11}))
for qid, la, lo, z in WATERS[:2]:
    label("sea", NAMES[qid], la, lo, z=z)
for n, la, lo, rank in GEORGIA_CITIES:
    if rank > 3:
        label("city", n, la, lo, z=RANK_ZOOM[rank], id=n)

shown = []
for f in countries:
    q = f["properties"]
    if q["ADM0_A3"] == "GEO" or not country_ok(q):
        continue
    name = COUNTRY_NAME.get(q["ADM0_A3"]) or NAMES.get(q["WIKIDATAID"])
    if name:
        shown.append((q["MIN_LABEL"], -country_size(f), name, q, f))
shown.sort(key=lambda c: c[:2])
for _, size, name, q, f in shown:
    label("country", name, q["LABEL_Y"], q["LABEL_X"], s=-size, id=q["ADM0_A3"])
    if q["ADM0_A3"] in SECOND_LABEL:
        la, lo = SECOND_LABEL[q["ADM0_A3"]]
        label("country", name, la, lo, s=-size, id=q["ADM0_A3"])

for rank, _, name, la, lo, cap in cities:
    if rank <= 2:
        label("capital" if cap else "city", name, la, lo, z=RANK_ZOOM[rank], id=name)
for qid, la, lo, z in WATERS[2:]:
    label("sea", NAMES[qid], la, lo, z=z)
for n, la, lo, z in EXTRA_SEAS:
    label("sea", n, la, lo, z=z)
for rank, _, name, la, lo, cap in cities:
    if rank > 2:
        label("capital" if cap else "city", name, la, lo, z=RANK_ZOOM[rank], id=name)
for qid, name, la, lo, z in LAKES:
    label("lake", name or NAMES[qid], la, lo, z=z)

with open(os.path.join(OUT, "world-map.json"), "w") as fh:
    json.dump({"q": Q, "lines": LINES, "labels": labels}, fh, ensure_ascii=False, separators=(",", ":"))


# ---- Textures ----------------------------------------------------------------------------------------------------

day = Image.open(BLUE_MARBLE).convert("RGB")
day.resize((4096, 2048), Image.LANCZOS).save(os.path.join(OUT, "earth-4k.jpg"), quality=84, optimize=True, progressive=True)
day.resize((2048, 1024), Image.LANCZOS).save(os.path.join(OUT, "earth-2k.jpg"), quality=86, optimize=True, progressive=True)

# Roughness (three.js reads the green channel): land 1, water 0.45. Drawn at twice the size, then scaled down.
W, H = 4096, 2048
mask = Image.new("L", (W, H), 115)
draw = ImageDraw.Draw(mask)


def px(ring):
    return [((lo + 180) / 360 * W, (90 - la) / 180 * H) for lo, la in ring]


for f in features("land"):
    for poly in polygons(f["geometry"]):
        draw.polygon(px(poly[0]), fill=255)
        for hole in poly[1:]:
            draw.polygon(px(hole), fill=115)
for f in features("lakes"):
    for poly in polygons(f["geometry"]):
        draw.polygon(px(poly[0]), fill=115)
mask.resize((2048, 1024), Image.LANCZOS).save(os.path.join(OUT, "earth-water.jpg"), quality=80, optimize=True)

# City lights: the yellow of the lights without the blue of the moonlit ground, as one grey channel.
night = np.asarray(Image.open(BLACK_MARBLE).convert("RGB"), float)
lights = np.clip((night[..., 0] - night[..., 2] * 0.62 - 6) * 1.6, 0, 255).astype(np.uint8)
Image.fromarray(lights).resize((2048, 1024), Image.LANCZOS).save(os.path.join(OUT, "earth-night.jpg"), quality=82, optimize=True)

size = {k: len(v) for k, v in LINES.items()}
points = {k: sum(len(l) for l in v) // 2 for k, v in LINES.items()}
print("lines", size, "points", points, "labels", len(labels))
for name in ("world-map.json", "earth-2k.jpg", "earth-4k.jpg", "earth-water.jpg", "earth-night.jpg"):
    print(name, os.path.getsize(os.path.join(OUT, name)))
