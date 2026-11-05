import type { ReactNode } from 'react';
import type { User } from '../lib/auth';
import { LogoutIcon } from './Icons';

export interface NavItem {
  key: string;
  hash: string;
  label: string;
  icon: ReactNode;
}

interface Props {
  user: User;
  nav: NavItem[];
  active: string;
  sidebar?: ReactNode; // Team-Auswahl, Import usw.
  roleSwitch?: { label: string; onClick: () => void };
  onLogout: () => void;
  eyebrow: string;
  title: string;
  aside?: ReactNode; // rechts neben der Überschrift
  children: ReactNode;
}

// Gemeinsames Gerüst für Trainer- und Spieleransicht.
export default function Shell({ user, nav, active, sidebar, roleSwitch, onLogout, eyebrow, title, aside, children }: Props) {
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href={`#${nav[0]?.hash ?? ''}`} aria-label="BackTrack Start">
          <span className="brand-mark" aria-hidden>
            B<span>T</span>
          </span>
          <span className="brand-word">
            Back<span>Track</span>
          </span>
        </a>

        {sidebar}

        {nav.length > 0 && (
          <nav className="nav">
            {nav.map((n) => (
              <a key={n.key} href={`#${n.hash}`} className={active === n.key ? 'nav-item active' : 'nav-item'}>
                {n.icon}
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
        )}

        <div className="account">
          {roleSwitch && (
            <button className="role-switch" onClick={roleSwitch.onClick}>
              {roleSwitch.label}
            </button>
          )}
          <div className="account-row">
            <span className="avatar" aria-hidden>
              {initials}
            </span>
            <span className="account-who">
              <strong>{user.name}</strong>
              <span className="muted small">{user.role === 'trainer' ? 'Trainer' : 'Spieler'}</span>
            </span>
            <button className="icon-btn" onClick={onLogout} aria-label="Abmelden" title="Abmelden">
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topline">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {aside}
        </header>
        {children}
      </main>
    </div>
  );
}
