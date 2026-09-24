"use client";

import Reveal from "./Reveal";
import {
  Expandable,
  ExpandableContent,
  ExpandableTrigger,
  useExpandable,
} from "./cult/expandable";
import { servicios } from "../content";

export default function Servicios() {
  return (
    <section
      id="servicios"
      className="py-24 md:py-[120px] bg-bg border-b border-line"
    >
      <div className="container-x">
        <Reveal>
          <p className="t-eyebrow mb-6">01 · Servicios</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="t-section max-w-[14ch]">
            Entrena lo que <span className="text-accent">importa</span>.
          </h2>
        </Reveal>

        <ul className="mt-12 md:mt-16 border-t border-line">
          {servicios.map((s, i) => (
            <li key={s.title} className="service border-b border-line">
              <Expandable transitionDuration={0.35}>
                <ServiceRow index={i + 1} title={s.title} desc={s.desc} />
              </Expandable>
            </li>
          ))}
        </ul>

        <p className="t-mono-label text-fg-mute mt-8">
          Click en cada servicio para ver detalle.
        </p>
      </div>
    </section>
  );
}

function ServiceRow({
  index,
  title,
  desc,
}: {
  index: number;
  title: string;
  desc: string;
}) {
  const { isExpanded } = useExpandable();
  const idx = index.toString().padStart(2, "0");
  return (
    <>
      <ExpandableTrigger className="group relative overflow-hidden">
        <span
          className={`absolute inset-0 bg-accent origin-left transition-transform duration-500 ease-[cubic-bezier(0.8,0,0.2,1)] ${
            isExpanded ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
          }`}
          aria-hidden
        />
        <div
          className={`relative flex items-center gap-6 md:gap-10 py-6 md:py-8 transition-colors duration-300 ${
            isExpanded ? "text-bg" : "group-hover:text-bg"
          }`}
        >
          <span
            className={`t-mono-label w-10 ${
              isExpanded ? "text-bg/70" : "text-fg-mute group-hover:text-bg/70"
            }`}
          >
            {idx}
          </span>
          <h3
            className={`flex-1 font-display uppercase tracking-tight leading-none transition-transform duration-500 ${
              isExpanded ? "translate-x-3" : "group-hover:translate-x-3"
            }`}
            style={{ fontSize: "clamp(28px, 3vw, 44px)" }}
          >
            {title}
          </h3>
          <span
            className={`font-display text-2xl transition-transform duration-500 ${
              isExpanded
                ? "rotate-90 text-bg"
                : "text-fg-mute group-hover:text-bg group-hover:-rotate-45 group-hover:translate-x-2"
            }`}
            aria-hidden
          >
            →
          </span>
        </div>
      </ExpandableTrigger>

      <ExpandableContent>
        <div className="bg-accent text-bg px-6 md:px-16 py-6 md:py-8 border-t border-bg/10">
          <p className="font-body text-base md:text-lg max-w-xl">{desc}</p>
        </div>
      </ExpandableContent>
    </>
  );
}
