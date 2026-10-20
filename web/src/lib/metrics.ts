import type { Metrics, Track } from '../types';
import { haversine } from './geo';

const MAX_PLAUSIBLE_KMH = 36; // schneller läuft niemand, das sind GPS-Ausreißer
const JITTER_KMH = 1; // darunter steht der Spieler, die Bewegung ist GPS-Zittern
const SMOOTHING_WINDOW = 5; // Punkte für den gleitenden Mittelwert
const SPRINT_SHARE = 0.8; // Sprint ab 80 % der Höchstgeschwindigkeit

// Berechnet die Kennzahlen eines Tracks. Später passiert das im Backend beim Upload.
export function computeMetrics(track: Track): Metrics {
  const pts = track.points;
  const speeds: number[] = [];
  let distanceM = 0;

  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i].time - pts[i - 1].time) / 1000;
    if (dt <= 0) continue;
    const d = haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
    const kmh = (d / dt) * 3.6;
    if (kmh > MAX_PLAUSIBLE_KMH) continue;
    if (kmh >= JITTER_KMH) distanceM += d;
    speeds.push(kmh);
  }

  const smoothed = speeds.map((_, i) => {
    const from = Math.max(0, i - Math.floor(SMOOTHING_WINDOW / 2));
    const window = speeds.slice(from, from + SMOOTHING_WINDOW);
    return window.reduce((a, b) => a + b, 0) / window.length;
  });
  const maxSpeedKmh = Math.max(0, ...smoothed);

  let sprints = 0;
  let inSprint = false;
  for (const kmh of smoothed) {
    const fast = kmh >= maxSpeedKmh * SPRINT_SHARE;
    if (fast && !inSprint) sprints++;
    inSprint = fast;
  }

  const durationS = (pts[pts.length - 1].time - pts[0].time) / 1000;
  const hrs = pts.map((p) => p.hr).filter((hr): hr is number => hr !== undefined);

  return {
    durationMin: durationS / 60,
    distanceKm: distanceM / 1000,
    maxSpeedKmh,
    avgSpeedKmh: durationS > 0 ? (distanceM / durationS) * 3.6 : 0,
    avgHr: hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : undefined,
    maxHr: hrs.length ? Math.max(...hrs) : undefined,
    sprints,
    speedSeries: perMinute(smoothed),
  };
}

// Durchschnittstempo pro Minute für das Diagramm (bei 1 Hz = 60 Werte pro Minute).
function perMinute(speeds: number[]) {
  const series = [];
  for (let i = 0; i < speeds.length; i += 60) {
    const chunk = speeds.slice(i, i + 60);
    series.push({ minute: i / 60, kmh: chunk.reduce((a, b) => a + b, 0) / chunk.length });
  }
  return series;
}
