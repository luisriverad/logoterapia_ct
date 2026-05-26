-- Ayuda chat + Mi Biblioteca (per user)

begin;

create table if not exists public.ayuda_conversaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_id text,
  titulo text not null default '',
  mensajes jsonb not null default '[]'::jsonb,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ayuda_conversaciones_user_id_idx on public.ayuda_conversaciones (user_id);
create index if not exists ayuda_conversaciones_user_actualizada_idx on public.ayuda_conversaciones (user_id, actualizada desc);

drop trigger if exists ayuda_conversaciones_set_updated_at on public.ayuda_conversaciones;
create trigger ayuda_conversaciones_set_updated_at
before update on public.ayuda_conversaciones
for each row execute function public.set_updated_at();

alter table public.ayuda_conversaciones enable row level security;

drop policy if exists "ayuda_select_own" on public.ayuda_conversaciones;
create policy "ayuda_select_own" on public.ayuda_conversaciones for select using (auth.uid() = user_id);

drop policy if exists "ayuda_insert_own" on public.ayuda_conversaciones;
create policy "ayuda_insert_own" on public.ayuda_conversaciones for insert with check (auth.uid() = user_id);

drop policy if exists "ayuda_update_own" on public.ayuda_conversaciones;
create policy "ayuda_update_own" on public.ayuda_conversaciones for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ayuda_delete_own" on public.ayuda_conversaciones;
create policy "ayuda_delete_own" on public.ayuda_conversaciones for delete using (auth.uid() = user_id);

-- ============
create table if not exists public.biblioteca (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_id text,
  titulo text not null default '',
  pregunta text,
  respuesta text not null default '',
  fecha timestamptz not null default now(),
  origen jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists biblioteca_user_id_idx on public.biblioteca (user_id);
create index if not exists biblioteca_user_fecha_idx on public.biblioteca (user_id, fecha desc);

drop trigger if exists biblioteca_set_updated_at on public.biblioteca;
create trigger biblioteca_set_updated_at
before update on public.biblioteca
for each row execute function public.set_updated_at();

alter table public.biblioteca enable row level security;

drop policy if exists "biblioteca_select_own" on public.biblioteca;
create policy "biblioteca_select_own" on public.biblioteca for select using (auth.uid() = user_id);

drop policy if exists "biblioteca_insert_own" on public.biblioteca;
create policy "biblioteca_insert_own" on public.biblioteca for insert with check (auth.uid() = user_id);

drop policy if exists "biblioteca_update_own" on public.biblioteca;
create policy "biblioteca_update_own" on public.biblioteca for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "biblioteca_delete_own" on public.biblioteca;
create policy "biblioteca_delete_own" on public.biblioteca for delete using (auth.uid() = user_id);

commit;
