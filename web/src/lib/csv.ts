import type { Metrics, Track } from '../types';

// Spaltenwerte für Excel (de-AT): Strichpunkt als Trenner, Dezimalkomma.
const dec = (v: number | undefined, digits: number) => (v === undefined ? '' : v.toFixed(digits).replace('.', ','));
const text = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function teamCsv(tracks: Track[], metrics: Map<string, Metrics>): string {
  const head = ['Nr', 'Spieler', 'Position', 'Dauer (min)', 'Strecke (km)', 'Intensität (m/min)', 'Top-Speed (km/h)',
    'Ø Tempo (km/h)', 'Sprints', 'Antritte', 'Abstopper', 'Ø Puls (bpm)', 'Max. Puls (bpm)'];
  const rows = tracks.map((t) => {
    const m = metrics.get(t.id)!;
    return [
      t.player.number?.toString() ?? '',
      text(t.player.name),
      text(t.player.position ?? ''),
      dec(m.durationMin, 0),
      dec(m.distanceKm, 2),
      dec(m.metersPerMin, 0),
      dec(m.maxSpeedKmh, 1),
      dec(m.avgSpeedKmh, 1),
      m.sprints.toString(),
      m.accelerations.toString(),
      m.decelerations.toString(),
      dec(m.avgHr, 0),
      dec(m.maxHr, 0),
    ];
  });
  return [head, ...rows].map((r) => r.join(';')).join('\r\n');
}

export function download(name: string, content: string) {
  // BOM, damit Excel die Umlaute richtig liest
  const url = URL.createObjectURL(new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
