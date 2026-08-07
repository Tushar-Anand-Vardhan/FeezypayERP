"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveContextAction } from "@/lib/auth/session-context";
import type { AuthMembership, AuthPersona } from "@/lib/auth/types";

type Props = {
  memberships: AuthMembership[];
  activeSchoolId?: string | null;
  activePersona?: AuthPersona | null;
};

export function SchoolContextSwitcher({
  memberships,
  activeSchoolId,
  activePersona,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options = dedupeMembershipOptions(memberships);
  if (options.length <= 1) {
    return null;
  }

  const currentValue = `${activeSchoolId ?? ""}::${activePersona ?? ""}::`;

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">Active school and persona</span>
      <select
        className="max-w-[16rem] truncate rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
        disabled={pending}
        value={
          options.find(
            (o) =>
              o.schoolId === activeSchoolId && o.persona === activePersona,
          )
            ? `${activeSchoolId}::${activePersona}::${
                options.find(
                  (o) =>
                    o.schoolId === activeSchoolId &&
                    o.persona === activePersona,
                )?.membershipId ?? ""
              }`
            : currentValue
        }
        onChange={(event) => {
          const [schoolId, persona, membershipId] =
            event.target.value.split("::");
          if (!schoolId || !persona) {
            return;
          }
          startTransition(async () => {
            await setActiveContextAction({
              schoolId,
              persona: persona as AuthPersona,
              membershipId: membershipId || null,
            });
            router.refresh();
          });
        }}
      >
        {options.map((opt) => (
          <option
            key={`${opt.schoolId}::${opt.persona}::${opt.membershipId ?? ""}`}
            value={`${opt.schoolId}::${opt.persona}::${opt.membershipId ?? ""}`}
          >
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function dedupeMembershipOptions(memberships: AuthMembership[]) {
  const seen = new Set<string>();
  const out: Array<{
    schoolId: string;
    persona: AuthPersona;
    membershipId?: string | null;
    label: string;
  }> = [];

  for (const m of memberships) {
    if (m.source === "employment" && m.status === "ended") {
      continue;
    }
    if (
      m.source === "employment" &&
      m.status !== "active" &&
      m.status !== "invited"
    ) {
      continue;
    }
    if (
      m.source === "admission" &&
      m.status !== "active" &&
      m.status !== "alumni"
    ) {
      continue;
    }
    const key = `${m.schoolId}::${m.persona}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const schoolLabel =
      m.schoolName?.trim() || `School ${m.schoolId.slice(0, 8)}`;
    out.push({
      schoolId: m.schoolId,
      persona: m.persona,
      membershipId: m.membershipId,
      label: `${schoolLabel} · ${m.persona.replaceAll("_", " ")}`,
    });
  }

  return out;
}
