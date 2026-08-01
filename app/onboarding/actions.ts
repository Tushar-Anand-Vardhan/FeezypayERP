"use server";

import { revalidatePath } from "next/cache";
import { validateEmail } from "@/lib/auth/validation";
import { getActiveAcademicYearForSchool } from "@/lib/onboarding/academic-year-server";
import {
  getActiveYearClassesForSchool,
  verifyOwnedClassIds,
} from "@/lib/onboarding/school-classes-server";
import {
  validateClassRows,
  type ClassFormRow,
} from "@/lib/onboarding/classes";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  BOARD_OPTIONS,
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_BYTES,
  trimSchoolIdentityValues,
  type BoardOption,
  type SchoolIdentityFormValues,
} from "@/lib/onboarding/school-identity";
import {
  trimSectionRows,
  validateSectionsByClass,
  type ClassSectionsFormRow,
} from "@/lib/onboarding/sections";
import {
  trimTermRows,
  validateTermsForm,
  type TermFormRow,
} from "@/lib/onboarding/terms";

type SchoolIdentityActionResult =
  | { success: true; message: string; logoPath?: string | null }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

type TermsStepDataResult =
  | {
      success: true;
      blocked: true;
    }
  | {
      success: true;
      blocked: false;
      academicYearLabel: string;
      whatsappReportFollowsTerms: boolean;
      terms: TermFormRow[];
    }
  | { success: false; error: string };

type SaveTermsActionResult =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

type ClassesStepDataResult =
  | {
      success: true;
      blocked: true;
    }
  | {
      success: true;
      blocked: false;
      academicYearLabel: string;
      classes: ClassFormRow[];
      sectionCountByClassId: Record<string, number>;
    }
  | { success: false; error: string };

type SaveClassesActionResult =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

type SectionsStepDataResult =
  | {
      success: true;
      blocked: true;
    }
  | {
      success: true;
      blocked: false;
      academicYearLabel: string;
      classes: Array<{
        id: string;
        name: string;
        capacity: string;
        sections: Array<{ name: string }>;
      }>;
    }
  | { success: false; error: string };

type SaveSectionsActionResult =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return null;
  }
}

function validateServerSchoolIdentityForm(
  values: SchoolIdentityFormValues,
  hasLogoFile: boolean,
) {
  const trimmed = trimSchoolIdentityValues(values);
  const fieldErrors: Record<string, string> = {};

  if (!trimmed.name) fieldErrors.name = "School name is required.";
  if (!trimmed.addressStreet) fieldErrors.addressStreet = "Street address is required.";
  if (!trimmed.addressCity) fieldErrors.addressCity = "City is required.";
  if (!trimmed.addressState) fieldErrors.addressState = "State is required.";
  if (!trimmed.addressPincode) fieldErrors.addressPincode = "Pincode is required.";

  const emailError = validateEmail(trimmed.contactEmail);
  if (emailError) fieldErrors.contactEmail = emailError;

  if (!trimmed.contactPhone) {
    fieldErrors.contactPhone = "Contact phone is required.";
  } else if (!/^[\d\s+\-()]{10,15}$/.test(trimmed.contactPhone)) {
    fieldErrors.contactPhone =
      "Enter a valid phone number (10–15 digits, spaces, +, -, or parentheses allowed).";
  }

  if (!trimmed.board || !BOARD_OPTIONS.includes(trimmed.board as BoardOption)) {
    fieldErrors.board = "Board is required.";
  }

  const month = Number(trimmed.academicYearStartMonth);
  if (!trimmed.academicYearStartMonth || Number.isNaN(month) || month < 1 || month > 12) {
    fieldErrors.academicYearStartMonth = "Academic year start month is required.";
  }

  if (hasLogoFile) {
    // File type and size are validated again when reading FormData below.
  }

  return { trimmed, fieldErrors };
}

