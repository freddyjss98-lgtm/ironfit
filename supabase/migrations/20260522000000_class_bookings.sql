-- =============================================================================
-- Iron Fit Club — V3 Migration: Class Bookings (Reservas)
-- =============================================================================
-- Adds:
--   • class_bookings table (member reservations for specific class instances)
--   • get_class_booking_counts() RPC function (security definer, bypasses RLS for capacity display)
--   • RLS policies: admin full access, members can manage their own bookings
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. class_bookings table
-- -----------------------------------------------------------------------------
create table if not exists public.class_bookings (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.class_schedules(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  booking_date date not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'attended')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (schedule_id, member_id, booking_date)
);

create index if not exists class_bookings_schedule_date_idx
  on public.class_bookings(schedule_id, booking_date);
create index if not exists class_bookings_member_idx
  on public.class_bookings(member_id);
create index if not exists class_bookings_date_idx
  on public.class_bookings(booking_date desc);
create index if not exists class_bookings_status_idx
  on public.class_bookings(status);

-- -----------------------------------------------------------------------------
-- 2. RPC function: booking counts per schedule+date (security definer bypasses
--    member-level RLS so portal users can see total capacity usage, not just their own)
-- -----------------------------------------------------------------------------
create or replace function public.get_class_booking_counts(date_from date, date_to date)
returns table(schedule_id uuid, booking_date date, booked_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    cb.schedule_id,
    cb.booking_date,
    count(*) filter (where cb.status in ('confirmed', 'attended')) as booked_count
  from public.class_bookings cb
  where cb.booking_date between date_from and date_to
  group by cb.schedule_id, cb.booking_date;
$$;

grant execute on function public.get_class_booking_counts to authenticated;

-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------
alter table public.class_bookings enable row level security;

-- Admin: full access
create policy class_bookings_admin_all on public.class_bookings
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid()))
  with check (exists (select 1 from public.profiles where id = auth.uid()));

-- Members: read their own bookings
create policy class_bookings_member_read on public.class_bookings
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
  );

-- Members: insert bookings for themselves
create policy class_bookings_member_insert on public.class_bookings
  for insert to authenticated
  with check (
    member_id in (select id from public.members where user_id = auth.uid())
  );

-- Members: update (cancel) their own bookings
create policy class_bookings_member_update on public.class_bookings
  for update to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
  )
  with check (
    member_id in (select id from public.members where user_id = auth.uid())
  );
