"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateSchoolBrandingAction } from "@/lib/config/school-branding-actions";
import type { SchoolBrandingInput } from "@/lib/config/types";

type Props = {
  initial: SchoolBrandingInput;
  canEdit: boolean;
};

export function ConfigBrandingEditClient({ initial, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SchoolBrandingInput>(
    key: K,
    value: SchoolBrandingInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-muted">
        You can view branding. Catalog edit permission is required to change it.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await updateSchoolBrandingAction(form);
          if (!result.success) {
            setError(result.error);
            return;
          }
          setMessage(result.message);
          router.refresh();
        });
      }}
    >
      {message ? (
        <p className="rounded-xl border border-feezy-indigo/20 bg-feezy-indigo/5 px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={form.name} onChange={(v) => set("name", v)} required />
        <Field
          label="School code"
          value={form.code ?? ""}
          onChange={(v) => set("code", v)}
        />
        <Field label="Board" value={form.board} onChange={(v) => set("board", v)} required />
        <Field
          label="Affiliation number"
          value={form.affiliationNumber}
          onChange={(v) => set("affiliationNumber", v)}
        />
        <Field
          label="Street"
          value={form.addressStreet}
          onChange={(v) => set("addressStreet", v)}
        />
        <Field
          label="City"
          value={form.addressCity}
          onChange={(v) => set("addressCity", v)}
        />
        <Field
          label="State"
          value={form.addressState}
          onChange={(v) => set("addressState", v)}
        />
        <Field
          label="Pincode"
          value={form.addressPincode}
          onChange={(v) => set("addressPincode", v)}
        />
        <Field
          label="Phone"
          value={form.contactPhone}
          onChange={(v) => set("contactPhone", v)}
        />
        <Field
          label="Email"
          value={form.contactEmail}
          onChange={(v) => set("contactEmail", v)}
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(form.housesEnabled)}
            onChange={(e) => set("housesEnabled", e.target.checked)}
          />
          Houses enabled
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(form.clubsEnabled)}
            onChange={(e) => set("clubsEnabled", e.target.checked)}
          />
          Clubs enabled
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      />
    </label>
  );
}
