type Props = {
  title: string;
  description: string;
  source: string;
  items: Array<{ id: string; label: string; detail?: string | null }>;
  emptyMessage: string;
};

export function StudentStubListClient({
  title,
  description,
  source,
  items,
  emptyMessage,
}: Props) {
  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {description}
          {source ? ` · source: ${source}` : ""}
        </p>
      </header>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {items.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">{emptyMessage}</li>
        ) : (
          items.map((i) => (
            <li key={i.id} className="px-4 py-3 text-sm">
              <span className="font-medium">{i.label}</span>
              {i.detail ? (
                <span className="text-muted"> · {i.detail}</span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </>
  );
}
