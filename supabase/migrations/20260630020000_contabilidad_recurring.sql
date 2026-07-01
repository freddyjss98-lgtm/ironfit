-- =============================================================================
-- Iron Fit Club — Contabilidad: Gastos fijos (recurrentes)
-- =============================================================================
-- Bloque 3: plantillas de gastos que se repiten cada mes (arriendo, sueldos…).
-- El admin los define una vez y con un botón los aplica al mes en curso; se
-- insertan como filas normales en `expenses` (idempotente por mes+categoría+monto).
--
-- RLS: solo admin (reusa public.is_admin()).
-- =============================================================================

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (category in (
      'arriendo', 'sueldos', 'servicios', 'mantenimiento',
      'insumos', 'marketing', 'otros'
    )),
  amount numeric(12, 2) not null check (amount > 0),
  description text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_expenses_active_idx on public.recurring_expenses(active);

drop trigger if exists trg_recurring_expenses_updated_at on public.recurring_expenses;
create trigger trg_recurring_expenses_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

alter table public.recurring_expenses enable row level security;

drop policy if exists recurring_expenses_admin_all on public.recurring_expenses;
create policy recurring_expenses_admin_all on public.recurring_expenses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
