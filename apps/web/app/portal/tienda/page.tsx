import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { site } from "@/app/content";
import PortalTiendaClient from "./PortalTiendaClient";

export default async function PortalTiendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const [{ data: products }, { data: member }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, category, price, stock")
      .eq("active", true)
      .gt("stock", 0)
      .order("category")
      .order("name"),

    supabase
      .from("members")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <PortalTiendaClient
      products={products ?? []}
      memberName={member?.full_name ?? null}
      whatsappNumber={site.whatsappNumber}
    />
  );
}
