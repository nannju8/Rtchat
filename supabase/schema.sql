-- =====================================================================
--  Messagerie de groupe temps réel — Schéma Supabase complet
--  À coller et exécuter en une seule fois dans :
--  Supabase > SQL Editor > New query > Run
--  Le script est idempotent : on peut le relancer sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- Profils : une ligne par utilisateur inscrit (liée à auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique,
  created_at  timestamptz not null default now(),
  constraint profiles_username_length check (char_length(btrim(username)) between 3 and 20)
);

-- Pseudo unique sans tenir compte de la casse (« Marie » = « marie »)
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- Groupes de discussion
-- created_by est nullable pour permettre le groupe par défaut « Général »
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint groups_name_length check (char_length(btrim(name)) between 1 and 40)
);

-- Nom de groupe unique sans tenir compte de la casse
create unique index if not exists groups_name_lower_idx
  on public.groups (lower(name));

-- Messages
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now(),
  constraint messages_content_length check (
    char_length(btrim(content)) between 1 and 2000
  )
);

create index if not exists messages_group_created_idx
  on public.messages (group_id, created_at);

-- ---------------------------------------------------------------------
-- 2. TRIGGER : création automatique du profil à l'inscription
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  -- Le pseudo est transmis par le frontend dans les métadonnées du signUp
  v_username := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');

  -- Filet de sécurité si aucun pseudo n'est fourni
  if v_username is null then
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. FONCTION : vérifier la disponibilité d'un pseudo avant l'inscription
--    (renvoie uniquement true/false, n'expose aucune donnée de profil)
--    Optionnelle : si vous la supprimez, l'inscription fonctionne quand
--    même, l'unicité restant garantie par la base.
-- ---------------------------------------------------------------------

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(btrim(p_username))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups   enable row level security;
alter table public.messages enable row level security;

-- On force aussi le RLS pour le propriétaire des tables
alter table public.profiles force row level security;
alter table public.groups   force row level security;
alter table public.messages force row level security;

-- Privilèges SQL : rien pour anon, le strict nécessaire pour authenticated
revoke all on public.profiles from anon, authenticated;
revoke all on public.groups   from anon, authenticated;
revoke all on public.messages from anon, authenticated;

grant select         on public.profiles to authenticated;
grant select, insert on public.groups   to authenticated;
grant select, insert, delete on public.messages to authenticated;

-- ----- profiles -----
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- ----- groups -----
drop policy if exists "groups_select_authenticated" on public.groups;
create policy "groups_select_authenticated"
  on public.groups for select
  to authenticated
  using (true);

drop policy if exists "groups_insert_authenticated" on public.groups;
create policy "groups_insert_authenticated"
  on public.groups for insert
  to authenticated
  with check (auth.uid() = created_by);

-- ----- messages -----
drop policy if exists "messages_select_authenticated" on public.messages;
create policy "messages_select_authenticated"
  on public.messages for select
  to authenticated
  using (true);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
  on public.messages for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. REALTIME
-- ---------------------------------------------------------------------

-- Table messages (obligatoire)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Table groups (bonus : les nouveaux groupes apparaissent chez tout le monde)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'groups'
  ) then
    alter publication supabase_realtime add table public.groups;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. GROUPE PAR DÉFAUT
-- ---------------------------------------------------------------------

insert into public.groups (name, created_by)
values ('Général', null)
on conflict do nothing;
