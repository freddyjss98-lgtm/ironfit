import Image from "next/image";
import { site } from "../content";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-bg pt-16 pb-10">
      <div className="container-x">
        <a
          href="#top"
          className="footer__big block hover:opacity-80 transition-opacity"
          aria-label="Volver al inicio"
        >
          <Image
            src="/logo/footer-brand.png"
            alt={`${site.brand} — confía en el proceso`}
            width={1080}
            height={830}
            className="mx-auto w-full max-w-md md:max-w-lg h-auto"
          />
        </a>

        <div className="mt-12 pt-8 border-t border-line grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <p className="t-mono-label text-fg-mute">
            © 2024–{year} {site.brand} · {site.city}
          </p>
          <p className="font-condensed text-fg-dim md:text-center">
            Enfócate en tu progreso, no en tus limitaciones.
          </p>
          <div className="flex gap-5 md:justify-end t-mono-label">
            <a
              href={site.instagramUrl}
              target="_blank"
              rel="noopener"
              className="text-fg-dim hover:text-accent"
            >
              Instagram
            </a>
            <a
              href={site.facebookUrl}
              target="_blank"
              rel="noopener"
              className="text-fg-dim hover:text-accent"
            >
              Facebook
            </a>
            <a
              href={`https://wa.me/${site.whatsappNumber}`}
              target="_blank"
              rel="noopener"
              className="text-fg-dim hover:text-accent"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
