# human-atlas.co — Behaviors

## Data
- `models/atlas.json`: `{version:"BodyParts3D 4.0", parts[2234], chunks[15], concepts[3432], triangles, sex, scope}`
- part: `{id, name, conceptId, system, chunk, positions, normals, indices, vertexCount, indexCount, bounds}`
  - byte offsets into the gunzipped chunk: positions Float32×3, normals Int16×3 (normalized), indices Uint32.
- Y up, meters (0 → 1.73). Body faces +Z; anatomical left = +X.
- concepts: `{id (FMA…), name, elements: [part ids]}` — used for search groups.
- License: BodyParts3D © The Database Center for Life Science, CC BY 4.0.

## Systems (order, label, dot color, count)
skeletal Skeleton #e2d9ba 294 · muscular Muscles #a85b50 402 · cardiac Heart #b96760 23 · sensory Sensory organs #b0c8ce 45 · arterial Arteries #c05245 639 · venous Veins #527c9f 404 · nervous Nervous system #d8b565 139 · respiratory Respiratory system #b98991 119 · digestive Digestive system #b8916b 97 · urinary Urinary system #b47961 6 · lymphatic Lymphatic system #879f7c 3 · endocrine Endocrine system #c5a09a 4 · reproductive Reproductive system #bda098 12 · integumentary Body surface #ba9b7d 5 (OFF by default) · connective Connective tissue #aec3bb 42
- Default: all on except Body surface → "2,229 pieces visible".
- Presets (segmented, aria-pressed): All / Skeleton / Organs (Organs turns off skeleton, muscles, sensory, arteries, veins).
- Row disabled: name color #8a949e, switch off. Enabled: #394957.

## Selection
- Click part (without dragging) → selects it; camera eases to frame it; selected mesh tinted mint.
- Detail sheet: accent bar (system color, 28×4), eyebrow = system name, title = part name (capitalized, 25px/600),
  description (system-level overview), note line, meta row "Atlas reference: FMA…" / "Selected pieces: n",
  "View anatomical source ↗", actions: primary "Isolate structure ›" ↔ "Show surrounding anatomy ›", "Hide structure", "Clear selection".
- Isolate: only selected parts visible, caption shows part name, "1 pieces visible".
- Hover over canvas: dark tooltip `#202e3bf5`, white 13px, radius 5, follows cursor.

## Search ("/" hotkey)
- Panel "Find a structure" with close X; input autofocused; results popover: capitalized name + piece count, rows ≥44px.
- Choosing result selects all parts of that concept/name.

## Ask anatomy
- Panel with input (placeholder "What is the role of the liver?") + "Ask" button (disabled until text), note:
  answers limited to structures in atlas, not medical advice. Submitting resolves a matching structure locally and opens its detail sheet.

## Explode
- Slider 0–100, output "N %". >0 separates every piece outward from body centre; caption → "Separated structures".
- Reset (dock) → explode 0, camera home, clear isolation.

## Views
- ¾ (default, active = filled #263b48 white text), F, S, B; divider; rotate cw / ccw (45° steps). Camera tweens.

## Info / Source & credits
- Opens right sheet: eyebrow "Source & scope", title, description, stats, disclaimer, source + links (license, original geometry, publication).

## Responsive
- ≥1400: taller rows (38px), 13px names. ≤1000: panel 222 wide, counts hidden. ≤767: top buttons icon-only 44×44, language switch below,
  view controls become a horizontal row under header, layers panel hidden → toggled by dock "Systems" button as bottom sheet,
  detail sheet becomes bottom sheet above dock, footer shows only credits link.
