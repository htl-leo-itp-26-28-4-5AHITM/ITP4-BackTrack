import { useCallback, useEffect, useRef, useState } from 'react';
import type { Player, Track } from '../types';
import type { ImportResult } from './import';
import { db, pack } from './db';
import { check, supabase } from './supabase';

// Teams, Kader und Einheiten (Trainings/Spiele) aus der Datenbank.
// Änderungen erscheinen sofort in der Oberfläche und werden im Hintergrund gespeichert.

export interface Member extends Player {
  id: string;
  email?: string; // verknüpft den Kader-Eintrag mit einem Spielerkonto
}

export interface Team {
  id: string;
  name: string;
  trainer: string; // Konto-ID des Trainers
  members: Member[];
}

export interface Einheit {
  id: string;
  teamId: string;
  title: string;
  kind: string;
  place?: string;
  start: number;
  entries: { memberId: string; trackId: string }[];
}

export interface Club {
  teams: Team[];
  einheiten: Einheit[];
}

const uid = () => crypto.randomUUID();
const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
const orNull = <T,>(v: T | undefined) => (v === undefined || v === '' ? null : v);

// Track mit den aktuellen Kaderdaten (Name, Nummer, Position) anzeigen.
export function withMember(track: Track, member?: Member): Track {
  if (!member) return track;
  return { ...track, player: { name: member.name, number: member.number, position: member.position, hrMax: member.hrMax } };
}

interface MemberRow {
  id: string;
  team_id: string;
  name: string;
  number: number | null;
  position: string | null;
  hr_max: number | null;
  email: string | null;
}

const memberRow = (teamId: string, m: Member): MemberRow => ({
  id: m.id,
  team_id: teamId,
  name: m.name,
  number: orNull(m.number),
  position: orNull(m.position),
  hr_max: orNull(m.hrMax),
  email: orNull(m.email?.trim().toLowerCase()),
});

const memberPatch = (patch: Partial<Member>) => {
  const row: Partial<MemberRow> = {};
  if ('name' in patch) row.name = patch.name;
  if ('number' in patch) row.number = orNull(patch.number);
  if ('position' in patch) row.position = orNull(patch.position);
  if ('hrMax' in patch) row.hr_max = orNull(patch.hrMax);
  if ('email' in patch) row.email = orNull(patch.email?.trim().toLowerCase());
  return row;
};

// Alles laden, was das angemeldete Konto sehen darf (die Datenbank filtert).
export async function loadClub(): Promise<Club> {
  const [teams, members, einheiten, tracks] = await Promise.all([
    supabase.from('teams').select('id, name, trainer_id').order('created_at'),
    supabase.from('members').select('id, team_id, name, number, position, hr_max, email').order('number', { nullsFirst: false }).order('name'),
    supabase.from('einheiten').select('id, team_id, title, kind, place, start_ms'),
    supabase.from('tracks').select('id, einheit_id, member_id'),
  ]);
  const m = check(members) as MemberRow[];
  const t = check(tracks) as { id: string; einheit_id: string; member_id: string }[];
  return {
    teams: (check(teams) as { id: string; name: string; trainer_id: string }[]).map((x) => ({
      id: x.id,
      name: x.name,
      trainer: x.trainer_id,
      members: m
        .filter((r) => r.team_id === x.id)
        .map((r) => ({
          id: r.id,
          name: r.name,
          number: r.number ?? undefined,
          position: r.position ?? undefined,
          hrMax: r.hr_max ?? undefined,
          email: r.email ?? undefined,
        })),
    })),
    einheiten: (check(einheiten) as { id: string; team_id: string; title: string; kind: string; place: string | null; start_ms: number }[]).map(
      (e) => ({
        id: e.id,
        teamId: e.team_id,
        title: e.title,
        kind: e.kind,
        place: e.place ?? undefined,
        start: Number(e.start_ms),
        entries: t.filter((x) => x.einheit_id === e.id).map((x) => ({ memberId: x.member_id, trackId: x.id })),
      }),
    ),
  };
}

