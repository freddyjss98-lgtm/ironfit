-- =============================================================================
-- Reenganche: basado en VENCIMIENTO, no en asistencia
-- =============================================================================
-- Antes vw_inactive_members usaba last_visit (asistencia), pero no todos marcan
-- asistencia → socios ACTIVOS recibían el reenganche por error. Ahora se apunta
-- a socios SIN membresía activa cuya última membresía venció hace 15-25 días
-- (sin renovar ni cancelar). El cron envía UNA vez por vencimiento (llave
-- end_date), ~a los 15 días. Los activos ya nunca lo reciben.
-- =============================================================================

create or replace view public.vw_lapsed_members as
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
  order by mb.end_date desc
  limit 1
) latest on true
where m.deleted_at is null
  and m.status = 'active'
  and latest.status <> 'cancelled'
  and latest.end_date <  today_ec()          -- sin membresía vigente (no renovó)
  and (today_ec() - latest.end_date) between 15 and 25;

grant select on public.vw_lapsed_members to service_role;

drop view if exists public.vw_inactive_members;
