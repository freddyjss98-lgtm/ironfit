-- =============================================================================
-- vw_members_with_active_membership: current_date (UTC) → today_ec()
-- =============================================================================
-- Era la última vista del proyecto que seguía calculando "hoy" en UTC. Como la
-- base corre en UTC, desde las 19:00 de Ecuador la fecha del servidor ya es la
-- del día siguiente, así que durante el horario pico del gimnasio:
--   · un socio cuya membresía vence HOY aparecía "Vencida" en el check-in
--   · days_until_expiry iba corrido un día en toda la UI
-- Caso real capturado el 2026-08-25 a las 21:40 EC: Silvana Tapia, plan hasta el
-- 25, se mostraba vencida con -1 días.
--
-- El cron no se ve afectado (corre 14:00 UTC = 09:00 EC, cuando current_date y
-- today_ec() coinciden), así que las ventanas de aviso no cambian.
--
-- El resto del esquema ya usaba today_ec(): vw_expiring_soon,
-- vw_memberships_status, vw_recently_expired, vw_lapsed_members.
-- today_ec() es STABLE, así que se evalúa una vez por consulta.
-- =============================================================================

drop view if exists public.vw_members_with_active_membership;
create view public.vw_members_with_active_membership as
select
  mem.*,
  mb.id         as current_membership_id,
  mb.plan_id    as current_plan_id,
  mp.name       as current_plan_name,
  mp.color      as current_plan_color,
  mp.duration_days as current_plan_duration_days,
  mb.start_date as current_start_date,
  mb.end_date   as current_end_date,
  (mb.end_date - today_ec()) as days_until_expiry,
  case
    when mb.id is null then 'no_membership'
    when mb.status = 'frozen' then 'frozen'
    when mb.end_date < today_ec() then 'expired'
    else 'active'
  end as membership_status
from public.members mem
left join lateral (
  select *
  from public.memberships m
  where m.member_id = mem.id
    and m.status in ('active', 'frozen', 'expired')
  order by
    (m.status = 'active' and m.start_date <= today_ec() and m.end_date >= today_ec()) desc,
    m.end_date desc
  limit 1
) mb on true
left join public.membership_plans mp on mp.id = mb.plan_id
where mem.deleted_at is null;

alter view public.vw_members_with_active_membership set (security_invoker = true);

grant select on public.vw_members_with_active_membership to authenticated;
grant select on public.vw_members_with_active_membership to service_role;
