-- Preparando mi sesión: persisted conversations (per consultante)

begin;

create table if not exists public.prep_conversaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consultante_id uuid references public.consultantes (id) on delete cascade,
  legacy_id text,
  titulo text not null default '',
  mensajes jsonb not null default '[]'::jsonb,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prep_conversaciones_user_id_idx on public.prep_conversaciones (user_id);
create index if not exists prep_conversaciones_consultante_id_idx on public.prep_conversaciones (consultante_id);
create index if not exists prep_conversaciones_user_consult_actualizada_idx on public.prep_conversaciones (user_id, consultante_id, actualizada desc);

drop trigger if exists prep_conversaciones_set_updated_at on public.prep_conversaciones;
create trigger prep_conversaciones_set_updated_at
before update on public.prep_conversaciones
for each row execute function public.set_updated_at();

alter table public.prep_conversaciones enable row level security;

drop policy if exists "prep_select_own" on public.prep_conversaciones;
create policy "prep_select_own" on public.prep_conversaciones for select using (auth.uid() = user_id);

drop policy if exists "prep_insert_own" on public.prep_conversaciones;
create policy "prep_insert_own" on public.prep_conversaciones for insert with check (auth.uid() = user_id);

drop policy if exists "prep_update_own" on public.prep_conversaciones;
create policy "prep_update_own" on public.prep_conversaciones for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "prep_delete_own" on public.prep_conversaciones;
create policy "prep_delete_own" on public.prep_conversaciones for delete using (auth.uid() = user_id);

commit;
