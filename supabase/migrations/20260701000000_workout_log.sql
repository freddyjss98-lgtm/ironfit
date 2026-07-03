-- =============================================================================
-- Iron Fit Club — Historial de Entrenamiento (log de fuerza) · Bloque 1
-- =============================================================================
-- Reemplaza el Excel "Historial de progreso": cada socio (o su coach) registra
-- sesiones de entrenamiento con series (peso × reps). El volumen y el % de
-- progreso se calculan en la app. Composición corporal sigue en member_progress.
--
--   • exercises          — catálogo por grupo muscular (38 globales + propios)
--   • workout_sessions   — una sesión de un socio en una fecha
--   • workout_sets       — una serie (peso + reps) de un ejercicio en la sesión
--
-- RLS: el socio ve/edita lo suyo; el staff (admin/coach, con fila en profiles)
-- ve y registra por cualquier socio. Ningún socio ve datos de otro socio.
-- =============================================================================

-- ── Catálogo de ejercicios ──────────────────────────────────────────────────
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null check (muscle_group in
    ('pectoral','triceps','pierna','pantorrilla','espalda','biceps','hombro','otros')),
  is_global boolean not null default false,          -- true = catálogo compartido
  member_id uuid references public.members(id) on delete cascade,  -- set = ejercicio propio
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists exercises_muscle_idx on public.exercises(muscle_group);
create index if not exists exercises_member_idx on public.exercises(member_id);
create unique index if not exists exercises_global_unique
  on public.exercises(muscle_group, lower(name)) where is_global;

alter table public.exercises enable row level security;

drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises
  for select to authenticated using (
    is_global
    or exists (select 1 from public.members m where m.id = exercises.member_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  );

drop policy if exists exercises_modify on public.exercises;
create policy exercises_modify on public.exercises
  for all to authenticated
  using (
    exists (select 1 from public.members m where m.id = exercises.member_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  )
  with check (
    exists (select 1 from public.members m where m.id = exercises.member_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  );

-- ── Sesiones de entrenamiento ───────────────────────────────────────────────
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  session_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_sessions_member_idx
  on public.workout_sessions(member_id, session_date desc);

drop trigger if exists trg_workout_sessions_updated_at on public.workout_sessions;
create trigger trg_workout_sessions_updated_at
  before update on public.workout_sessions
  for each row execute function public.set_updated_at();

alter table public.workout_sessions enable row level security;

drop policy if exists workout_sessions_all on public.workout_sessions;
create policy workout_sessions_all on public.workout_sessions
  for all to authenticated
  using (
    exists (select 1 from public.members m where m.id = workout_sessions.member_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  )
  with check (
    exists (select 1 from public.members m where m.id = workout_sessions.member_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  );

-- ── Series (una fila por serie: peso + reps) ────────────────────────────────
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number integer not null check (set_number > 0),
  weight_kg numeric(7,2) not null check (weight_kg >= 0),
  reps integer not null check (reps >= 0),
  rpe numeric(3,1) check (rpe >= 0 and rpe <= 10),
  created_at timestamptz not null default now()
);
create index if not exists workout_sets_session_idx on public.workout_sets(session_id);
create index if not exists workout_sets_exercise_idx on public.workout_sets(exercise_id);

alter table public.workout_sets enable row level security;

drop policy if exists workout_sets_all on public.workout_sets;
create policy workout_sets_all on public.workout_sets
  for all to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      join public.members m on m.id = s.member_id
      where s.id = workout_sets.session_id and m.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  )
  with check (
    exists (
      select 1 from public.workout_sessions s
      join public.members m on m.id = s.member_id
      where s.id = workout_sets.session_id and m.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  );

-- ── Seed: 38 ejercicios base (del Excel del dueño), idempotente ──────────────
insert into public.exercises (name, muscle_group, is_global)
select v.name, v.mg, true
from (values
  ('Press Plano','pectoral'),
  ('Press Inclinado con mancuerna','pectoral'),
  ('Cruce de poleas alto','pectoral'),
  ('Fondos','pectoral'),
  ('Peck Deck','pectoral'),
  ('Press Plano con mancuerna','pectoral'),
  ('Press Inclinado con barra','pectoral'),
  ('Press Francés','triceps'),
  ('Extensión polea alta agarre supino','triceps'),
  ('Extensión polea alta agarre prono','triceps'),
  ('Fondos en banco','triceps'),
  ('Extensión con soga','triceps'),
  ('Sentadilla Hack','pierna'),
  ('Peso Muerto','pierna'),
  ('Prensa','pierna'),
  ('Extensión de rodillas','pierna'),
  ('Curl Femoral','pierna'),
  ('Zancada','pierna'),
  ('Elevación de cadera con barra (Hip Thrust)','pierna'),
  ('Sentadilla Smith','pierna'),
  ('Flexión y extensión de rodillas','pantorrilla'),
  ('Dominadas en barra','espalda'),
  ('Jalón al pecho','espalda'),
  ('Remo con polea baja','espalda'),
  ('Remo con barra T','espalda'),
  ('Remo con mancuerna','espalda'),
  ('Pull over con polea','espalda'),
  ('Remo en máquina','espalda'),
  ('Curl con barra en banco (predicador)','biceps'),
  ('Curl con mancuerna','biceps'),
  ('Curl Martillo','biceps'),
  ('Curl con polea baja','biceps'),
  ('Press frontal con barra','hombro'),
  ('Press Arnold','hombro'),
  ('Elevaciones laterales mancuerna','hombro'),
  ('Elevaciones laterales polea','hombro'),
  ('Elevaciones posteriores con disco','hombro'),
  ('Posterior con máquina','hombro')
) as v(name, mg)
where not exists (
  select 1 from public.exercises e
  where e.is_global and e.muscle_group = v.mg and lower(e.name) = lower(v.name)
);
