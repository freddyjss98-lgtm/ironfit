"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { freezeMembership, resumeMembership } from "./actions";
import NewMembershipForm from "./NewMembershipForm";
import {
  EditMembershipModal,
  CancelMembershipModal,
  RenewMembershipModal,
  type Membership,
  type Plan,
} from "./MembershipModals";
import { waLink } from "@/lib/whatsapp";
import { downloadCSV } from "@/lib/csv";
import WhatsAppIcon from "@/app/_components/WhatsAppIcon";

// ── Types ──────────────────────────────────────────────────────────────────────

type Member = { id: string; full_name: string; phone: string };

type Props = {
  memberships: Membership[];
  members: Member[];
  plans: Plan[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function exportMemberships(rows: Membership[], filename: string) {
  downloadCSV(
    filename,
    ["Nombre", "Teléfono", "Membresía", "Cupo (días)", "Fecha Fin", "Precio"],
    rows.map((r) => [
      r.full_name,
      r.phone,
      r.plan_name,
      r.plan_duration_days,
      r.end_date,
      `$${r.paid_amount.toFixed(2)}`,
    ])
  );
}

// ── Row component ──────────────────────────────────────────────────────────────

function MembresiaRow({
  m,
  onEdit,
  onCancel,
  onRenew,
}: {
  m: Membership;
  onEdit: (m: Membership) => void;
  onCancel: (m: Membership) => void;
  onRenew: (m: Membership) => void;
}) {
  const [freezePending, startFreeze] = useTransition();

  return (
    <tr className="border-b border-line/50 last:border-0 hover:bg-white/[0.03] transition-colors">
      {/* Nombre + WhatsApp */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <a
            href={waLink(m.phone)}
            target="_blank"
            rel="noreferrer"
            title={`WhatsApp: ${m.phone}`}
            className="shrink-0 w-6 h-6 rounded-full bg-[#25d366] flex items-center justify-center text-white hover:scale-110 transition-transform"
          >
            <WhatsAppIcon />
          </a>
          <div>
            <p className="font-medium text-fg leading-tight">{m.full_name}</p>
            <p className="text-fg/40 text-xs">{m.phone}</p>
          </div>
        </div>
      </td>

      {/* Membresía badge */}
      <td className="px-4 py-3">
        <span
          className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold text-white max-w-[130px] truncate"
          style={{ backgroundColor: m.plan_color || "#555" }}
          title={m.plan_name}
        >
          {m.plan_name}
        </span>
        {m.effective_status === "cancelled" && m.cancellation_reason && (
          <p className="text-fg/40 text-xs mt-1">Motivo: {m.cancellation_reason}</p>
        )}
      </td>

      {/* Cupo (duration_days del plan) */}
      <td className="px-4 py-3 text-fg/70 text-sm">{m.plan_duration_days}</td>

      {/* Fecha Fin */}
      <td className="px-4 py-3 text-fg/70 text-sm">
        {m.end_date}
        {m.effective_status === "active" && m.days_until_expiry <= 14 && (
          <p className={`text-xs ${m.days_until_expiry <= 5 ? "text-red-400" : "text-amber-400"}`}>
            {m.days_until_expiry}d restantes
          </p>
        )}
      </td>

      {/* Precio */}
      <td className="px-4 py-3 text-fg/70 text-sm">${m.paid_amount.toFixed(2)}</td>

      {/* Acciones */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => onEdit(m)}
            className="text-xs text-fg/50 hover:text-fg border border-line hover:border-fg/40 px-2.5 py-1 rounded transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => onRenew(m)}
            className="text-xs text-accent hover:text-accent/70 border border-accent/40 hover:border-accent px-2.5 py-1 rounded transition-colors whitespace-nowrap"
          >
            Renovar
          </button>
          {m.effective_status === "active" && (
            <button
              disabled={freezePending}
              onClick={() =>
                startFreeze(async () => {
                  try {
                    await freezeMembership(m.id);
                    toast.success("Membresía congelada");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Error al congelar");
                  }
                })
              }
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-400/40 hover:border-blue-400 px-2.5 py-1 rounded transition-colors disabled:opacity-40"
              title="Pausar la membresía (se reanuda extendiendo la fecha de fin)"
            >
              {freezePending ? "..." : "Congelar"}
            </button>
          )}
          {m.effective_status === "frozen" && (
            <button
              disabled={freezePending}
              onClick={() =>
                startFreeze(async () => {
                  try {
                    await resumeMembership(m.id);
                    toast.success("Membresía reanudada");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Error al reanudar");
                  }
                })
              }
              className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-400/40 hover:border-emerald-400 px-2.5 py-1 rounded transition-colors disabled:opacity-40"
            >
              {freezePending ? "..." : "Reanudar"}
            </button>
          )}
          {m.effective_status === "active" && (
            <button
              onClick={() => onCancel(m)}
              className="text-xs text-fg/30 hover:text-red-400 border border-line hover:border-red-400/40 px-2.5 py-1 rounded transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Section (Vencidas / Activas / Suspendidas) ─────────────────────────────────

function MembresiaSection({
  title,
  rows,
  csvFilename,
  onEdit,
  onCancel,
  onRenew,
}: {
  title: string;
  rows: Membership[];
  csvFilename: string;
  onEdit: (m: Membership) => void;
  onCancel: (m: Membership) => void;
  onRenew: (m: Membership) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filtered = rows.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      m.plan_name.toLowerCase().includes(search.toLowerCase())
  );

  const total = filtered.length;
  const pageCount = Math.ceil(total / rowsPerPage) || 1;
  const currentPage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(0);
  }

  return (
    <div className="space-y-3">
      {/* Section title */}
      <h3 className="font-display text-base uppercase tracking-tight text-fg/80">{title}</h3>

      {/* Toolbar: search + total badge + excel */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex-1 w-full sm:max-w-sm">
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar membresía por nombre o apellido..."
            className="w-full bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-fg/30"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <span className="px-3 py-2 bg-accent text-white text-xs font-bold rounded-lg">
            Total: {total}
          </span>
          <button
            onClick={() => exportMemberships(filtered, csvFilename)}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            ↓ EXCEL
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <p className="text-fg/40 text-sm">No hay membresías que mostrar</p>
            {search && (
              <p className="text-fg/25 text-xs">Intenta ajustar los filtros de búsqueda</p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-fg/40 text-xs uppercase tracking-wider bg-white/[0.02]">
                    <th className="text-left px-4 py-3">Nombre</th>
                    <th className="text-left px-4 py-3">Membresía</th>
                    <th className="text-left px-4 py-3">Cupo</th>
                    <th className="text-left px-4 py-3">Fecha Fin</th>
                    <th className="text-left px-4 py-3">Precio</th>
                    <th className="text-right px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((m) => (
                    <MembresiaRow key={m.id} m={m} onEdit={onEdit} onCancel={onCancel} onRenew={onRenew} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-line text-xs text-fg/50">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  className="bg-white/10 border border-line rounded px-2 py-0.5 text-fg text-xs outline-none focus:border-accent"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  {total === 0
                    ? "0"
                    : `${currentPage * rowsPerPage + 1}–${Math.min(
                        (currentPage + 1) * rowsPerPage,
                        total
                      )}`}{" "}
                  de {total}
                </span>
                <button
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-line disabled:opacity-30 hover:border-fg/40 hover:text-fg transition-colors"
                >
                  ‹
                </button>
                <button
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-line disabled:opacity-30 hover:border-fg/40 hover:text-fg transition-colors"
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export default function MembresiasList({ memberships, members, plans }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [cancelling, setCancelling] = useState<Membership | null>(null);
  const [renewing, setRenewing] = useState<Membership | null>(null);

  // Socios que YA tienen una membresía vigente (activa/programada o congelada).
  // Si un socio reactiva/renueva, entra aquí y deja de contar como "vencido".
  const currentMemberIds = new Set(
    memberships
      .filter((m) => m.effective_status === "active" || m.effective_status === "frozen")
      .map((m) => m.member_id)
  );

  // Vencidas: una sola fila por socio (la de vencimiento más reciente) y solo si
  // NO tiene ninguna membresía vigente. Así un socio nunca está en dos estados.
  const expiredByMember = new Map<string, Membership>();
  for (const m of memberships) {
    if (m.effective_status !== "expired") continue;
    if (currentMemberIds.has(m.member_id)) continue;
    const prev = expiredByMember.get(m.member_id);
    if (!prev || m.end_date > prev.end_date) expiredByMember.set(m.member_id, m);
  }
  const expired = Array.from(expiredByMember.values());

  // Activas: incluye las "programadas" (que inician al vencer la actual). Una
  // sola fila por socio: la de vencimiento más lejano = su cobertura real. Así,
  // quien renovó por adelantado aparece SOLO aquí y no en una lista aparte.
  const activeAll = memberships.filter((m) => m.effective_status === "active");
  const activeByMember = new Map<string, Membership>();
  for (const m of activeAll) {
    const prev = activeByMember.get(m.member_id);
    if (!prev || m.end_date > prev.end_date) activeByMember.set(m.member_id, m);
  }
  const active = Array.from(activeByMember.values());

  const frozen = memberships.filter((m) => m.effective_status === "frozen");
  const cancelled = memberships.filter((m) => m.effective_status === "cancelled");
  // Por vencer: según la cobertura más lejana del socio (respeta renovaciones
  // adelantadas), así quien ya renovó no aparece como "por vencer".
  const expiringSoon = active.filter(
    (m) => m.days_until_expiry >= 0 && m.days_until_expiry <= 7
  );

  return (
    <>
      {/* Top bar: nueva membresía */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Nueva membresía
        </button>
      </div>

      {/* Stacked sections */}
      <div className="space-y-8">
        {expiringSoon.length > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
            <MembresiaSection
              title="⚠ Por Vencer (próximos 7 días)"
              rows={expiringSoon}
              csvFilename="membresias_por_vencer.csv"
              onEdit={setEditing}
              onCancel={setCancelling}
              onRenew={setRenewing}
            />
          </div>
        )}
        <MembresiaSection
          title="Lista de Membresías Vencidas"
          rows={expired}
          csvFilename="membresias_vencidas.csv"
          onEdit={setEditing}
          onCancel={setCancelling}
          onRenew={setRenewing}
        />
        <MembresiaSection
          title="Lista de Membresías Activas"
          rows={active}
          csvFilename="membresias_activas.csv"
          onEdit={setEditing}
          onCancel={setCancelling}
          onRenew={setRenewing}
        />
        {frozen.length > 0 && (
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.04] p-4">
            <MembresiaSection
              title="❄ Congeladas (pausadas)"
              rows={frozen}
              csvFilename="membresias_congeladas.csv"
              onEdit={setEditing}
              onCancel={setCancelling}
              onRenew={setRenewing}
            />
          </div>
        )}
        {cancelled.length > 0 && (
          <MembresiaSection
            title="Lista de Membresías Canceladas"
            rows={cancelled}
            csvFilename="membresias_canceladas.csv"
            onEdit={setEditing}
            onCancel={setCancelling}
            onRenew={setRenewing}
          />
        )}
      </div>

      {/* Modal editar fechas */}
      {editing && (
        <EditMembershipModal membership={editing} plans={plans} onClose={() => setEditing(null)} />
      )}

      {/* Modal cancelar con motivo */}
      {cancelling && (
        <CancelMembershipModal membership={cancelling} onClose={() => setCancelling(null)} />
      )}

      {/* Modal renovar con confirmación */}
      {renewing && (
        <RenewMembershipModal membership={renewing} plans={plans} onClose={() => setRenewing(null)} />
      )}

      {/* Modal nueva membresía */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">Nueva membresía</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-fg/40 hover:text-fg text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <NewMembershipForm
              members={members}
              plans={plans}
              onClose={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
