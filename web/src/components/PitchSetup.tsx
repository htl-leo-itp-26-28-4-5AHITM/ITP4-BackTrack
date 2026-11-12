import { useState } from 'react';
import {
  autoBoxes,
  BOX_LABELS,
  CORNER_LABELS,
  countSet,
  formatLatLon,
  measure,
  parseLatLon,
  samplePitchMap,
  toGeoPitch,
  toLocal,
  TOTAL_POINTS,
  type LatLon,
  type PitchMap,
  type Slot,
} from '../lib/pitchMap';
import { fmt } from '../lib/format';
import PitchMapEditor from './PitchMapEditor';

interface Props {
  value: PitchMap;
  onChange: (m: PitchMap) => void;
}

type Key = { group: 'corners' } | { group: 'box'; box: 0 | 1 };

// Platz vermessen. Standard: auf dem Satellitenbild die Ecken anziehen.
// Zweite Möglichkeit: Punkte per GPS am Platz setzen oder Koordinaten einfügen.
export default function PitchSetup({ value, onChange }: Props) {
  const [mode, setMode] = useState<'map' | 'coords'>('map');
  const size = measure(value);
  return (
    <div className="pitch-mode">
      <div className="seg" role="tablist" aria-label="Art der Vermessung">
        <button type="button" role="tab" aria-selected={mode === 'map'} className={mode === 'map' ? 'on' : ''} onClick={() => setMode('map')}>
          Satellitenkarte
        </button>
        <button type="button" role="tab" aria-selected={mode === 'coords'} className={mode === 'coords' ? 'on' : ''} onClick={() => setMode('coords')}>
          Koordinaten / GPS
        </button>
      </div>

      {mode === 'map' ? (
        <>
          <p className="muted small">
            Platz suchen, <strong>Platz hier einsetzen</strong> drücken und die orangen Ecken <strong>1–4</strong> auf die Eckpunkte
            des Spielfelds ziehen (1 und 2 an Tor A). Die Strafräume (A1–B4) wandern automatisch mit und lassen sich einzeln
            nachziehen. Alternativ setzt jeder Klick in die Karte den nächsten fehlenden Punkt.
          </p>
          <PitchMapEditor value={value} onChange={onChange} />
          <p className="muted small center">
            {countSet(value)} von {TOTAL_POINTS} Punkten gesetzt
            {size && ` · ${fmt.int(size.length)} × ${fmt.int(size.width)} m`}
          </p>
        </>
      ) : (
        <CoordinateSetup value={value} onChange={onChange} />
      )}
    </div>
  );
}

