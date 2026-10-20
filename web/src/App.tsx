import { useEffect, useMemo, useState } from 'react';
import type { Player, Track } from './types';
import { parseGpx } from './lib/gpx';
import { computeMetrics } from './lib/metrics';
import { fmt } from './lib/format';
import { CompareIcon, PitchIcon, PlayerIcon, UploadIcon } from './components/Icons';
import Overview from './pages/Overview';
import PlayerPage from './pages/PlayerPage';
import ComparePage from './pages/ComparePage';

// Beispieldaten in public/samples, erzeugt mit `npm run samples`.
const SAMPLES = `${import.meta.env.BASE_URL}samples/`;

interface SampleIndex {
  session: { title: string; kind: string; place: string };
  players: (Player & { file: string })[];
}

// Seiten über den Hash in der Adresse: #uebersicht, #spieler-<id>, #vergleich
type Route = { page: 'overview' } | { page: 'player'; id?: string } | { page: 'compare' };

function readRoute(): Route {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('spieler')) return { page: 'player', id: hash.slice('spieler-'.length) || undefined };
  if (hash === 'vergleich') return { page: 'compare' };
  return { page: 'overview' };
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [session, setSession] = useState<SampleIndex['session']>();
  const [error, setError] = useState<string>();
  const [route, setRoute] = useState<Route>(readRoute);
  const [compare, setCompare] = useState<[string, string]>();

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    async function load() {
      const index: SampleIndex = await (await fetch(`${SAMPLES}index.json`)).json();
      const loaded = await Promise.all(
        index.players.map(async ({ file, ...player }) => parseGpx(await (await fetch(SAMPLES + file)).text(), file, player)),
      );
      setSession(index.session);
      setTracks((prev) => [...loaded, ...prev]);
    }
    load().catch(() => setError('Die Beispieldaten konnten nicht geladen werden. Läuft die Seite über npm run dev?'));
  }, []);

  async function importFiles(files: File[]) {
    try {
      const imported = await Promise.all(files.map(async (f) => parseGpx(await f.text(), f.name)));
      setTracks((prev) => [...prev, ...imported.filter((t) => !prev.some((p) => p.id === t.id))]);
      setError(undefined);
      if (imported[0]) go(`spieler-${imported[0].id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function go(hash: string) {
    window.location.hash = hash;
    window.scrollTo({ top: 0 });
  }

  const metrics = useMemo(() => new Map(tracks.map((t) => [t.id, computeMetrics(t)])), [tracks]);
  const start = tracks[0]?.points[0].time;
  const player = route.page === 'player' ? (tracks.find((t) => t.id === route.id) ?? tracks[0]) : undefined;
  const [aId, bId] = compare ?? [tracks[0]?.id, tracks[1]?.id ?? tracks[0]?.id];

  const nav = [
    { key: 'overview', hash: 'uebersicht', label: 'Übersicht', icon: <PitchIcon /> },
    { key: 'player', hash: `spieler-${player?.id ?? tracks[0]?.id ?? ''}`, label: 'Spieler', icon: <PlayerIcon /> },
    { key: 'compare', hash: 'vergleich', label: 'Vergleich', icon: <CompareIcon /> },
  ];

  const titles = { overview: 'Übersicht', player: 'Spieleranalyse', compare: 'Spielervergleich' };

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#uebersicht" aria-label="BackTrack Übersicht">
          <span className="brand-mark" aria-hidden>
            B<span>T</span>
          </span>
          <span className="brand-word">
            Back<span>Track</span>
          </span>
        </a>

        <nav className="nav">
          {nav.map((n) => (
            <a key={n.key} href={`#${n.hash}`} className={route.page === n.key ? 'nav-item active' : 'nav-item'}>
              {n.icon}
              <span>{n.label}</span>
            </a>
          ))}
        </nav>

        <label className="import">
          <UploadIcon />
          <span>GPX importieren</span>
          <input
            id="gpx-import"
            type="file"
            accept=".gpx"
            multiple
            hidden
            onChange={(e) => {
              importFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </label>

        <p className="sidebar-note">Beispieldaten aus Sportuhren (GPX), bis der eigene Tracker fertig ist.</p>
      </aside>

      <main className="main">
        <header className="topline">
          <div>
            <p className="eyebrow">
              {session ? `${session.title} · ${session.kind}` : 'Session'}
              {start && ` · ${fmt.date(start)}, ${fmt.time(start)} Uhr`}
            </p>
            <h1>{titles[route.page]}</h1>
          </div>
          {session && <span className="chip">{session.place}</span>}
        </header>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {tracks.length === 0 && !error && <p className="muted">Daten werden geladen …</p>}

        {tracks.length > 0 && route.page === 'overview' && (
          <Overview tracks={tracks} metrics={metrics} onOpen={(id) => go(`spieler-${id}`)} />
        )}
        {player && (
          <PlayerPage track={player} metrics={metrics.get(player.id)!} tracks={tracks} onSelect={(id) => go(`spieler-${id}`)} />
        )}
        {tracks.length > 0 && route.page === 'compare' && aId && bId && (
          <ComparePage tracks={tracks} metrics={metrics} aId={aId} bId={bId} onChange={(a, b) => setCompare([a, b])} />
        )}
      </main>
    </div>
  );
}
