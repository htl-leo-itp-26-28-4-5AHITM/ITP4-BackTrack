import { useState } from 'react';
import { login, register, type Role, type User } from '../lib/auth';
import { PlayerIcon, WhistleIcon } from '../components/Icons';

type Mode = 'login' | 'register';

const ROLES: { value: Role; label: string; icon: JSX.Element }[] = [
  { value: 'trainer', label: 'Trainer', icon: <WhistleIcon /> },
  { value: 'spieler', label: 'Spieler', icon: <PlayerIcon /> },
];

export default function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<Role>('trainer');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setError(undefined);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'register') {
        if (password.length < 6) throw new Error('Das Passwort braucht mindestens 6 Zeichen.');
        if (password !== form.get('password2')) throw new Error('Die Passwörter stimmen nicht überein.');
        onLogin(await register({ name: String(form.get('name')), email, role }, password));
      } else {
        onLogin(await login(email, password, role));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-hero" aria-hidden>
        <div className="brand">
          <span className="brand-mark">
            B<span>T</span>
          </span>
          <span className="brand-word">
            Back<span>Track</span>
          </span>
        </div>
        <svg viewBox="0 0 105 68" className="auth-pitch">
          <rect x="0.2" y="0.2" width="104.6" height="67.6" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="0" y="13.84" width="16.5" height="40.32" />
          <rect x="88.5" y="13.84" width="16.5" height="40.32" />
          <path className="auth-run" d="M14 50 C 28 44, 30 22, 44 20 S 62 38, 70 30 S 86 14, 92 24" />
        </svg>
        <div className="auth-claim">
          <h2>Jeder Lauf zählt.</h2>
          <p>Strecke, Sprints, Puls und Heatmap für jeden Spieler, nach jedem Training und Spiel.</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? 'active' : ''}
                onClick={() => switchMode(m)}
              >
                {m === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <h1>{mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}</h1>
          <p className="muted">
            {mode === 'login' ? 'Melde dich an, um deine Daten zu sehen.' : 'In einer Minute startklar.'}
          </p>

          <form onSubmit={submit} className="auth-form">
            <fieldset className="roles">
              <legend>Ich bin</legend>
              {ROLES.map((r) => (
                <label key={r.value} className={role === r.value ? 'role active' : 'role'}>
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                  />
                  {r.icon}
                  <span>{r.label}</span>
                </label>
              ))}
            </fieldset>

            {mode === 'register' && (
              <label className="field">
                <span>Name</span>
                <input name="name" required autoComplete="name" placeholder="Vor- und Nachname" />
              </label>
            )}
            <label className="field">
              <span>E-Mail</span>
              <input name="email" type="email" required autoComplete="email" placeholder="name@verein.at" />
            </label>
            <label className="field">
              <span>Passwort</span>
              <input
                name="password"
                type="password"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
            {mode === 'register' && (
              <label className="field">
                <span>Passwort wiederholen</span>
                <input name="password2" type="password" required autoComplete="new-password" />
              </label>
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button className="btn-primary" disabled={busy}>
              {mode === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
          </form>

          <p className="auth-foot muted">
            {mode === 'login' ? 'Noch kein Konto? ' : 'Schon registriert? '}
            <button type="button" className="link" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Jetzt registrieren' : 'Zur Anmeldung'}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
