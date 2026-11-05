import { useEffect, useState } from 'react';
import { createPlayerAccount, currentUser, hasRole, logout, switchRole, type User } from './lib/auth';
import { configured, supabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import TrainerApp from './pages/TrainerApp';
import PlayerApp from './pages/PlayerApp';

// Trainer und Spieler bekommen getrennte Oberflächen: Spieler sehen nur sich selbst
// (und Teamkollegen, die einem Vergleich zugestimmt haben).
export default function App() {
  const [user, setUser] = useState<User>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!configured) return;
    currentUser().then((u) => {
      setUser(u);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(undefined);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await logout();
    setUser(undefined);
    window.location.hash = '';
  }

  function switchTo(role: User['role']) {
    if (!user) return;
    window.location.hash = '';
    setUser(switchRole(user, role));
  }

  if (!configured) return <SetupNote />;
  if (!ready) return null;
  if (!user) return <LoginPage onLogin={setUser} />;

  if (user.role === 'trainer') {
    return (
      <TrainerApp
        key={user.id}
        user={user}
        onLogout={signOut}
        onSwitchRole={() => switchTo('spieler')}
        onCreatePlayerAccount={async () => setUser(await createPlayerAccount(user))}
      />
    );
  }
  return (
    <PlayerApp
      key={user.id}
      user={user}
      onLogout={signOut}
      roleSwitch={hasRole(user, 'trainer') ? { label: 'Zur Traineransicht', onClick: () => switchTo('trainer') } : undefined}
    />
  );
}

function SetupNote() {
  return (
    <main className="main">
      <section className="panel empty-note">
        <h2>Datenbank fehlt</h2>
        <p className="muted">
          Lege im Ordner <code>web</code> eine Datei <code>.env.local</code> an (Vorlage: <code>.env.example</code>) und trage
          <code> VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code> aus deinem Supabase-Projekt ein. Danach
          <code> npm run dev</code> neu starten.
        </p>
      </section>
    </main>
  );
}
