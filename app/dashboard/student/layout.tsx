import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { StudentPortalNav } from "@/components/student-portal/student-portal-nav";
import { StudentPreviewPicker } from "@/components/student-portal/preview-picker";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { listStudentProfileDirectoryAction } from "@/lib/student-profile/profile-actions";
import { createClient } from "@/lib/supabase/server";

export default async function StudentPortalLayout({
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

  const canPreview =
    authzCtx.actor.isSchoolAdmin ||
    authzCtx.actor.systemRoles.includes("principal") ||
    authzCtx.actor.systemRoles.includes("vice_principal") ||
    authzCtx.actor.systemRoles.includes("teacher") ||
    authzCtx.actor.systemRoles.includes("hod");

  let directory: Array<{ studentProfileId: string; fullName: string }> = [];
  if (canPreview) {
    const listed = await listStudentProfileDirectoryAction();
    if (listed.success) {
      directory = listed.students.map((s) => ({
        studentProfileId: s.studentProfileId,
        fullName: s.fullName,
      }));
    }
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
          <StudentPortalNav authz={headerAuth.authz} />
        </Suspense>
        {canPreview && directory.length > 0 ? (
          <Suspense fallback={null}>
            <StudentPreviewPicker students={directory} />
          </Suspense>
        ) : null}
        {children}
      </main>
    </div>
  );
}
