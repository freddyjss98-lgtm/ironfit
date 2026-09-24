import { redirect } from "next/navigation";

// Planificaciones se unió con Clases en una sola pantalla (sección "Entrenamiento").
export default function AdminPlanificacionesRedirect() {
  redirect("/admin/clases");
}
