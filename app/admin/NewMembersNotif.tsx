"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { markMemberReviewed, markAllMembersReviewed } from "./actions";

type NewMember = {
  id: string;
  full_name: string;
  phone: string;
  created_at: string;
};

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const mins = Math.round((now - d.getTime()) / 60000);
  if (mins < 60) return `hace ${Math.max(1, mins)} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days <= 7) return `hace ${days} día${days !== 1 ? "s" : ""}`;
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

export default function NewMembersNotif({ members }: { members: NewMember[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (members.length === 0) return null;

  function dismiss(id: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await markMemberReviewed(id);
        toast.success("Socio marcado como revisado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo marcar. Intenta de nuevo.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function dismissAll() {
    startTransition(async () => {
      try {
        await markAllMembersReviewed();
        toast.success("Listo, todos revisados");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo completar. Intenta de nuevo.");
      }
    });
  }

  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;

  return (
    <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-sky-500/20">
        <span className="text-2xl shrink-0">🆕</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-sky-200">
            {members.length} socio{members.length !== 1 ? "s" : ""} nuevo{members.length !== 1 ? "s" : ""} registrado{members.length !== 1 ? "s" : ""}
          </p>
          <p className="text-fg/50 text-xs mt-0.5">Se registraron desde el portal — revísalos</p>
        </div>
        {members.length > 1 && (
          <button
            onClick={dismissAll}
            disabled={pending}
            className="shrink-0 text-xs font-semibold text-sky-300 hover:text-sky-100 transition-colors disabled:opacity-50"
          >
            Marcar todos
          </button>
        )}
      </div>

      <div className="divide-y divide-sky-500/15">
        {shown.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <Link
                href={`/admin/miembros/${m.id}`}
                className="font-medium text-sm hover:text-accent transition-colors truncate block"
              >
                {m.full_name}
              </Link>
              <p className="text-fg/40 text-xs">
                {m.phone ? `${m.phone} · ` : ""}Registrado {fmtWhen(m.created_at)}
              </p>
            </div>
            <button
              onClick={() => dismiss(m.id)}
              disabled={pending && busyId === m.id}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 transition-colors disabled:opacity-50"
            >
              {pending && busyId === m.id ? "…" : "Revisado"}
            </button>
          </div>
        ))}
      </div>

      {extra > 0 && (
        <p className="text-fg/40 text-xs px-4 py-2 border-t border-sky-500/15">
          +{extra} más pendiente{extra !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
