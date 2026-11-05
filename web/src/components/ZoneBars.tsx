interface Row {
  label: string;
  range: string;
  value: number;
  display: string;
}

// Horizontale Balken, je höher die Zone, desto kräftiger die Farbe.
export default function ZoneBars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <ul className="zones">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="zone-head">
            <span>
              {r.label} <span className="zone-range">{r.range}</span>
            </span>
            <span className="zone-value">
              {r.display} <span className="zone-share">{Math.round((r.value / total) * 100)} %</span>
            </span>
          </div>
          <div className="zone-track">
            <div
              className="zone-fill"
              style={{ width: `${(r.value / max) * 100}%`, opacity: 0.3 + (0.7 * i) / (rows.length - 1) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
