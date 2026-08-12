import { redirect } from "next/navigation";
import { TeacherProfileClient } from "@/components/teacher-portal/profile-client";
import { requirePermission } from "@/lib/authz/require";
import {
  listMyEmploymentHistoryAction,
} from "@/lib/workforce/career-actions";
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

  let career: {
    qualification: string | null;
    yearsExperience: number | null;
    bio: string | null;
    linkedinUrl: string | null;
    preferredSubjects: string[];
    preferredStandards: string | null;
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

    const { data: tp } = await supabase
      .from("teacher_profiles")
      .select(
        "qualification, years_experience, bio, linkedin_url, preferred_subjects, preferred_standards",
      )
      .eq("person_id", employment.personId)
      .maybeSingle();
    if (tp) {
      career = {
        qualification: tp.qualification,
        yearsExperience: tp.years_experience,
        bio: tp.bio,
        linkedinUrl: tp.linkedin_url,
        preferredSubjects: Array.isArray(tp.preferred_subjects)
          ? tp.preferred_subjects
          : [],
        preferredStandards: tp.preferred_standards,
      };
    }
  }

  const historyRes = await listMyEmploymentHistoryAction();
  const history = historyRes.success ? historyRes.history : [];

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="mt-2 text-sm text-muted">
          Career preferences, affiliations, and self-serve leave.
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
        career={career}
        history={history}
        canEditSelf={authzCtx.actor.permissionKeys.has("identity.person.edit")}
        canLeave={authzCtx.actor.permissionKeys.has(
          "workforce.employment.self_end",
        )}
      />
    </>
  );
}
