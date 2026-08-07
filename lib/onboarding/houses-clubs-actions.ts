"use server";

import { revalidatePath } from "next/cache";
import { syncClubsCatalogAction, listClubsAction } from "@/lib/config/clubs-actions";
import { syncHousesCatalogAction, listHousesAction } from "@/lib/config/houses-actions";
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

  const [housesResult, clubsResult] = await Promise.all([
    listHousesAction({ includeArchived: false }),
    listClubsAction({ includeArchived: false }),
  ]);

  if (!housesResult.success) {
    return { success: false, error: housesResult.error };
  }
  if (!clubsResult.success) {
    return { success: false, error: clubsResult.error };
  }

  return {
    success: true,
    housesEnabled: school.houses_enabled,
    clubsEnabled: school.clubs_enabled,
    houses: housesResult.houses.map((row) => ({ name: row.name })),
    clubs: clubsResult.clubs.map((row) => ({
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

  const { error: flagsError } = await supabase
    .from("schools")
    .update({
      houses_enabled: housesEnabled,
      clubs_enabled: clubsEnabled,
      houses_clubs_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", schoolId);

  if (flagsError) {
    return { success: false, error: flagsError.message };
  }

  const houseRows = housesEnabled ? trimHouseRows(houses).filter((row) => row.name) : [];
  const clubRows = clubsEnabled ? trimClubRows(clubs).filter((row) => row.name) : [];

  const housesResult = await syncHousesCatalogAction(houseRows, {
    requireAtLeastOne: housesEnabled,
    archiveMissing: true,
  });
  if (!housesResult.success) {
    return housesResult;
  }

  const clubsResult = await syncClubsCatalogAction(clubRows, {
    requireAtLeastOne: clubsEnabled,
    archiveMissing: true,
  });
  if (!clubsResult.success) {
    return clubsResult;
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Houses and clubs saved." };
}
