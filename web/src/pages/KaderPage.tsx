import { useState } from 'react';
import type { Einheit, Member, Team, useClub } from '../lib/club';
import { fmt } from '../lib/format';
import { TrashIcon } from '../components/Icons';

type ClubActions = ReturnType<typeof useClub>;

interface Props {
  team: Team;
  einheiten: Einheit[];
  trainerEmail: string;
  actions: ClubActions;
  hasPlayerAccount: boolean;
  onCreatePlayerAccount: () => void;
  onTeamDeleted: () => void;
}

// Nur für Trainer: Kader pflegen, Spieler mit Konten verknüpfen, Daten und Team löschen.
export default function KaderPage({ team, einheiten, trainerEmail, actions, hasPlayerAccount, onCreatePlayerAccount, onTeamDeleted }: Props) {
  const [self, setSelf] = useState('');
  const sessions = (m: Member) => einheiten.filter((e) => e.entries.some((x) => x.memberId === m.id)).length;
  const me = team.members.find((m) => m.email === trainerEmail);

  function addMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const number = Number(f.get('number'));
    actions.addMember(team.id, {
      name: String(f.get('name')).trim(),
      number: number || undefined,
      position: String(f.get('position')).trim() || undefined,
      email: String(f.get('email')).trim().toLowerCase() || undefined,
    });
    e.currentTarget.reset();
  }

  function removeMember(m: Member) {
    if (confirm(`${m.name} aus dem Kader löschen? Alle Daten von ${m.name} werden mitgelöscht.`)) {
      actions.removeMembers(team.id, [m.id]);
    }
  }

  return (
    <div className="page">
      <section className="panel">
        <header className="panel-head">
          <h2>Team</h2>
        </header>
        <div className="team-row">
          <label className="field grow">
            <span>Name</span>
            <input
              key={team.id}
              defaultValue={team.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== team.name && actions.renameTeam(team.id, e.target.value)}
            />
          </label>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm(`Team „${team.name}“ mit allen Spielern und Daten löschen?`)) {
                actions.deleteTeam(team.id);
                onTeamDeleted();
              }
            }}
          >
            <TrashIcon />
            Team löschen
          </button>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Kader</h2>
          <p className="muted">Mit der E-Mail sieht ein Spieler nach dem Anmelden seine eigenen Daten, sonst nichts.</p>
          {team.members.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm(`Alle ${team.members.length} Spieler und ihre Daten aus „${team.name}“ entfernen?`)) {
                  actions.removeMembers(team.id, team.members.map((m) => m.id));
                }
              }}
            >
              <TrashIcon />
              Alle entfernen
            </button>
          )}
        </header>

        {team.members.length === 0 ? (
          <p className="muted">Noch keine Spieler. Lade Daten hoch oder füge Spieler unten hinzu.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Spieler</th>
                  <th>E-Mail für das Spielerkonto</th>
                  <th className="num">Einheiten</th>
                  <th aria-label="Löschen" />
                </tr>
              </thead>
              <tbody>
                {team.members.map((m) => (
                  <tr key={m.id} className="static">
                    <td>
                      <div className="who">
                        <span className="jersey">{m.number ?? '–'}</span>
                        <span>
                          <strong>{m.name}</strong>
                          <span className="muted small">{m.position ?? 'Keine Position'}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <input
                        className="inline-input"
                        type="email"
                        placeholder="nicht verknüpft"
                        defaultValue={m.email ?? ''}
                        aria-label={`E-Mail von ${m.name}`}
                        onBlur={(e) => {
                          const email = e.target.value.trim().toLowerCase() || undefined;
                          if (email !== m.email) actions.updateMember(team.id, m.id, { email });
                        }}
                      />
                    </td>
                    <td className="num">{sessions(m)}</td>
                    <td className="go">
                      <button className="icon-btn danger" onClick={() => removeMember(m)} aria-label={`${m.name} löschen`} title="Spieler löschen">
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form className="add-member" onSubmit={addMember}>
          <input name="number" type="number" min={1} max={99} placeholder="Nr." aria-label="Rückennummer" />
          <input name="name" required placeholder="Name" aria-label="Name" />
          <input name="position" placeholder="Position" aria-label="Position" />
          <input name="email" type="email" placeholder="E-Mail (optional)" aria-label="E-Mail" />
          <button className="btn">Spieler hinzufügen</button>
        </form>
      </section>

      <div className="grid-2">
        <section className="panel">
          <header className="panel-head">
            <h2>Einheiten</h2>
          </header>
          {einheiten.length === 0 ? (
            <p className="muted">Noch keine Daten hochgeladen.</p>
          ) : (
            <ul className="list">
              {einheiten.map((e) => (
                <li key={e.id}>
                  <span>
                    <strong>{e.title}</strong>
                    <span className="muted small">
                      {fmt.date(e.start)} · {e.entries.length} Spieler
                    </span>
                  </span>
                  <button
                    className="icon-btn danger"
                    aria-label="Einheit löschen"
                    title="Einheit löschen"
                    onClick={() => confirm(`„${e.title}“ vom ${fmt.date(e.start)} löschen?`) && actions.deleteEinheit(e.id)}
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2>Du spielst selbst mit?</h2>
          </header>
          {me && hasPlayerAccount ? (
            <p className="muted">
              Du bist als <strong>{me.name}</strong> verknüpft. Über „Zur Spieleransicht“ unten links siehst du deine Daten so, wie
              ein Spieler sie sieht.
            </p>
          ) : (
            <>
              <p className="muted">
                Lege mit deiner E-Mail ({trainerEmail}) ein Spielerkonto an und wähle, welcher Kader-Eintrag du bist. Du meldest
                dich mit demselben Passwort an.
              </p>
              <div className="team-row">
                <select className="grow" value={self} onChange={(e) => setSelf(e.target.value)} aria-label="Ich bin">
                  <option value="">Ich bin …</option>
                  {team.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn"
                  disabled={!self}
                  onClick={() => {
                    actions.updateMember(team.id, self, { email: trainerEmail });
                    onCreatePlayerAccount();
                  }}
                >
                  Spielerkonto erstellen
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
