import type { Metrics, Track } from '../types';
import PitchHeatmap from '../components/PitchHeatmap';
import { CompareSpeedChart } from '../components/Charts';
import { fmt } from '../lib/format';

export interface Choice {
  id: string;
  label: string;
}

interface Props {
  a: Track;
  b: Track;
  metrics: Map<string, Metrics>; // muss Werte für a und b enthalten
  optionsA: Choice[]; // Auswahl links
  optionsB?: Choice[]; // Auswahl rechts, sonst wie links
  onChange: (a: string, b: string) => void;
}

const ROWS: [string, (m: Metrics) => number, (v: number) => string][] = [
  ['Strecke', (m) => m.distanceKm, (v) => `${fmt.km(v)} km`],
  ['Intensität', (m) => m.metersPerMin, (v) => `${fmt.int(v)} m/min`],
  ['Top-Speed', (m) => m.maxSpeedKmh, (v) => `${fmt.kmh(v)} km/h`],
  ['Ø Tempo', (m) => m.avgSpeedKmh, (v) => `${fmt.kmh(v)} km/h`],
  ['Sprints', (m) => m.sprints, fmt.int],
  ['Antritte', (m) => m.accelerations, fmt.int],
  ['Sprint-Strecke', (m) => m.speedZones[4].meters + m.speedZones[3].meters, (v) => `${fmt.int(v)} m`],
  ['Ø Puls', (m) => m.avgHr ?? 0, (v) => `${fmt.int(v)} bpm`],
  ['Max. Puls', (m) => m.maxHr ?? 0, (v) => `${fmt.int(v)} bpm`],
];

export default function ComparePage({ a, b, metrics, optionsA, optionsB = optionsA, onChange }: Props) {
  const ma = metrics.get(a.id)!;
  const mb = metrics.get(b.id)!;

  return (
    <div className="page">
      <section className="versus">
        <PlayerPick id="compare-a" track={a} options={optionsA} side="a" onChange={(id) => onChange(id, b.id)} />
        <span className="vs">vs</span>
        <PlayerPick id="compare-b" track={b} options={optionsB} side="b" onChange={(id) => onChange(a.id, id)} />
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Kennzahlen</h2>
        </header>
        <ul className="duel">
          {ROWS.map(([label, get, f]) => {
            const va = get(ma);
            const vb = get(mb);
            const max = Math.max(va, vb) || 1;
            return (
              <li key={label}>
                <span className={`duel-val ${va > vb ? 'lead' : ''}`}>{f(va)}</span>
                <div className="duel-bar duel-a">
                  <div style={{ width: `${(va / max) * 100}%` }} />
                </div>
                <span className="duel-label">{label}</span>
                <div className="duel-bar duel-b">
                  <div style={{ width: `${(vb / max) * 100}%` }} />
                </div>
                <span className={`duel-val ${vb > va ? 'lead' : ''}`}>{f(vb)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Tempo pro Minute</h2>
          <p className="legend">
            <span className="key key-accent" /> {a.player.name} <span className="key key-second" /> {b.player.name}
          </p>
        </header>
        <CompareSpeedChart a={{ name: a.player.name, metrics: ma }} b={{ name: b.player.name, metrics: mb }} />
      </section>

      <div className="grid-2">
        {[a, b].map((t, i) => (
          <section className="panel" key={`${t.id}-${i}`}>
            <header className="panel-head">
              <h2>
                <span className={`key ${i === 0 ? 'key-accent' : 'key-second'}`} /> {t.player.name}
              </h2>
            </header>
            <PitchHeatmap tracks={[t]} />
          </section>
        ))}
      </div>
    </div>
  );
}

function PlayerPick(props: { id: string; track: Track; options: Choice[]; side: 'a' | 'b'; onChange: (id: string) => void }) {
  const t = props.track;
  return (
    <div className={`pick pick-${props.side}`}>
      <span className="jersey">{t.player.number ?? '–'}</span>
      <div className="pick-body">
        <label htmlFor={props.id} className="muted small">
          {t.player.position ?? t.player.name}
        </label>
        <select id={props.id} value={t.id} onChange={(e) => props.onChange(e.target.value)}>
          {props.options.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
