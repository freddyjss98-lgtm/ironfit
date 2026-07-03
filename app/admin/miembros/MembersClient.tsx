"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { archiveMember, restoreMember } from "./actions";
import {
  createMembership,
  adjustMembershipDays,
  changeMembershipPlan,
  cancelMembership,
} from "../membresias/actions";
import MemberForm from "./MemberForm";
import { todayInEcuador } from "@/lib/date";

// ── Types ──────────────────────────────────────────────────────────────────────

type Member = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  cedula: string | null;
  birthday: string | null;
  photo_url: string | null;
  gender: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  current_membership_id: string | null;
  current_plan_name: string | null;
  current_plan_color: string | null;
  current_start_date: string | null;
  current_end_date: string | null;
  membership_status: string | null;
  days_until_expiry: number | null;
  user_id: string | null;
  profile_role: string | null;
};

type Plan = { id: string; name: string; price: number; duration_days: number; color: string };
type ArchivedMember = {
  id: string;
  full_name: string;
  phone: string;
  photo_url: string | null;
  deleted_at: string;
};

type Props = { members: Member[]; plans: Plan[]; archived: ArchivedMember[]; role?: "admin" | "coach" };

type Modal = { type: "create" } | { type: "edit"; member: Member } | null;

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTHS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

function formatBirthday(dateStr: string | null): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${day} de ${MONTHS[month - 1]}`;
}

function isBirthdayThisMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const currentMonth = new Date().getMonth() + 1;
  return parseInt(dateStr.split("-")[1], 10) === currentMonth;
}

function birthdayDayOfMonth(dateStr: string | null): number {
  if (!dateStr) return 99;
  return parseInt(dateStr.split("-")[2], 10);
}

function formatInscripcion(dateStr: string): string {
  return dateStr.split("T")[0].replace(/-/g, "/");
}

const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MONTHS_SHORT[parseInt(m) - 1]}`;
}

function MembershipBadge({ member }: { member: Member }) {
  const s = member.membership_status;

  if (!s || s === "no_membership") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/8 text-fg/35 border border-line/30">
        Sin membresía
      </span>
    );
  }

  if (s === "expired") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 w-fit">
          ✕ Vencida
        </span>
        {member.current_plan_name && (
          <span className="text-xs text-fg/35 pl-0.5">{member.current_plan_name}</span>
        )}
        {member.current_end_date && (
          <span className="text-xs text-red-400/60 pl-0.5">venció {formatDateShort(member.current_end_date)}</span>
        )}
      </div>
    );
  }

  // active
  const planColor = member.current_plan_color ?? "#e84b1f";
  const daysLeft = member.days_until_expiry ?? 0;
  const urgent = daysLeft <= 7;

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border w-fit font-medium"
        style={{
          backgroundColor: planColor + "22",
          borderColor: planColor + "55",
          color: planColor,
        }}
      >
        ✓ {member.current_plan_name ?? "Activa"}
      </span>
      <span className="text-xs text-fg/40 pl-0.5">
        {formatDateShort(member.current_start_date)} → {formatDateShort(member.current_end_date)}
      </span>
      <span className={`text-xs pl-0.5 ${urgent ? "text-amber-400" : "text-fg/30"}`}>
        {urgent ? `⚠ ${daysLeft}d restantes` : `${daysLeft}d restantes`}
      </span>
    </div>
  );
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("593")
    ? digits
    : digits.startsWith("0")
    ? "593" + digits.slice(1)
    : "593" + digits;
}

function waLink(phone: string) {
  return `https://wa.me/${normalizePhone(phone)}`;
}

// Link público al registro del portal (cliente nuevo crea su propia cuenta)
function registerUrl() {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.ironfitclub.org";
  return `${base}/portal/register`;
}

function defaultInviteMessage() {
  return (
    "¡Hola! 💪 Te invitamos a unirte a *Iron Fit Club*.\n\n" +
    "Regístrate en nuestra plataforma para activar tu membresía, reservar clases " +
    "y seguir tu progreso desde el celular:\n" +
    registerUrl()
  );
}

