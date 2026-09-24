import { redirect } from "next/navigation";

// Los pagos se fusionaron en la pantalla de Renovar (sección "Mis Pagos").
export default function PortalPagosRedirect() {
  redirect("/portal/renovar");
}
