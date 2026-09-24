import type { SupabaseClient } from "@supabase/supabase-js";

export type PortalMember = {
  id: string;
  full_name: string;
  phone: string | null;
  birthday: string | null;
  height_cm: number | null;
  gender: string | null;
  target_weight: number | null;
};

type Result =
  | { member: PortalMember; isPreview: false }
  | { member: PortalMember; isPreview: true }
  | { member: null; isPreview: false };

/**
 * Returns the member record for the current user.
 *
 * • Regular member  → their own record, isPreview: false
 * • Admin (no member record) → first active member for preview, isPreview: true
 * • No session / no member → { member: null, isPreview: false }
 */
export async function getPortalMember(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<Result> {
  // 1. Try to find a member linked directly to this user
  const { data: ownMember } = await supabase
    .from("members")
    .select("id, full_name, phone, birthday, height_cm, gender, target_weight")
    .eq("user_id", userId)
    .maybeSingle();

  if (ownMember) {
    return { member: ownMember as PortalMember, isPreview: false };
  }

  // 2. No member record — check if admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { member: null, isPreview: false };
  }

  // 3. Admin preview — grab first active member
  const { data: previewMember } = await supabase
    .from("members")
    .select("id, full_name, phone, birthday, height_cm, gender, target_weight")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (previewMember) {
    return { member: previewMember as PortalMember, isPreview: true };
  }

  // 4. No active members — grab any member
  const { data: anyMember } = await supabase
    .from("members")
    .select("id, full_name, phone, birthday, height_cm, gender, target_weight")
    .limit(1)
    .maybeSingle();

  if (anyMember) {
    return { member: anyMember as PortalMember, isPreview: true };
  }

  return { member: null, isPreview: false };
}
