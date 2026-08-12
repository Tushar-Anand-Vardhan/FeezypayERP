"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type SectionOption = {
  id: string;
  label: string;
  isHomeClassroom: boolean;
};

type StudentRow = {
  studentProfileId: string;
  fullName: string;
  admissionNumber: string | null;
  rollNumber: string | null;
};

type Props = {
  employmentId: string | null;
  sections: SectionOption[];
  sectionId: string | null;
  students: StudentRow[];
};

export function TeacherStudentsClient({
  employmentId,
  sections,
  sectionId,
  students,
}: Props) {
  const router = useRouter();

  function selectSection(next: string) {
    const params = new URLSearchParams();
    if (employmentId) params.set("employment", employmentId);
    params.set("sectionId", next);
    router.push(`/dashboard/teacher/students?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.length === 0 ? (
        <p className="text-sm text-muted">
          No sections available for this employment yet.
        </p>
      ) : (
        <label className="flex max-w-lg flex-col gap-1 text-sm">
          <span className="text-xs text-muted">Class / section</span>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2"
            value={sectionId ?? ""}
            onChange={(e) => selectSection(e.target.value)}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.isHomeClassroom ? " · Home classroom" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {students.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">
            No students in this section.
          </li>
        ) : (
          students.map((s) => {
            const params = new URLSearchParams();
            if (employmentId) params.set("employment", employmentId);
            if (sectionId) params.set("sectionId", sectionId);
            const href = `/dashboard/teacher/students/${s.studentProfileId}?${params.toString()}`;
            return (
              <li key={s.studentProfileId}>
                <Link
                  href={href}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-background"
                >
                  <span className="font-medium">{s.fullName}</span>
                  <span className="text-xs text-muted">
                    {s.rollNumber ? `Roll ${s.rollNumber}` : ""}
                    {s.admissionNumber
                      ? `${s.rollNumber ? " · " : ""}Adm ${s.admissionNumber}`
                      : ""}
                  </span>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
