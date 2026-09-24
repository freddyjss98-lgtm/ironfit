"use client";

import { useState, type ReactNode } from "react";

export default function ProgresoTabs({ cuerpo, entreno }: { cuerpo: ReactNode; entreno: ReactNode }) {
  const [tab, setTab] = useState<"cuerpo" | "entreno">("cuerpo");

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-line">
        {([
          ["cuerpo", "Cuerpo"],
          ["entreno", "Entrenamiento"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === key ? "border-accent text-fg" : "border-transparent text-fg/40 hover:text-fg/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "cuerpo" ? cuerpo : entreno}
    </div>
  );
}
