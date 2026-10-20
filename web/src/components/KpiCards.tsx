import type { Metrics } from '../types';

export default function KpiCards({ metrics: m }: { metrics: Metrics }) {
  const cards: [string, string][] = [
    ['Dauer', `${Math.round(m.durationMin)} min`],
    ['Strecke', `${m.distanceKm.toFixed(2)} km`],
    ['Max. Tempo', `${m.maxSpeedKmh.toFixed(1)} km/h`],
    ['Ø Tempo', `${m.avgSpeedKmh.toFixed(1)} km/h`],
    ['Ø Puls', m.avgHr ? `${Math.round(m.avgHr)} bpm` : '–'],
    ['Max. Puls', m.maxHr ? `${m.maxHr} bpm` : '–'],
    ['Sprints', m.sprints.toString()],
  ];

  return (
    <div className="cards">
      {cards.map(([label, value]) => (
        <div className="card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
