import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { latLonToVec3 } from "./coords";
import { COUNTRY_LABELS } from "./mapDetail";
import { MapLabels, type MapLabel } from "./mapLabels";

/*
 * The political map over the globe: coasts and big lakes, country borders (disputed ones dashed), Georgia's
 * outline, and the Georgian names (mapLabels.ts). By default only the countries show (borders, coasts, country
 * names); `setDetail(true)` adds the lakes and the names of oceans, seas, continents, capitals and cities. Data: public/geo/world-map.json, built by
 * scripts/build-world-map.py from Natural Earth. Everything sits in the globe's turning group.
 */

export const WORLD_MAP = "/geo/world-map.json";

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
  private detail = false;
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
      if (kind === "lake") segments.visible = this.detail;
      this.group.add(segments);
      this.materials.push({ mat, width: style.width });
    }
    this.names = new MapLabels(data.labels, this.radius);
    this.names.setHidden(this.hidden);
    this.names.setKinds(this.detail ? null : COUNTRY_LABELS);
    this.group.add(this.names.mesh);
    this.resize(this.size.w, this.size.h, this.size.dpr);
  }

  /** Countries only (false) or the details too: lakes, oceans, seas, continents, capitals, cities. */
  setDetail(on: boolean) {
    this.detail = on;
    const lakes = this.group.getObjectByName("map-lake");
    if (lakes) lakes.visible = on;
    this.names?.setKinds(on ? null : COUNTRY_LABELS);
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
    for (const o of this.group.children) {
      if (o instanceof LineSegments2) {
        o.geometry.dispose();
        o.material.dispose();
      }
    }
  }
}
