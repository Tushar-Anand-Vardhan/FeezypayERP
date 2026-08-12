/** Term count lock + date vs calendar event conflicts (Wave 3 / D16). */

type Supabase = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export async function countActiveTerms(
  supabase: Supabase,
  academicYearId: string,
): Promise<number> {
  const { count } = await supabase
    .from("terms")
    .select("id", { count: "exact", head: true })
    .eq("academic_year_id", academicYearId)
    .is("archived_at", null);
  return count ?? 0;
}

/**
 * Term count is locked once the school finished onboarding or the year
 * already has at least one term (cannot freely add/remove after setup).
 */
export async function isTermCountLocked(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string,
): Promise<{ locked: boolean; reason?: string }> {
  const { data: school } = await supabase
    .from("schools")
    .select("onboarding_status")
    .eq("id", schoolId)
    .maybeSingle();

  const active = await countActiveTerms(supabase, academicYearId);
  if (school?.onboarding_status === "completed" && active > 0) {
    return {
      locked: true,
      reason:
        "Term count is locked after onboarding. Change dates only, or cancel conflicting events first if needed.",
    };
  }

  // Also lock when any calendar event pins a term in this year
  const { data: terms } = await supabase
    .from("terms")
    .select("id")
    .eq("academic_year_id", academicYearId)
    .is("archived_at", null);
  const termIds = (terms ?? []).map((t) => t.id);
  if (termIds.length > 0) {
    const { count } = await supabase
      .from("calendar_events")
      .select("id", { count: "exact", head: true })
      .in("term_id", termIds)
      .is("archived_at", null);
    if ((count ?? 0) > 0 && active > 0) {
      return {
        locked: true,
        reason:
          "Term count is locked because calendar events reference these terms.",
      };
    }
  }

  return { locked: false };
}

export async function findTermDateConflicts(
  supabase: Supabase,
  termId: string,
  startDate: string,
  endDate: string,
): Promise<string[]> {
  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, title, starts_at, ends_at")
    .eq("term_id", termId)
    .is("archived_at", null)
    .limit(100);

  const conflicts: string[] = [];
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T23:59:59.999Z`).getTime();

  for (const ev of events ?? []) {
    const evStart = ev.starts_at ? new Date(String(ev.starts_at)).getTime() : NaN;
    const evEnd = ev.ends_at ? new Date(String(ev.ends_at)).getTime() : evStart;
    if (Number.isNaN(evStart)) continue;
    if (evStart < start || evEnd > end) {
      conflicts.push(
        `"${ev.title ?? ev.id}" falls outside the new term dates.`,
      );
    }
  }

  return conflicts;
}
