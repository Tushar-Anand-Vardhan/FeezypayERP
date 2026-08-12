"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { withdrawStudentAction } from "@/lib/principal-ops/students-actions";

type StudentRow = {
  admissionId: string;
  studentProfileId: string;
  fullName: string;
  admissionNumber: string | null;
  status: string;
  studentAcademicYearId: string | null;
  className: string | null;
  sectionName: string | null;
  rollNumber: string | null;
};

type Props = {
  years: Array<{ id: string; label: string; isActive: boolean }>;
  academicYearId: string;
  students: StudentRow[];
  canEdit: boolean;
};

export function PrincipalStudentsClient({
  years,
  academicYearId,
  students,
  canEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap gap-2">
        {years.map((y) => (
          <Link
            key={y.id}
            href={`/dashboard/principal/students?year=${y.id}`}
            className={
              y.id === academicYearId
                ? "rounded-lg bg-feezy-indigo px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            }
          >
            {y.label}
            {y.isActive ? " · active" : ""}
          </Link>
        ))}
        <Link
          href={`/dashboard/principal/enroll?year=${academicYearId}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          Enroll & rolls →
        </Link>
      </div>

      {canEdit ? (
        <label className="flex max-w-lg flex-col gap-1 text-xs font-medium text-muted">
          Withdrawal reason (optional, saved with confirm)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="e.g. Parent request / disciplinary"
          />
        </label>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border">
        {students.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No students.</li>
        ) : (
          students.map((s) => (
            <li
              key={s.admissionId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{s.fullName}</div>
                <div className="text-xs text-muted">
                  {s.status}
                  {s.admissionNumber ? ` · Adm ${s.admissionNumber}` : ""}
                  {s.className
                    ? ` · ${s.className}${s.sectionName ? ` · ${s.sectionName}` : ""}`
                    : ""}
                  {s.rollNumber ? ` · Roll ${s.rollNumber}` : ""}
                </div>
              </div>
              {canEdit && s.status === "active" ? (
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs text-red-700 hover:underline disabled:opacity-60"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Withdraw / expel ${s.fullName} from this school?`,
                      )
                    ) {
                      return;
                    }
                    setMessage(null);
                    setError(null);
                    startTransition(async () => {
                      const result = await withdrawStudentAction({
                        admissionId: s.admissionId,
                        reason: reason || undefined,
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
                  Withdraw / expel
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
