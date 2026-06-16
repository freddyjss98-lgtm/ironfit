import Image from "next/image";
import { updatePassword } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function CambiarClavePage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/logo/logo-horizontal.png"
            alt="Iron Fit Club"
            width={160}
            height={25}
            className="mx-auto mb-3"
          />
          <p className="text-white/40 text-sm">Crea tu contraseña</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-white text-xl font-semibold mb-2">Cambia tu contraseña</h1>
          <p className="text-white/50 text-sm mb-6">
            Tu acceso fue creado con una contraseña temporal. Define una propia para
            continuar.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-5">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={updatePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-sm" htmlFor="password">
                Nueva contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#e84b1f] transition-colors"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-sm" htmlFor="confirm">
                Repite la contraseña
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#e84b1f] transition-colors"
              />
            </div>

            <button
              type="submit"
              className="mt-2 bg-[#e84b1f] hover:bg-[#c73f1a] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              Guardar y continuar
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
