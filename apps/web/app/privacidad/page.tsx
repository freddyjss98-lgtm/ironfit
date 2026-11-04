import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../_components/LegalPage";
import { site } from "../content";

export const metadata: Metadata = {
  title: "Política de privacidad — Iron Fit Club",
  description: "Qué datos recoge la app y la web de Iron Fit Club, para qué los usamos y cómo eliminarlos.",
  alternates: { canonical: "/privacidad" },
};

const wa = `https://wa.me/${site.whatsappNumber}`;

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad" updated="4 de noviembre de 2026">
      <p>
        Esta política explica qué datos personales recoge {site.brand} a través de su app móvil y de
        su sitio web (portal de socios), para qué los usa y qué derechos tienes. La aplicamos conforme a
        la Ley Orgánica de Protección de Datos Personales del Ecuador.
      </p>

      <h2>Responsable</h2>
      <p>
        {site.brand}, {site.address} Contacto: WhatsApp <a href={wa}>{site.whatsappDisplay}</a>.
      </p>

      <h2>Qué datos recogemos</h2>
      <ul>
        <li>
          <strong>Cuenta y ficha de socio:</strong> nombre, teléfono, correo, cédula, fecha de
          nacimiento, género, estatura, objetivo, contacto de emergencia y foto de perfil.
        </li>
        <li>
          <strong>Membresía y pagos:</strong> plan, fechas, pagos registrados y los comprobantes de
          transferencia que subes para renovar.
        </li>
        <li>
          <strong>Asistencia y reservas</strong> de clases.
        </li>
        <li>
          <strong>Entrenamiento y salud:</strong> resultados de los WOD, récords, rutinas y series,
          medidas corporales (peso, porcentaje de grasa, medidas) y tu meta de peso.
        </li>
        <li>
          <strong>Deportes:</strong> las actividades que registras (deporte, fecha, duración,
          distancia, desnivel y calorías).
        </li>
        <li>
          <strong>Ubicación:</strong> solo si usas «Grabar con GPS» y solo mientras la grabación está
          en curso, para medir la distancia y dibujar tu recorrido. La app pide el permiso «mientras se
          usa la app» y no usa tu ubicación fuera de una grabación. Guardamos el recorrido simplificado
          y sin los primeros y últimos 200 metros, para no mostrar dónde empiezas o terminas.
        </li>
        <li>
          <strong>Comunidad:</strong> lo que publicas (retos cumplidos, actividades, fotos y
          comentarios), tus reacciones, los reportes que haces y a quién bloqueas. Las fotos de un reto
          se borran automáticamente un día después de que el reto termina.
        </li>
        <li>
          <strong>Fotos y cámara:</strong> la app solo accede a la foto que tú eliges o tomas (perfil,
          comprobantes, retos) y puede guardar en tu galería las tarjetas que decides descargar. No
          lee el resto de tus fotos.
        </li>
        <li>
          <strong>Notificaciones:</strong> un identificador del dispositivo para enviarte avisos
          (membresía por vencer, renovación aprobada, retos nuevos).
        </li>
        <li>
          <strong>WhatsApp:</strong> los recordatorios que te enviamos y los mensajes que intercambias
          con nuestro asistente.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Gestionar tu membresía, pagos, reservas y asistencia.</li>
        <li>Mostrarte tu progreso, tus récords y tus actividades.</li>
        <li>Enviarte avisos sobre tu membresía y el gimnasio.</li>
        <li>
          Hacer funcionar la pizarra del box y la comunidad, y moderarla (revisamos los reportes en
          menos de 24 horas).
        </li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad.</p>

      <h2>Quién los ve</h2>
      <ul>
        <li>El personal del gimnasio (administración y coaches) ve tu ficha para atenderte.</li>
        <li>
          Los demás socios activos solo ven tu nombre con la inicial del apellido, tu foto de perfil y
          lo que tú publicas. En la pizarra puedes ocultarte desde tu perfil.
        </li>
        <li>
          Usamos proveedores que guardan o procesan los datos por nosotros: Supabase (base de datos y
          archivos), Vercel (sitio web), Expo (notificaciones y actualizaciones de la app) y Meta
          (mensajes de WhatsApp). Sus servidores pueden estar fuera del Ecuador.
        </li>
      </ul>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas tu cuenta. Si la eliminas, borramos tus datos personales, de entrenamiento,
        salud, actividades, rutas y publicaciones. Los registros contables (pagos, membresías y
        asistencias) se conservan sin tu nombre ni tus datos de contacto, porque la ley nos obliga a
        mantener la contabilidad.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedir acceso, corrección, eliminación o portabilidad de tus datos, u oponerte a su uso.
        Muchos datos los puedes corregir tú mismo desde tu perfil. Para el resto escríbenos por{" "}
        <a href={wa}>WhatsApp</a>. Para borrar tu cuenta mira{" "}
        <Link href="/eliminar-cuenta">cómo eliminar tu cuenta</Link>.
      </p>

      <h2>Seguridad</h2>
      <p>
        Los datos viajan cifrados, el acceso es con tu contraseña y cada socio solo puede ver y editar
        lo suyo.
      </p>

      <h2>Menores de edad</h2>
      <p>Si eres menor de 18 años, usa la app con la autorización de tu madre, padre o representante.</p>

      <h2>Cambios</h2>
      <p>
        Si cambiamos esta política, actualizaremos la fecha de arriba y te avisaremos en la app si el
        cambio es importante.
      </p>
    </LegalPage>
  );
}
