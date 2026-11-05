// Ein Messpunkt aus einer GPX-Datei (Uhr) bzw. später vom eigenen Tracker.
export interface TrackPoint {
  time: number; // Unix-Zeit in ms
  lat: number;
  lon: number;
  hr?: number; // Puls in bpm
}

export interface Player {
  name: string;
  number?: number;
  position?: string;
  hrMax?: number; // persönlicher Maximalpuls für die Pulszonen
}

export interface Track {
  id: string;
  player: Player;
  points: TrackPoint[];
}

export interface Summary {
  durationMin: number;
  distanceKm: number;
  metersPerMin: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  avgHr?: number;
  maxHr?: number;
  sprints: number;
  accelerations: number;
  decelerations: number;
}

export interface Metrics extends Summary {
  halves: Summary[];
  speedZones: { label: string; range: string; meters: number }[];
  hrZones: { label: string; range: string; minutes: number }[];
  series: { minute: number; kmh: number | null; hr: number | null }[];
}
