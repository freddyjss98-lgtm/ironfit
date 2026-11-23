-- =============================================================================
-- Membresía digital de la app ("Iron Fit Online")
-- =============================================================================
-- Quien no es socio del gimnasio puede pagar una suscripción en la app (Apple /
-- Google, vía RevenueCat) para usar el WOD diario y las herramientas: récords,
-- fuerza, medidas, GPS, retos y comunidad. Los socios del gimnasio siguen
-- entrando gratis.
--
-- 1. members.kind: 'gym' (socio del gimnasio, lo de siempre) o 'app' (se
--    registró desde la app y aún no compró nada en el gimnasio). Al registrarle
--    la primera membresía del gimnasio pasa solo a 'gym'.
-- 2. app_subscriptions: el estado vigente de la suscripción de cada cuenta
--    (una fila por usuario) y app_subscription_events: cada aviso de RevenueCat
--    (auditoría e ingresos). Solo los escribe el servidor (service role).
-- 3. member_has_app_access(): membresía activa del gimnasio O suscripción
--    vigente. current_member_active() y _require_active_member() pasan a usarla,
--    así que las reglas de las herramientas (RLS de wod_results, lift_records,
--    member_progress, workout_*, routines, exercises, activities, comunidad,
--    retos, planificación y el bucket community) y las RPC de la app (feed,
--    retos, actividades, pizarra, reportes) aceptan las dos sin tocarlas una
--    por una. Reservar clases y el check-in miran memberships directamente:
--    siguen siendo solo del gimnasio.
-- 4. handle_new_user: nueva rama is_app_signup (registro desde la app v1.1).
-- 5. my_app_access(): lo que la app necesita saber de la cuenta en una llamada.
-- =============================================================================

-- ── 1. Tipo de cuenta ────────────────────────────────────────────────────────
alter table public.members
  add column if not exists kind text not null default 'gym'
  constraint members_kind_check check (kind in ('gym', 'app'));

comment on column public.members.kind is
  'gym = socio del gimnasio; app = solo usuario de la app (pasa a gym con su primera membresía)';

create index if not exists members_kind_app_idx on public.members (kind) where kind = 'app';

-- La primera membresía del gimnasio convierte al usuario de la app en socio.
create or replace function public._member_kind_to_gym()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.members set kind = 'gym' where id = new.member_id and kind = 'app';
  return new;
end;
$$;

drop trigger if exists memberships_member_kind_to_gym on public.memberships;
create trigger memberships_member_kind_to_gym
  after insert on public.memberships
  for each row execute function public._member_kind_to_gym();

-- ── 2. Suscripciones ─────────────────────────────────────────────────────────
create table if not exists public.app_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entitlement text not null default 'online',
  product_id text,
  store text,                         -- app_store | play_store | promotional | …
  period_type text,                   -- trial | intro | normal
  status text not null default 'active'
    constraint app_subscriptions_status_check
    check (status in ('active', 'trial', 'cancelled', 'billing_issue', 'paused', 'expired')),
  -- Acceso mientras expires_at > now(). El webhook la mueve en cada aviso
  -- (renovación, periodo de gracia, reembolso, vencimiento).
  expires_at timestamptz,
  will_renew boolean not null default true,
  environment text not null default 'production'
    constraint app_subscriptions_environment_check check (environment in ('production', 'sandbox')),
  original_transaction_id text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_subscriptions is
  'Suscripción digital vigente por cuenta (RevenueCat). Solo la escribe el webhook con service role.';

