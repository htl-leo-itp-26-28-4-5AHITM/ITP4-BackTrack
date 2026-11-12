import { useCallback, useEffect, useState } from 'react';
import { check, supabase } from './supabase';
import { readPitchMap, type PitchMap } from './pitchMap';
import { pack } from './db';
import type { ImportResult } from './import';
import type { Member } from './club';

// Spiele vorbereiten: Vorlage (Platzvermessung + Spieldaten) → Spiel anlegen → nach dem Spiel Daten hochladen.
// Vorlagen weist der Trainer seinen Teams zu, Spieler können sie übernehmen oder eigene anlegen.
// Die hochgeladenen Messdaten landen als Einheit (einheiten.spiel_id) im Team.

export const KINDS = ['Spiel', 'Training', 'Turnier'];

export interface TemplateData {
  title: string;
  kind: string;
  opponent?: string;
  place?: string;
  kickoff?: number; // geplanter Anpfiff (ms)
  durationMin?: number;
  notes?: string;
  pitch: PitchMap;
}

export interface Template extends TemplateData {
  id: string;
  ownerId: string;
  teamIds: string[];
}

export interface Game extends TemplateData {
  id: string;
  ownerId: string;
  templateId?: string;
  teamId?: string;
  forTeam: boolean;
  einheitId?: string; // gesetzt, sobald Daten hochgeladen wurden
}

interface TemplateRow {
  id: string;
  owner_id: string;
  title: string;
  kind: string;
  opponent: string | null;
  place: string | null;
  kickoff_ms: number | null;
  duration_min: number | null;
  notes: string | null;
  pitch: unknown;
}

interface GameRow extends TemplateRow {
  template_id: string | null;
  team_id: string | null;
  for_team: boolean;
}

const orNull = <T,>(v: T | undefined) => (v === undefined || v === '' ? null : v);
const opt = <T,>(v: T | null) => v ?? undefined;

const dataRow = (d: TemplateData) => ({
  title: d.title.trim(),
  kind: d.kind,
  opponent: orNull(d.opponent?.trim()),
  place: orNull(d.place?.trim()),
  kickoff_ms: orNull(d.kickoff),
  duration_min: orNull(d.durationMin),
  notes: orNull(d.notes?.trim()),
  pitch: d.pitch,
});

const readData = (r: TemplateRow): TemplateData => ({
  title: r.title,
  kind: r.kind,
  opponent: opt(r.opponent),
  place: opt(r.place),
  kickoff: r.kickoff_ms == null ? undefined : Number(r.kickoff_ms),
  durationMin: opt(r.duration_min),
  notes: opt(r.notes),
  pitch: readPitchMap(r.pitch),
});

export interface NewGame {
  template: Template;
  teamId?: string;
  forTeam: boolean;
  kickoff?: number;
}

const DUPLICATE = '23505';

