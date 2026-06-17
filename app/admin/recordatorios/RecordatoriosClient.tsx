"use client";

import { useMemo, useState } from "react";
import NewMembershipForm from "../membresias/NewMembershipForm";

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

function waLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, "");
  const num = clean.startsWith("593") ? clean : clean.startsWith("0") ? `593${clean.slice(1)}` : `593${clean}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

function expiryMessage(name: string, plan: string | null, endDate: string): string {
  return `Hola ${name.split(" ")[0]}! 👋 Tu membresía${plan ? ` *${plan}*` : ""} en Iron Fit Club vence el *${endDate}*. Te invitamos a renovar para continuar entrenando sin interrupción. 💪🔥`;
}

function birthdayMessage(name: string): string {
  return `Hola ${name.split(" ")[0]}! 🎂 Todo el equipo de Iron Fit Club te desea un feliz cumpleaños! Sigue entrenando fuerte! 💪🔥`;
}

function noMembershipMessage(name: string): string {
  return `Hola ${name.split(" ")[0]}! 👋 Te echamos de menos en Iron Fit Club. ¿Listo para retomar el entrenamiento? Escríbenos y te ayudamos a elegir tu plan ideal. 💪🔥`;
}

function inactiveMessage(name: string): string {
  return `Hola ${name.split(" ")[0]}! 👋 Te extrañamos en Iron Fit Club. Notamos que llevas unos días sin venir — ¿todo bien? Tu progreso te espera, ¡vuelve cuando quieras! 💪🔥`;
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
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          label="Urgente (≤3d)"
          count={urgent.length}
          color="bg-red-500/15 text-red-400 border-red-500/20"
        />
        <SummaryCard
          label="Esta semana"
          count={soonWeek.length}
          color="bg-amber-500/15 text-amber-400 border-amber-500/20"
        />
        <SummaryCard
          label="2 semanas"
          count={soonTwoWeeks.length}
          color="bg-blue-500/15 text-blue-400 border-blue-500/20"
        />
        <SummaryCard
          label="Inactivos (≥10d)"
          count={inactive.length}
          color="bg-orange-500/15 text-orange-400 border-orange-500/20"
        />
        <SummaryCard
          label="Cumpleaños"
          count={birthdayToday.length + birthdayWeek.length}
          color="bg-purple-500/15 text-purple-400 border-purple-500/20"
        />
      </div>

      {totalPending === 0 && (
        <div className="bg-white/5 border border-line rounded-2xl px-6 py-16 text-center">
          <p className="text-fg/30 text-sm">No hay recordatorios pendientes hoy.</p>
        </div>
      )}

      <Section
        title="⚠️ Vence en 3 días o menos"
        badge="Urgente"
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
        title="🔔 Vence esta semana (4–7 días)"
        badge="Esta semana"
        badgeCls="bg-amber-500/20 text-amber-400"
        members={soonWeek}
        sent={sent}
        onSent={markSent}
        getMessage={(m) => expiryMessage(m.full_name, m.current_plan_name, m.current_end_date!)}
        getMeta={(m) => `Vence en ${daysUntil(m.current_end_date!)} días`}
      />

      <Section
        title="📅 Próximas 2 semanas (8–14 días)"
        badge="Próximamente"
        badgeCls="bg-blue-500/20 text-blue-400"
        members={soonTwoWeeks}
        sent={sent}
        onSent={markSent}
        getMessage={(m) => expiryMessage(m.full_name, m.current_plan_name, m.current_end_date!)}
        getMeta={(m) => `Vence en ${daysUntil(m.current_end_date!)} días`}
      />

      <Section
        title="😴 Inactivos · membresía activa sin venir (≥10 días)"
        badge="En riesgo"
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
        title="🎂 Cumpleaños hoy"
        badge="Hoy"
        badgeCls="bg-purple-500/20 text-purple-400"
        members={birthdayToday}
        sent={sent}
        onSent={markSent}
        getMessage={(m) => birthdayMessage(m.full_name)}
        getMeta={() => "¡Hoy es su cumpleaños!"}
      />

      <Section
        title="🎉 Cumpleaños esta semana"
        badge="Esta semana"
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
        title="⏰ Membresía vencida recientemente (últimos 30 días)"
        badge="Vencida"
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
        badge="Sin plan"
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
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className={`border rounded-xl p-4 ${color}`}>
      <p className="text-xs uppercase tracking-wider opacity-70">{label}</p>
      <p className="font-display text-3xl mt-1">{count}</p>
    </div>
  );
}

function Section({
  title,
  badge,
  badgeCls,
  members,
  sent,
  onSent,
  getMessage,
  getMeta,
  onActivate,
}: {
  title: string;
  badge: string;
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
    <div className="bg-white/5 border border-line rounded-2xl overflow-hidden">
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
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
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
