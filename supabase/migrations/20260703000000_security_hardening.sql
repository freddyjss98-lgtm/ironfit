-- =============================================================================
-- Iron Fit Club — Endurecimiento de seguridad (auditoría 2026-07)
-- =============================================================================
-- 1) Buckets: quitar el listado público. Las URLs públicas ya guardadas siguen
--    funcionando (los buckets públicos no necesitan policy SELECT para servir
--    objetos por URL), pero ya nadie puede ENUMERAR comprobantes de pago ni
--    fotos de progreso/socios.
-- 2) reminder_log + whatsapp_*: eran USING(true) para cualquier autenticado —
--    un socio podía leer las conversaciones de WhatsApp de todos. Ahora solo
--    staff (el cron y el webhook usan service role, no les afecta).
-- 3) Vistas vw_*: security_invoker=true. Antes ejecutaban como su creador
--    (SECURITY DEFINER implícito) y un socio autenticado podía leer ventas
--    del gym vía /rest/v1/vw_daily_sales. Ahora aplican el RLS del que consulta.
-- 4) Índice duplicado en attendances: se elimina uno de los dos idénticos.
-- =============================================================================

-- ── 1. Storage: matar la enumeración de buckets ──────────────────────────────
drop policy if exists member_photos_select on storage.objects;
drop policy if exists receipts_select_public on storage.objects;
drop policy if exists productos_select on storage.objects;
drop policy if exists progress_photos_select on storage.objects;

-- ── 2. Tablas de infraestructura: solo staff ─────────────────────────────────
drop policy if exists reminder_log_all on public.reminder_log;
create policy reminder_log_staff on public.reminder_log
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

drop policy if exists whatsapp_conversations_all on public.whatsapp_conversations;
create policy whatsapp_conversations_staff on public.whatsapp_conversations
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

drop policy if exists whatsapp_messages_all on public.whatsapp_messages;
create policy whatsapp_messages_staff on public.whatsapp_messages
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

-- ── 3. Vistas: aplicar el RLS del usuario que consulta ───────────────────────
alter view public.vw_daily_sales set (security_invoker = true);
alter view public.vw_monthly_sales set (security_invoker = true);
alter view public.vw_memberships_status set (security_invoker = true);
alter view public.vw_members_with_active_membership set (security_invoker = true);
alter view public.vw_expiring_soon set (security_invoker = true);
alter view public.vw_recently_expired set (security_invoker = true);
alter view public.vw_inactive_members set (security_invoker = true);
alter view public.vw_birthdays_today set (security_invoker = true);
alter view public.vw_attendance_stats set (security_invoker = true);
alter view public.vw_attendance_today set (security_invoker = true);

-- ── 4. Índice duplicado ──────────────────────────────────────────────────────
drop index if exists public.attendances_unique_per_day;
