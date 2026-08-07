export function StudentAiPlaceholderClient() {
  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          AI assistant
        </h1>
        <p className="mt-2 text-sm text-muted">
          Coming soon — student AI tools are not built yet (E23).
        </p>
      </header>
      <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">
        Status: <span className="font-medium text-foreground">not_built</span>
        . No generated answers or tutoring shortcuts in this portal version.
      </div>
    </>
  );
}