create table if not exists public.app_subscription_events (
  id text primary key,                -- id del evento de RevenueCat (idempotencia)
  user_id uuid references auth.users (id) on delete set null,
  type text not null,
  product_id text,
  store text,
  environment text,
  period_type text,
  price_usd numeric(10, 2),           -- precio en USD que reporta RevenueCat
  currency text,
  price_local numeric(12, 2),
  event_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists app_subscription_events_user_idx on public.app_subscription_events (user_id, event_at desc);
create index if not exists app_subscription_events_month_idx on public.app_subscription_events (event_at);

alter table public.app_subscriptions enable row level security;
alter table public.app_subscription_events enable row level security;

-- Cada uno ve la suya; el staff, todas. Nadie escribe desde el cliente.
drop policy if exists app_subscriptions_read on public.app_subscriptions;
create policy app_subscriptions_read on public.app_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

drop policy if exists app_subscription_events_staff_read on public.app_subscription_events;
create policy app_subscription_events_staff_read on public.app_subscription_events
  for select to authenticated
  using ((select public.is_staff()));

revoke insert, update, delete on public.app_subscriptions from anon, authenticated;
revoke insert, update, delete on public.app_subscription_events from anon, authenticated;
revoke all on public.app_subscriptions from anon;
revoke all on public.app_subscription_events from anon;

-- ── 3. Regla única de acceso ─────────────────────────────────────────────────
create or replace function public.member_has_app_access(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(public.member_is_active(p_member_id), false)
      or exists (
        select 1
        from public.members m
        join public.app_subscriptions s on s.user_id = m.user_id
        where m.id = p_member_id
          and m.deleted_at is null
          and s.expires_at > now()
      )
$$;

create or replace function public.current_member_active()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(public.member_has_app_access(public.current_member_id()), false)
$$;

create or replace function public._require_active_member()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_member uuid := public.current_member_id();
begin
  if v_member is null then raise exception 'Perfil de miembro no encontrado'; end if;
  if not public.member_has_app_access(v_member) then
    raise exception 'Necesitas una membresía activa para usar esta función.';
  end if;
  return v_member;
end;
$$;

revoke execute on function public.member_has_app_access(uuid) from anon;
revoke execute on function public._member_kind_to_gym() from anon, authenticated;

-- ── 4. Registro desde la app ─────────────────────────────────────────────────
-- Igual que antes, más la rama is_app_signup: crea la ficha como 'app', ya
-- revisada (no es un socio nuevo que recepción deba atender).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_is_admin boolean;
  v_is_self_register boolean;
  v_is_member boolean;
  v_is_app_signup boolean;
begin
  v_is_admin := coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false);
  v_is_self_register := coalesce((new.raw_user_meta_data->>'is_self_register')::boolean, false);
  v_is_member := coalesce((new.raw_user_meta_data->>'is_member')::boolean, false);
  v_is_app_signup := coalesce((new.raw_user_meta_data->>'is_app_signup')::boolean, false);

  if v_is_member then
    return new;
  elsif v_is_app_signup then
    insert into public.members (full_name, phone, email, user_id, kind, reviewed_at)
    values (
      coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
      '',
      new.email,
      new.id,
      'app',
      now()
    )
    on conflict do nothing;
  elsif v_is_self_register then
    insert into public.members (full_name, phone, email, birthday, gender, user_id, reviewed_at)
    values (
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data->>'phone', ''),
      new.email,
      nullif(new.raw_user_meta_data->>'birthday', '')::date,
      nullif(new.raw_user_meta_data->>'gender', ''),
      new.id,
      null
    )
    on conflict do nothing;
  else
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
$function$;

-- ── 5. Lo que la app necesita saber ──────────────────────────────────────────
create or replace function public.my_app_access()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with me as (
    select m.id, m.kind, m.user_id from public.members m
    where m.user_id = (select auth.uid()) and m.deleted_at is null
  )
  select jsonb_build_object(
    'access', coalesce((select public.member_has_app_access(me.id) from me), false),
    'gym', coalesce((select public.member_is_active(me.id) from me), false),
    'kind', (select me.kind from me),
    'subscription', (
      select jsonb_build_object(
        'status', s.status,
        'period_type', s.period_type,
        'expires_at', s.expires_at,
        'will_renew', s.will_renew,
        'store', s.store,
        'product_id', s.product_id,
        'active', s.expires_at > now()
      )
      from public.app_subscriptions s
      where s.user_id = (select auth.uid())
    )
  )
$$;

revoke execute on function public.my_app_access() from anon;
grant execute on function public.my_app_access() to authenticated;
