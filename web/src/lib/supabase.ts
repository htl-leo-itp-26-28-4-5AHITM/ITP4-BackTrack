import { createClient } from '@supabase/supabase-js';

// Zugang zur Datenbank. URL und anon key kommen aus web/.env.local (siehe .env.example).
// Der anon key darf öffentlich sein, die Daten schützen die Regeln in supabase/schema.sql.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost', key || 'missing');

// Supabase-Fehler in eine normale Exception umwandeln.
export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
