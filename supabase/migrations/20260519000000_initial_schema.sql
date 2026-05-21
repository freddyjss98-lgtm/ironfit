-- =============================================================================
-- Iron Fit Club — Admin Schema (Initial)
-- =============================================================================
-- Database: PostgreSQL via Supabase
-- Modules: profiles, members, plans, memberships, coaches, classes, products, sales
-- Security: RLS enabled on all tables, authenticated-only access (admin panel)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
-- pgcrypto is enabled by default on Supabase, but declared here for clarity.
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helper: generic updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- PROFILES (extends auth.users with admin role)
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  role text not null default 'admin'
    check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile when a user signs up via Supabase auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- MEMBERS (atletas / clientes del gym)
-- =============================================================================
create table public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  birthday date,
  photo_url text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index members_phone_idx on public.members(phone);
create index members_status_idx on public.members(status);
create index members_full_name_trgm_idx on public.members
  using gin (full_name gin_trgm_ops);
create unique index members_email_unique_idx on public.members(lower(email))
  where email is not null;

create extension if not exists pg_trgm; -- for full_name_trgm_idx

create trigger trg_members_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- =============================================================================
-- COACHES (entrenadores)
-- =============================================================================
create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  specialty text,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coaches_active_idx on public.coaches(active);

create trigger trg_coaches_updated_at
  before update on public.coaches
  for each row execute function public.set_updated_at();

-- =============================================================================
-- MEMBERSHIP_PLANS (tipos de planes: Iron Fit, Iron Bimensual, etc.)
-- =============================================================================
create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  duration_days integer not null check (duration_days > 0),
  color text default '#e84b1f',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index membership_plans_active_idx on public.membership_plans(active);

create trigger trg_membership_plans_updated_at
  before update on public.membership_plans
  for each row execute function public.set_updated_at();

