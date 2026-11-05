import { useEffect, useMemo, useState } from 'react';
import type { Track } from '../types';
import { computeMetrics } from '../lib/metrics';
import { fmt } from '../lib/format';
import { createPlayerAccount, hasAccount, type User } from '../lib/auth';
import { importFiles } from '../lib/import';
import { useClub, withMember } from '../lib/club';
import { db } from '../lib/db';
import { go, useRoute } from '../lib/route';
import { CompareIcon, PitchIcon, PlayerIcon, TeamIcon, UploadIcon } from '../components/Icons';
import Shell from '../components/Shell';
import UploadZone from '../components/UploadZone';
import Overview from './Overview';
import PlayerPage from './PlayerPage';
import ComparePage from './ComparePage';
import KaderPage from './KaderPage';

// Beispiel-ZIP in public/samples: die GPX-Dateien plus index.json mit Spielernamen und Rückennummern.
const SAMPLE_ZIP = `${import.meta.env.BASE_URL}samples/beispiel-training.zip`;
const TEAM_KEY = 'backtrack.team';

interface Props {
  user: User;
  onLogout: () => void;
  onSwitchRole: () => void;
}

export default function TrainerApp({ user, onLogout, onSwitchRole }: Props) {
  const actions = useClub();
  const { club } = actions;
  const route = useRoute();
  const [teamId, setTeamId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(TEAM_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });
  const [einheitId, setEinheitId] = useState<string>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState<[string, string]>();
  const [playerAccount, setPlayerAccount] = useState(() => hasAccount(user.email, 'spieler'));

  // Jeder Trainer sieht nur seine eigenen Teams.
  const teams = club?.teams.filter((t) => t.trainer === user.email) ?? [];
  const team = teams.find((t) => t.id === teamId) ?? teams[0];
  const einheiten = (club?.einheiten.filter((e) => e.teamId === team?.id) ?? []).sort((a, b) => b.start - a.start);
  const einheit = einheiten.find((e) => e.id === einheitId) ?? einheiten[0];

  useEffect(() => {
    try {
      if (team) localStorage.setItem(TEAM_KEY, team.id);
    } catch {
      // nur Komfort
    }
  }, [team]);

  // Tracks der gewählten Einheit laden, mit aktuellen Kaderdaten.
  useEffect(() => {
    if (!einheit || !team) {
      setTracks([]);
      return;
    }
    let live = true;
    db.getTracks(einheit.entries.map((x) => x.trackId)).then((loaded) => {
      if (!live) return;
      const member = (trackId: string) => team.members.find((m) => m.id === einheit.entries.find((x) => x.trackId === trackId)?.memberId);
      setTracks(loaded.map((t) => withMember(t, member(t.id))));
    });
    return () => {
      live = false;
    };
  }, [einheit, team]);

  const metrics = useMemo(() => new Map(tracks.map((t) => [t.id, computeMetrics(t)])), [tracks]);

  async function addFiles(files: File[]) {
    if (!files.length || !team) return;
    setBusy(true);
    const result = await importFiles(files);
    const created = await actions.importInto(team.id, result);
    setBusy(false);
    setErrors(created || result.errors.length ? result.errors : ['Diese Dateien sind in diesem Team schon vorhanden.']);
    if (created) {
      setEinheitId(created.id);
      go('uebersicht');
    }
  }

  async function loadSample() {
    const blob = await (await fetch(SAMPLE_ZIP)).blob();
    addFiles([new File([blob], 'beispiel-training.zip')]);
  }

  function newTeam() {
    const name = prompt('Name des neuen Teams', 'U18');
    if (name?.trim()) {
      const t = actions.addTeam(user.email, name);
      setTeamId(t.id);
      setEinheitId(undefined);
      go('uebersicht');
    }
  }

  const roleSwitch = playerAccount ? { label: 'Zur Spieleransicht', onClick: onSwitchRole } : undefined;

  if (!club) return null;

  // Noch kein Team: zuerst eines anlegen.
  if (!team) {
    return (
      <Shell user={user} nav={[]} active="" onLogout={onLogout} roleSwitch={roleSwitch} eyebrow={`Hallo ${user.name.split(' ')[0]}`} title="Erstes Team anlegen">
        <form
          className="panel create-team"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get('name'));
            setTeamId(actions.addTeam(user.email, name).id);
          }}
        >
          <p className="muted">Lege für jede Mannschaft, die du trainierst, ein eigenes Team an. Weitere Teams kannst du jederzeit hinzufügen.</p>
          <div className="team-row">
            <label className="field grow">
              <span>Teamname</span>
              <input name="name" required placeholder="z. B. U18 oder Kampfmannschaft" />
            </label>
            <button className="btn-primary">Team anlegen</button>
          </div>
        </form>
      </Shell>
    );
  }

  const player = route.page === 'player' ? (tracks.find((t) => t.id === route.id) ?? tracks[0]) : undefined;
  const [aId, bId] = compare ?? [tracks[0]?.id, tracks[1]?.id ?? tracks[0]?.id];
  const empty = !einheit;
  const page = route.page === 'kader' || !empty ? route.page : 'upload';

  const nav = [
    ...(empty
      ? []
      : [
          { key: 'overview', hash: 'uebersicht', label: 'Übersicht', icon: <PitchIcon /> },
          { key: 'player', hash: `spieler-${player?.id ?? tracks[0]?.id ?? ''}`, label: 'Spieler', icon: <PlayerIcon /> },
          { key: 'compare', hash: 'vergleich', label: 'Vergleich', icon: <CompareIcon /> },
        ]),
    { key: 'kader', hash: 'kader', label: 'Kader', icon: <TeamIcon /> },
  ];

  const titles = { overview: 'Übersicht', player: 'Spieleranalyse', compare: 'Spielervergleich', kader: 'Kader', upload: 'Daten hochladen' };
  const eyebrow =
    page === 'kader' || page === 'upload' || !einheit
      ? team.name
      : [team.name, einheit.title, einheit.kind, `${fmt.date(einheit.start)}, ${fmt.time(einheit.start)} Uhr`].filter(Boolean).join(' · ');

  const sidebar = (
    <div className="team-pick">
        <select
          value={team.id}
          aria-label="Team wählen"
          onChange={(e) => {
            if (e.target.value === '+') return newTeam();
            setTeamId(e.target.value);
            setEinheitId(undefined);
          }}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="+">+ Neues Team …</option>
        </select>
    </div>
  );

  return (
    <Shell
      user={user}
      nav={nav}
      active={page}
      sidebar={sidebar}
      roleSwitch={roleSwitch}
      onLogout={onLogout}
      eyebrow={eyebrow}
      title={titles[page]}
      aside={
        page !== 'kader' &&
        !empty && (
          <div className="top-actions">
            {einheiten.length > 1 && (
              <select value={einheit.id} onChange={(e) => setEinheitId(e.target.value)} aria-label="Einheit wählen">
                {einheiten.map((e) => (
                  <option key={e.id} value={e.id}>
                    {fmt.short(e.start)} · {e.title}
                  </option>
                ))}
              </select>
            )}
            <label className="btn">
              <UploadIcon />
              Daten hinzufügen
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
          </div>
        )
      }
    >
      {errors.length > 0 && (
        <div className="error" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {page === 'upload' && (
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

      {page === 'kader' && (
        <KaderPage
          team={team}
          einheiten={einheiten}
          trainerEmail={user.email}
          actions={actions}
          hasPlayerAccount={playerAccount}
          onCreatePlayerAccount={() => {
            createPlayerAccount(user);
            setPlayerAccount(true);
          }}
          onTeamDeleted={() => {
            setTeamId(undefined);
            setEinheitId(undefined);
          }}
        />
      )}

      {tracks.length > 0 && page === 'overview' && <Overview tracks={tracks} metrics={metrics} onOpen={(id) => go(`spieler-${id}`)} />}
      {tracks.length > 0 && page === 'player' && player && (
        <PlayerPage
          track={player}
          metrics={metrics.get(player.id)!}
          all={[...metrics.values()]}
          choices={tracks.map((t) => ({ id: t.id, label: `${t.player.number ? `${t.player.number} · ` : ''}${t.player.name}` }))}
          value={player.id}
          onSelect={(id) => go(`spieler-${id}`)}
        />
      )}
      {tracks.length > 0 && page === 'compare' && aId && bId && (
        <ComparePage tracks={tracks} metrics={metrics} aId={aId} bId={bId} onChange={(a, b) => setCompare([a, b])} />
      )}
    </Shell>
  );
}
