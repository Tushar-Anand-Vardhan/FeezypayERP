"use client";

type SubmitButtonProps = {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
};

export function SubmitButton({
  children,
  loading = false,
  disabled = false,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
