import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalMember } from "@/lib/portal/get-member";
import PerfilClient from "./PerfilClient";

export default async function PortalPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { member, isPreview } = await getPortalMember(supabase, user.id);
  if (!member) redirect("/portal");

  const [{ data: full }, { data: membership }] = await Promise.all([
    supabase
      .from("members")
      .select(
        "id, full_name, phone, email, birthday, photo_url, gender, height_cm, goal, emergency_contact_name, emergency_contact_phone, status, created_at"
      )
      .eq("id", member.id)
      .maybeSingle(),
    supabase
      .from("vw_memberships_status")
      .select("effective_status, end_date, days_until_expiry, membership_plans(name)")
      .eq("member_id", member.id)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (full ?? {}) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planName = (membership as any)?.membership_plans?.name ?? null;

  return (
    <PerfilClient
      isPreview={isPreview}
      profile={{
        full_name: m.full_name ?? "",
        phone: m.phone ?? "",
        email: m.email ?? null,
        birthday: m.birthday ?? null,
        photo_url: m.photo_url ?? null,
        gender: m.gender ?? null,
        height_cm: m.height_cm ?? null,
        goal: m.goal ?? null,
        emergency_contact_name: m.emergency_contact_name ?? null,
        emergency_contact_phone: m.emergency_contact_phone ?? null,
        status: m.status ?? "active",
        created_at: m.created_at ?? null,
      }}
      membership={{
        status: membership?.effective_status ?? "no_membership",
        end_date: membership?.end_date ?? null,
        days_left: membership?.days_until_expiry ?? null,
        plan_name: planName,
      }}
    />
  );
}
