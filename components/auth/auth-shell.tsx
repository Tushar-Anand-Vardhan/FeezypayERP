import { BrandMark } from "@/components/brand/brand-mark";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  notice?: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthShell({
  title,
  description,
  children,
  notice,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center space-y-4 text-center">
          <BrandMark size="md" showWordmark />
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-muted">{description}</p>
          </div>
        </div>
        {notice ? (
          <div className="mb-6 rounded-xl border border-border bg-surface-strong px-4 py-3 text-sm text-muted">
            {notice}
          </div>
        ) : null}
        {children}
        {footer ? (
          <div className="mt-6 text-center text-sm text-muted">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
