# human-atlas.co — Page Topology

Source: https://human-atlas.co/ (also /es/, /ko/, /ar/ — same app, localized UI; /ar/ is RTL)
Stack observed: Vite SPA, React, shadcn/Radix-style primitives, Three.js-style WebGL canvas, Inter font.
Single full-viewport "studio" (`100dvh`, no page scroll). Everything is an absolutely positioned overlay on a WebGL canvas.

## Output plan
| Item | Value |
|---|---|
| app-root | `.` |
| site-key | `human-atlas-co-f41dd540` |
| page-key | `root-8a5edab2` |
| Routes | `/` (en), `/es`, `/ko`, `/ar` (RTL) — replaces untouched scaffold `src/app/page.tsx` |
| Components | `src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/` |
| Assets | `public/sites/human-atlas-co-f41dd540/shared/{models,seo}` |

## Layers (z-order, bottom → top)
1. `.scene` — canvas (grab cursor), plus `.part-hover` tooltip (z 45)
2. `.vignette` — radial gradient overlay, pointer-events none
3. `header.identity` — top-left: eyebrow w/ status dot, H1 "Human Atlas" + "3D" badge, meta line
4. `nav.top-actions` — top-right: language switch, "Find a structure" (/ kbd), "Ask anatomy", info icon button
5. `section.layers-panel.glass` — left: Systems panel (count badge, presets All/Skeleton/Organs, 15 system rows with switch, footer: N pieces visible / Hide all)
6. `nav.view-controls.glass` — right middle: ¾ F S B | rotate-cw, rotate-ccw
7. `.scene-caption` — above dock: "— Adult human · male —" (becomes part name when isolated, "Separated structures" when exploded)
8. `.bottom-dock.glass` — bottom center: [Systems button mobile-only] Explode anatomy slider 0–100% | Reset
9. `footer.studio-footer` — "Drag to orbit · Pinch to zoom · Tap to inspect" / "Source & credits ↗"
10. Popovers: `.search-panel` (top 94 right 30, w 350), Ask panel (same slot), `.detail-sheet` (right 95, top 105, bottom 178, w 310), About sheet (right side, w 450)
11. `.loading` card (centered, 43% top) while chunks stream in

## Interaction model
- Canvas: orbit (drag), zoom (wheel/pinch), click = select part, hover = tooltip with part name.
- All panels: click-driven. No scroll-driven behavior, no smooth-scroll lib (page does not scroll).