// ── Modal: invitar a registrarse (clientes nuevos) ──────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(defaultInviteMessage());

  function buildWaUrl() {
    const text = encodeURIComponent(message);
    const normalized = normalizePhone(phone);
    return normalized
      ? `https://wa.me/${normalized}?text=${text}`
      : `https://wa.me/?text=${text}`;
  }

  function handleSend() {
    window.open(buildWaUrl(), "_blank", "noopener,noreferrer");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(registerUrl());
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg uppercase tracking-tight">
            Invitar a registrarse
          </h2>
          <button
            onClick={onClose}
            className="text-fg/40 hover:text-fg text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <p className="text-fg/40 text-xs mb-5">
          Para clientes nuevos: les envías el enlace para que creen su cuenta y
          activen su membresía.
        </p>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">
              WhatsApp del cliente (opcional)
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0999 123 456"
              inputMode="tel"
              className="w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20"
            />
            <p className="text-fg/30 text-xs">
              Si lo dejas vacío, WhatsApp te dejará elegir el contacto.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">
              Mensaje
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end mt-5 pt-4 border-t border-line">
          <button
            onClick={handleCopyLink}
            className="px-3 py-2 text-xs text-fg/60 hover:text-fg border border-line rounded-lg transition-colors"
          >
            Copiar link
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-2 text-xs text-fg/60 hover:text-fg border border-line rounded-lg transition-colors"
          >
            Copiar mensaje
          </button>
          <button
            onClick={handleSend}
            className="px-4 py-2 text-xs font-bold bg-[#25d366] hover:bg-[#1fb855] text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <WhatsAppIcon /> Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadCSV(rows: Member[], filename: string) {
  const headers = ["Nombre","Cédula","Teléfono","Email","Cumpleaños","Género","Fecha Inscripción","Estado","Plan","Membresía Desde","Membresía Hasta","Días Restantes"];
  const lines = rows.map((r) =>
    [
      `"${r.full_name}"`,
      r.cedula ?? "",
      r.phone,
      r.email ?? "",
      r.birthday ?? "",
      r.gender ?? "",
      formatInscripcion(r.created_at),
      r.status,
      r.current_plan_name ?? "",
      r.current_start_date ?? "",
      r.current_end_date ?? "",
      r.days_until_expiry ?? "",
    ].join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Role Badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string | null }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/25">
        Admin
      </span>
    );
  }
  if (role === "coach") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
        Coach
      </span>
    );
  }
  return <span className="text-fg/25 text-xs">—</span>;
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, url, size = 32 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </span>
  );
}

// ── Membresía inline (junto al nombre) ─────────────────────────────────────────

function PlanInline({ member, onAssign }: { member: Member; onAssign: () => void }) {
  const active = member.membership_status === "active" && member.current_plan_name;
  if (active) {
    const color = member.current_plan_color ?? "#e84b1f";
    return (
      <button
        onClick={onAssign}
        title="Cambiar membresía"
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium hover:opacity-80 transition-opacity w-fit"
        style={{ backgroundColor: color + "22", borderColor: color + "55", color }}
      >
        {member.current_plan_name}
        <span className="opacity-60">· cambiar</span>
      </button>
    );
  }
  return (
    <button
      onClick={onAssign}
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-accent/40 text-accent hover:bg-accent/10 transition-colors w-fit"
    >
      + Asignar plan
    </button>
  );
}

// ── Modal: asignar / gestionar membresía ───────────────────────────────────────

const fieldCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors";
const labelMini = "text-fg/50 text-xs uppercase tracking-wider";
const CANCEL_REASONS = [
  "Solicitud del socio",
  "Falta de pago",
  "Creada por error",
  "Otro",
];

function AssignPlanModal({
  member,
  plans,
  onClose,
}: {
  member: Member;
  plans: Plan[];
  onClose: () => void;
}) {
  const hasActive =
    member.membership_status === "active" && !!member.current_membership_id;

  if (hasActive) {
    return <ManageMembershipPanel member={member} plans={plans} onClose={onClose} />;
  }
  return <AssignNewPanel member={member} plans={plans} onClose={onClose} />;
}

