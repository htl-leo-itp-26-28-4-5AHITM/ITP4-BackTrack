// Erzeugt Beispiel-GPX-Dateien (1 Hz, mit Puls) für vier Spieler, solange es noch keine
// echten Uhr- oder Tracker-Daten gibt: zwei Halbzeiten à 30 min mit 10 min Pause.
// Aufruf: npm run samples
import { writeFileSync } from 'node:fs';

const CENTER_LAT = 48.2683; // muss zu DEFAULT_PITCH in src/lib/geo.ts passen
const CENTER_LON = 14.253;
const R = 6_371_000;
const HALF_S = 30 * 60;
const BREAK_S = 10 * 60;
const START = Date.parse('2026-10-14T16:30:00Z');

// Spielfeld in Metern: x 0..105 (Länge), y 0..68 (Breite). Namen sind Beispiele.
const PLAYERS = [
  { file: 'berger-7.gpx', name: 'Lukas Berger', number: 7, position: 'Flügel', hrMax: 201, seed: 7, zone: { x: [25, 100], y: [46, 66] }, pace: 1.06 },
  { file: 'huber-10.gpx', name: 'David Huber', number: 10, position: 'Mittelfeld', hrMax: 196, seed: 10, zone: { x: [28, 82], y: [14, 54] }, pace: 1.0 },
  { file: 'wagner-4.gpx', name: 'Elias Wagner', number: 4, position: 'Innenverteidigung', hrMax: 192, seed: 4, zone: { x: [6, 50], y: [18, 50] }, pace: 0.88 },
  { file: 'mayr-9.gpx', name: 'Jonas Mayr', number: 9, position: 'Sturm', hrMax: 204, seed: 9, zone: { x: [55, 101], y: [16, 52] }, pace: 1.02 },
];

// Einfacher, reproduzierbarer Zufallsgenerator.
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const SPEEDS_KMH = [0, 5, 9, 14, 20, 27];
const SPEED_WEIGHTS = [0.08, 0.3, 0.3, 0.18, 0.09, 0.05];

function pickSpeed(rand, pace, fatigue) {
  let r = rand();
  for (let i = 0; i < SPEEDS_KMH.length; i++) {
    if ((r -= SPEED_WEIGHTS[i]) <= 0) return SPEEDS_KMH[i] * pace * fatigue * (0.9 + rand() * 0.2);
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

function generate({ file, name, seed, zone, pace, hrMax }) {
  const rand = rng(seed);
  const inZone = () => ({
    x: zone.x[0] + rand() * (zone.x[1] - zone.x[0]),
    y: zone.y[0] + rand() * (zone.y[1] - zone.y[0]),
  });

  let pos = inZone();
  let target = inZone();
  let speed = 0; // m/s, aktuell
  let wanted = pickSpeed(rand, pace, 1) / 3.6;
  let hr = 0.5 * hrMax;
  const lines = [];

  for (const [half, offset] of [[0, 0], [1, HALF_S + BREAK_S]]) {
    // Nach der Pause ist der Puls wieder unten.
    hr = 0.6 * hrMax;
    for (let t = 0; t < HALF_S; t++) {
      // In der zweiten Halbzeit und gegen Ende etwas langsamer.
      const fatigue = 1 - 0.05 * half - 0.04 * (t / HALF_S);
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1.5 || rand() < 0.05) {
        target = inZone();
        wanted = pickSpeed(rand, pace, fatigue) / 3.6;
      }
      // Beschleunigen mit bis zu 3,5 m/s², abbremsen mit bis zu 4 m/s².
      const dv = wanted - speed;
      speed += Math.max(-4, Math.min(3.5, dv));
      if (dist > 0.01) {
        const step = Math.min(speed, dist);
        pos = { x: pos.x + (dx / dist) * step, y: pos.y + (dy / dist) * step };
      }

      // Puls folgt dem Tempo mit Verzögerung.
      const hrTarget = Math.min(0.98 * hrMax, 0.62 * hrMax + speed * 3.6 * 0.016 * hrMax);
      hr += (hrTarget - hr) * 0.04 + (rand() - 0.5) * 1.5;

      // GPS-Rauschen von etwa ±0,4 m.
      const { lat, lon } = toLatLon(pos.x + (rand() - 0.5) * 0.8, pos.y + (rand() - 0.5) * 0.8);
      const time = new Date(START + (offset + t) * 1000).toISOString().replace('.000', '');
      lines.push(
        `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><time>${time}</time>` +
          `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(hr)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`,
      );
    }
  }

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BackTrack Beispieldaten" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>${name}</name><trkseg>
${lines.join('\n')}
</trkseg></trk>
</gpx>
`;
  writeFileSync(new URL(`../public/samples/${file}`, import.meta.url), gpx);
  console.log(`public/samples/${file}: ${lines.length} Punkte`);
}

PLAYERS.forEach(generate);

const index = {
  session: { title: 'Training', kind: 'Mannschaftstraining U18', place: 'Sportplatz Leonding' },
  players: PLAYERS.map(({ file, name, number, position, hrMax }) => ({ file, name, number, position, hrMax })),
};
writeFileSync(new URL('../public/samples/index.json', import.meta.url), JSON.stringify(index, null, 2) + '\n');
console.log('public/samples/index.json');
