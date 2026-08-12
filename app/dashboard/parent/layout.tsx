import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { ParentPortalNav } from "@/components/parent-portal/parent-portal-nav";
import { ParentChildPicker } from "@/components/parent-portal/child-picker";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { assertStudentInSchool } from "@/lib/student-profile/server-helpers";
import { createClient } from "@/lib/supabase/server";

export default async function ParentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("enrollment.admission.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const headerAuth = await getAppHeaderAuth();
  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", authzCtx.schoolId)
    .maybeSingle();

  const childrenList: Array<{ studentProfileId: string; fullName: string }> =
    [];
  for (const id of authzCtx.actor.linkedStudentProfileIds) {
    const owned = await assertStudentInSchool(
      supabase,
      authzCtx.schoolId,
      id,
    );
    if (!owned) continue;
    const { data: person } = await supabase
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
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AppHeader
        schoolName={school?.name ?? null}
        onboardingComplete={school?.onboarding_status === "completed"}
        memberships={headerAuth.memberships}
        activeSchoolId={headerAuth.activeSchoolId}
        activePersona={headerAuth.activePersona}
        authz={headerAuth.authz}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <Suspense fallback={null}>
          <ParentPortalNav authz={headerAuth.authz} />
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
    </div>
  );
}
