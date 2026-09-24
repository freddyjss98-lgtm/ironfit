// =============================================================================
// Eliminar la cuenta de un socio (lo exigen Apple 5.1.1(v) y Google Play)
// =============================================================================
// Se borra la cuenta de acceso y los datos personales, pero NO el historial del
// negocio: membresías, ventas y asistencias quedan ligadas a una ficha
// anonimizada, porque Contabilidad y los cierres de mes dependen de ellas.
// `members.user_id` es `on delete set null`, así que al borrar el usuario de
// auth la ficha queda huérfana en vez de desaparecer en cascada.
//
// Orden deliberado: primero se borran los datos y se anonimiza (si algo falla,
// la cuenta sigue viva y se puede reintentar) y al final se elimina el usuario
// de auth.
// =============================================================================

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Ruta dentro del bucket a partir de la URL pública guardada. */
function pathInBucket(url: string | null | undefined, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url?.indexOf(marker) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

async function removeFiles(admin: Admin, bucket: string, urls: (string | null | undefined)[]) {
  const paths = urls.map((u) => pathInBucket(u, bucket)).filter((p): p is string => !!p);
  if (paths.length) await admin.storage.from(bucket).remove(paths);
}

async function deleteWhere(admin: Admin, table: string, memberId: string) {
  const { error } = await admin.from(table).delete().eq("member_id", memberId);
  if (error) throw new Error(`No se pudieron borrar los datos de ${table}: ${error.message}`);
}

export async function deleteMemberAccount(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: member, error: readErr } = await admin
    .from("members")
    .select("id, photo_url")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);

  if (member) {
    const memberId = member.id as string;

    // Medidas corporales y sus fotos: son datos de salud del socio.
    const { data: progress } = await admin
      .from("member_progress")
      .select("photo_url")
      .eq("member_id", memberId);
    await deleteWhere(admin, "member_progress", memberId);
    await removeFiles(admin, "progress-photos", (progress ?? []).map((p) => p.photo_url as string | null));

    // Entrenamiento. El orden importa: las series (cascada de las sesiones)
    // apuntan a los ejercicios con RESTRICT, así que los ejercicios propios van
    // al final.
    await deleteWhere(admin, "workout_sessions", memberId);
    await deleteWhere(admin, "routines", memberId);
    await deleteWhere(admin, "exercises", memberId);

    // Conversaciones con el bot de WhatsApp: contenido personal.
    await deleteWhere(admin, "whatsapp_messages", memberId);
    await deleteWhere(admin, "whatsapp_conversations", memberId);

    // El log de avisos se queda (cuadra lo que el sistema envió), sin el
    // teléfono ni el texto, que lleva el nombre del socio.
    const { error: logErr } = await admin
      .from("reminder_log")
      .update({ to_phone: null, message: null })
      .eq("member_id", memberId);
    if (logErr) throw new Error(logErr.message);

    const { error: anonErr } = await admin
      .from("members")
      .update({
        full_name: "Socio eliminado",
        phone: "",
        email: null,
        cedula: null,
        birthday: null,
        gender: null,
        height_cm: null,
        target_weight: null,
        goal: null,
        photo_url: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        notes: null,
        status: "inactive",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", memberId);
    if (anonErr) throw new Error(anonErr.message);

    await removeFiles(admin, "member-photos", [member.photo_url as string | null]);
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
