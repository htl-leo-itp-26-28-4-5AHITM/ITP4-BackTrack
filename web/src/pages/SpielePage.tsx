import { useState } from 'react';
import type { User } from '../lib/auth';
import type { Club, GameTarget, Member, Team } from '../lib/club';
import type { Einheit } from '../lib/club';
import { fmt } from '../lib/format';
import { importFiles, type ImportResult } from '../lib/import';
import { countSet, emptyPitchMap, isComplete, measure, TOTAL_POINTS } from '../lib/pitchMap';
import { fromLocalInput, KINDS, toLocalInput, useSpiele, type Game, type Template, type TemplateData } from '../lib/spiele';
import { TrashIcon, UploadIcon } from '../components/Icons';
import PitchSetup from '../components/PitchSetup';

interface Props {
  user: User;
  club: Club;
  teams: Team[]; // Trainer: eigene Teams, Spieler: Teams, in deren Kader er steht
  // Trainer: Dateien (auch ZIP mit allen Spielern) in die Einheit des Spiels importieren.
  importInto?: (teamId: string, result: ImportResult, game: GameTarget) => Promise<Einheit | undefined>;
  // Spieler: mein Kader-Eintrag im Team des Spiels.
  meIn?: (teamId: string) => Member | undefined;
  onDataChanged?: () => void;
  onOpen: (game: Game, einheit: Einheit) => void;
}

type View = { mode: 'list' } | { mode: 'edit'; template?: Template } | { mode: 'create'; template: Template };

