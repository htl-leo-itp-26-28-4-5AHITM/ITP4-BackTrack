import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_PITCH } from '../lib/geo';
import { autoBoxes, fromLocal, toLocal, type LatLon, type PitchMap, type Slot } from '../lib/pitchMap';

interface Props {
  value: PitchMap;
  onChange: (m: PitchMap) => void;
}

// Satellitenbilder von Esri (frei nutzbar mit Quellenangabe, kein API-Key nötig).
const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = 'Satellitenbild © Esri, Maxar, Earthstar Geographics';

type Id = { group: 'c'; i: number } | { group: 'b'; box: 0 | 1; i: number };
const key = (id: Id) => (id.group === 'c' ? `c${id.i}` : `b${id.box}${id.i}`);
const label = (id: Id) => (id.group === 'c' ? String(id.i + 1) : `${id.box === 0 ? 'A' : 'B'}${id.i + 1}`);

const ALL_IDS: Id[] = [
  ...[0, 1, 2, 3].map((i) => ({ group: 'c' as const, i })),
  ...([0, 1] as const).flatMap((box) => [0, 1, 2, 3].map((i) => ({ group: 'b' as const, box, i }))),
];

const get = (m: PitchMap, id: Id): Slot => (id.group === 'c' ? m.corners[id.i] : m.boxes[id.box][id.i]);

function put(m: PitchMap, id: Id, p: Slot): PitchMap {
  if (id.group === 'c') {
    const corners = [...m.corners];
    corners[id.i] = p;
    return { ...m, corners };
  }
  const boxes: PitchMap['boxes'] = [[...m.boxes[0]], [...m.boxes[1]]];
  boxes[id.box][id.i] = p;
  return { ...m, boxes };
}

// Sind die Strafräume noch die automatisch berechneten (dann wandern sie mit den Ecken mit)?
function boxesAreAuto(m: PitchMap) {
  const auto = autoBoxes(m.corners);
  if (!auto) return true;
  const set = m.boxes.flat();
  if (set.every((p) => p === null)) return true;
  return set.every((p, i) => {
    const a = auto.flat()[i];
    if (!p || !a) return false;
    const d = toLocal(p, a);
    return Math.hypot(d.e, d.n) < 0.5;
  });
}

const full = (s: Slot[]): s is LatLon[] => s.every((p) => p !== null);

