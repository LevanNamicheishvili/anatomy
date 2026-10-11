import * as THREE from "three";

/*
 * The Earth itself: a textured sphere (NASA Blue Marble, public domain), a soft atmosphere rim and a
 * star field. While the photo loads, the sphere shows plain ocean blue so the scene is never empty.
 */

export const EARTH_TEXTURE = "/geo/earth-blue-marble.jpg";

export function earthMesh(radius: number, onLoad?: () => void) {
  const material = new THREE.MeshStandardMaterial({ color: "#2a5d9a", roughness: 0.85, metalness: 0 });
  new THREE.TextureLoader().load(EARTH_TEXTURE, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    material.map = tex;
    material.color.set("#ffffff");
    material.needsUpdate = true;
    onLoad?.();
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), material);
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
