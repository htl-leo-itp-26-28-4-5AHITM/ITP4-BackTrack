import { useEffect, useMemo, useRef } from 'react';
import type { Track } from '../types';
import { PITCH_LENGTH_M, PITCH_WIDTH_M, toPitch } from '../lib/geo';
import { drawHeatmap } from '../lib/heatmap';

// Aufenthaltsorte auf einem 105 × 68 m Spielfeld, für einen oder mehrere Spieler.
export default function PitchHeatmap({ tracks }: { tracks: Track[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Punkte in 1-m-Felder zusammenfassen, damit nicht jeder Messpunkt einzeln gezeichnet wird.
  const bins = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of tracks) {
      for (const p of track.points) {
        const { x, y } = toPitch(p.lat, p.lon);
        if (x < 0 || x > PITCH_LENGTH_M || y < 0 || y > PITCH_WIDTH_M) continue;
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return Array.from(counts, ([key, value]) => {
      const [x, y] = key.split(',').map(Number);
      return { x: x + 0.5, y: y + 0.5, value };
    });
  }, [tracks]);

  useEffect(() => {
    const canvas = canvasRef.current!;

    function draw() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      const scale = canvas.width / PITCH_LENGTH_M;
      // Höchster Wert im Raster = volle Farbe, so bleibt die Verteilung lesbar.
      const max = Math.max(1, ...bins.map((b) => b.value)) * 1.6;
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
    <figure className="pitch-figure">
      <div className="pitch">
        <svg viewBox="0 0 105 68" className="pitch-lines" aria-hidden>
          <rect x="0.2" y="0.2" width="104.6" height="67.6" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" />
          <circle cx="52.5" cy="34" r="9.15" />
          <circle cx="52.5" cy="34" r="0.4" className="dot" />
          <rect x="0" y="13.84" width="16.5" height="40.32" />
          <rect x="88.5" y="13.84" width="16.5" height="40.32" />
          <rect x="0" y="24.84" width="5.5" height="18.32" />
          <rect x="99.5" y="24.84" width="5.5" height="18.32" />
          <circle cx="11" cy="34" r="0.4" className="dot" />
          <circle cx="94" cy="34" r="0.4" className="dot" />
          <path d="M16.5 26.7a9.15 9.15 0 010 14.6M88.5 26.7a9.15 9.15 0 000 14.6" />
        </svg>
        <canvas ref={canvasRef} className="pitch-heat" />
      </div>
      <figcaption>
        <span>105 × 68 m</span>
        <span>Spielrichtung →</span>
      </figcaption>
    </figure>
  );
}
