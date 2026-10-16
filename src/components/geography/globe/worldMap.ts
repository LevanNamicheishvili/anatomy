import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { latLonToVec3 } from "./coords";
import { labelKinds, MAP_PRESETS, type MapLayers } from "./mapLayers";
import { MapLabels, type MapLabel } from "./mapLabels";

/*
 * The political map over the globe: coasts and big lakes, country borders (disputed ones dashed), Georgia's
 * outline, and the Georgian names (mapLabels.ts). What shows is set by layers (mapLayers.ts): by default only the
 * countries (borders, coasts, country names); the continents can be painted in their colours
 * (public/geo/continents.png, scripts/build-continents.py) with their names, and the details added. Data: public/geo/world-map.json, built by
 * scripts/build-world-map.py from Natural Earth. Everything sits in the globe's turning group.
 */

export const WORLD_MAP = "/geo/world-map.json";
const CONTINENTS = "/geo/continents.png";
/** The continents' colours lie just over the ground, under the lines. */
const TINT_LIFT = 0.0008;

type LineKind = "coast" | "lake" | "border" | "disputed" | "georgia";

interface WorldMapData {
  /** Coordinates are integers in 1/q of a degree; each line is [lon0, lat0, Δlon, Δlat, …]. */
  q: number;
  lines: Record<LineKind, number[][]>;
  labels: MapLabel[];
}

/** Width in CSS px (times the size factor on big screens). */
const LINE_STYLE: Record<LineKind, { color: string; width: number; opacity: number; dashed?: boolean }> = {
  coast: { color: "#d8e9ff", width: 0.9, opacity: 0.4 },
  lake: { color: "#d8e9ff", width: 0.8, opacity: 0.35 },
  border: { color: "#ffe6a0", width: 1.2, opacity: 0.85 },
  disputed: { color: "#ffe6a0", width: 1.1, opacity: 0.75, dashed: true },
  georgia: { color: "#ffd76a", width: 2.2, opacity: 1 },
};
/** Lines float this high (Earth radii): above the flat facets of the globe mesh, under the names. */
const LINE_LIFT = 0.0015;

/** One download per page, shared by every globe on it. */
let request: Promise<WorldMapData> | null = null;
function loadWorldMap() {
  request ??= fetch(WORLD_MAP)
    .then((r) => {
      if (!r.ok) throw new Error(`${WORLD_MAP}: ${r.status}`);
      return r.json() as Promise<WorldMapData>;
    })
    .catch((err) => {
      request = null;
      throw err;
    });
  return request;
}

export class WorldMap {
  readonly group = new THREE.Group();
  private materials: { mat: LineMaterial; width: number }[] = [];
  private names: MapLabels | null = null;
  private hidden: string[] = [];
  private shown: MapLayers = MAP_PRESETS.countries;
  private tint: THREE.Mesh | null = null;
  private layers: HTMLElement[] = [];
  private avoidBoxes: number[] = [];
  private clearBoxes: number[] = [];
  private size = { w: 1, h: 1, dpr: 1 };
  private disposed = false;

  constructor(private radius: number) {
    this.group.name = "world-map";
    loadWorldMap()
      .then((data) => !this.disposed && this.build(data))
      .catch(() => {
        // No map (offline, signed out): the globe works without it.
      });
  }

  private build(data: WorldMapData) {
    const r = this.radius * (1 + LINE_LIFT);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (const kind of Object.keys(LINE_STYLE) as LineKind[]) {
      const lines = data.lines[kind];
      if (!lines?.length) continue;
      const pos: number[] = [];
      for (const line of lines) {
        let lon = line[0];
        let lat = line[1];
        latLonToVec3(lat / data.q, lon / data.q, r, a);
        for (let k = 2; k < line.length; k += 2) {
          lon += line[k];
          lat += line[k + 1];
          latLonToVec3(lat / data.q, lon / data.q, r, b);
          pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
          a.copy(b);
        }
      }
      const style = LINE_STYLE[kind];
      const geometry = new LineSegmentsGeometry().setPositions(pos);
      const mat = new LineMaterial({
        color: style.color,
        linewidth: style.width,
        transparent: true,
        opacity: style.opacity,
        depthWrite: false,
        dashed: !!style.dashed,
        dashSize: 0.006,
        gapSize: 0.004,
      });
      const segments = new LineSegments2(geometry, mat);
      if (style.dashed) segments.computeLineDistances();
      segments.renderOrder = kind === "georgia" ? 3 : 2;
      segments.name = `map-${kind}`;

      this.group.add(segments);
      this.materials.push({ mat, width: style.width });
    }
    this.names = new MapLabels(data.labels, this.radius);
    this.names.setHidden(this.hidden);
    this.setLayers(this.shown);
    this.group.add(this.names.mesh);
    this.resize(this.size.w, this.size.h, this.size.dpr);
  }