// Asignar una membresía nueva (el socio no tiene ninguna activa)
function AssignNewPanel({
  member,
  plans,
  onClose,
}: {
  member: Member;
  plans: Plan[];
  onClose: () => void;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [startDate, setStartDate] = useState(todayInEcuador());
  const [amount, setAmount] = useState(String(plans[0]?.price ?? ""));
  const [method, setMethod] = useState("cash");
  const [pending, startTransition] = useTransition();

  function handlePlan(id: string) {
    setPlanId(id);
    const p = plans.find((pl) => pl.id === id);
    if (p) setAmount(String(p.price));
  }

  function handleSave() {
    if (!planId) {
      toast.error("Selecciona un plan");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("member_id", member.id);
        fd.set("plan_id", planId);
        fd.set("start_date", startDate);
        fd.set("paid_amount", amount || "0");
        fd.set("payment_method", method);
        await createMembership(fd);
        toast.success("Membresía asignada");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al asignar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg uppercase tracking-tight">Asignar membresía</h2>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">✕</button>
        </div>
        <p className="text-fg/40 text-xs mb-5">{member.full_name}</p>

        {plans.length === 0 ? (
          <p className="text-fg/50 text-sm py-4">
            No hay planes activos. Crea uno en la sección Planes.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Plan</label>
              <select value={planId} onChange={(e) => handlePlan(e.target.value)} className={fieldCls}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${p.price} ({p.duration_days}d)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelMini}>Inicio</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelMini}>Monto pagado</label>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldCls} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Método de pago</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldCls}>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-line">
          <button onClick={onClose} className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={pending || plans.length === 0}
            className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Asignar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Gestionar la membresía activa del socio: agregar/restar días, cambiar plan o cancelar
type ManageMode = "menu" | "add" | "subtract" | "change" | "cancel";

function ManageMembershipPanel({
  member,
  plans,
  onClose,
}: {
  member: Member;
  plans: Plan[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ManageMode>("menu");
  const [days, setDays] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [amount, setAmount] = useState(String(plans[0]?.price ?? ""));
  const [method, setMethod] = useState("cash");
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const membershipId = member.current_membership_id!;
  const color = member.current_plan_color ?? "#e84b1f";

  function handlePlan(id: string) {
    setPlanId(id);
    const p = plans.find((pl) => pl.id === id);
    if (p) setAmount(String(p.price));
  }

  function run(fn: () => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleAdjust(sign: 1 | -1) {
    const n = parseInt(days, 10);
    if (!n || n <= 0) {
      toast.error("Indica cuántos días");
      return;
    }
    run(
      () => adjustMembershipDays(membershipId, sign * n),
      sign > 0 ? `Se agregaron ${n} días` : `Se restaron ${n} días`
    );
  }

  function handleChangePlan() {
    if (!planId) {
      toast.error("Selecciona un plan");
      return;
    }
    const fd = new FormData();
    fd.set("member_id", member.id);
    fd.set("plan_id", planId);
    fd.set("paid_amount", amount || "0");
    fd.set("payment_method", method);
    run(() => changeMembershipPlan(membershipId, fd), "Plan cambiado");
  }

  function handleCancel() {
    const finalReason = reason === "Otro" ? note.trim() || "Otro" : reason;
    run(() => cancelMembership(membershipId, finalReason), "Membresía cancelada");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg uppercase tracking-tight">Gestionar membresía</h2>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">✕</button>
        </div>
        <p className="text-fg/40 text-xs mb-4">{member.full_name}</p>

        {/* Membresía activa actual */}
        <div className="rounded-xl border border-line bg-white/5 px-4 py-3 mb-5">
          <p className="text-fg/40 text-xs uppercase tracking-wider">Membresía activa</p>
          <div className="flex items-center justify-between mt-1">
            <span
              className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium"
              style={{ backgroundColor: color + "22", borderColor: color + "55", color }}
            >
              {member.current_plan_name}
            </span>
            <span className="text-fg/50 text-xs">
              vence {formatDateShort(member.current_end_date)}
              {typeof member.days_until_expiry === "number" && (
                <span className="text-fg/30"> · {member.days_until_expiry}d</span>
              )}
            </span>
          </div>
        </div>

        {mode === "menu" && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode("add")} className="text-sm border border-line hover:border-emerald-500/40 hover:text-emerald-400 rounded-xl py-3 transition-colors">
              ➕ Agregar días
            </button>
            <button onClick={() => setMode("subtract")} className="text-sm border border-line hover:border-amber-500/40 hover:text-amber-400 rounded-xl py-3 transition-colors">
              ➖ Restar días
            </button>
            <button onClick={() => setMode("change")} className="text-sm border border-line hover:border-accent/40 hover:text-accent rounded-xl py-3 transition-colors">
              🔄 Cambiar de plan
            </button>
            <button onClick={() => setMode("cancel")} className="text-sm border border-line hover:border-red-500/40 hover:text-red-400 rounded-xl py-3 transition-colors">
              🗑 Eliminar membresía
            </button>
          </div>
        )}

        {(mode === "add" || mode === "subtract") && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>{mode === "add" ? "Días a agregar" : "Días a restar"}</label>
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className={fieldCls}
                placeholder="Ej. 7"
                autoFocus
              />
              <p className="text-fg/35 text-xs">
                Ajusta la fecha de fin sin registrar un cobro (cortesía o corrección).
              </p>
            </div>
            <ModeFooter
              onBack={() => setMode("menu")}
              onConfirm={() => handleAdjust(mode === "add" ? 1 : -1)}
              pending={pending}
              label={mode === "add" ? "Agregar" : "Restar"}
            />
          </div>
        )}

        {mode === "change" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Nuevo plan</label>
              <select value={planId} onChange={(e) => handlePlan(e.target.value)} className={fieldCls}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — ${p.price} ({p.duration_days}d)</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelMini}>Monto pagado</label>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelMini}>Método</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldCls}>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>
            <p className="text-fg/35 text-xs">
              Cancela la membresía actual y crea una nueva con el plan elegido, desde hoy.
            </p>
            <ModeFooter onBack={() => setMode("menu")} onConfirm={handleChangePlan} pending={pending} label="Cambiar plan" />
          </div>
        )}

        {mode === "cancel" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Motivo</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={fieldCls}>
                {CANCEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {reason === "Otro" && (
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalle del motivo..." className={fieldCls} autoFocus />
            )}
            <ModeFooter onBack={() => setMode("menu")} onConfirm={handleCancel} pending={pending} label="Eliminar membresía" danger />
          </div>
        )}
      </div>
    </div>
  );
}

