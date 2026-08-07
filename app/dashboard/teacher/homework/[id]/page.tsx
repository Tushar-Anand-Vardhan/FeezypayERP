import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/authz/require";
import { getHomeworkAction } from "@/lib/homework";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ employment?: string }>;
};

export default async function TeacherHomeworkDetailPage({
  params,
  searchParams,
}: PageProps) {
  const authzCtx = await requirePermission("homework.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher/homework");
  }

  const { id } = await params;
  const sp = await searchParams;
  const qs = sp.employment ? `?employment=${sp.employment}` : "";

  const hw = await getHomeworkAction(id);
  if (!hw.success) {
    return <p className="text-sm text-red-700">{hw.error}</p>;
  }

  const submissions = hw.submissions;

  return (
    <>
      <header>
        <Link
          href={`/dashboard/teacher/homework${qs}`}
          className="text-sm text-feezy-indigo hover:underline"
        >
          ← Homework
        </Link>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
          {String(hw.homework.title ?? "Homework")}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Status: {String(hw.homework.status)}
          {hw.homework.due_on
            ? ` · due ${String(hw.homework.due_on)}`
            : ""}
          {" · "}
          {hw.summary.submitted}/{hw.summary.total} submitted ·{" "}
          {hw.summary.graded} graded
        </p>
      </header>
      <section>
        <h2 className="text-sm font-semibold">Submissions</h2>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {submissions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">
              No submissions yet.
            </li>
          ) : (
            submissions.map((s) => (
              <li key={String(s.id)} className="px-4 py-3 text-sm">
                {String(s.student_profile_id ?? "").slice(0, 8)} ·{" "}
                {String(s.status ?? "")}
                {s.marks_awarded != null
                  ? ` · ${String(s.marks_awarded)}`
                  : ""}
              </li>
            ))
          )}
        </ul>
      </section>
    </>
  );
}
