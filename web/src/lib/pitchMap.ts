import { DEFAULT_PITCH, haversine, type Pitch } from './geo';

// Vermessung eines echten Platzes: vier Eckpunkte und die Eckpunkte der beiden Strafräume als GPS.
// Reihenfolge der Ecken einmal rundherum: 1 und 2 liegen an Tor A, 3 gegenüber von 2, 4 gegenüber von 1.
// Strafraum: die ersten beiden Punkte auf der Torlinie, die anderen zwei im Feld.

export type LatLon = [number, number];
export type Slot = LatLon | null;

export interface PitchMap {
  corners: Slot[]; // 4
  boxes: [Slot[], Slot[]]; // je 4: Strafraum an Tor A, an Tor B
}

export const emptyPitchMap = (): PitchMap => ({ corners: [null, null, null, null], boxes: [[null, null, null, null], [null, null, null, null]] });

export const CORNER_LABELS = ['Ecke 1 (Tor A)', 'Ecke 2 (Tor A)', 'Ecke 3 (Tor B)', 'Ecke 4 (Tor B)'];
export const BOX_LABELS = ['Torlinie links', 'Torlinie rechts', 'im Feld rechts', 'im Feld links'];

const BOX_WIDTH_M = 40.32;
const BOX_DEPTH_M = 16.5;
const EARTH_RADIUS_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

const full = (s: Slot[]): s is LatLon[] => s.every((p) => p !== null);

export function isComplete(m: PitchMap) {
  return full(m.corners) && full(m.boxes[0]) && full(m.boxes[1]);
}

export const countSet = (m: PitchMap) => [...m.corners, ...m.boxes[0], ...m.boxes[1]].filter(Boolean).length;
export const TOTAL_POINTS = 12;

// Lokale Ebene in Metern um einen Bezugspunkt (für Abstände von ein paar hundert Metern genau genug).
export function toLocal([lat, lon]: LatLon, [lat0, lon0]: LatLon) {
  return { e: rad(lon - lon0) * Math.cos(rad(lat0)) * EARTH_RADIUS_M, n: rad(lat - lat0) * EARTH_RADIUS_M };
}

export function fromLocal(e: number, n: number, [lat0, lon0]: LatLon): LatLon {
  return [lat0 + deg(n / EARTH_RADIUS_M), lon0 + deg(e / (EARTH_RADIUS_M * Math.cos(rad(lat0))))];
}

const mid = (a: LatLon, b: LatLon): LatLon => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: LatLon, b: LatLon) => haversine(a[0], a[1], b[0], b[1]);

// Länge (Tor zu Tor) und Breite in Metern, sobald alle vier Ecken gesetzt sind.
export function measure(m: PitchMap) {
  if (!full(m.corners)) return undefined;
  const [c1, c2, c3, c4] = m.corners;
  return { length: (dist(c1, c4) + dist(c2, c3)) / 2, width: (dist(c1, c2) + dist(c3, c4)) / 2 };
}

// Mittelpunkt und Drehung für die Umrechnung GPS → Spielfeld (siehe geo.ts).
export function toGeoPitch(m: PitchMap): Pitch | undefined {
  if (!full(m.corners)) return undefined;
  const [c1, c2, c3, c4] = m.corners;
  const center: LatLon = [(c1[0] + c2[0] + c3[0] + c4[0]) / 4, (c1[1] + c2[1] + c3[1] + c4[1]) / 4];
  const a = toLocal(mid(c1, c2), center);
  const b = toLocal(mid(c3, c4), center);
  return { centerLat: center[0], centerLon: center[1], rotationDeg: deg(Math.atan2(b.n - a.n, b.e - a.e)) };
}

// Strafräume nach Normmaß (40,32 m × 16,5 m) aus den vier Ecken berechnen.
export function autoBoxes(corners: Slot[]): PitchMap['boxes'] | undefined {
  if (!full(corners)) return undefined;
  const [c1, c2, c3, c4] = corners;
  const origin = c1;
  const L = (p: LatLon) => toLocal(p, origin);
  const box = (g1: LatLon, g2: LatLon, other: LatLon): Slot[] => {
    const a = L(g1);
    const b = L(g2);
    const o = L(other);
    const len = Math.hypot(b.e - a.e, b.n - a.n) || 1;
    const u = { e: (b.e - a.e) / len, n: (b.n - a.n) / len };
    const m = { e: (a.e + b.e) / 2, n: (a.n + b.n) / 2 };
    const depthLen = Math.hypot(o.e - m.e, o.n - m.n) || 1;
    const v = { e: (o.e - m.e) / depthLen, n: (o.n - m.n) / depthLen };
    const half = Math.min(BOX_WIDTH_M / 2, len * 0.3);
    const depth = Math.min(BOX_DEPTH_M, depthLen * 0.2);
    const p = (s: number, d: number) => fromLocal(m.e + u.e * s + v.e * d, m.n + u.n * s + v.n * d, origin);
    return [p(-half, 0), p(half, 0), p(half, depth), p(-half, depth)];
  };
  return [box(c1, c2, mid(c3, c4)), box(c4, c3, mid(c1, c2))];
}

// Normplatz 105 × 68 m um den Beispielplatz, zum Ausprobieren ohne Vermessung.
export function samplePitchMap(): PitchMap {
  const o: LatLon = [DEFAULT_PITCH.centerLat, DEFAULT_PITCH.centerLon];
  const corners: LatLon[] = [
    fromLocal(-52.5, -34, o),
    fromLocal(-52.5, 34, o),
    fromLocal(52.5, 34, o),
    fromLocal(52.5, -34, o),
  ];
  return { corners, boxes: autoBoxes(corners)! };
}

// "48.2683, 14.253" oder "48,2683 14,253" einlesen.
export function parseLatLon(text: string): LatLon | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const parts = t.match(/-?\d+(?:[.,]\d+)?/g);
  if (!parts || parts.length !== 2) return undefined;
  const [lat, lon] = parts.map((p) => Number(p.replace(',', '.')));
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return [lat, lon];
}

export const formatLatLon = (p: Slot) => (p ? `${p[0].toFixed(6)}, ${p[1].toFixed(6)}` : '');

// Gespeicherte Daten robust einlesen (falls etwas fehlt).
export function readPitchMap(raw: unknown): PitchMap {
  const m = emptyPitchMap();
  const r = (raw ?? {}) as { corners?: unknown[]; boxes?: unknown[][] };
  const slot = (x: unknown): Slot => (Array.isArray(x) && x.length === 2 && x.every((n) => typeof n === 'number') ? [x[0], x[1]] : null);
  r.corners?.slice(0, 4).forEach((p, i) => (m.corners[i] = slot(p)));
  r.boxes?.slice(0, 2).forEach((b, j) => b?.slice(0, 4).forEach((p, i) => (m.boxes[j][i] = slot(p))));
  return m;
}
