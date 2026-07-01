-- =============================================================================
-- Iron Fit Club — Contabilidad: Gastos + Utilidad neta (P&L mensual)
-- =============================================================================
-- Bloque 2 del módulo de contabilidad:
--   • expenses — egresos del gimnasio por categoría (arriendo, sueldos, …).
--   • monthly_close.total_expenses — al cerrar el mes se congela también el total
--     de gastos, para que la Utilidad neta (ingresos − gastos) quede fija.
--
-- RLS: solo admin (reusa public.is_admin()). Las finanzas no las ve el coach.
-- =============================================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null
    check (category in (
      'arriendo', 'sueldos', 'servicios', 'mantenimiento',
      'insumos', 'marketing', 'otros'
    )),
  amount numeric(12, 2) not null check (amount > 0),
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses(expense_date desc);
create index if not exists expenses_category_idx on public.expenses(category);

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ── RLS: solo admin ─────────────────────────────────────────────────────────
alter table public.expenses enable row level security;

drop policy if exists expenses_admin_all on public.expenses;
create policy expenses_admin_all on public.expenses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Snapshot de gastos al cerrar el mes ─────────────────────────────────────
alter table public.monthly_close
  add column if not exists total_expenses numeric(12, 2) not null default 0;
