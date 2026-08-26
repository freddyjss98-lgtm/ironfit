-- =============================================================================
-- Anulación de ventas (void) — cancelar una membresía puede reversar su cobro
-- =============================================================================
-- Bug: al crear/renovar una membresía se inserta una venta en `sales`, pero
-- cancelarla solo tocaba `memberships`. La venta quedaba viva y Contabilidad
-- seguía contando ese ingreso. Caso real: 3 membresías canceladas el mismo día
-- que se crearon, con motivo "Creada por error", dejaron $125 en los libros.
--
-- Se anula, no se borra. Es el estándar contable: la fila se queda con quién la
-- anuló, cuándo y por qué, y sale de los totales. Borrarla dejaría un hueco en
-- la auditoría — nadie podría saber después que ese cobro existió.
--
-- El filtro `voided_at is null` en las dos vistas de ventas es lo que realmente
-- saca la plata de los libros: de ahí cuelgan el dashboard, /admin/ventas y
-- Contabilidad (incluido el cierre mensual).
--
-- No se indexa `voided_at`: son unas cientos de filas y las vistas ya barren la
-- tabla entera para agregar. Si `sales` crece a decenas de miles, conviene un
-- índice parcial `(sale_date) where voided_at is null`.
-- =============================================================================

-- ── 1. Columnas de anulación ─────────────────────────────────────────────────
alter table public.sales
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;

comment on column public.sales.voided_at is
  'Si no es null, la venta está anulada: no cuenta en ningún total.';

-- RLS: `sales` ya tiene sales_admin_all (is_admin()) para ALL, así que solo un
-- admin puede anular. Un coach que cancele una membresía no puede tocar la
-- venta — la Server Action lo valida antes para no dejar el estado a medias.

-- ── 2. Las vistas ignoran lo anulado ─────────────────────────────────────────
create or replace view public.vw_daily_sales as
select
  sale_date,
  count(*) as sale_count,
  sum(total) as total_amount,
  sum(coalesce(discount, 0::numeric)) as total_discount,
  sum(case when payment_method = 'transfer' then total else 0::numeric end) as transfer_amount,
  sum(case when payment_method = 'transfer' then coalesce(discount, 0::numeric) else 0::numeric end) as transfer_discount,
  sum(case when payment_method = 'cash'     then total else 0::numeric end) as cash_amount,
  sum(case when payment_method = 'card'     then total else 0::numeric end) as card_amount,
  sum(case when payment_method = 'cxc'      then total else 0::numeric end) as cxc_amount,
  sum(case when payment_method = 'cxc'      then coalesce(discount, 0::numeric) else 0::numeric end) as cxc_discount
from public.sales
where voided_at is null
group by sale_date
order by sale_date desc;

create or replace view public.vw_monthly_sales as
select
  (date_trunc('month', sale_date::timestamptz))::date as month,
  count(*) as sale_count,
  sum(total) as total_amount,
  count(distinct member_id) as unique_members
from public.sales
where voided_at is null
group by (date_trunc('month', sale_date::timestamptz))
order by ((date_trunc('month', sale_date::timestamptz))::date) desc;

-- `create or replace view` sin cláusula WITH puede resetear las reloptions, así
-- que se reafirma el security_invoker de 20260703000000_security_hardening.
alter view public.vw_daily_sales   set (security_invoker = true);
alter view public.vw_monthly_sales set (security_invoker = true);

grant select on public.vw_daily_sales   to authenticated;
grant select on public.vw_monthly_sales to authenticated;

-- ── 3. Corrección de datos: las ventas de membresías "creadas por error" ──────
-- Set-based a propósito (sin ids hardcodeados): toma toda venta cuyo ÚNICO ítem
-- apunta a una membresía cancelada con ese motivo. Las de "Cambio de plan" NO
-- entran: ahí hubo un cobro real por días que el socio sí usó.
-- Al 2026-08-26 esto alcanza 3 ventas / $125: Betsey $60 (18 jun),
-- Freddy $35 (18 jun) y Stalin $30 (24 ago).
update public.sales s
set voided_at   = now(),
    void_reason = 'Membresía cancelada: Creada por error'
where s.voided_at is null
  and (select count(*) from public.sale_items si2 where si2.sale_id = s.id) = 1
  and exists (
    select 1
    from public.sale_items si
    join public.memberships mb on mb.id = si.membership_id
    where si.sale_id = s.id
      and mb.status = 'cancelled'
      and mb.cancellation_reason = 'Creada por error'
  );
