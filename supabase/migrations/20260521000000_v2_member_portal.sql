-- =============================================================================
-- Iron Fit Club — V2 Migration: Member Portal + Attendance + Progress
-- =============================================================================
-- Adds:
--   • members.user_id, height_cm, gender, goal (portal link + profile fields)
--   • attendances table (with generated checked_in_date stored column)
--   • member_progress table (body measurements + photos)
--   • vw_attendance_stats view
--   • vw_attendance_today view
--   • Updated handle_new_user trigger (admin / self-register / invited flows)
--   • RLS policies for member self-read on portal-accessible tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Members: new columns
-- -----------------------------------------------------------------------------
alter table public.members
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists height_cm numeric(5,1),
  add column if not exists gender text check (gender in ('M', 'F', 'other') or gender is null),
  add column if not exists goal text;

create unique index if not exists members_user_id_unique_idx
  on public.members(user_id)
  where user_id is not null;

create index if not exists members_user_id_idx on public.members(user_id);

-- -----------------------------------------------------------------------------
-- 2. Attendances table
-- -----------------------------------------------------------------------------
create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  -- Generated stored column avoids IMMUTABLE restriction on timestamptz::date
  checked_in_date date not null generated always as (
    (checked_in_at at time zone 'America/Guayaquil')::date
  ) stored,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Prevent duplicate check-ins on the same calendar day (Guayaquil time)
create unique index if not exists attendances_member_date_unique_idx
  on public.attendances(member_id, checked_in_date);

create index if not exists attendances_member_idx on public.attendances(member_id);
create index if not exists attendances_date_idx on public.attendances(checked_in_date desc);
create index if not exists attendances_checked_in_at_idx on public.attendances(checked_in_at desc);

-- -----------------------------------------------------------------------------
-- 3. Member progress table
-- -----------------------------------------------------------------------------
create table if not exists public.member_progress (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  measured_at date not null default current_date,
  weight numeric(6,2),
  body_fat numeric(5,2),
  muscle_mass numeric(6,2),
  chest_cm numeric(5,1),
  waist_cm numeric(5,1),
  hips_cm numeric(5,1),
  arm_cm numeric(5,1),
  leg_cm numeric(5,1),
  notes text,
  photo_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists member_progress_member_idx on public.member_progress(member_id);
create index if not exists member_progress_date_idx on public.member_progress(member_id, measured_at desc);

-- -----------------------------------------------------------------------------
-- 4. Views: attendance stats and today's attendance
-- -----------------------------------------------------------------------------
create or replace view public.vw_attendance_stats as
select
  member_id,
  count(*) as total_visits,
  count(*) filter (
    where checked_in_date >= date_trunc('month', current_date at time zone 'America/Guayaquil')::date
  ) as visits_this_month,
  count(*) filter (
    where checked_in_date >= (current_date at time zone 'America/Guayaquil' - interval '6 days')::date
  ) as visits_last_7_days,
  max(checked_in_date) as last_visit
from public.attendances
group by member_id;

create or replace view public.vw_attendance_today as
select
  a.id,
  a.member_id,
  a.checked_in_at,
  a.checked_in_date,
  mem.full_name,
  mem.phone,
  mem.photo_url,
  ms.effective_status as membership_status,
  ms.days_until_expiry,
  mp.name as plan_name
from public.attendances a
join public.members mem on mem.id = a.member_id
left join lateral (
  select effective_status, days_until_expiry, plan_id
  from public.vw_memberships_status
  where member_id = a.member_id
  order by end_date desc
  limit 1
) ms on true
left join public.membership_plans mp on mp.id = ms.plan_id
where a.checked_in_date = (current_timestamp at time zone 'America/Guayaquil')::date;

-- -----------------------------------------------------------------------------
-- 5. Grants for new views
-- -----------------------------------------------------------------------------
grant select on public.vw_attendance_stats to authenticated;
grant select on public.vw_attendance_today to authenticated;

-- -----------------------------------------------------------------------------
-- 6. RLS on new tables
-- -----------------------------------------------------------------------------
alter table public.attendances enable row level security;
alter table public.member_progress enable row level security;

-- Admins (profiles table) can do everything
create policy attendances_admin_all on public.attendances
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid())
  );

create policy member_progress_admin_all on public.member_progress
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid())
  );

-- Members can read their own data via portal
create policy attendances_member_self_read on public.attendances
  for select to authenticated
  using (
    member_id in (
      select id from public.members where user_id = auth.uid()
    )
  );

create policy member_progress_self_read on public.member_progress
  for select to authenticated
  using (
    member_id in (
      select id from public.members where user_id = auth.uid()
    )
  );

-- Members can also read their own memberships, sales, and member record
create policy memberships_member_self_read on public.memberships
  for select to authenticated
  using (
    member_id in (
      select id from public.members where user_id = auth.uid()
    )
  );

create policy sales_member_self_read on public.sales
  for select to authenticated
  using (
    member_id in (
      select id from public.members where user_id = auth.uid()
    )
  );

create policy members_member_self_read on public.members
  for select to authenticated
  using (user_id = auth.uid());

-- Members can read all plans (to see their plan info) and class schedules
create policy membership_plans_member_read on public.membership_plans
  for select to authenticated
  using (true);

create policy class_schedules_member_read on public.class_schedules
  for select to authenticated
  using (true);

create policy products_member_read on public.products
  for select to authenticated
  using (active = true);

-- -----------------------------------------------------------------------------
-- 7. Updated handle_new_user trigger
--    • is_admin = true  → create profile row (admin panel access)
--    • is_self_register = true → create member record (portal self-registration)
--    • invited (neither flag) → create profile by default (admin invited)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_is_self_register boolean;
begin
  v_is_admin := coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false);
  v_is_self_register := coalesce((new.raw_user_meta_data->>'is_self_register')::boolean, false);

  if v_is_self_register then
    -- Portal self-registration: create member record
    insert into public.members (full_name, phone, email, user_id)
    values (
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data->>'phone', ''),
      new.email,
      new.id
    )
    on conflict do nothing;
  else
    -- Admin invite or admin sign-up: create profile row
    insert into public.profiles (id, email, full_name)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
