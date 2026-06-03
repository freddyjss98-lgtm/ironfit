import { createClient } from "@/lib/supabase/server";
import EventosClient from "./EventosClient";

export default async function EventosPage() {
  const supabase = await createClient();

  // Fetch all events (gyms typically have few; filter on client)
  const { data } = await supabase
    .from("events")
    .select("id, title, description, event_date, start_time, end_time, location, max_capacity")
    .order("event_date")
    .order("start_time");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Eventos</h2>
        <p className="text-fg/40 text-sm mt-0.5">Gestión de eventos del gym</p>
      </div>
      <EventosClient events={data ?? []} />
    </div>
  );
}
