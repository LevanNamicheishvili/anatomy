import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

/*
 * Real models and photo textures for the nature scenes (public/models, see CREDITS.txt there): Poly Haven
 * scans (CC0) — leaves, bark, ground, shrub, rock, fern, flower, dandelion, potted plant, apple, bananas,
 * bread — and the Khronos sample Fox (CC BY 4.0). Loaded once per page and shared; scenes clone them.
 */

const BASE = "/models";
const MODELS = ["shrub", "rock", "fern", "flower", "dandelion", "potted-plant", "apple", "bananas", "bread", "fox"] as const;
export type ModelName = (typeof MODELS)[number];

export interface NatureAssets {
  leaves: THREE.Texture;
  leavesNor: THREE.Texture;
  bark: THREE.Texture;
  barkNor: THREE.Texture;
  ground: THREE.Texture;
  groundNor: THREE.Texture;
  models: Partial<Record<ModelName, GLTF>>;
}

let loaded: NatureAssets | null = null;
let pending: Promise<NatureAssets> | null = null;

/** The assets if they have been loaded (scenes fall back to drawn shapes otherwise). */
export const natureAssets = () => loaded;

export function loadNatureAssets() {
  pending ??= (async () => {
    const tl = new THREE.TextureLoader();
    const tex = async (name: string, color = true) => {
      const t = await tl.loadAsync(`${BASE}/${name}.webp`);
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    };
    const gl = new GLTFLoader();
    gl.setMeshoptDecoder(MeshoptDecoder);
    const models: Partial<Record<ModelName, GLTF>> = {};
    const [leaves, leavesNor, bark, barkNor, ground, groundNor] = await Promise.all([tex("leaves"), tex("leaves_nor", false), tex("bark"), tex("bark_nor", false), tex("ground"), tex("ground_nor", false)]);
    await Promise.all(
      MODELS.map((m) =>
        gl
          .loadAsync(`${BASE}/${m}.glb`)
          .then((g) => void (models[m] = g))
          .catch(() => undefined),
      ),
    );
    loaded = { leaves, leavesNor, bark, barkNor, ground, groundNor, models };
    return loaded;
  })();
  return pending;
}

/**
 * A copy of a model, scaled so its largest dimension (or its height with `by: "height"`) is `size`, standing
 * on y = 0 and centred in x/z. Skinned models are cloned with their skeleton.
 */
export function model(name: ModelName, size: number, by: "max" | "height" = "max") {
  const g = loaded?.models[name];
  if (!g) return null;
  const obj = (g.scene.getObjectByProperty("type", "SkinnedMesh") ? cloneSkinned(g.scene) : g.scene.clone(true)) as THREE.Object3D;
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const s = size / (by === "height" ? dim.y : Math.max(dim.x, dim.y, dim.z));
  const wrap = new THREE.Group();
  obj.scale.multiplyScalar(s);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
  obj.position.set(-c.x, -box.min.y * s, -c.z);
  wrap.add(obj);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      // Keep the shared originals alive when a scene clears its own geometry.
      m.userData.shared = true;
    }
  });
  return { root: wrap, animations: g.animations, dims: dim.multiplyScalar(s) };
}
