// Vorläufige Anmeldung nur im Browser (localStorage), bis es eine Datenbank gibt.
// Nicht sicher, nur zum Ausprobieren der Abläufe.

export type Role = 'trainer' | 'spieler';

export interface User {
  name: string;
  email: string;
  role: Role;
}

interface StoredUser extends User {
  passHash: string;
}

const USERS = 'backtrack.users';
const SESSION = 'backtrack.session';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Privates Fenster o. Ä.: Anmeldung gilt dann nur bis zum Neuladen.
  }
}

async function hash(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function currentUser(): User | undefined {
  return read<User | undefined>(SESSION, undefined);
}

// Pro E-Mail kann es je ein Trainer- und ein Spielerkonto geben (Trainer, der selbst mitspielt).
const find = (users: StoredUser[], email: string, role: Role) =>
  users.find((u) => u.email === email.trim().toLowerCase() && u.role === role);

function startSession(u: StoredUser): User {
  const session = { name: u.name, email: u.email, role: u.role };
  write(SESSION, session);
  return session;
}

export async function register(user: User, password: string): Promise<User> {
  const email = user.email.trim().toLowerCase();
  const users = read<StoredUser[]>(USERS, []);
  if (find(users, email, user.role)) {
    throw new Error(`Mit dieser E-Mail gibt es schon ein ${user.role === 'trainer' ? 'Trainer' : 'Spieler'}konto.`);
  }
  const stored = { ...user, name: user.name.trim(), email, passHash: await hash(password) };
  write(USERS, [...users, stored]);
  return startSession(stored);
}

export async function login(email: string, password: string, role: Role): Promise<User> {
  const users = read<StoredUser[]>(USERS, []);
  const found = find(users, email, role);
  if (!found) {
    const other = find(users, email, role === 'trainer' ? 'spieler' : 'trainer');
    if (other) throw new Error(`Diese E-Mail hat nur ein ${other.role === 'trainer' ? 'Trainer' : 'Spieler'}konto.`);
    throw new Error('E-Mail oder Passwort stimmt nicht.');
  }
  if (found.passHash !== (await hash(password))) throw new Error('E-Mail oder Passwort stimmt nicht.');
  return startSession(found);
}

export function hasAccount(email: string, role: Role) {
  return Boolean(find(read<StoredUser[]>(USERS, []), email, role));
}

// Trainer legt sich mit derselben E-Mail und demselben Passwort ein Spielerkonto an.
export function createPlayerAccount(trainer: User) {
  const users = read<StoredUser[]>(USERS, []);
  const own = find(users, trainer.email, 'trainer');
  if (!own || find(users, trainer.email, 'spieler')) return;
  write(USERS, [...users, { ...own, role: 'spieler' }]);
}

// Wechsel zwischen den beiden Konten derselben E-Mail, ohne neu anzumelden.
export function switchRole(user: User, role: Role): User | undefined {
  const other = find(read<StoredUser[]>(USERS, []), user.email, role);
  return other && startSession(other);
}

export function logout() {
  write(SESSION, undefined);
}
