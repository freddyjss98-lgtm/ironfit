-- =============================================================================
-- Iron Fit Club — Cierres por feriado
-- =============================================================================
-- El dueño marca los días que el gimnasio NO abre (un feriado que decide
-- cerrar). Por cada día cerrado, cada socio con membresía activa ese día
-- recupera 1 día: su vencimiento se corre +1. No se congela nada.
--
-- Reglas:
--  * Los domingos nunca cuentan: el gym no abre los domingos (check en la tabla).
--  * Un día por socio y por cierre, aunque tenga dos membresías que se tocan ese
--    día (en prod hay renovaciones que arrancan el mismo día que vence la
--    anterior). Se extiende la que llega más lejos.
--  * Si el socio ya pagó la siguiente (encadenada), esa también se corre 1 día
--    para que no se pisen.
--  * Se aplica al registrar el cierre (el socio ve su fecha nueva enseguida) y se
--    cierra el mismo día del feriado (cron de las 9:00): suma a quien compró
--    entre medio y le quita a quien quedó congelado ese día (al reanudar ya lo
--    recupera). Después de cerrado no se vuelve a tocar.
--  * Cada día dado queda en gym_closure_credits: historial y deshacer.
--  * Las reservas de clase de un día cerrado se cancelan, y un trigger impide
--    reservar ese día (portal, app y admin).
--
-- Escrituras solo por RPC (security definer). Las tablas no tienen políticas
-- de escritura.
-- =============================================================================

create table public.gym_closures (
  id uuid primary key default gen_random_uuid(),
  closure_date date not null unique,
  reason text not null check (length(btrim(reason)) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- El día ya llegó y se hizo la revisión final (ver _closure_reconcile).
  finalized_at timestamptz,
  constraint gym_closures_not_sunday check (extract(isodow from closure_date) <> 7)
);

create table public.gym_closure_credits (
  -- restrict: borrar un cierre sin devolver sus días dejaría fechas corridas.
  -- Se borra con delete_gym_closure, que primero revierte.
  closure_id uuid not null references public.gym_closures(id) on delete restrict,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  -- extended: se le sumó el día al vencimiento.
  -- shifted:  membresía encadenada que se corrió entera 1 día (inicio y fin).
  kind text not null check (kind in ('extended', 'shifted')),
  created_at timestamptz not null default now(),
  primary key (closure_id, membership_id)
);

create index gym_closure_credits_member_idx on public.gym_closure_credits (member_id);
create index gym_closure_credits_membership_idx on public.gym_closure_credits (membership_id);

alter table public.gym_closures enable row level security;
alter table public.gym_closure_credits enable row level security;

revoke all on table public.gym_closures from anon, authenticated;
revoke all on table public.gym_closure_credits from anon, authenticated;
grant select on table public.gym_closures to authenticated;
grant select on table public.gym_closure_credits to authenticated;

-- El portal y las reservas necesitan saber qué días está cerrado.
create policy gym_closures_read on public.gym_closures
  for select to authenticated
  using (true);

create policy gym_closure_credits_staff_read on public.gym_closure_credits
  for select to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid())));

create policy gym_closure_credits_self_read on public.gym_closure_credits
  for select to authenticated
  using (member_id = (select public.current_member_id()));

-- ── Internas ─────────────────────────────────────────────────────────────────

