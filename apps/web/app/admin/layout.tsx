import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "./_components/AdminShell";

export const metadata: Metadata = {
  title: "Admin · Iron Fit Club",
  description: "Panel administrativo Iron Fit Club",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard autoritativo: solo el staff (fila en profiles) ve el panel admin.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/portal");

  const role = profile.role === "coach" ? "coach" : "admin";

  return (
    <>
      <AdminShell role={role}>{children}</AdminShell>
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
          },
        }}
      />
    </>
  );
}
