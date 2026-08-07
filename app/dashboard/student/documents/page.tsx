import { redirect } from "next/navigation";
import { StudentStubListClient } from "@/components/student-portal/stub-list-client";
import { requirePermission } from "@/lib/authz/require";
import { getStudentProfileModuleAction } from "@/lib/student-profile/profile-actions";
import { resolveStudentPortalContext } from "@/lib/student-portal/context";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentDocumentsPage({
  searchParams,
}: PageProps) {
  const authz = await requirePermission("enrollment.admission.read");
  if ("error" in authz) redirect("/dashboard/student");

  const params = await searchParams;
  const resolved = await resolveStudentPortalContext({
    studentProfileId: params.studentProfileId,
  });
  if (!resolved.success) {
    return <p className="text-sm text-muted">{resolved.error}</p>;
  }

  const mod = await getStudentProfileModuleAction(
    resolved.context.studentProfileId,
    "documents",
  );
  const source = mod.success ? mod.module.source : "schema_ready";
  const raw = mod.success && Array.isArray(mod.module.data) ? mod.module.data : [];
  const items = (raw as Array<Record<string, unknown>>).map((d, i) => ({
    id: String(d.id ?? i),
    label: String(d.title ?? d.document_type ?? "Document"),
    detail: d.issued_at ? String(d.issued_at) : null,
  }));

  return (
    <StudentStubListClient
      title="Documents"
      description="Issued documents and certificate references"
      source={source}
      items={items}
      emptyMessage="No documents yet (module schema-ready)."
    />
  );
}
