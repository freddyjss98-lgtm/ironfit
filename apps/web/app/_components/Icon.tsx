// Íconos de línea monocromáticos (heredan currentColor). Indicadores sutiles, sin emojis.

import type { SVGProps } from "react";

const PATHS: Record<string, string> = {
  home: "M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1z",
  users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M17 4a3.5 3.5 0 0 1 0 7M21 20v-1a4 4 0 0 0-3-3.8",
  user: "M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 20a7 7 0 0 1 14 0",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M8.5 12.5l2.5 2.5 4.5-5",
  chart: "M4 4v16h16M8 14l3-3 2.5 2L18 8",
  activity: "M3 12h4l2.5 6 4-14L16 12h5",
  bag: "M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0",
  refresh: "M4 12a8 8 0 0 1 13.3-6M20 6v4h-4M20 12a8 8 0 0 1-13.3 6M4 18v-4h4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  card: "M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM2 10h20",
  bell: "M6 9a6 6 0 1 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6zM10 20a2 2 0 0 0 4 0",
  box: "M3 8l9-4 9 4v8l-9 4-9-4zM3 8l9 4 9-4M12 12v8",
  calendar: "M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 9h18M8 3v4M16 3v4",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const d = PATHS[name] ?? PATHS.home;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d={d} />
    </svg>
  );
}
