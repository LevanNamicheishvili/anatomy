"""
Photos, figures and short descriptions for every place on the Georgia map.
Run: python3 scripts/build-georgia-media.py <cache dir>

For each article in scripts/data/georgia-wiki.json (Georgian Wikipedia titles; "en:" = English Wikipedia;
"title|File name.jpg" picks a specific Commons photo instead of the default one):
  - photo: the Wikidata image (P18), else the article's free lead image — only files under a free licence
    (CC BY, CC BY-SA, CC0, public domain), saved to public/images/geo/<kind>-<id>.jpg with author and licence;
  - figures from Wikidata: population, elevation, area, length, depth, drainage basin, discharge;
  - the first sentences of the Wikipedia article (CC BY-SA, linked).
Writes public/geo/georgia-media.json.
"""
import html, io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image

CACHE = sys.argv[1]
os.makedirs(CACHE, exist_ok=True)
os.makedirs("public/images/geo", exist_ok=True)
UA = {"User-Agent": "school-atlas/1.0 (education project; xyak11x2@gmail.com)"}
FREE = re.compile(r"^(Attribution|CC[ -]BY(-SA)?( \d\.\d)?|CC0|Public domain|PD.*|CC BY(-SA)? \d\.\d.*)$", re.I)

def get(url, binary=False):
    key = os.path.join(CACHE, re.sub(r"[^\w.-]", "_", url)[-180:])
    if os.path.exists(key):
        data = open(key, "rb").read()
    else:
        for attempt in range(5):
            try:
                time.sleep(1.0)
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                    data = r.read()
                break
            except Exception as e:
                print(f"  retry {url[:80]}: {e}")
                time.sleep(5 * (attempt + 1))
        else:
            raise RuntimeError(url)
        open(key, "wb").write(data)
    return data if binary else json.loads(data)

def api(site, **params):
    params.update(format="json", formatversion="2")
    return get(f"https://{site}/w/api.php?" + urllib.parse.urlencode(params))

UNITS = {"Q11573": 1, "Q828224": 1000, "Q712226": 1, "Q35852": 0.01, "Q25343": 1e-6, "Q794261": 1, "Q174728": 0.01}

def quantity(claims, prop, to="m"):
    """Best value of a quantity property, converted (m, km² or m³/s), with its year if it has one."""
    best = None
    for c in claims.get(prop, []):
        snak = c["mainsnak"]
        if snak.get("snaktype") != "value" or c.get("rank") == "deprecated":
            continue
        v = snak["datavalue"]["value"]
        amount = float(v["amount"])
        unit = v.get("unit", "").rsplit("/", 1)[-1]
        amount *= UNITS.get(unit, 1)
        if to == "km" and unit in ("Q11573",):
            amount /= 1000
        if to == "km" and unit == "Q828224":
            amount /= 1000
        year = None
        for q in c.get("qualifiers", {}).get("P585", []):
            year = int(q["datavalue"]["value"]["time"][1:5])
        score = (c.get("rank") == "preferred", year or 0)
        if best is None or score > best[0]:
            best = (score, amount, year)
    return None if best is None else {"value": round(best[1], 2), "year": best[2]}

def strip(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()

conf = json.load(open("scripts/data/georgia-wiki.json"))
out = {}
for kind, items in conf.items():
    for pid, title in items.items():
        title, _, chosen = title.partition("|")
        lang, t = ("en", title[3:]) if title.startswith("en:") else ("ka", title)
        site = f"{lang}.wikipedia.org"
        page = api(site, action="query", prop="pageprops|extracts|info", inprop="url", exintro=1, explaintext=1, redirects=1, titles=t)["query"]["pages"][0]
        if page.get("missing"):
            print(f"{kind}/{pid}: page missing ({title})")
            continue
        qid = page.get("pageprops", {}).get("wikibase_item")
        entry = {"wiki": {"title": page["title"], "url": page["fullurl"], "lang": lang}}
        # A short intro: the first sentences, up to ~420 characters.
        text = re.sub(r"\s+", " ", re.sub(r"\([^)]*\)", "", page.get("extract", ""))).strip()
        sentences = re.split(r"(?<=[.!?])\s+", text)
        intro = ""
        for s in sentences:
            if len(intro) + len(s) > 420 and intro:
                break
            intro = (intro + " " + s).strip()
        if intro and lang == "ka":
            entry["wiki"]["intro"] = intro
        image = None
        if qid:
            entity = get(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json")["entities"][qid]
            claims = entity["claims"]
            entry["wikidata"] = qid
            stats = {
                "population": quantity(claims, "P1082"),
                "elevation": quantity(claims, "P2044"),
                "area": quantity(claims, "P2046"),
                "length": quantity(claims, "P2043", "km"),
                "depth": quantity(claims, "P4511"),
                "basin": quantity(claims, "P2053"),
                "discharge": quantity(claims, "P2225"),
            }
            entry["stats"] = {k: v for k, v in stats.items() if v}
            for c in claims.get("P18", []):
                image = c["mainsnak"]["datavalue"]["value"]
                break
        if chosen:
            image = chosen
        if not image:
            image = page.get("pageprops", {}).get("page_image_free")
        if image:
            info = api("commons.wikimedia.org", action="query", prop="imageinfo", iiprop="url|extmetadata|mime", iiurlwidth=960, titles="File:" + image)["query"]["pages"][0]
            ii = (info.get("imageinfo") or [{}])[0]
            meta = ii.get("extmetadata", {})
            lic = strip(meta.get("LicenseShortName", {}).get("value"))
            data = None
            if ii.get("mime") in ("image/jpeg", "image/png") and FREE.match(lic) and "NC" not in lic and "ND" not in lic:
                try:
                    data = get(ii["thumburl"], binary=True)
                except RuntimeError:
                    print(f"{kind}/{pid}: download failed, skipped")
                    data = None
            if data:
                img = Image.open(io.BytesIO(data)).convert("RGB")
                img.thumbnail((960, 720))
                path = f"public/images/geo/{kind}-{pid}.jpg"
                img.save(path, quality=80, optimize=True, progressive=True)
                artist = strip(meta.get("Artist", {}).get("value")) or "უცნობი ავტორი"
                entry["image"] = {
                    "src": "/" + path.removeprefix("public/"),
                    "width": img.width,
                    "height": img.height,
                    "author": artist[:120],
                    "license": lic,
                    "page": info.get("canonicalurl") or f"https://commons.wikimedia.org/wiki/File:{urllib.parse.quote(image)}",
                }
            if not data:
                print(f"{kind}/{pid}: image skipped ({lic or 'no licence'}, {ii.get('mime')})")
        out.setdefault(kind, {})[pid] = entry
        print(f"{kind}/{pid}: {qid} stats={list(entry.get('stats', {}))} image={'yes' if 'image' in entry else 'no'}")

json.dump(out, open("public/geo/georgia-media.json", "w"), ensure_ascii=False, indent=1)
print("wrote public/geo/georgia-media.json")
