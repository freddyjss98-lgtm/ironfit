import Image from "next/image";
import Link from "next/link";
import { registerMember } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string; confirm?: string }>;
}

export default async function RegisterPage({ searchParams }: Props) {
  const { error, confirm } = await searchParams;

  if (confirm) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <Image
            src="/logo/logo-horizontal.png"
            alt="Iron Fit Club"
            width={140}
            height={42}
            className="mx-auto mb-6"
          />
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8">
            <p className="text-2xl mb-2">✉️</p>
            <h1 className="text-white text-lg font-semibold mb-2">Revisa tu correo</h1>
            <p className="text-white/50 text-sm">
              Te enviamos un enlace de confirmación. Haz clic en él y luego
              inicia sesión.
            </p>
          </div>
          <Link
            href="/portal/login"
            className="inline-block text-sm text-white/40 hover:text-white transition-colors"
          >
            Ir al inicio de sesión →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/logo/logo-horizontal.png"
            alt="Iron Fit Club"
            width={140}
            height={42}
            className="mx-auto mb-3"
          />
          <p className="text-white/40 text-sm">Crea tu cuenta de atleta</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-white text-xl font-semibold mb-6">Registrarse</h1>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-5">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={registerMember} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-sm" htmlFor="full_name">
                Nombre completo *
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                autoComplete="name"
                className="bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#e84b1f] transition-colors placeholder:text-white/20"
                placeholder="Ej. Carlos Rodríguez"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-sm" htmlFor="phone">
                Teléfono *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                className="bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#e84b1f] transition-colors placeholder:text-white/20"
                placeholder="0999 123 456"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-sm" htmlFor="email">
                Correo electrónico *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#e84b1f] transition-colors placeholder:text-white/20"
                placeholder="tu@correo.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-sm" htmlFor="password">
                Contraseña *
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

            <button
              type="submit"
              className="mt-2 bg-[#e84b1f] hover:bg-[#c73f1a] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              Crear cuenta
            </button>
          </form>
        </div>

        <p className="text-white/30 text-sm text-center mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/portal/login" className="text-white/60 hover:text-white underline transition-colors">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
