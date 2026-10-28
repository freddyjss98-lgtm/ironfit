-- =============================================================================
-- Iron Fit Club — Deportes, retos y comunidad (app móvil)
-- =============================================================================
-- 1) activities: lo que el socio entrena fuera del box (correr, bici, nadar,
--    montaña…). Hoy se registra a mano; `source` y `external_id` dejan listo
--    el GPS de la app y la importación desde Health Connect / Apple Health.
-- 2) challenges + challenge_entries: retos que publica el gimnasio ("corre 5K
--    este fin de semana") y quién los cumplió. Una actividad que cumple la
--    meta marca el reto sola.
-- 3) community_posts: la comunidad. Solo publicaciones de retos cumplidos y
--    actividades (nada de texto libre), con 🔥 y moderación: reportar,
--    bloquear y que el staff oculte. Es lo que pide Apple (guía 1.2) para
--    contenido de usuarios; el socio acepta las reglas antes de entrar.
--
-- Todo es exclusivo de socios activos (opción A): sin membresía activa el
-- socio ve su historial de actividades, pero no registra, ni ve retos, ni la
-- comunidad. Las escrituras con reglas pasan por RPC; las tablas solo dejan
-- leer lo propio.
-- =============================================================================

-- "Carlos Rodríguez Pérez" → "Carlos R." (el mismo criterio de la pizarra).
create or replace function public.member_display_name(p_full_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(w.parts[1] || coalesce(' ' || upper(left(w.parts[2], 1)) || '.', ''))
  from (select regexp_split_to_array(trim(coalesce(p_full_name, '')), '\s+') as parts) w
$$;

-- ── 1. Actividades ───────────────────────────────────────────────────────────
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  sport text not null check (sport in ('run', 'walk', 'bike', 'swim', 'hike', 'other')),
  title text check (char_length(title) <= 80),
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 48 * 3600),
  distance_m integer check (distance_m >= 0 and distance_m <= 1000000),
  elevation_m integer check (elevation_m >= 0 and elevation_m <= 10000),
  calories integer check (calories >= 0 and calories <= 20000),
  -- true si las calorías las calculó la app (MET × peso) y no el socio/reloj.
  calories_estimated boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'gps', 'health')),
  -- Id del registro en Health Connect / HealthKit: evita importarlo dos veces.
  external_id text check (char_length(external_id) <= 200),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (member_id, external_id)
);

create index activities_member_started_idx on public.activities (member_id, started_at desc);

alter table public.activities enable row level security;

create policy activities_read on public.activities
  for select to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
create policy activities_update on public.activities
  for update to authenticated
  using (member_id = (select public.current_member_id()) and (select public.current_member_active()))
  with check (
    member_id = (select public.current_member_id())
    and (select public.current_member_active())
    and started_at <= now() + interval '1 hour'
  );
create policy activities_delete on public.activities
  for delete to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
-- Crear: con log_activity() (marca retos y publica en la comunidad).

-- ── 2. Retos ─────────────────────────────────────────────────────────────────
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 600),
  sport text not null default 'any' check (sport in ('any', 'run', 'walk', 'bike', 'swim', 'hike', 'other')),
  goal_type text not null check (goal_type in ('distance', 'time', 'free')),
  goal_distance_m integer check (goal_distance_m > 0 and goal_distance_m <= 1000000),
  goal_seconds integer check (goal_seconds > 0 and goal_seconds <= 48 * 3600),
  starts_on date not null,
  ends_on date not null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint challenges_dates_ok check (ends_on >= starts_on),
  constraint challenges_goal_ok check (
    (goal_type = 'distance' and goal_distance_m is not null)
    or (goal_type = 'time' and goal_seconds is not null)
    or goal_type = 'free'
  )
);

create index challenges_ends_idx on public.challenges (ends_on desc);

alter table public.challenges enable row level security;

create policy challenges_read on public.challenges
  for select to authenticated
  using ((select public.current_member_active()) or (select public.is_staff()));
create policy challenges_staff_write on public.challenges
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create table public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  note text check (char_length(note) <= 300),
  completed_at timestamptz not null default now(),
  unique (challenge_id, member_id)
);

create index challenge_entries_member_idx on public.challenge_entries (member_id);

alter table public.challenge_entries enable row level security;

create policy challenge_entries_read on public.challenge_entries
  for select to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
-- Deshacer "reto cumplido" (borra también su publicación).
create policy challenge_entries_delete on public.challenge_entries
  for delete to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
