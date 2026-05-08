-- Initial schema for Plataforma de Inteligencia Clínica · Logoterapia
-- Designed for Supabase Postgres + Supabase Auth (auth.users)

begin;

-- Extensions (Supabase typically has pgcrypto enabled, but this is safe)
create extension if not exists "pgcrypto";

-- ============
-- Helpers
-- ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============
-- Profiles (therapists)
-- ============
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile rows for new auth users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============
-- Consultantes (patients)
-- ============
create table if not exists public.consultantes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Optional legacy id from localStorage like "c_171..."
  legacy_id text,

  nombre text not null,
  edad integer,
  telefono text,
  motivo_consulta text,
  quien_refiere text,
  fecha_alta timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultantes_user_id_idx on public.consultantes (user_id);
create index if not exists consultantes_user_id_nombre_idx on public.consultantes (user_id, nombre);

drop trigger if exists consultantes_set_updated_at on public.consultantes;
create trigger consultantes_set_updated_at
before update on public.consultantes
for each row execute function public.set_updated_at();

alter table public.consultantes enable row level security;

drop policy if exists "consultantes_select_own" on public.consultantes;
create policy "consultantes_select_own"
on public.consultantes for select
using (auth.uid() = user_id);

drop policy if exists "consultantes_insert_own" on public.consultantes;
create policy "consultantes_insert_own"
on public.consultantes for insert
with check (auth.uid() = user_id);

drop policy if exists "consultantes_update_own" on public.consultantes;
create policy "consultantes_update_own"
on public.consultantes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "consultantes_delete_own" on public.consultantes;
create policy "consultantes_delete_own"
on public.consultantes for delete
using (auth.uid() = user_id);

-- ============
-- Citas (appointments)
-- ============
create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consultante_id uuid references public.consultantes (id) on delete set null,

  legacy_id text,

  -- UI uses string dates/times; we store both normalized and raw
  fecha date not null,
  hora time,
  hora_fin time,
  duracion_min integer,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists citas_user_id_idx on public.citas (user_id);
create index if not exists citas_consultante_id_idx on public.citas (consultante_id);
create index if not exists citas_user_id_fecha_idx on public.citas (user_id, fecha);

drop trigger if exists citas_set_updated_at on public.citas;
create trigger citas_set_updated_at
before update on public.citas
for each row execute function public.set_updated_at();

alter table public.citas enable row level security;

drop policy if exists "citas_select_own" on public.citas;
create policy "citas_select_own"
on public.citas for select
using (auth.uid() = user_id);

drop policy if exists "citas_insert_own" on public.citas;
create policy "citas_insert_own"
on public.citas for insert
with check (auth.uid() = user_id);

drop policy if exists "citas_update_own" on public.citas;
create policy "citas_update_own"
on public.citas for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "citas_delete_own" on public.citas;
create policy "citas_delete_own"
on public.citas for delete
using (auth.uid() = user_id);

-- ============
-- Notas de sesión (quick notes)
-- ============
create table if not exists public.notas_sesion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consultante_id uuid references public.consultantes (id) on delete set null,

  legacy_id text,

  sesion_num text,
  consulta_de text,
  fecha date not null,
  motivo_consulta text,
  tema_consulta text,
  contenido text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notas_sesion_user_id_idx on public.notas_sesion (user_id);
create index if not exists notas_sesion_consultante_id_idx on public.notas_sesion (consultante_id);
create index if not exists notas_sesion_user_id_fecha_idx on public.notas_sesion (user_id, fecha);

drop trigger if exists notas_sesion_set_updated_at on public.notas_sesion;
create trigger notas_sesion_set_updated_at
before update on public.notas_sesion
for each row execute function public.set_updated_at();

alter table public.notas_sesion enable row level security;

drop policy if exists "notas_sesion_select_own" on public.notas_sesion;
create policy "notas_sesion_select_own"
on public.notas_sesion for select
using (auth.uid() = user_id);

drop policy if exists "notas_sesion_insert_own" on public.notas_sesion;
create policy "notas_sesion_insert_own"
on public.notas_sesion for insert
with check (auth.uid() = user_id);

drop policy if exists "notas_sesion_update_own" on public.notas_sesion;
create policy "notas_sesion_update_own"
on public.notas_sesion for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notas_sesion_delete_own" on public.notas_sesion;
create policy "notas_sesion_delete_own"
on public.notas_sesion for delete
using (auth.uid() = user_id);

-- ============
-- Reportes de sesión (formal report)
-- ============
create table if not exists public.reportes_sesion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consultante_id uuid references public.consultantes (id) on delete set null,

  legacy_id text,

  orientador text,
  sesion_num text,
  consulta_de text,
  total_sesiones text,
  fecha date not null,

  motivo_consulta text,
  tema_consulta text,
  intervencion text,
  auto_observacion text,
  tiempo_sesion text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reportes_sesion_user_id_idx on public.reportes_sesion (user_id);
create index if not exists reportes_sesion_consultante_id_idx on public.reportes_sesion (consultante_id);
create index if not exists reportes_sesion_user_id_fecha_idx on public.reportes_sesion (user_id, fecha);

drop trigger if exists reportes_sesion_set_updated_at on public.reportes_sesion;
create trigger reportes_sesion_set_updated_at
before update on public.reportes_sesion
for each row execute function public.set_updated_at();

alter table public.reportes_sesion enable row level security;

drop policy if exists "reportes_sesion_select_own" on public.reportes_sesion;
create policy "reportes_sesion_select_own"
on public.reportes_sesion for select
using (auth.uid() = user_id);

drop policy if exists "reportes_sesion_insert_own" on public.reportes_sesion;
create policy "reportes_sesion_insert_own"
on public.reportes_sesion for insert
with check (auth.uid() = user_id);

drop policy if exists "reportes_sesion_update_own" on public.reportes_sesion;
create policy "reportes_sesion_update_own"
on public.reportes_sesion for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "reportes_sesion_delete_own" on public.reportes_sesion;
create policy "reportes_sesion_delete_own"
on public.reportes_sesion for delete
using (auth.uid() = user_id);

commit;

