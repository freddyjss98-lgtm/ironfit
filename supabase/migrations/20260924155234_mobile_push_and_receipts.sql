-- =============================================================================
-- Iron Fit Club — App móvil (F1): tokens push y comprobantes privados
-- =============================================================================
-- Migración ADITIVA: no quita nada, se puede aplicar antes de desplegar el
-- código. El cierre (bucket privado) va aparte, en ..._mobile_lockdown.sql,
-- DESPUÉS del deploy — si se cerrara antes, la web actual (que guarda y
-- enlaza la URL pública) dejaría de mostrar los comprobantes.
--
-- 1) push_tokens: un token de Expo por dispositivo. La app lo registra con la
--    sesión del usuario; el servidor lo lee con service role para avisar.
-- 2) payment-receipts: políticas para leer comprobantes con URL firmada.
--    Staff ve todos; el socio solo los suyos (el archivo empieza por su uid,
--    ver apps/web/app/portal/renovar/actions.ts).
-- =============================================================================

-- ── 1. push_tokens ────────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- Cada usuario gestiona solo sus tokens. Un token que cambia de dueño (otra
-- cuenta en el mismo teléfono) lo reasigna el servidor, no el cliente.
create policy push_tokens_own_select on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_tokens_own_insert on public.push_tokens
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_tokens_own_update on public.push_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_tokens_own_delete on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger trg_push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- ── 2. Comprobantes: lectura con URL firmada ─────────────────────────────────
-- Subir: solo a nombre propio (`<uid>-<timestamp>.<ext>`).
create policy receipts_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and name like (select auth.uid())::text || '-%'
  );

-- Leer (necesario para createSignedUrl): staff todos, socio los suyos.
create policy receipts_select_staff_or_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (
      exists (select 1 from public.profiles p where p.id = (select auth.uid()))
      or name like (select auth.uid())::text || '-%'
    )
  );
