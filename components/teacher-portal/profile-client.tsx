"use client";

import { useRouter } from "next/navigation";

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
  canEditSelf: boolean;
};

export function TeacherProfileClient({
  person,
  employment,
  employments,
  canEditSelf,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
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

      {canEditSelf ? (
        <p className="text-sm text-muted">
          Self-edit for allowed person fields will use identity actions when
          exposed here; contact school admin for corrections not yet editable
          in portal.
        </p>
      ) : null}
    </div>
  );
}
