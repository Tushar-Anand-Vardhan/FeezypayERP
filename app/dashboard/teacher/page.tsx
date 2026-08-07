import { redirect } from "next/navigation";
import { TeacherWorkspaceClient } from "@/components/teacher-workspace/teacher-workspace-client";
import { requirePermission } from "@/lib/authz/require";
import { listActiveEmployments } from "@/lib/teacher-workspace/server-helpers";
import { buildTeacherWorkspace } from "@/lib/teacher-workspace/workspace";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ employment?: string }>;
};

export default async function TeacherWorkspacePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("workforce.workspace.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const schoolId = authzCtx.schoolId;
  const params = await searchParams;
  const employments = await listActiveEmployments(supabase, schoolId);

  const selectedEmploymentId =
    params.employment &&
    employments.some((e) => e.employmentId === params.employment)
      ? params.employment
      : (employments[0]?.employmentId ?? null);

  let workspace = null;
  let error: string | null = null;
  if (selectedEmploymentId) {
    try {
      workspace = await buildTeacherWorkspace(
        supabase,
        schoolId,
        selectedEmploymentId,
      );
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : "Failed to load teacher workspace.";
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
          Teacher workspace
        </p>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
          Homepage
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Today’s timetable, pending attendance and assessments, homework,
          announcements, events, reminders, and department notices — open a
          panel item to work in the Teacher Portal.
        </p>
      </header>
      <TeacherWorkspaceClient
        workspace={workspace}
        employments={employments}
        selectedEmploymentId={selectedEmploymentId}
        error={error}
      />
    </>
  );
}
