import { redirect } from "next/navigation";
import { PrincipalPromoteClient } from "@/components/principal-portal/promote-client";
import { requirePermission } from "@/lib/authz/require";
import { listPromotionCandidatesAction } from "@/lib/principal-ops/promote-actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ year?: string; target?: string }>;
};

export default async function PrincipalPromotePage({
  searchParams,
}: PageProps) {
  const authzCtx = await requirePermission("enrollment.placement.edit");
  if ("error" in authzCtx) {
    redirect("/dashboard/principal");
  }

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

  const sourceYearId =
    params.year && years.some((y) => y.id === params.year)
      ? params.year
      : (years.find((y) => y.isActive)?.id ?? years[0]?.id ?? "");

  if (!sourceYearId) {
    return <p className="text-sm text-muted">No academic year configured.</p>;
  }

  const targetYearId =
    params.target && years.some((y) => y.id === params.target)
      ? params.target
      : (years.find((y) => y.id !== sourceYearId)?.id ?? sourceYearId);

  const listed = await listPromotionCandidatesAction({
    sourceAcademicYearId: sourceYearId,
    targetAcademicYearId: targetYearId,
  });

  if (!listed.success) {
    return <p className="text-sm text-muted">{listed.error}</p>;
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Promote
        </h1>
        <p className="mt-2 text-sm text-muted">
          End-of-year promote / repeat / graduate (WF-PRI-10). Closes current
          placements and opens next-year rows when applicable.
        </p>
      </header>
      <PrincipalPromoteClient
        sourceYearId={sourceYearId}
        years={listed.years}
        rules={listed.rules}
        candidates={listed.candidates}
        targetClasses={listed.targetClasses}
      />
    </>
  );
}
