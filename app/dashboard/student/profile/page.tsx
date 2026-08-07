import { redirect } from "next/navigation";
import { StudentProfileClient } from "@/components/student-portal/profile-client";
import { requirePermission } from "@/lib/authz/require";
import { getStudentProfileModuleAction } from "@/lib/student-profile/profile-actions";
import type {
  AdmissionData,
  PersonalInformationData,
} from "@/lib/student-profile/types";
import { resolveStudentPortalContext } from "@/lib/student-portal/context";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentProfilePage({ searchParams }: PageProps) {
  const authz = await requirePermission("identity.person.read");
  if ("error" in authz) redirect("/dashboard/student");

  const params = await searchParams;
  const resolved = await resolveStudentPortalContext({
    studentProfileId: params.studentProfileId,
  });
  if (!resolved.success) {
    return <p className="text-sm text-muted">{resolved.error}</p>;
  }

  const id = resolved.context.studentProfileId;
  const [personalMod, admissionMod, houseMod, clubsMod, parentsMod] =
    await Promise.all([
      getStudentProfileModuleAction(id, "personal"),
      getStudentProfileModuleAction(id, "admission"),
      getStudentProfileModuleAction(id, "house"),
      getStudentProfileModuleAction(id, "club_membership"),
      getStudentProfileModuleAction(id, "parents"),
    ]);

  const personal =
    personalMod.success && personalMod.module.data
      ? (personalMod.module.data as PersonalInformationData)
      : null;
  const admission =
    admissionMod.success && admissionMod.module.data
      ? (admissionMod.module.data as AdmissionData)
      : null;

  let house: string | null = null;
  if (houseMod.success && houseMod.module.data) {
    const d = houseMod.module.data as { name?: string; houseName?: string };
    house = d.name ?? d.houseName ?? null;
  }

  const clubs: string[] = [];
  if (clubsMod.success && Array.isArray(clubsMod.module.data)) {
    for (const c of clubsMod.module.data as Array<{ name?: string }>) {
      if (c.name) clubs.push(c.name);
    }
  }

  const parents: string[] = [];
  if (parentsMod.success && Array.isArray(parentsMod.module.data)) {
    for (const p of parentsMod.module.data as Array<{ fullName?: string }>) {
      if (p.fullName) parents.push(p.fullName);
    }
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your personal and admission details.
        </p>
      </header>
      <StudentProfileClient
        personal={
          personal
            ? {
                fullName: personal.fullName,
                email: personal.email,
                phone: personal.phone,
                dateOfBirth: personal.dateOfBirth,
                gender: personal.gender,
              }
            : null
        }
        admission={
          admission
            ? {
                admissionNumber: admission.admissionNumber,
                status: admission.status,
                admittedOn: admission.admittedOn,
              }
            : null
        }
        house={house}
        clubs={clubs}
        parents={parents}
      />
    </>
  );
}