  /** What the map shows: borders, the countries' names, the continents in colour, oceans and seas, capitals, cities, lakes. */
  setLayers(layers: MapLayers) {
    this.shown = layers;
    for (const name of ["map-border", "map-disputed"]) {
      const o = this.group.getObjectByName(name);
      if (o) o.visible = layers.borders;
    }
    const lakes = this.group.getObjectByName("map-lake");
    if (lakes) lakes.visible = layers.lakes;
    this.names?.setKinds(labelKinds(layers));
    if (layers.continents && !this.tint && !this.disposed) this.tint = this.continents();
    if (this.tint) this.tint.visible = layers.continents;
  }

  /** The continents in colour: a sphere just over the Earth with the continents picture (loaded when first shown). */
  private continents() {
    const mat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, roughness: 1, metalness: 0, depthWrite: false });
    new THREE.TextureLoader().load(CONTINENTS, (tex) => {
      if (this.disposed) return tex.dispose();
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      mat.map = tex;
      mat.opacity = 1;
      mat.needsUpdate = true;
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius * (1 + TINT_LIFT), 96, 64), mat);
    mesh.name = "map-continents";
    mesh.renderOrder = 1;
    this.group.add(mesh);
    return mesh;
  }

  /** Place names the lesson shows itself (its own labels): left out of the map. */
  setHidden(names: string[]) {
    this.hidden = names;
    this.names?.setHidden(names);
  }

  /**
   * The lesson's own HTML labels over the canvas (the children of `layer`): map names keep clear of those that
   * show (an inline opacity above 0, as the lessons set every frame).
   */
  avoid(layer: HTMLElement) {
    this.layers.push(layer);
  }

  /** Screen boxes (x, y, w, h in CSS px, flat) the names keep clear of, such as a ship; the lesson sets them every frame. */
  keepClear(boxes: number[]) {
    this.clearBoxes = boxes;
  }

  private lessonBoxes(canvas: HTMLElement) {
    const boxes = this.avoidBoxes;
    boxes.length = 0;
    boxes.push(...this.clearBoxes);
    if (!this.layers.length) return boxes;
    const origin = canvas.getBoundingClientRect();
    for (const layer of this.layers) {
      if (layer.classList.contains("invisible")) continue;
      for (const el of layer.children as HTMLCollectionOf<HTMLElement>) {
        const o = parseFloat(el.style.opacity);
        if (!(o > 0.05) || el.classList.contains("invisible")) continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.height) boxes.push(r.left - origin.left, r.top - origin.top, r.width, r.height);
      }
    }
    return boxes;
  }

  resize(w: number, h: number, dpr: number) {
    this.size = { w, h, dpr };
    const ui = THREE.MathUtils.clamp(Math.min(h / 620, w / 760), 1, 1.45);
    for (const { mat, width } of this.materials) {
      mat.resolution.set(w, h);
      mat.linewidth = width * ui;
    }
    this.names?.resize(w, h, dpr);
  }

  update(camera: THREE.PerspectiveCamera, earth: THREE.Object3D, canvas: HTMLElement, dt: number) {
    if (this.group.visible && this.names) this.names.update(camera, earth, canvas.clientWidth, canvas.clientHeight, dt, this.lessonBoxes(canvas));
  }

  dispose() {
    this.disposed = true;
    this.names?.dispose();
    if (this.tint) {
      const mat = this.tint.material as THREE.MeshStandardMaterial;
      mat.map?.dispose();
      mat.dispose();
      this.tint.geometry.dispose();
    }
    for (const o of this.group.children) {
      if (o instanceof LineSegments2) {
        o.geometry.dispose();
        o.material.dispose();
      }
    }
  }
}
