-- =============================================================================
-- Iron Fit Club — Rutinas de entrenamiento (plantillas) · Bloque 3
-- =============================================================================
-- Una rutina es una plantilla de ejercicios (con series/reps objetivo opcionales)
-- para un socio. La puede crear el propio socio o el coach (asignándosela).
--   • routines           — plantilla de un socio (member_id = a quién pertenece)
--   • routine_exercises  — ejercicios de la rutina, en orden, con objetivo
--
-- RLS: el socio ve/edita sus rutinas; el staff (admin/coach) ve/edita todas.
-- =============================================================================

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  name text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routines_member_idx on public.routines(member_id);

drop trigger if exists trg_routines_updated_at on public.routines;
create trigger trg_routines_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

alter table public.routines enable row level security;

drop policy if exists routines_all on public.routines;
create policy routines_all on public.routines
  for all to authenticated
  using (
    exists (select 1 from public.members m where m.id = routines.member_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  )
  with check (
    exists (select 1 from public.members m where m.id = routines.member_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  );

create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position integer not null default 0,
  target_sets integer check (target_sets is null or target_sets > 0),
  target_reps integer check (target_reps is null or target_reps > 0)
);
create index if not exists routine_exercises_routine_idx on public.routine_exercises(routine_id);

alter table public.routine_exercises enable row level security;

drop policy if exists routine_exercises_all on public.routine_exercises;
create policy routine_exercises_all on public.routine_exercises
  for all to authenticated
  using (
    exists (
      select 1 from public.routines r
      join public.members m on m.id = r.member_id
      where r.id = routine_exercises.routine_id and m.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  )
  with check (
    exists (
      select 1 from public.routines r
      join public.members m on m.id = r.member_id
      where r.id = routine_exercises.routine_id and m.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  );
