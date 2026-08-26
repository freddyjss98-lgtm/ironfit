-- =============================================================================
-- Fix del fix: restaurar lo que 20260825000000 se llevó por delante
-- =============================================================================
-- Síntoma: /admin/miembros reventaba con "An error occurred in the Server
-- Components render". La causa es un 42703 de PostgREST — la página pide
-- `current_plan_color` y la vista recreada ya no lo tenía, así que
-- membersError venía lleno y page.tsx hace throw.
--
-- Raíz: la definición que había en producción NO era la de
-- 20260519000000_initial_schema. Dos migraciones se aplicaron por el dashboard
-- y nunca bajaron al repo (están en supabase_migrations.schema_migrations):
--   · 20260618162617 view_members_add_cedula
--   · 20260618170614 members_view_prefer_current_membership
-- El drop + create de ayer reescribió la vista a partir del archivo local, que
-- estaba desactualizado, y con eso se perdieron cuatro cosas:
--   1. current_plan_color        → lo que rompe /admin/miembros (badge del plan)
--   2. current_plan_duration_days
--   3. where mem.deleted_at is null → los socios archivados volvían a aparecer
--      en miembros, asistencia, recordatorios y en el KPI del dashboard.
--      Hoy no se notó porque no hay ninguno archivado (0 filas), pero saltaba
--      en cuanto alguien archivara a un socio.
--   4. el desempate "prefiere la membresía vigente hoy" — sin él, una renovación
--      comprada por adelantado (start_date futuro, end_date más lejano) le gana
--      a la que el socio está usando ahora mismo. Hoy no cambia a nadie, pero
--      es exactamente el escenario para el que se creó 20260618170614.
--
-- Se conserva íntegro el arreglo de ayer: cancelled/suspended siguen fuera del
-- lateral, y membership_status sigue distinguiendo 'frozen'.
--
-- OJO — el repo y la base están desalineados. supabase_migrations.schema_migrations
-- tiene 34 migraciones con nombres que no coinciden con los archivos de esta
-- carpeta, y 20260825000000 no figura ahí (se corrió a mano por el SQL editor).
-- Antes de recrear cualquier vista a partir de un archivo local, comprobar la
-- definición real con:
--   select definition from pg_views where viewname = '<vista>';
-- =============================================================================

drop view if exists public.vw_members_with_active_membership;
create view public.vw_members_with_active_membership as
select
  mem.*,
  mb.id         as current_membership_id,
  mb.plan_id    as current_plan_id,
  mp.name       as current_plan_name,
  mp.color      as current_plan_color,           -- restaurado (20260618162617)
  mp.duration_days as current_plan_duration_days, -- restaurado (20260618162617)
  mb.start_date as current_start_date,
  mb.end_date   as current_end_date,
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
  order by
    -- restaurado (20260618170614): la que está vigente HOY manda sobre la que
    -- termina más tarde, para que una renovación adelantada no tape la actual
    (m.status = 'active' and m.start_date <= current_date and m.end_date >= current_date) desc,
    m.end_date desc
  limit 1
) mb on true
left join public.membership_plans mp on mp.id = mb.plan_id
where mem.deleted_at is null;                    -- restaurado (20260618162617)

alter view public.vw_members_with_active_membership set (security_invoker = true);

grant select on public.vw_members_with_active_membership to authenticated;
grant select on public.vw_members_with_active_membership to service_role;
