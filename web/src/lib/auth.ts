// Anmeldung über Supabase Auth. Ein Konto pro E-Mail, das Trainer, Spieler oder beides sein kann.
// Welche Rolle gerade aktiv ist, merkt sich nur der Browser.
import { check, supabase } from './supabase';

export type Role = 'trainer' | 'spieler';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role; // aktive Rolle
  roles: Role[]; // alle Rollen dieses Kontos
}

interface Profile {
  id: string;
  email: string;
  name: string;
  trainer: boolean;
  spieler: boolean;
}

const ROLE_KEY = 'backtrack.role';
const label = (r: Role) => (r === 'trainer' ? 'Trainer' : 'Spieler');

function rememberRole(role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {
    // nur Komfort
  }
}

function toUser(p: Profile, role?: Role): User {
  const roles = (['trainer', 'spieler'] as Role[]).filter((r) => p[r]);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(ROLE_KEY);
  } catch {
    // egal
  }
  const active = role ?? (roles.includes(stored as Role) ? (stored as Role) : roles[0] ?? 'spieler');
  rememberRole(active);
  return { id: p.id, name: p.name, email: p.email, role: active, roles };
}

async function loadProfile(id: string): Promise<Profile> {
  const p = check(await supabase.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null;
  if (p) return p;
  // Falls der Trigger in der Datenbank fehlt: Profil selbst anlegen.
  const { data } = await supabase.auth.getUser();
  const meta = data.user?.user_metadata ?? {};
  const fresh = { id, email: (data.user?.email ?? '').toLowerCase(), name: meta.name ?? '', trainer: meta.role === 'trainer', spieler: meta.role === 'spieler' };
  check(await supabase.from('profiles').insert(fresh));
  return fresh;
}

async function addRole(p: Profile, role: Role): Promise<Profile> {
  check(await supabase.from('profiles').update({ [role]: true }).eq('id', p.id));
  return { ...p, [role]: true };
}

// Beim Start: noch angemeldet?
export async function currentUser(): Promise<User | undefined> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return undefined;
  try {
    return toUser(await loadProfile(data.session.user.id));
  } catch {
    return undefined;
  }
}

function translate(message: string) {
  if (/invalid login credentials/i.test(message)) return 'E-Mail oder Passwort stimmt nicht.';
  if (/email not confirmed/i.test(message)) return 'Bitte bestätige zuerst deine E-Mail (Link im Postfach).';
  if (/password should be at least/i.test(message)) return 'Das Passwort ist zu kurz.';
  if (/rate limit/i.test(message)) return 'Zu viele Versuche, bitte kurz warten.';
  if (/failed to fetch|network/i.test(message)) return 'Keine Verbindung zur Datenbank.';
  return message;
}

export async function register(user: Omit<User, 'id' | 'roles'>, password: string): Promise<User> {
  const email = user.email.trim().toLowerCase();
  const name = user.name.trim();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role: user.role } } });

  // E-Mail gibt es schon: mit dem Passwort anmelden und die zweite Rolle dazunehmen.
  if (error && /already registered|already exists/i.test(error.message)) {
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error('Diese E-Mail ist schon registriert. Melde dich an oder nimm dasselbe Passwort.');
    const p = await loadProfile(signIn.data.user.id);
    if (p[user.role]) {
      await supabase.auth.signOut();
      throw new Error(`Mit dieser E-Mail gibt es schon ein ${label(user.role)}konto.`);
    }
    return toUser(await addRole(p, user.role), user.role);
  }
  if (error) throw new Error(translate(error.message));
  if (!data.session) {
    throw new Error('Konto angelegt. Bitte bestätige die E-Mail über den Link im Postfach und melde dich dann an.');
  }
  return toUser(await loadProfile(data.session.user.id), user.role);
}

export async function login(email: string, password: string, role: Role): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(translate(error.message));
  const p = await loadProfile(data.user.id);
  if (!p[role]) {
    await supabase.auth.signOut();
    const other: Role = role === 'trainer' ? 'spieler' : 'trainer';
    throw new Error(`Diese E-Mail hat nur ein ${label(other)}konto.`);
  }
  return toUser(p, role);
}

export function hasRole(user: User, role: Role) {
  return user.roles.includes(role);
}

// Trainer, der selbst mitspielt: dasselbe Konto bekommt zusätzlich die Spielerrolle.
export async function createPlayerAccount(user: User): Promise<User> {
  if (hasRole(user, 'spieler')) return user;
  check(await supabase.from('profiles').update({ spieler: true }).eq('id', user.id));
  return { ...user, roles: [...user.roles, 'spieler'] };
}

// Wechsel zwischen Trainer- und Spieleransicht, ohne neu anzumelden.
export function switchRole(user: User, role: Role): User | undefined {
  if (!hasRole(user, role)) return undefined;
  rememberRole(role);
  return { ...user, role };
}

export async function logout() {
  await supabase.auth.signOut();
}
