-- BackTrack: Datenbank für Supabase.
-- Einmal komplett im Supabase SQL Editor ausführen (Dashboard → SQL Editor → New query → Run).
-- Das Skript kann auch erneut laufen: Tabellen bleiben, Funktionen und Regeln werden neu gesetzt.
--
-- Datenschutz liegt in den Row-Level-Security-Regeln unten, nicht in der Webseite:
--   * Trainer sehen und ändern alles in ihren eigenen Teams.
--   * Spieler sehen ihre Teams und die Namen der Teamkollegen, aber nur die eigenen Messdaten.
--   * Nach einer angenommenen Vergleichsanfrage sehen beide Spieler die Messdaten des anderen (im selben Team).

-- ---------- Tabellen ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  trainer boolean not null default false,
  spieler boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trainer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Kader-Einträge. Über die E-Mail wird ein Eintrag mit einem Spielerkonto verknüpft.
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  number int,
  position text,
  hr_max int,
  email text check (email = lower(email)),
  created_at timestamptz not null default now()
);
create index if not exists members_team_idx on public.members (team_id);
create index if not exists members_email_idx on public.members (email);

-- Trainings und Spiele.
create table if not exists public.einheiten (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null,
  kind text not null default '',
  place text,
  start_ms bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists einheiten_team_idx on public.einheiten (team_id);

-- Ein Track = Messdaten eines Spielers in einer Einheit. points: [[zeit_ms, lat, lon, puls|null], ...]
create table if not exists public.tracks (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  einheit_id uuid not null references public.einheiten (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  points jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists tracks_einheit_idx on public.tracks (einheit_id);
create index if not exists tracks_member_idx on public.tracks (member_id);

-- Vergleichsanfragen zwischen zwei Spielern desselben Teams.
create table if not exists public.compare_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  from_member uuid not null references public.members (id) on delete cascade,
  to_member uuid not null references public.members (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (from_member <> to_member),
  unique (from_member, to_member)
);

-- ---------- Hilfsfunktionen für die Regeln ----------
-- security definer: laufen ohne RLS, sonst würden sich die Regeln gegenseitig endlos aufrufen.

create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_trainer_of(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams where id = team and trainer_id = auth.uid())
$$;

create or replace function public.is_in_team(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where team_id = team and email = my_email())
$$;

create or replace function public.is_me(member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = member and email = my_email())
$$;

create or replace function public.member_team(member uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from members where id = member
$$;

-- Hat dieser Spieler mir seine Daten freigegeben (angenommene Anfrage in eine der beiden Richtungen)?
create or replace function public.shares_with_me(member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from compare_requests r
    where r.status = 'accepted'
      and ((r.to_member = member and is_me(r.from_member)) or (r.from_member = member and is_me(r.to_member)))
  )
$$;

-- Neues Konto: Profil aus den Angaben bei der Registrierung anlegen.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name, trainer, spieler)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', '') = 'trainer',
    coalesce(new.raw_user_meta_data ->> 'role', '') = 'spieler'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Regeln (Row Level Security) ----------

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.einheiten enable row level security;
alter table public.tracks enable row level security;
alter table public.compare_requests enable row level security;

drop policy if exists "eigenes Profil lesen" on public.profiles;
drop policy if exists "eigenes Profil anlegen" on public.profiles;
drop policy if exists "eigenes Profil ändern" on public.profiles;
create policy "eigenes Profil lesen" on public.profiles for select to authenticated using (id = auth.uid());
create policy "eigenes Profil anlegen" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "eigenes Profil ändern" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Teams lesen" on public.teams;
drop policy if exists "Teams anlegen" on public.teams;
drop policy if exists "Teams ändern" on public.teams;
drop policy if exists "Teams löschen" on public.teams;
create policy "Teams lesen" on public.teams for select to authenticated using (trainer_id = auth.uid() or is_in_team(id));
create policy "Teams anlegen" on public.teams for insert to authenticated with check (trainer_id = auth.uid());
create policy "Teams ändern" on public.teams for update to authenticated using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy "Teams löschen" on public.teams for delete to authenticated using (trainer_id = auth.uid());

-- Teamkollegen sehen sich gegenseitig (Name, Nummer, Position), Messdaten liegen in tracks.
drop policy if exists "Kader lesen" on public.members;
drop policy if exists "Kader verwalten" on public.members;
create policy "Kader lesen" on public.members for select to authenticated using (is_trainer_of(team_id) or is_in_team(team_id));
create policy "Kader verwalten" on public.members for all to authenticated using (is_trainer_of(team_id)) with check (is_trainer_of(team_id));

drop policy if exists "Einheiten lesen" on public.einheiten;
drop policy if exists "Einheiten verwalten" on public.einheiten;
create policy "Einheiten lesen" on public.einheiten for select to authenticated using (is_trainer_of(team_id) or is_in_team(team_id));
create policy "Einheiten verwalten" on public.einheiten for all to authenticated using (is_trainer_of(team_id)) with check (is_trainer_of(team_id));

drop policy if exists "Messdaten lesen" on public.tracks;
drop policy if exists "Messdaten verwalten" on public.tracks;
create policy "Messdaten lesen" on public.tracks for select to authenticated
  using (is_trainer_of(team_id) or is_me(member_id) or shares_with_me(member_id));
create policy "Messdaten verwalten" on public.tracks for all to authenticated
  using (is_trainer_of(team_id))
  with check (is_trainer_of(team_id) and member_team(member_id) = team_id);

-- Anfragen: nur zwischen Spielern desselben Teams. Annehmen/Ablehnen darf nur der Empfänger,
-- zurückziehen bzw. Freigabe beenden dürfen beide.
drop policy if exists "Anfragen lesen" on public.compare_requests;
drop policy if exists "Anfrage senden" on public.compare_requests;
drop policy if exists "Anfrage beantworten" on public.compare_requests;
drop policy if exists "Anfrage löschen" on public.compare_requests;
create policy "Anfragen lesen" on public.compare_requests for select to authenticated
  using (is_me(from_member) or is_me(to_member));
create policy "Anfrage senden" on public.compare_requests for insert to authenticated
  with check (
    status = 'pending' and is_me(from_member)
    and member_team(from_member) = team_id and member_team(to_member) = team_id
  );
create policy "Anfrage beantworten" on public.compare_requests for update to authenticated
  using (is_me(to_member)) with check (is_me(to_member));
create policy "Anfrage löschen" on public.compare_requests for delete to authenticated
  using (is_me(from_member) or is_me(to_member));

-- Beim Beantworten darf sich nur der Status ändern.
create or replace function public.only_status_changes() returns trigger
language plpgsql as $$
begin
  if new.team_id <> old.team_id or new.from_member <> old.from_member or new.to_member <> old.to_member then
    raise exception 'Nur der Status einer Anfrage kann geändert werden.';
  end if;
  return new;
end $$;

drop trigger if exists compare_requests_status_only on public.compare_requests;
create trigger compare_requests_status_only before update on public.compare_requests
  for each row execute function public.only_status_changes();

grant select, insert, update, delete on all tables in schema public to authenticated;
