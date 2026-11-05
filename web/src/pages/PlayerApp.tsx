import { useEffect, useMemo, useState } from 'react';
import type { Metrics, Track } from '../types';
import { computeMetrics } from '../lib/metrics';
import { fmt } from '../lib/format';
import type { User } from '../lib/auth';
import { useClub, withMember, type Club, type Einheit, type Member, type Team } from '../lib/club';
import { useCompareRequests } from '../lib/compare';
import { db } from '../lib/db';
import { CompareIcon, PlayerIcon, TeamIcon } from '../components/Icons';
import Shell from '../components/Shell';
import PlayerPage from './PlayerPage';
import ComparePage from './ComparePage';
import TeamPage from './TeamPage';

interface Props {
  user: User;
  onLogout: () => void;
  roleSwitch?: { label: string; onClick: () => void };
}

type Page = 'me' | 'team' | 'compare';

function readPage(): Page {
  const h = window.location.hash.slice(1);
  return h === 'team' ? 'team' : h === 'vergleich' ? 'compare' : 'me';
}

function usePage() {
  const [page, setPage] = useState<Page>(readPage);
  useEffect(() => {
    const on = () => setPage(readPage());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return page;
}

export interface Link {
  team: Team;
  member: Member;
}

// Alle Einträge eines Kader-Mitglieds, neueste zuerst.
export function entriesOf(club: Club, link: Link) {
  return club.einheiten
    .filter((e) => e.teamId === link.team.id)
    .flatMap((e) => e.entries.filter((x) => x.memberId === link.member.id).map((x) => ({ einheit: e, trackId: x.trackId, ...link })))
    .sort((a, b) => b.einheit.start - a.einheit.start);
}

const entryLabel = (e: Einheit) => `${fmt.short(e.start)} · ${e.title}`;

// Spieleransicht: eigene Einheiten, Teamkollegen (ohne Werte) und freigegebene Vergleiche.
// Was ein Spieler laden darf, entscheidet die Datenbank, nicht die Oberfläche.
export default function PlayerApp({ user, onLogout, roleSwitch }: Props) {
  const { club, error, reload } = useClub();
  const compare = useCompareRequests(reload);
  const page = usePage();
  const [selected, setSelected] = useState<string>();
  const [track, setTrack] = useState<Track>();

  // Meine Kader-Einträge, über alle Teams hinweg.
  const links: Link[] = useMemo(
    () => club?.teams.flatMap((t) => t.members.filter((m) => m.email === user.email).map((m) => ({ team: t, member: m }))) ?? [],
    [club, user.email],
  );

  const mine = useMemo(
    () => (club ? links.flatMap((l) => entriesOf(club, l)).sort((a, b) => b.einheit.start - a.einheit.start) : []),
    [club, links],
  );

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

  // Angenommene Vergleiche: wer mit mir vergleicht.
  const partners = useMemo(() => {
    if (!club) return [];
    return compare.requests
      .filter((r) => r.status === 'accepted')
      .flatMap((r) => {
        const me = links.find((l) => l.member.id === r.from || l.member.id === r.to);
        if (!me) return [];
        const otherId = r.from === me.member.id ? r.to : r.from;
        const other = me.team.members.find((m) => m.id === otherId);
        return other ? [{ request: r, me, other: { team: me.team, member: other } }] : [];
      });
  }, [club, compare.requests, links]);

  const incoming = compare.requests.filter((r) => r.status === 'pending' && links.some((l) => l.member.id === r.to)).length;

  if (!club) return null;

  const nav = [
    { key: 'me', hash: '', label: 'Meine Daten', icon: <PlayerIcon /> },
    { key: 'team', hash: 'team', label: incoming ? `Team (${incoming})` : 'Team', icon: <TeamIcon /> },
    { key: 'compare', hash: 'vergleich', label: 'Vergleich', icon: <CompareIcon /> },
  ];
  const titles = { me: 'Meine Daten', team: 'Mein Team', compare: 'Vergleich' };
  const eyebrow =
    page === 'me' && current
      ? [current.team.name, current.einheit.title, `${fmt.date(current.einheit.start)}, ${fmt.time(current.einheit.start)} Uhr`].join(' · ')
      : `Hallo ${user.name.split(' ')[0]}`;

  return (
    <Shell user={user} nav={nav} active={page} roleSwitch={roleSwitch} onLogout={onLogout} eyebrow={eyebrow} title={titles[page]}>
      {(error || compare.error) && (
        <div className="error" role="alert">
          <p>{error ?? compare.error}</p>
        </div>
      )}

      {page === 'me' && !current && (
        <section className="panel empty-note">
          <h2>Noch keine Daten</h2>
          <p className="muted">
            Sobald dein Trainer dich im Kader mit deiner E-Mail <strong>{user.email}</strong> verknüpft und Daten hochlädt, siehst du
            hier deine Auswertung. Die Werte der anderen Spieler siehst du nur, wenn sie einem Vergleich zustimmen.
          </p>
        </section>
      )}

      {page === 'me' && current && track && metrics && (
        <PlayerPage
          track={track}
          metrics={metrics}
          all={[]}
          choices={mine.map((m) => ({ id: m.trackId, label: entryLabel(m.einheit) }))}
          value={current.trackId}
          onSelect={setSelected}
        />
      )}

      {page === 'team' && <TeamPage links={links} compare={compare} />}

      {page === 'compare' && <PlayerCompare club={club} partners={partners} />}
    </Shell>
  );
}

interface Partner {
  request: { id: string };
  me: Link;
  other: Link;
}

function PlayerCompare({ club, partners }: { club: Club; partners: Partner[] }) {
  const [partnerId, setPartnerId] = useState<string>();
  const [pick, setPick] = useState<[string, string]>();
  const [loaded, setLoaded] = useState<{ a: Track; b: Track; metrics: Map<string, Metrics> }>();

  const partner = partners.find((p) => p.request.id === partnerId) ?? partners[0];
  const mineList = useMemo(() => (partner ? entriesOf(club, partner.me) : []), [club, partner]);
  const theirs = useMemo(() => (partner ? entriesOf(club, partner.other) : []), [club, partner]);

  // Standard: die letzte Einheit, in der beide Daten haben.
  const [aId, bId] = useMemo(() => {
    if (pick) return pick;
    const both = mineList.find((m) => theirs.some((t) => t.einheit.id === m.einheit.id));
    if (both) return [both.trackId, theirs.find((t) => t.einheit.id === both.einheit.id)!.trackId];
    return [mineList[0]?.trackId, theirs[0]?.trackId];
  }, [pick, mineList, theirs]);

  useEffect(() => {
    setLoaded(undefined);
    if (!aId || !bId || !partner) return;
    let live = true;
    db.getTracks([aId, bId]).then((ts) => {
      const ta = ts.find((t) => t.id === aId);
      const tb = ts.find((t) => t.id === bId);
      if (!live || !ta || !tb) return;
      const a = withMember(ta, partner.me.member);
      const b = withMember(tb, partner.other.member);
      setLoaded({ a, b, metrics: new Map([[a.id, computeMetrics(a)], [b.id, computeMetrics(b)]]) });
    });
    return () => {
      live = false;
    };
  }, [aId, bId, partner]);

  if (!partners.length) {
    return (
      <section className="panel empty-note">
        <h2>Noch kein Vergleich freigegeben</h2>
        <p className="muted">
          Unter <a href="#team">Team</a> kannst du einem Teamkollegen eine Vergleichsanfrage schicken. Sobald er annimmt, könnt ihr
          eure Werte hier nebeneinander sehen.
        </p>
      </section>
    );
  }

  return (
    <div className="page">
      {partners.length > 1 && (
        <section className="panel">
          <div className="team-row">
            <label className="field grow">
              <span>Vergleichen mit</span>
              <select
                value={partner.request.id}
                onChange={(e) => {
                  setPartnerId(e.target.value);
                  setPick(undefined);
                }}
              >
                {partners.map((p) => (
                  <option key={p.request.id} value={p.request.id}>
                    {p.other.member.name} ({p.other.team.name})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {(!mineList.length || !theirs.length) && (
        <section className="panel empty-note">
          <h2>Noch nicht genug Daten</h2>
          <p className="muted">
            {!mineList.length ? 'Von dir' : `Von ${partner.other.member.name}`} gibt es in „{partner.me.team.name}“ noch keine Einheit.
          </p>
        </section>
      )}

      {loaded && (
        <ComparePage
          a={loaded.a}
          b={loaded.b}
          metrics={loaded.metrics}
          optionsA={mineList.map((m) => ({ id: m.trackId, label: `Ich · ${entryLabel(m.einheit)}` }))}
          optionsB={theirs.map((t) => ({ id: t.trackId, label: `${t.member.name} · ${entryLabel(t.einheit)}` }))}
          onChange={(a, b) => setPick([a, b])}
        />
      )}
    </div>
  );
}
