import { signIn } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-white font-bold text-2xl tracking-widest uppercase">
            Iron Fit
          </span>
          <p className="text-white/40 text-sm mt-1">Panel de administración</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-white text-xl font-semibold mb-6">
            Iniciar sesión
          </h1>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-5">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={signIn} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next ?? "/admin"} />

            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-sm" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#e84b1f] transition-colors placeholder:text-white/20"
                placeholder="admin@ironfitclub.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-sm" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#e84b1f] transition-colors"
              />
            </div>

            <button
              type="submit"
              className="mt-2 bg-[#e84b1f] hover:bg-[#c73f1a] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>

        <p className="text-white/20 text-xs text-center mt-6">
          Iron Fit Club · Solo personal autorizado
        </p>
      </div>
    </main>
  );
}
