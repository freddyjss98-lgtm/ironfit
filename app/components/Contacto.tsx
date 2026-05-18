"use client";

import { useState, type FormEvent } from "react";
import Reveal from "./Reveal";
import { contacto, site } from "../content";

type Status = "idle" | "sent";

export default function Contacto() {
  const [status, setStatus] = useState<Status>("idle");
  const [whatsappUrl, setWhatsappUrl] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = (data.get("name") as string | null)?.trim() ?? "";
    const phone = (data.get("phone") as string | null)?.trim() ?? "";
    const goal = (data.get("goal") as string | null) ?? "";
    const msg = (data.get("msg") as string | null)?.trim() ?? "";

    if (!name || !phone) return;

    const text =
      `¡Hola Iron Fit Club! 💪%0A%0A` +
      `Quiero reservar mi *clase de prueba*.%0A%0A` +
      `• *Nombre:* ${encodeURIComponent(name)}%0A` +
      `• *WhatsApp:* ${encodeURIComponent(phone)}%0A` +
      `• *Objetivo:* ${encodeURIComponent(goal)}%0A` +
      (msg ? `• *Mensaje:* ${encodeURIComponent(msg)}%0A` : ``) +
      `%0AGracias!`;

    const url = `https://wa.me/${site.whatsappNumber}?text=${text}`;
    window.open(url, "_blank", "noopener");
    setWhatsappUrl(url);
    setStatus("sent");
  }

  return (
    <section
      id="contacto"
      className="py-24 md:py-[120px] bg-bg-2 border-b border-line"
    >
      <div className="container-x grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
        <div>
          <Reveal>
            <p className="t-eyebrow mb-6">06 · Contacto</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="t-section">
              {contacto.title}
              <br />
              <span className="text-accent">{contacto.subtitle}</span>
            </h2>
          </Reveal>

          <Reveal delay={0.15} className="mt-10 space-y-4">
            <ContactLink
              label="WhatsApp"
              value={site.whatsappDisplay}
              href={`https://wa.me/${site.whatsappNumber}`}
              cursorLabel="WhatsApp"
            />
            <ContactLink
              label="Instagram"
              value={site.instagramHandle}
              href={site.instagramUrl}
              cursorLabel="Instagram"
            />
            <ContactLink
              label="Facebook"
              value={site.facebookName}
              href={site.facebookUrl}
              cursorLabel="Facebook"
            />
            <p className="t-mono-label text-fg-mute pt-4">
              Fundado · {site.foundedDate}
            </p>
          </Reveal>
        </div>

        <Reveal variant="right" delay={0.1}>
          {status === "sent" ? (
            <div className="border border-line bg-surface p-8 md:p-10">
              <p className="t-mono-label text-accent mb-4">Listo ✓</p>
              <h3 className="t-card mb-4">Abrimos WhatsApp.</h3>
              <p className="text-fg-dim mb-6">
                Si no se abrió automáticamente, usa el botón.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 t-mono-label bg-accent text-bg px-5 py-3 hover:bg-accent-deep transition-colors"
              >
                Abrir WhatsApp <span aria-hidden>→</span>
              </a>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="ml-3 t-mono-label text-fg-dim hover:text-fg"
              >
                Volver al formulario
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="border border-line bg-surface p-6 md:p-8 space-y-5"
            >
              <Field label="Nombre" name="name" type="text" required />
              <Field label="WhatsApp" name="phone" type="tel" required />
              <SelectField label="Objetivo" name="goal" options={contacto.goalOptions} />
              <Field label="Mensaje (opcional)" name="msg" type="textarea" />
              <button
                type="submit"
                className="w-full t-mono-label bg-accent text-bg py-4 hover:bg-accent-deep transition-colors"
                style={{ boxShadow: "var(--shadow-accent-glow)" }}
                data-cursor-label="Enviar"
              >
                Reservar por WhatsApp →
              </button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}

function ContactLink({
  label,
  value,
  href,
  cursorLabel,
}: {
  label: string;
  value: string;
  href: string;
  cursorLabel: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="flex items-baseline justify-between gap-4 border-b border-line py-3 hover:border-accent group transition-colors"
      data-cursor-label={cursorLabel}
    >
      <span className="t-mono-label text-fg-mute">{label}</span>
      <span className="font-condensed text-lg md:text-2xl group-hover:text-accent transition-colors">
        {value}
      </span>
    </a>
  );
}

function Field({
  label,
  name,
  type,
  required,
}: {
  label: string;
  name: string;
  type: "text" | "tel" | "textarea";
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="t-mono-label text-fg-mute block mb-2">
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </span>
      {type === "textarea" ? (
        <textarea
          name={name}
          rows={3}
          className="w-full bg-transparent border border-line-2 px-4 py-3 font-body text-fg outline-none focus:border-accent transition-colors resize-none"
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          className="w-full bg-transparent border border-line-2 px-4 py-3 font-body text-fg outline-none focus:border-accent transition-colors"
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="t-mono-label text-fg-mute block mb-2">{label}</span>
      <select
        name={name}
        defaultValue={options[0]}
        className="w-full bg-bg border border-line-2 px-4 py-3 font-body text-fg outline-none focus:border-accent transition-colors appearance-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
