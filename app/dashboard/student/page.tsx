import { StudentHomeClient } from "@/components/student-portal/home-client";
import { listNotificationHistoryAction } from "@/lib/notifications";
import { getStudentProfileAction } from "@/lib/student-profile/profile-actions";
import { resolveStudentPortalContext } from "@/lib/student-portal/context";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

function qs(id: string, isPreview: boolean) {
  return isPreview || id ? `?studentProfileId=${id}` : "";
}

export default async function StudentHomePage({ searchParams }: PageProps) {
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

  const mods = profile.profile.modules;
  const q = qs(context.studentProfileId, context.isPreview);

  const cards = [
    {
      href: `/dashboard/student/attendance${q}`,
      label: "Attendance",
      summary:
        mods.attendance?.source === "live"
          ? "View your attendance history"
          : "Attendance module",
    },
    {
      href: `/dashboard/student/homework${q}`,
      label: "Homework",
      summary: "Assigned work (read-only)",
    },
    {
      href: `/dashboard/student/assessments${q}`,
      label: "Assessments",
      summary: "Published marks and grades",
    },
    {
      href: `/dashboard/student/report-cards${q}`,
      label: "Report cards",
      summary: "Issued report cards",
    },
    {
      href: `/dashboard/student/announcements${q}`,
      label: "Announcements",
      summary: "Messages for you",
    },
    {
      href: `/dashboard/student/events${q}`,
      label: "Events",
      summary: "Activities and participation",
    },
  ];

  const notes = await listNotificationHistoryAction({
    studentProfileId: context.studentProfileId,
    mineOnly: !context.isPreview,
    limit: 8,
  });
  const notifications = (notes.success ? notes.rows : []).map((n) => ({
    id: String(n.id),
    title: String(n.title ?? "Notification"),
    createdAt: n.created_at ? String(n.created_at) : null,
  }));

  return (
    <StudentHomeClient
      displayName={context.displayName}
      isPreview={context.isPreview}
      cards={cards}
      notifications={notifications}
    />
  );
}