-- =============================================================================
-- MEMBERSHIPS (asignación de plan a miembro)
-- =============================================================================
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id) on delete restrict,
  start_date date not null default current_date,
  end_date date not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'suspended', 'cancelled')),
  paid_amount numeric(10, 2) not null check (paid_amount >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memberships_member_idx on public.memberships(member_id);
create index memberships_status_idx on public.memberships(status);
create index memberships_end_date_idx on public.memberships(end_date);
create index memberships_active_partial_idx on public.memberships(member_id, end_date)
  where status = 'active';

create trigger trg_memberships_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- =============================================================================
-- CLASS_SCHEDULES (horarios recurrentes por día de la semana)
-- =============================================================================
create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  day_of_week integer not null check (day_of_week between 0 and 6),
  -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time time not null,
  end_time time not null check (end_time > start_time),
  period text generated always as (
    case when start_time < time '12:00' then 'AM' else 'PM' end
  ) stored,
  max_capacity integer not null default 20 check (max_capacity > 0),
  coach_id uuid references public.coaches(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index class_schedules_day_time_idx on public.class_schedules(day_of_week, start_time);
create index class_schedules_coach_idx on public.class_schedules(coach_id);

create trigger trg_class_schedules_updated_at
  before update on public.class_schedules
  for each row execute function public.set_updated_at();

-- =============================================================================
-- PRODUCTS (tienda: suplementos, ropa, accesorios)
-- =============================================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text check (category in ('supplement', 'apparel', 'accessory', 'other') or category is null),
  price numeric(10, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_active_idx on public.products(active);
create index products_category_idx on public.products(category);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SALES (encabezado de venta: una venta puede incluir membresía + productos)
-- =============================================================================
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  sale_date date not null default current_date,
  total numeric(10, 2) not null check (total >= 0),
  payment_method text not null
    check (payment_method in ('transfer', 'cash', 'card', 'other')),
  bank_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index sales_date_idx on public.sales(sale_date desc);
create index sales_member_idx on public.sales(member_id);
create index sales_method_idx on public.sales(payment_method);

-- =============================================================================
-- SALE_ITEMS (líneas de cada venta: membresía o producto)
-- =============================================================================
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  item_type text not null check (item_type in ('membership', 'product')),
  membership_id uuid references public.memberships(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  subtotal numeric(10, 2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  constraint sale_items_type_ref_check check (
    (item_type = 'membership' and membership_id is not null and product_id is null)
    or
    (item_type = 'product' and product_id is not null and membership_id is null)
  )
);

create index sale_items_sale_idx on public.sale_items(sale_id);
create index sale_items_membership_idx on public.sale_items(membership_id);
create index sale_items_product_idx on public.sale_items(product_id);

-- =============================================================================
-- VIEWS — para dashboard / queries agregadas
-- =============================================================================

-- Memberships con status efectivo (calcula expired si end_date < today)
create or replace view public.vw_memberships_status as
select
  m.*,
  case
    when m.status <> 'active' then m.status
    when m.end_date < current_date then 'expired'
    else 'active'
  end as effective_status,
  (m.end_date - current_date) as days_until_expiry
from public.memberships m;

-- Miembros con su membresía activa más reciente
create or replace view public.vw_members_with_active_membership as
select
  mem.*,
  mb.id as current_membership_id,
  mb.plan_id as current_plan_id,
  mp.name as current_plan_name,
  mb.start_date as current_start_date,
  mb.end_date as current_end_date,
  (mb.end_date - current_date) as days_until_expiry,
  case
    when mb.id is null then 'no_membership'
    when mb.end_date < current_date then 'expired'
    else 'active'
  end as membership_status
from public.members mem
left join lateral (
  select *
  from public.memberships m
  where m.member_id = mem.id
  order by m.end_date desc
  limit 1
) mb on true
left join public.membership_plans mp on mp.id = mb.plan_id;

-- Resumen diario de ventas
create or replace view public.vw_daily_sales as
select
  sale_date,
  count(*) as sale_count,
  sum(total) as total_amount,
  sum(case when payment_method = 'transfer' then total else 0 end) as transfer_amount,
  sum(case when payment_method = 'cash' then total else 0 end) as cash_amount,
  sum(case when payment_method = 'card' then total else 0 end) as card_amount
from public.sales
group by sale_date
order by sale_date desc;

-- Resumen mensual de ventas
create or replace view public.vw_monthly_sales as
select
  date_trunc('month', sale_date)::date as month,
  count(*) as sale_count,
  sum(total) as total_amount,
  count(distinct member_id) as unique_members
from public.sales
group by date_trunc('month', sale_date)
order by month desc;

-- Membresías próximas a vencer (próximos 14 días)
create or replace view public.vw_expiring_soon as
select
  m.id as membership_id,
  m.member_id,
  mem.full_name,
  mem.phone,
  mp.name as plan_name,
  m.end_date,
  (m.end_date - current_date) as days_left
from public.memberships m
join public.members mem on mem.id = m.member_id
join public.membership_plans mp on mp.id = m.plan_id
where m.status = 'active'
  and m.end_date >= current_date
  and m.end_date <= current_date + interval '14 days'
order by m.end_date asc;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Strategy: this is an admin-only system. Anyone with a valid Supabase auth
-- session (authenticated role) can perform any operation. The login itself
-- is the gate — we don't expose this DB to anonymous users.
-- We can tighten with role-based policies (owner/admin/staff) in a later iteration.

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.coaches enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.class_schedules enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- PROFILES: users read all profiles (small table, admin uses), update only own
create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- All other tables: full access to authenticated users (admin panel)
create policy members_all on public.members
  for all to authenticated using (true) with check (true);

create policy coaches_all on public.coaches
  for all to authenticated using (true) with check (true);

create policy plans_all on public.membership_plans
  for all to authenticated using (true) with check (true);

create policy memberships_all on public.memberships
  for all to authenticated using (true) with check (true);

create policy class_schedules_all on public.class_schedules
  for all to authenticated using (true) with check (true);

create policy products_all on public.products
  for all to authenticated using (true) with check (true);

create policy sales_all on public.sales
  for all to authenticated using (true) with check (true);

create policy sale_items_all on public.sale_items
  for all to authenticated using (true) with check (true);

-- =============================================================================
-- GRANTS for views (RLS doesn't apply to views; access controlled by base table policies)
-- =============================================================================
grant select on public.vw_memberships_status to authenticated;
grant select on public.vw_members_with_active_membership to authenticated;
grant select on public.vw_daily_sales to authenticated;
grant select on public.vw_monthly_sales to authenticated;
grant select on public.vw_expiring_soon to authenticated;
