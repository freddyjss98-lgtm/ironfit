-- =============================================================================
-- Iron Fit Club — Congelar / pausar membresías
-- =============================================================================
-- Permite pausar una membresía (viaje, lesión) y reanudarla extendiendo la
-- fecha de fin por los días que estuvo congelada.
--
-- Se usa el status existente 'frozen': la vista vw_memberships_status ya
-- propaga cualquier status distinto de 'active' como effective_status, así que
-- 'frozen' aparece tal cual sin modificar la vista. Un socio congelado no tiene
-- membresía "activa", por lo que no puede hacer check-in (comportamiento
-- deseado de una pausa).
-- =============================================================================

alter table public.memberships
  add column if not exists frozen_at date,
  add column if not exists frozen_days integer not null default 0;

comment on column public.memberships.frozen_at is
  'Fecha en que se congeló la membresía (null si está activa).';
comment on column public.memberships.frozen_days is
  'Total acumulado de días que la membresía ha estado congelada.';
