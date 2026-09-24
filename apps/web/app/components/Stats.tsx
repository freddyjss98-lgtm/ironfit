import Reveal from "./Reveal";
import { AnimatedNumber } from "./cult/animated-number";
import { stats } from "../content";

export default function Stats() {
  return (
    <section className="border-b border-line">
      <div className="container-x grid grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => {
          const numeric = Number(s.number);
          const isNumeric = !Number.isNaN(numeric);
          return (
            <Reveal
              key={s.label}
              delay={i * 0.08}
              className="py-10 md:py-14 border-r last:border-r-0 border-line"
            >
              <div className="flex items-baseline gap-1">
                <span
                  className="font-display leading-none"
                  style={{ fontSize: "clamp(56px, 7vw, 112px)" }}
                >
                  {isNumeric ? <AnimatedNumber value={numeric} /> : s.number}
                </span>
                {s.sup && (
                  <span className="font-display text-accent text-2xl md:text-4xl">
                    {s.sup}
                  </span>
                )}
              </div>
              <p className="t-eyebrow mt-3">{s.label}</p>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
