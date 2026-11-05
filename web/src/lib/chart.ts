import {
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

// Liest die Farben aus den CSS-Variablen, damit die Diagramme im hellen und dunklen Modus passen.
export function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    ink: v('--ink'),
    muted: v('--muted'),
    line: v('--line'),
    accent: v('--accent'),
    second: v('--second'),
    hr: v('--hr'),
    surface: v('--surface'),
  };
}

export function baseOptions() {
  const c = themeColors();
  Chart.defaults.font.family = "'Archivo', system-ui, sans-serif";
  Chart.defaults.color = c.muted;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.ink,
        titleColor: c.surface,
        bodyColor: c.surface,
        padding: 10,
        cornerRadius: 6,
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: c.line }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
      y: { grid: { color: c.line }, border: { display: false }, beginAtZero: true },
    },
  };
}
