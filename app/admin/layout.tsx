import type { Metadata } from "next";
import { Toaster } from "sonner";
import AdminShell from "./_components/AdminShell";

export const metadata: Metadata = {
  title: "Admin · Iron Fit Club",
  description: "Panel administrativo Iron Fit Club",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminShell>{children}</AdminShell>
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
