"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfigurationDashboardClient } from "@/components/configuration/configuration-dashboard-client";
import { ConfigBrandingEditClient } from "@/components/configuration/config-branding-edit-client";
import { ConfigTermsEditClient } from "@/components/configuration/config-terms-edit-client";
import { ConfigStructureChecklist } from "@/components/configuration/config-structure-checklist";
import type { SchoolBrandingInput } from "@/lib/config/types";
import type {
  ConfigModuleReport,
  ConfigurationDashboardSummary,
} from "@/lib/config-dashboard/types";
import { CONFIG_HUB_TABS } from "@/lib/config-dashboard/hub-tabs";

type TermRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

type CompletenessItem = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

type Props = {
  activeTab: string;
  summary: ConfigurationDashboardSummary;
  modules: ConfigModuleReport[];
  branding: SchoolBrandingInput;
  canEditCatalog: boolean;
  canEditCalendar: boolean;
  academicYearId: string | null;
  terms: TermRow[];
  termCountLocked: boolean;
  lockReason: string | null;
  structureItems: CompletenessItem[];
};

export function ConfigHubClient({
  activeTab,
  summary,
  modules,
  branding,
  canEditCatalog,
  canEditCalendar,
  academicYearId,
  terms,
  termCountLocked,
  lockReason,
  structureItems,
}: Props) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <nav
        aria-label="Configuration tabs"
        className="flex flex-wrap gap-1 border-b border-border pb-3"
      >
        {CONFIG_HUB_TABS.map((tab) => {
          if (tab.kind === "link" && tab.href) {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface hover:text-foreground"
                title={tab.description}
              >
                {tab.label} ↗
              </Link>
            );
          }
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${
                active
                  ? "bg-feezy-indigo/10 font-medium text-feezy-indigo"
                  : "text-muted hover:bg-surface hover:text-foreground"
              }`}
              onClick={() =>
                router.push(`/dashboard/configuration?tab=${tab.id}`)
              }
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "health" ? (
        <ConfigurationDashboardClient summary={summary} modules={modules} />
      ) : null}

      {activeTab === "school-identity" ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">School identity</h2>
          <ConfigBrandingEditClient
            initial={branding}
            canEdit={canEditCatalog}
          />
        </section>
      ) : null}

      {activeTab === "terms" ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Terms</h2>
          {academicYearId ? (
            <ConfigTermsEditClient
              academicYearId={academicYearId}
              terms={terms}
              termCountLocked={termCountLocked}
              lockReason={lockReason}
              canEdit={canEditCalendar}
            />
          ) : (
            <p className="text-sm text-muted">No academic year configured.</p>
          )}
        </section>
      ) : null}

      {activeTab === "structure" ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">
            Classes & sections
          </h2>
          <ConfigStructureChecklist items={structureItems} />
          <p className="text-sm text-muted">
            Structure writers that wipe/rebuild rows stay in onboarding. Use
            this checklist after changes, then fix gaps via{" "}
            <Link href="/dashboard/subjects" className="underline">
              subjects
            </Link>
            ,{" "}
            <Link href="/dashboard/principal/teachers" className="underline">
              teachers
            </Link>
            , and{" "}
            <Link href="/dashboard/principal/students" className="underline">
              students
            </Link>
            .
          </p>
        </section>
      ) : null}
    </div>
  );
}
