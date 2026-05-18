import Reveal from "./Reveal";
import { site } from "../content";

export default function Ubicacion() {
  return (
    <section
      id="ubicacion"
      className="py-24 md:py-[120px] bg-bg border-b border-line"
    >
      <div className="container-x grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-stretch">
        <div>
          <Reveal>
            <p className="t-eyebrow mb-6">05 · Ubicación</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="t-section">
              Frente a la <span className="text-accent">UNL</span>.
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-md text-fg-dim">{site.address}</p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 font-mono text-sm text-fg-mute">
              {site.coords.label}
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <a
              href={site.mapsUrl}
              target="_blank"
              rel="noopener"
              className="mt-8 inline-flex items-center gap-2 t-mono-label border border-line-2 px-5 py-3 hover:border-accent hover:text-accent transition-colors"
              data-cursor-label="Maps"
            >
              Abrir en Maps <span aria-hidden>↗</span>
            </a>
          </Reveal>
        </div>

        <Reveal variant="scale" delay={0.1}>
          <a
            href={site.mapsUrl}
            target="_blank"
            rel="noopener"
            data-cursor-label="Maps"
            className="group relative block aspect-[4/3] md:aspect-auto md:h-full min-h-[320px] border border-line bg-surface overflow-hidden"
            aria-label="Abrir ubicación en Google Maps"
          >
            <iframe
              src={`https://maps.google.com/maps?q=${site.coords.lat},${site.coords.lng}&z=18&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación Iron Fit Club"
              className="absolute inset-0 w-full h-full"
              style={{
                border: 0,
                filter: "invert(0.92) hue-rotate(180deg) saturate(0.75) brightness(0.95)",
              }}
            />
            <span
              className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-bg/40 via-transparent to-bg/20 mix-blend-multiply"
              aria-hidden
            />
            <span
              className="absolute bottom-4 right-4 t-mono-label bg-bg/80 backdrop-blur-sm border border-line-2 px-3 py-2 group-hover:border-accent group-hover:text-accent transition-colors"
              aria-hidden
            >
              Abrir en Maps ↗
            </span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
