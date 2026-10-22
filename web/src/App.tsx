import { useEffect, useMemo, useState } from 'react';
import type { Track } from './types';
import { computeMetrics } from './lib/metrics';
import { fmt } from './lib/format';
import { currentUser, logout, type User } from './lib/auth';
import { importFiles, type SessionInfo } from './lib/import';
import { CompareIcon, LogoutIcon, PitchIcon, PlayerIcon, UploadIcon } from './components/Icons';
import UploadZone from './components/UploadZone';
import LoginPage from './pages/LoginPage';
import Overview from './pages/Overview';
import PlayerPage from './pages/PlayerPage';
import ComparePage from './pages/ComparePage';

// Beispiel-ZIP in public/samples: die GPX-Dateien plus index.json mit Spielernamen und Rückennummern.
const SAMPLE_ZIP = `${import.meta.env.BASE_URL}samples/beispiel-training.zip`;

// Seiten über den Hash in der Adresse: #uebersicht, #spieler-<id>, #vergleich
type Route = { page: 'overview' } | { page: 'player'; id?: string } | { page: 'compare' };

function readRoute(): Route {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('spieler')) return { page: 'player', id: hash.slice('spieler-'.length) || undefined };
  if (hash === 'vergleich') return { page: 'compare' };
  return { page: 'overview' };
}

export default function App() {
  const [user, setUser] = useState<User | undefined>(currentUser);

  if (!user) return <LoginPage onLogin={setUser} />;
  return (
    <Dashboard
      user={user}
      onLogout={() => {
        logout();
        setUser(undefined);
        window.location.hash = '';
      }}
    />
  );
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  // Nach dem Anmelden ist noch nichts geladen, bis es eine Datenbank gibt.
  const [tracks, setTracks] = useState<Track[]>([]);
  const [session, setSession] = useState<SessionInfo>();
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState<Route>(readRoute);
  const [compare, setCompare] = useState<[string, string]>();

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    const result = await importFiles(files);
    setBusy(false);
    setErrors(result.errors);
    if (result.session) setSession(result.session);
    if (!result.tracks.length) return;
    setTracks((prev) => [...prev, ...result.tracks.filter((t) => !prev.some((p) => p.id === t.id))]);
    // Ein einzelner Spieler: gleich seine Seite öffnen, sonst die Übersicht.
    go(result.tracks.length === 1 ? `spieler-${result.tracks[0].id}` : 'uebersicht');
  }

  async function loadSample() {
    const blob = await (await fetch(SAMPLE_ZIP)).blob();
    addFiles([new File([blob], 'beispiel-training.zip')]);
  }

  function go(hash: string) {
    window.location.hash = hash;
    window.scrollTo({ top: 0 });
  }

  const metrics = useMemo(() => new Map(tracks.map((t) => [t.id, computeMetrics(t)])), [tracks]);
  const start = tracks[0]?.points[0].time;
  const player = route.page === 'player' ? (tracks.find((t) => t.id === route.id) ?? tracks[0]) : undefined;
  const [aId, bId] = compare ?? [tracks[0]?.id, tracks[1]?.id ?? tracks[0]?.id];
  const empty = tracks.length === 0;

  const nav = [
    { key: 'overview', hash: 'uebersicht', label: 'Übersicht', icon: <PitchIcon /> },
    { key: 'player', hash: `spieler-${player?.id ?? tracks[0]?.id ?? ''}`, label: 'Spieler', icon: <PlayerIcon /> },
    { key: 'compare', hash: 'vergleich', label: 'Vergleich', icon: <CompareIcon /> },
  ];

  const titles = { overview: 'Übersicht', player: 'Spieleranalyse', compare: 'Spielervergleich' };
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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

        {!empty && (
          <nav className="nav">
            {nav.map((n) => (
              <a key={n.key} href={`#${n.hash}`} className={route.page === n.key ? 'nav-item active' : 'nav-item'}>
                {n.icon}
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
        )}

        {!empty && (
          <label className="import">
            <UploadIcon />
            <span>Daten hinzufügen</span>
            <input
              type="file"
              accept=".gpx,.zip"
              multiple
              hidden
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </label>
        )}

        <div className="account">
          <span className="avatar" aria-hidden>
            {initials}
          </span>
          <span className="account-who">
            <strong>{user.name}</strong>
            <span className="muted small">{user.role === 'trainer' ? 'Trainer' : 'Spieler'}</span>
          </span>
          <button className="icon-btn" onClick={onLogout} aria-label="Abmelden" title="Abmelden">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topline">
          <div>
            <p className="eyebrow">
              {empty
                ? `Hallo ${user.name.split(' ')[0]}`
                : `${session ? `${session.title} · ${session.kind}` : 'Eigene Daten'}${start ? ` · ${fmt.date(start)}, ${fmt.time(start)} Uhr` : ''}`}
            </p>
            <h1>{empty ? 'Daten hochladen' : titles[route.page]}</h1>
          </div>
          {session && !empty && <span className="chip">{session.place}</span>}
        </header>

        {errors.length > 0 && (
          <div className="error" role="alert">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}

        {empty && (
          <div className="page">
            <UploadZone onFiles={addFiles} busy={busy} />
            <p className="muted center">
              Noch keine Datei zur Hand?{' '}
              <button className="link" onClick={loadSample}>
                Beispiel-Training laden
              </button>{' '}
              oder{' '}
              <a className="link" href={SAMPLE_ZIP} download>
                Beispiel-ZIP herunterladen
              </a>
            </p>
          </div>
        )}

        {!empty && route.page === 'overview' && (
          <Overview tracks={tracks} metrics={metrics} onOpen={(id) => go(`spieler-${id}`)} />
        )}
        {!empty && player && (
          <PlayerPage
            track={player}
            metrics={metrics.get(player.id)!}
            all={[...metrics.values()]}
            tracks={tracks}
            onSelect={(id) => go(`spieler-${id}`)}
          />
        )}
        {!empty && route.page === 'compare' && aId && bId && (
          <ComparePage tracks={tracks} metrics={metrics} aId={aId} bId={bId} onChange={(a, b) => setCompare([a, b])} />
        )}
      </main>
    </div>
  );
}
