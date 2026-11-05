import { useEffect, useMemo, useState } from 'react';
import type { Track } from '../types';
import { computeMetrics } from '../lib/metrics';
import { fmt } from '../lib/format';
import type { User } from '../lib/auth';
import { useClub, withMember } from '../lib/club';
import { db } from '../lib/db';
import { PlayerIcon } from '../components/Icons';
import Shell from '../components/Shell';
import PlayerPage from './PlayerPage';

interface Props {
  user: User;
  onLogout: () => void;
  roleSwitch?: { label: string; onClick: () => void };
}

// Spieleransicht: nur die eigenen Einheiten, keine Teamwerte, kein Upload, keine Verwaltung.
// Achtung: Ohne Server ist das nur eine Trennung in der Oberfläche, kein echter Datenschutz.
export default function PlayerApp({ user, onLogout, roleSwitch }: Props) {
  const { club } = useClub();
  const [selected, setSelected] = useState<string>();
  const [track, setTrack] = useState<Track>();

  // Alle Kader-Einträge mit meiner E-Mail, über alle Teams hinweg.
  const mine = useMemo(() => {
    if (!club) return [];
    const members = club.teams.flatMap((t) => t.members.filter((m) => m.email === user.email).map((m) => ({ team: t, member: m })));
    return club.einheiten
      .flatMap((e) =>
        e.entries
          .map((x) => ({ einheit: e, entry: x, link: members.find((m) => m.member.id === x.memberId && m.team.id === e.teamId) }))
          .filter((x) => x.link),
      )
      .map(({ einheit, entry, link }) => ({ einheit, trackId: entry.trackId, team: link!.team, member: link!.member }))
      .sort((a, b) => b.einheit.start - a.einheit.start);
  }, [club, user.email]);

  const current = mine.find((m) => m.trackId === selected) ?? mine[0];

  useEffect(() => {
    if (!current) return setTrack(undefined);
    let live = true;
    db.getTracks([current.trackId]).then(([t]) => live && setTrack(t && withMember(t, current.member)));
    return () => {
      live = false;
    };
  }, [current]);

  const metrics = useMemo(() => track && computeMetrics(track), [track]);

  if (!club) return null;

  return (
    <Shell
      user={user}
      nav={[{ key: 'me', hash: '', label: 'Meine Daten', icon: <PlayerIcon /> }]}
      active="me"
      roleSwitch={roleSwitch}
      onLogout={onLogout}
      eyebrow={
        current
          ? [current.team.name, current.einheit.title, `${fmt.date(current.einheit.start)}, ${fmt.time(current.einheit.start)} Uhr`].join(' · ')
          : `Hallo ${user.name.split(' ')[0]}`
      }
      title="Meine Daten"
    >
      {!current && (
        <section className="panel empty-note">
          <h2>Noch keine Daten</h2>
          <p className="muted">
            Sobald dein Trainer dich im Kader mit deiner E-Mail <strong>{user.email}</strong> verknüpft und Daten hochlädt, siehst du
            hier deine Auswertung. Die Werte der anderen Spieler siehst du nicht.
          </p>
        </section>
      )}

      {current && track && metrics && (
        <PlayerPage
          track={track}
          metrics={metrics}
          all={[]}
          choices={mine.map((m) => ({ id: m.trackId, label: `${fmt.short(m.einheit.start)} · ${m.einheit.title}` }))}
          value={current.trackId}
          onSelect={setSelected}
        />
      )}
    </Shell>
  );
}
