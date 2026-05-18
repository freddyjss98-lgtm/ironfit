import Image from "next/image";
import Reveal from "./Reveal";
import { BgAnimateButton } from "./cult/bg-animate-button";
import { hero } from "../content";

export default function Hero() {
  const slogan = hero.slogan.split(hero.sloganHighlight);
  return (
    <section
      id="top"
      className="relative pt-28 sm:pt-36 pb-24 sm:pb-32 overflow-hidden"
    >
      <video
        src="/video/hero.mp4"
        poster="/video/hero-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40"
        aria-hidden
      />
      <span
        className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/60 to-bg pointer-events-none"
        aria-hidden
      />
      <Image
        src="/logo/deer.png"
        alt=""
        width={880}
        height={1100}
        priority
        aria-hidden
        className="absolute top-20 right-4 sm:right-8 w-32 sm:w-44 lg:w-56 opacity-25 lg:opacity-20 pointer-events-none z-[1] mix-blend-screen"
      />
      <div className="container-x relative z-10">
        <div>
          <Reveal>
            <div className="flex flex-wrap gap-x-4 gap-y-1 t-eyebrow mb-8 sm:mb-10">
              {hero.meta.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <h1
              className="t-display"
              style={{ fontSize: "clamp(22px, 4vw, 70px)" }}
            >
              <span className="block">ENFÓCATE</span>
              <span className="block">
                <span className="text-stroke">EN TU </span>
                <span className="text-accent">PROGRESO</span>
                <span
                  className="inline-block text-accent"
                  style={{ transform: "skewX(-12deg)" }}
                  aria-hidden
                >
                  /
                </span>
              </span>
              <span className="block">NO EN TUS</span>
              <span className="block text-stroke">LIMITACIONES.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.15}>
            <p
              className="mt-8 sm:mt-10 max-w-xl font-condensed text-fg-dim"
              style={{ fontSize: "clamp(18px, 1.6vw, 22px)", lineHeight: 1.4 }}
            >
              {slogan[0]}
              <span className="text-fg">{hero.sloganHighlight}</span>
              {slogan[1]}
            </p>
          </Reveal>

          <Reveal delay={0.25}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <BgAnimateButton
                href={hero.ctas.primary.href}
                size="lg"
                tone="accent"
                gradient="ember"
                animation="spin"
                data-cursor-label="Reserva"
              >
                {hero.ctas.primary.label}
                <span aria-hidden>→</span>
              </BgAnimateButton>
              <a
                href={hero.ctas.secondary.href}
                className="t-mono-label inline-flex items-center gap-2 border border-line-2 px-6 py-4 hover:border-fg hover:text-fg transition-colors text-fg-dim"
              >
                {hero.ctas.secondary.label}
              </a>
            </div>
          </Reveal>
        </div>

      </div>
    </section>
  );
}
