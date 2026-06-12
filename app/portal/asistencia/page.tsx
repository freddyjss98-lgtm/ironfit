import { redirect } from "next/navigation";

// La asistencia se fusionó en la pantalla de Progreso (pestaña "Asistencia").
export default function PortalAsistenciaRedirect() {
  redirect("/portal/progreso");
}