function ModeFooter({
  onBack,
  onConfirm,
  pending,
  label,
  danger,
}: {
  onBack: () => void;
  onConfirm: () => void;
  pending: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className="flex gap-3 justify-end pt-3 border-t border-line">
      <button onClick={onBack} className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors">
        Atrás
      </button>
      <button
        onClick={onConfirm}
        disabled={pending}
        className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 text-white ${
          danger ? "bg-red-500/90 hover:bg-red-500" : "bg-accent hover:bg-accent/80"
        }`}
      >
        {pending ? "..." : label}
      </button>
    </div>
  );
}

// ── Modal: confirmar archivado ─────────────────────────────────────────────────

function ConfirmArchiveModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [pending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      try {
        await archiveMember(member.id);
        toast.success("Usuario archivado");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al archivar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-sm p-6">
        <h2 className="font-display text-lg uppercase tracking-tight mb-2">¿Archivar usuario?</h2>
        <p className="text-fg/60 text-sm mb-1">
          Vas a archivar a <span className="text-fg font-semibold">{member.full_name}</span>.
        </p>
        <p className="text-fg/40 text-xs mb-6">
          Se ocultará de las listas pero se conserva todo su historial (ventas, asistencias,
          membresías). Podrás restaurarlo desde “Archivados”.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleArchive}
            disabled={pending}
            className="px-5 py-2 text-sm font-semibold bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "Archivando..." : "Archivar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel: archivados (restaurar) ──────────────────────────────────────────────

function ArchivedPanel({ archived, onClose }: { archived: ArchivedMember[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition();

  function handleRestore(id: string) {
    startTransition(async () => {
      try {
        await restoreMember(id);
        toast.success("Usuario restaurado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al restaurar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg uppercase tracking-tight">
            Archivados ({archived.length})
          </h2>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">
            ✕
          </button>
        </div>
        {archived.length === 0 ? (
          <p className="text-fg/40 text-sm text-center py-8">No hay usuarios archivados.</p>
        ) : (
          <div className="space-y-2">
            {archived.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 bg-white/5 border border-line rounded-xl px-3 py-2"
              >
                <Avatar name={a.full_name} url={a.photo_url} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.full_name}</p>
                  <p className="text-fg/40 text-xs">{a.phone}</p>
                </div>
                <button
                  onClick={() => handleRestore(a.id)}
                  disabled={pending}
                  className="text-xs text-accent hover:text-accent/70 border border-accent/40 hover:border-accent px-2.5 py-1 rounded transition-colors disabled:opacity-40"
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MembersClient({ members, plans, archived, role = "admin" }: Props) {
  const isCoach = role === "coach";
  const [modal, setModal] = useState<Modal>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assign, setAssign] = useState<Member | null>(null);
  const [archiving, setArchiving] = useState<Member | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  const inactiveCount = members.filter((m) => m.status === "inactive").length;

  const filtered = members.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.full_name.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      (m.email ?? "").toLowerCase().includes(q)
    );
  });

  function handleStatusFilter(v: "active" | "inactive" | "all") {
    setStatusFilter(v);
    setPage(0);
  }

  const total = filtered.length;
  const pageCount = Math.ceil(total / rowsPerPage) || 1;
  const currentPage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  // Stats
  const activos = members.filter((m) => m.status === "active");
  const totalActivos = activos.length;
  const masculinos = activos.filter((m) => m.gender === "M").length;
  const femeninos = activos.filter((m) => m.gender === "F").length;

  // Birthday this month
  const currentMonthName = MONTHS[new Date().getMonth()];
  const birthdayThisMonth = members
    .filter((m) => isBirthdayThisMonth(m.birthday))
    .sort((a, b) => birthdayDayOfMonth(a.birthday) - birthdayDayOfMonth(b.birthday));

  function handleSearch(v: string) {
    setSearch(v);
    setPage(0);
  }

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex-1 w-full">
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar usuario por nombre o apellido..."
            className="w-full bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-fg/30"
          />
        </div>
        {/* Filtro por estado */}
        <div className="flex shrink-0 rounded-lg border border-line overflow-hidden text-xs">
          {([
            ["active", "Activos"],
            ["inactive", inactiveCount > 0 ? `Inactivos (${inactiveCount})` : "Inactivos"],
            ["all", "Todos"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => handleStatusFilter(value)}
              className={`px-3 py-2 font-medium transition-colors ${
                statusFilter === value
                  ? "bg-accent text-white"
                  : "text-fg/50 hover:text-fg hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {search && (
            <button
              onClick={() => handleSearch("")}
              className="px-3 py-2 border border-line text-fg/60 hover:text-fg text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              ✕ Limpiar
            </button>
          )}
          {!isCoach && (
            <button
              onClick={() => setModal({ type: "create" })}
              className="px-3 py-2 bg-accent hover:bg-accent/80 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
            >
              + Nuevo
            </button>
          )}
          {!isCoach && (
            <button
              onClick={() => setInviteOpen(true)}
              className="px-3 py-2 bg-[#25d366] hover:bg-[#1fb855] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <WhatsAppIcon /> Invitar
            </button>
          )}
          <button
            onClick={() => downloadCSV(filtered, "usuarios.csv")}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            ↓ Excel
          </button>
          {!isCoach && (
            <button
              onClick={() => setShowArchived(true)}
              className="px-3 py-2 border border-line text-fg/60 hover:text-fg text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              🗄 Archivados{archived.length > 0 ? ` (${archived.length})` : ""}
            </button>
          )}
          <span className="px-3 py-2 bg-accent text-white text-xs font-bold rounded-lg">
            Total: {total}
          </span>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-fg/40 text-sm text-center py-12">
            {search ? "Sin resultados para esa búsqueda" : "No hay usuarios registrados"}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-fg/40 text-xs uppercase tracking-wider bg-white/[0.02]">
                    <th className="text-left px-4 py-3">Nombre</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Cumpleaños</th>
                    <th className="text-left px-4 py-3">Teléfono</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Email</th>
                    <th className="text-left px-4 py-3 hidden xl:table-cell">Inscripción</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Rol</th>
                    <th className="text-left px-4 py-3">Membresía</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((m) => {
                    const bdThisMonth = isBirthdayThisMonth(m.birthday);
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-line/50 last:border-0 hover:bg-white/[0.04] transition-colors"
                      >
                        {/* Nombre + foto + membresía */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={m.full_name} url={m.photo_url} />
                            <div className="min-w-0">
                              <Link
                                href={`/admin/miembros/${m.id}`}
                                className="flex items-center gap-1.5 group"
                              >
                                <span className="text-accent group-hover:underline font-medium">
                                  {m.full_name}
                                </span>
                                {bdThisMonth && (
                                  <span title="Cumpleaños este mes" className="text-base leading-none">
                                    🎂
                                  </span>
                                )}
                              </Link>
                              <div className="mt-1">
                                {isCoach ? (
                                  <span className="text-xs text-fg/50">
                                    {m.current_plan_name ?? "Sin plan"}
                                  </span>
                                ) : (
                                  <PlanInline member={m} onAssign={() => setAssign(m)} />
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Cumpleaños */}
                        <td className="px-4 py-3 text-fg/60 text-sm hidden md:table-cell">
                          {formatBirthday(m.birthday)}
                        </td>

                        {/* Teléfono */}
                        <td className="px-4 py-3">
                          <a
                            href={`tel:${m.phone}`}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm"
                          >
                            {m.phone}
                          </a>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3 text-fg/60 text-sm hidden lg:table-cell">
                          {m.email ?? "—"}
                        </td>

                        {/* Fecha Inscripción */}
                        <td className="px-4 py-3 text-fg/50 text-sm hidden xl:table-cell">
                          {formatInscripcion(m.created_at)}
                        </td>

                        {/* Rol */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <RoleBadge role={m.profile_role} />
                        </td>

                        {/* Membresía */}
                        <td className="px-4 py-3">
                          <MembershipBadge member={m} />
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 text-right">
                          {!isCoach && (
                            <button
                              onClick={() => setArchiving(m)}
                              title="Archivar usuario"
                              className="text-fg/25 hover:text-red-400 transition-colors text-base leading-none p-1"
                            >
                              🗑
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-line text-xs text-fg/50">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                  className="bg-white/10 border border-line rounded px-2 py-0.5 text-fg text-xs outline-none focus:border-accent"
                >
                  <option value={10}>10</option>
                  <option value={12}>12</option>
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
                  of {total}
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

      {/* ── Stats section ────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-line rounded-xl px-5 py-4 flex flex-wrap gap-6 items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <p className="text-fg/50 text-xs">Total de Usuarios Activos:</p>
            <p className="font-display text-2xl text-fg leading-tight">{totalActivos}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">♂</span>
            <span className="text-sky-400 font-bold text-lg">{masculinos}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">♀</span>
            <span className="text-pink-400 font-bold text-lg">{femeninos}</span>
          </div>
        </div>
      </div>

      {/* ── Birthday panel ───────────────────────────────────────────────── */}
      {birthdayThisMonth.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <span className="text-lg">🎂</span>
            <p className="text-sm font-semibold">
              Usuarios que cumplen años este mes ({currentMonthName}):{" "}
              <span className="font-bold">{birthdayThisMonth.length}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {birthdayThisMonth.map((m) => (
              <div
                key={m.id}
                className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3 min-w-[160px]"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-fg truncate flex items-center gap-1">
                    {m.full_name}
                    <span className="text-base leading-none">🎂</span>
                  </p>
                  <p className="text-xs text-fg/50 mt-0.5">{formatBirthday(m.birthday)}</p>
                </div>
                <a
                  href={waLink(m.phone)}
                  target="_blank"
                  rel="noreferrer"
                  title={`WhatsApp: ${m.phone}`}
                  className="shrink-0 w-7 h-7 rounded-full bg-[#25d366] flex items-center justify-center text-white hover:scale-110 transition-transform"
                >
                  <WhatsAppIcon />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal (crear / editar) ────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">
                {modal.type === "create" ? "Nuevo usuario" : "Editar usuario"}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="text-fg/40 hover:text-fg text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <MemberForm
              member={modal.type === "edit" ? modal.member : undefined}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}

      {/* ── Modal (invitar a registrarse) ─────────────────────────────────── */}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}

      {/* ── Modal asignar / cambiar membresía ─────────────────────────────── */}
      {assign && (
        <AssignPlanModal member={assign} plans={plans} onClose={() => setAssign(null)} />
      )}

      {/* ── Modal confirmar archivado ─────────────────────────────────────── */}
      {archiving && (
        <ConfirmArchiveModal member={archiving} onClose={() => setArchiving(null)} />
      )}

      {/* ── Panel archivados ──────────────────────────────────────────────── */}
      {showArchived && (
        <ArchivedPanel archived={archived} onClose={() => setShowArchived(false)} />
      )}
    </>
  );
}
