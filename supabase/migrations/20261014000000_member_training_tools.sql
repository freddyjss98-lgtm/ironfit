-- =============================================================================
-- Iron Fit Club — Herramientas de entrenamiento del socio (app móvil, F3)
-- =============================================================================
-- 1) "Exclusivo para clientes": sin membresía activa el socio puede VER su
--    historial, pero no registrar nada nuevo ni ver la planificación diaria.
--    Antes la planificación la leía cualquier usuario con sesión y las
--    herramientas de registro no miraban la membresía.
-- 2) wod_results: el resultado del WOD del día (tiempo, rondas+reps, carga o
--    reps; Rx o escalado). Uno por socio y día.
-- 3) lift_records: récords de levantamientos (1RM) para la calculadora de %.
-- 4) wod_board(): la pizarra del día. Solo devuelve nombre + inicial y el
--    resultado; quien marca members.hide_from_board no aparece.
--
-- Políticas actuales verificadas contra producción el 2026-10-14.
-- =============================================================================

-- ── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public.member_is_active(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where member_id = p_member_id and status = 'active' and end_date >= public.today_ec()
  )
$$;

-- ¿El usuario de la sesión es socio con membresía activa?
create or replace function public.current_member_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.member_is_active(public.current_member_id()), false)
$$;

-- ¿El usuario de la sesión es staff (admin/coach)?
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()))
$$;

revoke execute on function public.member_is_active(uuid) from public, anon;
revoke execute on function public.current_member_active() from public, anon;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.member_is_active(uuid) to authenticated;
grant execute on function public.current_member_active() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- ── 1. Planificación diaria: solo socios activos (staff por *_admin_all) ────
drop policy if exists daily_workouts_member_read on public.daily_workouts;
create policy daily_workouts_member_read on public.daily_workouts
  for select to authenticated using ((select public.current_member_active()));

drop policy if exists weekly_programs_member_read on public.weekly_programs;
create policy weekly_programs_member_read on public.weekly_programs
  for select to authenticated using ((select public.current_member_active()));

drop policy if exists program_types_member_read on public.program_types;
create policy program_types_member_read on public.program_types
  for select to authenticated using ((select public.current_member_active()));

-- ── 1b. Registro de entrenamiento: leer siempre lo propio, escribir solo activo
-- Las políticas *_all mezclaban lectura y escritura; se separan.
drop policy if exists workout_sessions_all on public.workout_sessions;
create policy workout_sessions_read on public.workout_sessions
  for select to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
create policy workout_sessions_write on public.workout_sessions
  for all to authenticated
  using ((select public.is_staff()) or (member_id = (select public.current_member_id()) and (select public.current_member_active())))
  with check ((select public.is_staff()) or (member_id = (select public.current_member_id()) and (select public.current_member_active())));

drop policy if exists workout_sets_all on public.workout_sets;
create policy workout_sets_read on public.workout_sets
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.workout_sessions s where s.id = workout_sets.session_id and s.member_id = (select public.current_member_id()))
  );
create policy workout_sets_write on public.workout_sets
  for all to authenticated
  using (
    (select public.is_staff())
    or ((select public.current_member_active())
        and exists (select 1 from public.workout_sessions s where s.id = workout_sets.session_id and s.member_id = (select public.current_member_id())))
  )
  with check (
    (select public.is_staff())
    or ((select public.current_member_active())
        and exists (select 1 from public.workout_sessions s where s.id = workout_sets.session_id and s.member_id = (select public.current_member_id())))
  );

drop policy if exists routines_all on public.routines;
create policy routines_read on public.routines
  for select to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
create policy routines_write on public.routines
  for all to authenticated
  using ((select public.is_staff()) or (member_id = (select public.current_member_id()) and (select public.current_member_active())))
  with check ((select public.is_staff()) or (member_id = (select public.current_member_id()) and (select public.current_member_active())));

drop policy if exists routine_exercises_all on public.routine_exercises;
create policy routine_exercises_read on public.routine_exercises
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.routines r where r.id = routine_exercises.routine_id and r.member_id = (select public.current_member_id()))
  );
create policy routine_exercises_write on public.routine_exercises
  for all to authenticated
  using (
    (select public.is_staff())
    or ((select public.current_member_active())
        and exists (select 1 from public.routines r where r.id = routine_exercises.routine_id and r.member_id = (select public.current_member_id())))
  )
  with check (
    (select public.is_staff())
    or ((select public.current_member_active())
        and exists (select 1 from public.routines r where r.id = routine_exercises.routine_id and r.member_id = (select public.current_member_id())))
  );

-- Ejercicios propios: crear/editar solo con membresía activa (leer no cambia).
drop policy if exists exercises_modify on public.exercises;
create policy exercises_modify on public.exercises
  for all to authenticated
  using ((select public.is_staff()) or (member_id = (select public.current_member_id()) and (select public.current_member_active())))
  with check ((select public.is_staff()) or (member_id = (select public.current_member_id()) and (select public.current_member_active())));

-- Medidas: registrar o corregir solo con membresía activa; borrar las propias sí.
drop policy if exists progress_self_insert on public.member_progress;
create policy progress_self_insert on public.member_progress
  for insert to authenticated
  with check (
    member_id = (select public.current_member_id())
    and created_by = (select auth.uid())
    and (select public.current_member_active())
  );
