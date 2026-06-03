-- =============================================================================
-- Iron Fit Club — V3.2 Migration: Planificaciones (Weekly Programming)
-- =============================================================================
-- Adds:
--   • program_types  — types like "General", "Elite", "Beginners"
--   • weekly_programs — one row per type × week (week_start = Monday)
--   • daily_workouts  — 7 rows per weekly_program (one per day)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Program types
-- -----------------------------------------------------------------------------
create table if not exists public.program_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Seed: one default type
insert into public.program_types (name, is_active, sort_order)
values ('General', true, 0)
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Weekly programs (week_start is always a Monday)
-- -----------------------------------------------------------------------------
create table if not exists public.weekly_programs (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.program_types(id) on delete cascade,
  week_start date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(type_id, week_start)
);

create index if not exists weekly_programs_type_week_idx
  on public.weekly_programs(type_id, week_start desc);

create trigger trg_weekly_programs_updated_at
  before update on public.weekly_programs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Daily workouts (7 rows per weekly_program, one per day of week)
-- -----------------------------------------------------------------------------
create table if not exists public.daily_workouts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.weekly_programs(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sun…6=Sat
  warmup text,       -- Calentamiento
  strength text,     -- Fuerza
  wod text,          -- WOD
  accessories text,  -- Accesorios
  updated_at timestamptz not null default now(),
  unique(program_id, day_of_week)
);

create trigger trg_daily_workouts_updated_at
  before update on public.daily_workouts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. RLS
-- -----------------------------------------------------------------------------
alter table public.program_types enable row level security;
alter table public.weekly_programs enable row level security;
alter table public.daily_workouts enable row level security;

-- Admins: full access to all three tables
create policy program_types_admin_all on public.program_types
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));

create policy weekly_programs_admin_all on public.weekly_programs
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));

create policy daily_workouts_admin_all on public.daily_workouts
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));

-- Members: read all (portal can show today's WOD)
create policy program_types_member_read on public.program_types
  for select to authenticated using (true);

create policy weekly_programs_member_read on public.weekly_programs
  for select to authenticated using (true);

create policy daily_workouts_member_read on public.daily_workouts
  for select to authenticated using (true);