-- Devuelve lo que un cierre le dio a un socio y borra sus créditos.
create or replace function public._closure_revert_member(p_closure uuid, p_member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memberships m
     set end_date = m.end_date - 1,
         start_date = case when c.kind = 'shifted' then m.start_date - 1 else m.start_date end
    from public.gym_closure_credits c
   where c.closure_id = p_closure
     and c.member_id = p_member
     and c.membership_id = m.id;

  delete from public.gym_closure_credits
   where closure_id = p_closure and member_id = p_member;
end;
$$;

-- Le da el día a un socio: extiende la membresía activa que cubre la fecha y
-- llega más lejos, y corre las encadenadas que quedarían pisadas.
-- Devuelve false si el socio no tiene membresía activa ese día.
create or replace function public._closure_credit_member(p_closure uuid, p_date date, p_member uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_end date;
  r record;
begin
  select id, end_date into v_target, v_end
    from public.memberships
   where member_id = p_member
     and status = 'active'
     and start_date <= p_date
     and end_date >= p_date
   order by end_date desc, start_date desc
   limit 1
   for update;

  if v_target is null then
    return false;
  end if;

  v_end := v_end + 1;
  update public.memberships set end_date = v_end where id = v_target;
  insert into public.gym_closure_credits (closure_id, membership_id, member_id, kind)
  values (p_closure, v_target, p_member, 'extended');

  -- Encadenadas: arrancan después del cierre y antes (o justo al) nuevo fin.
  -- Una con hueco de por medio no se toca.
  for r in
    select id, start_date, end_date
      from public.memberships
     where member_id = p_member
       and status = 'active'
       and id <> v_target
       and start_date > p_date
     order by start_date
     for update
  loop
    exit when r.start_date > v_end;
    update public.memberships
       set start_date = r.start_date + 1, end_date = r.end_date + 1
     where id = r.id;
    insert into public.gym_closure_credits (closure_id, membership_id, member_id, kind)
    values (p_closure, r.id, p_member, 'shifted');
    v_end := greatest(v_end, r.end_date + 1);
  end loop;

  return true;
end;
$$;

-- Deja un cierre al día. Con p_finalize (el día ya llegó) primero quita el día
-- a quien su membresía extendida ya no está activa (congelada: al reanudar
-- recupera ese día; cancelada: por si tiene otra activa) y marca el cierre como
-- finalizado. Devuelve cuántos socios quedan con el día dado.
create or replace function public._closure_reconcile(p_closure uuid, p_finalize boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  r record;
begin
  select closure_date into v_date
    from public.gym_closures
   where id = p_closure
   for update;
  if v_date is null then
    raise exception 'Ese cierre ya no existe';
  end if;

  if p_finalize then
    for r in
      select distinct c.member_id
        from public.gym_closure_credits c
        join public.memberships m on m.id = c.membership_id
       where c.closure_id = p_closure
         and c.kind = 'extended'
         and m.status <> 'active'
    loop
      perform public._closure_revert_member(p_closure, r.member_id);
    end loop;
  end if;

  for r in
    select distinct m.member_id
      from public.memberships m
      join public.members mb on mb.id = m.member_id and mb.deleted_at is null
     where m.status = 'active'
       and m.start_date <= v_date
       and m.end_date >= v_date
       and not exists (
         select 1 from public.gym_closure_credits c
          where c.closure_id = p_closure and c.member_id = m.member_id
       )
  loop
    perform public._closure_credit_member(p_closure, v_date, r.member_id);
  end loop;

  if p_finalize then
    update public.gym_closures set finalized_at = now() where id = p_closure;
  end if;

  return (
    select count(distinct member_id)::int
      from public.gym_closure_credits
     where closure_id = p_closure
  );
end;
$$;

-- ── Públicas ─────────────────────────────────────────────────────────────────

-- Registra uno o varios días cerrados con el mismo motivo. Todo o nada.
-- Devuelve por día: socios compensados y reservas canceladas.
create or replace function public.create_gym_closures(p_dates date[], p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.today_ec();
  v_reason text := nullif(btrim(p_reason), '');
  v_date date;
  v_id uuid;
  v_members int;
  v_bookings int;
  v_result jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo un admin puede registrar cierres';
  end if;
  if v_reason is null then
    raise exception 'Escribe el motivo del cierre';
  end if;
  if p_dates is null or cardinality(p_dates) = 0 then
    raise exception 'Elige al menos un día';
  end if;

  perform pg_advisory_xact_lock(hashtext('gym_closures'));

  for v_date in select distinct d from unnest(p_dates) as d where d is not null order by d loop
    if extract(isodow from v_date) = 7 then
      raise exception 'El % es domingo: el gimnasio no abre los domingos, no se compensa',
        to_char(v_date, 'DD/MM/YYYY');
    end if;
    if v_date < v_today - 30 then
      raise exception 'El % ya pasó hace más de 30 días', to_char(v_date, 'DD/MM/YYYY');
    end if;
    if v_date > v_today + 366 then
      raise exception 'El % está a más de un año', to_char(v_date, 'DD/MM/YYYY');
    end if;
    if exists (select 1 from public.gym_closures where closure_date = v_date) then
      raise exception 'El % ya está registrado como cerrado', to_char(v_date, 'DD/MM/YYYY');
    end if;

    insert into public.gym_closures (closure_date, reason, created_by)
    values (v_date, v_reason, auth.uid())
    returning id into v_id;

    -- Con el gimnasio cerrado no hay clase: se cancelan las reservas del día.
    update public.class_bookings
       set status = 'cancelled',
           notes = concat_ws(' · ', nullif(notes, ''), 'Gimnasio cerrado: ' || v_reason)
     where booking_date = v_date
       and status <> 'cancelled';
    get diagnostics v_bookings = row_count;

    v_members := public._closure_reconcile(v_id, v_date <= v_today);

    v_result := v_result || jsonb_build_object(
      'date', v_date,
      'members', v_members,
      'bookings_cancelled', v_bookings
    );
  end loop;

  return v_result;
end;
$$;

-- Borra un cierre (el gimnasio al final abrió, o se registró mal) y quita el
-- día a quienes se les dio. Las reservas canceladas no se restauran.
-- Devuelve a cuántos socios se les quitó el día.
create or replace function public.delete_gym_closure(p_closure uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members int;
  r record;
begin
  if not public.is_admin() then
    raise exception 'Solo un admin puede borrar cierres';
  end if;

  perform pg_advisory_xact_lock(hashtext('gym_closures'));

  if not exists (select 1 from public.gym_closures where id = p_closure) then
    raise exception 'Ese cierre ya no existe';
  end if;

  select count(distinct member_id)::int into v_members
    from public.gym_closure_credits
   where closure_id = p_closure;

  for r in
    select distinct member_id from public.gym_closure_credits where closure_id = p_closure
  loop
    perform public._closure_revert_member(p_closure, r.member_id);
  end loop;

  delete from public.gym_closures where id = p_closure;

  return v_members;
end;
$$;

-- Revisión final de los cierres cuyo día ya llegó. La llama el cron diario
-- (service_role) y, por si el cron falla, la pantalla de feriados (admin).
-- Devuelve cuántos cierres se finalizaron.
create or replace function public.finalize_due_gym_closures()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  perform pg_advisory_xact_lock(hashtext('gym_closures'));

  for r in
    select id
      from public.gym_closures
     where finalized_at is null
       and closure_date <= public.today_ec()
     order by closure_date
  loop
    perform public._closure_reconcile(r.id, true);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ── Reservas: no se reserva un día cerrado ──────────────────────────────────

create or replace function public.class_bookings_block_closed_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  select reason into v_reason
    from public.gym_closures
   where closure_date = new.booking_date;

  if v_reason is not null then
    raise exception 'El gimnasio estará cerrado ese día (%). No se puede reservar.', v_reason;
  end if;

  return new;
end;
$$;

create trigger trg_class_bookings_closed_day
  before insert or update of status, booking_date on public.class_bookings
  for each row execute function public.class_bookings_block_closed_day();

-- ── Permisos ─────────────────────────────────────────────────────────────────

revoke execute on function public._closure_revert_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._closure_credit_member(uuid, date, uuid) from public, anon, authenticated;
revoke execute on function public._closure_reconcile(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.class_bookings_block_closed_day() from public, anon, authenticated;

revoke execute on function public.create_gym_closures(date[], text) from public, anon;
revoke execute on function public.delete_gym_closure(uuid) from public, anon;
revoke execute on function public.finalize_due_gym_closures() from public, anon;
grant execute on function public.create_gym_closures(date[], text) to authenticated;
grant execute on function public.delete_gym_closure(uuid) to authenticated;
grant execute on function public.finalize_due_gym_closures() to authenticated, service_role;
