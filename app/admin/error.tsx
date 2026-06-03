"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Admin Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 p-8">
      <div className="text-4xl">⚠️</div>
      <div className="text-center space-y-2">
        <h2 className="font-display text-xl uppercase tracking-tight text-red-400">
          Error al cargar la página
        </h2>
        <p className="text-fg/50 text-sm max-w-md">
          {error.message || "Ocurrió un error inesperado al cargar esta sección."}
        </p>
        {error.digest && (
          <p className="text-fg/30 text-xs font-mono">digest: {error.digest}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Reintentar
        </button>
        <a
          href="/admin"
          className="px-4 py-2 border border-line text-fg/60 hover:text-fg text-sm rounded-lg transition-colors"
        >
          Ir al Dashboard
        </a>
      </div>
    </div>
  );
}
