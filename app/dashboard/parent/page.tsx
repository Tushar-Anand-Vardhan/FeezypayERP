import { StudentHomeClient } from "@/components/student-portal/home-client";
import { listNotificationHistoryAction } from "@/lib/notifications";
import { getStudentProfileAction } from "@/lib/student-profile/profile-actions";
import { resolveStudentPortalContext } from "@/lib/student-portal/context";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

function qs(id: string) {
  return `?studentProfileId=${id}`;
}

export default async function ParentHomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const resolved = await resolveStudentPortalContext({
    studentProfileId: params.studentProfileId,
  });
  if (!resolved.success) {
    return <p className="text-sm text-muted">{resolved.error}</p>;
  }

  const { context } = resolved;
  const profile = await getStudentProfileAction(context.studentProfileId);
  if (!profile.success) {
    return <p className="text-sm text-red-700">{profile.error}</p>;
  }

  const q = qs(context.studentProfileId);
  const cards = [
    {
      href: `/dashboard/parent/attendance${q}`,
      label: "Attendance",
      summary: "Child attendance history",
    },
    {
      href: `/dashboard/parent/homework${q}`,
      label: "Homework",
      summary: "Assigned work (read-only)",
    },
    {
      href: `/dashboard/parent/assessments${q}`,
      label: "Assessments",
      summary: "Published marks and grades",
    },
    {
      href: `/dashboard/parent/report-cards${q}`,
      label: "Report cards",
      summary: "Issued report cards",
    },
    {
      href: `/dashboard/parent/announcements${q}`,
      label: "Announcements",
      summary: "School messages",
    },
    {
      href: `/dashboard/parent/behaviour${q}`,
      label: "Behaviour",
      summary: "Conduct records",
    },
  ];

  const notes = await listNotificationHistoryAction({
    studentProfileId: context.studentProfileId,
    mineOnly: false,
    limit: 8,
  });
  const notifications = (notes.success ? notes.rows : []).map((n) => ({
    id: String(n.id),
    title: String(n.title ?? "Notification"),
    createdAt: n.created_at ? String(n.created_at) : null,
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Parent portal
        </h1>
        <p className="mt-2 text-sm text-muted">
          Read-only view for {context.displayName ?? "your child"}.
        </p>
      </header>
      <StudentHomeClient
        displayName={context.displayName}
        isPreview={false}
        cards={cards}
        notifications={notifications}
      />
    </>
  );
}
