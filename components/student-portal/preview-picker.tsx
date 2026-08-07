"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  students: Array<{ studentProfileId: string; fullName: string }>;
};

export function StudentPreviewPicker({ students }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected =
    searchParams.get("studentProfileId") ?? students[0]?.studentProfileId ?? "";

  if (students.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-muted">Preview student</span>
        <select
          className="min-w-[220px] rounded-lg border border-border bg-background px-3 py-2"
          value={selected}
          onChange={(e) => {
            const v = e.target.value;
            router.push(
              v ? `${pathname}?studentProfileId=${v}` : pathname,
            );
          }}
        >
          {students.map((s) => (
            <option key={s.studentProfileId} value={s.studentProfileId}>
              {s.fullName || s.studentProfileId.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-muted">Staff preview — select a student profile.</p>
    </div>
  );
}
