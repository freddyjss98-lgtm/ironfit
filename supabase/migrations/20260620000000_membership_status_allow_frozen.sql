-- =============================================================================
-- Fix: permitir status 'frozen' en memberships
-- -----------------------------------------------------------------------------
-- La migración 20260617120000_membership_freeze.sql introdujo el status 'frozen'
-- (congelar/pausar), pero el CHECK original de memberships.status sólo permitía
-- ('active','expired','suspended','cancelled'). Al congelar, el UPDATE violaba
-- el constraint y la acción fallaba (en producción con el mensaje genérico de
-- Server Components). Aquí ampliamos el CHECK para incluir 'frozen'.
-- =============================================================================

-- Elimina cualquier CHECK sobre la columna status, sin depender del nombre exacto
-- (puede variar por drift entre el repo y la BD en vivo).
do $$
declare c text;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.memberships'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.memberships drop constraint %I', c);
  end loop;
end $$;

alter table public.memberships
  add constraint memberships_status_check
  check (status in ('active', 'expired', 'suspended', 'cancelled', 'frozen'));