export async function saveSchoolIdentityAction(
  formData: FormData,
): Promise<SchoolIdentityActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const values: SchoolIdentityFormValues = {
    name: String(formData.get("name") ?? ""),
    addressStreet: String(formData.get("addressStreet") ?? ""),
    addressCity: String(formData.get("addressCity") ?? ""),
    addressState: String(formData.get("addressState") ?? ""),
    addressPincode: String(formData.get("addressPincode") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    board: String(formData.get("board") ?? "") as BoardOption | "",
    affiliationNumber: String(formData.get("affiliationNumber") ?? ""),
    academicYearStartMonth: String(formData.get("academicYearStartMonth") ?? ""),
  };

  const logoFile = formData.get("logo");
  const hasLogoFile = logoFile instanceof File && logoFile.size > 0;

  const { trimmed, fieldErrors } = validateServerSchoolIdentityForm(values, hasLogoFile);
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  let logoPath: string | null | undefined;

  if (hasLogoFile && logoFile instanceof File) {
    if (
      !LOGO_ALLOWED_MIME_TYPES.includes(
        logoFile.type as (typeof LOGO_ALLOWED_MIME_TYPES)[number],
      )
    ) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: { logo: "Logo must be a JPEG, PNG, WebP, or GIF image." },
      };
    }

    if (logoFile.size > LOGO_MAX_BYTES) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: { logo: "Logo must be 2 MB or smaller." },
      };
    }

    const extension = extensionForMimeType(logoFile.type);
    if (!extension) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: { logo: "Logo must be a JPEG, PNG, WebP, or GIF image." },
      };
    }

    const objectPath = `${schoolId}/logo.${extension}`;
    const fileBuffer = Buffer.from(await logoFile.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("school-logos")
      .upload(objectPath, fileBuffer, {
        contentType: logoFile.type,
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: uploadError.message,
      };
    }

    logoPath = objectPath;
  }

  const updatePayload: Record<string, string | number | null> = {
    name: trimmed.name,
    address_street: trimmed.addressStreet,
    address_city: trimmed.addressCity,
    address_state: trimmed.addressState,
    address_pincode: trimmed.addressPincode,
    contact_phone: trimmed.contactPhone,
    contact_email: trimmed.contactEmail,
    board: trimmed.board,
    affiliation_number: trimmed.affiliationNumber || null,
    academic_year_start_month: Number(trimmed.academicYearStartMonth),
    updated_at: new Date().toISOString(),
  };

  if (logoPath) {
    updatePayload.logo_path = logoPath;
  }

  const { error: updateError } = await supabase
    .from("schools")
    .update(updatePayload)
    .eq("id", schoolId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/onboarding", "layout");

  return {
    success: true,
    message: "School identity saved successfully.",
    logoPath: logoPath ?? null,
  };
}

export async function getTermsStepDataAction(): Promise<TermsStepDataResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("academic_year_start_month, whatsapp_report_follows_terms")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError || !school) {
    return { success: false, error: "We could not load your school details." };
  }

  if (!school.academic_year_start_month) {
    return { success: true, blocked: true };
  }

  const academicYearResult = await getActiveAcademicYearForSchool(
    supabase,
    schoolId,
    school.academic_year_start_month,
  );

  if ("error" in academicYearResult) {
    return { success: false, error: academicYearResult.error };
  }

  const { data: terms, error: termsError } = await supabase
    .from("terms")
    .select("name, start_date, end_date")
    .eq("academic_year_id", academicYearResult.academicYear.id)
    .order("start_date", { ascending: true });

  if (termsError) {
    return { success: false, error: termsError.message };
  }

  return {
    success: true,
    blocked: false,
    academicYearLabel: academicYearResult.academicYear.label,
    whatsappReportFollowsTerms: school.whatsapp_report_follows_terms,
    terms: (terms ?? []).map((term) => ({
      name: term.name,
      startDate: term.start_date,
      endDate: term.end_date,
    })),
  };
}

export async function saveTermsAction(
  formData: FormData,
): Promise<SaveTermsActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("academic_year_start_month")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError || !school?.academic_year_start_month) {
    return {
      success: false,
      error: "Complete School Identity first to set your academic year.",
    };
  }

  const academicYearResult = await getActiveAcademicYearForSchool(
    supabase,
    schoolId,
    school.academic_year_start_month,
  );

  if ("error" in academicYearResult) {
    return { success: false, error: academicYearResult.error };
  }

  let rows: TermFormRow[] = [];

  try {
    rows = JSON.parse(String(formData.get("terms") ?? "[]")) as TermFormRow[];
  } catch {
    return { success: false, error: "Could not read the submitted term data." };
  }

  const trimmedRows = trimTermRows(Array.isArray(rows) ? rows : []);
  const fieldErrors = validateTermsForm(trimmedRows);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const whatsappReportFollowsTerms =
    String(formData.get("whatsappReportFollowsTerms") ?? "true") === "true";

  const { error: deleteError } = await supabase
    .from("terms")
    .delete()
    .eq("academic_year_id", academicYearResult.academicYear.id);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  if (trimmedRows.length > 0) {
    const { error: insertError } = await supabase.from("terms").insert(
      trimmedRows.map((row) => ({
        academic_year_id: academicYearResult.academicYear.id,
        name: row.name,
        start_date: row.startDate,
        end_date: row.endDate,
      })),
    );

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  const { error: schoolUpdateError } = await supabase
    .from("schools")
    .update({
      whatsapp_report_follows_terms: whatsappReportFollowsTerms,
      updated_at: new Date().toISOString(),
    })
    .eq("id", schoolId);

  if (schoolUpdateError) {
    return { success: false, error: schoolUpdateError.message };
  }

  revalidatePath("/onboarding", "layout");

  return {
    success: true,
    message: "Term structure saved successfully.",
  };
}

