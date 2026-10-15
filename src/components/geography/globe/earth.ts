import * as THREE from "three";

/*
 * The Earth itself: a textured sphere (NASA Blue Marble Next Generation with relief and sea depths, public
 * domain), a soft atmosphere rim and a star field. While the photo loads, the sphere shows plain ocean blue so the
 * scene is never empty. Water is smoother than land, so the sun glints on the sea; with `night`, city lights
 * (NASA Black Marble) glow on the side turned away from the sun.
 */

export const EARTH_TEXTURE = "/geo/earth-2k.jpg";
/** 4096×2048, for big screens (loaded after the small one). */
const EARTH_TEXTURE_HD = "/geo/earth-4k.jpg";
/** Roughness: water 0.45, land 1 (scripts/build-world-map.py). */
const EARTH_WATER = "/geo/earth-water.jpg";
const EARTH_NIGHT = "/geo/earth-night.jpg";

export interface EarthOptions {
  /** Load the 4096-pixel photo too (when the canvas is big and the graphics card takes it). */
  hd?: boolean;
  /** City lights on the night side; `sunView` is the direction to the sun in view space, kept current by the scene. */
  night?: { sunView: THREE.Vector3 };
}

export function earthMesh(radius: number, opts: EarthOptions = {}) {
  const material = new THREE.MeshStandardMaterial({ color: "#2a5d9a", roughness: 0.85, metalness: 0 });
  const loader = new THREE.TextureLoader();
  let disposed = false;
  const photo = (tex: THREE.Texture) => {
    if (disposed) return tex.dispose();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    material.map?.dispose();
    material.map = tex;
    material.color.set("#ffffff");
    material.needsUpdate = true;
  };
  loader.load(EARTH_TEXTURE, (tex) => {
    photo(tex);
    if (opts.hd && !disposed) loader.load(EARTH_TEXTURE_HD, photo);
  });
  loader.load(EARTH_WATER, (tex) => {
    if (disposed) return tex.dispose();
    material.roughnessMap = tex;
    material.roughness = 1;
    material.needsUpdate = true;
  });
  const uniforms = { uNight: { value: null as THREE.Texture | null }, uSunView: { value: opts.night?.sunView ?? new THREE.Vector3() } };
  // The scenes dispose the material when they close: the textures go with it (and late arrivals are dropped).
  material.addEventListener("dispose", () => {
    disposed = true;
    material.map?.dispose();
    material.roughnessMap?.dispose();
    uniforms.uNight.value?.dispose();
  });
  if (opts.night) {
    loader.load(EARTH_NIGHT, (tex) => {
      if (disposed) return tex.dispose();
      uniforms.uNight.value = tex;
    });
    material.customProgramCacheKey = () => "earth-night";
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D uNight;\nuniform vec3 uSunView;").replace(
        "#include <opaque_fragment>",
        /* glsl */ `
        #ifdef USE_MAP
          // Lights fade in past the terminator; bright enough to show through the night shade above the ground.
          float nightSide = 1.0 - smoothstep(-0.16, 0.08, dot(normalize(vNormal), uSunView));
          outgoingLight += texture2D(uNight, vMapUv).r * vec3(1.0, 0.72, 0.38) * nightSide * 3.4;
        #endif
        #include <opaque_fragment>`,
      );
    };
  }
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 80), material);
  mesh.name = "earth";
  return mesh;
}

/** Blue glow round the limb: a slightly bigger back-faced sphere, brighter where it is seen edge-on. */
export function atmosphereMesh(radius: number, color = "#5fa8ff") {
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
        gl_FragColor = vec4(uColor, rim * 0.9);
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 64, 48), material);
}

/** Deterministic star field on a far shell (same sky every visit). */
export function starField(count = 1800, radius = 60) {
  let s = 7;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(radius * (0.8 + rnd() * 0.2));
    v.toArray(pos, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: "#dfe8ff", size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.8 }));
}
