import type { Metrics, Track } from '../types';
import Stat from '../components/Stat';
import PitchHeatmap from '../components/PitchHeatmap';
import ZoneBars from '../components/ZoneBars';
import { SpeedHrChart } from '../components/Charts';
import { fmt } from '../lib/format';
import { rank } from '../lib/metrics';

interface Props {
  track: Track;
  metrics: Metrics;
  all: Metrics[]; // alle Spieler der Session, für den Team-Rang
  tracks: Track[];
  onSelect: (id: string) => void;
}

export default function PlayerPage({ track, metrics: m, all, tracks, onSelect }: Props) {
  const p = track.player;
  // Ab zwei Spielern: "Platz 2 von 4" unter den Kennzahlen
  const place = (get: (x: Metrics) => number | undefined) => {
    const v = get(m);
    if (all.length < 2 || v === undefined) return '';
    const values = all.map(get).filter((x): x is number => x !== undefined);
    return ` · Platz ${rank(v, values)} von ${values.length}`;
  };
  return (
    <div className="page">
      <section className="player-head">
        <span className="jersey jersey-lg">{p.number ?? '–'}</span>
        <div>
          <h2>{p.name}</h2>
          <p className="muted">
            {[p.position, `${fmt.min(m.durationMin)} min aktiv`, p.hrMax && `HFmax ${p.hrMax} bpm`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <label className="select">
          <span className="sr-only">Spieler wählen</span>
          <select id="player-select" value={track.id} onChange={(e) => onSelect(e.target.value)}>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.player.number ? `${t.player.number} · ` : ''}
                {t.player.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="stats stats-4">
        <Stat label="Strecke" value={fmt.km(m.distanceKm)} unit="km" note={`${fmt.int(m.metersPerMin)} m/min${place((x) => x.distanceKm)}`} accent />
        <Stat label="Top-Speed" value={fmt.kmh(m.maxSpeedKmh)} unit="km/h" note={`Ø ${fmt.kmh(m.avgSpeedKmh)} km/h${place((x) => x.maxSpeedKmh)}`} />
        <Stat label="Puls" value={fmt.bpm(m.avgHr)} unit="bpm Ø" note={`max. ${fmt.bpm(m.maxHr)} bpm${place((x) => x.avgHr)}`} />
        <Stat label="Sprints" value={fmt.int(m.sprints)} note={`${m.accelerations} Antritte · ${m.decelerations} Abstopper${place((x) => x.sprints)}`} />
      </div>

      <section className="panel">
        <header className="panel-head">
          <h2>Verlauf</h2>
          <p className="legend">
            <span className="key key-accent" /> Tempo <span className="key key-hr" /> Puls
          </p>
        </header>
        <SpeedHrChart metrics={m} />
      </section>

      <div className="grid-2">
        <section className="panel">
          <header className="panel-head">
            <h2>Heatmap</h2>
          </header>
          <PitchHeatmap tracks={[track]} />
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2>Halbzeiten</h2>
          </header>
          {m.halves.length === 2 ? (
            <HalvesTable halves={m.halves} />
          ) : (
            <p className="muted">Keine Halbzeitpause erkannt (Pause von mehr als 2 Minuten).</p>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <header className="panel-head">
            <h2>Strecke pro Tempozone</h2>
          </header>
          <ZoneBars
            rows={m.speedZones.map((z) => ({ label: z.label, range: z.range, value: z.meters, display: `${fmt.int(z.meters)} m` }))}
          />
        </section>
        <section className="panel">
          <header className="panel-head">
            <h2>Zeit pro Pulszone</h2>
          </header>
          <ZoneBars
            rows={m.hrZones.map((z) => ({ label: z.label, range: z.range, value: z.minutes, display: `${fmt.min(z.minutes)} min` }))}
          />
        </section>
      </div>
    </div>
  );
}

function HalvesTable({ halves }: { halves: Metrics['halves'] }) {
  const [h1, h2] = halves;
  const rows: [string, (h: typeof h1) => number, (v: number) => string][] = [
    ['Strecke (km)', (h) => h.distanceKm, fmt.km],
    ['Intensität (m/min)', (h) => h.metersPerMin, fmt.int],
    ['Top-Speed (km/h)', (h) => h.maxSpeedKmh, fmt.kmh],
    ['Sprints', (h) => h.sprints, fmt.int],
    ['Antritte', (h) => h.accelerations, fmt.int],
    ['Ø Puls (bpm)', (h) => h.avgHr ?? 0, fmt.int],
  ];
  return (
    <table className="table table-compact">
      <thead>
        <tr>
          <th />
          <th className="num">1. HZ</th>
          <th className="num">2. HZ</th>
          <th className="num">Δ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, get, f]) => {
          const a = get(h1);
          const b = get(h2);
          const diff = Math.round(a ? ((b - a) / a) * 100 : 0);
          return (
            <tr key={label}>
              <td>{label}</td>
              <td className="num">{f(a)}</td>
              <td className="num">{f(b)}</td>
              <td className={`num delta ${diff < 0 ? 'down' : diff > 0 ? 'up' : ''}`}>
                {diff > 0 ? '+' : ''}
                {fmt.int(diff)} %
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