-- Crear: con complete_challenge() o log_activity().

-- ── 3. Comunidad ─────────────────────────────────────────────────────────────
alter table public.members add column if not exists community_terms_at timestamptz;

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  challenge_entry_id uuid unique references public.challenge_entries(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  -- Ruta en el bucket privado `community`: '<auth.uid()>/<archivo>.jpg'.
  photo_path text check (char_length(photo_path) <= 300),
  caption text check (char_length(caption) <= 300),
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index community_posts_created_idx on public.community_posts (created_at desc);
create index community_posts_member_idx on public.community_posts (member_id);

alter table public.community_posts enable row level security;

-- La comunidad se lee con community_feed() (solo nombre corto, nunca la ficha).
create policy community_posts_read on public.community_posts
  for select to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
create policy community_posts_delete on public.community_posts
  for delete to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
-- Ocultar / volver a mostrar: solo staff.
create policy community_posts_staff_update on public.community_posts
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create table public.post_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);

create index post_reactions_member_idx on public.post_reactions (member_id);

alter table public.post_reactions enable row level security;

create policy post_reactions_read on public.post_reactions
  for select to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_staff()));
create policy post_reactions_insert on public.post_reactions
  for insert to authenticated
  with check (member_id = (select public.current_member_id()) and (select public.current_member_active()));
create policy post_reactions_delete on public.post_reactions
  for delete to authenticated
  using (member_id = (select public.current_member_id()));

create table public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  unique (post_id, member_id)
);

create index post_reports_pending_idx on public.post_reports (created_at) where resolved_at is null;
create index post_reports_member_idx on public.post_reports (member_id);

alter table public.post_reports enable row level security;

-- Los reportes solo los ve y resuelve el staff; el socio reporta con report_post().
create policy post_reports_staff on public.post_reports
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create table public.member_blocks (
  member_id uuid not null references public.members(id) on delete cascade,
  blocked_member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, blocked_member_id),
  constraint member_blocks_not_self check (member_id <> blocked_member_id)
);

create index member_blocks_blocked_idx on public.member_blocks (blocked_member_id);

alter table public.member_blocks enable row level security;

create policy member_blocks_own on public.member_blocks
  for select to authenticated
  using (member_id = (select public.current_member_id()));
create policy member_blocks_delete on public.member_blocks
  for delete to authenticated
  using (member_id = (select public.current_member_id()));
-- Bloquear: con block_post_author() (la app nunca ve ids de otros socios).

-- ── 4. Fotos de la comunidad (bucket privado, URLs firmadas) ────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy community_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.current_member_active())
  );
create policy community_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'community' and ((select public.current_member_active()) or (select public.is_staff())));
create policy community_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff()))
  );

-- ── 5. RPC ───────────────────────────────────────────────────────────────────

-- La foto tiene que estar en la carpeta del propio usuario.
create or replace function public._community_photo_ok(p_path text)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_path is null or p_path like (select auth.uid())::text || '/%'
$$;

create or replace function public._require_active_member()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_member uuid := public.current_member_id();
begin
  if v_member is null then raise exception 'Perfil de miembro no encontrado'; end if;
  if not public.member_is_active(v_member) then
    raise exception 'Necesitas una membresía activa para usar esta función.';
  end if;
  return v_member;
end;
$$;

-- ¿La actividad cumple la meta del reto? (deporte, fechas y meta)
create or replace function public._activity_meets(c public.challenges, a public.activities)
returns boolean
language sql
stable
set search_path = public
as $$
  select (c.sport = 'any' or c.sport = a.sport)
    and (a.started_at at time zone 'America/Guayaquil')::date between c.starts_on and c.ends_on
    and case c.goal_type
      when 'distance' then coalesce(a.distance_m, 0) >= c.goal_distance_m
      when 'time' then a.duration_seconds >= c.goal_seconds
      else true
    end
$$;

