import type { KeyboardEvent, ReactNode } from "react";

export const formControlClassName =
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-feezy-indigo/40 focus:ring-2 focus:ring-feezy-indigo/15";

type FormFieldProps = {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  describedBy?: string;
  required?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export function FormField({
  id,
  label,
  type = "text",
  autoComplete,
  value,
  onChange,
  error,
  describedBy,
  required = false,
  onKeyDown,
}: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? <span className="text-foreground/60"> *</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className={formControlClassName}
        aria-invalid={Boolean(error)}
        aria-describedby={[describedBy, errorId].filter(Boolean).join(" ") || undefined}
        required={required}
      />
      {error ? (
        <p id={errorId} className="text-sm text-feezy-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FormSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  required?: boolean;
  placeholder?: string;
  children: ReactNode;
};

export function FormSelect({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  placeholder,
  children,
}: FormSelectProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? <span className="text-foreground/60"> *</span> : null}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={formControlClassName}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        required={required}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      {error ? (
        <p id={errorId} className="text-sm text-feezy-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}
