"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { site } from "@/app/content";
import {
  addProgress,
  deleteProgress,
  updateMemberProfile,
  updateMemberFull,
  promoteToCoach,
  promoteToAdmin,
  uploadMemberPhoto,
  uploadProgressPhoto,
} from "./actions";
import {
  createMemberAccess,
  resetMemberPassword,
  revokeMemberAccess,
  type AccessCredentials,
} from "../accessActions";

type Member = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  photo_url: string | null;
  height_cm: number | null;
  gender: string | null;
  goal: string | null;
  notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: string;
  user_id: string | null;
  created_at: string;
};

type Membership = {
  id: string;
  plan_name: string;
  plan_color: string;
  start_date: string;
  end_date: string;
  paid_amount: number;
  status: string;
  effective_status: string;
  days_until_expiry: number;
};

type Attendance = {
  id: string;
  checked_in_at: string;
  checked_in_date: string;
};

type Progress = {
  id: string;
  measured_at: string;
  weight: number | null;
  body_fat: number | null;
  muscle_mass: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  notes: string | null;
  photo_url: string | null;
};

type Sale = {
  id: string;
  sale_date: string;
  total: number;
  payment_method: string;
  bank_reference: string | null;
  notes: string | null;
};

type Stats = {
  total_visits: number;
  visits_this_month: number;
  visits_last_7_days: number;
  last_visit: string | null;
} | null;

type Props = {
  member: Member;
  memberships: Membership[];
  attendances: Attendance[];
  progress: Progress[];
  sales: Sale[];
  stats: Stats;
};

const TABS = ["Resumen", "Asistencia", "Progreso", "Pagos", "Membresías"] as const;
type Tab = (typeof TABS)[number];

// ─── Edit Full Modal ───────────────────────────────────────────────────────────

function EditMemberModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateMemberFull(member.id, fd);
        toast.success("Miembro actualizado");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-bg-2 border border-line rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display text-lg uppercase tracking-tight">Editar miembro</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-fg/40 hover:text-fg text-lg transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {/* Datos básicos */}
          <div>
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-3">Datos básicos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nombre completo *</label>
                <input name="full_name" required defaultValue={member.full_name} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Teléfono *</label>
                <input name="phone" required defaultValue={member.phone} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Email</label>
                <input name="email" type="email" defaultValue={member.email ?? ""} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Cumpleaños</label>
                <input name="birthday" type="date" defaultValue={member.birthday ?? ""} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Género</label>
                <select name="gender" defaultValue={member.gender ?? ""} className={inputCls}>
                  <option value="">Sin especificar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Estado</label>
                <select name="status" defaultValue={member.status} className={inputCls}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Perfil físico */}
          <div>
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-3">Perfil físico</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Altura (cm)</label>
                <input name="height_cm" type="number" step="0.1" defaultValue={member.height_cm ?? ""} className={inputCls} placeholder="175" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Objetivo</label>
                <input name="goal" defaultValue={member.goal ?? ""} className={inputCls} placeholder="Bajar peso, ganar músculo..." />
              </div>
            </div>
          </div>

          {/* Contacto emergencia */}
          <div>
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-3">Contacto de emergencia</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nombre</label>
                <input name="emergency_contact_name" defaultValue={member.emergency_contact_name ?? ""} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Teléfono</label>
                <input name="emergency_contact_phone" defaultValue={member.emergency_contact_phone ?? ""} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Notas internas</label>
            <textarea name="notes" defaultValue={member.notes ?? ""} rows={3} className={`${inputCls} resize-none`} placeholder="Observaciones, condiciones especiales..." />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-line">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-fg/50 hover:text-fg border border-line rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="px-6 py-2.5 text-sm font-bold bg-accent hover:bg-accent/85 text-white rounded-xl transition-colors disabled:opacity-50">
              {pending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Promote to Coach Modal ────────────────────────────────────────────────────

function PromoteCoachModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [specialty, setSpecialty] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    startTransition(async () => {
      try {
        await promoteToCoach(member.id, {
          full_name: member.full_name,
          specialty,
          phone: member.phone,
          email: member.email,
        });
        toast.success(`${member.full_name} agregado como Coach`);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-bg-2 border border-line rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-lg uppercase tracking-tight">Promover a Coach</h2>
            <p className="text-fg/40 text-xs mt-0.5">{member.full_name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-fg/40 hover:text-fg transition-colors text-lg">✕</button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Especialidad</label>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ej: CrossFit, Musculación, Yoga..."
              className={inputCls}
            />
          </div>
          <div className="bg-white/5 border border-line/30 rounded-xl px-4 py-3 text-sm text-fg/50 space-y-1">
            <p>Se creará un registro en la lista de Coaches con los datos de este miembro.</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-fg/50 hover:text-fg border border-line rounded-xl transition-colors">Cancelar</button>
          <button onClick={handle} disabled={pending} className="px-5 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-colors disabled:opacity-50">
            {pending ? "Promoviendo..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelCls = "text-fg/50 text-xs uppercase tracking-wider";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MemberDetailClient({
  member,
  memberships,
  attendances,
  progress,
  sales,
  stats,
}: Props) {
  const [tab, setTab] = useState<Tab>("Resumen");
  const [editing, setEditing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [promotingAdmin, startPromoteAdmin] = useTransition();

  const activeMembership = memberships.find(
    (m) => m.effective_status === "active"
  );

  const waUrl = `https://wa.me/${member.phone.replace(/\D/g, "")}`;

  return (
    <div className="space-y-6">
      {/* HEADER del miembro */}
      <div className="bg-white/5 border border-line rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <PhotoUploader member={member} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-tight">
                  {member.full_name}
                </h1>
                <p className="text-fg/40 text-sm mt-1">
                  Atleta desde {fmtDate(member.created_at)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {activeMembership ? (
                  <span className="bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold">
                    Activo · {activeMembership.days_until_expiry}d
                  </span>
                ) : (
                  <span className="bg-red-500/15 text-red-400 px-3 py-1 rounded-full text-xs font-semibold">
                    Sin membresía
                  </span>
                )}

                {member.user_id && (
                  <span className="bg-blue-500/15 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold">
                    Portal ✓
                  </span>
                )}

                {/* ── Admin actions ── */}
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/8 border border-line/40 text-fg/60 hover:text-fg hover:border-accent/40 transition-colors flex items-center gap-1"
                >
                  ✏ Editar
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowRoleMenu((v) => !v)}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                  >
                    Cambiar rol ▾
                  </button>
                  {showRoleMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-bg-2 border border-line rounded-xl shadow-xl z-30 w-48 overflow-hidden">
                      <button
                        onClick={() => { setShowRoleMenu(false); setShowCoachModal(true); }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <span>🏋️</span> Promover a Coach
                      </button>
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          startPromoteAdmin(async () => {
                            try {
                              await promoteToAdmin(member.id, {
                                user_id: member.user_id,
                                full_name: member.full_name,
                                email: member.email,
                              });
                              toast.success(`${member.full_name} es ahora Administrador`);
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Error");
                            }
                          });
                        }}
                        disabled={promotingAdmin}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors flex items-center gap-2 border-t border-line/30 disabled:opacity-50"
                      >
                        <span>🔑</span>
                        {promotingAdmin ? "Promoviendo..." : "Promover a Admin"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/5 hover:bg-white/10 border border-line rounded-lg px-3 py-2 transition-colors"
              >
                <p className="text-fg/40 text-xs uppercase tracking-wider">Tel</p>
                <p className="text-sm truncate">{member.phone}</p>
              </a>
              <div className="bg-white/5 border border-line rounded-lg px-3 py-2">
                <p className="text-fg/40 text-xs uppercase tracking-wider">Cumple</p>
                <p className="text-sm">{member.birthday ? fmtDate(member.birthday) : "—"}</p>
              </div>
              <div className="bg-white/5 border border-line rounded-lg px-3 py-2">
                <p className="text-fg/40 text-xs uppercase tracking-wider">Visitas mes</p>
                <p className="text-sm font-semibold">{stats?.visits_this_month ?? 0}</p>
              </div>
              <div className="bg-white/5 border border-line rounded-lg px-3 py-2">
                <p className="text-fg/40 text-xs uppercase tracking-wider">Última visita</p>
                <p className="text-sm">{stats?.last_visit ? fmtDate(stats.last_visit) : "Nunca"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ACCESO AL PORTAL */}
      <PortalAccessCard member={member} />

      {/* TABS */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t
                ? "text-accent border-accent"
                : "text-fg/40 border-transparent hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {tab === "Resumen" && (
        <ResumenTab
          member={member}
          editing={editing}
          setEditing={setEditing}
        />
      )}

      {tab === "Asistencia" && (
        <AsistenciaTab attendances={attendances} stats={stats} />
      )}

      {tab === "Progreso" && (
        <ProgresoTab progress={progress} member={member} />
      )}

      {tab === "Pagos" && <PagosTab sales={sales} />}

      {tab === "Membresías" && <MembresiasTab memberships={memberships} />}

      {/* Modales */}
      {showEditModal && (
        <EditMemberModal member={member} onClose={() => setShowEditModal(false)} />
      )}
      {showCoachModal && (
        <PromoteCoachModal member={member} onClose={() => setShowCoachModal(false)} />
      )}

      {/* Cerrar menú rol al hacer click fuera */}
      {showRoleMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowRoleMenu(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCESO AL PORTAL
// ═══════════════════════════════════════════════════════════════════════════

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("593")
    ? digits
    : digits.startsWith("0")
    ? "593" + digits.slice(1)
    : "593" + digits;
}

function PortalAccessCard({ member }: { member: Member }) {
  const [showCreate, setShowCreate] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [creds, setCreds] = useState<AccessCredentials | null>(null);
  const [pending, startTransition] = useTransition();

  const hasAccess = Boolean(member.user_id);

  function handleReset() {
    if (!member.user_id) return;
    startTransition(async () => {
      try {
        const { tempPassword } = await resetMemberPassword(member.id, member.user_id!);
        setCreds({ email: member.email ?? "", tempPassword });
        toast.success("Contraseña reseteada");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al resetear");
      }
    });
  }

  return (
    <div className="bg-white/5 border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${hasAccess ? "bg-emerald-400" : "bg-fg/25"}`}
          />
          <div>
            <p className="text-sm font-semibold">Acceso al portal</p>
            <p className="text-fg/45 text-xs">
              {hasAccess
                ? `Activo · ${member.email ?? "sin correo"}`
                : "El socio aún no puede ingresar al portal"}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {hasAccess ? (
            <>
              <button
                onClick={handleReset}
                disabled={pending}
                className="px-3 py-1.5 text-xs font-semibold bg-white/8 border border-line/40 text-fg/70 hover:text-fg hover:border-accent/40 rounded-lg transition-colors disabled:opacity-50"
              >
                {pending ? "..." : "Resetear contraseña"}
              </button>
              <button
                onClick={() => setConfirmRevoke(true)}
                disabled={pending}
                className="px-3 py-1.5 text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                Revocar
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 text-xs font-bold bg-accent hover:bg-accent/85 text-white rounded-lg transition-colors"
            >
              Crear acceso al portal
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateAccessModal
          member={member}
          onClose={() => setShowCreate(false)}
          onCreated={(c) => {
            setShowCreate(false);
            setCreds(c);
          }}
        />
      )}

      {creds && (
        <CredentialsModal
          credentials={creds}
          memberName={member.full_name}
          memberPhone={member.phone}
          onClose={() => setCreds(null)}
        />
      )}

      {confirmRevoke && member.user_id && (
        <ConfirmRevokeModal
          memberId={member.id}
          userId={member.user_id}
          memberName={member.full_name}
          onClose={() => setConfirmRevoke(false)}
        />
      )}
    </div>
  );
}

function CreateAccessModal({
  member,
  onClose,
  onCreated,
}: {
  member: Member;
  onClose: () => void;
  onCreated: (creds: AccessCredentials) => void;
}) {
  const [email, setEmail] = useState(member.email ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    setError(null);
    if (!email.trim()) {
      setError("El correo es obligatorio");
      return;
    }
    startTransition(async () => {
      try {
        const creds = await createMemberAccess(member.id, email.trim(), member.full_name);
        toast.success("Acceso creado");
        onCreated(creds);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear acceso");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-bg-2 border border-line rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg uppercase tracking-tight">Crear acceso</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-fg/40 hover:text-fg text-lg transition-colors">✕</button>
        </div>
        <p className="text-fg/40 text-xs mb-5">{member.full_name}</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
        )}

        <div className="flex flex-col gap-1.5 mb-5">
          <label className={labelCls}>Correo (será su usuario) *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="socio@correo.com"
          />
          <p className="text-fg/30 text-xs">
            Se generará una contraseña temporal que el socio cambiará al ingresar.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-fg/50 hover:text-fg border border-line rounded-xl transition-colors">Cancelar</button>
          <button onClick={handle} disabled={pending} className="px-5 py-2.5 text-sm font-bold bg-accent hover:bg-accent/85 text-white rounded-xl transition-colors disabled:opacity-50">
            {pending ? "Creando..." : "Crear acceso"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmRevokeModal({
  memberId,
  userId,
  memberName,
  onClose,
}: {
  memberId: string;
  userId: string;
  memberName: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      try {
        await revokeMemberAccess(memberId, userId);
        toast.success("Acceso revocado");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al revocar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-bg-2 border border-line rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="font-display text-lg uppercase tracking-tight mb-2">¿Revocar acceso?</h2>
        <p className="text-fg/60 text-sm mb-1">
          <span className="text-fg font-semibold">{memberName}</span> ya no podrá ingresar al portal.
        </p>
        <p className="text-fg/40 text-xs mb-6">
          Se elimina su usuario de acceso. Sus datos (asistencias, pagos, progreso) se
          conservan. Puedes volver a crear el acceso después.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-fg/50 hover:text-fg border border-line rounded-xl transition-colors">Cancelar</button>
          <button onClick={handle} disabled={pending} className="px-5 py-2.5 text-sm font-bold bg-red-500/90 hover:bg-red-500 text-white rounded-xl transition-colors disabled:opacity-50">
            {pending ? "Revocando..." : "Revocar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialsModal({
  credentials,
  memberName,
  memberPhone,
  onClose,
}: {
  credentials: AccessCredentials;
  memberName: string;
  memberPhone: string;
  onClose: () => void;
}) {
  const portalUrl =
    (typeof window !== "undefined" ? window.location.origin : "https://ironfitclub.vercel.app") +
    "/portal/login";
  const firstName = memberName.trim().split(/\s+/)[0] || "";

  const message =
    `¡Hola ${firstName}! 💪 Ya tienes acceso al portal de *Iron Fit Club*.\n\n` +
    `Ingresa aquí: ${portalUrl}\n` +
    `Usuario: ${credentials.email}\n` +
    `Contraseña temporal: ${credentials.tempPassword}\n\n` +
    `Por seguridad, te pedirá crear tu propia contraseña la primera vez.`;

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  function sendWhatsApp() {
    const normalized = normalizePhone(memberPhone);
    const url = normalized
      ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-bg-2 border border-line rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-300 text-sm">
          ✓ Comparte estas credenciales <span className="font-semibold">ahora</span> — la
          contraseña no se vuelve a mostrar.
        </div>

        <div className="space-y-2">
          <div className="bg-white/5 border border-line rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={labelCls}>Usuario (correo)</p>
              <p className="text-fg text-sm truncate">{credentials.email}</p>
            </div>
            <button onClick={() => copy(credentials.email, "Usuario")} className="shrink-0 text-xs text-fg/60 hover:text-fg border border-line hover:border-accent/40 rounded-md px-2.5 py-1 transition-colors">Copiar</button>
          </div>
          <div className="bg-white/5 border border-line rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={labelCls}>Contraseña temporal</p>
              <p className="text-fg text-sm font-mono tracking-wide truncate">{credentials.tempPassword}</p>
            </div>
            <button onClick={() => copy(credentials.tempPassword, "Contraseña")} className="shrink-0 text-xs text-fg/60 hover:text-fg border border-line hover:border-accent/40 rounded-md px-2.5 py-1 transition-colors">Copiar</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-line">
          <button onClick={() => copy(message, "Mensaje")} className="px-3 py-2 text-xs text-fg/60 hover:text-fg border border-line rounded-lg transition-colors">Copiar mensaje</button>
          <button onClick={sendWhatsApp} className="px-4 py-2 text-xs font-bold bg-[#25d366] hover:bg-[#1fb855] text-white rounded-lg transition-colors">Enviar por WhatsApp</button>
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors">Listo</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PHOTO UPLOADER
// ═══════════════════════════════════════════════════════════════════════════

function PhotoUploader({ member }: { member: Member }) {
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    startTransition(async () => {
      try {
        const url = await uploadMemberPhoto(file, member.id);
        const fd = new FormData();
        fd.set("photo_url", url);
        fd.set("height_cm", String(member.height_cm ?? ""));
        fd.set("gender", member.gender ?? "");
        fd.set("goal", member.goal ?? "");
        await updateMemberProfile(member.id, fd);
        toast.success("Foto actualizada");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al subir foto");
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={pending}
        className="block w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/5 border-2 border-line overflow-hidden hover:border-accent transition-colors group relative"
      >
        {member.photo_url ? (
          <Image
            src={member.photo_url}
            alt={member.full_name}
            width={112}
            height={112}
            className="w-full h-full object-cover"
                     />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-display text-3xl text-fg/30">
            {member.full_name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
          {pending ? "Subiendo..." : "Cambiar"}
        </div>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: RESUMEN
// ═══════════════════════════════════════════════════════════════════════════

function ResumenTab({
  member,
  editing,
  setEditing,
}: {
  member: Member;
  editing: boolean;
  setEditing: (b: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("photo_url", member.photo_url ?? "");
    startTransition(async () => {
      try {
        await updateMemberProfile(member.id, fd);
        toast.success("Perfil actualizado");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="bg-white/5 border border-line rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Altura (cm)</label>
            <input name="height_cm" type="number" step="0.1" defaultValue={member.height_cm ?? ""} className={inputCls} placeholder="175" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Género</label>
            <select name="gender" defaultValue={member.gender ?? ""} className={inputCls}>
              <option value="">Sin especificar</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Objetivo</label>
            <input name="goal" defaultValue={member.goal ?? ""} className={inputCls} placeholder="Bajar peso, ganar músculo..." />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50">
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white/5 border border-line rounded-2xl p-5 space-y-5">
      <div className="flex justify-between items-start">
        <h3 className="text-fg/50 text-xs uppercase tracking-widest">Información personal</h3>
        <button onClick={() => setEditing(true)} className="text-xs text-fg/40 hover:text-fg border border-line px-2.5 py-1 rounded transition-colors">
          Editar
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Altura" value={member.height_cm ? `${member.height_cm} cm` : "—"} />
        <Field label="Género" value={member.gender === "M" ? "Masculino" : member.gender === "F" ? "Femenino" : member.gender === "other" ? "Otro" : "—"} />
        <Field label="Correo" value={member.email ?? "—"} />
        <Field label="Estado" value={member.status === "active" ? "Activo" : "Inactivo"} />
      </div>

      <div>
        <Field label="Objetivo" value={member.goal ?? "Sin definir"} />
      </div>

      {(member.emergency_contact_name || member.emergency_contact_phone) && (
        <div className="pt-3 border-t border-line">
          <h3 className="text-fg/50 text-xs uppercase tracking-widest mb-3">Contacto emergencia</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre" value={member.emergency_contact_name ?? "—"} />
            <Field label="Teléfono" value={member.emergency_contact_phone ?? "—"} />
          </div>
        </div>
      )}

      {member.notes && (
        <div className="pt-3 border-t border-line">
          <h3 className="text-fg/50 text-xs uppercase tracking-widest mb-2">Notas</h3>
          <p className="text-sm text-fg/70 whitespace-pre-line">{member.notes}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-fg/40 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ASISTENCIA
// ═══════════════════════════════════════════════════════════════════════════

function AsistenciaTab({ attendances, stats }: { attendances: Attendance[]; stats: Stats }) {
  // Build heatmap of last 30 days
  const days: { date: string; visited: boolean }[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      visited: attendances.some((a) => a.checked_in_date === dateStr),
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Visitas totales" value={String(stats?.total_visits ?? 0)} />
        <Stat label="Este mes" value={String(stats?.visits_this_month ?? 0)} accent />
        <Stat label="Últimos 7 días" value={String(stats?.visits_last_7_days ?? 0)} />
      </div>

      <div className="bg-white/5 border border-line rounded-2xl p-5">
        <h3 className="text-fg/50 text-xs uppercase tracking-widest mb-3">
          Últimos 30 días
        </h3>
        <div className="grid grid-cols-15 gap-1">
          {days.map((d) => (
            <div
              key={d.date}
              title={`${d.date}${d.visited ? " · Asistió" : ""}`}
              className={`aspect-square rounded ${
                d.visited
                  ? "bg-accent"
                  : "bg-white/5 border border-line/50"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="bg-white/5 border border-line rounded-2xl overflow-hidden">
        <h3 className="text-fg/50 text-xs uppercase tracking-widest px-5 pt-5 mb-3">
          Historial reciente
        </h3>
        {attendances.length === 0 ? (
          <p className="text-fg/30 text-sm text-center py-8">Sin asistencias registradas</p>
        ) : (
          <div className="divide-y divide-line/50">
            {attendances.slice(0, 30).map((a) => (
              <div key={a.id} className="px-5 py-2.5 text-sm flex justify-between items-center">
                <span>{fmtDate(a.checked_in_date)}</span>
                <span className="text-fg/40 text-xs">
                  {new Date(a.checked_in_at).toLocaleTimeString("es-EC", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white/5 border border-line rounded-xl p-4">
      <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-display text-2xl ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: PROGRESO
// ═══════════════════════════════════════════════════════════════════════════

function ProgresoTab({ progress, member }: { progress: Progress[]; member: Member }) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    startTransition(async () => {
      try {
        const url = await uploadProgressPhoto(file, member.id);
        setPhotoUrl(url);
        toast.success("Foto subida");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al subir foto");
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (photoUrl) fd.set("photo_url", photoUrl);

    startTransition(async () => {
      try {
        await addProgress(member.id, fd);
        toast.success("Medición registrada");
        setShowForm(false);
        setPhotoUrl(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleDelete(progressId: string) {
    if (!confirm("¿Eliminar esta medición?")) return;
    startTransition(async () => {
      try {
        await deleteProgress(progressId, member.id);
        toast.success("Medición eliminada");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  // Weight chart data
  const weightData = progress
    .filter((p) => p.weight !== null)
    .slice(0, 12)
    .reverse();

  const firstWeight = weightData[0]?.weight ?? null;
  const lastWeight = weightData[weightData.length - 1]?.weight ?? null;
  const weightDelta = firstWeight && lastWeight ? lastWeight - firstWeight : null;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h3 className="text-fg/50 text-xs uppercase tracking-widest">
          {progress.length} medicione{progress.length !== 1 ? "s" : ""}
        </h3>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 bg-accent hover:bg-accent/80 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {showForm ? "Cancelar" : "+ Medición"}
        </button>
      </div>

      {/* Weight summary */}
      {weightDelta !== null && (
        <div className="bg-white/5 border border-line rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">
              Cambio de peso
            </p>
            <p
              className={`font-display text-3xl ${
                weightDelta < 0 ? "text-emerald-400" : weightDelta > 0 ? "text-amber-400" : ""
              }`}
            >
              {weightDelta > 0 ? "+" : ""}
              {weightDelta.toFixed(1)} kg
            </p>
            <p className="text-fg/40 text-xs">desde {weightData[0]?.measured_at}</p>
          </div>
          <SimpleChart data={weightData} />
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/5 border border-line rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Fecha</label>
              <input name="measured_at" type="date" defaultValue={new Date().toISOString().split("T")[0]} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Peso (kg)</label>
              <input name="weight" type="number" step="0.1" className={inputCls} placeholder="75.5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>% Grasa</label>
              <input name="body_fat" type="number" step="0.1" className={inputCls} placeholder="18" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Masa muscular</label>
              <input name="muscle_mass" type="number" step="0.1" className={inputCls} placeholder="35" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Pecho (cm)</label>
              <input name="chest_cm" type="number" step="0.1" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Cintura</label>
              <input name="waist_cm" type="number" step="0.1" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Cadera</label>
              <input name="hips_cm" type="number" step="0.1" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Brazo</label>
              <input name="arm_cm" type="number" step="0.1" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Pierna</label>
              <input name="leg_cm" type="number" step="0.1" className={inputCls} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Notas</label>
            <input name="notes" className={inputCls} placeholder="Opcional" />
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileInput.current?.click()} className="border border-line text-fg/60 hover:text-fg px-3 py-2 rounded-lg text-sm transition-colors">
              {photoUrl ? "✓ Foto subida" : "+ Subir foto"}
            </button>
            <input ref={fileInput} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            {photoUrl && (
              <Image src={photoUrl} alt="" width={40} height={40} className="rounded object-cover" unoptimized />
            )}
          </div>

          <button type="submit" disabled={pending} className="w-full bg-accent hover:bg-accent/80 text-white font-semibold rounded-lg py-2.5 text-sm disabled:opacity-50">
            {pending ? "Guardando..." : "Registrar medición"}
          </button>
        </form>
      )}

      {/* Progress history */}
      {progress.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-xl px-5 py-12 text-center text-fg/30 text-sm">
          Sin mediciones registradas
        </div>
      ) : (
        <div className="space-y-3">
          {progress.map((p) => (
            <div key={p.id} className="bg-white/5 border border-line rounded-xl p-4">
              <div className="flex justify-between items-start mb-3 gap-3">
                <p className="font-medium">{fmtDate(p.measured_at)}</p>
                <button onClick={() => handleDelete(p.id)} className="text-fg/30 hover:text-red-400 text-xs">
                  Eliminar
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm">
                {p.weight && <MetricCell label="Peso" value={`${p.weight} kg`} />}
                {p.body_fat && <MetricCell label="% Grasa" value={`${p.body_fat}%`} />}
                {p.muscle_mass && <MetricCell label="Músculo" value={`${p.muscle_mass} kg`} />}
                {p.chest_cm && <MetricCell label="Pecho" value={`${p.chest_cm} cm`} />}
                {p.waist_cm && <MetricCell label="Cintura" value={`${p.waist_cm} cm`} />}
                {p.hips_cm && <MetricCell label="Cadera" value={`${p.hips_cm} cm`} />}
                {p.arm_cm && <MetricCell label="Brazo" value={`${p.arm_cm} cm`} />}
                {p.leg_cm && <MetricCell label="Pierna" value={`${p.leg_cm} cm`} />}
              </div>

              {p.photo_url && (
                <Image src={p.photo_url} alt="" width={200} height={200} className="rounded-lg mt-3 object-cover max-h-64 w-auto" unoptimized />
              )}

              {p.notes && (
                <p className="text-fg/50 text-sm mt-2 italic">{p.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-fg/40 text-xs uppercase tracking-wider">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function SimpleChart({ data }: { data: Progress[] }) {
  if (data.length < 2) return null;

  const weights = data.map((d) => d.weight!);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const w = 200;
  const h = 60;
  const points = weights
    .map((v, i) => {
      const x = (i / (weights.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-32 h-12">
      <polyline points={points} fill="none" stroke="#e84b1f" strokeWidth="2" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: PAGOS
// ═══════════════════════════════════════════════════════════════════════════

const METHOD_COLORS: Record<string, string> = {
  transfer: "bg-blue-500/15 text-blue-400",
  cash: "bg-emerald-500/15 text-emerald-400",
  card: "bg-purple-500/15 text-purple-400",
  other: "bg-white/10 text-fg/40",
};
const METHOD_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  other: "Otro",
};

function PagosTab({ sales }: { sales: Sale[] }) {
  const totalPagado = sales.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Pagos totales" value={String(sales.length)} />
        <Stat label="Total pagado" value={fmtMoney(totalPagado)} accent />
      </div>

      {sales.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-xl px-5 py-12 text-center text-fg/30 text-sm">
          Sin pagos registrados
        </div>
      ) : (
        <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-fg/40 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Concepto</th>
                <th className="text-left px-4 py-3">Método</th>
                <th className="text-right px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3 text-fg/60">{s.sale_date}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p>{s.notes ?? "—"}</p>
                    {s.bank_reference && <p className="text-fg/30 text-xs">Ref: {s.bank_reference}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${METHOD_COLORS[s.payment_method] ?? "bg-white/10"}`}>
                      {METHOD_LABELS[s.payment_method] ?? s.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtMoney(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: MEMBRESÍAS
// ═══════════════════════════════════════════════════════════════════════════

function MembresiasTab({ memberships }: { memberships: Membership[] }) {
  if (memberships.length === 0) {
    return (
      <div className="bg-white/5 border border-line rounded-xl px-5 py-12 text-center text-fg/30 text-sm">
        Sin membresías registradas
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {memberships.map((m) => (
        <div key={m.id} className="bg-white/5 border border-line rounded-xl p-4 flex items-center gap-4">
          <div className="w-2 h-12 rounded-full shrink-0" style={{ background: m.plan_color }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{m.plan_name}</p>
            <p className="text-fg/40 text-xs">
              {m.start_date} → {m.end_date}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
              m.effective_status === "active" ? "bg-emerald-500/15 text-emerald-400" :
              m.effective_status === "expired" ? "bg-red-500/15 text-red-400" :
              "bg-white/10 text-fg/40"
            }`}>
              {m.effective_status === "active" ? "Activa" : m.effective_status === "expired" ? "Vencida" : m.effective_status}
            </span>
            <p className="text-sm font-semibold mt-1">{fmtMoney(m.paid_amount)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