-- Retos vigentes, próximos y los que terminaron hace una semana o menos.
create or replace function public.challenge_list()
returns table (
  id uuid,
  title text,
  description text,
  sport text,
  goal_type text,
  goal_distance_m integer,
  goal_seconds integer,
  starts_on date,
  ends_on date,
  completed_count integer,
  my_entry_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_member uuid := public.current_member_id();
begin
  if not (public.current_member_active() or public.is_staff()) then
    raise exception 'Necesitas una membresía activa para ver los retos.';
  end if;
  return query
    select c.id, c.title, c.description, c.sport, c.goal_type, c.goal_distance_m, c.goal_seconds,
      c.starts_on, c.ends_on,
      (select count(*)::integer from public.challenge_entries e where e.challenge_id = c.id),
      (select e.id from public.challenge_entries e where e.challenge_id = c.id and e.member_id = v_member)
    from public.challenges c
    where c.ends_on >= public.today_ec() - 7
    order by (c.ends_on < public.today_ec()), c.starts_on, c.created_at;
end;
$$;

-- "Reto cumplido". Se acepta hasta el día siguiente al cierre (el que sube la
-- montaña el domingo lo marca el lunes). La foto solo va si se comparte.
create or replace function public.complete_challenge(
  p_challenge uuid,
  p_activity uuid default null,
  p_note text default null,
  p_share boolean default true,
  p_photo_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := public._require_active_member();
  c public.challenges;
  v_entry uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into c from public.challenges where id = p_challenge;
  if c.id is null then raise exception 'Ese reto ya no existe.'; end if;
  if public.today_ec() < c.starts_on then raise exception 'Este reto todavía no empieza.'; end if;
  if public.today_ec() > c.ends_on + 1 then raise exception 'Este reto ya cerró.'; end if;
  if p_activity is not null
     and not exists (select 1 from public.activities where id = p_activity and member_id = v_member) then
    raise exception 'Esa actividad no es tuya.';
  end if;
  if not public._community_photo_ok(p_photo_path) then raise exception 'Foto no válida.'; end if;
  if exists (select 1 from public.challenge_entries where challenge_id = p_challenge and member_id = v_member) then
    raise exception 'Ya marcaste este reto como cumplido.';
  end if;

  insert into public.challenge_entries (challenge_id, member_id, activity_id, note)
  values (p_challenge, v_member, p_activity, v_note)
  returning id into v_entry;

  if coalesce(p_share, true) then
    insert into public.community_posts (member_id, challenge_entry_id, activity_id, photo_path, caption)
    values (v_member, v_entry, p_activity, p_photo_path, v_note);
  end if;
  return v_entry;
end;
$$;

-- Registra una actividad, marca los retos que cumple y (si se pide) la
-- publica. Si cumplió un reto, la publicación es la del reto: una sola.
create or replace function public.log_activity(
  p_sport text,
  p_started_at timestamptz,
  p_duration_seconds integer,
  p_distance_m integer default null,
  p_elevation_m integer default null,
  p_calories integer default null,
  p_calories_estimated boolean default false,
  p_title text default null,
  p_notes text default null,
  p_share boolean default false,
  p_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := public._require_active_member();
  a public.activities;
  c public.challenges;
  v_entry uuid;
  v_first_entry uuid;
  v_done text[] := '{}';
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if p_started_at > now() + interval '1 hour' then raise exception 'La fecha no puede ser futura.'; end if;
  if not public._community_photo_ok(p_photo_path) then raise exception 'Foto no válida.'; end if;

  insert into public.activities (
    member_id, sport, title, started_at, duration_seconds, distance_m, elevation_m,
    calories, calories_estimated, notes
  ) values (
    v_member, p_sport, nullif(trim(coalesce(p_title, '')), ''), p_started_at, p_duration_seconds,
    p_distance_m, p_elevation_m, p_calories, coalesce(p_calories_estimated, false), v_notes
  )
  returning * into a;

  for c in
    select ch.* from public.challenges ch
    where public.today_ec() between ch.starts_on and ch.ends_on + 1
      and not exists (select 1 from public.challenge_entries e where e.challenge_id = ch.id and e.member_id = v_member)
    order by ch.starts_on
  loop
    if public._activity_meets(c, a) then
      insert into public.challenge_entries (challenge_id, member_id, activity_id)
      values (c.id, v_member, a.id)
      returning id into v_entry;
      v_first_entry := coalesce(v_first_entry, v_entry);
      v_done := v_done || c.title;
    end if;
  end loop;

  if coalesce(p_share, false) then
    insert into public.community_posts (member_id, challenge_entry_id, activity_id, photo_path, caption)
    values (v_member, v_first_entry, a.id, p_photo_path, v_notes);
  end if;

  return jsonb_build_object('activity_id', a.id, 'completed', to_jsonb(v_done));
end;
$$;

create or replace function public.accept_community_terms()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_member uuid := public.current_member_id();
begin
  if v_member is null then raise exception 'Perfil de miembro no encontrado'; end if;
  update public.members set community_terms_at = coalesce(community_terms_at, now()) where id = v_member;
end;
$$;

-- Publicaciones visibles para el socio: sin ocultas, sin socios eliminados,
-- sin autores que bloqueó y sin las que reportó. Paginado por fecha.
create or replace function public.community_feed(p_before timestamptz default null, p_limit integer default 20)
returns table (
  id uuid,
  created_at timestamptz,
  is_mine boolean,
  display_name text,
  avatar_url text,
  caption text,
  photo_path text,
  challenge_title text,
  sport text,
  duration_seconds integer,
  distance_m integer,
  elevation_m integer,
  calories integer,
  fire_count integer,
  fired boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_member uuid := public.current_member_id();
begin
  if not (public.current_member_active() or public.is_staff()) then
    raise exception 'Necesitas una membresía activa para ver la comunidad.';
  end if;
  return query
    select p.id, p.created_at, (p.member_id = v_member),
      public.member_display_name(m.full_name), m.photo_url,
      p.caption, p.photo_path, ch.title,
      a.sport, a.duration_seconds, a.distance_m, a.elevation_m, a.calories,
      (select count(*)::integer from public.post_reactions r where r.post_id = p.id),
      exists (select 1 from public.post_reactions r where r.post_id = p.id and r.member_id = v_member)
    from public.community_posts p
    join public.members m on m.id = p.member_id
    left join public.challenge_entries e on e.id = p.challenge_entry_id
    left join public.challenges ch on ch.id = e.challenge_id
    left join public.activities a on a.id = p.activity_id
    where p.hidden_at is null
      and m.deleted_at is null
      and (p_before is null or p.created_at < p_before)
      and not exists (select 1 from public.member_blocks b where b.member_id = v_member and b.blocked_member_id = p.member_id)
      and not exists (select 1 from public.post_reports rp where rp.post_id = p.id and rp.member_id = v_member)
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- Reportar: la publicación desaparece para quien reporta y queda pendiente
-- para el staff (que debe revisarla en menos de 24 h).
create or replace function public.report_post(p_post uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_member uuid := public._require_active_member();
begin
  if not exists (select 1 from public.community_posts where id = p_post) then
    raise exception 'Esa publicación ya no existe.';
  end if;
  insert into public.post_reports (post_id, member_id, reason)
  values (p_post, v_member, nullif(trim(coalesce(p_reason, '')), ''))
  on conflict (post_id, member_id) do nothing;
end;
$$;

create or replace function public.block_post_author(p_post uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := public.current_member_id();
  v_author uuid;
begin
  if v_member is null then raise exception 'Perfil de miembro no encontrado'; end if;
  select member_id into v_author from public.community_posts where id = p_post;
  if v_author is null then raise exception 'Esa publicación ya no existe.'; end if;
  if v_author = v_member then raise exception 'No puedes bloquearte a ti mismo.'; end if;
  insert into public.member_blocks (member_id, blocked_member_id)
  values (v_member, v_author)
  on conflict do nothing;
end;
$$;

revoke execute on function public._require_active_member() from public, anon, authenticated;
revoke execute on function public._community_photo_ok(text) from public, anon;
revoke execute on function public._activity_meets(public.challenges, public.activities) from public, anon;
revoke execute on function public.challenge_list() from public, anon;
revoke execute on function public.complete_challenge(uuid, uuid, text, boolean, text) from public, anon;
revoke execute on function public.log_activity(text, timestamptz, integer, integer, integer, integer, boolean, text, text, boolean, text) from public, anon;
revoke execute on function public.accept_community_terms() from public, anon;
revoke execute on function public.community_feed(timestamptz, integer) from public, anon;
revoke execute on function public.report_post(uuid, text) from public, anon;
revoke execute on function public.block_post_author(uuid) from public, anon;
grant execute on function public.challenge_list() to authenticated;
grant execute on function public.complete_challenge(uuid, uuid, text, boolean, text) to authenticated;
grant execute on function public.log_activity(text, timestamptz, integer, integer, integer, integer, boolean, text, text, boolean, text) to authenticated;
grant execute on function public.accept_community_terms() to authenticated;
grant execute on function public.community_feed(timestamptz, integer) to authenticated;
grant execute on function public.report_post(uuid, text) to authenticated;
grant execute on function public.block_post_author(uuid) to authenticated;
