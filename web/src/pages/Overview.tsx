import { useState } from 'react';
import type { Metrics, Track } from '../types';
import Stat from '../components/Stat';
import PitchHeatmap from '../components/PitchHeatmap';
import { DistanceChart } from '../components/Charts';
import { ArrowIcon, DownloadIcon } from '../components/Icons';
import { fmt } from '../lib/format';
import { download, teamCsv } from '../lib/csv';

interface Props {
  tracks: Track[];
  metrics: Map<string, Metrics>;
  onOpen: (id: string) => void;
}

type SortKey = 'number' | 'distanceKm' | 'metersPerMin' | 'maxSpeedKmh' | 'sprints' | 'avgHr';

const COLUMNS: { key: SortKey; label: string; unit?: string }[] = [
  { key: 'distanceKm', label: 'Strecke', unit: 'km' },
  { key: 'metersPerMin', label: 'Intensität', unit: 'm/min' },
  { key: 'maxSpeedKmh', label: 'Top-Speed', unit: 'km/h' },
  { key: 'sprints', label: 'Sprints' },
  { key: 'avgHr', label: 'Ø Puls', unit: 'bpm' },
];

export default function Overview({ tracks, metrics, onOpen }: Props) {
  const [sort, setSort] = useState<SortKey>('distanceKm');

  const rows = tracks.map((t) => ({ track: t, m: metrics.get(t.id)! }));
  const value = (r: (typeof rows)[number], key: SortKey) =>
    key === 'number' ? -(r.track.player.number ?? 99) : (r.m[key] ?? 0);
  const sorted = [...rows].sort((a, b) => value(b, sort) - value(a, sort));

  const totalKm = rows.reduce((a, r) => a + r.m.distanceKm, 0);
  const fastest = rows.reduce((best, r) => (r.m.maxSpeedKmh > best.m.maxSpeedKmh ? r : best), rows[0]);
  const sprints = rows.reduce((a, r) => a + r.m.sprints, 0);
  const hrs = rows.map((r) => r.m.avgHr).filter((v): v is number => v !== undefined);
  const byDistance = [...rows].sort((a, b) => b.m.distanceKm - a.m.distanceKm);

  return (
    <div className="page">
      <div className="stats stats-4">
        <Stat label="Gesamtstrecke" value={fmt.km(totalKm)} unit="km" note={`${rows.length} Spieler`} accent />
        <Stat label="Ø pro Spieler" value={fmt.km(totalKm / rows.length)} unit="km" />
        <Stat
          label="Top-Speed"
          value={fmt.kmh(fastest.m.maxSpeedKmh)}
          unit="km/h"
          note={fastest.track.player.name}
        />
        <Stat
          label="Sprints gesamt"
          value={fmt.int(sprints)}
          note={hrs.length ? `Ø Puls ${fmt.bpm(hrs.reduce((a, b) => a + b, 0) / hrs.length)} bpm` : undefined}
        />
      </div>

      <section className="panel">
        <header className="panel-head">
          <h2>Spieler</h2>
          <p className="muted">Sortieren über die Spaltenköpfe. Ein Klick auf eine Zeile öffnet die Details.</p>
          <button
            className="btn"
            onClick={() => download('backtrack-team.csv', teamCsv(sorted.map((r) => r.track), metrics))}
          >
            <DownloadIcon />
            CSV exportieren
          </button>
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button className={sort === 'number' ? 'th active' : 'th'} onClick={() => setSort('number')}>
                    Spieler
                  </button>
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="num">
                    <button className={sort === c.key ? 'th active' : 'th'} onClick={() => setSort(c.key)}>
                      {c.label}
                      {c.unit && <span className="unit">{c.unit}</span>}
                    </button>
                  </th>
                ))}
                <th aria-label="Öffnen" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ track, m }) => (
                <tr key={track.id} onClick={() => onOpen(track.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(track.id)}>
                  <td>
                    <div className="who">
                      <span className="jersey">{track.player.number ?? '–'}</span>
                      <span>
                        <strong>{track.player.name}</strong>
                        <span className="muted small">{track.player.position ?? 'Eigene Datei'}</span>
                      </span>
                    </div>
                  </td>
                  <td className="num">{fmt.km(m.distanceKm)}</td>
                  <td className="num">{fmt.int(m.metersPerMin)}</td>
                  <td className="num">{fmt.kmh(m.maxSpeedKmh)}</td>
                  <td className="num">{m.sprints}</td>
                  <td className="num">{fmt.bpm(m.avgHr)}</td>
                  <td className="go">
                    <ArrowIcon />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <header className="panel-head">
            <h2>Team-Heatmap</h2>
            <p className="muted">Wo sich die Mannschaft aufgehalten hat.</p>
          </header>
          <PitchHeatmap tracks={tracks} />
        </section>
        <section className="panel">
          <header className="panel-head">
            <h2>Laufleistung</h2>
            <p className="muted">Gesamtstrecke pro Spieler.</p>
          </header>
          <DistanceChart rows={byDistance.map((r) => ({ name: r.track.player.name, km: r.m.distanceKm }))} />
        </section>
      </div>
    </div>
  );
}
