"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveClubAction,
  createClubAction,
  setClubTeacherInChargeAction,
} from "@/lib/houses-clubs/clubs-actions";
import {
  archiveHouseAction,
  createHouseAction,
  setHouseTeacherInChargeAction,
} from "@/lib/houses-clubs/houses-actions";

type HouseRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  colour: string | null;
  logo_path: string | null;
  teacher_in_charge_employment_id: string | null;
  academic_year_id: string | null;
};

type ClubRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  colour: string | null;
  logo_path: string | null;
  teacher_in_charge_employment_id: string | null;
  academic_year_id: string | null;
};

type EmploymentOption = {
  id: string;
  label: string;
};

type YearOption = {
  id: string;
  label: string;
};

type Props = {
  houses: HouseRow[];
  clubs: ClubRow[];
  employments: EmploymentOption[];
  years: YearOption[];
  housesEnabled: boolean;
  clubsEnabled: boolean;
};

export function HousesClubsAdminClient({
  houses,
  clubs,
  employments,
  years,
  housesEnabled,
  clubsEnabled,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [houseName, setHouseName] = useState("");
  const [houseColour, setHouseColour] = useState("#C41E3A");
  const [houseDesc, setHouseDesc] = useState("");
  const [houseYear, setHouseYear] = useState("");
  const [houseTic, setHouseTic] = useState("");

  const [clubName, setClubName] = useState("");
  const [clubColour, setClubColour] = useState("#1A73E8");
  const [clubDesc, setClubDesc] = useState("");
  const [clubYear, setClubYear] = useState("");
  const [clubTic, setClubTic] = useState("");

  function run(
    action: () => Promise<{
      success: boolean;
      error?: string;
      message?: string;
    }>,
  ) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setMessage(result.message ?? "Saved.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">
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

      <p className="text-sm text-muted">
        Houses {housesEnabled ? "enabled" : "disabled"} · Clubs{" "}
        {clubsEnabled ? "enabled" : "disabled"} (toggles live in onboarding /
        school branding).
      </p>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Houses</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {houses.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No houses yet.</li>
          ) : (
            houses.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: h.colour ?? "#ccc" }}
                    title={h.colour ?? "no colour"}
                  />
                  <div>
                    <div className="font-medium">
                      {h.name}
                      {h.code ? (
                        <span className="ml-2 text-xs text-muted">{h.code}</span>
                      ) : null}
                    </div>
                    {h.description ? (
                      <div className="text-xs text-muted">{h.description}</div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                    value={h.teacher_in_charge_employment_id ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        setHouseTeacherInChargeAction(
                          h.id,
                          e.target.value || null,
                        ),
                      )
                    }
                  >
                    <option value="">Teacher in charge…</option>
                    {employments.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-xs text-muted hover:text-foreground"
                    onClick={() => run(() => archiveHouseAction(h.id))}
                  >
                    Archive
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              createHouseAction({
                name: houseName,
                colour: houseColour,
                description: houseDesc,
                academicYearId: houseYear || null,
                teacherInChargeEmploymentId: houseTic || null,
              }),
            );
            setHouseName("");
            setHouseDesc("");
          }}
        >
          <Field label="Name" value={houseName} onChange={setHouseName} />
          <Field
            label="Colour"
            type="color"
            value={houseColour}
            onChange={setHouseColour}
          />
          <Field
            label="Description"
            value={houseDesc}
            onChange={setHouseDesc}
            required={false}
          />
          <Select
            label="Academic year"
            value={houseYear}
            onChange={setHouseYear}
            options={[{ id: "", label: "School-wide" }, ...years]}
          />
          <Select
            label="Teacher in charge"
            value={houseTic}
            onChange={setHouseTic}
            options={[{ id: "", label: "None" }, ...employments]}
          />
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            Add house
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Clubs</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {clubs.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No clubs yet.</li>
          ) : (
            clubs.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: c.colour ?? "#ccc" }}
                  />
                  <div>
                    <div className="font-medium">
                      {c.name}
                      {c.code ? (
                        <span className="ml-2 text-xs text-muted">{c.code}</span>
                      ) : null}
                    </div>
                    {c.description ? (
                      <div className="text-xs text-muted">{c.description}</div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                    value={c.teacher_in_charge_employment_id ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        setClubTeacherInChargeAction(
                          c.id,
                          e.target.value || null,
                        ),
                      )
                    }
                  >
                    <option value="">Teacher in charge…</option>
                    {employments.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-xs text-muted hover:text-foreground"
                    onClick={() => run(() => archiveClubAction(c.id))}
                  >
                    Archive
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              createClubAction({
                name: clubName,
                colour: clubColour,
                description: clubDesc,
                academicYearId: clubYear || null,
                teacherInChargeEmploymentId: clubTic || null,
              }),
            );
            setClubName("");
            setClubDesc("");
          }}
        >
          <Field label="Name" value={clubName} onChange={setClubName} />
          <Field
            label="Colour"
            type="color"
            value={clubColour}
            onChange={setClubColour}
          />
          <Field
            label="Description"
            value={clubDesc}
            onChange={setClubDesc}
            required={false}
          />
          <Select
            label="Academic year"
            value={clubYear}
            onChange={setClubYear}
            options={[{ id: "", label: "School-wide" }, ...years]}
          />
          <Select
            label="Teacher in charge"
            value={clubTic}
            onChange={setClubTic}
            options={[{ id: "", label: "None" }, ...employments]}
          />
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-feezy-indigo px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            Add club
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      >
        {options.map((o) => (
          <option key={o.id || "none"} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
