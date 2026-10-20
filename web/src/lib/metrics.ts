import type { Metrics, Summary, TrackPoint, Track } from '../types';
import { haversine } from './geo';

const MAX_PLAUSIBLE_KMH = 36; // schneller läuft niemand, das sind GPS-Ausreißer
const JITTER_KMH = 1; // darunter steht der Spieler, die Bewegung ist GPS-Zittern
const SMOOTHING_WINDOW = 3; // Punkte für den gleitenden Mittelwert
const SPRINT_SHARE = 0.8; // Sprint ab 80 % der persönlichen Höchstgeschwindigkeit
const MIN_SPRINT_KMH = 18; // damit bei sehr langsamen Einheiten nicht jedes Traben zählt
const ACCEL_MS2 = 2; // Beschleunigung/Abbremsung ab ±2 m/s²
const BREAK_S = 120; // längere Pause = Halbzeitpause
const MAX_STEP_S = 5; // größere Lücken zählen nicht als Bewegung

export const SPEED_ZONES = [
  { label: 'Gehen', from: 0, to: 7 },
  { label: 'Traben', from: 7, to: 14 },
  { label: 'Laufen', from: 14, to: 20 },
  { label: 'Schnell', from: 20, to: 25 },
  { label: 'Sprint', from: 25, to: Infinity },
];

// Anteil am persönlichen Maximalpuls.
export const HR_ZONES = [
  { label: 'Z1 Erholung', from: 0, to: 0.6 },
  { label: 'Z2 Grundlage', from: 0.6, to: 0.7 },
  { label: 'Z3 Ausdauer', from: 0.7, to: 0.8 },
  { label: 'Z4 Schwelle', from: 0.8, to: 0.9 },
  { label: 'Z5 Maximal', from: 0.9, to: Infinity },
];

interface Sample {
  time: number;
  dt: number; // s
  d: number; // m
  kmh: number; // geglättet
  hr?: number;
}

// Berechnet die Kennzahlen eines Tracks. Später passiert das im Backend beim Upload.
export function computeMetrics(track: Track): Metrics {
  const halves = splitAtBreak(track.points).map(toSamples);
  const all = halves.flat();
  const topSpeed = Math.max(0, ...all.map((s) => s.kmh));
  const sprintKmh = Math.max(MIN_SPRINT_KMH, topSpeed * SPRINT_SHARE);

  const observedMaxHr = Math.max(0, ...all.map((s) => s.hr ?? 0));
  const hrMax = track.player.hrMax ?? (observedMaxHr || 200);

  const speedZones = SPEED_ZONES.map((z) => ({
    label: z.label,
    range: z.to === Infinity ? `> ${z.from} km/h` : `${z.from}–${z.to} km/h`,
    meters: sum(all.filter((s) => s.kmh >= z.from && s.kmh < z.to).map((s) => s.d)),
  }));

  const hrZones = HR_ZONES.map((z) => ({
    label: z.label,
    range: z.to === Infinity ? `> ${Math.round(z.from * hrMax)} bpm` : `${Math.round(z.from * hrMax)}–${Math.round(z.to * hrMax)} bpm`,
    minutes:
      sum(
        all
          .filter((s) => s.hr !== undefined && s.hr / hrMax >= z.from && s.hr / hrMax < z.to)
          .map((s) => s.dt),
      ) / 60,
  }));

  return {
    ...summarize(all, sprintKmh),
    halves: halves.length > 1 ? halves.map((h) => summarize(h, sprintKmh)) : [],
    speedZones,
    hrZones,
    series: perMinute(all, track.points[0].time),
  };
}

// Teilt den Track an der längsten Pause über BREAK_S (Halbzeit).
function splitAtBreak(points: TrackPoint[]): TrackPoint[][] {
  let gapIndex = -1;
  let gapMs = BREAK_S * 1000;
  for (let i = 1; i < points.length; i++) {
    const gap = points[i].time - points[i - 1].time;
    if (gap > gapMs) {
      gapMs = gap;
      gapIndex = i;
    }
  }
  return gapIndex < 0 ? [points] : [points.slice(0, gapIndex), points.slice(gapIndex)];
}

function toSamples(points: TrackPoint[]): Sample[] {
  const raw: Sample[] = [];
  for (let i = 1; i < points.length; i++) {
    const dt = (points[i].time - points[i - 1].time) / 1000;
    if (dt <= 0 || dt > MAX_STEP_S) continue;
    const d = haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    const kmh = (d / dt) * 3.6;
    if (kmh > MAX_PLAUSIBLE_KMH) continue;
    raw.push({ time: points[i].time, dt, d: kmh >= JITTER_KMH ? d : 0, kmh, hr: points[i].hr });
  }

  const half = Math.floor(SMOOTHING_WINDOW / 2);
  return raw.map((s, i) => {
    const window = raw.slice(Math.max(0, i - half), i + half + 1);
    return { ...s, kmh: sum(window.map((w) => w.kmh)) / window.length };
  });
}

function summarize(samples: Sample[], sprintKmh: number): Summary {
  const durationS = sum(samples.map((s) => s.dt));
  const distanceM = sum(samples.map((s) => s.d));
  const hrs = samples.map((s) => s.hr).filter((hr): hr is number => hr !== undefined);

  let sprints = 0;
  let accelerations = 0;
  let decelerations = 0;
  let inSprint = false;
  let inAccel = false;
  let inDecel = false;
  for (let i = 0; i < samples.length; i++) {
    const fast = samples[i].kmh >= sprintKmh;
    if (fast && !inSprint) sprints++;
    inSprint = fast;

    if (i === 0) continue;
    const a = (samples[i].kmh - samples[i - 1].kmh) / 3.6 / samples[i].dt;
    if (a >= ACCEL_MS2 && !inAccel) accelerations++;
    if (a <= -ACCEL_MS2 && !inDecel) decelerations++;
    inAccel = a >= ACCEL_MS2;
    inDecel = a <= -ACCEL_MS2;
  }

  return {
    durationMin: durationS / 60,
    distanceKm: distanceM / 1000,
    metersPerMin: durationS > 0 ? distanceM / (durationS / 60) : 0,
    maxSpeedKmh: Math.max(0, ...samples.map((s) => s.kmh)),
    avgSpeedKmh: durationS > 0 ? (distanceM / durationS) * 3.6 : 0,
    avgHr: hrs.length ? sum(hrs) / hrs.length : undefined,
    maxHr: hrs.length ? Math.max(...hrs) : undefined,
    sprints,
    accelerations,
    decelerations,
  };
}

// Durchschnitt pro Spielminute. Minuten ohne Daten (Halbzeitpause) bleiben leer.
function perMinute(samples: Sample[], start: number) {
  const buckets = new Map<number, Sample[]>();
  for (const s of samples) {
    const minute = Math.floor((s.time - start) / 60_000);
    buckets.set(minute, [...(buckets.get(minute) ?? []), s]);
  }
  const last = Math.max(0, ...buckets.keys());
  return Array.from({ length: last + 1 }, (_, minute) => {
    const b = buckets.get(minute);
    const hrs = b?.map((s) => s.hr).filter((hr): hr is number => hr !== undefined) ?? [];
    return {
      minute,
      kmh: b ? sum(b.map((s) => s.kmh)) / b.length : null,
      hr: hrs.length ? sum(hrs) / hrs.length : null,
    };
  });
}

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}
