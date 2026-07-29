type AuthFieldProps = {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  describedBy?: string;
};

const inputClassName =
  "w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10";

export function AuthField({
  id,
  label,
  type = "text",
  autoComplete,
  value,
  onChange,
  error,
  describedBy,
}: AuthFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
        aria-invalid={Boolean(error)}
        aria-describedby={[describedBy, errorId].filter(Boolean).join(" ") || undefined}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
