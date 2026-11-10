import type { Track, TrackPoint } from '../types';
import { check, supabase } from './supabase';

// Messdaten liegen in der Tabelle "tracks" (Supabase). Punkte kompakt als [zeit, lat, lon, puls].
// Welche Tracks jemand laden darf, entscheiden die Regeln in der Datenbank.

type Packed = [number, number, number, number | null];

export const pack = (points: TrackPoint[]): Packed[] => points.map((p) => [p.time, p.lat, p.lon, p.hr ?? null]);
const unpack = (rows: Packed[]): TrackPoint[] =>
  rows.map(([time, lat, lon, hr]) => (hr == null ? { time, lat, lon } : { time, lat, lon, hr }));

// Tracks ändern sich nach dem Hochladen nicht mehr, deshalb im Speicher zwischenspeichern.
const cache = new Map<string, Track>();

export const db = {
  async getTracks(ids: string[]): Promise<Track[]> {
    const missing = ids.filter((id) => !cache.has(id));
    if (missing.length) {
      const rows = check(await supabase.from('tracks').select('id, points').in('id', missing)) as { id: string; points: Packed[] }[];
      for (const r of rows) cache.set(r.id, { id: r.id, player: { name: '' }, points: unpack(r.points) });
    }
    return ids.map((id) => cache.get(id)).filter((t): t is Track => t !== undefined);
  },

  forget(ids: string[]) {
    ids.forEach((id) => cache.delete(id));
  },
};
