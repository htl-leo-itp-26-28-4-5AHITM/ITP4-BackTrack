// Kleine Heatmap auf Canvas-Basis. heatmap.js (letzte Version 2016) stürzt in aktuellen
// Browsern im Strict Mode ab ("Cannot assign to read only property 'data'"), deshalb eigen.

export interface HeatPoint {
  x: number; // Pixel
  y: number;
  value: number;
}

// Farbverlauf von wenig (transparent/blau) bis viel (Orange/Rot).
const GRADIENT: [number, string][] = [
  [0.0, 'rgba(0,0,255,0)'],
  [0.25, '#2b83ff'],
  [0.5, '#2bd96b'],
  [0.75, '#ffd21f'],
  [1.0, '#ff3d00'],
];

let palette: Uint8ClampedArray | undefined;

function getPalette() {
  if (palette) return palette;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  for (const [stop, color] of GRADIENT) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  palette = ctx.getImageData(0, 0, 256, 1).data;
  return palette;
}

export function drawHeatmap(
  canvas: HTMLCanvasElement,
  points: HeatPoint[],
  options: { radius: number; max: number; maxOpacity?: number },
) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, width, height);

  // 1. Intensität als Graustufen-Alpha aufaddieren.
  for (const p of points) {
    const alpha = Math.min(1, p.value / options.max);
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, options.radius);
    grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(p.x - options.radius, p.y - options.radius, options.radius * 2, options.radius * 2);
  }

  // 2. Alpha-Wert über die Farbpalette einfärben.
  const colors = getPalette();
  const maxOpacity = options.maxOpacity ?? 0.8;
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a === 0) continue;
    px[i] = colors[a * 4];
    px[i + 1] = colors[a * 4 + 1];
    px[i + 2] = colors[a * 4 + 2];
    px[i + 3] = Math.min(a * 1.5, 255 * maxOpacity);
  }
  ctx.putImageData(image, 0, 0);
}
