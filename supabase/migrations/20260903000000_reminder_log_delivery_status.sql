-- =============================================================================
-- reminder_log: estados reales de entrega + arreglo del índice de copias
-- =============================================================================
-- Del 1 al 3 de septiembre de 2026 el método de pago de Meta estuvo caído y
-- NINGÚN mensaje se entregó. El log decía 'sent' en los tres días, con cero
-- fallos, porque 'sent' solo significa que la Cloud API aceptó la llamada: el
-- rechazo real llega después, por el webhook de estado, que el código tiraba a
-- la basura ("Sin mensajes (ej. recibos de entrega/lectura) → 200 y listo").
-- Resultado: cuatro días creyendo que todo iba bien mientras nada llegaba.
--
-- Con esto el log pasa a registrar lo que de verdad pasó con cada mensaje.
-- =============================================================================

-- ── 1. Estados nuevos ────────────────────────────────────────────────────────
-- 'sent' = Meta lo aceptó · 'delivered' = llegó al teléfono · 'read' = lo abrió.
-- Solo 'failed' libera el reintento del cron, así que delivered/read se
-- comportan igual que 'sent' para la idempotencia (son "no fallidos").
alter table public.reminder_log drop constraint if exists reminder_log_status_check;
alter table public.reminder_log add constraint reminder_log_status_check
  check (status in ('sent', 'dry_run', 'delivered', 'read', 'failed'));

-- ── 2. Detalle del fallo que reporta Meta ────────────────────────────────────
alter table public.reminder_log
  add column if not exists delivered_at timestamptz,
  add column if not exists error_code   integer;

comment on column public.reminder_log.error_code is
  'Código de error de Meta (ej. 131042 = problema de facturación de la cuenta).';

-- ── 3. Búsqueda por wamid ────────────────────────────────────────────────────
-- El webhook llega con el id del mensaje y tiene que encontrar su fila rápido.
create index if not exists reminder_log_provider_msg_idx
  on public.reminder_log(provider_message_id)
  where provider_message_id is not null;

-- ── 4. Las copias al admin dejan de competir por la llave ────────────────────
-- El índice de idempotencia usa (socio, tipo, fecha) y las copias usan como
-- fecha el end_date del socio, igual que el aviso original. Así que solo se
-- registraba la PRIMERA copia de cada socio: el aviso de "vence pronto" ocupaba
-- la llave y las siguientes se descartaban en silencio. Se enviaban igual —el
-- envío ocurre antes del insert— pero el log mostraba 7 copias donde Meta
-- contaba 11, y era imposible auditar qué veía el dueño.
--
-- Una copia no es un recordatorio: no necesita idempotencia, necesita quedar
-- registrada. Por eso queda fuera del índice.
drop index if exists public.reminder_log_dedupe_idx;
create unique index reminder_log_dedupe_idx
  on public.reminder_log(member_id, reminder_type, reference_date)
  where status <> 'failed' and reminder_type <> 'admin_copy';
