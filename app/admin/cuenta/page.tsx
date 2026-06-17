import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CuentaClient from "./CuentaClient";

export default async function AdminCuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, email, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Mi cuenta</h2>
        <p className="text-fg/40 text-sm mt-0.5">Tus datos y seguridad</p>
      </div>

      <CuentaClient
        profile={{
          full_name: profile?.full_name ?? "",
          phone: profile?.phone ?? "",
          email: profile?.email ?? "",
          role: profile?.role ?? "",
        }}
      />
    </div>
  );
}
