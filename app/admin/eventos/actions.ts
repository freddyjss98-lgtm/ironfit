"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();

  const maxCap = formData.get("max_capacity") as string;
  const { error } = await supabase.from("events").insert({
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    event_date: formData.get("event_date") as string,
    start_time: (formData.get("start_time") as string) || null,
    end_time: (formData.get("end_time") as string) || null,
    location: (formData.get("location") as string) || null,
    max_capacity: maxCap ? parseInt(maxCap, 10) : null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/eventos");
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient();

  const maxCap = formData.get("max_capacity") as string;
  const { error } = await supabase
    .from("events")
    .update({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      event_date: formData.get("event_date") as string,
      start_time: (formData.get("start_time") as string) || null,
      end_time: (formData.get("end_time") as string) || null,
      location: (formData.get("location") as string) || null,
      max_capacity: maxCap ? parseInt(maxCap, 10) : null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/eventos");
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/eventos");
}
