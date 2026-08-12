type CompletenessItem = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

type Props = {
  items: CompletenessItem[];
};

export function ConfigStructureChecklist({ items }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        After editing classes or sections, confirm subjects, teachers, and
        students are still assigned. Open the linked modules to fix gaps.
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
          >
            <div>
              <div className="font-medium">{item.label}</div>
              <div className="text-xs text-muted">{item.detail}</div>
            </div>
            <span
              className={
                item.ok
                  ? "text-xs font-medium text-emerald-700"
                  : "text-xs font-medium text-amber-800"
              }
            >
              {item.ok ? "Complete" : "Needs attention"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
