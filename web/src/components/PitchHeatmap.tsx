import { useEffect, useMemo, useRef } from 'react';
import type { Track } from '../types';
import { PITCH_LENGTH_M, PITCH_WIDTH_M, toPitch } from '../lib/geo';
import { drawHeatmap } from '../lib/heatmap';

// Aufenthaltsorte auf einem 105 × 68 m Spielfeld.
export default function PitchHeatmap({ track }: { track: Track }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Punkte in 1-m-Felder zusammenfassen, damit nicht jeder Messpunkt einzeln gezeichnet wird.
  const bins = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of track.points) {
      const { x, y } = toPitch(p.lat, p.lon);
      if (x < 0 || x > PITCH_LENGTH_M || y < 0 || y > PITCH_WIDTH_M) continue;
      const key = `${Math.floor(x)},${Math.floor(y)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts, ([key, value]) => {
      const [x, y] = key.split(',').map(Number);
      return { x: x + 0.5, y: y + 0.5, value };
    });
  }, [track]);

  useEffect(() => {
    const canvas = canvasRef.current!;

    function draw() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      const scale = canvas.width / PITCH_LENGTH_M;
      const max = Math.max(1, ...bins.map((b) => b.value)) * 0.5;
      drawHeatmap(
        canvas,
        bins.map((b) => ({ x: b.x * scale, y: b.y * scale, value: b.value })),
        { radius: 4 * scale, max },
      );
    }

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [bins]);

  return (
    <div className="pitch">
      <canvas ref={canvasRef} className="pitch-heat" />
      <PitchLines />
    </div>
  );
}

function PitchLines() {
  return (
    <svg viewBox={`0 0 ${PITCH_LENGTH_M} ${PITCH_WIDTH_M}`} className="pitch-lines" aria-hidden>
      <rect x="0" y="0" width="105" height="68" />
      <line x1="52.5" y1="0" x2="52.5" y2="68" />
      <circle cx="52.5" cy="34" r="9.15" />
      <rect x="0" y="13.84" width="16.5" height="40.32" />
      <rect x="88.5" y="13.84" width="16.5" height="40.32" />
      <rect x="0" y="24.84" width="5.5" height="18.32" />
      <rect x="99.5" y="24.84" width="5.5" height="18.32" />
    </svg>
  );
}
