"use client";

type SubmitButtonProps = {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  fullWidth?: boolean;
};

export function SubmitButton({
  children,
  loading = false,
  disabled = false,
  type = "submit",
  onClick,
  fullWidth = true,
}: SubmitButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${fullWidth ? "w-full" : ""}`}
    >
      {loading ? (
        <>
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background"
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