export function useSpiele() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      const [tpl, links, gms, ein] = await Promise.all([
        supabase.from('tracking_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('template_teams').select('template_id, team_id'),
        supabase.from('spiele').select('*').order('kickoff_ms', { ascending: false, nullsFirst: true }),
        supabase.from('einheiten').select('id, spiel_id').not('spiel_id', 'is', null),
      ]);
      const l = check(links) as { template_id: string; team_id: string }[];
      const e = check(ein) as { id: string; spiel_id: string }[];
      setTemplates(
        (check(tpl) as TemplateRow[]).map((r) => ({
          ...readData(r),
          id: r.id,
          ownerId: r.owner_id,
          teamIds: l.filter((x) => x.template_id === r.id).map((x) => x.team_id),
        })),
      );
      setGames(
        (check(gms) as GameRow[]).map((r) => ({
          ...readData(r),
          id: r.id,
          ownerId: r.owner_id,
          templateId: opt(r.template_id),
          teamId: opt(r.team_id),
          forTeam: r.for_team,
          einheitId: e.find((x) => x.spiel_id === r.id)?.id,
        })),
      );
      setError(undefined);
    } catch (err) {
      setError(`Spiele konnten nicht geladen werden: ${(err as Error).message}`);
    }
    setLoaded(true);
  }, []);

  // Beim Start und beim Zurückkommen in den Tab (neue Spiele vom Trainer, Daten von Teamkollegen).
  useEffect(() => {
    reload();
    const onFocus = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [reload]);

  async function run<T>(job: () => Promise<T>): Promise<T | undefined> {
    try {
      const result = await job();
      await reload();
      return result;
    } catch (err) {
      setError(`Speichern fehlgeschlagen: ${(err as Error).message}`);
      await reload();
      return undefined;
    }
  }

  // Zuweisungen auf genau diese Teams setzen.
  async function assign(templateId: string, before: string[], teamIds: string[]) {
    const removed = before.filter((t) => !teamIds.includes(t));
    const added = teamIds.filter((t) => !before.includes(t));
    if (removed.length) check(await supabase.from('template_teams').delete().eq('template_id', templateId).in('team_id', removed));
    if (added.length) check(await supabase.from('template_teams').insert(added.map((team_id) => ({ template_id: templateId, team_id }))));
  }

  return {
    templates,
    games,
    loaded,
    error,
    reload,
    setError,

    saveTemplate: (data: TemplateData, teamIds: string[], existing?: Template) =>
      run(async () => {
        const id = existing?.id ?? crypto.randomUUID();
        if (existing) check(await supabase.from('tracking_templates').update(dataRow(data)).eq('id', id));
        else check(await supabase.from('tracking_templates').insert({ id, ...dataRow(data) }));
        await assign(id, existing?.teamIds ?? [], teamIds);
        return { ...data, id, ownerId: existing?.ownerId ?? '', teamIds } as Template;
      }),

    setTemplateTeams: (template: Template, teamIds: string[]) => run(() => assign(template.id, template.teamIds, teamIds)),

    deleteTemplate: (id: string) => run(async () => check(await supabase.from('tracking_templates').delete().eq('id', id))),

    // Spiel aus einer Vorlage anlegen. Die Daten der Vorlage werden kopiert.
    createGame: ({ template, teamId, forTeam, kickoff }: NewGame) =>
      run(async () => {
        const id = crypto.randomUUID();
        check(
          await supabase.from('spiele').insert({
            id,
            ...dataRow({ ...template, kickoff }),
            template_id: template.id,
            team_id: orNull(teamId),
            for_team: forTeam,
          }),
        );
        return id;
      }),

    deleteGame: (id: string) => run(async () => check(await supabase.from('spiele').delete().eq('id', id))),

    // Spieler lädt nach dem Spiel seine eigene Uhr-Datei hoch. Alle Tracks gehören zu ihm.
    // Gibt eine Fehlermeldung zurück, sonst undefined.
    uploadOwn: (game: Game, member: Member, result: ImportResult) =>
      uploadOwn(game, member, result).then(
        async () => {
          await reload();
          return undefined;
        },
        (err: Error) => err.message,
      ),
  };
}

async function uploadOwn(game: Game, member: Member, result: ImportResult) {
      {
        if (!game.teamId) throw new Error('Das Spiel gehört zu keinem Team.');
        if (!result.tracks.length) throw new Error(result.errors.join(' ') || 'Keine GPX-Daten gefunden.');
        const teamId = game.teamId;

        let einheitId = game.einheitId;
        if (!einheitId) {
          const id = crypto.randomUUID();
          const res = await supabase.from('einheiten').insert({
            id,
            team_id: teamId,
            title: game.title,
            kind: game.kind,
            place: orNull(game.place),
            start_ms: Math.min(...result.tracks.map((t) => t.points[0].time)),
            spiel_id: game.id,
          });
          if (res.error?.code === DUPLICATE) {
            // Ein Teamkollege war schneller: seine Einheit verwenden.
            const found = check(await supabase.from('einheiten').select('id').eq('spiel_id', game.id).single()) as { id: string };
            einheitId = found.id;
          } else {
            check(res);
            einheitId = id;
          }
        }

        let added = 0;
        for (const t of result.tracks) {
          const res = await supabase.from('tracks').insert({
            id: `${teamId}:${member.id}:${t.id}`,
            team_id: teamId,
            einheit_id: einheitId,
            member_id: member.id,
            points: pack(t.points),
          });
          if (res.error?.code === DUPLICATE) continue;
          check(res);
          added++;
        }
        if (!added) throw new Error('Diese Datei ist für dieses Spiel schon hochgeladen.');
        return added;
      }
}

// <input type="datetime-local"> arbeitet mit lokaler Zeit ohne Zeitzone.
export function toLocalInput(ms?: number) {
  if (ms === undefined) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}
