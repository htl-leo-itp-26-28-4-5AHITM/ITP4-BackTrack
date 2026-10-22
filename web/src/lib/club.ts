import { useCallback, useEffect, useState } from 'react';
import type { Player, Track } from '../types';
import type { ImportResult } from './import';
import { db } from './db';

// Teams, Kader und Einheiten (Trainings/Spiele). Alles bleibt vorerst im Browser.

export interface Member extends Player {
  id: string;
  email?: string; // verknüpft den Kader-Eintrag mit einem Spielerkonto
}

export interface Team {
  id: string;
  name: string;
  trainer: string; // E-Mail des Trainers
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

const EMPTY: Club = { teams: [], einheiten: [] };
const uid = () => Math.random().toString(36).slice(2, 10);
const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// Track mit den aktuellen Kaderdaten (Name, Nummer, Position) anzeigen.
export function withMember(track: Track, member?: Member): Track {
  if (!member) return track;
  return { ...track, player: { name: member.name, number: member.number, position: member.position, hrMax: member.hrMax } };
}

export function useClub() {
  const [club, setClub] = useState<Club>();

  useEffect(() => {
    db.getMeta<Club>('club').then((c) => setClub(c ?? EMPTY));
  }, []);

  const save = useCallback(async (next: Club, deleteTracks: string[] = []) => {
    setClub(next);
    await db.setMeta('club', next);
    if (deleteTracks.length) await db.deleteTracks(deleteTracks);
  }, []);

  const c = club ?? EMPTY;
  const tracksOf = (pred: (e: Einheit['entries'][number]) => boolean) =>
    c.einheiten.flatMap((e) => e.entries.filter(pred).map((x) => x.trackId));

  return {
    club,

    addTeam(trainer: string, name: string) {
      const team: Team = { id: uid(), name: name.trim(), trainer, members: [] };
      save({ ...c, teams: [...c.teams, team] });
      return team;
    },

    renameTeam(teamId: string, name: string) {
      save({ ...c, teams: c.teams.map((t) => (t.id === teamId ? { ...t, name: name.trim() } : t)) });
    },

    deleteTeam(teamId: string) {
      const gone = c.einheiten.filter((e) => e.teamId === teamId).flatMap((e) => e.entries.map((x) => x.trackId));
      save({ teams: c.teams.filter((t) => t.id !== teamId), einheiten: c.einheiten.filter((e) => e.teamId !== teamId) }, gone);
    },

    addMember(teamId: string, member: Omit<Member, 'id'>) {
      save({
        ...c,
        teams: c.teams.map((t) => (t.id === teamId ? { ...t, members: [...t.members, { ...member, id: uid() }] } : t)),
      });
    },

    updateMember(teamId: string, memberId: string, patch: Partial<Member>) {
      save({
        ...c,
        teams: c.teams.map((t) =>
          t.id === teamId ? { ...t, members: t.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)) } : t,
        ),
      });
    },

    // Spieler aus dem Kader löschen, samt allen seinen Daten. Leere Einheiten fallen weg.
    removeMembers(teamId: string, memberIds: string[]) {
      const hit = (x: { memberId: string }) => memberIds.includes(x.memberId);
      const gone = c.einheiten.filter((e) => e.teamId === teamId).flatMap((e) => e.entries.filter(hit).map((x) => x.trackId));
      save(
        {
          teams: c.teams.map((t) => (t.id === teamId ? { ...t, members: t.members.filter((m) => !memberIds.includes(m.id)) } : t)),
          einheiten: c.einheiten
            .map((e) => (e.teamId === teamId ? { ...e, entries: e.entries.filter((x) => !hit(x)) } : e))
            .filter((e) => e.entries.length > 0),
        },
        gone,
      );
    },

    deleteEinheit(einheitId: string) {
      const e = c.einheiten.find((x) => x.id === einheitId);
      save({ ...c, einheiten: c.einheiten.filter((x) => x.id !== einheitId) }, e?.entries.map((x) => x.trackId));
    },

    // Hochgeladene Dateien einem Team zuordnen: Spieler über den Namen finden oder neu in den Kader aufnehmen.
    async importInto(teamId: string, result: ImportResult): Promise<Einheit | undefined> {
      const team = c.teams.find((t) => t.id === teamId)!;
      const known = new Set(tracksOf(() => true));
      const members = [...team.members];
      const entries: Einheit['entries'] = [];
      const store: Track[] = [];

      for (const track of result.tracks) {
        const trackId = `${teamId}:${track.id}`;
        if (known.has(trackId)) continue;
        let member = members.find((m) => same(m.name, track.player.name));
        if (!member) {
          member = { ...track.player, id: uid() };
          members.push(member);
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
      await db.putTracks(store);
      await save({
        teams: c.teams.map((t) => (t.id === teamId ? { ...t, members } : t)),
        einheiten: [...c.einheiten, einheit],
      });
      return einheit;
    },
  };
}
