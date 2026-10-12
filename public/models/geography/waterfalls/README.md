# Gveleti (გველეთი) waterfall hero — Draco GLB

| File | Tris | Size |
|---|---|---|
| gveleti.glb (LOD0) | 34,968 | 90 KB |
| gveleti-lod1.glb (LOD1) | 11,068 | 37 KB |

LOD0 breakdown: rock 16,018 · rock_dark 1,615 · cap 737 · soft 1,547 · veg 11,825 (plateau + 26 trees) · water 2,714 · pool 192 · mist 320.

Compression: KHR_draco_mesh_compression (gltf-transform draco). Validated with `gltf-transform validate` — no errors.
Units: metres-ish, Y up, flow along +Z. Upper bed y=14.7, tier1 lip z=0 (drop 2.2, notch 0.2), mid shelf y=12.5, tier2 notched lip z=2.8 (drop 12.5, lip 0.45), plunge pool at z≈5.8 depth 1.7, gorge halfValley 2.2, plateau y=17.7. Bbox x[-10,10] y[-1.7,19.7] z[-9,22].
Meshes carry POSITION only (no normals/UVs) — call `computeVertexNormals()` after load (or use flatShading for stylized look).

Suggested path: `public/models/geography/waterfalls/gveleti.glb`

```ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/'); // or self-host /draco/
const loader = new GLTFLoader().setDRACOLoader(draco);
loader.load('/models/geography/waterfalls/gveleti.glb', (gltf) => {
  gltf.scene.traverse((o: any) => { if (o.isMesh) { o.geometry.computeVertexNormals();
    if (o.material.name === 'gveleti_water') o.material.depthWrite = false; } });
  scene.add(gltf.scene);
});
```
(drei: `useGLTF('/models/geography/waterfalls/gveleti.glb', true)` enables Draco.)

Note: `proxy.ts` currently skips auth for `.glb` — Leo's auth fix should cover `/models/`.
Regenerate: `python build_gveleti.py <NX> <NZ> out.glb 26` (LOD0 112 140, LOD1 50 72), then `npx gltf-transform draco in.glb out.glb`.
