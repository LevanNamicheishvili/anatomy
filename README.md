# ადამიანის ატლასი 3D

ინტერაქტიული 3D ანატომიის ატლასი საქართველოს სკოლებისთვის.

## შესაძლებლობები

- **2 234 ანატომიური სტრუქტურა** — 15 სისტემა, ქართული სახელები და ძიება
- **ანიმაციები** — გულისცემა, სუნთქვა, სისხლის მიმოქცევა
- **მოძრაობა და პოზები** — ჩონჩხი, კანი და კუნთები სახსრებთან ერთად მოძრაობს
- **შიგნით ჩახედვა** — 3D ჭრილი, შრეები და მიკროსტრუქტურა
- **QR კოდები** — `/topic/<თემა>` გვერდები სახელმძღვანელოებისთვის, დასაბეჭდი ფურცელი `/qr`-ზე

## გაშვება

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

QR კოდები საჯარო მისამართზე რომ მიუთითებდეს, განთავსების შემდეგ დააყენეთ გარემოს ცვლადი:

```
NEXT_PUBLIC_SITE_URL=https://თქვენი-დომენი
```

## ტექნოლოგიები

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · three.js

## წყარო და ლიცენზია

ანატომიური მოდელები: **BodyParts3D**, © The Database Center for Life Science (DBCLS),
ლიცენზია [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
ორიგინალი მონაცემები: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html

ფილტვის წილები: **Z-Anatomy** (Lluís Vinent, https://github.com/LluisV/Z-Anatomy), ლიცენზია
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). შეყვანილია `scripts/import-lungs.mjs`-ით
(გადაყვანილია ჩვენს კოორდინატებში); შეცვლილი ფილტვის მოდელიც (`body-15.bin.gz`) იმავე ლიცენზიით ვრცელდება.

გეოგრაფიის რუკა:
- სატელიტური სურათი: **EOxCloudless** https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024), ლიცენზია [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — მხოლოდ არაკომერციული (საგანმანათლებლო) გამოყენება; კომერციულისთვის EOX-ის ლიცენზიაა საჭირო. `scripts/build-georgia-imagery.py`.
- ტბები და მდინარეები: **© OpenStreetMap contributors**, [ODbL](https://opendatacommons.org/licenses/odbl/). `scripts/build-georgia-water.py`.
- ფოტოები: **Wikimedia Commons** (ავტორი და ლიცენზია ყოველ ფოტოსთან); ციფრები: **Wikidata** (CC0); მოკლე აღწერები: **ვიკიპედია** (CC BY-SA 4.0). `scripts/build-georgia-media.py`.
- რელიეფი: AWS Terrain Tiles (Mapzen); საზღვრები: geoBoundaries (CC BY 3.0).

დნმ-ის მოლეკულები: **RCSB Protein Data Bank** — 1BNA (Drew et al., 1981) და 1KX5 (Davey et al., 2002),
მონაცემები [CC0](https://www.rcsb.org/pages/usage-policy). `public/dna/dna.json` იქმნება `scripts/build-dna.mjs`-ით.

სასწავლო მასალა — არ ცვლის ექიმის შეფასებას.
