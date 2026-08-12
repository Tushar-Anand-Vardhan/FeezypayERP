import { redirect } from "next/navigation";
import { PrincipalTeachersClient } from "@/components/principal-portal/teachers-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { listPrincipalTeachersAction } from "@/lib/principal-ops/teachers-actions";

export default async function PrincipalTeachersPage() {
  const authzCtx = await requirePermission("workforce.employment.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/principal");
  }

  const headerAuth = await getAppHeaderAuth();
  const canEdit = Boolean(
    headerAuth.authz?.permissions.includes("workforce.employment.edit"),
  );

  const listed = await listPrincipalTeachersAction();
  if (!listed.success) {
    return <p className="text-sm text-muted">{listed.error}</p>;
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Teachers
        </h1>
        <p className="mt-2 text-sm text-muted">
          End employment, edit teachable subjects, and assign class teachers.
          Subject changes that collide with timetable slots require an explicit
          force confirm.
        </p>
      </header>
      <PrincipalTeachersClient
        teachers={listed.teachers}
        subjects={listed.subjects}
        sections={listed.sections}
        canEdit={canEdit}
      />
    </>
  );
}
