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

export async function register(user: User, password: string): Promise<User> {
  const email = user.email.trim().toLowerCase();
  const users = read<StoredUser[]>(USERS, []);
  if (users.some((u) => u.email === email)) throw new Error('Mit dieser E-Mail gibt es schon ein Konto.');
  const stored = { ...user, name: user.name.trim(), email, passHash: await hash(password) };
  write(USERS, [...users, stored]);
  const session = { name: stored.name, email, role: stored.role };
  write(SESSION, session);
  return session;
}

export async function login(email: string, password: string, role: Role): Promise<User> {
  const users = read<StoredUser[]>(USERS, []);
  const found = users.find((u) => u.email === email.trim().toLowerCase());
  if (!found || found.passHash !== (await hash(password))) throw new Error('E-Mail oder Passwort stimmt nicht.');
  if (found.role !== role) {
    throw new Error(`Dieses Konto ist als ${found.role === 'trainer' ? 'Trainer' : 'Spieler'} registriert.`);
  }
  const session = { name: found.name, email: found.email, role: found.role };
  write(SESSION, session);
  return session;
}

export function logout() {
  write(SESSION, undefined);
}
