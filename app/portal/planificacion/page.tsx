import { redirect } from "next/navigation";

// La planificación se fusionó en "Entrenamiento" (se muestra sobre las clases del día).
export default function PortalPlanificacionRedirect() {
  redirect("/portal/clases");
}
