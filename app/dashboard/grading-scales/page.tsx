import { redirect } from "next/navigation";
import { GradingScalesAdminClient } from "@/components/grading-scales/grading-scales-admin-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import type { GradingBand } from "@/lib/config/types";
import { createClient } from "@/lib/supabase/server";

export default async function GradingScalesDashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("config.catalog.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const schoolId = authzCtx.schoolId;
  const headerAuth = await getAppHeaderAuth();
  const canEdit = Boolean(
    headerAuth.authz?.permissions.includes("config.catalog.edit"),
  );

  const { data: scalesRaw } = await supabase
    .from("grading_scales")
    .select(
      "id, code, name, description, grading_scale_versions(version, bands, published_at)",
    )
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  const scales = (scalesRaw ?? []).map((row) => {
    const versions = (
      Array.isArray(row.grading_scale_versions)
        ? row.grading_scale_versions
        : row.grading_scale_versions
          ? [row.grading_scale_versions]
          : []
    ) as Array<{
      version: number;
      bands: unknown;
      published_at: string | null;
    }>;
    const latest = [...versions].sort((a, b) => b.version - a.version)[0];
    const bands = Array.isArray(latest?.bands)
      ? (latest.bands as GradingBand[])
      : [];
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      version: latest?.version ?? null,
      bands,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
            Configuration
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Grading scales
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Versioned mark bands used by assessment frameworks and grade
            calculation. Published bands are immutable — create a new version to
            change them via API.
          </p>
        </header>
        <GradingScalesAdminClient scales={scales} canEdit={canEdit} />
      </main>
  );
}
