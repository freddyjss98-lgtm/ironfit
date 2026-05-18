"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Reveal from "./Reveal";
import { gallery } from "../content";

const ASPECT_CLASS: Record<string, string> = {
  "3/4": "aspect-[3/4]",
  "3/5": "aspect-[3/5]",
  "4/3": "aspect-[4/3]",
};

export default function Galeria() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ dragging: false, startX: 0, scrollStart: 0 });
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      stateRef.current.dragging = true;
      stateRef.current.startX = e.clientX;
      stateRef.current.scrollStart = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      setGrabbing(true);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!stateRef.current.dragging) return;
      const dx = e.clientX - stateRef.current.startX;
      el.scrollLeft = stateRef.current.scrollStart - dx;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!stateRef.current.dragging) return;
      stateRef.current.dragging = false;
      el.releasePointerCapture(e.pointerId);
      setGrabbing(false);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0 || e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaX || e.deltaY;
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <section
      id="galeria"
      className="py-24 md:py-[120px] bg-bg-2 border-b border-line overflow-hidden"
    >
      <div className="container-x mb-10 md:mb-14 flex items-end justify-between gap-6">
        <div>
          <Reveal>
            <p className="t-eyebrow mb-6">04 · Galería</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="t-section">
              Comunidad <span className="text-accent">en acción</span>.
            </h2>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <span className="t-mono-label text-fg-mute hidden md:inline">
            ← Arrastra para explorar →
          </span>
        </Reveal>
      </div>

      <div
        ref={trackRef}
        data-cursor="drag"
        data-cursor-label="Drag"
        className={`flex gap-4 md:gap-6 overflow-x-auto px-[var(--pad-x)] pb-4 select-none ${
          grabbing ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          scrollSnapType: "x proximity",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {gallery.map((g, i) => (
          <div
            key={i}
            className={`gallery__card relative shrink-0 ${ASPECT_CLASS[g.aspect]} bg-surface border border-line`}
            style={{ width: g.width, scrollSnapAlign: "start" }}
          >
            <Image
              src={g.src}
              alt={g.alt}
              fill
              sizes="(min-width: 768px) 480px, 80vw"
              className="object-cover pointer-events-none"
              draggable={false}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
