-- =============================================================================
-- Iron Fit Club — Actividades grabadas con el GPS de la app
-- =============================================================================
-- La app graba el recorrido y lo guarda simplificado como polyline (formato
-- de Google, precisión 5). Se dibuja en la app, en la comunidad y en la
-- tarjeta para Instagram. log_activity recibe el origen ('manual' | 'gps') y
-- la ruta; community_feed devuelve la ruta. Las dos cambian de firma, así que
-- se borran y se crean de nuevo (sin datos de por medio).
-- =============================================================================

alter table public.activities
  add column if not exists route_polyline text check (char_length(route_polyline) <= 60000);

drop function if exists public.log_activity(text, timestamptz, integer, integer, integer, integer, boolean, text, text, boolean, text);

create function public.log_activity(
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
  p_photo_path text default null,
  p_source text default 'manual',
  p_route_polyline text default null
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
  -- 'health' lo usará la importación desde Health Connect / Apple Health.
  if coalesce(p_source, 'manual') not in ('manual', 'gps') then raise exception 'Origen no válido.'; end if;

  insert into public.activities (
    member_id, sport, title, started_at, duration_seconds, distance_m, elevation_m,
    calories, calories_estimated, notes, source, route_polyline
  ) values (
    v_member, p_sport, nullif(trim(coalesce(p_title, '')), ''), p_started_at, p_duration_seconds,
    p_distance_m, p_elevation_m, p_calories, coalesce(p_calories_estimated, false), v_notes,
    coalesce(p_source, 'manual'), nullif(p_route_polyline, '')
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

drop function if exists public.community_feed(timestamptz, integer);

create function public.community_feed(p_before timestamptz default null, p_limit integer default 20)
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
  route_polyline text,
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
      a.sport, a.duration_seconds, a.distance_m, a.elevation_m, a.calories, a.route_polyline,
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

revoke execute on function public.log_activity(text, timestamptz, integer, integer, integer, integer, boolean, text, text, boolean, text, text, text) from public, anon;
revoke execute on function public.community_feed(timestamptz, integer) from public, anon;
grant execute on function public.log_activity(text, timestamptz, integer, integer, integer, integer, boolean, text, text, boolean, text, text, text) to authenticated;
grant execute on function public.community_feed(timestamptz, integer) to authenticated;
