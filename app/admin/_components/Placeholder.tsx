type Props = {
  title: string;
  description?: string;
};

export default function Placeholder({ title, description }: Props) {
  return (
    <div className="border border-line bg-surface p-8 md:p-12">
      <p className="t-mono-label text-accent mb-3">En construcción</p>
      <h2
        className="font-display uppercase tracking-tight leading-none mb-4"
        style={{ fontSize: "clamp(40px, 5vw, 72px)" }}
      >
        {title}
      </h2>
      {description && (
        <p className="text-fg-dim max-w-xl">{description}</p>
      )}
    </div>
  );
}
