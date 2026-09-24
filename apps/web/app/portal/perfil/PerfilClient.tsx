"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PreviewBanner from "../_components/PreviewBanner";
import { uploadMyPhoto, updateMyProfile, changeMyPassword } from "./actions";

type Profile = {
  full_name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  photo_url: string | null;
  gender: string | null;
  height_cm: number | null;
  goal: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: string;
  created_at: string | null;
};

type Membership = {
  status: string;
  end_date: string | null;
  days_left: number | null;
  plan_name: string | null;
};

type Props = { isPreview: boolean; profile: Profile; membership: Membership };

const MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelMini = "text-fg/50 text-xs uppercase tracking-wider";

function fmtDateLong(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${d} de ${MES[m - 1]} ${y}`;
}

function fmtBirthday(s: string | null): string {
  if (!s) return "—";
  const [, m, d] = s.split("-").map(Number);
  if (!m || !d) return "—";
  return `${d} de ${MES[m - 1]}`;
}

function genderLabel(g: string | null): string {
  if (g === "M") return "Masculino";
  if (g === "F") return "Femenino";
  if (g === "other") return "Otro";
  return "—";
}

function Avatar({ name, url, size = 80 }: { name: string; url: string | null; size?: number }) {
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
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || "?"}
    </span>
  );
}

function MembershipBadge({ membership }: { membership: Membership }) {
  if (membership.status === "active") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
        {membership.plan_name ?? "Activa"}
        {membership.days_left != null ? ` · ${membership.days_left}d` : ""}
      </span>
    );
  }
  if (membership.status === "expired") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">
        Vencida
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-fg/40 font-semibold">
      Sin membresía
    </span>
  );
}

// ── Cambiar contraseña ────────────────────────────────────────────────────────
function PasswordPanel({ onClose }: { onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (pwd.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (pwd !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    startTransition(async () => {
      try {
        await changeMyPassword(pwd);
        toast.success("Contraseña actualizada");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cambiar");
      }
    });
  }

  return (
    <div className="bg-white/5 border border-line rounded-xl p-5 space-y-3">
      <p className="font-semibold text-sm">Cambiar contraseña</p>
      <div className="flex flex-col gap-1.5">
        <label className={labelMini}>Nueva contraseña</label>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          className={inputCls}
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelMini}>Confirmar contraseña</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputCls}
        />
      </div>
      <div className="flex gap-3 justify-end pt-1">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={pending}
          className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function PerfilClient({ isPreview, profile, membership }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile.photo_url);
  const [pending, startTransition] = useTransition();

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        let photoUrl = profile.photo_url ?? "";
        if (photoFile) photoUrl = await uploadMyPhoto(photoFile);
        fd.set("photo_url", photoUrl);
        await updateMyProfile(fd);
        toast.success("Perfil actualizado");
        setEditing(false);
        setPhotoFile(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {isPreview && <PreviewBanner memberName={profile.full_name} />}

      {/* Cabecera */}
      <div className="bg-white/5 border border-line rounded-2xl p-5 flex items-center gap-4">
        <div className="relative">
          <Avatar name={profile.full_name} url={editing ? photoPreview : profile.photo_url} />
          {editing && (
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center cursor-pointer text-sm shadow-lg">
              📷
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl truncate">{profile.full_name || "—"}</p>
          <div className="mt-1">
            <MembershipBadge membership={membership} />
          </div>
          {profile.created_at && (
            <p className="text-fg/30 text-xs mt-1.5">Socio desde {fmtDateLong(profile.created_at)}</p>
          )}
        </div>
      </div>

      {/* Vista o edición */}
      {!editing ? (
        <>
          <div className="bg-white/5 border border-line rounded-2xl divide-y divide-line/40">
            <Row label="Teléfono" value={profile.phone || "—"} />
            <Row label="Correo" value={profile.email || "—"} />
            <Row label="Cumpleaños" value={fmtBirthday(profile.birthday)} />
            <Row label="Género" value={genderLabel(profile.gender)} />
            <Row label="Estatura" value={profile.height_cm ? `${profile.height_cm} cm` : "—"} />
            <Row label="Objetivo" value={profile.goal || "—"} />
            <Row
              label="Contacto de emergencia"
              value={profile.emergency_contact_name || "—"}
            />
          </div>

          {!isPreview && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setEditing(true)}
                className="flex-1 bg-accent hover:bg-accent/80 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                Editar perfil
              </button>
              <button
                onClick={() => setShowPassword((v) => !v)}
                className="flex-1 border border-line hover:border-fg/40 text-fg/70 hover:text-fg font-medium py-2.5 rounded-xl transition-colors"
              >
                Cambiar contraseña
              </button>
            </div>
          )}

          {showPassword && !isPreview && (
            <PasswordPanel onClose={() => setShowPassword(false)} />
          )}
        </>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className={labelMini}>Nombre completo *</label>
              <input name="full_name" required defaultValue={profile.full_name} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Teléfono *</label>
              <input name="phone" required defaultValue={profile.phone} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Correo</label>
              <input name="email" type="email" defaultValue={profile.email ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Cumpleaños</label>
              <input name="birthday" type="date" defaultValue={profile.birthday ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Género</label>
              <select name="gender" defaultValue={profile.gender ?? ""} className={inputCls}>
                <option value="">Sin especificar</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Estatura (cm)</label>
              <input name="height_cm" type="number" step="0.1" defaultValue={profile.height_cm ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelMini}>Objetivo</label>
              <input name="goal" defaultValue={profile.goal ?? ""} className={inputCls} placeholder="Ej. bajar de peso" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className={labelMini}>Contacto de emergencia</label>
              <input
                name="emergency_contact_name"
                defaultValue={profile.emergency_contact_name ?? ""}
                className={inputCls}
                placeholder="Nombre y teléfono de un familiar"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setPhotoFile(null);
                setPhotoPreview(profile.photo_url);
              }}
              className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-6 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {pending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3">
      <span className="text-fg/40 text-xs uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
