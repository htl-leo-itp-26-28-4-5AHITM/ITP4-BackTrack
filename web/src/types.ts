// Ein Messpunkt aus einer GPX-Datei (Uhr) bzw. später vom eigenen Tracker.
export interface TrackPoint {
  time: number; // Unix-Zeit in ms
  lat: number;
  lon: number;
  hr?: number; // Puls in bpm
}

export interface Track {
  id: string;
  playerName: string;
  points: TrackPoint[];
}

export interface Metrics {
  durationMin: number;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  avgHr?: number;
  maxHr?: number;
  sprints: number;
  speedSeries: { minute: number; kmh: number }[];
}
