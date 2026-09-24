"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createSchedule(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("class_schedules").insert({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    day_of_week: parseInt(formData.get("day_of_week") as string, 10),
    start_time: formData.get("start_time") as string,
    end_time: formData.get("end_time") as string,
    max_capacity: parseInt(formData.get("max_capacity") as string, 10),
    coach_id: (formData.get("coach_id") as string) || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/clases");
}

export async function updateSchedule(id: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_schedules")
    .update({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      day_of_week: parseInt(formData.get("day_of_week") as string, 10),
      start_time: formData.get("start_time") as string,
      end_time: formData.get("end_time") as string,
      max_capacity: parseInt(formData.get("max_capacity") as string, 10),
      coach_id: (formData.get("coach_id") as string) || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/clases");
}

export async function toggleScheduleActive(id: string, current: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_schedules")
    .update({ active: !current })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/clases");
}

export async function updateCoachOnSchedule(id: string, coachId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_schedules")
    .update({ coach_id: coachId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clases");
}

export async function deleteSchedule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("class_schedules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clases");
}

export async function createCoach(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("coaches").insert({
    full_name: formData.get("full_name") as string,
    phone: (formData.get("phone") as string) || null,
    specialty: (formData.get("specialty") as string) || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/clases");
}
