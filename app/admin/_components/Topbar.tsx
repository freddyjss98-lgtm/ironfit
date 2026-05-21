"use client";

type Props = {
  title: string;
  onMenuClick: () => void;
};

export default function Topbar({ title, onMenuClick }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-line h-14 md:h-16 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={onMenuClick}
          className="md:hidden flex flex-col gap-1.5 justify-center items-center w-9 h-9 border border-line-2 hover:border-accent"
        >
          <span className="block w-4 h-px bg-fg" />
          <span className="block w-4 h-px bg-fg" />
          <span className="block w-4 h-px bg-fg" />
        </button>
        <h1 className="font-display text-xl md:text-2xl uppercase tracking-tight">
          {title}
        </h1>
      </div>
    </header>
  );
}
