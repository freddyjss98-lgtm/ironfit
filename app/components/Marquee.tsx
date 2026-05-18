import { marqueeItems } from "../content";

export default function Marquee() {
  const loop = [...marqueeItems, ...marqueeItems];
  return (
    <section
      className="border-y border-line bg-bg-2 py-6 overflow-hidden"
      aria-hidden
    >
      <div className="marquee-track flex items-center gap-10 whitespace-nowrap w-max">
        {loop.map((word, i) => (
          <span
            key={i}
            className="flex items-center gap-10 t-display"
            style={{ fontSize: "clamp(40px, 6vw, 88px)" }}
          >
            <span className={i % 2 === 1 ? "text-stroke" : ""}>{word}</span>
            <span className="text-accent text-2xl rotate-[8deg]">✦</span>
          </span>
        ))}
      </div>
    </section>
  );
}
