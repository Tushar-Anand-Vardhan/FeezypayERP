"use client";

type SubmitButtonProps = {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  fullWidth?: boolean;
  variant?: "primary" | "ghost";
};

export function SubmitButton({
  children,
  loading = false,
  disabled = false,
  type = "submit",
  onClick,
  fullWidth = true,
  variant = "primary",
}: SubmitButtonProps) {
  const base =
    "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "ghost"
      ? "border border-border bg-surface text-foreground hover:bg-surface-strong"
      : "bg-feezy-magenta text-white hover:brightness-110";
  const spinner =
    variant === "ghost"
      ? "border-foreground/20 border-t-foreground"
      : "border-white/30 border-t-white";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${styles} ${fullWidth ? "w-full" : ""}`}
    >
      {loading ? (
        <>
          <span
            className={`h-4 w-4 animate-spin rounded-full border-2 ${spinner}`}
            aria-hidden="true"
          />
          <span>Please wait…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
