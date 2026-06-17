-- =============================================================================
-- Iron Fit Club — Bot conversacional de WhatsApp (inbound)
-- =============================================================================
-- Soporta que los socios escriban al WhatsApp del gym y reciban respuestas
-- automáticas por menú (membresía, clases, rutina del día, hablar con asesor).
--
-- El webhook (/api/whatsapp/webhook) escribe aquí usando la service role key,
-- por lo que omite RLS. Las políticas permiten además que el panel admin lea
-- las conversaciones (bandeja futura). Mismo patrón de RLS que reminder_log.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. members.phone_digits — teléfono solo dígitos para matching confiable
-- -----------------------------------------------------------------------------
-- El teléfono se guarda como texto libre (con espacios, '+', '0' inicial...).
-- WhatsApp manda el número en formato internacional sin '+'. Esta columna
-- generada normaliza a solo dígitos para poder cruzar por los últimos 9
-- (número de abonado) sin importar el formato original.
alter table public.members
  add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored;

create index if not exists members_phone_digits_idx
  on public.members(phone_digits);

-- -----------------------------------------------------------------------------
-- 1. Conversaciones (una por número de WhatsApp)
-- -----------------------------------------------------------------------------
-- Guarda el estado de la conversación. Cuando status = 'handoff' el bot deja de
-- responder automáticamente para que un humano (recepción) tome el control.
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  -- Teléfono normalizado a formato internacional sin '+' (ej: 593991487951).
  phone text not null unique,
  -- Socio identificado por su teléfono (nullable: número desconocido / lead).
  member_id uuid references public.members(id) on delete set null,
  status text not null default 'bot'
    check (status in ('bot', 'handoff')),
  last_message_at timestamptz,
  handoff_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_conversations_member_idx
  on public.whatsapp_conversations(member_id);

create trigger trg_whatsapp_conversations_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Mensajes (log de entrantes y salientes)
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.whatsapp_conversations(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  -- ID del mensaje en Meta (wamid). Para entrantes sirve de idempotencia
  -- (Meta reintenta el webhook); para salientes es el id que devuelve la API.
  wa_message_id text,
  from_phone text,
  to_phone text,
  body text,
  -- Tipo del mensaje entrante de WhatsApp: text, interactive, image, etc.
  msg_type text,
  -- Intención detectada por el router (membership, classes, wod, handoff, ...).
  intent text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages(conversation_id, created_at);

-- Idempotencia de webhooks entrantes: un mismo wamid no se procesa dos veces.
create unique index if not exists whatsapp_messages_inbound_dedupe_idx
  on public.whatsapp_messages(wa_message_id)
  where direction = 'inbound' and wa_message_id is not null;

-- -----------------------------------------------------------------------------
-- 3. RLS — acceso total a autenticados (panel admin); el bot usa service role.
-- -----------------------------------------------------------------------------
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy whatsapp_conversations_all on public.whatsapp_conversations
  for all to authenticated using (true) with check (true);

create policy whatsapp_messages_all on public.whatsapp_messages
  for all to authenticated using (true) with check (true);
