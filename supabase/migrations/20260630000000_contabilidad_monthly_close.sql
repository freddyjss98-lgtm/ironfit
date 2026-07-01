-- =============================================================================
-- Iron Fit Club — Contabilidad: Cierre mensual (historial congelado)
-- =============================================================================
-- Crea la base del módulo de contabilidad mes a mes:
--   • monthly_close — snapshot CONGELADO de un mes cerrado (ingresos por método,
--                     # ventas, socios únicos, socios nuevos). Una fila = un mes
--                     que el admin marcó como "cerrado" para que no cambie más.
--
-- Los meses NO cerrados se muestran en vivo desde vw_monthly_sales / vw_daily_sales,
-- así el admin siempre ve el año recalculado con los días reales sin tocar nada.
-- Al "Cerrar mes" se guarda la foto del mes aquí y deja de recalcularse.
--
-- RLS: solo admin (reusa public.is_admin()). Las finanzas no las ve el coach.
-- =============================================================================

create table if not exists public.monthly_close (
  id uuid primary key default gen_random_uuid(),
  -- Primer día del mes (2026-01-01, 2026-02-01, …). Único: un cierre por mes.
  month date not null unique,
  -- Snapshot de ingresos (congelado al cerrar)
  total_amount     numeric(12, 2) not null default 0,
  total_discount   numeric(12, 2) not null default 0,
  transfer_amount  numeric(12, 2) not null default 0,
  cash_amount      numeric(12, 2) not null default 0,
  card_amount      numeric(12, 2) not null default 0,
  cxc_amount       numeric(12, 2) not null default 0,
  sale_count       integer not null default 0,
  unique_members   integer not null default 0,
  new_members      integer not null default 0,
  -- Estado del cierre
  is_closed   boolean not null default true,
  notes       text,
  closed_at   timestamptz not null default now(),
  closed_by   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists monthly_close_month_idx on public.monthly_close(month desc);

-- updated_at automático (reusa el trigger function existente)
drop trigger if exists trg_monthly_close_updated_at on public.monthly_close;
create trigger trg_monthly_close_updated_at
  before update on public.monthly_close
  for each row execute function public.set_updated_at();

-- ── RLS: solo admin ─────────────────────────────────────────────────────────
alter table public.monthly_close enable row level security;

drop policy if exists monthly_close_admin_all on public.monthly_close;
create policy monthly_close_admin_all on public.monthly_close
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
