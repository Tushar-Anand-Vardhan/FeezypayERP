"use client";

import { FormEvent, useEffect, useState } from "react";
import { FormField, FormSelect } from "@/components/form/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { validateEmail } from "@/lib/auth/validation";
import {
  BOARD_OPTIONS,
  MONTH_OPTIONS,
  trimSchoolIdentityValues,
  validateLogoFile,
  validateSchoolIdentityForm,
  type SchoolIdentityFieldErrors,
  type SchoolIdentityFormValues,
} from "@/lib/onboarding/school-identity";
import { createClient } from "@/lib/supabase/client";
import { saveSchoolIdentityAction } from "./actions";

const emptyValues: SchoolIdentityFormValues = {
  name: "",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  addressPincode: "",
  contactPhone: "",
  contactEmail: "",
  board: "",
  affiliationNumber: "",
  academicYearStartMonth: "",
};

type LoadedSchool = {
  name: string | null;
  logo_path: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_pincode: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  board: string | null;
  affiliation_number: string | null;
  academic_year_start_month: number | null;
};

export default function OnboardingPage() {
  const [values, setValues] = useState<SchoolIdentityFormValues>(emptyValues);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SchoolIdentityFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSchool() {
      setInitialLoading(true);
      setLoadError(null);

      const supabase = createClient();
      const { data: claimsData } = await supabase.auth.getClaims();
      const userId = claimsData?.claims?.sub;

      if (typeof userId !== "string") {
        if (!cancelled) {
          setLoadError("You must be signed in to continue.");
          setInitialLoading(false);
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", userId)
        .maybeSingle();

      if (profileError || !profile?.school_id) {
        if (!cancelled) {
          setLoadError("We could not load your school profile.");
          setInitialLoading(false);
        }
        return;
      }

      const { data: school, error: schoolError } = await supabase
        .from("schools")
        .select(
          "name, logo_path, address_street, address_city, address_state, address_pincode, contact_phone, contact_email, board, affiliation_number, academic_year_start_month",
        )
        .eq("id", profile.school_id)
        .maybeSingle();

      if (schoolError || !school) {
        if (!cancelled) {
          setLoadError("We could not load your school details.");
          setInitialLoading(false);
        }
        return;
      }

      const loaded = school as LoadedSchool;

      if (!cancelled) {
        setValues({
          name: loaded.name ?? "",
          addressStreet: loaded.address_street ?? "",
          addressCity: loaded.address_city ?? "",
          addressState: loaded.address_state ?? "",
          addressPincode: loaded.address_pincode ?? "",
          contactPhone: loaded.contact_phone ?? "",
          contactEmail: loaded.contact_email ?? "",
          board: (loaded.board as SchoolIdentityFormValues["board"]) ?? "",
          affiliationNumber: loaded.affiliation_number ?? "",
          academicYearStartMonth: loaded.academic_year_start_month
            ? String(loaded.academic_year_start_month)
            : "",
        });

        if (loaded.logo_path) {
          const { data: signedUrlData } = await supabase.storage
            .from("school-logos")
            .createSignedUrl(loaded.logo_path, 3600);

          if (!cancelled && signedUrlData?.signedUrl) {
            setExistingLogoUrl(signedUrlData.signedUrl);
          }
        }

        setInitialLoading(false);
      }
    }

    void loadSchool();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [logoFile]);

  function updateField<K extends keyof SchoolIdentityFormValues>(
    key: K,
    value: SchoolIdentityFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const validationErrors = validateSchoolIdentityForm(
      values,
      validateEmail,
      logoFile,
    );

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    const trimmed = trimSchoolIdentityValues(values);
    const formData = new FormData();
    formData.set("name", trimmed.name);
    formData.set("addressStreet", trimmed.addressStreet);
    formData.set("addressCity", trimmed.addressCity);
    formData.set("addressState", trimmed.addressState);
    formData.set("addressPincode", trimmed.addressPincode);
    formData.set("contactPhone", trimmed.contactPhone);
    formData.set("contactEmail", trimmed.contactEmail);
    formData.set("board", trimmed.board);
    formData.set("affiliationNumber", trimmed.affiliationNumber);
    formData.set("academicYearStartMonth", trimmed.academicYearStartMonth);

    if (logoFile) {
      formData.set("logo", logoFile);
    }

    const result = await saveSchoolIdentityAction(formData);

    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      setLoading(false);
      return;
    }

    setSuccessMessage(result.message);

    if (result.logoPath) {
      const supabase = createClient();
      const { data: signedUrlData } = await supabase.storage
        .from("school-logos")
        .createSignedUrl(result.logoPath, 3600);

      if (signedUrlData?.signedUrl) {
        setExistingLogoUrl(signedUrlData.signedUrl);
      }
    }

    setLogoFile(null);
    setLoading(false);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-foreground/70">Loading your school details…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground/60">Step 1 of onboarding</p>
          <h1 className="text-3xl font-semibold tracking-tight">School identity</h1>
          <p className="text-sm text-foreground/70">
            Tell us about your school. You can save and return to update these details
            anytime before onboarding is complete.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <FormField
            id="name"
            label="School name"
            value={values.name}
            onChange={(value) => updateField("name", value)}
            error={fieldErrors.name}
            required
          />

          <div className="space-y-2">
            <label htmlFor="logo" className="block text-sm font-medium">
              Logo
            </label>
            {(logoPreviewUrl || existingLogoUrl) && (
              <div className="mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreviewUrl ?? existingLogoUrl ?? ""}
                  alt="School logo preview"
                  className="h-20 w-20 rounded-lg border border-foreground/10 object-cover"
                />
              </div>
            )}
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setLogoFile(file);
                const logoError = validateLogoFile(file);
                setFieldErrors((current) => ({
                  ...current,
                  logo: logoError ?? undefined,
                }));
              }}
              className="block w-full text-sm text-foreground/80 file:mr-4 file:rounded-lg file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background"
            />
            <p className="text-xs text-foreground/60">
              JPEG, PNG, WebP, or GIF. Maximum size 2 MB.
            </p>
            {fieldErrors.logo ? (
              <p className="text-sm text-red-600 dark:text-red-400">{fieldErrors.logo}</p>
            ) : null}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              id="addressStreet"
              label="Street address"
              value={values.addressStreet}
              onChange={(value) => updateField("addressStreet", value)}
              error={fieldErrors.addressStreet}
              required
            />
            <FormField
              id="addressCity"
              label="City"
              value={values.addressCity}
              onChange={(value) => updateField("addressCity", value)}
              error={fieldErrors.addressCity}
              required
            />
            <FormField
              id="addressState"
              label="State"
              value={values.addressState}
              onChange={(value) => updateField("addressState", value)}
              error={fieldErrors.addressState}
              required
            />
            <FormField
              id="addressPincode"
              label="Pincode"
              value={values.addressPincode}
              onChange={(value) => updateField("addressPincode", value)}
              error={fieldErrors.addressPincode}
              required
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              id="contactPhone"
              label="Contact phone"
              type="tel"
              autoComplete="tel"
              value={values.contactPhone}
              onChange={(value) => updateField("contactPhone", value)}
              error={fieldErrors.contactPhone}
              required
            />
            <FormField
              id="contactEmail"
              label="Contact email"
              type="email"
              autoComplete="email"
              value={values.contactEmail}
              onChange={(value) => updateField("contactEmail", value)}
              error={fieldErrors.contactEmail}
              required
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormSelect
              id="board"
              label="Board"
              value={values.board}
              onChange={(value) => updateField("board", value as SchoolIdentityFormValues["board"])}
              error={fieldErrors.board}
              placeholder="Select a board"
              required
            >
              {BOARD_OPTIONS.map((board) => (
                <option key={board} value={board}>
                  {board}
                </option>
              ))}
            </FormSelect>

            <FormField
              id="affiliationNumber"
              label="Affiliation / registration number"
              value={values.affiliationNumber}
              onChange={(value) => updateField("affiliationNumber", value)}
              error={fieldErrors.affiliationNumber}
            />
          </div>

          <FormSelect
            id="academicYearStartMonth"
            label="Academic year start month"
            value={values.academicYearStartMonth}
            onChange={(value) => updateField("academicYearStartMonth", value)}
            error={fieldErrors.academicYearStartMonth}
            placeholder="Select a month"
            required
          >
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </FormSelect>

          {formError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          ) : null}

          {successMessage ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {successMessage}
            </p>
          ) : null}

          <SubmitButton loading={loading}>Save school identity</SubmitButton>
        </form>
      </div>
    </main>
  );
}
