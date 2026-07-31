"use server";

import { revalidatePath } from "next/cache";
import { validateEmail } from "@/lib/auth/validation";
import {
  BOARD_OPTIONS,
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_BYTES,
  trimSchoolIdentityValues,
  type BoardOption,
  type SchoolIdentityFormValues,
} from "@/lib/onboarding/school-identity";
import { createClient } from "@/lib/supabase/server";

type ActionResult =
  | { success: true; message: string; logoPath?: string | null }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

async function getAuthenticatedSchoolContext():
  Promise<
    | { supabase: Awaited<ReturnType<typeof createClient>>; schoolId: string }
    | { error: string }
  > {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (typeof userId !== "string") {
    return { error: "You must be signed in to continue." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile?.school_id) {
    return { error: "We could not find your school profile." };
  }

  return { supabase, schoolId: profile.school_id };
}

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

function validateServerForm(values: SchoolIdentityFormValues, hasLogoFile: boolean) {
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
): Promise<ActionResult> {
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

  const { trimmed, fieldErrors } = validateServerForm(values, hasLogoFile);
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

  revalidatePath("/onboarding");

  return {
    success: true,
    message: "School identity saved successfully.",
    logoPath: logoPath ?? null,
  };
}
