import type { Metadata } from "next";
import { Toaster } from "sonner";
import PortalShell from "./_components/PortalShell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mi Portal · Iron Fit Club",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Detect admin role on the server — passed as prop to client shell
  let isAdmin = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = profile?.role === "admin";
    }
  } catch {
    // silently ignore — isAdmin stays false
  }

  return (
    <>
      <PortalShell isAdmin={isAdmin}>{children}</PortalShell>
      <Toaster
        theme="dark"
        position="top-center"
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
