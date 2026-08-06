"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  trimClubRows,
  trimHouseRows,
  validateHousesClubsForm,
  type ClubFormRow,
  type HouseFormRow,
} from "@/lib/onboarding/houses-clubs";

type Result =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type HousesClubsStepData =
  | {
      success: true;
      housesEnabled: boolean;
      clubsEnabled: boolean;
      houses: HouseFormRow[];
      clubs: ClubFormRow[];
    }
  | { success: false; error: string };

export async function getHousesClubsStepDataAction(): Promise<HousesClubsStepData> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("houses_enabled, clubs_enabled")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError || !school) {
    return { success: false, error: schoolError?.message ?? "Could not load school." };
  }

  const [{ data: houses }, { data: clubs }] = await Promise.all([
    supabase
      .from("houses")
      .select("name")
      .eq("school_id", schoolId)
      .order("display_order", { ascending: true }),
    supabase
      .from("clubs")
      .select("name, description")
      .eq("school_id", schoolId)
      .order("display_order", { ascending: true }),
  ]);

  return {
    success: true,
    housesEnabled: school.houses_enabled,
    clubsEnabled: school.clubs_enabled,
    houses: (houses ?? []).map((row) => ({ name: row.name })),
    clubs: (clubs ?? []).map((row) => ({
      name: row.name,
      description: row.description ?? "",
    })),
  };
}

export async function saveHousesClubsAction(
  formData: FormData,
): Promise<Result> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  let houses: HouseFormRow[] = [];
  let clubs: ClubFormRow[] = [];
  try {
    houses = JSON.parse(String(formData.get("houses") ?? "[]")) as HouseFormRow[];
    clubs = JSON.parse(String(formData.get("clubs") ?? "[]")) as ClubFormRow[];
  } catch {
    return { success: false, error: "Could not read houses/clubs data." };
  }

  const housesEnabled = String(formData.get("housesEnabled") ?? "false") === "true";
  const clubsEnabled = String(formData.get("clubsEnabled") ?? "false") === "true";

  const fieldErrors = validateHousesClubsForm({
    housesEnabled,
    clubsEnabled,
    houses,
    clubs,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const trimmedHouses = housesEnabled ? trimHouseRows(houses).filter((row) => row.name) : [];
  const trimmedClubs = clubsEnabled
    ? trimClubRows(clubs).filter((row) => row.name)
    : [];

  const { error: schoolError } = await supabase
    .from("schools")
    .update({
      houses_enabled: housesEnabled,
      clubs_enabled: clubsEnabled,
      houses_clubs_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", schoolId);

  if (schoolError) {
    return { success: false, error: schoolError.message };
  }

  const { error: deleteHousesError } = await supabase
    .from("houses")
    .delete()
    .eq("school_id", schoolId);
  if (deleteHousesError) {
    return { success: false, error: deleteHousesError.message };
  }

  const { error: deleteClubsError } = await supabase
    .from("clubs")
    .delete()
    .eq("school_id", schoolId);
  if (deleteClubsError) {
    return { success: false, error: deleteClubsError.message };
  }

  if (trimmedHouses.length > 0) {
    const { error } = await supabase.from("houses").insert(
      trimmedHouses.map((row, index) => ({
        school_id: schoolId,
        name: row.name,
        display_order: index,
      })),
    );
    if (error) {
      return { success: false, error: error.message };
    }
  }

  if (trimmedClubs.length > 0) {
    const { error } = await supabase.from("clubs").insert(
      trimmedClubs.map((row, index) => ({
        school_id: schoolId,
        name: row.name,
        description: row.description || null,
        display_order: index,
      })),
    );
    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Houses & clubs saved." };
}
