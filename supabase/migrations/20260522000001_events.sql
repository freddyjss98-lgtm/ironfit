-- =============================================================================
-- Iron Fit Club — V3.1 Migration: Events (Gestión de Eventos)
-- =============================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  max_capacity integer check (max_capacity is null or max_capacity > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_date_idx on public.events(event_date);

create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

-- Admins: full access
create policy events_admin_all on public.events
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));

-- Members: read all events (so portal can show upcoming events)
create policy events_member_read on public.events
  for select to authenticated
  using (true);
