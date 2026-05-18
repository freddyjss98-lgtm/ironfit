"use client";

import { useEffect, useRef, useState } from "react";

const HOVER_SELECTOR =
  "a, button, .service, .gallery__card, .mvv__card, .footer__big, [data-cursor]";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string>("");
  const [mode, setMode] = useState<"idle" | "hover" | "drag">("idle");

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    document.body.classList.add("cursor-active");

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { x: target.x, y: target.y };
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${target.x}px, ${target.y}px) translate(-50%, -50%)`;
      }
    };

    const loop = () => {
      ring.x += (target.x - ring.x) * 0.22;
      ring.y += (target.y - ring.y) * 0.22;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.x}px, ${ring.y}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const handleOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest(HOVER_SELECTOR);
      if (!el) {
        setMode("idle");
        setLabel("");
        return;
      }
      const cursorAttr = el.getAttribute("data-cursor");
      const labelAttr = el.getAttribute("data-cursor-label") ?? "";
      setLabel(labelAttr);
      setMode(cursorAttr === "drag" ? "drag" : "hover");
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", handleOver);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", handleOver);
      document.body.classList.remove("cursor-active");
    };
  }, []);

  const ringClass =
    mode === "hover"
      ? "cursor-ring cursor-ring--hover"
      : mode === "drag"
        ? "cursor-ring cursor-ring--drag"
        : "cursor-ring";

  return (
    <>
      <div
        ref={dotRef}
        className="cursor-dot"
        style={{ opacity: mode === "idle" ? 1 : 0 }}
        aria-hidden
      />
      <div ref={ringRef} className={ringClass} aria-hidden>
        {label && (
          <span className="absolute inset-0 flex items-center justify-center cursor-label">
            {label}
          </span>
        )}
      </div>
    </>
  );
}
