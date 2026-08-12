"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Child = {
  studentProfileId: string;
  fullName: string;
};

type Props = {
  childrenList: Child[];
};

export function ParentChildPicker({ childrenList }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (childrenList.length <= 1) return null;

  const selectedId =
    searchParams.get("studentProfileId") ||
    childrenList[0]?.studentProfileId ||
    "";

  return (
    <label className="flex max-w-sm flex-col gap-1 text-sm">
      <span className="text-muted">Viewing child</span>
      <select
        className="rounded-lg border border-border bg-background px-3 py-2"
        value={selectedId}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("studentProfileId", e.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
      >
        {childrenList.map((c) => (
          <option key={c.studentProfileId} value={c.studentProfileId}>
            {c.fullName}
          </option>
        ))}
      </select>
    </label>
  );
}
