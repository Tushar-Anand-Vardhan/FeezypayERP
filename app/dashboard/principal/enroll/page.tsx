import { redirect } from "next/navigation";
import { PrincipalEnrollClient } from "@/components/principal-portal/enroll-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { listEnrollmentPoolAction } from "@/lib/enrollment/placement-actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function PrincipalEnrollPage({ searchParams }: PageProps) {
  const authzCtx = await requirePermission("enrollment.admission.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/principal");
  }

  const headerAuth = await getAppHeaderAuth();
  const canEdit = Boolean(
    headerAuth.authz?.permissions.includes("enrollment.placement.edit"),
  );

  const supabase = await createClient();
  const params = await searchParams;
  const { data: yearsRaw } = await supabase
    .from("academic_years")
    .select("id, label, is_active")
    .eq("school_id", authzCtx.schoolId)
    .is("archived_at", null)
    .order("label", { ascending: false });

  const years = (yearsRaw ?? []).map((y) => ({
    id: y.id,
    label: y.label,
    isActive: Boolean(y.is_active),
  }));

  const academicYearId =
    params.year && years.some((y) => y.id === params.year)
      ? params.year
      : (years.find((y) => y.isActive)?.id ?? years[0]?.id ?? "");

  if (!academicYearId) {
    return <p className="text-sm text-muted">No academic year configured.</p>;
  }

  const pool = await listEnrollmentPoolAction(academicYearId);
  if (!pool.success) {
    return <p className="text-sm text-muted">{pool.error}</p>;
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Enroll & rolls
        </h1>
        <p className="mt-2 text-sm text-muted">
          Place active admissions into class sections (multi-select or CSV), then
          assign roll numbers by name sort or random.
        </p>
      </header>
      <PrincipalEnrollClient
        years={pool.years}
        academicYearId={pool.academicYearId}
        sections={pool.sections}
        students={pool.students}
        canEdit={canEdit}
      />
    </>
  );
}
