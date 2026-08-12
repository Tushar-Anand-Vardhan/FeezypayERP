"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { impersonateSchoolContextAction } from "@/lib/platform/platform-actions";

type SchoolRow = {
  id: string;
  name: string;
  code: string | null;
  onboardingStatus: string | null;
  board: string | null;
};

type Props = {
  schools: SchoolRow[];
  canImpersonate: boolean;
};

export function PlatformConsoleClient({ schools, canImpersonate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      <p className="text-sm text-muted">
        Cross-tenant health (read-only). Impersonation is audit-logged break-glass
        into a school as school_admin.
      </p>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {schools.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No schools found.</li>
        ) : (
          schools.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  {s.name}
                  {s.code ? (
                    <span className="ml-2 text-xs text-muted">{s.code}</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted">
                  {s.board ?? "—"} · onboarding {s.onboardingStatus ?? "—"}
                </div>
              </div>
              {canImpersonate ? (
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs font-medium text-feezy-indigo disabled:opacity-60"
                  onClick={() => {
                    setMessage(null);
                    setError(null);
                    startTransition(async () => {
                      const result = await impersonateSchoolContextAction({
                        schoolId: s.id,
                      });
                      if (!result.success) {
                        setError(result.error);
                        return;
                      }
                      setMessage(result.message ?? "Switched.");
                      router.push("/dashboard");
                      router.refresh();
                    });
                  }}
                >
                  Enter school
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
