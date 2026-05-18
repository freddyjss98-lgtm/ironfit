import Reveal from "./Reveal";
import { horarios } from "../content";

export default function Horarios() {
  return (
    <section
      id="horarios"
      className="py-24 md:py-[120px] bg-bg-2 border-b border-line"
    >
      <div className="container-x grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 md:gap-20">
        <div>
          <Reveal>
            <p className="t-eyebrow mb-6">02 · Horarios</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="t-section">
              Aquí cuando <span className="text-accent">tú</span> puedas.
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-sm text-fg-dim">
              Dos bloques al día durante la semana. Sábado por la mañana.
              Domingo cerrado — descansa, comes bien, vuelves el lunes.
            </p>
          </Reveal>
        </div>

        <Reveal variant="right" delay={0.1}>
          <div className="border border-line">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] t-mono-label text-fg-mute border-b border-line px-4 md:px-6 py-3">
              <span>Día</span>
              <span>AM</span>
              <span>PM</span>
            </div>
            {horarios.map((h, i) => (
              <div
                key={h.day}
                className={`grid grid-cols-[1.4fr_1fr_1fr] px-4 md:px-6 py-5 md:py-6 ${
                  i < horarios.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <span className="font-condensed text-lg md:text-xl">{h.day}</span>
                <span className="font-mono text-sm md:text-base text-fg">
                  {h.am}
                </span>
                <span className="font-mono text-sm md:text-base text-fg-dim">
                  {h.pm}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