export async function getClassesStepDataAction(): Promise<ClassesStepDataResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("academic_year_start_month")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError || !school?.academic_year_start_month) {
    return { success: true, blocked: true };
  }

  const academicYearResult = await getActiveAcademicYearForSchool(
    supabase,
    schoolId,
    school.academic_year_start_month,
    { createIfMissing: false },
  );

  if ("error" in academicYearResult) {
    return { success: false, error: academicYearResult.error };
  }

  if ("missing" in academicYearResult) {
    return { success: true, blocked: true };
  }

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("academic_year_id", academicYearResult.academicYear.id)
    .order("display_order", { ascending: true });

  if (classesError) {
    return { success: false, error: classesError.message };
  }

  const classRows = classes ?? [];
  const classIds = classRows.map((row) => row.id);
  const sectionCountByClassId: Record<string, number> = {};

  if (classIds.length > 0) {
    const { data: sectionRows, error: sectionsError } = await supabase
      .from("sections")
      .select("class_id")
      .in("class_id", classIds);

    if (sectionsError) {
      return { success: false, error: sectionsError.message };
    }

    for (const section of sectionRows ?? []) {
      sectionCountByClassId[section.class_id] =
        (sectionCountByClassId[section.class_id] ?? 0) + 1;
    }
  }

  return {
    success: true,
    blocked: false,
    academicYearLabel: academicYearResult.academicYear.label,
    classes: classRows.map((row) => ({
      id: row.id,
      name: row.name,
    })),
    sectionCountByClassId,
  };
}

export async function saveClassesAction(
  formData: FormData,
): Promise<SaveClassesActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("academic_year_start_month")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError || !school?.academic_year_start_month) {
    return {
      success: false,
      error: "Complete Term Structure first.",
    };
  }

  const academicYearResult = await getActiveAcademicYearForSchool(
    supabase,
    schoolId,
    school.academic_year_start_month,
    { createIfMissing: false },
  );

  if ("error" in academicYearResult) {
    return { success: false, error: academicYearResult.error };
  }

  if ("missing" in academicYearResult) {
    return {
      success: false,
      error: "Complete Term Structure first.",
    };
  }

  let rows: ClassFormRow[] = [];

  try {
    rows = JSON.parse(String(formData.get("classes") ?? "[]")) as ClassFormRow[];
  } catch {
    return { success: false, error: "Could not read the submitted class data." };
  }

  if (!Array.isArray(rows)) {
    return { success: false, error: "Could not read the submitted class data." };
  }

  const normalizedRows: ClassFormRow[] = rows.map((row) => ({
    id: typeof row.id === "string" && row.id ? row.id : undefined,
    name: String(row.name ?? "").trim(),
  }));

  const intent = String(formData.get("intent") ?? "save");
  const fieldErrors = validateClassRows(normalizedRows, {
    requireAtLeastOne: intent === "next",
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const academicYearId = academicYearResult.academicYear.id;

  const { data: existingClasses, error: existingClassesError } = await supabase
    .from("classes")
    .select("id, name, display_order")
    .eq("academic_year_id", academicYearId);

  if (existingClassesError) {
    return { success: false, error: existingClassesError.message };
  }

  const existingById = new Map(
    (existingClasses ?? []).map((row) => [row.id, row]),
  );

  for (const row of normalizedRows) {
    if (row.id && !existingById.has(row.id)) {
      return {
        success: false,
        error: "One or more classes are not in your school.",
      };
    }
  }

  const keptClassIds = new Set<string>();

  for (const [index, row] of normalizedRows.entries()) {
    if (row.id && existingById.has(row.id)) {
      const existing = existingById.get(row.id)!;
      if (existing.name !== row.name || existing.display_order !== index) {
        const { error: updateError } = await supabase
          .from("classes")
          .update({
            name: row.name,
            display_order: index,
          })
          .eq("id", row.id)
          .eq("academic_year_id", academicYearId);

        if (updateError) {
          return { success: false, error: updateError.message };
        }
      }

      keptClassIds.add(row.id);
      continue;
    }

    const { data: insertedClass, error: insertError } = await supabase
      .from("classes")
      .insert({
        academic_year_id: academicYearId,
        name: row.name,
        display_order: index,
      })
      .select("id")
      .single();

    if (insertError || !insertedClass) {
      return {
        success: false,
        error: insertError?.message ?? "Could not save a new class.",
      };
    }

    keptClassIds.add(insertedClass.id);
  }

  const classIdsToDelete = (existingClasses ?? [])
    .map((row) => row.id)
    .filter((id) => !keptClassIds.has(id));

  if (classIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("classes")
      .delete()
      .in("id", classIdsToDelete)
      .eq("academic_year_id", academicYearId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }
  }

  revalidatePath("/onboarding", "layout");

  return {
    success: true,
    message: "Classes saved successfully.",
  };
}

export async function getSectionsStepDataAction(): Promise<SectionsStepDataResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);

  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }

  if ("blocked" in classesResult) {
    return { success: true, blocked: true };
  }

  const classIds = classesResult.classes.map((row) => row.id);

  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select("class_id, name, display_order")
    .in("class_id", classIds)
    .order("display_order", { ascending: true });

  if (sectionsError) {
    return { success: false, error: sectionsError.message };
  }

  const sectionsByClassId = new Map<string, Array<{ name: string }>>();

  for (const classId of classIds) {
    sectionsByClassId.set(classId, []);
  }

  for (const section of sections ?? []) {
    const rows = sectionsByClassId.get(section.class_id);
    if (!rows) {
      continue;
    }

    rows.push({
      name: section.name,
    });
  }

  return {
    success: true,
    blocked: false,
    academicYearLabel: classesResult.academicYear.label,
    classes: classesResult.classes.map((classRow) => ({
      id: classRow.id,
      name: classRow.name,
      capacity:
        classRow.capacity === null || classRow.capacity === undefined
          ? ""
          : String(classRow.capacity),
      sections: sectionsByClassId.get(classRow.id) ?? [],
    })),
  };
}

