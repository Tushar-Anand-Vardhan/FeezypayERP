import { redirect } from "next/navigation";
import { TeacherProfileClient } from "@/components/teacher-portal/profile-client";
import { requirePermission } from "@/lib/authz/require";
import {
  getEmploymentInSchool,
  listActiveEmployments,
  resolveEmploymentForAuthUser,
} from "@/lib/teacher-workspace/server-helpers";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ employment?: string }>;
};

export default async function TeacherProfilePage({ searchParams }: PageProps) {
  const authzCtx = await requirePermission("identity.person.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const supabase = await createClient();
  const params = await searchParams;
  const employments = await listActiveEmployments(supabase, authzCtx.schoolId);

  let employmentId =
    params.employment &&
    employments.some((e) => e.employmentId === params.employment)
      ? params.employment
      : null;

  if (!employmentId && authzCtx.actor.authUserId) {
    const linked = await resolveEmploymentForAuthUser(
      supabase,
      authzCtx.schoolId,
      authzCtx.actor.authUserId,
    );
    employmentId = linked?.employmentId ?? employments[0]?.employmentId ?? null;
  } else if (!employmentId) {
    employmentId = employments[0]?.employmentId ?? null;
  }

  const employment = employmentId
    ? await getEmploymentInSchool(supabase, authzCtx.schoolId, employmentId)
    : null;

  let person: {
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null = null;

  if (employment?.personId) {
    const { data } = await supabase
      .from("persons")
      .select("full_name, email, phone")
      .eq("id", employment.personId)
      .maybeSingle();
    if (data) {
      person = {
        fullName: data.full_name ?? "",
        email: data.email,
        phone: data.phone,
      };
    }
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your person record and teaching employment.
        </p>
      </header>
      <TeacherProfileClient
        person={person}
        employment={
          employment
            ? {
                employmentId: employment.employmentId,
                fullName: employment.fullName,
                designation: employment.designation,
                isHod: employment.isHod,
                status: employment.status,
              }
            : null
        }
        employments={employments.map((e) => ({
          employmentId: e.employmentId,
          fullName: e.fullName,
          designation: e.designation,
        }))}
        canEditSelf={authzCtx.actor.permissionKeys.has("identity.person.edit")}
      />
    </>
  );
}
