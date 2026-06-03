import Link from "next/link";

/**
 * Shown at the top of every portal page when an admin is in preview mode.
 */
export default function PreviewBanner({ memberName }: { memberName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 mb-2">
      <div className="flex items-center gap-2 text-accent text-xs font-semibold flex-wrap">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Vista previa
        {memberName && (
          <span className="font-normal text-accent/70">— datos de {memberName}</span>
        )}
      </div>
      <Link
        href="/admin"
        className="shrink-0 text-xs font-semibold text-accent hover:text-white border border-accent/40 hover:bg-accent hover:border-accent px-3 py-1.5 rounded-lg transition-all"
      >
        ← Panel admin
      </Link>
    </div>
  );
}
