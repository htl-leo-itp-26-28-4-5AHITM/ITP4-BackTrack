import type { Player, Track, TrackPoint } from '../types';

// Liest eine GPX-Datei (z. B. von einer Garmin- oder Polar-Uhr).
// Der Puls steht meist in <extensions> als <gpxtpx:hr> oder <ns3:hr>.
export function parseGpx(xml: string, fileName: string, player?: Player): Track {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error(`${fileName} ist keine gültige GPX-Datei.`);
  }

  const points: TrackPoint[] = [];
  for (const trkpt of Array.from(doc.getElementsByTagNameNS('*', 'trkpt'))) {
    const time = trkpt.getElementsByTagNameNS('*', 'time')[0]?.textContent;
    if (!time) continue;
    const hr = trkpt.getElementsByTagNameNS('*', 'hr')[0]?.textContent;
    points.push({
      time: Date.parse(time),
      lat: Number(trkpt.getAttribute('lat')),
      lon: Number(trkpt.getAttribute('lon')),
      hr: hr ? Number(hr) : undefined,
    });
  }
  if (points.length < 2) {
    throw new Error(`${fileName} enthält zu wenige Trackpunkte.`);
  }

  const name = doc.querySelector('trk > name')?.textContent?.trim() || fileName.replace(/\.gpx$/i, '');
  return {
    id: `${slug(name)}-${points[0].time.toString(36)}`,
    player: player ?? { name },
    points,
  };
}

function slug(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
