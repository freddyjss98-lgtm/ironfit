-- =============================================================================
-- Iron Fit Club — Reminder Log (recordatorios automáticos por WhatsApp)
-- =============================================================================
-- Registra cada recordatorio enviado (o simulado) para:
--   • Evitar enviar el mismo recordatorio dos veces (idempotencia).
--   • Tener trazabilidad de qué se envió, a quién y por qué canal.
--
-- El cron (/api/cron/reminders) escribe aquí usando la service role key,
-- por lo que omite RLS. La política permite además que el panel admin lo lea.
-- =============================================================================

create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  -- Tipo de recordatorio: por ahora 'membership_expiry'. Extensible a
  -- 'birthday', 'inactive', etc. cuando se activen más cohortes.
  reminder_type text not null,
  -- Fecha de referencia del recordatorio. Para vencimiento = end_date de la
  -- membresía. Permite re-enviar cuando el socio renueva (nueva fecha).
  reference_date date,
  channel text not null default 'whatsapp',
  -- Proveedor real usado: 'dry_run' (simulado) o 'meta' (Cloud API).
  provider text not null default 'dry_run',
  status text not null default 'sent'
    check (status in ('sent', 'dry_run', 'failed')),
  provider_message_id text,
  to_phone text,
  message text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists reminder_log_member_idx
  on public.reminder_log(member_id);

create index if not exists reminder_log_type_idx
  on public.reminder_log(reminder_type, reference_date);

-- Idempotencia: un solo recordatorio NO fallido por (socio, tipo, fecha ref).
-- Los 'failed' no bloquean reintentos. Nota: al pasar de pruebas (dry_run) a
-- producción real, conviene limpiar los simulados:
--   delete from public.reminder_log where status = 'dry_run';
create unique index if not exists reminder_log_dedupe_idx
  on public.reminder_log(member_id, reminder_type, reference_date)
  where status <> 'failed';

alter table public.reminder_log enable row level security;

-- Mismo patrón que el resto del panel admin: acceso total a autenticados.
create policy reminder_log_all on public.reminder_log
  for all to authenticated using (true) with check (true);
