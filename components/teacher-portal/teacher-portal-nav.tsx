"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Can } from "@/lib/authz/can";
import type { AuthzBootstrap } from "@/lib/authz/bootstrap-shared";
import { TEACHER_PORTAL_NAV } from "@/lib/teacher-portal/nav";

type Props = {
  authz: AuthzBootstrap | null;
};

export function TeacherPortalNav({ authz }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const employment = searchParams.get("employment");
  const qs = employment ? `?employment=${employment}` : "";

  return (
    <nav
      aria-label="Teacher portal"
      className="flex flex-wrap gap-1 border-b border-border pb-3"
    >
      {TEACHER_PORTAL_NAV.map((item) => {
        const href = `${item.href}${qs}`;
        const active =
          item.href === "/dashboard/teacher"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Can key={item.id} permission={item.permission} bootstrap={authz}>
            <Link
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm ${
                active
                  ? "bg-feezy-indigo/10 font-medium text-feezy-indigo"
                  : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          </Can>
        );
      })}
    </nav>
  );
}
