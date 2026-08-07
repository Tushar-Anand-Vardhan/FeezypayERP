import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function resolveActiveYearId(
  supabase: Supabase,
  schoolId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();
  return data?.id ?? null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function percent(obtained: number, max: number): number | null {
  if (max <= 0) return null;
  return round2((obtained / max) * 100);
}
