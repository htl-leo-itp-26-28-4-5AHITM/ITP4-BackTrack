import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import type { Metrics } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const COLOR_A = '#FF5A1F';
const COLOR_B = '#5B8DEF';

interface Player {
  name: string;
  metrics: Metrics;
}

// Vergleich von zwei Spielern: Kennzahlen nebeneinander und Tempo über die Zeit.
export default function Comparison({ a, b }: { a: Player; b: Player }) {
  const kpis: [string, (m: Metrics) => number][] = [
    ['Strecke (km)', (m) => m.distanceKm],
    ['Max. Tempo (km/h)', (m) => m.maxSpeedKmh],
    ['Ø Tempo (km/h)', (m) => m.avgSpeedKmh],
    ['Sprints', (m) => m.sprints],
  ];

  const minutes = Math.max(a.metrics.speedSeries.length, b.metrics.speedSeries.length);

  return (
    <div className="comparison">
      <div className="chart-box">
        <h3>Kennzahlen</h3>
        <Bar
          data={{
            labels: kpis.map(([label]) => label),
            datasets: [a, b].map((p, i) => ({
              label: p.name,
              data: kpis.map(([, get]) => Number(get(p.metrics).toFixed(2))),
              backgroundColor: i === 0 ? COLOR_A : COLOR_B,
            })),
          }}
        />
      </div>
      <div className="chart-box">
        <h3>Ø Tempo pro Minute (km/h)</h3>
        <Line
          data={{
            labels: Array.from({ length: minutes }, (_, i) => `${i}'`),
            datasets: [a, b].map((p, i) => ({
              label: p.name,
              data: p.metrics.speedSeries.map((s) => Number(s.kmh.toFixed(1))),
              borderColor: i === 0 ? COLOR_A : COLOR_B,
              backgroundColor: i === 0 ? COLOR_A : COLOR_B,
              pointRadius: 0,
              tension: 0.3,
            })),
          }}
        />
      </div>
    </div>
  );
}
