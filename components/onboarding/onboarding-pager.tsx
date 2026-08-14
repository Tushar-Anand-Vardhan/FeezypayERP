"use client";

type OnboardingPagerProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  noun?: string;
};

export function OnboardingPager({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  noun = "rows",
}: OnboardingPagerProps) {
  if (total === 0 || pageCount <= 1) {
    return total > 0 ? (
      <p className="text-xs text-muted">
        Showing {total} {noun}
      </p>
    ) : null;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted">
        Showing {from}–{to} of {total} {noun}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(
          (n) => (
            <button
              key={n}
              type="button"
              aria-current={n === page ? "page" : undefined}
              className={`min-w-9 rounded-lg px-2.5 py-1.5 text-sm ${
                n === page
                  ? "bg-feezy-indigo text-white"
                  : "border border-border hover:bg-surface-strong"
              }`}
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