// Platz auf dem Satellitenbild markieren: Ecken anziehen, Strafräume folgen automatisch (oder einzeln ziehen).
export default function PitchMapEditor({ value, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const layers = useRef<{ field: L.Polygon; half: L.Polyline; boxes: L.Polygon[]; markers: Map<string, L.Marker> }>();
  const latest = useRef({ value, onChange, autoFollow: boxesAreAuto(value) });
  latest.current.value = value;
  latest.current.onChange = onChange;
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string>();

  // Linien und Punkte auf den Stand von m bringen.
  function draw(m: PitchMap) {
    const l = layers.current;
    const lm = map.current;
    if (!l || !lm) return;
    l.field.setLatLngs(full(m.corners) ? m.corners : []);
    l.half.setLatLngs(
      full(m.corners)
        ? [
            [(m.corners[0][0] + m.corners[3][0]) / 2, (m.corners[0][1] + m.corners[3][1]) / 2],
            [(m.corners[1][0] + m.corners[2][0]) / 2, (m.corners[1][1] + m.corners[2][1]) / 2],
          ]
        : [],
    );
    m.boxes.forEach((b, j) => l.boxes[j].setLatLngs(full(b) ? b : []));

    for (const id of ALL_IDS) {
      const p = get(m, id);
      const k = key(id);
      const marker = l.markers.get(k);
      if (!p) {
        if (marker) {
          marker.remove();
          l.markers.delete(k);
        }
        continue;
      }
      if (marker) {
        marker.setLatLng(p);
        continue;
      }
      const corner = id.group === 'c';
      const mk = L.marker(p, {
        draggable: true,
        autoPan: true,
        icon: L.divIcon({
          className: corner ? 'map-handle corner' : 'map-handle',
          html: `<span>${label(id)}</span>`,
          iconSize: corner ? [26, 26] : [22, 22],
        }),
        title: corner ? `Ecke ${label(id)}` : `Strafraum ${label(id)}`,
      });
      // Während des Ziehens nur zeichnen, gespeichert wird beim Loslassen.
      const moved = () => {
        const ll = mk.getLatLng();
        let next = put(latest.current.value, id, [ll.lat, ll.lng]);
        if (corner && latest.current.autoFollow) next = { ...next, boxes: autoBoxes(next.corners) ?? next.boxes };
        if (!corner) latest.current.autoFollow = false;
        return next;
      };
      mk.on('drag', () => draw(moved()));
      mk.on('dragend', () => latest.current.onChange(moved()));
      mk.addTo(lm);
      l.markers.set(k, mk);
    }
  }

  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true, maxZoom: 21 });
    L.tileLayer(SATELLITE, { maxNativeZoom: 19, maxZoom: 21, attribution: ATTRIBUTION }).addTo(m);
    layers.current = {
      field: L.polygon([], { color: '#ff5a1f', weight: 2.5, fillOpacity: 0.08, interactive: false }).addTo(m),
      half: L.polyline([], { color: '#ffffff', weight: 1.5, opacity: 0.8, interactive: false }).addTo(m),
      boxes: [0, 1].map(() => L.polygon([], { color: '#ffffff', weight: 2, fillOpacity: 0.05, interactive: false }).addTo(m)),
      markers: new Map(),
    };
    map.current = m;

    const pts = [...value.corners, ...value.boxes.flat()].filter((p): p is LatLon => p !== null);
    if (pts.length) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 19 });
    else m.setView([DEFAULT_PITCH.centerLat, DEFAULT_PITCH.centerLon], 17);

    // Klick auf die Karte setzt den nächsten fehlenden Punkt.
    m.on('click', (e: L.LeafletMouseEvent) => {
      const cur = latest.current.value;
      const missing = ALL_IDS.find((id) => !get(cur, id));
      if (!missing) return;
      let next = put(cur, missing, [e.latlng.lat, e.latlng.lng]);
      if (missing.group === 'c' && full(next.corners) && latest.current.autoFollow) next = { ...next, boxes: autoBoxes(next.corners)! };
      latest.current.onChange(next);
    });

    draw(value);
    return () => {
      m.remove();
      map.current = undefined;
      layers.current = undefined;
    };
    // Karte nur einmal aufbauen, Änderungen kommen über draw().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => draw(value));

  // Normplatz 105 × 68 m in die Kartenmitte legen, danach Ecken an die echten Ecken ziehen.
  function placeHere() {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    const o: LatLon = [c.lat, c.lng];
    const corners: LatLon[] = [fromLocal(-52.5, -34, o), fromLocal(-52.5, 34, o), fromLocal(52.5, 34, o), fromLocal(52.5, -34, o)];
    latest.current.autoFollow = true;
    onChange({ corners, boxes: autoBoxes(corners)! });
    m.fitBounds(L.latLngBounds(corners), { padding: [40, 40], maxZoom: 19 });
  }

  function recomputeBoxes() {
    const b = autoBoxes(value.corners);
    if (!b) return;
    latest.current.autoFollow = true;
    onChange({ ...value, boxes: b });
  }

  async function search(e: { preventDefault(): void }) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setMessage('Suche …');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
        headers: { 'Accept-Language': 'de' },
      });
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (!hit) return setMessage(`„${q}“ nicht gefunden.`);
      map.current?.setView([Number(hit.lat), Number(hit.lon)], 18);
      setMessage(undefined);
    } catch {
      setMessage('Suche gerade nicht erreichbar.');
    }
  }

  function locate() {
    if (!('geolocation' in navigator)) return setMessage('Dieser Browser kann den Standort nicht bestimmen.');
    setMessage('Standort wird bestimmt …');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.current?.setView([pos.coords.latitude, pos.coords.longitude], 18);
        setMessage(undefined);
      },
      () => setMessage('Standort konnte nicht bestimmt werden.'),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="map-editor">
      {/* Kein <form>: der Editor steckt im Formular der Vorlage. */}
      <div className="map-toolbar" role="search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(e)}
          placeholder="Sportplatz oder Adresse suchen"
          aria-label="Ort suchen"
        />
        <button type="button" className="btn" onClick={search}>
          Suchen
        </button>
        <button type="button" className="btn" onClick={locate}>
          Mein Standort
        </button>
      </div>
      {message && <p className="muted small">{message}</p>}

      <div ref={box} className="map-canvas" />

      <div className="row-actions start">
        <button type="button" className="btn btn-accept" onClick={placeHere}>
          Platz hier einsetzen
        </button>
        <button type="button" className="btn" onClick={recomputeBoxes} disabled={!full(value.corners)}>
          Strafräume neu aus Ecken berechnen
        </button>
      </div>
    </div>
  );
}
