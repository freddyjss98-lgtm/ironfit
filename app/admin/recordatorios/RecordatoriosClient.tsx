"use client";

import { useMemo, useState } from "react";
import NewMembershipForm from "../membresias/NewMembershipForm";
import WhatsAppIcon from "@/app/_components/WhatsAppIcon";
import {
  waLink,
  expiryMessage,
  birthdayMessage,
  noMembershipMessage,
  winBackMessage as inactiveMessage,
} from "@/lib/whatsapp";

type Member = {
  id: string;
  full_name: string;
  phone: string;
  birthday: string | null;
  current_end_date: string | null;
  current_plan_name: string | null;
  membership_status: string | null;
  status: string;
  days_since_visit: number | null;
};

type Plan = { id: string; name: string; price: number; duration_days: number; color: string };

type Props = { members: Member[]; plans: Plan[] };

const today = new Date();
today.setHours(0, 0, 0, 0);

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isBirthdayToday(bday: string): boolean {
  const d = new Date(bday);
  return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function isBirthdayInDays(bday: string, from: number, to: number): boolean {
  const d = new Date(bday);
  for (let i = from; i <= to; i++) {
    const check = new Date(today);
    check.setDate(check.getDate() + i);
    if (d.getMonth() === check.getMonth() && d.getDate() === check.getDate())
      return true;
  }
  return false;
}

// Baja suavemente a la sección del recordatorio (mismo page, sin perderse).
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const INACTIVE_DAYS = 10;

export default function RecordatoriosClient({ members, plans }: Props) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [activateMember, setActivateMember] = useState<Member | null>(null);

  const {
    urgent,
    soonWeek,
    soonTwoWeeks,
    expiredRecent,
    birthdayToday,
    birthdayWeek,
    noMembership,
    inactive,
  } = useMemo(() => {
    const urgent: Member[] = [];
    const soonWeek: Member[] = [];
    const soonTwoWeeks: Member[] = [];
    const expiredRecent: Member[] = [];
    const birthdayToday: Member[] = [];
    const birthdayWeek: Member[] = [];
    const noMembership: Member[] = [];
    const inactive: Member[] = [];

    for (const m of members) {
      // Membership sections
      if (m.membership_status === "active" && m.current_end_date) {
        const days = daysUntil(m.current_end_date);
        if (days >= 0 && days <= 3) urgent.push(m);
        else if (days > 3 && days <= 7) soonWeek.push(m);
        else if (days > 7 && days <= 14) soonTwoWeeks.push(m);

        // Inactividad: membresía activa pero sin asistir hace ≥10 días
        if (m.days_since_visit !== null && m.days_since_visit >= INACTIVE_DAYS) {
          inactive.push(m);
        }
      } else if (m.membership_status === "expired" && m.current_end_date) {
        const days = daysUntil(m.current_end_date);
        if (days >= -30 && days < 0) expiredRecent.push(m);
      } else if (
        !m.membership_status ||
        m.membership_status === "no_membership" ||
        m.membership_status === "cancelled"
      ) {
        noMembership.push(m);
      }

      // Birthday sections
      if (m.birthday) {
        if (isBirthdayToday(m.birthday)) birthdayToday.push(m);
        else if (isBirthdayInDays(m.birthday, 1, 7)) birthdayWeek.push(m);
      }
    }

    // Sort expiring by urgency
    urgent.sort((a, b) => daysUntil(a.current_end_date!) - daysUntil(b.current_end_date!));
    soonWeek.sort((a, b) => daysUntil(a.current_end_date!) - daysUntil(b.current_end_date!));
    soonTwoWeeks.sort((a, b) => daysUntil(a.current_end_date!) - daysUntil(b.current_end_date!));
    // Más inactivos primero
    inactive.sort((a, b) => (b.days_since_visit ?? 0) - (a.days_since_visit ?? 0));

    return { urgent, soonWeek, soonTwoWeeks, expiredRecent, birthdayToday, birthdayWeek, noMembership, inactive };
  }, [members]);

  const totalPending =
    urgent.length +
    soonWeek.length +
    soonTwoWeeks.length +
    birthdayToday.length +
    birthdayWeek.length +
    expiredRecent.length +
    noMembership.length +
    inactive.length;

  function markSent(id: string) {
    setSent((prev) => new Set(prev).add(id));
  }

  return (
    <div className="space-y-6">
      {/* Summary bar — cada tarjeta baja a su sección */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard
          label="Urgente (≤3d)"
          count={urgent.length}
          color="bg-red-500/15 text-red-400 border-red-500/20"
          targetId="rem-urgent"
        />
        <SummaryCard
          label="Esta semana"
          count={soonWeek.length}
          color="bg-amber-500/15 text-amber-400 border-amber-500/20"
          targetId="rem-soon-week"
        />
        <SummaryCard
          label="2 semanas"
          count={soonTwoWeeks.length}
          color="bg-blue-500/15 text-blue-400 border-blue-500/20"
          targetId="rem-soon-2w"
        />
        <SummaryCard
          label="Vencidas"
          count={expiredRecent.length}
          color="bg-red-500/10 text-red-300 border-red-500/20"
          targetId="rem-expired"
        />
        <SummaryCard
          label="Inactivos (≥10d)"
          count={inactive.length}
          color="bg-orange-500/15 text-orange-400 border-orange-500/20"
          targetId="rem-inactive"
        />
        <SummaryCard
          label="Cumpleaños"
          count={birthdayToday.length + birthdayWeek.length}
          color="bg-purple-500/15 text-purple-400 border-purple-500/20"
          targetId={birthdayToday.length > 0 ? "rem-birthday-today" : "rem-birthday-week"}
        />
      </div>

      {totalPending === 0 && (
        <div className="bg-white/5 border border-line rounded-2xl px-6 py-16 text-center">
          <p className="text-fg/30 text-sm">No hay recordatorios pendientes hoy.</p>
        </div>
      )}

      <Section
        id="rem-urgent"
        title="⚠️ Vence en 3 días o menos"
        badgeCls="bg-red-500/20 text-red-400"
        members={urgent}
        sent={sent}
        onSent={markSent}
        getMessage={(m) => expiryMessage(m.full_name, m.current_plan_name, m.current_end_date!)}
        getMeta={(m) => {
          const days = daysUntil(m.current_end_date!);
          return days === 0 ? "Vence hoy" : `Vence en ${days} día${days !== 1 ? "s" : ""}`;
        }}
      />

      <Section
        id="rem-soon-week"
        title="🔔 Vence esta semana (4–7 días)"
        badgeCls="bg-amber-500/20 text-amber-400"
        members={soonWeek}
        sent={sent}
        onSent={markSent}
        getMessage={(m) => expiryMessage(m.full_name, m.current_plan_name, m.current_end_date!)}
        getMeta={(m) => `Vence en ${daysUntil(m.current_end_date!)} días`}
      />

      <Section
        id="rem-soon-2w"
        title="📅 Próximas 2 semanas (8–14 días)"
        badgeCls="bg-blue-500/20 text-blue-400"
        members={soonTwoWeeks}
        sent={sent}
        onSent={markSent}
        getMessage={(m) => expiryMessage(m.full_name, m.current_plan_name, m.current_end_date!)}
        getMeta={(m) => `Vence en ${daysUntil(m.current_end_date!)} días`}
      />

      <Section
        id="rem-inactive"
        title="😴 Inactivos · membresía activa sin venir (≥10 días)"
        badgeCls="bg-orange-500/20 text-orange-400"
        members={inactive}
        sent={sent}
        onSent={markSent}
        getMessage={(m) => inactiveMessage(m.full_name)}
        getMeta={(m) =>
          m.days_since_visit === null
            ? "Nunca ha asistido"
            : `Sin venir hace ${m.days_since_visit} días`
        }
      />

      <Section
        id="rem-birthday-today"
        title="🎂 Cumpleaños hoy"
        badgeCls="bg-purple-500/20 text-purple-400"
        members={birthdayToday}
        sent={sent}
        onSent={markSent}
        getMessage={(m) => birthdayMessage(m.full_name)}
        getMeta={() => "¡Hoy es su cumpleaños!"}
      />

      <Section
        id="rem-birthday-week"
        title="🎉 Cumpleaños esta semana"
        badgeCls="bg-purple-500/10 text-purple-300"
        members={birthdayWeek}
        sent={sent}
        onSent={markSent}
        getMessage={(m) => birthdayMessage(m.full_name)}
        getMeta={(m) => {
          const bday = new Date(m.birthday!);
          for (let i = 1; i <= 7; i++) {
            const check = new Date(today);
            check.setDate(check.getDate() + i);
            if (bday.getMonth() === check.getMonth() && bday.getDate() === check.getDate()) {
              return `Cumpleaños en ${i} día${i !== 1 ? "s" : ""}`;
            }
          }
          return "";
        }}
      />

      <Section
        id="rem-expired"
        title="⏰ Membresía vencida recientemente (últimos 30 días)"
        badgeCls="bg-red-500/10 text-red-300"
        members={expiredRecent}
        sent={sent}
        onSent={markSent}
        onActivate={setActivateMember}
        getMessage={(m) => noMembershipMessage(m.full_name)}
        getMeta={(m) => {
          const days = Math.abs(daysUntil(m.current_end_date!));
          return `Venció hace ${days} día${days !== 1 ? "s" : ""}`;
        }}
      />

      <Section
        title="❌ Sin membresía activa"
        badgeCls="bg-white/10 text-fg/40"
        members={noMembership}
        sent={sent}
        onSent={markSent}
        onActivate={setActivateMember}
        getMessage={(m) => noMembershipMessage(m.full_name)}
        getMeta={() => "Sin membresía"}
      />

      {/* Modal: activar membresía (reutiliza el formulario de Membresías) */}
      {activateMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-lg uppercase tracking-tight">Activar membresía</h2>
              <button
                onClick={() => setActivateMember(null)}
                className="text-fg/40 hover:text-fg text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <p className="text-fg/40 text-xs mb-5">{activateMember.full_name}</p>
            <NewMembershipForm
              members={[
                {
                  id: activateMember.id,
                  full_name: activateMember.full_name,
                  phone: activateMember.phone,
                },
              ]}
              plans={plans}
              defaultMemberId={activateMember.id}
              onClose={() => setActivateMember(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  count,
  color,
  targetId,
}: {
  label: string;
  count: number;
  color: string;
  targetId?: string;
}) {
  const inner = (
    <>
      <p className="text-xs uppercase tracking-wider opacity-70">{label}</p>
      <p className="font-display text-3xl mt-1">{count}</p>
    </>
  );

  // Clicable solo si hay algo que mostrar (la sección existe).
  if (targetId && count > 0) {
    return (
      <button
        type="button"
        onClick={() => scrollToSection(targetId)}
        className={`border rounded-xl p-4 text-left w-full transition hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-current/40 cursor-pointer ${color}`}
        title="Ver la lista"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={`border rounded-xl p-4 ${color}`}>
      {inner}
    </div>
  );
}

function Section({
  id,
  title,
  badgeCls,
  members,
  sent,
  onSent,
  getMessage,
  getMeta,
  onActivate,
}: {
  id?: string;
  title: string;
  badgeCls: string;
  members: Member[];
  sent: Set<string>;
  onSent: (id: string) => void;
  getMessage: (m: Member) => string;
  getMeta: (m: Member) => string;
  onActivate?: (m: Member) => void;
}) {
  if (members.length === 0) return null;

  return (
    <div id={id} className="scroll-mt-24 bg-white/5 border border-line rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeCls}`}>
          {members.length}
        </span>
      </div>

      <div className="divide-y divide-line/50">
        {members.map((m) => {
          const alreadySent = sent.has(m.id);
          const msg = getMessage(m);
          const link = waLink(m.phone, msg);
          const meta = getMeta(m);

          return (
            <div
              key={m.id}
              className={`px-5 py-3.5 flex items-center gap-4 transition-colors ${
                alreadySent ? "opacity-40" : ""
              }`}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-white/10 border border-line flex items-center justify-center text-xs font-semibold shrink-0">
                {m.full_name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{m.full_name}</p>
                <p className="text-fg/40 text-xs">
                  {m.phone} · {meta}
                  {m.current_plan_name && ` · ${m.current_plan_name}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {onActivate && (
                  <button
                    onClick={() => onActivate(m)}
                    className="flex items-center gap-1.5 bg-accent/15 hover:bg-accent/25 text-accent text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Activar membresía
                  </button>
                )}
                {alreadySent ? (
                  <span className="text-xs text-fg/30">Enviado ✓</span>
                ) : (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onSent(m.id)}
                    className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <WhatsAppIcon />
                    Enviar
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
