const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Abstand zweier GPS-Punkte in Metern.
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export const PITCH_LENGTH_M = 105;
export const PITCH_WIDTH_M = 68;

// Lage des Spielfelds: Mittelpunkt und Drehung der Längsachse gegenüber Osten.
// Vorerst fix für die Beispieldaten, später pro Verein/Platz einstellbar.
export interface Pitch {
  centerLat: number;
  centerLon: number;
  rotationDeg: number;
}

export const DEFAULT_PITCH: Pitch = { centerLat: 48.2683, centerLon: 14.253, rotationDeg: 0 };

// Rechnet GPS in Spielfeld-Meter um: x 0..105 (Länge), y 0..68 (Breite).
export function toPitch(lat: number, lon: number, pitch: Pitch = DEFAULT_PITCH) {
  const east = toRad(lon - pitch.centerLon) * Math.cos(toRad(pitch.centerLat)) * EARTH_RADIUS_M;
  const north = toRad(lat - pitch.centerLat) * EARTH_RADIUS_M;
  const r = toRad(-pitch.rotationDeg);
  const x = east * Math.cos(r) - north * Math.sin(r);
  const y = east * Math.sin(r) + north * Math.cos(r);
  return { x: x + PITCH_LENGTH_M / 2, y: PITCH_WIDTH_M / 2 - y };
}