function CoordinateSetup({ value, onChange }: Props) {
  const [locating, setLocating] = useState<string>();
  const [gpsError, setGpsError] = useState<string>();
  const size = measure(value);
  const boxes = autoBoxes(value.corners);

  function set(key: Key, i: number, p: Slot) {
    if (key.group === 'corners') {
      const corners = [...value.corners];
      corners[i] = p;
      onChange({ ...value, corners });
    } else {
      const b: PitchMap['boxes'] = [[...value.boxes[0]], [...value.boxes[1]]];
      b[key.box][i] = p;
      onChange({ ...value, boxes: b });
    }
  }

  function locate(id: string, key: Key, i: number) {
    if (!('geolocation' in navigator)) return setGpsError('Dieser Browser kann den Standort nicht bestimmen.');
    setLocating(id);
    setGpsError(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(undefined);
        set(key, i, [pos.coords.latitude, pos.coords.longitude]);
        if (pos.coords.accuracy > 10) setGpsError(`Standort nur auf etwa ${Math.round(pos.coords.accuracy)} m genau. Kurz warten und nochmal setzen.`);
      },
      (err) => {
        setLocating(undefined);
        setGpsError(err.code === err.PERMISSION_DENIED ? 'Standortzugriff wurde nicht erlaubt.' : 'Standort konnte nicht bestimmt werden.');
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  const row = (id: string, label: string, p: Slot, key: Key, i: number) => (
    <PointRow key={id} id={id} label={label} value={p} busy={locating === id} onSet={(v) => set(key, i, v)} onLocate={() => locate(id, key, i)} />
  );

  return (
    <div className="pitch-setup">
      <div className="pitch-points">
        <p className="muted small">
          Am Platz zu jedem Punkt gehen und <strong>Hier</strong> drücken, oder Koordinaten einfügen (z. B. Rechtsklick in Google Maps).
          Ecken einmal rundherum: 1 und 2 an Tor A, 3 und 4 an Tor B.
        </p>

        <fieldset>
          <legend>Eckpunkte des Platzes</legend>
          {value.corners.map((p, i) => row(`c${i}`, `${i + 1} · ${CORNER_LABELS[i]}`, p, { group: 'corners' }, i))}
        </fieldset>

        {([0, 1] as const).map((b) => (
          <fieldset key={b}>
            <legend>Strafraum Tor {b === 0 ? 'A' : 'B'}</legend>
            {value.boxes[b].map((p, i) => row(`b${b}${i}`, `${b === 0 ? 'A' : 'B'}${i + 1} · ${BOX_LABELS[i]}`, p, { group: 'box', box: b }, i))}
          </fieldset>
        ))}

        {gpsError && <p className="form-error">{gpsError}</p>}

        <div className="row-actions start">
          <button type="button" className="btn" disabled={!boxes} onClick={() => boxes && onChange({ ...value, boxes })}>
            Strafräume aus Ecken berechnen
          </button>
          <button type="button" className="btn" onClick={() => onChange(samplePitchMap())}>
            Beispielplatz einsetzen
          </button>
        </div>
      </div>

      <figure className="pitch-preview">
        <PitchPreview value={value} />
        <figcaption className="muted small">
          {countSet(value)} von {TOTAL_POINTS} Punkten gesetzt
          {size && ` · ${fmt.int(size.length)} × ${fmt.int(size.width)} m`}
        </figcaption>
      </figure>
    </div>
  );
}

function PointRow({
  id,
  label,
  value,
  busy,
  onSet,
  onLocate,
}: {
  id: string;
  label: string;
  value: Slot;
  busy: boolean;
  onSet: (p: Slot) => void;
  onLocate: () => void;
}) {
  const [bad, setBad] = useState(false);
  return (
    <div className="point-row">
      <label htmlFor={`pt-${id}`}>{label}</label>
      <input
        id={`pt-${id}`}
        key={formatLatLon(value)}
        defaultValue={formatLatLon(value)}
        placeholder="48.268300, 14.253000"
        aria-invalid={bad}
        onBlur={(e) => {
          const p = parseLatLon(e.target.value);
          setBad(p === undefined);
          if (p !== undefined && formatLatLon(p) !== formatLatLon(value)) onSet(p);
        }}
      />
      <button type="button" className="btn" onClick={onLocate} disabled={busy}>
        {busy ? '…' : 'Hier'}
      </button>
    </div>
  );
}

// Skizze der gesetzten Punkte, längs gedreht, sobald alle vier Ecken da sind.
function PitchPreview({ value }: { value: PitchMap }) {
  const W = 320;
  const H = 220;
  const pad = 22;
  const all = [...value.corners, ...value.boxes[0], ...value.boxes[1]].filter((p): p is LatLon => p !== null);

  if (!all.length) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="pitch-sketch" role="img" aria-label="Noch keine Punkte gesetzt">
        <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} rx="4" className="sketch-empty" />
        <text x={W / 2} y={H / 2} textAnchor="middle" className="sketch-hint">
          Noch keine Punkte
        </text>
      </svg>
    );
  }

  const origin: LatLon = [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length];
  const geo = toGeoPitch(value);
  const turn = geo ? (-geo.rotationDeg * Math.PI) / 180 : 0;
  const local = (p: LatLon) => {
    const { e, n } = toLocal(p, origin);
    return { x: e * Math.cos(turn) - n * Math.sin(turn), y: -(e * Math.sin(turn) + n * Math.cos(turn)) };
  };
  const pts = all.map(local);
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const scale = Math.min((W - 2 * pad) / Math.max(maxX - minX, 1), (H - 2 * pad) / Math.max(maxY - minY, 1));
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxY - minY) * scale) / 2;
  const xy = (p: LatLon) => {
    const l = local(p);
    return { x: ox + (l.x - minX) * scale, y: oy + (l.y - minY) * scale };
  };
  const poly = (s: Slot[]) =>
    s.every(Boolean)
      ? s
          .map((p) => xy(p as LatLon))
          .map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`)
          .join(' ')
      : undefined;

  const field = poly(value.corners);
  const c = value.corners;
  const half = c.every(Boolean)
    ? [xy([(c[0]![0] + c[3]![0]) / 2, (c[0]![1] + c[3]![1]) / 2]), xy([(c[1]![0] + c[2]![0]) / 2, (c[1]![1] + c[2]![1]) / 2])]
    : undefined;

  const dots: { p: LatLon; label: string; corner: boolean }[] = [
    ...value.corners.flatMap((p, i) => (p ? [{ p, label: String(i + 1), corner: true }] : [])),
    ...value.boxes.flatMap((b, j) => b.flatMap((p, i) => (p ? [{ p, label: `${j === 0 ? 'A' : 'B'}${i + 1}`, corner: false }] : []))),
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pitch-sketch" role="img" aria-label="Skizze des vermessenen Platzes">
      {field && <polygon points={field} className="sketch-field" />}
      {half && <line x1={half[0].x} y1={half[0].y} x2={half[1].x} y2={half[1].y} className="sketch-line" />}
      {value.boxes.map((b, j) => {
        const pl = poly(b);
        return pl ? <polygon key={j} points={pl} className="sketch-box" /> : null;
      })}
      {dots.map(({ p, label, corner }) => {
        const q = xy(p);
        return (
          <g key={label} className={corner ? 'sketch-dot corner' : 'sketch-dot'}>
            <circle cx={q.x} cy={q.y} r={corner ? 4 : 3} />
            <text x={q.x} y={q.y - 7} textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