export async function saveSectionsAction(
  formData: FormData,
): Promise<SaveSectionsActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);

  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }

  if ("blocked" in classesResult) {
    return { success: false, error: "Complete Classes first." };
  }

  let payload: ClassSectionsFormRow[] = [];

  try {
    payload = JSON.parse(
      String(formData.get("sectionsByClass") ?? "[]"),
    ) as ClassSectionsFormRow[];
  } catch {
    return { success: false, error: "Could not read the submitted section data." };
  }

  if (!Array.isArray(payload)) {
    return { success: false, error: "Could not read the submitted section data." };
  }

  const submittedClassIds = payload.map((row) => row.classId);
  const ownershipResult = await verifyOwnedClassIds(
    supabase,
    classesResult.academicYear.id,
    submittedClassIds,
  );

  if ("error" in ownershipResult) {
    return { success: false, error: ownershipResult.error };
  }

  const payloadByClassId = new Map(
    payload.map((row) => [
      row.classId,
      {
        capacity: String(row.capacity ?? "").trim(),
        sections: trimSectionRows(Array.isArray(row.sections) ? row.sections : []),
      },
    ]),
  );

  const normalizedPayload: ClassSectionsFormRow[] = classesResult.classes.map(
    (classRow) => ({
      classId: classRow.id,
      capacity: payloadByClassId.get(classRow.id)?.capacity ?? "",
      sections: payloadByClassId.get(classRow.id)?.sections ?? [],
    }),
  );

  const intent = String(formData.get("intent") ?? "save");
  const fieldErrors = validateSectionsByClass(normalizedPayload, {
    requireEveryClassHasSection: intent === "next",
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  for (const classRow of classesResult.classes) {
    const classPayload = payloadByClassId.get(classRow.id) ?? {
      capacity: "",
      sections: [],
    };
    const sections = classPayload.sections;
    const capacityValue = classPayload.capacity;

    const { error: capacityUpdateError } = await supabase
      .from("classes")
      .update({
        capacity: capacityValue ? Number(capacityValue) : null,
      })
      .eq("id", classRow.id);

    if (capacityUpdateError) {
      return { success: false, error: capacityUpdateError.message };
    }

    const { error: deleteError } = await supabase
      .from("sections")
      .delete()
      .eq("class_id", classRow.id);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    if (sections.length === 0) {
      continue;
    }

    const { error: insertError } = await supabase.from("sections").insert(
      sections.map((section, index) => ({
        class_id: classRow.id,
        name: section.name,
        display_order: index,
      })),
    );

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  revalidatePath("/onboarding", "layout");

  return {
    success: true,
    message: "Sections saved successfully.",
  };
}
