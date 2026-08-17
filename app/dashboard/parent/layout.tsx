import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ParentPortalNav } from "@/components/parent-portal/parent-portal-nav";
import { ParentChildPicker } from "@/components/parent-portal/child-picker";
import { authzBootstrapFromActor } from "@/lib/authz/bootstrap-shared";
import { requirePermission } from "@/lib/authz/require";
import { assertStudentInSchool } from "@/lib/student-profile/server-helpers";

export default async function ParentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authzCtx = await requirePermission("enrollment.admission.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const authz = authzBootstrapFromActor(authzCtx.actor);

  const childrenList: Array<{ studentProfileId: string; fullName: string }> =
    [];
  for (const id of authzCtx.actor.linkedStudentProfileIds) {
    const owned = await assertStudentInSchool(
      authzCtx.supabase,
      authzCtx.schoolId,
      id,
    );
    if (!owned) continue;
    const { data: person } = await authzCtx.supabase
      .from("persons")
      .select("full_name")
      .eq("id", owned.personId)
      .maybeSingle();
    childrenList.push({
      studentProfileId: id,
      fullName: person?.full_name ?? "Student",
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={null}>
        <ParentPortalNav authz={authz} />
      </Suspense>
      {childrenList.length > 0 ? (
        <Suspense fallback={null}>
          <ParentChildPicker childrenList={childrenList} />
        </Suspense>
      ) : (
        <p className="text-sm text-muted">
          No linked children. Ask the school to invite you as a parent on an
          admission.
        </p>
      )}
      {children}
    </main>
  );
}
