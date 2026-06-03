"use client";

import { useRef, useState, useTransition } from "react";
import { createMember, updateMember } from "./actions";

type Member = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        if (member) {
          await updateMember(member.id, fd);
        } else {
          await createMember(fd);
          formRef.current?.reset();
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

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
          <label className={labelCls}>Correo</label>
          <input
            name="email"
            type="email"
            defaultValue={member?.email ?? ""}
            className={inputCls}
            placeholder="opcional"
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
          {pending ? "Guardando..." : member ? "Actualizar" : "Crear miembro"}
        </button>
      </div>
    </form>
  );
}
