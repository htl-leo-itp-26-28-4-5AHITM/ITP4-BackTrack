import type { Track, TrackPoint } from '../types';

// Liest eine GPX-Datei (z. B. von einer Garmin- oder Polar-Uhr).
// Der Puls steht meist in <extensions> als <gpxtpx:hr> oder <ns3:hr>.
export function parseGpx(xml: string, fallbackName: string): Track {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error(`${fallbackName}: keine gültige GPX-Datei`);
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
    throw new Error(`${fallbackName}: zu wenige Trackpunkte`);
  }

  const name = doc.querySelector('trk > name')?.textContent?.trim() || fallbackName;
  return { id: `${name}-${points[0].time}`, playerName: name, points };
}
