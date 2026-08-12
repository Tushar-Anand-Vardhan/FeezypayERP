import { redirect } from "next/navigation";
import { PrincipalStudentsClient } from "@/components/principal-portal/students-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { listPrincipalStudentsAction } from "@/lib/principal-ops/students-actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function PrincipalStudentsPage({
  searchParams,
}: PageProps) {
  const authzCtx = await requirePermission("enrollment.admission.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/principal");
  }

  const headerAuth = await getAppHeaderAuth();
  const canEdit = Boolean(
    headerAuth.authz?.permissions.includes("enrollment.admission.edit"),
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

  const listed = await listPrincipalStudentsAction(academicYearId);
  if (!listed.success) {
    return <p className="text-sm text-muted">{listed.error}</p>;
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Students
        </h1>
        <p className="mt-2 text-sm text-muted">
          Withdraw or expel students from the school (admission → withdrawn,
          placements closed, membership synced).
        </p>
      </header>
      <PrincipalStudentsClient
        years={listed.years}
        academicYearId={academicYearId}
        students={listed.students}
        canEdit={canEdit}
      />
    </>
  );
}
