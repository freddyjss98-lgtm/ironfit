import Placeholder from "./_components/Placeholder";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Placeholder
        title="Dashboard"
        description="KPIs (MRR, atletas activos, churn, ingresos del día/mes) y alertas de membresías por vencer. Se conecta en paso 3, después de habilitar auth y queries a Supabase."
      />
    </div>
  );
}
