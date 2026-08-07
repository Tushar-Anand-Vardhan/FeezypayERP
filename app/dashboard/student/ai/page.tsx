import { redirect } from "next/navigation";
import { StudentAiPlaceholderClient } from "@/components/student-portal/ai-client";
import { requirePermission } from "@/lib/authz/require";
import { resolveStudentPortalContext } from "@/lib/student-portal/context";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentAiPage({ searchParams }: PageProps) {
  const authz = await requirePermission("enrollment.admission.read");
  if ("error" in authz) redirect("/dashboard/student");

  const params = await searchParams;
  const resolved = await resolveStudentPortalContext({
    studentProfileId: params.studentProfileId,
  });
  if (!resolved.success) {
    return <p className="text-sm text-muted">{resolved.error}</p>;
  }

  return <StudentAiPlaceholderClient />;
}
