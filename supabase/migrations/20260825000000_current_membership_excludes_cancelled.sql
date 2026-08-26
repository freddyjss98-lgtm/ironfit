-- =============================================================================
-- Fix: una membresía cancelada/suspendida no puede ser "la membresía actual"
-- =============================================================================
-- Bug reportado: se creó una membresía por error (11-ago → 10-oct), se canceló,
-- y el socio dejó de recibir los avisos de su membresía real (18-jun → 18-ago).
--
-- Causa: todas las vistas elegían la membresía del socio con
--   order by end_date desc limit 1
-- SIN mirar el status. La cancelada tenía el end_date más lejano, así que
-- "ganaba": el socio figuraba vigente hasta octubre, su days_until_expiry daba
-- +46 (fuera de la ventana de aviso 0..7) y su membresía real quedaba invisible.
-- Encima vw_recently_expired descartaba al socio entero por
-- `latest.status <> 'cancelled'`, cuando lo cancelado era la OTRA membresía.
--
-- Regla acordada: 'cancelled' y 'suspended' NUNCA cuentan como la membresía del
-- socio — son historial y no compiten por ser la actual. Sí cuentan 'active',
-- 'frozen' y 'expired' (este último no lo escribe la app, pero el CHECK lo
-- permite y puede haber filas marcadas a mano: una vencida sigue siendo suya).
--
-- Los avisos automáticos siguen mirando solo 'active': una membresía congelada
-- está en pausa, no vence ni se le reclama renovación (su end_date se extiende
-- al reanudarla). Por eso vw_members_with_active_membership ahora devuelve
-- membership_status = 'frozen' en vez de hacerla pasar por 'active'.
--
-- Dos detalles de Postgres que obligan a hacer drop + create en vez de
-- `create or replace view`:
--   1. vw_members_with_active_membership selecciona `mem.*`. Una vista congela
--      la lista de columnas al crearse, así que si `members` ganó columnas
--      desde 20260519, `create or replace` reventaría con "cannot change name
--      of view column current_membership_id".
--   2. `create or replace view` sin cláusula WITH resetea las reloptions — se
--      perdería el security_invoker que puso 20260703000000_security_hardening.
-- Por eso al final se vuelven a poner security_invoker y los grants a mano.
-- =============================================================================

-- vw_inactive_members ya la eliminó 20260708000000_winback_by_expiry, pero era
-- lo único que dependía de la vista de abajo: se repite por si hubo drift.
drop view if exists public.vw_inactive_members;

-- ── Membresía actual de cada socio ───────────────────────────────────────────
drop view if exists public.vw_members_with_active_membership;
create view public.vw_members_with_active_membership as
select
  mem.*,
  mb.id as current_membership_id,
  mb.plan_id as current_plan_id,
  mp.name as current_plan_name,
  mb.start_date as current_start_date,
  mb.end_date as current_end_date,
  (mb.end_date - current_date) as days_until_expiry,
  case
    when mb.id is null then 'no_membership'
    when mb.status = 'frozen' then 'frozen'
    when mb.end_date < current_date then 'expired'
    else 'active'
  end as membership_status
from public.members mem
left join lateral (
  select *
  from public.memberships m
  where m.member_id = mem.id
    and m.status in ('active', 'frozen', 'expired')  -- nunca cancelled/suspended
  order by m.end_date desc
  limit 1
) mb on true
left join public.membership_plans mp on mp.id = mb.plan_id;

-- ── Venció hace 1-3 días y no renovó ─────────────────────────────────────────
drop view if exists public.vw_recently_expired;
create view public.vw_recently_expired as
select
  m.id           as member_id,
  m.full_name,
  m.phone,
  mp.name        as plan_name,
  latest.end_date,
  (today_ec() - latest.end_date) as days_since_expiry
from public.members m
join lateral (
  select mb.end_date, mb.plan_id, mb.status
  from public.memberships mb
  where mb.member_id = m.id
    and mb.status in ('active', 'frozen', 'expired')
  order by mb.end_date desc
  limit 1
) latest on true
left join public.membership_plans mp on mp.id = latest.plan_id
where m.deleted_at is null
  and m.status = 'active'
  and latest.status <> 'frozen'              -- una congelada está en pausa
  and latest.end_date <  today_ec()
  and latest.end_date >= today_ec() - 3;

-- ── Reenganche: venció hace 15-25 días ───────────────────────────────────────
drop view if exists public.vw_lapsed_members;
create view public.vw_lapsed_members as
select
  m.id            as member_id,
  m.full_name,
  m.phone,
  latest.end_date,
  (today_ec() - latest.end_date) as days_since_expiry
from public.members m
join lateral (
  select mb.end_date, mb.status
  from public.memberships mb
  where mb.member_id = m.id
    and mb.status in ('active', 'frozen', 'expired')
  order by mb.end_date desc
  limit 1
) latest on true
where m.deleted_at is null
  and m.status = 'active'
  and latest.status <> 'frozen'              -- una congelada está en pausa
  and latest.end_date <  today_ec()
  and (today_ec() - latest.end_date) between 15 and 25;

-- ── Restaurar reloptions y grants (el drop se los llevó) ────────────────────
alter view public.vw_members_with_active_membership set (security_invoker = true);
alter view public.vw_recently_expired set (security_invoker = true);
alter view public.vw_lapsed_members set (security_invoker = true);

grant select on public.vw_members_with_active_membership to authenticated;
-- el cron de recordatorios la lee con service_role (aviso de vencimiento)
grant select on public.vw_members_with_active_membership to service_role;
grant select on public.vw_recently_expired to service_role;
grant select on public.vw_lapsed_members to service_role;
