// Erzeugt Beispiel-GPX-Dateien (1 Hz, mit Puls) für zwei Spieler, solange es noch
// keine echten Uhr- oder Tracker-Daten gibt. Aufruf: npm run samples
import { writeFileSync } from 'node:fs';

const CENTER_LAT = 48.2683; // muss zu DEFAULT_PITCH in src/lib/geo.ts passen
const CENTER_LON = 14.253;
const R = 6_371_000;
const DURATION_S = 45 * 60;
const START = Date.parse('2026-10-14T17:00:00Z');

const PLAYERS = [
  { file: 'spieler-7.gpx', name: 'Spieler 7 (Flügel)', seed: 7, zone: { x: [20, 100], y: [44, 66] }, fitness: 1.05 },
  { file: 'spieler-10.gpx', name: 'Spieler 10 (Mittelfeld)', seed: 10, zone: { x: [25, 85], y: [12, 56] }, fitness: 0.95 },
];

// Einfacher, reproduzierbarer Zufallsgenerator.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const SPEEDS_KMH = [0, 5, 9, 14, 20, 27];
const SPEED_WEIGHTS = [0.08, 0.3, 0.32, 0.18, 0.08, 0.04];

function pickSpeed(rand, fitness) {
  let r = rand();
  for (let i = 0; i < SPEEDS_KMH.length; i++) {
    if ((r -= SPEED_WEIGHTS[i]) <= 0) return SPEEDS_KMH[i] * fitness * (0.9 + rand() * 0.2);
  }
  return SPEEDS_KMH[1];
}

function toLatLon(x, y) {
  const east = x - 52.5;
  const north = 34 - y;
  const lat = CENTER_LAT + ((north / R) * 180) / Math.PI;
  const lon = CENTER_LON + ((east / (R * Math.cos((CENTER_LAT * Math.PI) / 180))) * 180) / Math.PI;
  return { lat, lon };
}

function generate({ file, name, seed, zone, fitness }) {
  const rand = rng(seed);
  const inZone = () => ({
    x: zone.x[0] + rand() * (zone.x[1] - zone.x[0]),
    y: zone.y[0] + rand() * (zone.y[1] - zone.y[0]),
  });

  let pos = inZone();
  let target = inZone();
  let speed = pickSpeed(rand, fitness);
  let hr = 95;
  const lines = [];

  for (let t = 0; t <= DURATION_S; t++) {
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dist = Math.hypot(dx, dy);
    const step = speed / 3.6;
    if (dist < step || rand() < 0.03) {
      target = inZone();
      speed = pickSpeed(rand, fitness);
    } else if (step > 0) {
      pos = { x: pos.x + (dx / dist) * step, y: pos.y + (dy / dist) * step };
    }

    // Puls folgt dem Tempo mit Verzögerung.
    const hrTarget = Math.min(195, 100 + speed * 3.4);
    hr += (hrTarget - hr) * 0.05 + (rand() - 0.5) * 2;

    // GPS-Rauschen von etwa ±0,4 m.
    const { lat, lon } = toLatLon(pos.x + (rand() - 0.5) * 0.8, pos.y + (rand() - 0.5) * 0.8);
    const time = new Date(START + t * 1000).toISOString();
    lines.push(
      `      <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><time>${time}</time>` +
        `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(hr)}</gpxtpx:hr>` +
        `</gpxtpx:TrackPointExtension></extensions></trkpt>`,
    );
  }

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BackTrack Beispieldaten" xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>${name}</name>
    <trkseg>
${lines.join('\n')}
    </trkseg>
  </trk>
</gpx>
`;
  writeFileSync(new URL(`../public/samples/${file}`, import.meta.url), gpx);
  console.log(`public/samples/${file}: ${lines.length} Punkte`);
}

PLAYERS.forEach(generate);
