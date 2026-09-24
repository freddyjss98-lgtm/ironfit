"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { createMember, updateMember, uploadMemberPhoto } from "./actions";
import { createMemberWithAccess, type AccessCredentials } from "./accessActions";

type Member = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  photo_url: string | null;
  gender: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  status: string;
};

type Props = {
  member?: Member;
  onClose: () => void;
};

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelCls = "text-fg/50 text-xs uppercase tracking-wider";

export default function MemberForm({ member, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(member?.photo_url ?? null);
  // Acceso al portal (solo al crear un socio nuevo)
  const [createAccess, setCreateAccess] = useState(false);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);
  const [createdPhone, setCreatedPhone] = useState("");
  const [createdName, setCreatedName] = useState("");

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        let photoUrl = member?.photo_url ?? "";
        if (photoFile) {
          photoUrl = await uploadMemberPhoto(photoFile, member?.id);
        }
        fd.set("photo_url", photoUrl);

        if (member) {
          const res = await updateMember(member.id, fd);
          if (!res.ok) { setError(res.error); return; }
          onClose();
        } else if (createAccess) {
          const res = await createMemberWithAccess(fd);
          if (!res.ok) { setError(res.error); return; }
          // No cerramos: mostramos las credenciales una sola vez.
          setCreatedPhone((fd.get("phone") as string) ?? "");
          setCreatedName((fd.get("full_name") as string) ?? "");
          setCredentials(res.credentials);
        } else {
          const res = await createMember(fd);
          if (!res.ok) { setError(res.error); return; }
          formRef.current?.reset();
          onClose();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  if (credentials) {
    return (
      <CredentialsPanel
        credentials={credentials}
        memberName={createdName}
        memberPhone={createdPhone}
        onClose={onClose}
      />
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Foto del atleta */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-white/5 border border-line flex items-center justify-center shrink-0">
          {photoPreview ? (
            <Image
              src={photoPreview}
              alt="Foto"
              width={64}
              height={64}
              unoptimized
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-fg/30 text-xl">📷</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Foto del atleta</label>
          <label className="cursor-pointer inline-flex items-center gap-2 text-xs text-fg/70 hover:text-fg border border-line hover:border-accent/40 rounded-lg px-3 py-2 transition-colors w-fit">
            {photoPreview ? "Cambiar foto" : "Subir foto"}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Nombre completo *</label>
          <input
            name="full_name"
            required
            defaultValue={member?.full_name}
            className={inputCls}
            placeholder="Ej. Carlos Rodríguez"
          />
        </div>

        {!member && (
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Cédula *</label>
            <input
              name="cedula"
              required
              inputMode="numeric"
              maxLength={10}
              pattern="\d{10}"
              className={inputCls}
              placeholder="10 dígitos"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Teléfono *</label>
          <input
            name="phone"
            required
            defaultValue={member?.phone}
            className={inputCls}
            placeholder="0999 123 456"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>
            Correo {createAccess && <span className="text-accent">*</span>}
          </label>
          <input
            name="email"
            type="email"
            required={createAccess}
            defaultValue={member?.email ?? ""}
            className={inputCls}
            placeholder={createAccess ? "será su usuario de acceso" : "opcional"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Fecha de nacimiento</label>
          <input
            name="birthday"
            type="date"
            defaultValue={member?.birthday ?? ""}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Género</label>
          <select name="gender" defaultValue={member?.gender ?? ""} className={inputCls}>
            <option value="">Sin especificar</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="other">Otro</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Contacto emergencia</label>
          <input
            name="emergency_contact_name"
            defaultValue={member?.emergency_contact_name ?? ""}
            className={inputCls}
            placeholder="Nombre"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Teléfono emergencia</label>
          <input
            name="emergency_contact_phone"
            defaultValue={member?.emergency_contact_phone ?? ""}
            className={inputCls}
            placeholder="0999 000 000"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Notas</label>
          <textarea
            name="notes"
            defaultValue={member?.notes ?? ""}
            rows={3}
            className={inputCls + " resize-none"}
            placeholder="Lesiones, observaciones..."
          />
        </div>
      </div>

      {/* Acceso al portal — solo al crear un socio nuevo */}
      {!member && (
        <label
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
            createAccess
              ? "border-accent/50 bg-accent/5"
              : "border-line hover:border-white/25"
          }`}
        >
          <input
            type="checkbox"
            checked={createAccess}
            onChange={(e) => setCreateAccess(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent shrink-0"
          />
          <span className="text-sm">
            <span className="font-medium text-fg">Crear acceso al portal</span>
            <span className="block text-fg/45 text-xs mt-0.5">
              Genera un usuario y una contraseña temporal para que el socio entre al
              portal y vea sus datos. Requiere correo. La cambiará en su primer ingreso.
            </span>
          </span>
        </label>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending
            ? "Guardando..."
            : member
            ? "Actualizar"
            : createAccess
            ? "Crear miembro y acceso"
            : "Crear miembro"}
        </button>
      </div>
    </form>
  );
}

// ── Panel de credenciales: se muestra una sola vez tras crear el acceso ──────────

function CredentialsPanel({
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
    (typeof window !== "undefined" ? window.location.origin : "https://www.ironfitclub.org") +
    "/portal/login";

  const firstName = memberName.trim().split(/\s+/)[0] || "";

  const message =
    `¡Hola ${firstName}! 💪 Ya tienes acceso al portal de *Iron Fit Club*.\n\n` +
    `Ingresa aquí: ${portalUrl}\n` +
    `Usuario: ${credentials.email}\n` +
    `Contraseña temporal: ${credentials.tempPassword}\n\n` +
    `Por seguridad, te pedirá crear tu propia contraseña la primera vez.`;

  function normalizePhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("593")
      ? digits
      : digits.startsWith("0")
      ? "593" + digits.slice(1)
      : "593" + digits;
  }

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
    <div className="flex flex-col gap-4">
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-300 text-sm">
        ✓ Socio creado con acceso al portal. Comparte estas credenciales{" "}
        <span className="font-semibold">ahora</span> — la contraseña no se vuelve a mostrar.
      </div>

      <div className="space-y-2">
        <CredRow label="Usuario (correo)" value={credentials.email} onCopy={() => copy(credentials.email, "Usuario")} />
        <CredRow
          label="Contraseña temporal"
          value={credentials.tempPassword}
          mono
          onCopy={() => copy(credentials.tempPassword, "Contraseña")}
        />
      </div>

      <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-line">
        <button
          type="button"
          onClick={() => copy(message, "Mensaje")}
          className="px-3 py-2 text-xs text-fg/60 hover:text-fg border border-line rounded-lg transition-colors"
        >
          Copiar mensaje
        </button>
        <button
          type="button"
          onClick={sendWhatsApp}
          className="px-4 py-2 text-xs font-bold bg-[#25d366] hover:bg-[#1fb855] text-white rounded-lg transition-colors"
        >
          Enviar por WhatsApp
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors"
        >
          Listo
        </button>
      </div>
    </div>
  );
}

function CredRow({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white/5 border border-line rounded-lg px-3 py-2.5">
      <div className="min-w-0">
        <p className={labelCls}>{label}</p>
        <p className={`text-fg text-sm truncate ${mono ? "font-mono tracking-wide" : ""}`}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 text-xs text-fg/60 hover:text-fg border border-line hover:border-accent/40 rounded-md px-2.5 py-1 transition-colors"
      >
        Copiar
      </button>
    </div>
  );
}
