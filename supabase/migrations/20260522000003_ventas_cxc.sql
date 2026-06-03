-- =============================================================================
-- Iron Fit Club — V3.3 Migration: Ventas CxC + Descuentos
-- =============================================================================
-- Adds:
--   • sales.discount           — descuento aplicado a la venta
--   • payment_method 'cxc'     — Cuentas x Cobrar (venta a crédito)
--   • vw_daily_sales updated   — incluye cxc_amount, cxc_discount, transfer_discount
-- =============================================================================

-- 1. Add discount column
alter table public.sales
  add column if not exists discount numeric(10,2) not null default 0
    check (discount >= 0);

-- 2. Allow 'cxc' as payment method (drop + recreate constraint)
alter table public.sales
  drop constraint if exists sales_payment_method_check;

alter table public.sales
  add constraint sales_payment_method_check
    check (payment_method in ('transfer', 'cash', 'card', 'cxc', 'other'));

-- 3. Rebuild vw_daily_sales with cxc + discount breakdown
create or replace view public.vw_daily_sales as
select
  sale_date,
  count(*) as sale_count,
  sum(total)                                                                    as total_amount,
  sum(coalesce(discount, 0))                                                    as total_discount,
  sum(case when payment_method = 'transfer' then total          else 0 end)    as transfer_amount,
  sum(case when payment_method = 'transfer' then coalesce(discount,0) else 0 end) as transfer_discount,
  sum(case when payment_method = 'cash'     then total          else 0 end)    as cash_amount,
  sum(case when payment_method = 'card'     then total          else 0 end)    as card_amount,
  sum(case when payment_method = 'cxc'      then total          else 0 end)    as cxc_amount,
  sum(case when payment_method = 'cxc'      then coalesce(discount,0) else 0 end) as cxc_discount
from public.sales
group by sale_date
order by sale_date desc;

grant select on public.vw_daily_sales to authenticated;
