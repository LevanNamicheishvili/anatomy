"""
The continents picture for the geography globes: public/geo/continents.png, an equirectangular image (2048×1024,
longitude −180° at the left edge, as the Earth's texture) where every continent's land is painted in its colour,
half transparent, and the sea is clear. The globes lay it over the Earth when the teacher picks the continents.

Countries are painted by Natural Earth's CONTINENT, then corrected where a country lies on two continents:
Russia east of the Urals (the mountains, then the Ural River to the Caspian) is Asia, Kazakhstan west of the Ural
River is Europe, Turkey's Thrace is Europe, Egypt's Sinai is Asia, and European countries' lands overseas (French
Guiana, the Caribbean islands, the Canaries, Réunion) go with the continent they lie on. Georgia is left in Asia, as
Natural Earth has it.

Run (needs Pillow): python3 scripts/build-continents.py <natural-earth geojson dir>
Source: Natural Earth 1:50m admin-0 countries (public domain).
"""
import json, os, sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/geo/continents.png")
NE = sys.argv[1]

W, H = 4096, 2048  # drawn at twice the size, then scaled down (smooth coasts)
ALPHA = 150

COLOURS = {
    "Europe": (242, 193, 78),
    "Asia": (239, 125, 87),
    "Africa": (155, 207, 83),
    "North America": (91, 180, 229),
    "South America": (176, 127, 224),
    "Oceania": (242, 140, 184),
    "Antarctica": (230, 240, 247),
}

#: The Urals and the Ural River, north to south: (latitude, longitude). East of it is Asia.
URALS = [(81, 69.5), (69, 69.5), (68.8, 66.5), (66.5, 64.5), (62, 59.5), (58, 59.2), (55, 59.2), (52, 58.5), (51.8, 55.1), (51.2, 51.4), (47.0, 51.9), (40, 51.9)]


def urals_lon(lat):
    for (la0, lo0), (la1, lo1) in zip(URALS, URALS[1:]):
        if la1 <= lat <= la0:
            return lo0 + (lo1 - lo0) * (la0 - lat) / (la0 - la1)
    return URALS[-1][1] if lat < URALS[-1][0] else URALS[0][1]


def continent(code, cont, lon, lat):
    if code == "RUS":
        return "Asia" if lon > urals_lon(lat) or lon < 0 else "Europe"
    if code == "KAZ":
        return "Europe" if lon < urals_lon(lat) else "Asia"
    if code == "TUR":
        return "Europe" if lon < 29.1 and lat > 40.6 else "Asia"
    if code == "EGY":
        return "Asia" if lon > 32.35 else "Africa"
    if cont == "Europe" and (lon < -30 or lat < 34):
        # A European country's lands overseas (French Guiana, the Caribbean islands, Réunion): where they lie.
        if lon < -30:
            return "South America" if lat < 13 else "North America"
        return "Africa"
    return cont


def xy(lon, lat):
    return ((lon + 180) / 360 * W, (90 - lat) / 180 * H)


def polygons(geom):
    t, c = geom["type"], geom["coordinates"]
    return [c] if t == "Polygon" else c if t == "MultiPolygon" else []


image = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
split = {"RUS", "KAZ", "TUR", "EGY", "FRA", "NLD", "GBR", "ESP", "PRT", "NOR", "DNK"}
for f in json.load(open(os.path.join(NE, "ne_50m_admin_0_countries.geojson")))["features"]:
    p = f["properties"]
    code, cont = p["ADM0_A3"], p["CONTINENT"]
    if cont not in COLOURS and code not in split:
        continue
    for poly in polygons(f["geometry"]):
        outer, holes = poly[0], poly[1:]
        if code in split:
            # Paint the country into its own mask, then colour each pixel by the side of the line it is on.
            mask = Image.new("L", (W, H), 0)
            md = ImageDraw.Draw(mask)
            md.polygon([xy(*pt) for pt in outer], fill=255)
            for hole in holes:
                md.polygon([xy(*pt) for pt in hole], fill=0)
            box = mask.getbbox()
            if not box:
                continue
            px = mask.load()
            out = image.load()
            for y in range(box[1], box[3]):
                lat = 90 - (y + 0.5) / H * 180
                for x in range(box[0], box[2]):
                    if px[x, y]:
                        lon = (x + 0.5) / W * 360 - 180
                        out[x, y] = COLOURS[continent(code, cont, lon, lat)] + (ALPHA,)
            continue
        draw.polygon([xy(*pt) for pt in outer], fill=COLOURS[cont] + (ALPHA,))
        for hole in holes:
            draw.polygon([xy(*pt) for pt in hole], fill=(0, 0, 0, 0))

image = image.resize((W // 2, H // 2), Image.LANCZOS)
image.save(OUT, optimize=True)
print(OUT, os.path.getsize(OUT) // 1024, "KB")
