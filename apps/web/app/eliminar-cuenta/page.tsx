import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../_components/LegalPage";
import { site } from "../content";

// Google Play exige un enlace web para pedir la eliminación de la cuenta,
// incluso para quien ya desinstaló la app.
export const metadata: Metadata = {
  title: "Eliminar tu cuenta — Iron Fit Club",
  description: "Cómo eliminar tu cuenta de la app Iron Fit Club y qué datos se borran.",
  alternates: { canonical: "/eliminar-cuenta" },
};

const wa = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent("Hola, quiero eliminar mi cuenta de la app Iron Fit Club.")}`;

export default function EliminarCuentaPage() {
  return (
    <LegalPage title="Eliminar tu cuenta" updated="4 de noviembre de 2026">
      <p>
        Puedes eliminar tu cuenta de la app de {site.brand} cuando quieras. Elige la forma que te
        resulte más cómoda.
      </p>

      <h2>Desde la app</h2>
      <ul>
        <li>Abre la app e inicia sesión.</li>
        <li>Toca tu foto o tus iniciales, arriba a la derecha del inicio, para abrir tu perfil.</li>
        <li>Toca «Eliminar mi cuenta» y confirma.</li>
      </ul>
      <p>La cuenta se elimina en ese momento.</p>

      <h2>Si ya no tienes la app</h2>
      <p>
        Escríbenos por <a href={wa}>WhatsApp al {site.whatsappDisplay}</a> desde el número registrado
        en tu ficha, con el mensaje «Quiero eliminar mi cuenta». Confirmamos que eres tú y la
        eliminamos en un plazo máximo de 15 días.
      </p>

      <h2>Qué se borra</h2>
      <ul>
        <li>Tu acceso a la app y al portal.</li>
        <li>
          Tus datos personales: nombre, teléfono, correo, cédula, fecha de nacimiento, contacto de
          emergencia y foto.
        </li>
        <li>Tus medidas corporales, récords, resultados de WOD, rutinas y entrenamientos.</li>
        <li>Tus actividades y rutas del GPS.</li>
        <li>Tus publicaciones, fotos, reacciones y reportes en la comunidad.</li>
        <li>Tus conversaciones con el asistente de WhatsApp.</li>
      </ul>

      <h2>Qué se conserva</h2>
      <p>
        Los registros contables (pagos, membresías y asistencias) se conservan sin tu nombre ni tus
        datos de contacto, porque la ley nos obliga a mantener la contabilidad del negocio.
      </p>

      <p>
        Más detalles en nuestra <Link href="/privacidad">política de privacidad</Link>.
      </p>
    </LegalPage>
  );
}