// Trainer: Platz vermessen, Spieldaten eintragen, Vorlagen an Teams zuweisen, Spiele fürs Team anlegen.
// Spieler: zugewiesene Vorlagen übernehmen oder eigene Spiele anlegen.
// Nach dem Spiel werden die Daten der Uhren in das Spiel hochgeladen.
export default function SpielePage({ user, club, teams, importInto, meIn, onDataChanged, onOpen }: Props) {
  const s = useSpiele();
  const [view, setView] = useState<View>({ mode: 'list' });
  const trainer = user.role === 'trainer';

  if (view.mode === 'edit') {
    return (
      <TemplateForm
        trainer={trainer}
        teams={teams}
        template={view.template}
        error={s.error}
        onCancel={() => setView({ mode: 'list' })}
        onSave={async (data, teamIds, andCreate) => {
          const saved = await s.saveTemplate(data, teamIds, view.template);
          if (saved) setView(andCreate ? { mode: 'create', template: { ...saved, ownerId: user.id } } : { mode: 'list' });
        }}
      />
    );
  }

  if (view.mode === 'create') {
    return (
      <CreateGameForm
        trainer={trainer}
        teams={teams}
        template={view.template}
        error={s.error}
        onCancel={() => setView({ mode: 'list' })}
        onCreate={async (teamId, kickoff) => {
          const id = await s.createGame({ template: view.template, teamId, forTeam: trainer, kickoff });
          if (id) setView({ mode: 'list' });
        }}
      />
    );
  }

  const own = s.templates.filter((x) => x.ownerId === user.id);
  const assigned = s.templates.filter((x) => x.ownerId !== user.id);
  const teamName = (id?: string) => teams.find((x) => x.id === id)?.name;

  return (
    <div className="page">
      {s.error && (
        <div className="error" role="alert">
          <p>{s.error}</p>
        </div>
      )}

      <GameList
        user={user}
        club={club}
        games={s.games}
        loaded={s.loaded}
        teamName={teamName}
        onDelete={(g) => confirm(`Spiel „${g.title}“ löschen? Bereits hochgeladene Daten bleiben als Einheit erhalten.`) && s.deleteGame(g.id)}
        onUpload={async (game, files) => {
          if (!game.teamId) return 'Das Spiel gehört zu keinem Team.';
          const result = await importFiles(files);
          if (trainer && importInto) {
            const einheit = await importInto(game.teamId, result, {
              spielId: game.id,
              einheitId: game.einheitId,
              title: game.title,
              kind: game.kind,
              place: game.place,
            });
            await s.reload();
            if (!einheit) return result.errors.join(' ') || 'Diese Dateien sind in diesem Team schon vorhanden.';
            return result.errors.length ? result.errors.join(' ') : undefined;
          }
          const me = meIn?.(game.teamId);
          if (!me) return 'Du bist in diesem Team nicht im Kader.';
          const problem = await s.uploadOwn(game, me, result);
          if (!problem) onDataChanged?.();
          return problem;
        }}
        meIn={meIn}
        onOpen={onOpen}
      />

      {!trainer && (
        <section className="panel">
          <header className="panel-head">
            <h2>Vorlagen vom Trainer</h2>
            <p className="muted">Übernimm eine Vorlage, um daraus dein eigenes Spiel anzulegen.</p>
          </header>
          {assigned.length === 0 ? (
            <p className="muted">{s.loaded ? 'Noch keine Vorlage zugewiesen.' : 'Lädt …'}</p>
          ) : (
            <ul className="list">
              {assigned.map((x) => (
                <li key={x.id}>
                  <TemplateSummary template={x} extra={x.teamIds.map(teamName).filter(Boolean).join(', ')} />
                  <div className="row-actions">
                    <button className="btn btn-accept" onClick={() => setView({ mode: 'create', template: x })}>
                      Übernehmen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="panel">
        <header className="panel-head">
          <h2>{trainer ? 'Vorlagen' : 'Eigene Vorlagen'}</h2>
          <p className="muted">
            {trainer
              ? 'Platz vermessen und Spieldaten vorbereiten. Zugewiesene Teams können die Vorlage übernehmen.'
              : 'Spiele, die du selbst vorbereitet hast.'}
          </p>
          <button className="btn btn-accept" onClick={() => setView({ mode: 'edit' })}>
            + Neue Vorlage
          </button>
        </header>
        {own.length === 0 ? (
          <p className="muted">{s.loaded ? 'Noch keine Vorlage angelegt.' : 'Lädt …'}</p>
        ) : (
          <ul className="list">
            {own.map((x) => (
              <li key={x.id}>
                <div className="grow">
                  <TemplateSummary template={x} />
                  {trainer && teams.length > 0 && (
                    <div className="assign" role="group" aria-label={`Teams für ${x.title}`}>
                      <span className="muted small">Zugewiesen an:</span>
                      {teams.map((team) => {
                        const on = x.teamIds.includes(team.id);
                        return (
                          <button
                            key={team.id}
                            type="button"
                            className={on ? 'toggle on' : 'toggle'}
                            aria-pressed={on}
                            onClick={() => s.setTemplateTeams(x, on ? x.teamIds.filter((id) => id !== team.id) : [...x.teamIds, team.id])}
                          >
                            {team.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="row-actions">
                  <button className="btn btn-accept" onClick={() => setView({ mode: 'create', template: x })} disabled={!teams.length}>
                    Spiel anlegen
                  </button>
                  <button className="btn" onClick={() => setView({ mode: 'edit', template: x })}>
                    Bearbeiten
                  </button>
                  <button
                    className="icon-btn danger"
                    aria-label={`${x.title} löschen`}
                    title="Vorlage löschen"
                    onClick={() => confirm(`Vorlage „${x.title}“ löschen? Angelegte Spiele bleiben erhalten.`) && s.deleteTemplate(x.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TemplateSummary({ template: x, extra }: { template: TemplateData; extra?: string }) {
  const size = measure(x.pitch);
  const details = [
    x.kind,
    x.opponent && `gegen ${x.opponent}`,
    x.place,
    x.kickoff && `${fmt.short(x.kickoff)}, ${fmt.time(x.kickoff)} Uhr`,
    size && `Platz ${fmt.int(size.length)} × ${fmt.int(size.width)} m`,
    extra,
  ].filter(Boolean);
  return (
    <span>
      <strong>{x.title}</strong>
      <span className="muted small">{details.join(' · ')}</span>
    </span>
  );
}

// ---------- Angelegte Spiele und Daten hochladen ----------

function GameList({
  user,
  club,
  games,
  loaded,
  teamName,
  onDelete,
  onUpload,
  meIn,
  onOpen,
}: {
  user: User;
  club: Club;
  games: Game[];
  loaded: boolean;
  teamName: (id?: string) => string | undefined;
  onDelete: (g: Game) => void;
  onUpload: (g: Game, files: File[]) => Promise<string | undefined>;
  meIn?: (teamId: string) => Member | undefined;
  onOpen: (g: Game, e: Einheit) => void;
}) {
  const [busy, setBusy] = useState<string>();
  const [notes, setNotes] = useState<Record<string, { ok: boolean; text: string }>>({});
  const trainer = user.role === 'trainer';
  const now = Date.now();

  async function upload(g: Game, files: File[]) {
    if (!files.length) return;
    setBusy(g.id);
    const problem = await onUpload(g, files);
    setBusy(undefined);
    setNotes((n) => ({ ...n, [g.id]: problem ? { ok: false, text: problem } : { ok: true, text: 'Daten hochgeladen.' } }));
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Spiele</h2>
        <p className="muted">
          {trainer
            ? 'Nach dem Spiel die Dateien der Uhren (GPX oder ZIP) direkt ins Spiel hochladen.'
            : 'Nach dem Spiel lädst du hier die Datei deiner Uhr (GPX) hoch.'}
        </p>
      </header>
      {games.length === 0 ? (
        <p className="muted">{loaded ? 'Noch kein Spiel angelegt. Lege es unten aus einer Vorlage an.' : 'Lädt …'}</p>
      ) : (
        <ul className="list">
          {games.map((g) => {
            const einheit = club.einheiten.find((e) => e.id === g.einheitId);
            const players = einheit?.entries.length ?? 0;
            const me = !trainer && g.teamId ? meIn?.(g.teamId) : undefined;
            const mine = me && einheit?.entries.some((x) => x.memberId === me.id);
            const owner = g.ownerId === user.id;
            const upcoming = g.kickoff !== undefined && g.kickoff > now;
            const status = players
              ? { cls: 'status status-ok', text: `${players} Spieler mit Daten` }
              : upcoming
                ? { cls: 'status', text: 'Geplant' }
                : { cls: 'status status-bad', text: 'Daten fehlen' };
            const who = owner ? undefined : g.forTeam ? 'vom Trainer' : 'von einem Spieler';
            const canUpload = trainer ? !!g.teamId : !!me && !mine;
            const note = notes[g.id];
            return (
              <li key={g.id} className="game-row">
                <div className="grow">
                  <TemplateSummary template={g} extra={[teamName(g.teamId) ?? (g.teamId ? undefined : 'ohne Team'), who].filter(Boolean).join(' · ')} />
                  {note && <p className={note.ok ? 'form-ok' : 'form-error'}>{note.text}</p>}
                  {!trainer && !g.teamId && <p className="muted small">Ohne Team kannst du keine Daten hochladen.</p>}
                </div>
                <div className="row-actions">
                  <span className={status.cls}>{status.text}</span>
                  {einheit && (trainer || mine) && (
                    <button className="btn" onClick={() => onOpen(g, einheit)}>
                      {trainer ? 'Auswertung' : 'Meine Auswertung'}
                    </button>
                  )}
                  {canUpload && (
                    <label className={busy === g.id ? 'btn btn-accept disabled' : 'btn btn-accept'}>
                      <UploadIcon />
                      {busy === g.id ? 'Lädt hoch …' : trainer ? (players ? 'Daten ergänzen' : 'Daten hochladen') : 'Meine Daten hochladen'}
                      <input
                        type="file"
                        accept={trainer ? '.gpx,.zip' : '.gpx'}
                        multiple={trainer}
                        hidden
                        disabled={busy === g.id}
                        onChange={(e) => {
                          upload(g, Array.from(e.target.files ?? []));
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {owner && (
                    <button className="icon-btn danger" aria-label={`${g.title} löschen`} title="Spiel löschen" onClick={() => onDelete(g)}>
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- Vorlage anlegen / bearbeiten ----------

function TemplateForm({
  trainer,
  teams,
  template,
  error,
  onCancel,
  onSave,
}: {
  trainer: boolean;
  teams: Team[];
  template?: Template;
  error?: string;
  onCancel: () => void;
  onSave: (data: TemplateData, teamIds: string[], andCreate: boolean) => Promise<void>;
}) {
  const [pitch, setPitch] = useState(template?.pitch ?? emptyPitchMap());
  const [teamIds, setTeamIds] = useState<string[]>(template?.teamIds ?? (teams.length === 1 ? [teams[0].id] : []));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const andCreate = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'create';
    if (!isComplete(pitch)) {
      setProblem(`Bitte alle ${TOTAL_POINTS} Punkte des Platzes setzen (${countSet(pitch)} gesetzt).`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? '').trim() || undefined;
    const duration = Number(f.get('duration'));
    setProblem(undefined);
    setBusy(true);
    await onSave(
      {
        title: text('title') ?? 'Spiel',
        kind: text('kind') ?? 'Spiel',
        opponent: text('opponent'),
        place: text('place'),
        kickoff: fromLocalInput(String(f.get('kickoff') ?? '')),
        durationMin: duration > 0 ? duration : undefined,
        notes: text('notes'),
        pitch,
      },
      trainer ? teamIds : [],
      andCreate,
    );
    setBusy(false);
  }

  return (
    <form className="page" onSubmit={submit}>
      {(error || problem) && (
        <div className="error" role="alert">
          <p>{problem ?? error}</p>
        </div>
      )}

      <section className="panel">
        <header className="panel-head">
          <h2>{template ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h2>
          <p className="muted">Daten zum bevorstehenden Spiel.</p>
        </header>
        <div className="form-grid">
          <label className="field span-2">
            <span>Titel</span>
            <input name="title" required defaultValue={template?.title} placeholder="z. B. Meisterschaft Runde 7" />
          </label>
          <label className="field">
            <span>Art</span>
            <select name="kind" defaultValue={template?.kind ?? 'Spiel'}>
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Gegner</span>
            <input name="opponent" defaultValue={template?.opponent} placeholder="optional" />
          </label>
          <label className="field">
            <span>Ort / Platz</span>
            <input name="place" defaultValue={template?.place} placeholder="z. B. Sportplatz Leonding" />
          </label>
          <label className="field">
            <span>Anpfiff</span>
            <input name="kickoff" type="datetime-local" defaultValue={toLocalInput(template?.kickoff)} />
          </label>
          <label className="field">
            <span>Dauer (Minuten)</span>
            <input name="duration" type="number" min={1} max={300} defaultValue={template?.durationMin ?? 90} />
          </label>
          <label className="field span-2">
            <span>Notizen</span>
            <textarea name="notes" rows={2} defaultValue={template?.notes} placeholder="z. B. Treffpunkt, Aufstellung, Hinweise" />
          </label>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Platz vermessen</h2>
          <p className="muted">Eckpunkte des Spielfelds und der beiden Strafräume.</p>
        </header>
        <PitchSetup value={pitch} onChange={setPitch} />
      </section>

      {trainer && (
        <section className="panel">
          <header className="panel-head">
            <h2>Teams zuweisen</h2>
            <p className="muted">Spieler dieser Teams sehen die Vorlage und können sie übernehmen.</p>
          </header>
          {teams.length === 0 ? (
            <p className="muted">Lege zuerst ein Team an.</p>
          ) : (
            <div className="assign">
              {teams.map((team) => {
                const on = teamIds.includes(team.id);
                return (
                  <button
                    key={team.id}
                    type="button"
                    className={on ? 'toggle on' : 'toggle'}
                    aria-pressed={on}
                    onClick={() => setTeamIds(on ? teamIds.filter((id) => id !== team.id) : [...teamIds, team.id])}
                  >
                    {team.name}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="btn" name="action" value="save" disabled={busy}>
          Speichern
        </button>
        <button className="btn btn-accept" name="action" value="create" disabled={busy || !teams.length}>
          Speichern &amp; Spiel anlegen
        </button>
      </div>
    </form>
  );
}

// ---------- Spiel aus Vorlage anlegen ----------

function CreateGameForm({
  trainer,
  teams,
  template,
  error,
  onCancel,
  onCreate,
}: {
  trainer: boolean;
  teams: Team[];
  template: Template;
  error?: string;
  onCancel: () => void;
  onCreate: (teamId: string, kickoff?: number) => Promise<void>;
}) {
  // Spieler: bevorzugt das Team, über das ihm die Vorlage zugewiesen wurde.
  const preferred = teams.find((x) => template.teamIds.includes(x.id)) ?? teams[0];
  const [teamId, setTeamId] = useState(preferred?.id ?? '');
  const [at, setAt] = useState(toLocalInput(template.kickoff));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onCreate(teamId, fromLocalInput(at));
    setBusy(false);
  }

  return (
    <form className="page" onSubmit={submit}>
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
        </div>
      )}
      <section className="panel start-panel">
        <header className="panel-head">
          <h2>Spiel anlegen</h2>
        </header>
        <TemplateSummary template={template} />
        {template.notes && <p className="notes">{template.notes}</p>}

        <label className="field">
          <span>Team</span>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
            {teams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <span className="muted small">
            {trainer
              ? 'Alle Spieler dieses Teams sehen das Spiel und können nach dem Spiel ihre Daten dazu hochladen.'
              : 'Deine Daten landen nach dem Hochladen in diesem Team.'}
          </span>
        </label>

        <label className="field">
          <span>Anpfiff</span>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>

        <p className="muted small">Nach dem Spiel lädst du die Daten der Uhren unter „Spiele“ direkt in dieses Spiel hoch.</p>
      </section>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="btn btn-accept" disabled={busy || !teamId}>
          Spiel anlegen
        </button>
      </div>
    </form>
  );
}
