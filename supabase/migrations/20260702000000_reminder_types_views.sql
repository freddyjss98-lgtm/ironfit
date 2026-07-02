-- =============================================================================
-- Iron Fit Club — Vistas para nuevos tipos de recordatorio WhatsApp
-- =============================================================================
-- Candidatos para: membresía vencida, socio inactivo (reenganche), cumpleaños.
-- Todas usan today_ec() para calcular "hoy" en America/Guayaquil.
-- Solo las lee el cron con service_role (no expuestas a anon/authenticated).
-- =============================================================================

-- Última membresía venció hace 1-3 días y NO se renovó (ni fue cancelada).
create or replace view public.vw_recently_expired as
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
  order by mb.end_date desc
  limit 1
) latest on true
left join public.membership_plans mp on mp.id = latest.plan_id
where m.deleted_at is null
  and m.status = 'active'
  and latest.status <> 'cancelled'
  and latest.end_date <  today_ec()
  and latest.end_date >= today_ec() - 3;

-- Socios con membresía activa cuya última visita fue hace 14-30 días.
create or replace view public.vw_inactive_members as
select
  v.id           as member_id,
  v.full_name,
  v.phone,
  s.last_visit,
  (today_ec() - s.last_visit::date) as days_inactive
from public.vw_members_with_active_membership v
join public.vw_attendance_stats s on s.member_id = v.id
where v.status = 'active'
  and v.membership_status = 'active'
  and s.last_visit is not null
  and s.last_visit::date <= today_ec() - 14
  and s.last_visit::date >= today_ec() - 30;

-- Socios activos cuyo cumpleaños (mes-día) es hoy en Ecuador.
create or replace view public.vw_birthdays_today as
select
  m.id           as member_id,
  m.full_name,
  m.phone,
  m.birthday
from public.members m
where m.deleted_at is null
  and m.status = 'active'
  and m.birthday is not null
  and to_char(m.birthday, 'MM-DD') = to_char(today_ec(), 'MM-DD');

grant select on
  public.vw_recently_expired,
  public.vw_inactive_members,
  public.vw_birthdays_today
to service_role;
