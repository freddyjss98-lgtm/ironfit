"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createMemberAccess(memberId: string, email: string) {
  const supabase = await createClient();

  // Invite user via Supabase Admin — generates a magic link / sets up auth user
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://ironfitclub.vercel.app"}/portal`,
  });

  if (error) throw new Error(error.message);

  // Link the new auth user to the member record
  const { error: linkError } = await supabase
    .from("members")
    .update({ user_id: data.user.id })
    .eq("id", memberId);

  if (linkError) throw new Error(linkError.message);

  revalidatePath("/admin/miembros");
}

export async function revokeMemberAccess(memberId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({ user_id: null })
    .eq("id", memberId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}
