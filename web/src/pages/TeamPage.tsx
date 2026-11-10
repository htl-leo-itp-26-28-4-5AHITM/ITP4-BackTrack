import type { Member } from '../lib/club';
import { between, type useCompareRequests } from '../lib/compare';
import type { Link } from './PlayerApp';

type Compare = ReturnType<typeof useCompareRequests>;

// Spieler sieht seine Teamkollegen ohne Werte und kann Vergleiche anfragen, annehmen oder beenden.
export default function TeamPage({ links, compare }: { links: Link[]; compare: Compare }) {
  if (!links.length) {
    return (
      <section className="panel empty-note">
        <h2>Noch in keinem Team</h2>
        <p className="muted">Dein Trainer muss dich zuerst mit deiner E-Mail im Kader eintragen.</p>
      </section>
    );
  }

  const { requests } = compare;
  const incoming = requests.filter((r) => r.status === 'pending' && links.some((l) => l.member.id === r.to));

  return (
    <div className="page">
      {incoming.length > 0 && (
        <section className="panel">
          <header className="panel-head">
            <h2>Vergleichsanfragen an dich</h2>
          </header>
          <ul className="list">
            {incoming.map((r) => {
              const link = links.find((l) => l.member.id === r.to)!;
              const from = link.team.members.find((m) => m.id === r.from);
              return (
                <li key={r.id}>
                  <Who member={from} note={`${link.team.name} · möchte eure Werte vergleichen`} />
                  <span className="row-actions">
                    <button className="btn btn-accept" onClick={() => compare.answer(r.id, true)}>
                      Annehmen
                    </button>
                    <button className="btn" onClick={() => compare.answer(r.id, false)}>
                      Ablehnen
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {links.map(({ team, member: me }) => {
        const mates = team.members.filter((m) => m.id !== me.id);
        return (
          <section className="panel" key={team.id}>
            <header className="panel-head">
              <h2>{team.name}</h2>
              <p className="muted">
                Du siehst nur Namen. Werte gibt es erst, wenn beide einem Vergleich zustimmen, und nur für euch zwei.
              </p>
            </header>
            {mates.length === 0 ? (
              <p className="muted">Noch keine Teamkollegen im Kader.</p>
            ) : (
              <ul className="list">
                {mates.map((m) => {
                  const r = between(requests, me.id, m.id);
                  const sent = r?.from === me.id;
                  return (
                    <li key={m.id}>
                      <Who member={m} note={!m.email ? 'Noch ohne Konto' : undefined} />
                      <span className="row-actions">
                        {!r || (r.status === 'declined' && !sent) ? (
                          <button className="btn" disabled={!m.email} onClick={() => compare.send(team.id, me.id, m.id)}>
                            Vergleich anfragen
                          </button>
                        ) : r.status === 'accepted' ? (
                          <>
                            <span className="status status-ok">Freigegeben</span>
                            <a className="btn" href="#vergleich">
                              Vergleichen
                            </a>
                            <button
                              className="btn btn-danger"
                              onClick={() => confirm(`Vergleich mit ${m.name} beenden? Ihr seht dann die Werte des anderen nicht mehr.`) && compare.remove(r.id)}
                            >
                              Beenden
                            </button>
                          </>
                        ) : r.status === 'pending' && sent ? (
                          <>
                            <span className="status">Angefragt</span>
                            <button className="btn" onClick={() => compare.remove(r.id)}>
                              Zurückziehen
                            </button>
                          </>
                        ) : r.status === 'pending' ? (
                          <>
                            <button className="btn btn-accept" onClick={() => compare.answer(r.id, true)}>
                              Annehmen
                            </button>
                            <button className="btn" onClick={() => compare.answer(r.id, false)}>
                              Ablehnen
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="status status-bad">Abgelehnt</span>
                            <button className="btn" onClick={() => compare.send(team.id, me.id, m.id)}>
                              Erneut anfragen
                            </button>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Who({ member, note }: { member?: Member; note?: string }) {
  return (
    <span className="who">
      <span className="jersey">{member?.number ?? '–'}</span>
      <span>
        <strong>{member?.name ?? 'Unbekannt'}</strong>
        <span className="muted small">{[member?.position, note].filter(Boolean).join(' · ') || 'Keine Position'}</span>
      </span>
    </span>
  );
}