export function useClub() {
  const [club, setClub] = useState<Club>();
  const [error, setError] = useState<string>();
  const ref = useRef<Club>({ teams: [], einheiten: [] });

  const reload = useCallback(async () => {
    try {
      const next = await loadClub();
      ref.current = next;
      setClub(next);
      setError(undefined);
    } catch (err) {
      setError(`Daten konnten nicht geladen werden: ${(err as Error).message}`);
      setClub((c) => c ?? ref.current);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Lokal sofort ändern, dann speichern. Schlägt das Speichern fehl, wird neu geladen.
  const apply = useCallback(
    (change: (c: Club) => Club, persist: () => Promise<unknown>) => {
      const next = change(ref.current);
      ref.current = next;
      setClub(next);
      return persist().catch((err) => {
        setError(`Speichern fehlgeschlagen: ${(err as Error).message}`);
        reload();
      });
    },
    [reload],
  );

  const c = club ?? ref.current;

  return {
    club,
    error,
    reload,

    addTeam(_trainer: string, name: string) {
      const team: Team = { id: uid(), name: name.trim(), trainer: _trainer, members: [] };
      apply(
        (c) => ({ ...c, teams: [...c.teams, team] }),
        async () => check(await supabase.from('teams').insert({ id: team.id, name: team.name })),
      );
      return team;
    },

    renameTeam(teamId: string, name: string) {
      apply(
        (c) => ({ ...c, teams: c.teams.map((t) => (t.id === teamId ? { ...t, name: name.trim() } : t)) }),
        async () => check(await supabase.from('teams').update({ name: name.trim() }).eq('id', teamId)),
      );
    },

    deleteTeam(teamId: string) {
      apply(
        (c) => ({ teams: c.teams.filter((t) => t.id !== teamId), einheiten: c.einheiten.filter((e) => e.teamId !== teamId) }),
        async () => check(await supabase.from('teams').delete().eq('id', teamId)),
      );
    },

    addMember(teamId: string, member: Omit<Member, 'id'>) {
      const m: Member = { ...member, id: uid() };
      apply(
        (c) => ({ ...c, teams: c.teams.map((t) => (t.id === teamId ? { ...t, members: [...t.members, m] } : t)) }),
        async () => check(await supabase.from('members').insert(memberRow(teamId, m))),
      );
    },

    updateMember(teamId: string, memberId: string, patch: Partial<Member>) {
      apply(
        (c) => ({
          ...c,
          teams: c.teams.map((t) =>
            t.id === teamId ? { ...t, members: t.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)) } : t,
          ),
        }),
        async () => check(await supabase.from('members').update(memberPatch(patch)).eq('id', memberId)),
      );
    },

    // Spieler aus dem Kader löschen, samt allen seinen Daten. Leere Einheiten fallen weg.
    removeMembers(teamId: string, memberIds: string[]) {
      const hit = (x: { memberId: string }) => memberIds.includes(x.memberId);
      const emptied = c.einheiten.filter((e) => e.teamId === teamId && e.entries.length > 0 && e.entries.every(hit)).map((e) => e.id);
      apply(
        (c) => ({
          teams: c.teams.map((t) => (t.id === teamId ? { ...t, members: t.members.filter((m) => !memberIds.includes(m.id)) } : t)),
          einheiten: c.einheiten
            .map((e) => (e.teamId === teamId ? { ...e, entries: e.entries.filter((x) => !hit(x)) } : e))
            .filter((e) => e.entries.length > 0),
        }),
        async () => {
          check(await supabase.from('members').delete().in('id', memberIds));
          if (emptied.length) check(await supabase.from('einheiten').delete().in('id', emptied));
        },
      );
    },

    deleteEinheit(einheitId: string) {
      apply(
        (c) => ({ ...c, einheiten: c.einheiten.filter((x) => x.id !== einheitId) }),
        async () => check(await supabase.from('einheiten').delete().eq('id', einheitId)),
      );
    },

    // Hochgeladene Dateien einem Team zuordnen: Spieler über den Namen finden oder neu in den Kader aufnehmen.
    async importInto(teamId: string, result: ImportResult): Promise<Einheit | undefined> {
      const now = ref.current;
      const team = now.teams.find((t) => t.id === teamId)!;
      const known = new Set(now.einheiten.flatMap((e) => e.entries.map((x) => x.trackId)));
      const members = [...team.members];
      const added: Member[] = [];
      const entries: Einheit['entries'] = [];
      const store: Track[] = [];

      for (const track of result.tracks) {
        const trackId = `${teamId}:${track.id}`;
        if (known.has(trackId) || store.some((t) => t.id === trackId)) continue;
        let member = members.find((m) => same(m.name, track.player.name));
        if (!member) {
          member = { ...track.player, id: uid() };
          members.push(member);
          added.push(member);
        }
        entries.push({ memberId: member.id, trackId });
        store.push({ ...track, id: trackId });
      }
      if (!entries.length) return undefined;

      const s = result.session;
      const einheit: Einheit = {
        id: uid(),
        teamId,
        title: s?.title ?? 'Einheit',
        kind: s?.kind ?? '',
        place: s?.place,
        start: Math.min(...store.map((t) => t.points[0].time)),
        entries,
      };

      try {
        if (added.length) check(await supabase.from('members').insert(added.map((m) => memberRow(teamId, m))));
        check(
          await supabase.from('einheiten').insert({
            id: einheit.id,
            team_id: teamId,
            title: einheit.title,
            kind: einheit.kind,
            place: orNull(einheit.place),
            start_ms: einheit.start,
          }),
        );
        // Einzeln hochladen, damit eine Anfrage nicht zu groß wird.
        for (const t of store) {
          const memberId = entries.find((x) => x.trackId === t.id)!.memberId;
          check(await supabase.from('tracks').insert({ id: t.id, team_id: teamId, einheit_id: einheit.id, member_id: memberId, points: pack(t.points) }));
        }
      } catch (err) {
        // Halb gespeicherte Einheit wieder entfernen.
        await supabase.from('einheiten').delete().eq('id', einheit.id);
        setError(`Hochladen fehlgeschlagen: ${(err as Error).message}`);
        await reload();
        return undefined;
      }

      db.forget(store.map((t) => t.id));
      const next = {
        teams: ref.current.teams.map((t) => (t.id === teamId ? { ...t, members } : t)),
        einheiten: [...ref.current.einheiten, einheit],
      };
      ref.current = next;
      setClub(next);
      return einheit;
    },
  };
}
