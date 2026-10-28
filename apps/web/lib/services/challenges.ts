// =============================================================================
// Retos de la comunidad: fotos temporales
// =============================================================================
// Las fotos de un reto viven solo mientras el reto está abierto. El reto cierra
// un día después de su fecha final (el día de gracia para marcarlo como
// cumplido, igual que en complete_challenge); desde ahí sus fotos se borran
// del bucket `community` y la publicación queda sin foto (se conserva quién
// cumplió el reto). Lo corre el cron diario y también se puede llamar al
// abrir /admin/retos: es idempotente.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayInEcuador } from "@ironfit/shared/date";

export const COMMUNITY_BUCKET = "community";

type PostPhoto = { id: string; photo_path: string };

async function removePhotos(supabase: SupabaseClient, posts: PostPhoto[]): Promise<number> {
  if (posts.length === 0) return 0;
  const { error: storageError } = await supabase.storage
    .from(COMMUNITY_BUCKET)
    .remove(posts.map((p) => p.photo_path));
  if (storageError) throw new Error(`No se pudieron borrar las fotos: ${storageError.message}`);
  const { error } = await supabase
    .from("community_posts")
    .update({ photo_path: null })
    .in("id", posts.map((p) => p.id));
  if (error) throw new Error(error.message);
  return posts.length;
}

/** Fotos de las publicaciones de esos retos. */
async function photosOf(supabase: SupabaseClient, challengeIds: string[]): Promise<PostPhoto[]> {
  if (challengeIds.length === 0) return [];
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, photo_path, challenge_entries!inner(challenge_id)")
    .in("challenge_entries.challenge_id", challengeIds)
    .not("photo_path", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ id: p.id as string, photo_path: p.photo_path as string }));
}

/** Borra las fotos de los retos ya cerrados. Devuelve cuántas borró. */
export async function purgeClosedChallengePhotos(supabase: SupabaseClient): Promise<number> {
  // Cerrado = hoy > fecha final + 1  ⇔  fecha final < hoy - 1.
  const { data, error } = await supabase
    .from("challenges")
    .select("id")
    .lt("ends_on", addDays(todayInEcuador(), -1));
  if (error) throw new Error(error.message);
  return removePhotos(supabase, await photosOf(supabase, (data ?? []).map((c) => c.id as string)));
}

/** Antes de borrar un reto: sus fotos (las publicaciones se borran en cascada). */
export async function purgeChallengePhotos(supabase: SupabaseClient, challengeId: string): Promise<number> {
  return removePhotos(supabase, await photosOf(supabase, [challengeId]));
}
