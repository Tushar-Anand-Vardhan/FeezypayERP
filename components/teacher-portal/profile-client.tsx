"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  leaveSchoolEmploymentAction,
  updateTeacherCareerProfileAction,
} from "@/lib/workforce/career-actions";

type Props = {
  person: {
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
  employment: {
    employmentId: string;
    fullName: string;
    designation: string | null;
    isHod: boolean;
    status: string;
  } | null;
  employments: Array<{
    employmentId: string;
    fullName: string;
    designation: string | null;
  }>;
  career: {
    qualification: string | null;
    yearsExperience: number | null;
    bio: string | null;
    linkedinUrl: string | null;
    preferredSubjects: string[];
    preferredStandards: string | null;
  } | null;
  history: Array<{
    employmentId: string;
    schoolName: string;
    status: string;
    designation: string | null;
    joinedOn: string | null;
    leftOn: string | null;
  }>;
  canEditSelf: boolean;
  canLeave: boolean;
};

export function TeacherProfileClient({
  person,
  employment,
  employments,
  career,
  history,
  canEditSelf,
  canLeave,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [qualification, setQualification] = useState(
    career?.qualification ?? "",
  );
  const [yearsExperience, setYearsExperience] = useState(
    career?.yearsExperience != null ? String(career.yearsExperience) : "",
  );
  const [bio, setBio] = useState(career?.bio ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(career?.linkedinUrl ?? "");
  const [preferredSubjects, setPreferredSubjects] = useState(
    (career?.preferredSubjects ?? []).join(", "),
  );
  const [preferredStandards, setPreferredStandards] = useState(
    career?.preferredStandards ?? "",
  );

  return (
    <div className="flex flex-col gap-8">
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

      {employments.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Employment context</span>
          <select
            className="max-w-sm rounded-lg border border-border bg-background px-3 py-2"
            value={employment?.employmentId ?? ""}
            onChange={(e) => {
              router.push(
                `/dashboard/teacher/profile?employment=${e.target.value}`,
              );
            }}
          >
            {employments.map((e) => (
              <option key={e.employmentId} value={e.employmentId}>
                {e.fullName}
                {e.designation ? ` · ${e.designation}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <dl className="grid gap-3 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Name</dt>
          <dd className="font-medium">
            {person?.fullName || employment?.fullName || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Email</dt>
          <dd>{person?.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Phone</dt>
          <dd>{person?.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Designation</dt>
          <dd>{employment?.designation ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Employment status</dt>
          <dd>{employment?.status ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">HOD</dt>
          <dd>{employment?.isHod ? "Yes" : "No"}</dd>
        </div>
      </dl>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Career profile</h2>
        {canEditSelf ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setMessage(null);
              setError(null);
              startTransition(async () => {
                const result = await updateTeacherCareerProfileAction({
                  qualification,
                  yearsExperience: yearsExperience
                    ? Number(yearsExperience)
                    : null,
                  bio,
                  linkedinUrl,
                  preferredSubjects: preferredSubjects
                    .split(/[,;\n]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                  preferredStandards,
                });
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setMessage(result.message);
                router.refresh();
              });
            }}
          >
            <Field
              label="Qualification"
              value={qualification}
              onChange={setQualification}
            />
            <Field
              label="Years of experience"
              value={yearsExperience}
              onChange={setYearsExperience}
              type="number"
            />
            <Field
              label="Preferred subjects"
              value={preferredSubjects}
              onChange={setPreferredSubjects}
            />
            <Field
              label="Preferred standards"
              value={preferredStandards}
              onChange={setPreferredStandards}
            />
            <Field
              label="LinkedIn URL"
              value={linkedinUrl}
              onChange={setLinkedinUrl}
            />
            <label className="flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-2">
              Bio
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="h-10 rounded-lg bg-feezy-indigo px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                Save career profile
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">Career fields are read-only.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">
          Experience history
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {history.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No employments yet.</li>
          ) : (
            history.map((h) => (
              <li key={h.employmentId} className="px-4 py-3 text-sm">
                <div className="font-medium">{h.schoolName}</div>
                <div className="text-xs text-muted">
                  {h.status}
                  {h.designation ? ` · ${h.designation}` : ""}
                  {h.joinedOn ? ` · from ${h.joinedOn}` : ""}
                  {h.leftOn ? ` · left ${h.leftOn}` : ""}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {canLeave && employment?.status === "active" ? (
        <section className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <h2 className="font-display text-lg font-semibold text-red-950">
            Leave this school
          </h2>
          <p className="mt-1 text-sm text-red-950/80">
            Ends your active employment here so another school can invite you
            (D15). Experience history stays on your profile.
          </p>
          <button
            type="button"
            disabled={pending}
            className="mt-3 h-10 rounded-lg bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => {
              if (
                !window.confirm(
                  "Leave this school? Your employment will be ended.",
                )
              ) {
                return;
              }
              setMessage(null);
              setError(null);
              startTransition(async () => {
                const result = await leaveSchoolEmploymentAction(
                  employment.employmentId,
                );
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setMessage(result.message);
                router.push("/dashboard");
                router.refresh();
              });
            }}
          >
            End my employment
          </button>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      />
    </label>
  );
}
