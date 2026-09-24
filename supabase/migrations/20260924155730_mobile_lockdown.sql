-- =============================================================================
-- Iron Fit Club — App móvil (F1): cierre
-- =============================================================================
-- Aplicar DESPUÉS de desplegar el código de la F1, que ya:
--   • reserva, cancela y registra asistencia vía RPC (book_class,
--     cancel_my_booking, member_check_in), no con insert/update directos;
--   • guarda la ruta del comprobante y lo muestra con URL firmada
--     (lib/receipts.ts).
-- Si se aplica antes, el portal actual deja de poder reservar y de mostrar
-- comprobantes.
--
-- Políticas verificadas contra producción el 2026-09-24.
-- =============================================================================

-- ── 1. El socio ya no escribe directo en reservas ni asistencias ─────────────
-- Saltaban la membresía activa y el cupo; el update dejaba además cambiar
-- cualquier campo de la reserva (otro horario lleno, marcarse "asistió").
-- El staff sigue por *_admin_all; el socio por las RPC.
drop policy if exists class_bookings_member_insert on public.class_bookings;
drop policy if exists class_bookings_member_update on public.class_bookings;
drop policy if exists attendances_self_insert on public.attendances;

-- ── 2. Comprobantes privados ─────────────────────────────────────────────────
-- Una URL pública filtrada deja de abrir el comprobante. Las filas viejas
-- guardan la URL pública; el código extrae de ella la ruta.
update storage.buckets set public = false where id = 'payment-receipts';

-- Subir solo a nombre propio: queda receipts_insert_own (…_mobile_push_and_receipts).
drop policy if exists receipts_insert_auth on storage.objects;

-- ── 3. Borrar/subir imágenes del gimnasio: solo staff ────────────────────────
-- Las políticas eran "cualquier usuario autenticado": un socio podía borrar
-- las fotos de otros socios, las de progreso o las de productos. Ningún flujo
-- del socio borra en estos buckets ni sube a productos / progress-photos
-- (el socio registra sus medidas sin fotos). Su foto de perfil la sigue
-- subiendo por member_photos_insert, que no cambia.
drop policy if exists member_photos_delete on storage.objects;
drop policy if exists productos_delete on storage.objects;
drop policy if exists progress_photos_delete on storage.objects;
drop policy if exists productos_insert on storage.objects;
drop policy if exists progress_photos_insert on storage.objects;

create policy staff_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('member-photos', 'productos', 'progress-photos')
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
  );

create policy staff_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('productos', 'progress-photos')
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
  );
