import { useState } from 'react';
import { currentUser, hasAccount, logout, switchRole, type User } from './lib/auth';
import LoginPage from './pages/LoginPage';
import TrainerApp from './pages/TrainerApp';
import PlayerApp from './pages/PlayerApp';

// Trainer und Spieler bekommen getrennte Oberflächen: Spieler sehen nur sich selbst.
export default function App() {
  const [user, setUser] = useState<User | undefined>(currentUser);

  function signOut() {
    logout();
    setUser(undefined);
    window.location.hash = '';
  }

  function switchTo(role: User['role']) {
    if (!user) return;
    window.location.hash = '';
    setUser(switchRole(user, role));
  }

  if (!user) return <LoginPage onLogin={setUser} />;

  if (user.role === 'trainer') {
    return <TrainerApp key={user.email} user={user} onLogout={signOut} onSwitchRole={() => switchTo('spieler')} />;
  }
  return (
    <PlayerApp
      key={user.email}
      user={user}
      onLogout={signOut}
      roleSwitch={hasAccount(user.email, 'trainer') ? { label: 'Zur Traineransicht', onClick: () => switchTo('trainer') } : undefined}
    />
  );
}
