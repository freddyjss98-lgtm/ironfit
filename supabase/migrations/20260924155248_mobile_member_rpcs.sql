-- =============================================================================
-- Iron Fit Club — App móvil (F1): reglas del socio en la base de datos
-- =============================================================================
-- Hasta hoy las reglas "hace falta membresía activa" y "no pasarse del cupo"
-- vivían solo en las server actions del portal. Las políticas dejaban que un
-- socio insertara directo en class_bookings / attendances (y editara cualquier
-- campo de su reserva) con su sesión, sin pasar por esas reglas. La app móvil
-- habla con Supabase directamente, así que las reglas bajan a la base.
--
-- Migración ADITIVA (solo crea funciones). Quitar los insert/update directos
-- va en ..._mobile_lockdown.sql, después de desplegar el código que ya usa
-- estas RPC.
--
-- Esquema verificado contra producción el 2026-09-24 (el repo tenía drift):
-- class_bookings tiene start_time/end_time y es única por
-- (schedule_id, member_id, booking_date, start_time); get_class_booking_counts
-- cuenta todo lo no cancelado por horario.
-- =============================================================================

-- Socio de la sesión (ficha no borrada). NULL si el usuario no es socio.
create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.members
  where user_id = (select auth.uid()) and deleted_at is null
$$;

-- ── Reservar clase ───────────────────────────────────────────────────────────
create or replace function public.book_class(
  p_schedule_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := public.current_member_id();
  v_capacity int;
  v_existing_id uuid;
  v_existing_status text;
  v_booked int;
  v_id uuid;
begin
  if v_member is null then
    raise exception 'Perfil de miembro no encontrado';
  end if;

  if p_booking_date < public.today_ec() then
    raise exception 'No puedes reservar una fecha que ya pasó';
  end if;

  if not exists (
    select 1 from public.memberships
    where member_id = v_member and status = 'active' and end_date >= public.today_ec()
  ) then
    raise exception 'Necesitas una membresía activa para reservar clases. Renueva tu membresía.';
  end if;

  select max_capacity into v_capacity
  from public.class_schedules
  where id = p_schedule_id and active;
  if v_capacity is null then
    raise exception 'Esa clase no está disponible';
  end if;

  -- Serializa las reservas del mismo horario: sin esto, dos socios podían
  -- tomar el último cupo a la vez.
  perform pg_advisory_xact_lock(
    hashtextextended(p_schedule_id::text || '|' || p_booking_date::text || '|' || coalesce(p_start_time::text, ''), 0)
  );

  select id, status into v_existing_id, v_existing_status
  from public.class_bookings
  where schedule_id = p_schedule_id
    and member_id = v_member
    and booking_date = p_booking_date
    and start_time is not distinct from p_start_time;

  if v_existing_id is not null and v_existing_status <> 'cancelled' then
    raise exception 'Ya tienes una reserva para ese horario';
  end if;

  -- Mismo criterio que get_class_booking_counts: todo lo no cancelado ocupa cupo.
  select count(*) into v_booked
  from public.class_bookings
  where schedule_id = p_schedule_id
    and booking_date = p_booking_date
    and start_time is not distinct from p_start_time
    and status <> 'cancelled';

  if v_booked >= v_capacity then
    raise exception 'Ese horario ya no tiene cupos disponibles';
  end if;

  if v_existing_id is not null then
    -- Reservó, canceló y vuelve: se reactiva la misma fila (la clave única
    -- impedía insertar otra y el portal respondía "ya tienes una reserva").
    update public.class_bookings
    set status = 'confirmed', end_time = p_end_time
    where id = v_existing_id
    returning id into v_id;
  else
    insert into public.class_bookings
      (schedule_id, member_id, booking_date, start_time, end_time, created_by)
    values
      (p_schedule_id, v_member, p_booking_date, p_start_time, p_end_time, (select auth.uid()))
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- ── Cancelar mi reserva ──────────────────────────────────────────────────────
create or replace function public.cancel_my_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := public.current_member_id();
begin
  if v_member is null then
    raise exception 'Perfil de miembro no encontrado';
  end if;

  update public.class_bookings
  set status = 'cancelled'
  where id = p_booking_id and member_id = v_member and status = 'confirmed';

  if not found then
    raise exception 'No encontramos esa reserva o ya no se puede cancelar';
  end if;
end;
$$;

-- ── Registrar mi asistencia de hoy ───────────────────────────────────────────
create or replace function public.member_check_in()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := public.current_member_id();
  v_membership uuid;
  v_id uuid;
begin
  if v_member is null then
    raise exception 'Perfil de miembro no encontrado';
  end if;

  select id into v_membership
  from public.memberships
  where member_id = v_member and status = 'active' and end_date >= public.today_ec()
  order by end_date desc
  limit 1;

  if v_membership is null then
    raise exception 'Necesitas una membresía activa para registrar tu asistencia.';
  end if;

  insert into public.attendances (member_id, membership_id, checked_in_by)
  values (v_member, v_membership, (select auth.uid()))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya registraste tu asistencia hoy';
end;
$$;

-- Solo usuarios con sesión.
revoke execute on function public.current_member_id() from public, anon;
revoke execute on function public.book_class(uuid, date, time, time) from public, anon;
revoke execute on function public.cancel_my_booking(uuid) from public, anon;
revoke execute on function public.member_check_in() from public, anon;
grant execute on function public.current_member_id() to authenticated;
grant execute on function public.book_class(uuid, date, time, time) to authenticated;
grant execute on function public.cancel_my_booking(uuid) to authenticated;
grant execute on function public.member_check_in() to authenticated;