drop policy if exists progress_self_update on public.member_progress;
create policy progress_self_update on public.member_progress
  for update to authenticated
  using (member_id = (select public.current_member_id()) and created_by = (select auth.uid()) and (select public.current_member_active()))
  with check (member_id = (select public.current_member_id()) and created_by = (select auth.uid()) and (select public.current_member_active()));

-- ── 2. Resultado del WOD del día ─────────────────────────────────────────────
create table public.wod_results (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  workout_date date not null,
  score_type text not null check (score_type in ('time', 'rounds', 'load', 'reps')),
  time_seconds integer check (time_seconds > 0 and time_seconds < 6 * 3600),
  -- For Time sin terminar dentro del tope (time cap).
  capped boolean not null default false,
  rounds integer check (rounds >= 0 and rounds < 1000),
  reps integer check (reps >= 0 and reps < 100000),
  load_kg numeric(6, 2) check (load_kg > 0 and load_kg < 1000),
  rx boolean not null default true,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, workout_date),
  -- Cada formato exige su número.
  constraint wod_results_score_ok check (
    (score_type = 'time' and (time_seconds is not null or capped))
    or (score_type = 'rounds' and rounds is not null)
    or (score_type = 'load' and load_kg is not null)
    or (score_type = 'reps' and reps is not null)
  )
);

create index wod_results_date_idx on public.wod_results (workout_date);

create trigger trg_wod_results_updated_at
  before update on public.wod_results
  for each row execute function public.set_updated_at();

alter table public.wod_results enable row level security;

create policy wod_results_read on public.wod_results
  for select to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));

-- Registrar/corregir: socio activo, de hoy hacia atrás (hasta 7 días).
create policy wod_results_insert on public.wod_results
  for insert to authenticated
  with check (
    (select public.is_staff())
    or (member_id = (select public.current_member_id())
        and (select public.current_member_active())
        and workout_date <= public.today_ec()
        and workout_date >= public.today_ec() - 7)
  );
create policy wod_results_update on public.wod_results
  for update to authenticated
  using ((select public.is_staff()) or (member_id = (select public.current_member_id()) and (select public.current_member_active())))
  with check (
    (select public.is_staff())
    or (member_id = (select public.current_member_id())
        and (select public.current_member_active())
        and workout_date <= public.today_ec()
        and workout_date >= public.today_ec() - 7)
  );
create policy wod_results_delete on public.wod_results
  for delete to authenticated
  using ((select public.is_staff()) or member_id = (select public.current_member_id()));

-- ── 3. Récords de levantamientos (1RM) ───────────────────────────────────────
create table public.lift_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  lift text not null check (lift in (
    'back_squat', 'front_squat', 'deadlift', 'bench_press', 'strict_press', 'push_press',
    'push_jerk', 'clean', 'power_clean', 'clean_and_jerk', 'snatch', 'power_snatch', 'thruster'
  )),
  weight_kg numeric(6, 2) not null check (weight_kg > 0 and weight_kg < 1000),
  recorded_on date not null default public.today_ec(),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);

create index lift_records_member_lift_idx on public.lift_records (member_id, lift, recorded_on desc);

alter table public.lift_records enable row level security;

create policy lift_records_read on public.lift_records
  for select to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
create policy lift_records_insert on public.lift_records
  for insert to authenticated
  with check (
    (select public.is_staff())
    or (member_id = (select public.current_member_id())
        and (select public.current_member_active())
        and recorded_on <= public.today_ec())
  );
create policy lift_records_delete on public.lift_records
  for delete to authenticated
  using ((select public.is_staff()) or member_id = (select public.current_member_id()));

-- ── 4. Pizarra del día ───────────────────────────────────────────────────────
alter table public.members add column if not exists hide_from_board boolean not null default false;

-- El socio decide si aparece en la pizarra (update_my_profile no toca esto).
create or replace function public.set_board_visibility(p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_member uuid := public.current_member_id();
begin
  if v_member is null then raise exception 'Perfil de miembro no encontrado'; end if;
  update public.members set hide_from_board = coalesce(p_hidden, false) where id = v_member;
end;
$$;

-- Resultados del día de todos los socios que se dejan ver. Solo nombre +
-- inicial del apellido; nunca otros datos de la ficha.
create or replace function public.wod_board(p_date date)
returns table (
  display_name text,
  is_me boolean,
  score_type text,
  time_seconds integer,
  capped boolean,
  rounds integer,
  reps integer,
  load_kg numeric,
  rx boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_member uuid := public.current_member_id();
begin
  if not (public.current_member_active() or public.is_staff()) then
    raise exception 'Necesitas una membresía activa para ver la pizarra.';
  end if;
  return query
    select
      -- "Carlos Rodríguez Pérez" → "Carlos R." (tolera espacios repetidos).
      trim(w.parts[1] || coalesce(' ' || upper(left(w.parts[2], 1)) || '.', '')) as display_name,
      (m.id = v_member) as is_me,
      r.score_type, r.time_seconds, r.capped, r.rounds, r.reps, r.load_kg, r.rx
    from public.wod_results r
    join public.members m on m.id = r.member_id
    cross join lateral (select regexp_split_to_array(trim(m.full_name), '\s+') as parts) w
    where r.workout_date = p_date
      and m.deleted_at is null
      and (not m.hide_from_board or m.id = v_member);
end;
$$;

revoke execute on function public.set_board_visibility(boolean) from public, anon;
revoke execute on function public.wod_board(date) from public, anon;
grant execute on function public.set_board_visibility(boolean) to authenticated;
grant execute on function public.wod_board(date) to authenticated;
