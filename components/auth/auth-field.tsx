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
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-feezy-indigo/40 focus:ring-2 focus:ring-feezy-indigo/15";

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
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
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
        <p id={errorId} className="text-sm text-feezy-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}
