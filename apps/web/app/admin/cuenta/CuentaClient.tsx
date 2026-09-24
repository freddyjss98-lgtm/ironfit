"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMyAdminProfile, changeAdminPassword } from "./actions";

type Profile = { full_name: string; phone: string; email: string; role: string };

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  staff: "Staff",
};

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelMini = "text-fg/50 text-xs uppercase tracking-wider";

export default function CuentaClient({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const [showPwd, setShowPwd] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateMyAdminProfile(fd);
        toast.success("Datos actualizados");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  function handlePwd() {
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
        await changeAdminPassword(pwd);
        toast.success("Contraseña actualizada");
        setShowPwd(false);
        setPwd("");
        setConfirm("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cambiar");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Datos */}
      <form onSubmit={handleSave} className="bg-white/5 border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Mis datos</p>
          {profile.role && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-semibold">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className={labelMini}>Nombre</label>
            <input name="full_name" defaultValue={profile.full_name} className={inputCls} placeholder="Tu nombre" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Teléfono</label>
            <input name="phone" defaultValue={profile.phone} className={inputCls} placeholder="0999 000 000" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Correo</label>
            <input value={profile.email} readOnly className={inputCls + " opacity-60"} />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>

      {/* Contraseña */}
      <div className="bg-white/5 border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Contraseña</p>
            <p className="text-fg/40 text-xs mt-0.5">Cambia tu contraseña de acceso.</p>
          </div>
          <button
            onClick={() => setShowPwd((v) => !v)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            {showPwd ? "Cerrar" : "Cambiar"}
          </button>
        </div>

        {showPwd && (
          <div className="mt-4 space-y-3">
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
            <div className="flex justify-end">
              <button
                onClick={handlePwd}
                disabled={pending}
                className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {pending ? "Guardando..." : "Actualizar contraseña"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
