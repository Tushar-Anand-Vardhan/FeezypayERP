import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const headerAuth = await getAppHeaderAuth();
  const schoolId =
    headerAuth.activeSchoolId ?? headerAuth.authz?.schoolId ?? null;

  let schoolName: string | null = null;
  let onboardingComplete = false;
  if (schoolId) {
    const { data: school } = await supabase
      .from("schools")
      .select("name, onboarding_status")
      .eq("id", schoolId)
      .maybeSingle();
    schoolName = school?.name ?? null;
    onboardingComplete = school?.onboarding_status === "completed";
  }

  return (
    <AppShell
      schoolName={schoolName}
      onboardingComplete={onboardingComplete}
      memberships={headerAuth.memberships}
      activeSchoolId={headerAuth.activeSchoolId}
      activePersona={headerAuth.activePersona}
      authz={headerAuth.authz}
    >
      {children}
    </AppShell>
  );
}
