-- =============================================================================
-- Iron Fit Club — Estado de conversación para flujos multi-paso del bot
-- =============================================================================
-- "Reservar una clase" requiere 2 pasos: el bot muestra las clases de hoy
-- numeradas y el socio responde con un número. Para interpretar ese número
-- como una elección de clase (y no como una opción del menú) guardamos el
-- estado pendiente en la conversación.
--
--   pending_action  → ej. 'book_class' mientras se espera la elección.
--   pending_payload → snapshot de las opciones ofrecidas (fecha + clases).
-- =============================================================================

alter table public.whatsapp_conversations
  add column if not exists pending_action text,
  add column if not exists pending_payload jsonb;
