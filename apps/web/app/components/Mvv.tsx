import Reveal from "./Reveal";
import { mvv } from "../content";

export default function Mvv() {
  return (
    <section
      id="filosofia"
      className="py-24 md:py-[120px] bg-bg border-b border-line"
    >
      <div className="container-x">
        <Reveal>
          <p className="t-eyebrow mb-6">03 · Filosofía</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="t-section max-w-[18ch]">
            Por qué <span className="text-accent">existimos</span>.
          </h2>
        </Reveal>

        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <Reveal>
            <article className="mvv__card border border-line bg-surface p-8 md:p-10 h-full">
              <p className="t-mono-label text-accent mb-6">Misión</p>
              <h3 className="t-card mb-6">{mvv.mision.heading}</h3>
              <p className="text-fg-dim max-w-md">{mvv.mision.body}</p>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="mvv__card border border-line bg-surface p-8 md:p-10 h-full">
              <p className="t-mono-label text-accent mb-6">Visión</p>
              <h3 className="t-card mb-6">{mvv.vision.heading}</h3>
              <p className="text-fg-dim max-w-md">{mvv.vision.body}</p>
            </article>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="mt-12 md:mt-16">
          <p className="t-mono-label text-fg-mute mb-4">Valores</p>
          <p
            className="font-display leading-[0.95] tracking-tight"
            style={{ fontSize: "clamp(28px, 5vw, 72px)" }}
          >
            {mvv.valores.map((v, i) => (
              <span key={v}>
                {v}
                {i < mvv.valores.length - 1 && (
                  <span className="mx-3 md:mx-5 text-accent">×</span>
                )}
              </span>
            ))}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
