import * as THREE from "three";

/*
 * Snow by the season: a shell just above the ground, white on land beyond the snow line of the date (and on the
 * frozen sea further out), so the Earth shows where it is winter. School-level model: the northern snow line runs
 * at ~44° in January and withdraws to ~74° in July (the Caucasus and the Russian plain white in winter, only the
 * Arctic in summer), the southern one from ~72° (only Antarctica) to ~56° (the tip of South America); it wavers with
 * longitude so it is not a ruler-straight edge. Lit like the ground, so it is dark on the night side.
 */

/** Roughness picture of the Earth: land white, water grey (scripts/build-world-map.py) — used as the land mask. */
const LAND_MASK = "/geo/earth-water.jpg";

/** Latitude of the snow line in each hemisphere on a day of the year (1–365). */
export function snowLines(day: number) {
  const c = Math.cos((2 * Math.PI * (day - 20)) / 365); // 1 in late January, −1 in late July
  return { north: 59 - 15 * c, south: -(64 + 8 * c) };
}

/**
 * A maker of snow shells that share one land mask (several Earths in one scene, each on its own date). The mask
 * goes when the last shell's material is disposed.
 */
export function snowShells() {
  let mask: THREE.Texture | null = null;
  let users = 0;
  let disposed = false;
  const waiting: ((t: THREE.Texture) => void)[] = [];
  new THREE.TextureLoader().load(LAND_MASK, (tex) => {
    if (disposed) return tex.dispose();
    mask = tex;
    for (const f of waiting) f(tex);
    waiting.length = 0;
  });

  return function shell(radius: number, day = 172) {
    const uniforms = { uLand: { value: mask }, uNorth: { value: 60 }, uSouth: { value: -70 } };
    const material = new THREE.MeshStandardMaterial({ color: "#f4f8ff", roughness: 0.9, metalness: 0, transparent: true, depthWrite: false, opacity: mask ? 1 : 0 });
    if (!mask)
      waiting.push((tex) => {
        uniforms.uLand.value = tex;
        material.opacity = 1;
      });
    users++;
    material.addEventListener("dispose", () => {
      if (--users > 0) return;
      disposed = true;
      mask?.dispose();
    });
    material.customProgramCacheKey = () => "season-snow";
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vSnowUv;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvSnowUv = uv;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D uLand;\nuniform float uNorth;\nuniform float uSouth;\nvarying vec2 vSnowUv;").replace(
        "#include <alphamap_fragment>",
        /* glsl */ `
        #include <alphamap_fragment>
        {
          float lat = (vSnowUv.y - 0.5) * 180.0;
          float lon = vSnowUv.x * 6.2831853;
          float wob = 2.5 * sin(lon * 3.0 + 1.3) + 1.5 * sin(lon * 7.0 + 0.4) + sin(lon * 13.0 + 2.1);
          float land = smoothstep(0.7, 0.9, texture2D(uLand, vSnowUv).r);
          float north = smoothstep(uNorth + wob - 2.0, uNorth + wob + 2.0, lat);
          float south = 1.0 - smoothstep(uSouth - wob - 2.0, uSouth - wob + 2.0, lat);
          // The sea freezes further out than the land's snow line (and the Arctic Ocean keeps its ice all year).
          float iceN = min(uNorth + 17.0, 82.0) + wob;
          float iceS = uSouth - 6.0 - wob;
          float ice = smoothstep(iceN - 2.0, iceN + 2.0, lat) + 1.0 - smoothstep(iceS - 2.0, iceS + 2.0, lat);
          diffuseColor.a *= max(land * max(north, south) * 0.88, (1.0 - land) * min(ice, 1.0) * 0.7);
        }`,
      );
    };
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.0015, 96, 64), material);
    mesh.name = "snow";
    const setDay = (d: number) => {
      const s = snowLines(d);
      uniforms.uNorth.value = s.north;
      uniforms.uSouth.value = s.south;
    };
    setDay(day);
    return { mesh, setDay };
  };
}
