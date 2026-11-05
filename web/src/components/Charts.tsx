import { Bar, Line } from 'react-chartjs-2';
import type { Metrics } from '../types';
import { baseOptions, themeColors } from '../lib/chart';
import { fmt } from '../lib/format';

const minuteLabels = (m: Metrics[]) =>
  Array.from({ length: Math.max(...m.map((x) => x.series.length)) }, (_, i) => `${i}'`);

// Tempo (Fläche) und Puls (Linie) pro Minute. Die Halbzeitpause bleibt als Lücke sichtbar.
export function SpeedHrChart({ metrics }: { metrics: Metrics }) {
  const c = themeColors();
  const base = baseOptions();
  return (
    <div className="chart" style={{ height: 260 }}>
      <Line
        data={{
          labels: minuteLabels([metrics]),
          datasets: [
            {
              label: 'Tempo (km/h)',
              data: metrics.series.map((s) => s.kmh),
              borderColor: c.accent,
              backgroundColor: `${c.accent}22`,
              fill: 'origin',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.35,
              yAxisID: 'y',
            },
            {
              label: 'Puls (bpm)',
              data: metrics.series.map((s) => s.hr),
              borderColor: c.hr,
              borderWidth: 1.5,
              borderDash: [4, 3],
              pointRadius: 0,
              tension: 0.35,
              yAxisID: 'hr',
            },
          ],
        }}
        options={{
          ...base,
          scales: {
            x: base.scales.x,
            y: { ...base.scales.y, title: { display: true, text: 'km/h' } },
            hr: {
              position: 'right',
              grid: { display: false },
              border: { display: false },
              suggestedMin: 80,
              title: { display: true, text: 'bpm' },
            },
          },
        }}
      />
    </div>
  );
}

// Tempo von zwei Spielern über die Zeit.
export function CompareSpeedChart({ a, b }: { a: { name: string; metrics: Metrics }; b: { name: string; metrics: Metrics } }) {
  const c = themeColors();
  return (
    <div className="chart" style={{ height: 260 }}>
      <Line
        data={{
          labels: minuteLabels([a.metrics, b.metrics]),
          datasets: [
            { label: a.name, data: a.metrics.series.map((s) => s.kmh), borderColor: c.accent, backgroundColor: c.accent },
            { label: b.name, data: b.metrics.series.map((s) => s.kmh), borderColor: c.second, backgroundColor: c.second },
          ].map((d) => ({ ...d, borderWidth: 2, pointRadius: 0, tension: 0.35 })),
        }}
        options={{ ...baseOptions(), scales: { ...baseOptions().scales, y: { ...baseOptions().scales.y, title: { display: true, text: 'km/h' } } } }}
      />
    </div>
  );
}

// Strecke pro Spieler, sortiert, für die Übersicht.
export function DistanceChart({ rows }: { rows: { name: string; km: number }[] }) {
  const c = themeColors();
  const base = baseOptions();
  return (
    <div className="chart" style={{ height: Math.max(300, rows.length * 44) }}>
      <Bar
        data={{
          labels: rows.map((r) => r.name),
          datasets: [
            {
              label: 'Strecke (km)',
              data: rows.map((r) => Number(r.km.toFixed(2))),
              backgroundColor: rows.map((_, i) => (i === 0 ? c.accent : c.second)),
              borderRadius: 4,
              barThickness: 18,
            },
          ],
        }}
        options={{
          ...base,
          indexAxis: 'y',
          interaction: { mode: 'nearest', intersect: true },
          plugins: {
            ...base.plugins,
            tooltip: { ...base.plugins.tooltip, callbacks: { label: (ctx) => ` ${fmt.km(ctx.parsed.x ?? 0)} km` } },
          },
          scales: {
            x: { ...base.scales.y, title: { display: true, text: 'km' } },
            y: { grid: { display: false }, border: { display: false }, ticks: { color: c.ink } },
          },
        }}
      />
    </div>
  );
}
