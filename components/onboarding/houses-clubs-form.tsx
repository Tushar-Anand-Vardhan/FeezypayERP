"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { WizardActions } from "@/components/onboarding/wizard-actions";
import { useOnboardingStepReady } from "@/components/onboarding/onboarding-progress";
import {
  getHousesClubsStepDataAction,
  saveHousesClubsAction,
} from "@/lib/onboarding/houses-clubs-actions";
import {
  validateHousesClubsForm,
  type ClubFormRow,
  type HouseFormRow,
  type HousesClubsFieldErrors,
} from "@/lib/onboarding/houses-clubs";

export function HousesClubsForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [housesEnabled, setHousesEnabled] = useState(false);
  const [clubsEnabled, setClubsEnabled] = useState(false);
  const [houses, setHouses] = useState<HouseFormRow[]>([]);
  const [clubs, setClubs] = useState<ClubFormRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<HousesClubsFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(
    null,
  );
  useOnboardingStepReady(!initialLoading);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setInitialLoading(true);
      const result = await getHousesClubsStepDataAction();
      if (cancelled) return;

      if (!result.success) {
        setLoadError(result.error);
        setInitialLoading(false);
        return;
      }

      setHousesEnabled(result.housesEnabled);
      setClubsEnabled(result.clubsEnabled);
      setHouses(result.houses.length > 0 ? result.houses : []);
      setClubs(result.clubs.length > 0 ? result.clubs : []);
      setInitialLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function performSave(intent: "save" | "next") {
    setFormError(null);
    setSuccessMessage(null);

    const errors = validateHousesClubsForm({
      housesEnabled,
      clubsEnabled,
      houses,
      clubs,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});

    const formData = new FormData();
    formData.set("housesEnabled", String(housesEnabled));
    formData.set("clubsEnabled", String(clubsEnabled));
    formData.set("houses", JSON.stringify(houses));
    formData.set("clubs", JSON.stringify(clubs));
    formData.set("intent", intent);

    const result = await saveHousesClubsAction(formData);
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return false;
    }

    setSuccessMessage(result.message);
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function handleSaveAndExit() {
    setLoadingAction("save");
    const saved = await performSave("save");
    if (saved) {
      router.push("/dashboard");
      return;
    }
    setLoadingAction(null);
  }

  async function handleContinue() {
    setLoadingAction("next");
    const saved = await performSave("next");
    if (saved) {
      router.push("/onboarding/staff");
      return;
    }
    setLoadingAction(null);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading houses & clubs…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-feezy-coral">{loadError}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Houses & clubs
          </h1>
          <p className="text-sm text-muted">
            Optional extracurricular structures. You can skip both and continue.
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit} noValidate>
          <section className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              <span>Enable houses</span>
              <input
                type="checkbox"
                checked={housesEnabled}
                onChange={(event) => {
                  setHousesEnabled(event.target.checked);
                  if (event.target.checked && houses.length === 0) {
                    setHouses([{ name: "" }]);
                  }
                }}
              />
            </label>

            {housesEnabled ? (
              <div className="space-y-3">
                {fieldErrors.houses ? (
                  <p className="text-sm text-feezy-coral">{fieldErrors.houses}</p>
                ) : null}
                {houses.map((house, index) => (
                  <div key={`house-${index}`} className="flex gap-2">
                    <div className="flex-1">
                      <FormField
                        id={`house-${index}-name`}
                        label={`House ${index + 1}`}
                        value={house.name}
                        onChange={(value) =>
                          setHouses((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index ? { name: value } : row,
                            ),
                          )
                        }
                        error={fieldErrors[`house-${index}-name`]}
                      />
                    </div>
                    <button
                      type="button"
                      className="mt-7 rounded-lg border border-border px-3 py-2 text-sm"
                      onClick={() =>
                        setHouses((current) =>
                          current.filter((_, rowIndex) => rowIndex !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
                  onClick={() => setHouses((current) => [...current, { name: "" }])}
                >
                  Add house
                </button>
              </div>
            ) : null}
          </section>

          <section className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              <span>Enable clubs</span>
              <input
                type="checkbox"
                checked={clubsEnabled}
                onChange={(event) => {
                  setClubsEnabled(event.target.checked);
                  if (event.target.checked && clubs.length === 0) {
                    setClubs([{ name: "", description: "" }]);
                  }
                }}
              />
            </label>

            {clubsEnabled ? (
              <div className="space-y-4">
                {fieldErrors.clubs ? (
                  <p className="text-sm text-feezy-coral">{fieldErrors.clubs}</p>
                ) : null}
                {clubs.map((club, index) => (
                  <div
                    key={`club-${index}`}
                    className="space-y-3 rounded-xl border border-border p-3"
                  >
                    <FormField
                      id={`club-${index}-name`}
                      label={`Club ${index + 1} name`}
                      value={club.name}
                      onChange={(value) =>
                        setClubs((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, name: value } : row,
                          ),
                        )
                      }
                      error={fieldErrors[`club-${index}-name`]}
                    />
                    <FormField
                      id={`club-${index}-description`}
                      label="Description"
                      value={club.description}
                      onChange={(value) =>
                        setClubs((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, description: value }
                              : row,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                      onClick={() =>
                        setClubs((current) =>
                          current.filter((_, rowIndex) => rowIndex !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
                  onClick={() =>
                    setClubs((current) => [
                      ...current,
                      { name: "", description: "" },
                    ])
                  }
                >
                  Add club
                </button>
              </div>
            ) : null}
          </section>

          {formError ? (
            <p className="text-sm text-feezy-coral">{formError}</p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-emerald-600">{successMessage}</p>
          ) : null}

          <WizardActions
            backHref="/onboarding/subjects"
            loadingAction={loadingAction}
            onSaveAndExit={handleSaveAndExit}
            onContinue={handleContinue}
          />
        </form>
      </div>
    </main>
  );
}
